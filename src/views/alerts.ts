import { escapeHtml } from '../components/detail-panel.ts';
import { alertsByType, computeAlerts, meta } from '../model.ts';
import { select } from '../state.ts';

const GROUP_LABELS: Record<string, string> = {
  'orphan-story': 'Stories sin épica',
  'empty-epic': 'Épicas vacías',
  'bug-without-story': 'Bugs sin story',
  'open-block': 'Bloqueos abiertos',
};

const ORDER: string[] = ['orphan-story', 'empty-epic', 'bug-without-story', 'open-block'];

export function renderAlerts(container: HTMLElement): void {
  const alerts = computeAlerts();
  if (alerts.length === 0) {
    container.innerHTML = '<div class="empty">Sin alertas — la trazabilidad está completa.</div>';
    return;
  }
  const grouped = alertsByType(alerts);
  const sections = ORDER.map((type) => {
    const group = grouped.get(type as never) ?? [];
    if (group.length === 0) { return ''; }
    const rows = group.map(alert => `
      <button class="alert-row" data-select="${escapeHtml(alert.key)}">
        <span class="ak">${escapeHtml(alert.key)}</span>
        <span class="ad">${escapeHtml(alert.detail)}</span>
      </button>`).join('');
    return `<h3>${GROUP_LABELS[type] ?? type}<span class="count-pill">${group.length}</span></h3>${rows}`;
  }).join('');
  container.innerHTML = `
    <div class="alerts">
      <div class="summary-line">${meta.projectKey} · ${alerts.length} alertas de trazabilidad</div>
      ${sections}
    </div>`;
  container.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((button) => {
    button.addEventListener('click', () => select(button.dataset.select ?? null));
  });
}
