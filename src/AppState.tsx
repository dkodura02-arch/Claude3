import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { planningWeek } from './lib/dates';
import type { ImportedRecipe } from './lib/importer';
import type { ShuffleFilters, Slot, SlotPick } from './lib/shuffle';

export type Route =
  | { name: 'woche' }
  | { name: 'rezepte' }
  | { name: 'rezept'; id: string }
  | { name: 'bearbeiten'; id: string }
  | { name: 'neu' }
  | { name: 'einkauf' }
  | { name: 'saison' }
  | { name: 'einstellungen' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'rezepte':
      return { name: 'rezepte' };
    case 'rezept':
      if (parts[1] && parts[2] === 'bearbeiten') return { name: 'bearbeiten', id: parts[1] };
      if (parts[1]) return { name: 'rezept', id: parts[1] };
      return { name: 'rezepte' };
    case 'neu':
      return { name: 'neu' };
    case 'einkauf':
      return { name: 'einkauf' };
    case 'saison':
      return { name: 'saison' };
    case 'einstellungen':
      return { name: 'einstellungen' };
    default:
      return { name: 'woche' };
  }
}

export function routeHash(r: Route): string {
  switch (r.name) {
    case 'rezept':
      return `#/rezept/${encodeURIComponent(r.id)}`;
    case 'bearbeiten':
      return `#/rezept/${encodeURIComponent(r.id)}/bearbeiten`;
    case 'woche':
      return '#/';
    default:
      return `#/${r.name}`;
  }
}

export function navigate(r: Route, replace = false) {
  const h = routeHash(r);
  if (replace) history.replaceState(null, '', h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

interface AppState {
  route: Route;
  week: string;
  setWeek: (w: string) => void;
  filters: ShuffleFilters;
  setFilters: (f: ShuffleFilters) => void;
  /** Recipes already shown per week+slot, so reshuffling brings something new */
  seen: Record<string, string[]>;
  addSeen: (week: string, slot: Slot, id: string) => void;
  /** Last shuffle result per week+slot (to show reasons) */
  picks: Record<string, SlotPick | null | undefined>;
  setPick: (week: string, slot: Slot, p: SlotPick | null | undefined) => void;
  draft: ImportedRecipe | null;
  setDraft: (d: ImportedRecipe | null) => void;
  toast: string | null;
  showToast: (m: string | null) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const [week, setWeek] = useState(planningWeek());
  const [filters, setFilters] = useState<ShuffleFilters>({});
  const [seen, setSeen] = useState<Record<string, string[]>>({});
  const [picks, setPicks] = useState<Record<string, SlotPick | null | undefined>>({});
  const [draft, setDraft] = useState<ImportedRecipe | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const addSeen = useCallback((w: string, slot: Slot, id: string) => {
    setSeen((s) => {
      const k = `${w}|${slot}`;
      const list = s[k] ?? [];
      return list.includes(id) ? s : { ...s, [k]: [...list, id] };
    });
  }, []);

  const setPick = useCallback((w: string, slot: Slot, p: SlotPick | null | undefined) => {
    setPicks((s) => ({ ...s, [`${w}|${slot}`]: p }));
  }, []);

  const value = useMemo<AppState>(
    () => ({
      route,
      week,
      setWeek,
      filters,
      setFilters,
      seen,
      addSeen,
      picks,
      setPick,
      draft,
      setDraft,
      toast,
      showToast: setToast,
    }),
    [route, week, filters, seen, addSeen, picks, setPick, draft, toast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppStateProvider fehlt');
  return v;
}
