import type { TraceNode } from '../../scripts/lib/trace-types.ts';
import { escapeHtml } from '../components/detail-panel.ts';
import { edges, issues, nodeByKey, passesFilters } from '../model.ts';
import { getState, select } from '../state.ts';

interface Cell {
  out: number
  in: number
  outKeys: string[]
}

interface SortState {
  column: number
  dir: 'asc' | 'desc'
}

let sortState: SortState | null = null;

function cellTotal(issue: TraceNode, kind: string, degree: Map<string, Map<string, Cell>>): number {
  const cell = degree.get(issue.key)?.get(kind);
  return cell ? cell.out + cell.in : 0;
}

function sortTh(column: number, label: string): string {
  const active = sortState?.column === column;
  const arrow = active ? (sortState?.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const cls = active ? ' class="sorted"' : '';
  return `<th${cls} data-col="${column}" title="Ordenar por ${escapeHtml(label)}">${escapeHtml(label)}${arrow}</th>`;
}

function buildCells(): { kinds: string[], degree: Map<string, Map<string, Cell>> } {
  const degree = new Map<string, Map<string, Cell>>();
  const kindSet = new Set<string>();
  for (const edge of edges) {
    kindSet.add(edge.kind);
    for (const [key, dir] of [[edge.from, 'out'], [edge.to, 'in']] as const) {
      let byKind = degree.get(key);
      if (!byKind) {
        byKind = new Map();
        degree.set(key, byKind);
      }
      let cell = byKind.get(edge.kind);
      if (!cell) {
        cell = { out: 0, in: 0, outKeys: [] };
        byKind.set(edge.kind, cell);
      }
      if (dir === 'out') {
        cell.out++;
        if (cell.outKeys.length < 12) { cell.outKeys.push(edge.to); }
      }
      else { cell.in++; }
    }
  }
  const kinds = [...kindSet].sort((a, b) => a.localeCompare(b));
  return { kinds, degree };
}

function linkCounts(node: TraceNode, degree: Map<string, Map<string, Cell>>): number {
  const byKind = degree.get(node.key);
  if (!byKind) { return 0; }
  let total = 0;
  for (const cell of byKind.values()) { total += cell.out + cell.in; }
  return total;
}

export function renderMatrix(container: HTMLElement): void {
  const { filters, search } = getState();
  const { kinds, degree } = buildCells();
  const filtered = issues.filter(issue => passesFilters(issue, filters));
  const searched = (search
    ? filtered.filter((issue) => {
        const needle = search.toLowerCase();
        return issue.key.toLowerCase().includes(needle)
          || (issue.summary ?? '').toLowerCase().includes(needle)
          || (issue.assignee ?? '').toLowerCase().includes(needle);
      })
    : filtered.filter(issue => linkCounts(issue, degree) > 0));
  const visibleIssues = [...searched].sort((a, b) => {
    const current = sortState;
    if (!current) { return linkCounts(b, degree) - linkCounts(a, degree); }
    if (current.column === 0) {
      const cmp = a.key.localeCompare(b.key);
      return current.dir === 'asc' ? cmp : -cmp;
    }
    const kind = kinds[current.column - 1] ?? '';
    const diff = cellTotal(a, kind, degree) - cellTotal(b, kind, degree);
    if (diff !== 0) { return current.dir === 'asc' ? diff : -diff; }
    return a.key.localeCompare(b.key);
  });

  const header = kinds.map((kind, index) => sortTh(index + 1, kind.replace('link:', ''))).join('');
  const body = visibleIssues.map((issue) => {
    const byKind = degree.get(issue.key);
    const cells = kinds.map((kind) => {
      const cell = byKind?.get(kind);
      if (!cell) { return '<td class="count">·</td>'; }
      const title = cell.outKeys.length > 0 ? ` title="→ ${escapeHtml(cell.outKeys.join(', '))}"` : '';
      const out = cell.out > 0 ? `<span class="dir-out">→${cell.out}</span>` : '';
      const inn = cell.in > 0 ? `<span class="dir-in"> ←${cell.in}</span>` : '';
      return `<td class="count"${title}>${out}${inn}</td>`;
    }).join('');
    return `
      <tr data-select="${escapeHtml(issue.key)}">
        <td><span class="rowkey">${escapeHtml(issue.key)}</span> <span class="rowsummary">${escapeHtml(issue.summary ?? '')}</span></td>
        ${cells}
      </tr>`;
  }).join('');

  const blocks = edges.filter(edge => edge.kind === 'link:blocks' || edge.kind === 'link:blocking');
  const blockRows = blocks.map((edge) => {
    const from = nodeByKey.get(edge.from);
    const to = nodeByKey.get(edge.to);
    const toStatus = to ? `<span class="chip ${to.statusCategory === 'done' ? 'done' : 'todo'}">${escapeHtml(to.status ?? '')}</span>` : '';
    return `
      <tr data-select="${escapeHtml(edge.to)}">
        <td><span class="rowkey">${escapeHtml(edge.from)}</span> ${escapeHtml(from?.summary ?? '')}</td>
        <td>→ bloquea</td>
        <td><span class="rowkey">${escapeHtml(edge.to)}</span> ${escapeHtml(to?.summary ?? '')} ${toStatus}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="summary-line">${visibleIssues.length} issues con vínculos · ${kinds.length} tipos de vínculo · celda = ${'→'} salientes / ${'←'} entrantes (hover = claves) · click en cabecera = ordenar</div>
    <div class="matrix-wrap">
      <table class="matrix">
        <thead><tr>${sortTh(0, 'Issue')}${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${blocks.length > 0
      ? `
      <h3 style="margin:18px 0 8px;font-size:13px;">Quién bloquea a quién<span class="count-pill">${blocks.length}</span></h3>
      <div class="matrix-wrap" style="max-height:280px;">
        <table class="matrix"><thead><tr><th>Bloqueante</th><th></th><th>Bloqueado</th></tr></thead><tbody>${blockRows}</tbody></table>
      </div>`
      : ''}
  `;
  container.querySelectorAll<HTMLTableRowElement>('tr[data-select]').forEach((row) => {
    row.addEventListener('click', () => select(row.dataset.select ?? null));
  });
  container.querySelectorAll<HTMLTableCellElement>('th[data-col]').forEach((th) => {
    th.addEventListener('click', () => {
      const column = Number(th.dataset.col);
      if (sortState && sortState.column === column) {
        sortState = { column, dir: sortState.dir === 'asc' ? 'desc' : 'asc' };
      }
      else {
        sortState = { column, dir: 'asc' };
      }
      renderMatrix(container);
    });
  });
}
