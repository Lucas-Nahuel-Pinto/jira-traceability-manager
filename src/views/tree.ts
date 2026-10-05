import type { TraceNode } from '../../scripts/lib/trace-types.ts';
import { escapeHtml, statusChip } from '../components/detail-panel.ts';
import { issues, matchesSearch, parentsOf } from '../model.ts';
import { getState, select } from '../state.ts';

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
  const children = issues.filter(child => issueParent(child)?.key === node.key && visible.has(child.key));
  const selfVisible = !query || visible.has(node.key);
  if (!selfVisible && children.length === 0) { return ''; }
  const childHtml = children.map(child => renderNode(child, visible, query)).join('');
  const selected = getState().selectedKey === node.key ? ' selected' : '';
  return `
    <li>
      <button class="node-row${selected}" data-select="${escapeHtml(node.key)}">
        <span class="nk">${escapeHtml(node.key)}</span>
        <span class="ntype">${escapeHtml(node.issueType ?? '')}</span>
        <span class="ns">${escapeHtml(node.summary ?? '')}</span>
        ${statusChip(node)}
      </button>
      ${childHtml ? `<ul>${childHtml}</ul>` : ''}
    </li>`;
}

export function renderTree(container: HTMLElement): void {
  const { search } = getState();
  const visible = buildVisibleSet(search);
  const roots = issues.filter(issue => !issueParent(issue) && (!search || visible.has(issue.key)));
  const rows = roots.map(root => renderNode(root, visible, search)).join('');
  container.innerHTML = `
    <div class="tree">
      ${rows ? `<ul>${rows}</ul>` : '<div class="empty">Ningún issue coincide con la búsqueda</div>'}
    </div>`;
  container.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((button) => {
    button.addEventListener('click', () => select(button.dataset.select ?? null));
  });
}
