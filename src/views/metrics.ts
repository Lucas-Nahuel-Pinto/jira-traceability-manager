import type { TraceEdge, TraceNode } from '../../scripts/lib/trace-types.ts';
import type { MetricsFilter } from '../metrics.ts';
import { escapeHtml } from '../components/detail-panel.ts';
import {
  bugAging,
  epicProgress,
  filterEdges,
  filterIssues,
  kpis,
  linkKindCounts,
  parentMap,
  pointsByEpic,
  statusDistribution,
  throughput,
  topCentral,
  workload,
  xrayExecutionStatuses,
} from '../metrics.ts';
import { edges as allEdges, issues as allIssues, computeAlerts, meta, passesFilters } from '../model.ts';
import { getState, select } from '../state.ts';

let filter: MetricsFilter = {};
let visibleIssues: TraceNode[] = [];
let visibleEdges: TraceEdge[] = [];

function palette(index: number, total: number): string {
  const hue = Math.round((index * 360) / Math.max(total, 1));
  return `hsl(${hue} 62% 55%)`;
}

function barChart(slices: { label: string, count: number, url?: string, select?: string }[], color: string | ((i: number) => string)): string {
  const max = Math.max(...slices.map(slice => slice.count), 1);
  const rows = slices.map((slice, index) => {
    const width = Math.round((slice.count / max) * 100);
    const bg = typeof color === 'function' ? color(index) : color;
    let label = escapeHtml(slice.label);
    if (slice.select) {
      label = `<span class="metric-select" data-select="${escapeHtml(slice.select)}">${label}</span>`;
    }
    else if (slice.url) {
      label = `<a class="metric-link" href="${escapeHtml(slice.url)}" target="_blank" rel="noopener">${label}</a>`;
    }
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12px;">
        <span style="width:150px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);" title="${escapeHtml(slice.label)}">${label}</span>
        <span style="flex:1;background:var(--panel-2);border-radius:4px;height:14px;position:relative;">
          <span style="position:absolute;left:0;top:0;bottom:0;width:${width}%;background:${bg};border-radius:4px;"></span>
        </span>
        <span style="width:44px;text-align:right;font-family:var(--mono);">${slice.count}</span>
      </div>`;
  }).join('');
  return rows || '<div class="empty">Sin datos</div>';
}

function donut(slices: { label: string, count: number, url?: string }[]): string {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) { return '<div class="empty">Sin datos</div>'; }
  let cursor = 0;
  const stops = slices.map((slice, index) => {
    const start = (cursor / total) * 360;
    cursor += slice.count;
    const end = (cursor / total) * 360;
    return `${palette(index, slices.length)} ${start}deg ${end}deg`;
  }).join(', ');
  const legend = slices.map((slice, index) => {
    const label = slice.url
      ? `<a class="metric-link" href="${escapeHtml(slice.url)}" target="_blank" rel="noopener">${escapeHtml(slice.label)}</a>`
      : escapeHtml(slice.label);
    return `
    <div style="display:flex;gap:6px;align-items:center;font-size:12px;margin-bottom:3px;">
      <span class="dot" style="background:${palette(index, slices.length)}"></span>
      <span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</span>
      <span style="margin-left:auto;font-family:var(--mono);">${slice.count}</span>
    </div>`;
  }).join('');
  return `
    <div style="display:flex;gap:16px;align-items:center;">
      <div style="width:120px;height:120px;flex:none;border-radius:50%;background:conic-gradient(${stops});"></div>
      <div style="flex:1;min-width:0;max-height:170px;overflow:auto;">${legend}</div>
    </div>`;
}

function stackedEpics(statusColors: Map<string, string>): string {
  const progress = epicProgress(visibleIssues, parentMap(visibleEdges));
  if (progress.length === 0) { return '<div class="empty">Sin datos</div>'; }
  const rows = progress.slice(0, 12).map((entry) => {
    const segments = entry.byStatus.map((slice) => {
      const width = (slice.count / entry.total) * 100;
      const color = statusColors.get(slice.label) ?? '#6e7681';
      return `<span title="${escapeHtml(slice.label)}: ${slice.count}" style="width:${width}%;background:${color};"></span>`;
    }).join('');
    const pct = Math.round((entry.done / entry.total) * 100);
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
        <span class="metric-select" data-select="${escapeHtml(entry.epic)}" style="width:110px;flex:none;font-family:var(--mono);">${escapeHtml(entry.epic)}</span>
        <span style="flex:1;display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--panel-2);">${segments}</span>
        <span style="width:74px;text-align:right;color:var(--muted);">${entry.done}/${entry.total} (${pct}%)</span>
      </div>`;
  }).join('');
  return rows;
}

