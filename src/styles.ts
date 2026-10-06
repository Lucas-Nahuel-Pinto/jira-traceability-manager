export const styles = `
:root {
  --bg: #0f1218;
  --panel: #161b24;
  --panel-2: #1c2230;
  --border: #2a3243;
  --text: #dbe2ee;
  --muted: #8b94a7;
  --accent: #4f8cff;
  --green: #3fb950;
  --red: #f85149;
  --amber: #d29922;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font: 14px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif;
}
#app { display: flex; flex-direction: column; height: 100vh; }
.topbar {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--border);
}
.topbar h1 { font-size: 15px; margin: 0; font-weight: 600; }
.topbar .meta { color: var(--muted); font-size: 12px; }
.topbar .spacer { flex: 1; }
.search {
  background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
  border-radius: 6px; padding: 6px 10px; width: 260px; outline: none;
}
.search:focus { border-color: var(--accent); }
.search-hint { color: var(--muted); font-size: 11px; margin-left: -10px; }
.tabs { display: flex; gap: 4px; padding: 8px 16px 0; background: var(--panel); border-bottom: 1px solid var(--border); }
.tab {
  background: transparent; border: 1px solid transparent; border-bottom: none;
  color: var(--muted); padding: 7px 14px; border-radius: 7px 7px 0 0; cursor: pointer; font-size: 13px;
}
.tab:hover { color: var(--text); }
.tab.active { background: var(--bg); border-color: var(--border); color: var(--text); }
.badge {
  display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 6px;
  background: var(--red); color: #fff; border-radius: 9px; font-size: 11px; text-align: center; font-weight: 600;
}
.workspace { display: flex; flex: 1; min-height: 0; }
.view { flex: 1; overflow: auto; padding: 14px 16px; }
.detail {
  width: 340px; border-left: 1px solid var(--border); background: var(--panel);
  overflow: auto; padding: 14px 16px; display: none;
}
.detail.visible { display: block; }
.detail h2 { font-size: 15px; margin: 0 0 2px; }
.detail .key { font-family: var(--mono); color: var(--accent); font-size: 13px; }
.detail .row { display: flex; gap: 8px; margin-top: 8px; font-size: 13px; }
.detail .row .label { color: var(--muted); width: 92px; flex: none; }
.detail .links { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 10px; }
.detail .links h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 8px 0 6px; }
.link-item {
  display: flex; align-items: center; gap: 6px; width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--border); color: var(--text); border-radius: 6px;
  padding: 5px 8px; margin-bottom: 5px; font-size: 12px; cursor: pointer;
  text-align: left;
}
.link-item:hover { border-color: var(--accent); }
.link-item .la { color: var(--muted); flex: none; width: 14px; text-align: center; font-family: var(--mono); }
.link-item .lk { font-family: var(--mono); color: var(--accent); flex: none; }
.link-item .ls {
  color: var(--muted); overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; min-width: 0;
}
.chip {
  display: inline-block; padding: 1px 8px; border-radius: 10px;
  font-size: 11px; background: var(--panel-2); border: 1px solid var(--border); color: var(--muted);
}
.chip.done { color: var(--green); border-color: rgba(63,185,80,0.4); }
.chip.indeterminate { color: var(--amber); border-color: rgba(210,153,34,0.4); }
.chip.todo { color: var(--muted); }
.tree ul { list-style: none; margin: 0; padding-left: 18px; }
.tree > ul { padding-left: 0; }
.tree li { margin: 1px 0; }
.node-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  background: transparent; border: 1px solid transparent; color: var(--text);
  padding: 4px 8px; border-radius: 6px; cursor: pointer; text-align: left; font-size: 13px;
}
.node-row:hover { background: var(--panel-2); }
.node-row.selected { background: rgba(79,140,255,0.15); border-color: rgba(79,140,255,0.45); }
.node-row .nk { font-family: var(--mono); color: var(--accent); flex: none; }
.node-row .ns { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-row .ntype { color: var(--muted); font-size: 11px; flex: none; }
.placeholder { color: var(--muted); padding: 40px; text-align: center; }
.empty { color: var(--muted); padding: 14px; font-style: italic; }
.filters {
  width: 210px; flex: none; border-right: 1px solid var(--border);
  background: var(--panel); overflow: auto; padding: 12px 14px;
}
.filters h4 {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted); margin: 14px 0 6px;
}
.filters h4:first-of-type { margin-top: 0; }
.filter-item {
  display: flex; gap: 6px; align-items: center; font-size: 12px;
  padding: 2px 0; cursor: pointer; color: var(--text);
}
.filter-item input { accent-color: var(--accent); }
.filters .clear {
  width: 100%; margin-top: 14px; background: var(--panel-2); border: 1px solid var(--border);
  color: var(--muted); border-radius: 6px; padding: 5px; cursor: pointer; font-size: 12px;
}
.filters .clear:hover { color: var(--text); border-color: var(--accent); }
.panel-toggle {
  display: block; width: 100%; margin-bottom: 8px;
  background: var(--panel-2); border: 1px solid var(--border); color: var(--muted);
  border-radius: 6px; padding: 3px 6px; cursor: pointer; font-size: 12px; line-height: 1.3;
}
.panel-toggle:hover { color: var(--text); border-color: var(--accent); }
.filters.collapsed { width: 34px; padding: 8px 4px; }
.filters.collapsed > :not(.panel-toggle) { display: none; }
.detail.collapsed { width: 34px; padding: 8px 4px; }
.detail.collapsed > :not(.panel-toggle) { display: none; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.node-row.flash { animation: row-flash 1.4s ease-out; }
@keyframes row-flash {
  0% { background: rgba(79, 140, 255, 0.55); border-color: rgba(79, 140, 255, 0.95); }
  100% { background: rgba(79, 140, 255, 0.15); border-color: rgba(79, 140, 255, 0.45); }
}
.alert-mark { color: var(--red); font-weight: 700; flex: none; font-size: 12px; }
.view.graph-mode { display: flex; flex-direction: column; padding: 10px; overflow: hidden; }
.graph-wrap {
  flex: 1; min-height: 480px; border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; position: relative; background: var(--panel);
}
.graph-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(15, 18, 24, 0.82); color: var(--muted); font-size: 13px; z-index: 5;
}
.matrix-wrap {
  overflow: auto; max-height: calc(100vh - 160px);
  border: 1px solid var(--border); border-radius: 8px; background: var(--panel);
}
table.matrix { border-collapse: collapse; font-size: 12px; width: 100%; }
.matrix th, .matrix td { border-bottom: 1px solid var(--border); padding: 5px 8px; white-space: nowrap; }
.matrix th {
  position: sticky; top: 0; background: var(--panel-2); z-index: 1;
  text-align: left; color: var(--muted); font-weight: 600;
}
.matrix td.count { text-align: right; font-family: var(--mono); }
.matrix tbody tr { cursor: pointer; }
.matrix tbody tr:hover td { background: var(--panel-2); }
.matrix .rowkey { font-family: var(--mono); color: var(--accent); }
.matrix .rowsummary { color: var(--muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: bottom; }
.dir-out { color: var(--accent); }
.dir-in { color: var(--muted); }
.summary-line { color: var(--muted); font-size: 12px; margin-bottom: 10px; }
.alerts h3 { margin: 18px 0 8px; font-size: 13px; }
.count-pill {
  display: inline-block; min-width: 20px; padding: 0 6px; margin-left: 8px;
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 9px;
  font-size: 11px; text-align: center;
}
.alert-row {
  display: flex; gap: 10px; align-items: center; width: 100%;
  background: var(--panel); border: 1px solid var(--border); color: var(--text);
  border-radius: 6px; padding: 7px 10px; margin-bottom: 6px;
  cursor: pointer; text-align: left; font-size: 13px;
}
.alert-row:hover { border-color: var(--red); }
.alert-row .ak { font-family: var(--mono); color: var(--accent); flex: none; }
.alert-row .ad { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail .jira-link {
  display: inline-block; margin-top: 8px; color: var(--accent);
  font-size: 13px; text-decoration: none;
}
.detail .jira-link:hover { text-decoration: underline; }
.metric-link { color: var(--accent); text-decoration: none; }
.metric-link:hover { text-decoration: underline; }
.metric-select { color: var(--accent); cursor: pointer; }
.metric-select:hover { text-decoration: underline; }
`;

export function injectStyles(): void {
  const el = document.createElement('style');
  el.textContent = styles;
  document.head.appendChild(el);
}
