import type { TraceSnapshot } from '../scripts/lib/trace-types.ts';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { validateSnapshot, writeSnapshot } from '../scripts/lib/snapshot.ts';

function goodSnapshot(): TraceSnapshot {
  return {
    meta: {
      schemaVersion: 1,
      projectKey: 'BK',
      generatedAt: '2026-10-05T00:00:00.000Z',
      counts: { nodes: 1, edges: 0 },
    },
    nodes: [
      { key: 'BK-1', kind: 'issue', url: 'https://acme.atlassian.net/browse/BK-1', summary: 'x' },
    ],
    edges: [],
  };
}

describe('validateSnapshot', () => {
  test('accepts a valid snapshot', () => {
    expect(validateSnapshot(goodSnapshot()).ok).toBe(true);
  });

  test('rejects 0 issues', () => {
    const snapshot = goodSnapshot();
    snapshot.nodes = [{ key: 'component:1', kind: 'component', url: 'https://x', summary: 'c' }];
    expect(validateSnapshot(snapshot)).toMatchObject({ ok: false });
  });

  test('rejects unknown edge kind', () => {
    const snapshot = goodSnapshot();
    snapshot.edges = [{ from: 'BK-1', to: 'BK-2', kind: 'bogus' }];
    expect(validateSnapshot(snapshot)).toMatchObject({ ok: false });
  });

  test('rejects missing meta', () => {
    expect(validateSnapshot({ nodes: [], edges: [] })).toMatchObject({ ok: false });
  });
});

describe('writeSnapshot fail-safe', () => {
  test('writes valid snapshot atomically', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trace-ok-'));
    const path = join(dir, 'nested', 'trace.json');

    writeSnapshot(goodSnapshot(), path);

    expect(existsSync(path)).toBe(true);
    const written = JSON.parse(readFileSync(path, 'utf8')) as TraceSnapshot;
    expect(written.meta.projectKey).toBe('BK');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  test('invalid snapshot never overwrites existing good file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trace-safe-'));
    const path = join(dir, 'trace.json');
    writeSnapshot(goodSnapshot(), path);
    const before = readFileSync(path, 'utf8');

    expect(() => writeSnapshot({ nodes: [], edges: [] }, path)).toThrow();
    expect(readFileSync(path, 'utf8')).toBe(before);
  });
});

describe('readSnapshot', () => {
  test('throws with guidance when missing', () => {
    expect(() => readFileSync(join(tmpdir(), 'does-not-exist-trace.json'), 'utf8')).toThrow();
  });

  test('rejects corrupted JSON on disk via validate path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trace-corrupt-'));
    const path = join(dir, 'trace.json');
    writeFileSync(path, '{ not json', 'utf8');
    const parseCorrupt = (): unknown => JSON.parse(readFileSync(path, 'utf8'));
    expect(parseCorrupt).toThrow();
  });
});