function throughputChart(): string {
  const buckets = throughput(visibleIssues, new Date(), 6);
  const max = Math.max(...buckets.map(b => Math.max(b.created, b.closed)), 1);
  const width = 320;
  const height = 110;
  const x = (i: number) => (buckets.length === 1 ? width / 2 : (i / (buckets.length - 1)) * (width - 20) + 10);
  const y = (v: number) => height - 14 - (v / max) * (height - 30);
  const createdLine = buckets.map((b, i) => `${x(i)},${y(b.created)}`).join(' ');
  const closedLine = buckets.map((b, i) => `${x(i)},${y(b.closed)}`).join(' ');
  const labels = buckets.map((b, i) => `<text x="${x(i)}" y="${height - 2}" font-size="8" fill="#8b94a7" text-anchor="middle">${b.week.slice(5)}</text>`).join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:130px;">
      <polyline points="${createdLine}" fill="none" stroke="#4f8cff" stroke-width="2" />
      <polyline points="${closedLine}" fill="none" stroke="#3fb950" stroke-width="2" stroke-dasharray="4 3" />
      ${labels}
    </svg>
    <div style="font-size:11px;color:var(--muted);display:flex;gap:14px;">
      <span><span class="dot" style="background:#4f8cff;display:inline-block;"></span> creados</span>
      <span><span class="dot" style="background:#3fb950;display:inline-block;"></span> cerrados</span>
    </div>`;
}

function centralTable(): string {
  const rows = topCentral(visibleEdges, 10).map((entry, index) => `
    <tr data-select="${escapeHtml(entry.key)}">
      <td class="count">${index + 1}</td>
      <td><span class="rowkey">${escapeHtml(entry.key)}</span></td>
      <td class="count">${entry.degree}</td>
    </tr>`).join('');
  return `
    <table class="matrix" style="width:100%;">
      <thead><tr><th>#</th><th>Issue</th><th>Vínculos</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function kpiCard(label: string, value: string, sub?: string): string {
  return `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 12px;min-width:130px;">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;">${label}</div>
      <div style="font-size:22px;font-weight:600;margin-top:2px;">${value}</div>
      ${sub ? `<div style="font-size:11px;color:var(--muted);">${sub}</div>` : ''}
    </div>`;
}

function widget(title: string, body: string): string {
  return `
    <section style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">
      <h3 style="margin:0 0 10px;font-size:13px;font-weight:600;">${title}</h3>
      ${body}
    </section>`;
}

function jiraJqlUrl(jql: string): string {
  const base = allIssues[0]?.url.replace(/\/browse\/[^/]+$/, '');
  if (!base) { return ''; }
  return `${base}/issues/?jql=${encodeURIComponent(jql)}`;
}

function recompute(): void {
  const { filters } = getState();
  visibleIssues = filterIssues(allIssues, allEdges, filter).filter(issue => passesFilters(issue, filters));
  const keys = new Set(visibleIssues.map(issue => issue.key));
  visibleEdges = filterEdges(allEdges, keys);
}

