export type TabId = 'tree' | 'graph' | 'matrix' | 'alerts' | 'metrics';

export interface Filters {
  issueTypes: string[]
  statuses: string[]
  components: string[]
}

export interface AppState {
  tab: TabId
  selectedKey: string | null
  search: string
  filters: Filters
}

const state: AppState = {
  tab: 'tree',
  selectedKey: null,
  search: '',
  filters: { issueTypes: [], statuses: [], components: [] },
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

export function toggleFilter(kind: keyof Filters, value: string): void {
  const list = state.filters[kind];
  const index = list.indexOf(value);
  if (index === -1) { list.push(value); }
  else { list.splice(index, 1); }
  notify();
}

export function clearFilters(): void {
  state.filters = { issueTypes: [], statuses: [], components: [] };
  notify();
}
