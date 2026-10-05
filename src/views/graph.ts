import cytoscape from 'cytoscape';
import { escapeHtml } from '../components/detail-panel.ts';
import { edges, issues, issueTypes, nodeByKey, passesFilters } from '../model.ts';
import { getState, select } from '../state.ts';

const TYPE_COLORS: Record<string, string> = {
  'Epic': '#d29922',
  'Story': '#4f8cff',
  'Bug': '#f85149',
  'Task': '#8b94a7',
  'Test': '#3fb950',
  'Test Plan': '#a371f7',
  'Test Execution': '#a371f7',
  'Test Set': '#a371f7',
  'Test Run': '#a371f7',
  'Precondition': '#a371f7',
  'Improvement': '#2ea8ff',
  'Defect': '#ff7b72',
  'Tech Story': '#6e7681',
  'Tech Debt': '#6e7681',
};

function colorFor(issueType: string | undefined): string {
  return TYPE_COLORS[issueType ?? ''] ?? '#6e7681';
}

let instance: cytoscape.Core | null = null;
let buildSig = '';

function currentState(): { filtersSig: string, search: string } {
  const { filters } = getState();
  return {
    filtersSig: JSON.stringify(filters),
    search: getState().search,
  };
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
    const color = colorFor(type);
    return `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:11px;color:var(--muted);"><span class="dot" style="background:${color}"></span>${escapeHtml(type)}</span>`;
  }).join('');
  return `<div style="position:absolute;left:10px;bottom:8px;background:rgba(22,27,36,0.85);border:1px solid var(--border);border-radius:6px;padding:5px 9px;">${present}</div>`;
}

export function renderGraph(container: HTMLElement): void {
  const { filtersSig } = currentState();
  const hasWrap = Boolean(container.querySelector('.graph-wrap'));
  const sig = filtersSig;

  if (instance && hasWrap && buildSig === sig) {
    updateInstance(instance);
    return;
  }
  if (instance) {
    instance.destroy();
    instance = null;
  }

  container.innerHTML = `<div class="graph-wrap"><div id="cy" style="width:100%;height:100%;"></div>${legendHtml()}</div>`;
  const { filters } = getState();
  const visibleIssues = issues.filter(issue => passesFilters(issue, filters));
  const visibleKeys = new Set(visibleIssues.map(issue => issue.key));

  const elements: cytoscape.ElementDefinition[] = visibleIssues.map(issue => ({
    group: 'nodes',
    data: { id: issue.key, key: issue.key, issueType: issue.issueType },
    style: { 'background-color': colorFor(issue.issueType) },
  }));
  for (const edge of edges) {
    if (!visibleKeys.has(edge.from) || !visibleKeys.has(edge.to)) { continue; }
    elements.push({
      group: 'edges',
      data: { id: `${edge.from}|${edge.to}|${edge.kind}`, source: edge.from, target: edge.to, kind: edge.kind },
    });
  }

  instance = cytoscape({
    container: container.querySelector('#cy') as HTMLElement,
    elements,
    style: [
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
    ],
    layout: { name: 'cose', animate: false, padding: 30, nodeRepulsion: 4200, idealEdgeLength: 90 },
    wheelSensitivity: 0.25,
    minZoom: 0.15,
    maxZoom: 3,
  });

  instance.nodes().forEach((node) => {
    const traceNode = nodeByKey.get(node.id());
    if (traceNode?.issueType === 'Epic') { node.addClass('Epic'); }
  });

  instance.on('tap', 'node', (event) => {
    select((event.target as cytoscape.NodeSingular).id());
  });
  const openInJira = (event: cytoscape.EventObject) => {
    const key = (event.target as cytoscape.NodeSingular).id();
    const traceNode = nodeByKey.get(key);
    if (traceNode) { window.open(traceNode.url, '_blank', 'noopener'); }
  };
  instance.on('dbltap', 'node', openInJira);
  instance.on('dblclick', 'node', openInJira);

  buildSig = filtersSig;
  updateInstance(instance);
}