export function renderMetrics(container: HTMLElement): void {
  recompute();
  const k = kpis(visibleIssues, visibleEdges);
  const alertTotal = computeAlerts().length;
  const statusSlices = statusDistribution(visibleIssues);
  const statusColors = new Map(statusSlices.map((slice, index) => [slice.label, palette(index, statusSlices.length)]));
  const statusSlicesLinked = statusSlices.map(slice => ({
    ...slice,
    url: slice.label === 'sin estado'
      ? undefined
      : jiraJqlUrl(`project = ${meta.projectKey} AND status = "${slice.label}"`),
  }));
  const urlByKey = new Map(allIssues.map(issue => [issue.key, issue.url]));
  const epics = allIssues
    .filter(issue => issue.issueType === 'Epic')
    .sort((a, b) => a.key.localeCompare(b.key));
  const epicOptions = epics.map(epic =>
    `<option value="${escapeHtml(epic.key)}"${filter.epicKey === epic.key ? ' selected' : ''}>${escapeHtml(epic.key)} — ${escapeHtml((epic.summary ?? '').slice(0, 60))}</option>`,
  ).join('');

  container.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
      <span style="font-size:12px;color:var(--muted);">Filtro de métricas:</span>
      <input type="date" id="m-from" value="${filter.from ?? ''}" style="background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px;" />
      <span style="color:var(--muted);">→</span>
      <input type="date" id="m-to" value="${filter.to ?? ''}" style="background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px;" />
      <select id="m-epic" style="background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px;max-width:320px;">
        <option value="">Todas las épicas</option>
        ${epicOptions}
      </select>
      <button id="m-clear" style="background:var(--panel-2);border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;">Limpiar</button>
      <span style="margin-left:auto;font-size:11px;color:var(--muted);">${visibleIssues.length} issues en alcance</span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
      ${kpiCard('Issues', String(k.total))}
      ${kpiCard('Abiertos / cerrados', `${k.open} / ${k.closed}`)}
      ${kpiCard('Bugs abiertos', String(k.bugsOpen), `${k.bugsOpen30d} con >30 días`)}
      ${kpiCard('Story points', String(k.points))}
      ${kpiCard('Vínculos', String(k.links))}
      ${kpiCard('Alertas', String(alertTotal))}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;">
      ${widget('¿En qué estado está el trabajo?', donut(statusSlicesLinked))}
      ${widget('¿Cómo va cada épica?', stackedEpics(statusColors))}
      ${widget('¿Cuánto creamos y cuánto cerramos por semana?', throughputChart())}
      ${widget('¿Dónde se concentran los story points?', barChart(pointsByEpic(visibleIssues, parentMap(visibleEdges)).map(slice => ({ ...slice, select: urlByKey.has(slice.label) ? slice.label : undefined })), '#a371f7'))}
      ${widget('¿Quién tiene más carga?', barChart(workload(visibleIssues).map(slice => ({
        ...slice,
        url: jiraJqlUrl(slice.label === 'sin asignar'
          ? `project = ${meta.projectKey} AND assignee is EMPTY`
          : `project = ${meta.projectKey} AND assignee = "${slice.label}"`),
      })), '#d29922'))}
      ${widget('¿Qué tipos de vínculos predominan?', barChart(linkKindCounts(visibleEdges), i => palette(i, 9)))}
      ${widget('¿Cuáles son los issues más centrales?', centralTable())}
      ${widget('¿Cuánto tiempo llevan abiertos los bugs?', barChart(bugAging(visibleIssues, Date.now()).filter(entry => entry.count > 0).map(entry => ({ label: entry.bucket, count: entry.count })), i => ['#3fb950', '#d29922', '#f85149', '#6e7681'][i] ?? '#6e7681'))}
      ${meta.hasXray ? widget('¿Cómo van los tests?', barChart(xrayExecutionStatuses(visibleIssues), '#3fb950')) : ''}
    </div>
  `;

  document.getElementById('m-from')?.addEventListener('change', (event) => {
    filter = { ...filter, from: (event.target as HTMLInputElement).value || undefined };
    renderMetrics(container);
  });
  document.getElementById('m-to')?.addEventListener('change', (event) => {
    filter = { ...filter, to: (event.target as HTMLInputElement).value || undefined };
    renderMetrics(container);
  });
  document.getElementById('m-epic')?.addEventListener('change', (event) => {
    filter = { ...filter, epicKey: (event.target as HTMLSelectElement).value || undefined };
    renderMetrics(container);
  });
  document.getElementById('m-clear')?.addEventListener('click', () => {
    filter = {};
    renderMetrics(container);
  });
  container.querySelectorAll<HTMLElement>('[data-select]').forEach((row) => {
    row.addEventListener('click', () => select(row.dataset.select ?? null));
  });
}
