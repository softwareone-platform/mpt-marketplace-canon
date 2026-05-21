export type TNodeType = 'domain' | 'entity' | 'state' | 'transition' | 'action' | 'term' | 'constraint' | 'risk' | 'rule';

export type TRefType =
  | 'parent'
  | 'transition'
  | 'action-binding'
  | 'constraint'
  | 'risk'
  | 'note'
  | 'dependency'
  | 'mention';

export interface IGraphNode {
  id: string;
  type: TNodeType;
  name?: string;
  description?: string;
  aliases?: string[];
  meta?: Record<string, unknown>;
}

export interface IGraphRef {
  id: string;
  owner: string;
  type: TRefType;
  pointers: Record<string, string | string[]>;
  description?: string;
  meta?: Record<string, unknown>;
}

export interface IGraphData {
  nodes: IGraphNode[];
  refs: IGraphRef[];
}
