import type { FieldMap } from './lib/field-map.ts';
import type { TraceSnapshot } from './lib/trace-types.ts';
import type { Graph, RawComponent, RawIssue } from './lib/transform.ts';
import { fetchXrayGraph, loadXrayEnv } from './fetch-xray.ts';
import { loadFieldMap } from './lib/field-map.ts';
import { createJiraClient, loadJiraEnv } from './lib/jira-client.ts';
import { writeSnapshot } from './lib/snapshot.ts';
import { dedupeEdges, transformIssues } from './lib/transform.ts';

const BASE_FIELDS = [
  'summary',
  'issuetype',
  'status',
  'parent',
  'assignee',
  'priority',
  'labels',
  'components',
  'created',
  'updated',
  'resolutiondate',
  'resolution',
  'issuelinks',
  'attachment',
  'fixVersions',
  'subtasks',
];

function jqlEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function pullSnapshot(): Promise<TraceSnapshot> {
  const env = loadJiraEnv();
  const client = createJiraClient(env);

  const fieldMap: FieldMap = await loadFieldMap(client);
  const fields = [
    ...BASE_FIELDS,
    ...(fieldMap.sprint ? [fieldMap.sprint] : []),
    ...(fieldMap.storyPoints ? [fieldMap.storyPoints] : []),
  ];

  const jql = `project = "${jqlEscape(env.projectKey)}" ORDER BY key ASC`;
  const issues = await client.searchAll<RawIssue>(jql, fields);
  if (issues.length === 0) {
    throw new Error(
      `Jira returned 0 issues for project "${env.projectKey}" — check ATLASSIAN_URL / ATLASSIAN_EMAIL `
      + '/ ATLASSIAN_API_TOKEN and JIRA_PROJECT_KEY in .env (bad auth can surface as an empty page).',
    );
  }
  const components = await client.get<RawComponent[]>(
    `/rest/api/3/project/${encodeURIComponent(env.projectKey)}/components`,
  );

  let graph: Graph = transformIssues({ issues, components, fieldMap, baseUrl: env.baseUrl, projectKey: env.projectKey });

  const xrayEnv = loadXrayEnv();
  let hasXray = false;
  if (xrayEnv) {
    try {
      const xrayGraph = await fetchXrayGraph(xrayEnv, env.baseUrl);
      if (xrayGraph.nodes.length > 0) {
        graph = { nodes: [...graph.nodes, ...xrayGraph.nodes], edges: dedupeEdges([...graph.edges, ...xrayGraph.edges]) };
        hasXray = true;
      }
      else {
        console.warn('[trace] Xray returned 0 executions — widget 9 will be hidden.');
      }
    }
    catch (err) {
      console.warn(`[trace] Xray skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const snapshot: TraceSnapshot = {
    meta: {
      schemaVersion: 1,
      projectKey: env.projectKey,
      generatedAt: new Date().toISOString(),
      hasXray,
      counts: { nodes: graph.nodes.length, edges: graph.edges.length },
    },
    nodes: graph.nodes,
    edges: graph.edges,
  };

  writeSnapshot(snapshot);
  return snapshot;
}

const isDirectRun = import.meta.main;
if (isDirectRun) {
  pullSnapshot()
    .then((snapshot) => {
      const issues = snapshot.nodes.filter(node => node.kind === 'issue').length;
      console.log(
        `[trace] OK ${snapshot.meta.projectKey}: ${issues} issues, `
        + `${snapshot.meta.counts.nodes} nodes, ${snapshot.meta.counts.edges} edges -> data/trace.json`,
      );
    })
    .catch((err: unknown) => {
      console.error(`[trace] FAILED: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
