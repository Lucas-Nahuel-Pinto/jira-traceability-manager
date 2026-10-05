import type { TabId } from './state.ts';
import { renderDetail } from './components/detail-panel.ts';
import { computeAlerts, meta } from './model.ts';
import { getState, select, setSearch, setTab, subscribe } from './state.ts';
import { injectStyles } from './styles.ts';
import { renderAlerts, renderGraph, renderMatrix, renderMetrics } from './views/placeholders.ts';
import { renderTree } from './views/tree.ts';

const TABS: { id: TabId, label: string }[] = [
  { id: 'tree', label: 'Árbol' },
  { id: 'graph', label: 'Grafo' },
  { id: 'matrix', label: 'Matriz' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'metrics', label: 'Métricas' },
];

const alertCount = computeAlerts().length;

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
    <main class="view" id="view"></main>
    <aside class="detail" id="detail"></aside>
  </div>
`;

const tabsEl = document.getElementById('tabs') as HTMLElement;
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

function renderView(): void {
  const { tab } = getState();
  if (tab === 'tree') { renderTree(viewEl); }
  else if (tab === 'graph') { renderGraph(viewEl); }
  else if (tab === 'matrix') { renderMatrix(viewEl); }
  else if (tab === 'alerts') { renderAlerts(viewEl); }
  else { renderMetrics(viewEl); }
}

function render(): void {
  renderTabs();
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

injectStyles();
