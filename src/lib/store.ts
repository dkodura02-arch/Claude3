import { get as idbGet, set as idbSet } from 'idb-keyval';
import { callApi, errorMessage, isConfigured, ApiError, type ApiConfig } from './api';
import type { Collection, CollectionTypes, Doc } from './types';

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

interface Persisted {
  docs: Doc[];
  pending: [string, number][];
  lastRev: number;
  trash: string[];
}

const IDB_KEY = 'kochplaner-state-v1';
const SETTINGS_KEY = 'kochplaner-settings';
const SYNC_INTERVAL = 60_000;

const keyOf = (coll: Collection, id: string) => `${coll}/${id}`;

function loadSettings(): ApiConfig | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as ApiConfig) : null;
  } catch {
    return null;
  }
}

export interface UploadResult {
  url: string;
  driveId?: string;
}

export class Store {
  private docs = new Map<string, Doc>();
  /** key -> updatedAt of the local change that still has to reach the server */
  private pending = new Map<string, number>();
  /** Drive image ids to delete on next sync */
  private trash: string[] = [];
  private lastRev = 0;
  private listeners = new Set<() => void>();
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private syncing = false;
  private syncAgain = false;
  private cache = new Map<Collection, unknown[]>();

  version = 0;
  ready = false;
  /** Called after every successful sync (data from the other phone may have arrived) */
  afterSync?: () => void;
  config: ApiConfig | null = typeof localStorage !== 'undefined' ? loadSettings() : null;
  status: SyncStatus = isConfigured(this.config) ? 'idle' : 'local';
  lastSync?: number;
  error?: string;

