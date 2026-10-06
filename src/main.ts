import type { TabId } from './state.ts';
import { renderDetail } from './components/detail-panel.ts';
import { components, computeAlerts, issues, issueTypes, meta, statuses } from './model.ts';
import { clearFilters, getState, select, setSearch, setTab, subscribe, toggleFilter } from './state.ts';
import { injectStyles } from './styles.ts';
import { renderAlerts } from './views/alerts.ts';
import { renderGraph, resizeGraph } from './views/graph.ts';
import { renderMatrix } from './views/matrix.ts';
import { renderMetrics } from './views/metrics.ts';
import { renderTree } from './views/tree.ts';

const TABS: { id: TabId, label: string }[] = [
  { id: 'tree', label: 'Árbol' },
  { id: 'graph', label: 'Grafo' },
  { id: 'matrix', label: 'Matriz' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'metrics', label: 'Métricas' },
];

const alertCount = computeAlerts().length;

let filtersCollapsed = false;
let detailCollapsed = false;
let lastSelectedKey: string | null = null;

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
    <aside class="detail" id="detail">
      <button class="panel-toggle" id="toggle-detail" title="Colapsar panel de detalles">»</button>
      <div id="detail-body"></div>
    </aside>
  </div>
`;

const tabsEl = document.getElementById('tabs') as HTMLElement;
const filtersEl = document.getElementById('filters') as HTMLElement;
const viewEl = document.getElementById('view') as HTMLElement;
const detailEl = document.getElementById('detail') as HTMLElement;
const detailBodyEl = document.getElementById('detail-body') as HTMLElement;
const searchEl = document.getElementById('search') as HTMLInputElement;

function setDetailCollapsed(collapsed: boolean): void {
  detailCollapsed = collapsed;
  detailEl.classList.toggle('collapsed', collapsed);
  const button = document.getElementById('toggle-detail') as HTMLButtonElement;
  button.textContent = collapsed ? '«' : '»';
  button.title = collapsed ? 'Expandir panel de detalles' : 'Colapsar panel de detalles';
  resizeGraph();
}

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
  filtersEl.classList.toggle('collapsed', filtersCollapsed);
  filtersEl.innerHTML = `
    <button class="panel-toggle" id="toggle-filters" title="${filtersCollapsed ? 'Expandir filtros' : 'Colapsar filtros'}">${filtersCollapsed ? '»' : '«'}</button>
    ${filterGroup('Tipo', 'issueTypes', issueTypes, filters.issueTypes)}
    ${filterGroup('Estado', 'statuses', statuses, filters.statuses)}
    ${filterGroup('Componente', 'components', components, filters.components)}
    <button class="clear" id="clear-filters">Limpiar filtros</button>
  `;
  filtersEl.querySelectorAll<HTMLInputElement>('input[data-fk]').forEach((input) => {
    input.addEventListener('change', () => toggleFilter(input.dataset.fk as 'issueTypes', input.value));
  });
  document.getElementById('clear-filters')?.addEventListener('click', clearFilters);
  document.getElementById('toggle-filters')?.addEventListener('click', () => {
    filtersCollapsed = !filtersCollapsed;
    renderFilters();
    resizeGraph();
  });
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

function focusSelectedInTree(): void {
  const { tab, selectedKey } = getState();
  if (tab !== 'tree' || !selectedKey) { return; }
  const row = viewEl.querySelector<HTMLElement>(`[data-select="${selectedKey}"]`);
  if (!row) { return; }
  const rowRect = row.getBoundingClientRect();
  const viewRect = viewEl.getBoundingClientRect();
  const fullyVisible = rowRect.top >= viewRect.top && rowRect.bottom <= viewRect.bottom;
  if (fullyVisible) { return; }
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('flash');
  window.setTimeout(() => row.classList.remove('flash'), 1400);
}

function render(): void {
  renderTabs();
  renderFilters();
  renderView();
  const { selectedKey, search } = getState();
  if (selectedKey && selectedKey !== lastSelectedKey) { setDetailCollapsed(false); }
  lastSelectedKey = selectedKey;
  detailEl.classList.toggle('visible', Boolean(selectedKey));
  renderDetail(detailBodyEl, selectedKey, search);
  focusSelectedInTree();
}

document.getElementById('toggle-detail')?.addEventListener('click', () => setDetailCollapsed(!detailCollapsed));

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
