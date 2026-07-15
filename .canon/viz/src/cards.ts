import type { IGraphData, TNodeType, TRefType } from './types';

export interface IFlatNode {
  id: string;
  type: TNodeType;
  label: string;
  namespace?: string;
  parentId?: string;
  isInitial?: boolean;
  isTerminal?: boolean;
  tooltip?: string;
}

export interface IFlatEdge {
  source: string;
  target: string;
  type: TRefType | 'pointer';
  pointer?: string;
}

export const buildFlatGraph = (data: IGraphData): {
  nodes: IFlatNode[];
  edges: IFlatEdge[];
} => {
  const knownIds = new Set(data.nodes.map(n => n.id));

  // Find parent for each node via parent refs
  const parentOf = new Map<string, string>();
  for (const r of data.refs) {
    if (r.type !== 'parent') continue;
    const parent = r.pointers.parent;
    if (typeof parent === 'string') parentOf.set(r.owner, parent);
  }

  // Infer initial/terminal states from transitions
  const initialTargets = new Set<string>();
  const statesWithOutgoing = new Set<string>();
  for (const r of data.refs) {
    if (r.type !== 'transition') continue;
    const from = r.pointers.from as string | undefined;
    const to = r.pointers.to as string | undefined;
    if (!to) continue;
    if (!from) initialTargets.add(to);
    else statesWithOutgoing.add(from);
  }

  const cleanLabel = (raw: string | undefined, fallback: string): string => {
    if (!raw) return fallback;

    // Canon data has inconsistent formatting — some term names are wrapped in backticks
    // like "`fieldName`". Strip them for readability.
    return raw.replace(/^`|`$/g, '').replace(/`/g, '');
  };

  const nodes: IFlatNode[] = data.nodes.map(n => {
    let isInitial: boolean | undefined;
    let isTerminal: boolean | undefined;
    if (n.type === 'state') {
      const metaInitial = n.meta?.initial === true;
      const metaTerminal = n.meta?.terminal === true;
      isInitial = metaInitial || initialTargets.has(n.id);
      isTerminal = metaTerminal || !statesWithOutgoing.has(n.id);
    }

    return {
      id: n.id,
      type: n.type,
      label: cleanLabel(n.name, n.id),
      namespace: (n.meta?.namespace as string | undefined),
      parentId: parentOf.get(n.id),
      isInitial,
      isTerminal,
      tooltip: n.type === 'rule' ? n.description : undefined,
    };
  });

  // Synthesize pseudo-nodes for constraint refs — in the Canon model refs ARE nodes; constraints
  // are self-attached "satellites" around their owner entity. Rendered separately by the
  // visualization (no edges drawn — placement is via a custom orbit force).
  for (const r of data.refs) {
    if (r.type !== 'constraint') continue;
    if (!knownIds.has(r.owner)) continue;
    // Prefer short identifiers for the visible label; keep the full description for hover.
    const canonId = r.meta?.canonId;
    const actor = r.meta?.actor;
    const short = typeof canonId === 'string' ? canonId
      : typeof actor === 'string' ? actor
      : r.id;
    nodes.push({
      id: r.id,
      type: 'constraint',
      label: cleanLabel(short, r.id),
      tooltip: r.description,
      parentId: r.owner,
    });
  }

  // Risk pseudo-nodes — also self-attached, on an inner orbit. No fence between them.
  for (const r of data.refs) {
    if (r.type !== 'risk') continue;
    if (!knownIds.has(r.owner)) continue;
    nodes.push({
      id: r.id,
      type: 'risk',
      label: cleanLabel(typeof r.meta?.level === 'string' ? r.meta.level : r.id, r.id),
      tooltip: r.description,
      parentId: r.owner,
    });
  }

  const edges: IFlatEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (source: string, target: string, type: IFlatEdge['type'], pointer?: string): void => {
    if (source === target) return;
    if (!knownIds.has(source) || !knownIds.has(target)) return;
    const key = `${source}->${target}::${type}::${pointer ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, type, pointer });
  };

  for (const ref of data.refs) {
    const owner = ref.owner;
    const ptrs = ref.pointers as Record<string, string | string[] | undefined>;
    for (const [key, value] of Object.entries(ptrs)) {
      if (value === undefined) continue;
      const targets = Array.isArray(value) ? value : [value];
      for (const t of targets) {
        if (!t) continue;
        addEdge(owner, t, ref.type, key);
      }
    }
  }

  return { nodes, edges };
};
