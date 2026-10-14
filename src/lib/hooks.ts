import { useSyncExternalStore } from 'react';
import { store } from './store';
import type { Collection, CollectionTypes } from './types';

/** Re-render whenever the store changes. */
export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}

export function useCollection<C extends Collection>(coll: C): CollectionTypes[C][] {
  useStoreVersion();
  return store.list(coll);
}

export function useDoc<C extends Collection>(coll: C, id: string | undefined): CollectionTypes[C] | undefined {
  useStoreVersion();
  return id ? store.get(coll, id) : undefined;
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
