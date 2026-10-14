import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/* Minimal in-memory stand-ins for the Apps Script services used by Code.gs */

let idCounter = 0;
const newId = () => `id_${String(++idCounter).padStart(12, '0')}`;

export class MockBlob {
  constructor(
    public bytes: number[],
    public mime: string,
    public name = '',
  ) {}
  getDataAsString() {
    return Buffer.from(this.bytes).toString('utf8');
  }
  getBytes() {
    return this.bytes;
  }
  getContentType() {
    return this.mime;
  }
  setName(n: string) {
    this.name = n;
    return this;
  }
}

const iter = <T,>(items: T[]) => {
  let i = 0;
  return { hasNext: () => i < items.length, next: () => items[i++] };
};

class MockFile {
  id = newId();
  trashed = false;
  sharing: string | null = null;
  constructor(
    public name: string,
    public blob: MockBlob,
    public parent: MockFolder,
  ) {}
  getId() {
    return this.id;
  }
  getName() {
    return this.name;
  }
  getBlob() {
    return this.blob;
  }
  setContent(text: string) {
    this.blob = new MockBlob([...Buffer.from(text, 'utf8')], this.blob.mime);
  }
  setSharing(access: string) {
    this.sharing = access;
  }
  setTrashed(t: boolean) {
    this.trashed = t;
  }
  isTrashed() {
    return this.trashed;
  }
  getParents() {
    return iter([this.parent]);
  }
  makeCopy(name: string, folder: MockFolder) {
    const f = new MockFile(name, new MockBlob([...this.blob.bytes], this.blob.mime), folder);
    folder.files.push(f);
    drive.files.set(f.id, f);
    return f;
  }
}

class MockFolder {
  id = newId();
  folders: MockFolder[] = [];
  files: MockFile[] = [];
  constructor(public name: string) {}
  getId() {
    return this.id;
  }
  getUrl() {
    return `https://drive.google.com/drive/folders/${this.id}`;
  }
  isTrashed() {
    return false;
  }
  getFoldersByName(n: string) {
    return iter(this.folders.filter((f) => f.name === n));
  }
  getFilesByName(n: string) {
    return iter(this.files.filter((f) => f.name === n && !f.trashed));
  }
  getFiles() {
    return iter(this.files.filter((f) => !f.trashed));
  }
  createFolder(n: string) {
    const f = new MockFolder(n);
    this.folders.push(f);
    drive.folders.set(f.id, f);
    return f;
  }
  createFile(nameOrBlob: string | MockBlob, content?: string, mime?: string) {
    const blob = typeof nameOrBlob === 'string' ? new MockBlob([...Buffer.from(content ?? '', 'utf8')], mime ?? 'text/plain') : nameOrBlob;
    const f = new MockFile(typeof nameOrBlob === 'string' ? nameOrBlob : nameOrBlob.name, blob, this);
    this.files.push(f);
    drive.files.set(f.id, f);
    return f;
  }
}

export let drive: { root: MockFolder; files: Map<string, MockFile>; folders: Map<string, MockFolder> };
export let props: Map<string, string>;
export let fetchResponses: Map<string, { code: number; text?: string; blob?: MockBlob }>;
export let api: Record<string, (...args: unknown[]) => unknown>;

export function load() {
  idCounter = 0;
  const root = new MockFolder('root');
  drive = { root, files: new Map(), folders: new Map([[root.id, root]]) };
  props = new Map([['PASSWORT', 'geheim']]);
  fetchResponses = new Map();

  const sandbox: Record<string, unknown> = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => props.set(k, v),
      }),
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' },
      getRootFolder: () => drive.root,
      getFolderById: (id: string) => {
        const f = drive.folders.get(id);
        if (!f) throw new Error('not found');
        return f;
      },
      getFileById: (id: string) => {
        const f = drive.files.get(id);
        if (!f) throw new Error('not found');
        return f;
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      sleep() {},
      base64Decode: (s: string) => [...Buffer.from(s, 'base64')],
      base64Encode: (b: number[]) => Buffer.from(b).toString('base64'),
      newBlob: (bytes: number[], mime: string, name: string) => new MockBlob(bytes, mime, name),
      formatDate: (d: Date) => d.toISOString().slice(0, 10),
    },
    Session: { getScriptTimeZone: () => 'Europe/Berlin' },
    Logger: { log() {} },
    UrlFetchApp: {
      fetch: (url: string) => {
        const r = fetchResponses.get(url) ?? { code: 404, text: 'nope' };
        return {
          getResponseCode: () => r.code,
          getContentText: () => r.text ?? '',
          getBlob: () => r.blob ?? new MockBlob([...Buffer.from(r.text ?? '')], 'text/html'),
        };
      },
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s: string) => ({ setMimeType: () => ({ content: s }) }),
    },
  };
  vm.createContext(sandbox);
  const code = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Code.gs'), 'utf8');
  vm.runInContext(code, sandbox);
  api = sandbox as typeof api;
}

