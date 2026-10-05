import type { TraceNode } from '../../scripts/lib/trace-types.ts';
import { childrenOf, edges, isDone, matchesSearch, nodeByKey, parentsOf } from '../model.ts';
import { select } from '../state.ts';

export function statusChip(node: TraceNode): string {
  const cls = node.statusCategory === 'done' ? 'done' : node.statusCategory === 'indeterminate' ? 'indeterminate' : 'todo';
  return `<span class="chip ${cls}">${escapeHtml(node.status ?? '')}</span>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function linkButton(node: TraceNode, label: string): string {
  return `<button class="link-item" data-select="${escapeHtml(node.key)}">${escapeHtml(label)} <span class="lk">${escapeHtml(node.key)}</span></button>`;
}

export function renderDetail(container: HTMLElement, selectedKey: string | null, search: string): void {
  if (!selectedKey) {
    container.classList.remove('visible');
    container.innerHTML = '';
    return;
  }
  const node = nodeByKey.get(selectedKey);
  if (!node) {
    container.classList.remove('visible');
    container.innerHTML = '';
    return;
  }

  const parents = parentsOf(selectedKey);
  const children = childrenOf(selectedKey);
  const related = edges.filter(edge => edge.from === selectedKey || edge.to === selectedKey);

  let linksHtml = '';
  if (parents.length > 0) {
    linksHtml += '<h3>Jerarquía</h3>';
    linksHtml += parents.map(parent => linkButton(parent, 'padre de ')).join('');
  }
  if (children.length > 0 && parents.length === 0) {
    linksHtml += '<h3>Jerarquía</h3>';
  }
  if (children.length > 0) {
    linksHtml += children.map(child => linkButton(child, 'hijo ')).join('');
  }

  const others = related.filter(edge => !parents.some(p => p.key === edge.from && edge.to === selectedKey && edge.kind === 'hierarchy'));
  if (others.length > 0) {
    linksHtml += '<h3>Vínculos</h3>';
    for (const edge of others) {
      const outward = edge.from === selectedKey;
      const other = nodeByKey.get(outward ? edge.to : edge.from);
      if (!other) { continue; }
      if (edge.kind === 'hierarchy') { continue; }
      if (edge.kind === 'component' || edge.kind === 'sprint') {
        linksHtml += linkButton(other, `${edge.kind}: `);
        continue;
      }
      const arrow = outward ? '→' : '←';
      linksHtml += linkButton(other, `${arrow} ${edge.kind.replace('link:', '')} `);
    }
  }

  const searchable = matchesSearch(node, search);
  container.classList.add('visible');
  container.innerHTML = `
    <div class="key">${escapeHtml(node.key)}</div>
    <h2>${escapeHtml(node.summary ?? '')}</h2>
    <div class="row"><span class="label">Tipo</span><span>${escapeHtml(node.issueType ?? node.kind)}</span></div>
    <div class="row"><span class="label">Estado</span><span>${statusChip(node)}</span></div>
    <div class="row"><span class="label">Asignado</span><span>${escapeHtml(node.assignee ?? 'sin asignar')}</span></div>
    <div class="row"><span class="label">Componentes</span><span>${escapeHtml((node.components ?? []).join(', ') || '—')}</span></div>
    <div class="row"><span class="label">Sprint</span><span>${escapeHtml(node.sprint ?? '—')}</span></div>
    <div class="row"><span class="label">Puntos</span><span>${node.points ?? '—'}</span></div>
    <div class="row"><span class="label">Creado</span><span>${escapeHtml(node.createdAt ?? '—')}</span></div>
    <div class="row"><span class="label">Resuelto</span><span>${escapeHtml(node.resolutionDate ?? '—')}</span></div>
    ${searchable ? '' : '<div class="row"><span class="label">Nota</span><span>no coincide con la búsqueda actual</span></div>'}
    <div class="links">${linksHtml || '<div class="empty">Sin vínculos</div>'}</div>
  `;
  container.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((button) => {
    button.addEventListener('click', () => select(button.dataset.select ?? null));
  });
}

export function isDoneNode(node: TraceNode): boolean {
  return isDone(node);
}
