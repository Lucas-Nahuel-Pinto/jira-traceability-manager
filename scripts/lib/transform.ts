import type { FieldMap } from './field-map.ts';
import type { TraceEdge, TraceNode } from './trace-types.ts';

export interface RawIssueLink {
  type: { id: string, name: string, inward: string, outward: string }
  outwardIssue?: { key: string }
  inwardIssue?: { key: string }
}

export interface RawSprint {
  id: number
  name: string
  state?: string
  startDate?: string
  endDate?: string
}

export interface RawIssue {
  key: string
  fields: {
    summary?: string
    issuetype?: { name: string }
    status?: { name?: string, statusCategory?: { key?: string, name?: string } }
    parent?: { key: string }
    assignee?: { displayName?: string }
    priority?: { name?: string }
    labels?: string[]
    components?: Array<{ id?: string, name: string }>
    created?: string
    updated?: string
    resolutiondate?: string
    issuelinks?: RawIssueLink[]
    attachment?: Array<{ filename: string, size: number }>
    [customField: string]: unknown
  }
}

export interface RawComponent {
  id: string
  name: string
}

export interface TransformInput {
  issues: RawIssue[]
  components: RawComponent[]
  fieldMap: FieldMap
  baseUrl: string
  projectKey: string
}

export interface Graph {
  nodes: TraceNode[]
  edges: TraceEdge[]
}

const COMPONENT_PREFIX = 'component:';
const SPRINT_PREFIX = 'sprint:';

export function issueUrl(baseUrl: string, key: string): string {
  return `${baseUrl}/browse/${key}`;
}

export function projectUrl(baseUrl: string, projectKey: string): string {
  return `${baseUrl}/browse/${projectKey}`;
}

export function linkKind(typeName: string): string {
  return `link:${typeName.toLowerCase().trim().replace(/\s+/g, '-')}`;
}

export function dedupeEdges(edges: TraceEdge[]): TraceEdge[] {
  const seen = new Set<string>();
  const out: TraceEdge[] = [];
  for (const edge of edges) {
    const id = `${edge.from}\u0000${edge.to}\u0000${edge.kind}`;
    if (seen.has(id)) { continue; }
    seen.add(id);
    out.push(edge);
  }
  return out;
}

function pickSprint(value: unknown): RawSprint | undefined {
  if (!Array.isArray(value) || value.length === 0) { return undefined; }
  const sprints = value as RawSprint[];
  return sprints.findLast(s => s.state !== 'closed') ?? sprints[sprints.length - 1];
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') { return undefined; }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function transformIssues(input: TransformInput): Graph {
  const nodes: TraceNode[] = [];
  const edges: TraceEdge[] = [];
  const sprintNodes = new Map<string, TraceNode>();

  const componentNodes = new Map<string, TraceNode>();
  for (const component of input.components) {
    componentNodes.set(component.id, {
      key: `${COMPONENT_PREFIX}${component.id}`,
      kind: 'component',
      url: projectUrl(input.baseUrl, input.projectKey),
      summary: component.name,
    });
  }

  for (const issue of input.issues) {
    const fields = issue.fields;
    const sprint = pickSprint(fields[input.fieldMap.sprint ?? '__missing__']);
    const points = toNumber(fields[input.fieldMap.storyPoints ?? '__missing__']);

    nodes.push({
      key: issue.key,
      kind: 'issue',
      url: issueUrl(input.baseUrl, issue.key),
      summary: fields.summary ?? '',
      issueType: fields.issuetype?.name,
      status: fields.status?.name,
      statusCategory: fields.status?.statusCategory?.key,
      assignee: fields.assignee?.displayName,
      priority: fields.priority?.name,
      labels: fields.labels ?? [],
      components: (fields.components ?? []).map(c => c.name),
      sprint: sprint?.name,
      points,
      createdAt: fields.created,
      updatedAt: fields.updated,
      resolutionDate: fields.resolutiondate,
      parent: fields.parent?.key,
    });

    if (fields.parent) {
      edges.push({ from: fields.parent.key, to: issue.key, kind: 'hierarchy' });
    }

    for (const link of fields.issuelinks ?? []) {
      const kind = linkKind(link.type.name);
      if (link.outwardIssue) { edges.push({ from: issue.key, to: link.outwardIssue.key, kind }); }
      if (link.inwardIssue) { edges.push({ from: link.inwardIssue.key, to: issue.key, kind }); }
    }

    for (const component of fields.components ?? []) {
      if (!component.id) { continue; }
      edges.push({
        from: issue.key,
        to: `${COMPONENT_PREFIX}${component.id}`,
        kind: 'component',
      });
    }

    if (sprint) {
      const sprintKey = `${SPRINT_PREFIX}${sprint.id}`;
      if (!sprintNodes.has(sprintKey)) {
        sprintNodes.set(sprintKey, {
          key: sprintKey,
          kind: 'sprint',
          url: projectUrl(input.baseUrl, input.projectKey),
          summary: sprint.name,
          status: sprint.state,
          createdAt: sprint.startDate,
          updatedAt: sprint.endDate,
        });
      }
      edges.push({ from: issue.key, to: sprintKey, kind: 'sprint' });
    }
  }

  nodes.push(...componentNodes.values(), ...sprintNodes.values());

  return { nodes, edges: dedupeEdges(edges) };
}
