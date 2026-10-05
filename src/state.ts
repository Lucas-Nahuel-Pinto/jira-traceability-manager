export type TabId = 'tree' | 'graph' | 'matrix' | 'alerts' | 'metrics';

export interface AppState {
  tab: TabId
  selectedKey: string | null
  search: string
}

const state: AppState = {
  tab: 'tree',
  selectedKey: null,
  search: '',
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function subscribe(listener: () => void): void {
  listeners.add(listener);
}

export function notify(): void {
  for (const listener of listeners) { listener(); }
}

export function setTab(tab: TabId): void {
  state.tab = tab;
  notify();
}

export function select(key: string | null): void {
  state.selectedKey = key;
  notify();
}

export function setSearch(search: string): void {
  state.search = search;
  notify();
}
