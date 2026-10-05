import type { RawIssue } from '../scripts/lib/transform.ts';
import { describe, expect, test } from 'bun:test';
import { dedupeEdges, linkKind, transformIssues } from '../scripts/lib/transform.ts';

const fieldMap = { sprint: 'customfield_100', storyPoints: 'customfield_200', resolvedAt: 'now' };

function baseInput(issues: RawIssue[]) {
  return {
    issues,
    components: [{ id: '7', name: 'Billing' }],
    fieldMap,
    baseUrl: 'https://acme.atlassian.net',
    projectKey: 'BK',
  };
}

function issue(key: string, fields: RawIssue['fields'] = {}): RawIssue {
  return { key, fields };
}

describe('transformIssues', () => {
  test('builds issue node with url, hierarchy edge from parent', () => {
    const graph = transformIssues(
      baseInput([issue('BK-2', { summary: 'child', parent: { key: 'BK-1' }, issuetype: { name: 'Story' } })]),
    );

    const node = graph.nodes.find(n => n.key === 'BK-2');
    expect(node?.url).toBe('https://acme.atlassian.net/browse/BK-2');
    expect(node?.parent).toBe('BK-1');
    expect(graph.edges).toContainEqual({ from: 'BK-1', to: 'BK-2', kind: 'hierarchy' });
  });

  test('outward link: this blocks other', () => {
    const graph = transformIssues(
      baseInput([
        issue('BK-1', {
          issuelinks: [
            { type: { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'BK-2' } },
          ],
        }),
      ]),
    );

    expect(graph.edges).toContainEqual({ from: 'BK-1', to: 'BK-2', kind: 'link:blocks' });
  });

  test('inward link: other blocks this (direction preserved)', () => {
    const graph = transformIssues(
      baseInput([
        issue('BK-2', {
          issuelinks: [
            { type: { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'BK-1' } },
          ],
        }),
      ]),
    );

    expect(graph.edges).toContainEqual({ from: 'BK-1', to: 'BK-2', kind: 'link:blocks' });
    expect(graph.edges.some(e => e.from === 'BK-2' && e.kind === 'link:blocks')).toBe(false);
  });

  test('same link seen from both issues is deduped', () => {
    const shared = { type: { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' } };
    const graph = transformIssues(
      baseInput([
        issue('BK-1', { issuelinks: [{ ...shared, outwardIssue: { key: 'BK-2' } }] }),
        issue('BK-2', { issuelinks: [{ ...shared, inwardIssue: { key: 'BK-1' } }] }),
      ]),
    );

    expect(graph.edges.filter(e => e.kind === 'link:blocks')).toHaveLength(1);
  });

  test('component edge + component node from project components', () => {
    const graph = transformIssues(
      baseInput([issue('BK-1', { components: [{ id: '7', name: 'Billing' }] })]),
    );

    expect(graph.nodes.find(n => n.key === 'component:7')?.summary).toBe('Billing');
    expect(graph.edges).toContainEqual({ from: 'BK-1', to: 'component:7', kind: 'component' });
  });

  test('sprint edge uses active sprint and skips closed', () => {
    const graph = transformIssues(
      baseInput([
        issue('BK-1', {
          customfield_100: [
            { id: 1, name: 'Sprint 5', state: 'closed' },
            { id: 2, name: 'Sprint 7', state: 'active' },
          ] as never,
        }),
      ]),
    );

    expect(graph.nodes.find(n => n.key === 'sprint:2')?.summary).toBe('Sprint 7');
    expect(graph.edges).toContainEqual({ from: 'BK-1', to: 'sprint:2', kind: 'sprint' });
    expect(graph.nodes.some(n => n.key === 'sprint:1')).toBe(false);
  });

  test('points parsed to number, resolutionDate preserved', () => {
    const graph = transformIssues(
      baseInput([
        issue('BK-1', { customfield_200: 5, resolutiondate: '2026-10-01T00:00:00.000+0000' }),
      ]),
    );

    const node = graph.nodes.find(n => n.key === 'BK-1');
    expect(node?.points).toBe(5);
    expect(node?.resolutionDate).toBe('2026-10-01T00:00:00.000+0000');
  });
});

describe('helpers', () => {
  test('linkKind normalizes names', () => {
    expect(linkKind('Blocks')).toBe('link:blocks');
    expect(linkKind('Relates  to')).toBe('link:relates-to');
  });

  test('dedupeEdges keeps first occurrence', () => {
    const out = dedupeEdges([
      { from: 'A', to: 'B', kind: 'link:blocks' },
      { from: 'A', to: 'B', kind: 'link:blocks' },
      { from: 'A', to: 'B', kind: 'link:duplicates' },
    ]);
    expect(out).toHaveLength(2);
  });
});
