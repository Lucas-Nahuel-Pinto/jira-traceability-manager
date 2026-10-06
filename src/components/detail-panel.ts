import type { TraceNode } from '../../scripts/lib/trace-types.ts';
import { childrenOf, edges, isDone, matchesSearch, nodeByKey, nodeColor, parentsOf } from '../model.ts';
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

function linkButton(node: TraceNode, arrow: string): string {
  const color = nodeColor(node);
  const summary = node.summary
    ? `<span class="ls" title="${escapeHtml(node.summary)}">${escapeHtml(node.summary)}</span>`
    : '';
  return `
    <button class="link-item" data-select="${escapeHtml(node.key)}">
      <span class="la">${arrow}</span>
      <span class="dot" style="background:${color}"></span>
      <span class="lk">${escapeHtml(node.key)}</span>
      ${summary}
    </button>`;
}

const VERBS: Record<string, { out: string, in: string }> = {
  'link:blocks': { out: 'bloquea', in: 'bloqueado por' },
  'link:blocking': { out: 'bloquea', in: 'bloqueado por' },
  'link:relates': { out: 'relacionado', in: 'relacionado' },
  'link:duplicate': { out: 'duplica', in: 'duplicado por' },
  'link:cloners': { out: 'clona', in: 'clonado por' },
  'link:test': { out: 'prueba', in: 'probado por' },
  'link:test-execute': { out: 'ejecuta', in: 'ejecutado por' },
  'link:test-design': { out: 'diseña', in: 'diseñado por' },
  'link:defect': { out: 'defecto en', in: 'defecto de' },
  'link:problem/incident': { out: 'problema/incidente', in: 'afectado por' },
  'link:dependencies': { out: 'depende de', in: 'es dependencia para' },
};

function relationLabel(kind: string, outward: boolean): string {
  if (kind === 'component') { return 'componente'; }
  if (kind === 'sprint') { return 'sprint'; }
  const verb = VERBS[kind];
  if (verb) { return outward ? verb.out : verb.in; }
  return kind.replace(/^link:/, '');
}

function groupSection(label: string, items: { node: TraceNode, arrow: string }[]): string {
  return `<h3>${escapeHtml(label)}<span class="count-pill">${items.length}</span></h3>${
    items.map(item => linkButton(item.node, item.arrow)).join('')}`;
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

  let linksHtml = '';
  if (parents.length > 0) {
    linksHtml += groupSection('padres', parents.map(node => ({ node, arrow: '' })));
  }
  if (children.length > 0) {
    linksHtml += groupSection('hijos', children.map(node => ({ node, arrow: '' })));
  }

  const groups = new Map<string, { node: TraceNode, arrow: string }[]>();
  for (const edge of edges) {
    if (edge.kind === 'hierarchy') { continue; }
    if (edge.from !== selectedKey && edge.to !== selectedKey) { continue; }
    const outward = edge.from === selectedKey;
    const other = nodeByKey.get(outward ? edge.to : edge.from);
    if (!other) { continue; }
    const label = relationLabel(edge.kind, outward);
    const bucket = groups.get(label) ?? [];
    bucket.push({ node: other, arrow: outward ? '→' : '←' });
    groups.set(label, bucket);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [label, items] of sortedGroups) {
    linksHtml += groupSection(label, items);
  }

  const searchable = matchesSearch(node, search);
  container.classList.add('visible');
  container.innerHTML = `
    <div class="key">${escapeHtml(node.key)}</div>
    <h2>${escapeHtml(node.summary ?? '')}</h2>
    <a class="jira-link" href="${escapeHtml(node.url)}" target="_blank" rel="noopener">Abrir en Jira →</a>
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
