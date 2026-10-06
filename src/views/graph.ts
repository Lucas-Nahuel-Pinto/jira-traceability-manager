import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { escapeHtml } from '../components/detail-panel.ts';
import { edges, issues, issueTypes, nodeByKey, passesFilters, typeColorOf } from '../model.ts';
import { getState, select } from '../state.ts';

cytoscape.use(fcose);

interface Position {
  x: number
  y: number
}

let instance: cytoscape.Core | null = null;
let buildSig = '';
let building = false;
const posCache = new Map<string, Map<string, Position>>();

function filtersSignature(): string {
  const { filters } = getState();
  return JSON.stringify({
    issueTypes: [...filters.issueTypes].sort(),
    statuses: [...filters.statuses].sort(),
    components: [...filters.components].sort(),
  });
}

function updateInstance(cy: cytoscape.Core): void {
  const { filters, search, selectedKey } = getState();
  const needle = search.toLowerCase();
  cy.batch(() => {
    cy.nodes().forEach((node) => {
      const traceNode = nodeByKey.get(node.id());
      const visible = traceNode ? passesFilters(traceNode, filters) : true;
      node.toggleClass('hidden', !visible);
      const matches = !needle || !visible
        ? false
        : (traceNode?.key.toLowerCase().includes(needle)
          || (traceNode?.summary ?? '').toLowerCase().includes(needle)
          || (traceNode?.assignee ?? '').toLowerCase().includes(needle));
      node.toggleClass('dim', Boolean(needle) && !matches);
      node.toggleClass('match', matches);
      node.toggleClass('picked', traceNode?.key === selectedKey);
    });
  });
}

function legendHtml(): string {
  const present = issueTypes.map((type) => {
    const color = typeColorOf(type);
    return `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:11px;color:var(--muted);"><span class="dot" style="background:${color}"></span>${escapeHtml(type)}</span>`;
  }).join('');
  return `<div style="position:absolute;left:10px;bottom:8px;background:rgba(22,27,36,0.85);border:1px solid var(--border);border-radius:6px;padding:5px 9px;">${present}</div>`;
}

const GRAPH_STYLE: cytoscape.StylesheetJsonBlock[] = [
  {
    selector: 'node',
    style: {
      'label': 'data(key)',
      'font-size': 8,
      'color': '#dbe2ee',
      'text-outline-color': '#0f1218',
      'text-outline-width': 1,
      'width': 13,
      'height': 13,
    },
  },
  {
    selector: 'node.Epic',
    style: { 'width': 22, 'height': 22, 'font-size': 10, 'font-weight': 'bold' },
  },
  {
    selector: 'edge',
    style: {
      'width': 1,
      'line-color': '#39415a',
      'target-arrow-color': '#39415a',
      'target-arrow-shape': 'triangle',
      'opacity': 0.65,
      'curve-style': 'bezier',
    },
  },
  {
    selector: 'edge[kind = "hierarchy"]',
    style: { 'line-color': '#4f8cff', 'target-arrow-color': '#4f8cff', 'opacity': 0.8 },
  },
  { selector: '.hidden', style: { display: 'none' } },
  { selector: '.dim', style: { opacity: 0.1 } },
  { selector: '.match', style: { 'border-width': 3, 'border-color': '#f85149' } },
  { selector: '.picked', style: { 'border-width': 3, 'border-color': '#4f8cff' } },
];

function wireEvents(cy: cytoscape.Core): void {
  cy.nodes().forEach((node) => {
    const traceNode = nodeByKey.get(node.id());
    if (traceNode?.issueType === 'Epic') { node.addClass('Epic'); }
  });
  cy.on('tap', 'node', (event) => {
    select((event.target as cytoscape.NodeSingular).id());
  });
  const openInJira = (event: cytoscape.EventObject) => {
    const key = (event.target as cytoscape.NodeSingular).id();
    const traceNode = nodeByKey.get(key);
    if (traceNode) { window.open(traceNode.url, '_blank', 'noopener'); }
  };
  cy.on('dbltap', 'node', openInJira);
  cy.on('dblclick', 'node', openInJira);
}

