import type { TraceNode } from '../scripts/lib/trace-types.ts';
import type { Filters } from './state.ts';
import { snapshot } from './data.ts';

export const meta = snapshot.meta;
export const nodes: TraceNode[] = snapshot.nodes;
export const edges = snapshot.edges;

export const issues: TraceNode[] = nodes.filter(node => node.kind === 'issue');
export const nodeByKey = new Map<string, TraceNode>(nodes.map(node => [node.key, node]));

function uniqueSorted(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

export const issueTypes = uniqueSorted(issues.map(issue => issue.issueType));
export const statuses = uniqueSorted(issues.map(issue => issue.status));
export const components = uniqueSorted(issues.flatMap(issue => issue.components ?? []));

export function passesFilters(node: TraceNode, filters: Filters): boolean {
  if (node.kind !== 'issue') { return true; }
  if (filters.issueTypes.length > 0 && !filters.issueTypes.includes(node.issueType ?? '')) { return false; }
  if (filters.statuses.length > 0 && !filters.statuses.includes(node.status ?? '')) { return false; }
  if (filters.components.length > 0 && !(node.components ?? []).some(component => filters.components.includes(component))) {
    return false;
  }
  return true;
}

const TYPE_COLORS: Record<string, string> = {
  'Epic': '#d29922',
  'Story': '#3b6cf0',
  'Bug': '#f85149',
  'Task': '#8b94a7',
  'Test': '#3fb950',
  'Test Plan': '#a371f7',
  'Test Execution': '#ff7b9c',
  'Test Set': '#39c5cf',
  'Test Run': '#c9d1d9',
  'Precondition': '#ffd166',
  'Improvement': '#ff922b',
  'Defect': '#db61a2',
  'Tech Story': '#7c6cff',
  'Tech Debt': '#58c4ff',
};

const KIND_COLORS: Record<string, string> = { component: '#6e7681', sprint: '#2dd4a7' };

export function typeColorOf(issueType: string | undefined): string {
  return TYPE_COLORS[issueType ?? ''] ?? '#6e7681';
}

export function nodeColor(node: TraceNode): string {
  if (node.kind !== 'issue') { return KIND_COLORS[node.kind] ?? '#6e7681'; }
  return typeColorOf(node.issueType);
}

const childrenIndex = new Map<string, string[]>();
const parentsIndex = new Map<string, string[]>();

for (const edge of edges) {
  if (edge.kind !== 'hierarchy') { continue; }
  const siblings = childrenIndex.get(edge.from) ?? [];
  siblings.push(edge.to);
  childrenIndex.set(edge.from, siblings);
  const parents = parentsIndex.get(edge.to) ?? [];
  parents.push(edge.from);
  parentsIndex.set(edge.to, parents);
}

export function childrenOf(key: string): TraceNode[] {
  return (childrenIndex.get(key) ?? [])
    .map(child => nodeByKey.get(child))
    .filter((node): node is TraceNode => Boolean(node));
}

export function parentsOf(key: string): TraceNode[] {
  return (parentsIndex.get(key) ?? [])
    .map(parent => nodeByKey.get(parent))
    .filter((node): node is TraceNode => Boolean(node));
}

export function isDone(node: TraceNode): boolean {
  return node.statusCategory === 'done';
}

export function descendantsOf(key: string): Set<string> {
  const out = new Set<string>();
  const stack = [key];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const child of childrenOf(current)) {
      if (out.has(child.key)) { continue; }
      out.add(child.key);
      stack.push(child.key);
    }
  }
  return out;
}

export interface Alert {
  type: 'orphan-story' | 'empty-epic' | 'bug-without-story' | 'open-block'
  key: string
  detail: string
}

export function computeAlerts(): Alert[] {
  const alerts: Alert[] = [];

  for (const issue of issues) {
    if (issue.issueType === 'Story' && !issue.parent) {
      alerts.push({ type: 'orphan-story', key: issue.key, detail: 'Story sin épica' });
    }
    if (issue.issueType === 'Bug' && !issue.parent) {
      alerts.push({ type: 'bug-without-story', key: issue.key, detail: 'Bug sin story' });
    }
    if (issue.issueType === 'Epic' && childrenOf(issue.key).length === 0) {
      alerts.push({ type: 'empty-epic', key: issue.key, detail: 'Épica sin stories' });
    }
  }

  for (const edge of edges) {
    if (edge.kind !== 'link:blocks') { continue; }
    const blocked = nodeByKey.get(edge.to);
    if (blocked && !isDone(blocked)) {
      alerts.push({ type: 'open-block', key: edge.to, detail: `${edge.from} bloquea ${edge.to}` });
    }
  }

  return alerts;
}

export function alertsByType(alerts: Alert[]): Map<Alert['type'], Alert[]> {
  const grouped = new Map<Alert['type'], Alert[]>();
  for (const alert of alerts) {
    const bucket = grouped.get(alert.type) ?? [];
    bucket.push(alert);
    grouped.set(alert.type, bucket);
  }
  return grouped;
}

export function matchesSearch(node: TraceNode, query: string): boolean {
  if (!query) { return true; }
  const needle = query.toLowerCase();
  return (
    node.key.toLowerCase().includes(needle)
    || (node.summary ?? '').toLowerCase().includes(needle)
    || (node.assignee ?? '').toLowerCase().includes(needle)
  );
}
