import type { TraceNode } from '../scripts/lib/trace-types.ts';
import { snapshot } from './data.ts';

export const meta = snapshot.meta;
export const nodes: TraceNode[] = snapshot.nodes;
export const edges = snapshot.edges;

export const issues: TraceNode[] = nodes.filter(node => node.kind === 'issue');
export const nodeByKey = new Map<string, TraceNode>(nodes.map(node => [node.key, node]));

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