function cachePositions(cy: cytoscape.Core, sig: string): void {
  const positions = new Map<string, Position>();
  cy.nodes().forEach((node) => {
    const pos = node.position();
    positions.set(node.id(), { x: pos.x, y: pos.y });
  });
  posCache.set(sig, positions);
}

function buildElements(cached: Map<string, Position> | undefined): cytoscape.ElementDefinition[] {
  const { filters } = getState();
  const visibleIssues = issues.filter(issue => passesFilters(issue, filters));
  const visibleKeys = new Set(visibleIssues.map(issue => issue.key));
  const elements: cytoscape.ElementDefinition[] = visibleIssues.map((issue) => {
    const position = cached?.get(issue.key);
    return {
      group: 'nodes',
      data: { id: issue.key, key: issue.key, issueType: issue.issueType },
      ...(position ? { position } : {}),
      style: { 'background-color': typeColorOf(issue.issueType) },
    };
  });
  for (const edge of edges) {
    if (!visibleKeys.has(edge.from) || !visibleKeys.has(edge.to)) { continue; }
    elements.push({
      group: 'edges',
      data: { id: `${edge.from}|${edge.to}|${edge.kind}`, source: edge.from, target: edge.to, kind: edge.kind },
    });
  }
  return elements;
}

export function renderGraph(container: HTMLElement): void {
  if (building) { return; }
  const sig = filtersSignature();
  const hasWrap = Boolean(container.querySelector('.graph-wrap'));
  if (instance && hasWrap && buildSig === sig) {
    updateInstance(instance);
    return;
  }
  if (instance) {
    instance.destroy();
    instance = null;
  }
  buildSig = '';

  container.innerHTML = `
    <div class="graph-wrap">
      <div id="cy" style="width:100%;height:100%;"></div>
      ${legendHtml()}
      <div class="graph-overlay">Calculando distribución del grafo…</div>
    </div>`;
  building = true;

  window.setTimeout(() => {
    const cyContainer = container.querySelector<HTMLElement>('#cy');
    const overlay = container.querySelector<HTMLElement>('.graph-overlay');
    if (!container.querySelector('.graph-wrap') || !cyContainer || !overlay) {
      building = false;
      return;
    }

    let finished = false;
    const done = (): void => {
      if (finished) { return; }
      finished = true;
      overlay.remove();
      building = false;
    };

    const liveSig = filtersSignature();
    const cached = posCache.get(liveSig);
    const elements = buildElements(cached);

    let cy: cytoscape.Core;
    try {
      cy = cytoscape({
        container: cyContainer,
        elements,
        style: GRAPH_STYLE,
        layout: { name: 'preset' },
        wheelSensitivity: 0.25,
        minZoom: 0.15,
        maxZoom: 3,
      });
    }
    catch (error) {
      console.error('[graph] no se pudo crear el grafo', error);
      done();
      return;
    }

    wireEvents(cy);
    instance = cy;
    buildSig = liveSig;
    updateInstance(cy);

    if (cached) {
      cy.layout({ name: 'preset', fit: true, padding: 30 }).run();
      done();
      return;
    }

    cy.one('layoutstop', () => {
      cachePositions(cy, liveSig);
      done();
    });
    window.setTimeout(done, 15_000);
    try {
      cy.layout({
        name: 'fcose',
        animate: false,
        randomize: true,
        quality: 'default',
        maxIterations: 500,
        nodeDimensionsIncludeLabels: false,
        padding: 30,
      } as unknown as cytoscape.LayoutOptions).run();
    }
    catch (error) {
      console.error('[graph] fcose falló, usando grid', error);
      try {
        cy.layout({ name: 'grid', animate: false, padding: 30 }).run();
        cachePositions(cy, liveSig);
      }
      catch { /* el grafo queda como esté */ }
      done();
    }
  }, 50);
}
