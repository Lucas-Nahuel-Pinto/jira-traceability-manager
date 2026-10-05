import type { ErrorObject } from 'ajv';
import type { TraceSnapshot } from './trace-types.ts';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Ajv from 'ajv';

const SCHEMA_PATH = join(import.meta.dir, '..', '..', 'trace.schema.json');
const SNAPSHOT_PATH = join(import.meta.dir, '..', '..', 'data', 'trace.json');

export function snapshotPath(): string {
  return SNAPSHOT_PATH;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map(err => `${err.instancePath || '/'} ${err.message ?? 'invalid'}`)
    .join('\n');
}

export function validateSnapshot(data: unknown): { ok: true, value: TraceSnapshot } | { ok: false, error: string } {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as object;
  const validate = ajv.compile(schema);

  if (!validate(data)) { return { ok: false, error: formatErrors(validate.errors) }; }

  const snapshot = data as TraceSnapshot;
  const issueCount = snapshot.nodes.filter(node => node.kind === 'issue').length;
  if (issueCount === 0) {
    return { ok: false, error: 'refusing snapshot with 0 issues' };
  }

  return { ok: true, value: snapshot };
}

export function writeSnapshot(snapshot: unknown, path = SNAPSHOT_PATH): void {
  const result = validateSnapshot(snapshot);
  if (!result.ok) {
    throw new Error(`Snapshot rejected — existing data untouched:\n${result.error}`);
  }

  const tmpPath = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmpPath, `${JSON.stringify(result.value, null, 2)}\n`, 'utf8');
  renameSync(tmpPath, path);
}

export function readSnapshot(path = SNAPSHOT_PATH): TraceSnapshot {
  if (!existsSync(path)) {
    throw new Error(`Snapshot not found: ${path}. Run \`bun run trace:pull\` first.`);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const result = validateSnapshot(parsed);
  if (!result.ok) { throw new Error(`Snapshot invalid:\n${result.error}`); }
  return result.value;
}
