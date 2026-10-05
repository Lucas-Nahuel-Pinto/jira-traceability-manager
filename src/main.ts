import type { TabId } from './state.ts';
import { renderDetail } from './components/detail-panel.ts';
import { components, computeAlerts, issues, issueTypes, meta, statuses } from './model.ts';
import { clearFilters, getState, select, setSearch, setTab, subscribe, toggleFilter } from './state.ts';
import { injectStyles } from './styles.ts';
import { renderAlerts } from './views/alerts.ts';
import { renderGraph } from './views/graph.ts';
import { renderMatrix } from './views/matrix.ts';
import { renderMetrics } from './views/placeholders.ts';
import { renderTree } from './views/tree.ts';

const TABS: { id: TabId, label: string }[] = [
  { id: 'tree', label: 'Árbol' },
  { id: 'graph', label: 'Grafo' },
  { id: 'matrix', label: 'Matriz' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'metrics', label: 'Métricas' },
];

const alertCount = computeAlerts().length;

injectStyles();

const app = document.getElementById('app') as HTMLElement;
app.innerHTML = `
  <header class="topbar">
    <h1>Trazabilidad ${meta.projectKey}</h1>
    <span class="meta">generado ${meta.generatedAt.slice(0, 16).replace('T', ' ')} · ${meta.counts.nodes} nodos · ${meta.counts.edges} vínculos${meta.hasXray ? ' · Xray' : ''}</span>
    <span class="spacer"></span>
    <input id="search" class="search" type="search" placeholder="Buscar key, resumen o asignado" autocomplete="off" />
  </header>
  <nav class="tabs" id="tabs"></nav>
  <div class="workspace">
    <nav class="filters" id="filters"></nav>
    <main class="view" id="view"></main>
    <aside class="detail" id="detail"></aside>
  </div>
`;

const tabsEl = document.getElementById('tabs') as HTMLElement;
const filtersEl = document.getElementById('filters') as HTMLElement;
const viewEl = document.getElementById('view') as HTMLElement;
const detailEl = document.getElementById('detail') as HTMLElement;
const searchEl = document.getElementById('search') as HTMLInputElement;

function renderTabs(): void {
  const { tab } = getState();
  tabsEl.innerHTML = TABS.map(({ id, label }) => {
    const active = id === tab ? ' active' : '';
    const badge = id === 'alerts' && alertCount > 0 ? `<span class="badge">${alertCount}</span>` : '';
    return `<button class="tab${active}" data-tab="${id}">${label}${badge}</button>`;
  }).join('');
  tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.tab as TabId));
  });
}

function filterGroup(title: string, kind: 'issueTypes' | 'statuses' | 'components', values: string[], selected: string[]): string {
  const items = values.map((value) => {
    const checked = selected.includes(value) ? ' checked' : '';
    return `<label class="filter-item"><input type="checkbox" data-fk="${kind}" value="${value}"${checked} />${value}</label>`;
  }).join('');
  return `<h4>${title}</h4>${items}`;
}

function renderFilters(): void {
  const { filters } = getState();
  filtersEl.innerHTML = `
    ${filterGroup('Tipo', 'issueTypes', issueTypes, filters.issueTypes)}
    ${filterGroup('Estado', 'statuses', statuses, filters.statuses)}
    ${filterGroup('Componente', 'components', components, filters.components)}
    <button class="clear" id="clear-filters">Limpiar filtros</button>
  `;
  filtersEl.querySelectorAll<HTMLInputElement>('input[data-fk]').forEach((input) => {
    input.addEventListener('change', () => toggleFilter(input.dataset.fk as 'issueTypes', input.value));
  });
  document.getElementById('clear-filters')?.addEventListener('click', clearFilters);
}

function renderView(): void {
  const { tab } = getState();
  viewEl.classList.toggle('graph-mode', tab === 'graph');
  if (tab === 'tree') { renderTree(viewEl); }
  else if (tab === 'graph') { renderGraph(viewEl); }
  else if (tab === 'matrix') { renderMatrix(viewEl); }
  else if (tab === 'alerts') { renderAlerts(viewEl); }
  else { renderMetrics(viewEl); }
}

function render(): void {
  renderTabs();
  renderFilters();
  renderView();
  const { selectedKey, search } = getState();
  renderDetail(detailEl, selectedKey, search);
}

searchEl.addEventListener('input', () => setSearch(searchEl.value));
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== searchEl) {
    event.preventDefault();
    searchEl.focus();
  }
  if (event.key === 'Escape' && document.activeElement === searchEl) {
    searchEl.blur();
  }
});

subscribe(render);
render();

export function selectNode(key: string): void {
  select(key);
}

export { issues };
