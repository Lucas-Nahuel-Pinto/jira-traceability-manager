import type { TraceEdge, TraceNode } from '../scripts/lib/trace-types.ts';
import { describe, expect, test } from 'bun:test';
import {
  bucketAge,
  bugAging,
  filterIssues,
  kpis,
  throughput,
  weekStartIso,
} from '../src/metrics.ts';

function issue(key: string, overrides: Partial<TraceNode> = {}): TraceNode {
  return {
    key,
    kind: 'issue',
    url: `https://x/${key}`,
    issueType: 'Story',
    status: 'To Do',
    statusCategory: 'new',
    ...overrides,
  };
}

const hierarchy: TraceEdge[] = [
  { from: 'ACME-1', to: 'ACME-2', kind: 'hierarchy' },
  { from: 'ACME-2', to: 'ACME-3', kind: 'hierarchy' },
  { from: 'ACME-1', to: 'ACME-9', kind: 'hierarchy' },
];

describe('bucketAge', () => {
  test('boundary values map to the right bucket', () => {
    expect(bucketAge(0)).toBe('<7d');
    expect(bucketAge(6.99)).toBe('<7d');
    expect(bucketAge(7)).toBe('7–30d');
    expect(bucketAge(30)).toBe('7–30d');
    expect(bucketAge(30.01)).toBe('>30d');
    expect(bucketAge(400)).toBe('>30d');
    expect(bucketAge(null)).toBe('sin fecha');
  });
});

describe('weekStartIso', () => {
  test('returns Monday of the UTC week', () => {
    expect(weekStartIso(new Date('2026-10-05T10:00:00Z'))).toBe('2026-10-05');
    expect(weekStartIso(new Date('2026-10-07T10:00:00Z'))).toBe('2026-10-05');
    expect(weekStartIso(new Date('2026-10-11T10:00:00Z'))).toBe('2026-10-05');
    expect(weekStartIso(new Date('2026-10-12T10:00:00Z'))).toBe('2026-10-12');
    expect(weekStartIso(new Date('2026-10-04T23:59:00Z'))).toBe('2026-09-28');
  });
});

describe('throughput', () => {
  test('buckets created and closed issues into the last 6 ISO weeks', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    const data: TraceNode[] = [
      issue('A', { createdAt: '2026-10-06T00:00:00Z' }),
      issue('B', { createdAt: '2026-10-05T00:00:00Z' }),
      issue('C', { createdAt: '2026-09-20T00:00:00Z' }),
      issue('D', { resolutionDate: '2026-10-01T00:00:00Z' }),
    ];
    const buckets = throughput(data, now, 6);
    expect(buckets).toHaveLength(6);
    expect(buckets.at(-1)?.week).toBe('2026-10-05');
    expect(buckets.at(-1)?.created).toBe(2);
    const sep28 = buckets.find(bucket => bucket.week === '2026-09-28');
    expect(sep28?.closed).toBe(1);
    const totalCreated = buckets.reduce((sum, bucket) => sum + bucket.created, 0);
    expect(totalCreated).toBe(3);
  });
});

describe('filterIssues', () => {
  const issues: TraceNode[] = [
    issue('ACME-1', { issueType: 'Epic', createdAt: '2026-01-10T00:00:00Z' }),
    issue('ACME-2', { createdAt: '2026-03-15T00:00:00Z' }),
    issue('ACME-3', { createdAt: '2026-04-01T00:00:00Z' }),
    issue('ACME-9', { createdAt: '2026-09-01T00:00:00Z' }),
    issue('ACME-77', { createdAt: '2026-09-01T00:00:00Z' }),
  ];

  test('epic filter selects the whole subtree', () => {
    const result = filterIssues(issues, hierarchy, { epicKey: 'ACME-1' });
    expect(result.map(node => node.key).sort()).toEqual(['ACME-1', 'ACME-2', 'ACME-3', 'ACME-9']);
  });

  test('date range filters by createdAt', () => {
    const result = filterIssues(issues, hierarchy, { from: '2026-04-01', to: '2026-08-31' });
    expect(result.map(node => node.key)).toEqual(['ACME-3']);
  });

  test('combined epic + date filter intersects both', () => {
    const result = filterIssues(issues, hierarchy, { epicKey: 'ACME-1', from: '2026-03-01' });
    expect(result.map(node => node.key).sort()).toEqual(['ACME-2', 'ACME-3', 'ACME-9']);
  });
});

describe('kpis', () => {
  test('counts open, closed, bug aging and points', () => {
    const now = Date.now();
    const data: TraceNode[] = [
      issue('A', { statusCategory: 'done', points: 5 }),
      issue('B', { statusCategory: 'new', issueType: 'Bug', createdAt: new Date(now - 40 * 86_400_000).toISOString() }),
      issue('C', { statusCategory: 'new', issueType: 'Bug', createdAt: new Date(now - 2 * 86_400_000).toISOString() }),
      issue('D', { statusCategory: 'indeterminate', points: 3 }),
    ];
    const result = kpis(data, hierarchy);
    expect(result.total).toBe(4);
    expect(result.open).toBe(3);
    expect(result.closed).toBe(1);
    expect(result.bugsOpen).toBe(2);
    expect(result.bugsOpen30d).toBe(1);
    expect(result.points).toBe(8);
    expect(result.links).toBe(3);
  });

  test('bugAging distributes open bugs by bucket', () => {
    const now = Date.now();
    const data: TraceNode[] = [
      issue('B1', { issueType: 'Bug', statusCategory: 'new', createdAt: new Date(now - 1 * 86_400_000).toISOString() }),
      issue('B2', { issueType: 'Bug', statusCategory: 'new', createdAt: new Date(now - 10 * 86_400_000).toISOString() }),
      issue('B3', { issueType: 'Bug', statusCategory: 'new', createdAt: new Date(now - 60 * 86_400_000).toISOString() }),
      issue('B4', { issueType: 'Bug', statusCategory: 'done', createdAt: new Date(now - 60 * 86_400_000).toISOString() }),
    ];
    const aging = bugAging(data, now);
    expect(aging).toEqual([
      { bucket: '<7d', count: 1 },
      { bucket: '7–30d', count: 1 },
      { bucket: '>30d', count: 1 },
      { bucket: 'sin fecha', count: 0 },
    ]);
  });
});
