import type { JiraClient } from './jira-client.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface FieldMap {
  sprint: string | null
  storyPoints: string | null
  resolvedAt: string
}

interface JiraField {
  id: string
  name: string
  custom: boolean
}

const CACHE_PATH = join(import.meta.dir, 'field-map.json');

const TARGETS: Array<{ key: keyof Omit<FieldMap, 'resolvedAt'>, match: (name: string) => boolean }> = [
  { key: 'sprint', match: name => name.toLowerCase() === 'sprint' },
  { key: 'storyPoints', match: name => name.toLowerCase().replace(/\s+/g, '') === 'storypoints' },
];

export function resolveFieldMap(fields: JiraField[]): FieldMap {
  const resolved: FieldMap = {
    sprint: null,
    storyPoints: null,
    resolvedAt: new Date().toISOString(),
  };

  for (const target of TARGETS) {
    const hit = fields.find(f => f.custom && target.match(f.name));
    resolved[target.key] = hit?.id ?? null;
  }

  return resolved;
}

export async function loadFieldMap(client: JiraClient, useCache = true): Promise<FieldMap> {
  const discover = async (): Promise<FieldMap> => {
    const fields = await client.get<JiraField[]>('/rest/api/3/field');
    const map = resolveFieldMap(fields);
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    return map;
  };

  if (useCache && existsSync(CACHE_PATH)) {
    try {
      const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as FieldMap;
      if (cached.sprint || cached.storyPoints) { return cached; }
    }
    catch {
      return discover();
    }
  }

  return discover();
}
