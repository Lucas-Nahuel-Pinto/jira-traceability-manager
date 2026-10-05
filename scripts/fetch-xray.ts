import type { TraceEdge, TraceNode } from './lib/trace-types.ts';
import type { Graph } from './lib/transform.ts';

const XRAY_BASE = 'https://api.xray.cloud.com/api/v2';

export interface XrayEnv {
  client: string
  secret: string
  projectKey: string
}

export function loadXrayEnv(env: NodeJS.ProcessEnv = process.env): XrayEnv | null {
  const client = env.XRAY_CLIENT_ID?.trim();
  const secret = env.XRAY_CLIENT_SECRET?.trim();
  const projectKey = env.XRAY_PROJECT_KEY?.trim() || env.JIRA_PROJECT_KEY?.trim();

  if (!client || !secret || !projectKey) { return null; }
  return { client, secret, projectKey };
}

interface XrayExecution {
  id: number
  issueId?: number
  status?: string
  statusName?: string
  testIssueKey?: string
  tests?: Array<{ key?: string }>
  testKey?: string
}

async function xrayToken(xenv: XrayEnv): Promise<string> {
  const res = await fetch(`${XRAY_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client: xenv.client, secret: xenv.secret }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) { throw new Error(`Xray auth failed (HTTP ${res.status})`); }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) { throw new Error('Xray auth failed: no access_token in response'); }
  return body.access_token;
}

function normalizeStatus(raw: XrayExecution): string {
  const status = (raw.statusName ?? raw.status ?? '').toUpperCase();
  if (status.includes('PASS') || status.includes('OK')) { return 'PASS'; }
  if (status.includes('FAIL') || status.includes('ERROR')) { return 'FAIL'; }
  return 'TO DO';
}

export async function fetchXrayGraph(xenv: XrayEnv, baseUrl: string): Promise<Graph> {
  const token = await xrayToken(xenv);
  const nodes: TraceNode[] = [];
  const edges: TraceEdge[] = [];
  let offset = 0;
  const pageSize = 100;

  for (let page = 0; page < 20; page++) {
    const url = `${XRAY_BASE}/execution?projectKey=${encodeURIComponent(xenv.projectKey)}`
      + `&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { throw new Error(`Xray executions failed (HTTP ${res.status})`); }

    const body = (await res.json()) as { values?: XrayExecution[], total?: number };
    const values = body.values ?? [];
    if (values.length === 0) { break; }

    for (const execution of values) {
      const key = `exec:${execution.id}`;
      nodes.push({
        key,
        kind: 'xray',
        url: `${baseUrl}/browse/${xenv.projectKey}`,
        summary: `Ejecución #${execution.id}`,
        status: normalizeStatus(execution),
      });

      const testKeys = [
        ...(execution.testIssueKey ? [execution.testIssueKey] : []),
        ...(execution.testKey ? [execution.testKey] : []),
        ...(execution.tests ?? []).flatMap(test => (test.key ? [test.key] : [])),
      ];
      for (const testKey of testKeys) {
        edges.push({ from: testKey, to: key, kind: 'xray-test' });
      }
    }

    offset += pageSize;
    if (body.total !== undefined && offset >= body.total) { break; }
  }

  return { nodes, edges };
}