  async init({ background = true } = {}) {
    try {
      const saved = await idbGet<Persisted>(IDB_KEY);
      if (saved) {
        for (const d of saved.docs) this.docs.set(keyOf(d.coll, d.id), d);
        this.pending = new Map(saved.pending);
        this.lastRev = saved.lastRev;
        this.trash = saved.trash ?? [];
      }
    } catch (e) {
      console.warn('IndexedDB nicht verfügbar', e);
    }
    this.ready = true;
    this.emit(false);
    if (!background) return;
    void this.sync();
    setInterval(() => {
      if (document.visibilityState === 'visible') void this.sync();
    }, SYNC_INTERVAL);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.sync();
    });
    window.addEventListener('online', () => void this.sync());
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  private emit(persist = true) {
    this.version++;
    this.cache.clear();
    this.listeners.forEach((l) => l());
    if (persist) this.schedulePersist();
  }

  private schedulePersist() {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      const data: Persisted = {
        docs: [...this.docs.values()],
        pending: [...this.pending.entries()],
        lastRev: this.lastRev,
        trash: this.trash,
      };
      try {
        idbSet(IDB_KEY, data).catch((e) => console.warn('Speichern fehlgeschlagen', e));
      } catch (e) {
        console.warn('IndexedDB nicht verfügbar', e);
      }
    }, 250);
  }

  private scheduleSync(delay = 1500) {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.sync(), delay);
  }

  list<C extends Collection>(coll: C): CollectionTypes[C][] {
    const cached = this.cache.get(coll);
    if (cached) return cached as CollectionTypes[C][];
    const out: CollectionTypes[C][] = [];
    for (const d of this.docs.values()) {
      if (d.coll === coll && !d.deleted && d.data) out.push(d.data as CollectionTypes[C]);
    }
    this.cache.set(coll, out);
    return out;
  }

  entries<C extends Collection>(coll: C): [string, CollectionTypes[C]][] {
    const out: [string, CollectionTypes[C]][] = [];
    for (const d of this.docs.values()) {
      if (d.coll === coll && !d.deleted && d.data) out.push([d.id, d.data as CollectionTypes[C]]);
    }
    return out;
  }

  get<C extends Collection>(coll: C, id: string): CollectionTypes[C] | undefined {
    const d = this.docs.get(keyOf(coll, id));
    return d && !d.deleted && d.data ? (d.data as CollectionTypes[C]) : undefined;
  }

  /** True if the document exists or existed (deleted ones count, so they aren't re-added). */
  known(coll: Collection, id: string): boolean {
    return this.docs.has(keyOf(coll, id));
  }

  put<C extends Collection>(coll: C, id: string, data: CollectionTypes[C]) {
    this.write({ coll, id, data, deleted: false });
  }

  remove(coll: Collection, id: string) {
    if (!this.docs.has(keyOf(coll, id))) return;
    this.write({ coll, id, data: null, deleted: true });
  }

  /** Several changes at once (one re-render, one sync) */
  batch(fn: () => void) {
    this.batching = true;
    try {
      fn();
    } finally {
      this.batching = false;
      this.emit();
      this.scheduleSync();
    }
  }
  private batching = false;

  private write(change: Omit<Doc, 'updatedAt'>) {
    const key = keyOf(change.coll, change.id);
    const prev = this.docs.get(key);
    const updatedAt = Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1);
    const doc: Doc = { ...change, updatedAt, rev: prev?.rev };
    this.docs.set(key, doc);
    this.pending.set(key, updatedAt);
    if (!this.batching) {
      this.emit();
      this.scheduleSync();
    }
  }

  trashImage(driveId: string | undefined) {
    if (!driveId) return;
    this.trash.push(driveId);
    this.schedulePersist();
  }

  get pendingCount() {
    return this.pending.size;
  }

  setConfig(cfg: ApiConfig | null) {
    this.config = cfg;
    if (cfg) localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(SETTINGS_KEY);
    this.status = isConfigured(cfg) ? 'idle' : 'local';
    this.error = undefined;
    this.emit(false);
    void this.sync();
  }

  async call<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
    if (!isConfigured(this.config)) throw new ApiError('local', 'Google Drive ist noch nicht verbunden.');
    return callApi<T>(this.config, body);
  }

  get online() {
    return isConfigured(this.config);
  }

  /** Upload an image (data URL) to Drive; in local mode the data URL itself is kept. */
  async uploadImage(dataUrl: string, name: string): Promise<UploadResult> {
    if (!this.online) return { url: dataUrl };
    const [, mimeType, base64] = dataUrl.match(/^data:([^;]+);base64,(.*)$/) ?? [];
    if (!base64) return { url: dataUrl };
    const res = await this.call<{ id: string; url: string }>({ op: 'upload', mimeType, base64, name });
    return { url: res.url || dataUrl, driveId: res.id };
  }

  async sync(): Promise<void> {
    if (!this.ready) return;
    if (!isConfigured(this.config)) {
      this.status = 'local';
      return;
    }
    if (this.syncing) {
      this.syncAgain = true;
      return;
    }
    this.syncing = true;
    this.status = 'syncing';
    this.emit(false);
    try {
      await this.uploadLocalImages();
      await this.emptyTrash();

      const sent = [...this.pending.entries()];
      const changes = sent
        .map(([key]) => this.docs.get(key))
        .filter((d): d is Doc => !!d)
        .map(({ coll, id, data, updatedAt, deleted }) => ({ coll, id, data, updatedAt, deleted }));
      const res = await this.call<{ rev: number; docs: Doc[] }>({ op: 'sync', since: this.lastRev, changes });

      for (const server of res.docs) {
        const key = keyOf(server.coll, server.id);
        const local = this.docs.get(key);
        if (local && this.pending.has(key) && local.updatedAt > server.updatedAt) continue;
        this.docs.set(key, server);
        this.pending.delete(key);
      }
      for (const [key, ts] of sent) {
        if (this.docs.get(key)?.updatedAt === ts) this.pending.delete(key);
      }
      this.lastRev = res.rev;
      this.status = 'idle';
      this.error = undefined;
      this.lastSync = Date.now();
      this.afterSync?.();
    } catch (e) {
      this.status = navigator.onLine === false || (e instanceof ApiError && e.code === 'network') ? 'offline' : 'error';
      this.error = errorMessage(e);
    } finally {
      this.syncing = false;
      this.emit();
      if (this.syncAgain) {
        this.syncAgain = false;
        this.scheduleSync(200);
      }
    }
  }

  /** Recipes created in local mode carry their picture as data URL -> move it to Drive. */
  private async uploadLocalImages() {
    for (const d of [...this.docs.values()]) {
      if (d.coll !== 'recipes' || d.deleted || !d.data) continue;
      const r = d.data as CollectionTypes['recipes'];
      if (!r.image?.url.startsWith('data:')) continue;
      const up = await this.uploadImage(r.image.url, r.title);
      if (up.driveId) this.put('recipes', r.id, { ...r, image: { url: up.url, driveId: up.driveId } });
    }
  }

  private async emptyTrash() {
    while (this.trash.length) {
      const id = this.trash[0];
      await this.call({ op: 'deleteImage', id }).catch(() => undefined);
      this.trash.shift();
    }
  }

  /** Everything as JSON (backup / export) */
  exportJson(): string {
    const docs = [...this.docs.values()].filter((d) => !d.deleted);
    return JSON.stringify({ app: 'kochplaner', exportedAt: new Date().toISOString(), docs }, null, 1);
  }

  importJson(text: string): number {
    const parsed = JSON.parse(text) as { app?: string; docs?: Doc[] };
    if (parsed.app !== 'kochplaner' || !Array.isArray(parsed.docs)) throw new Error('Keine Kochplaner-Sicherung.');
    let count = 0;
    this.batch(() => {
      for (const d of parsed.docs!) {
        if (!d.coll || !d.id || !d.data) continue;
        this.write({ coll: d.coll, id: d.id, data: d.data, deleted: false });
        count++;
      }
    });
    return count;
  }
}

export const store = new Store();
