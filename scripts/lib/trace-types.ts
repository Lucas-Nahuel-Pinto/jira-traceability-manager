export interface TraceMeta {
  schemaVersion: number
  projectKey: string
  generatedAt: string
  hasXray?: boolean
  counts: { nodes: number, edges: number }
}

export type NodeKind = 'issue' | 'component' | 'sprint' | 'xray';

export interface TraceNode {
  key: string
  kind: NodeKind
  url: string
  summary?: string
  issueType?: string
  status?: string
  statusCategory?: string
  assignee?: string
  priority?: string
  labels?: string[]
  components?: string[]
  sprint?: string
  points?: number
  createdAt?: string
  updatedAt?: string
  resolutionDate?: string
  parent?: string
}

export interface TraceEdge {
  from: string
  to: string
  kind: string
}

export interface TraceSnapshot {
  meta: TraceMeta
  nodes: TraceNode[]
  edges: TraceEdge[]
}
