import type { TraceNode } from '../../scripts/lib/trace-types.ts';
import { escapeHtml } from '../components/detail-panel.ts';
import { alertsByType, computeAlerts, issues, matchesSearch, parentsOf, passesFilters } from '../model.ts';
import { getState, select } from '../state.ts';

const nodeAlerts = alertsByType(computeAlerts());
const alerted = new Map<string, number>();
for (const group of nodeAlerts.values()) {
  for (const alert of group) {
    alerted.set(alert.key, (alerted.get(alert.key) ?? 0) + 1);
  }
}

function issueParent(node: TraceNode): TraceNode | undefined {
  return parentsOf(node.key).find(parent => parent.kind === 'issue');
}

function buildVisibleSet(query: string): Set<string> {
  const visible = new Set<string>();
  for (const issue of issues) {
    if (!matchesSearch(issue, query)) { continue; }
    let current: TraceNode | undefined = issue;
    while (current) {
      visible.add(current.key);
      current = issueParent(current);
    }
  }
  return visible;
}

function renderNode(node: TraceNode, visible: Set<string>, query: string): string {
  const children = issues.filter(child => issueParent(child)?.key === node.key
    && visible.has(child.key)
    && passesFilters(child, getState().filters));
  const selfVisible = passesFilters(node, getState().filters) && (!query || visible.has(node.key));
  if (!selfVisible && children.length === 0) { return ''; }
  const childHtml = children.map(child => renderNode(child, visible, query)).join('');
  const selected = getState().selectedKey === node.key ? ' selected' : '';
  const alertBadge = alerted.has(node.key) ? `<span class="alert-mark" title="${alerted.get(node.key)} alertas">!</span>` : '';
  const category = node.statusCategory === 'done' ? 'done' : node.statusCategory === 'indeterminate' ? 'indeterminate' : 'todo';
  return `
    <li>
      <button class="node-row${selected}" data-select="${escapeHtml(node.key)}" data-url="${escapeHtml(node.url)}">
        <span class="dot ${category}"></span>
        <span class="nk">${escapeHtml(node.key)}</span>
        <span class="ntype">${escapeHtml(node.issueType ?? '')}</span>
        <span class="ns">${escapeHtml(node.summary ?? '')}</span>
        ${alertBadge}
        <span class="chip ${category}">${escapeHtml(node.status ?? '')}</span>
      </button>
      ${childHtml ? `<ul>${childHtml}</ul>` : ''}
    </li>`;
}

export function renderTree(container: HTMLElement): void {
  const { search } = getState();
  const visible = buildVisibleSet(search);
  const roots = issues.filter(issue => !issueParent(issue)
    && passesFilters(issue, getState().filters)
    && (!search || visible.has(issue.key)));
  const rows = roots.map(root => renderNode(root, visible, search)).join('');
  container.innerHTML = `
    <div class="tree">
      ${rows ? `<ul>${rows}</ul>` : '<div class="empty">Ningún issue coincide con la búsqueda o los filtros</div>'}
    </div>`;
  container.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((button) => {
    button.addEventListener('click', () => select(button.dataset.select ?? null));
    button.addEventListener('dblclick', () => window.open(button.dataset.url, '_blank', 'noopener'));
  });
}
