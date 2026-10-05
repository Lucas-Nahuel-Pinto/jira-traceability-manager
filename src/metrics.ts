import type { TraceEdge, TraceNode } from '../scripts/lib/trace-types.ts';

export interface MetricsFilter {
  from?: string
  to?: string
  epicKey?: string
}

export interface Kpis {
  total: number
  open: number
  closed: number
  bugsOpen: number
  bugsOpen30d: number
  points: number
  links: number
}

export function filterIssues(issues: TraceNode[], edges: TraceEdge[], filter: MetricsFilter): TraceNode[] {
  let scoped = issues;
  if (filter.epicKey) {
    const subtree = epicSubtree(edges, filter.epicKey);
    scoped = scoped.filter(issue => subtree.has(issue.key) || issue.key === filter.epicKey);
  }
  if (filter.from) {
    const from = filter.from;
    scoped = scoped.filter(issue => (issue.createdAt ?? '') >= from);
  }
  if (filter.to) {
    const to = `${filter.to}T23:59:59.999Z`;
    scoped = scoped.filter(issue => (issue.createdAt ?? '') <= to);
  }
  return scoped;
}

export function filterEdges(edges: TraceEdge[], visibleKeys: Set<string>): TraceEdge[] {
  return edges.filter(edge => visibleKeys.has(edge.from) && visibleKeys.has(edge.to));
}

function epicSubtree(edges: TraceEdge[], epicKey: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== 'hierarchy') { continue; }
    const bucket = children.get(edge.from) ?? [];
    bucket.push(edge.to);
    children.set(edge.from, bucket);
  }
  const out = new Set<string>();
  const stack = [epicKey];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const child of children.get(current) ?? []) {
      if (out.has(child)) { continue; }
      out.add(child);
      stack.push(child);
    }
  }
  return out;
}

export function kpis(issues: TraceNode[], edges: TraceEdge[]): Kpis {
  let open = 0;
  let closed = 0;
  let bugsOpen = 0;
  let bugsOpen30d = 0;
  let points = 0;
  const now = Date.now();
  for (const issue of issues) {
    const done = issue.statusCategory === 'done';
    if (done) { closed++; }
    else { open++; }
    if (!done && issue.issueType === 'Bug') {
      bugsOpen++;
      const ageDays = ageInDays(issue, now);
      if (ageDays !== null && ageDays > 30) { bugsOpen30d++; }
    }
    points += issue.points ?? 0;
  }
  return { total: issues.length, open, closed, bugsOpen, bugsOpen30d, points, links: edges.length };
}

export interface Slice {
  label: string
  count: number
}

export function statusDistribution(issues: TraceNode[]): Slice[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    const status = issue.status ?? 'sin estado';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export interface EpicProgress {
  epic: string
  total: number
  byStatus: Slice[]
  done: number
}

export function epicProgress(issues: TraceNode[], parentOf: Map<string, string | undefined>): EpicProgress[] {
  const epics = new Map<string, TraceNode[]>();
  for (const issue of issues) {
    const epicKey = parentOf.get(issue.key);
    if (!epicKey) { continue; }
    const bucket = epics.get(epicKey) ?? [];
    bucket.push(issue);
    epics.set(epicKey, bucket);
  }
  const out: EpicProgress[] = [];
  for (const [epicKey, children] of epics) {
    const byStatus = new Map<string, number>();
    let done = 0;
    for (const child of children) {
      const status = child.status ?? 'sin estado';
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
      if (child.statusCategory === 'done') { done++; }
    }
    out.push({
      epic: epicKey,
      total: children.length,
      done,
      byStatus: [...byStatus.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function weekStartIso(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export interface WeekBucket {
  week: string
  created: number
  closed: number
}

export function throughput(issues: TraceNode[], now: Date, weeks = 6): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const starts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    starts.push(weekStartIso(d));
  }
  for (const week of starts) { buckets.push({ week, created: 0, closed: 0 }); }
  const index = new Map(starts.map((week, i) => [week, i]));
  for (const issue of issues) {
    if (issue.createdAt) {
      const bucket = index.get(weekStartIso(new Date(issue.createdAt)));
      if (bucket !== undefined) { buckets[bucket].created++; }
    }
    if (issue.resolutionDate) {
      const bucket = index.get(weekStartIso(new Date(issue.resolutionDate)));
      if (bucket !== undefined) { buckets[bucket].closed++; }
    }
  }
  return buckets;
}

export function pointsByEpic(issues: TraceNode[], parentOf: Map<string, string | undefined>): Slice[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    if (!issue.points) { continue; }
    const epic = parentOf.get(issue.key) ?? '(sin épica)';
    counts.set(epic, (counts.get(epic) ?? 0) + issue.points);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function workload(issues: TraceNode[], top = 8): Slice[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    if (issue.statusCategory === 'done') { continue; }
    const assignee = issue.assignee ?? 'sin asignar';
    counts.set(assignee, (counts.get(assignee) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

export function linkKindCounts(edges: TraceEdge[]): Slice[] {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.kind, (counts.get(edge.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label: label.replace('link:', ''), count }))
    .sort((a, b) => b.count - a.count);
}

export interface CentralNode {
  key: string
  degree: number
}

export function topCentral(edges: TraceEdge[], limit = 10): CentralNode[] {
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  return [...degree.entries()]
    .map(([key, degreeCount]) => ({ key, degree: degreeCount }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, limit);
}

export type BugBucket = '<7d' | '7–30d' | '>30d' | 'sin fecha';

export function bucketAge(days: number | null): BugBucket {
  if (days === null) { return 'sin fecha'; }
  if (days < 7) { return '<7d'; }
  if (days <= 30) { return '7–30d'; }
  return '>30d';
}

export function ageInDays(issue: TraceNode, now: number): number | null {
  if (!issue.createdAt) { return null; }
  const created = Date.parse(issue.createdAt);
  if (Number.isNaN(created)) { return null; }
  return (now - created) / 86_400_000;
}

export function bugAging(issues: TraceNode[], now: number): { bucket: BugBucket, count: number }[] {
  const counts = new Map<BugBucket, number>();
  for (const issue of issues) {
    if (issue.issueType !== 'Bug' || issue.statusCategory === 'done') { continue; }
    const bucket = bucketAge(ageInDays(issue, now));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const order: BugBucket[] = ['<7d', '7–30d', '>30d', 'sin fecha'];
  return order.map(bucket => ({ bucket, count: counts.get(bucket) ?? 0 }));
}

export function parentMap(edges: TraceEdge[]): Map<string, string | undefined> {
  const parents = new Map<string, string | undefined>();
  for (const edge of edges) {
    if (edge.kind !== 'hierarchy') { continue; }
    parents.set(edge.to, edge.from);
  }
  return parents;
}

export function xrayExecutionStatuses(issues: TraceNode[]): Slice[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    if (issue.issueType !== 'Test Execution') { continue; }
    const status = issue.status ?? 'sin estado';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
