import * as d3 from 'd3';

import type { IFlatEdge, IFlatNode } from './cards';
import type { TNodeType } from './types';

const BG = '#05080f';
const EDGE_COLOR = '#30363d';

const MODULE_COLORS: Record<string, string> = {
  Accounts: '#22c55e',
  Catalog: '#3b82f6',
  Commerce: '#f59e0b',
  Notifications: '#ec4899',
  _: '#a78bfa',
};

const NODE_DEFAULT_COLORS: Record<TNodeType, string> = {
  domain: '#a78bfa',
  entity: '#3b82f6',
  state: '#22c55e',
  transition: '#fbbf24',
  action: '#f97316',
  term: '#94a3b8',
  constraint: '#fbbf24',
  risk: '#ef4444',
};

// Severity variation for risks: same red hue everywhere — intensity controlled by size and
// fill-opacity, not by tint. Risk dots are filled with a radial gradient (red core fading to
// transparent) so they read as glowing pin-points.
const RISK_COLOR = '#ef4444';
const RISK_LEVEL_SIZE: Record<string, number> = {
  high: 3.8,
  medium: 3.2,
  low: 2.8,
  'n/a': 2.4,
};
const RISK_LEVEL_OPACITY: Record<string, number> = {
  high: 1.0,
  medium: 0.88,
  low: 0.72,
  'n/a': 0.55,
};

const NODE_SIZE: Record<TNodeType, number> = {
  domain: 22,
  entity: 12,
  state: 6,
  transition: 3,
  action: 5,
  term: 1,
  constraint: 2.2,
  risk: 2.2,
};

const PARENT_ORBIT_R: Partial<Record<TNodeType, number>> = {
  term: 32,
  risk: 175,
  constraint: 200,
};
const STATE_ORBIT_R = 140; // radius of state orbit around its parent entity
const CONSTRAINT_SHUFFLE = 0; // clean circular orbit — no radial wobble

interface ISimNode extends d3.SimulationNodeDatum {
  id: string;
  type: TNodeType;
  label: string;
  namespace?: string;
  parentId?: string;
  color: string;
  isInitial?: boolean;
  isTerminal?: boolean;
  tooltip?: string;
}

interface ISimEdge extends d3.SimulationLinkDatum<ISimNode> {
  source: string | ISimNode;
  target: string | ISimNode;
  type: IFlatEdge['type'];
}

const VISIBLE_NODE_TYPES = new Set<TNodeType>(['domain', 'entity', 'state', 'term', 'constraint', 'risk']);
const HIDDEN_EDGE_TYPES = new Set(['constraint', 'note', 'risk', 'action-binding', 'mention']);

export const renderGraph = (
  container: HTMLElement,
  rawData: { nodes: IFlatNode[]; edges: IFlatEdge[] },
): void => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  const visibleIds = new Set(rawData.nodes.filter(n => VISIBLE_NODE_TYPES.has(n.type)).map(n => n.id));
  const rawNodeById = new Map(rawData.nodes.map(n => [n.id, n]));
  const data = {
    nodes: rawData.nodes.filter(n => visibleIds.has(n.id)),
    edges: rawData.edges.filter(e => {
      if (HIDDEN_EDGE_TYPES.has(e.type)) return false;
      if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return false;
      if (e.type === 'parent') {
        const sourceType = rawNodeById.get(e.source)?.type;
        // Drop parent edges from transitions and terms: transitions live on their own midpoint;
        // terms are anchored to entity via the radial force (no visible line — stardust effect).
        if (sourceType === 'transition' || sourceType === 'term') return false;
      }

      return true;
    }),
  };

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('background', BG);

  const defs = svg.append('defs');
  // Strong entity glow — multi-layered neon halo
  const glow = defs.append('filter')
    .attr('id', 'glow')
    .attr('x', '-300%').attr('y', '-300%')
    .attr('width', '700%').attr('height', '700%');
  glow.append('feGaussianBlur').attr('stdDeviation', 22).attr('result', 'huge-blur');
  glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 10).attr('result', 'big-blur');
  glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 4).attr('result', 'mid-blur');
  glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 1.5).attr('result', 'small-blur');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'huge-blur');
  merge.append('feMergeNode').attr('in', 'big-blur');
  merge.append('feMergeNode').attr('in', 'big-blur');
  merge.append('feMergeNode').attr('in', 'mid-blur');
  merge.append('feMergeNode').attr('in', 'small-blur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  defs.append('marker')
    .attr('id', 'trans-arrow')
    .attr('viewBox', '-4 -4 8 8')
    .attr('refX', 3)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .attr('markerUnits', 'userSpaceOnUse')
    .append('path')
    .attr('d', 'M-3,-3 L3,0 L-3,3 Z')
    .attr('fill', 'context-stroke');

  const softGlow = defs.append('filter')
    .attr('id', 'soft-glow')
    .attr('x', '-200%').attr('y', '-200%')
    .attr('width', '500%').attr('height', '500%');
  softGlow.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'blur');
  softGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 1.2).attr('result', 'tight');
  const merge2 = softGlow.append('feMerge');
  merge2.append('feMergeNode').attr('in', 'blur');
  merge2.append('feMergeNode').attr('in', 'blur');
  merge2.append('feMergeNode').attr('in', 'blur');
  merge2.append('feMergeNode').attr('in', 'tight');
  merge2.append('feMergeNode').attr('in', 'SourceGraphic');

  // Luminous radial gradient per unique node color: white core → that color at edge.
  // (currentColor in <defs> gradients doesn't resolve to the element using the gradient, so we
  // generate a separate gradient for every unique color used.)
  const luminousIdForColor = new Map<string, string>();
  const ensureLuminousGradient = (color: string): string => {
    const existing = luminousIdForColor.get(color);
    if (existing) return existing;
    const id = `lum-${color.replace(/[^a-z0-9]/gi, '')}`;
    luminousIdForColor.set(color, id);
    const g = defs.append('radialGradient')
      .attr('id', id)
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');
    g.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.95);
    g.append('stop').attr('offset', '28%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.35);
    g.append('stop').attr('offset', '60%').attr('stop-color', color).attr('stop-opacity', 0.9);
    g.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 1);

    return id;
  };

  // Term glow — extra bloom for tiny stardust dots, so they remain visible when zoomed out
  const termGlow = defs.append('filter')
    .attr('id', 'term-glow')
    .attr('x', '-400%').attr('y', '-400%')
    .attr('width', '900%').attr('height', '900%');
  termGlow.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'tg-big');
  termGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 1.5).attr('result', 'tg-mid');
  termGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 0.5).attr('result', 'tg-tight');
  const mergeTerm = termGlow.append('feMerge');
  mergeTerm.append('feMergeNode').attr('in', 'tg-big');
  mergeTerm.append('feMergeNode').attr('in', 'tg-big');
  mergeTerm.append('feMergeNode').attr('in', 'tg-mid');
  mergeTerm.append('feMergeNode').attr('in', 'tg-mid');
  mergeTerm.append('feMergeNode').attr('in', 'tg-tight');
  mergeTerm.append('feMergeNode').attr('in', 'SourceGraphic');

  // SoftwareONE brand gradient — teal → primary blue → deep indigo, ≈259deg CSS direction.
  const brandGrad = defs.append('linearGradient')
    .attr('id', 'so-brand-gradient')
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', 320).attr('y1', -60)
    .attr('x2', -320).attr('y2', 60);
  brandGrad.append('stop').attr('offset', '16.32%').attr('stop-color', '#00c9cd');
  brandGrad.append('stop').attr('offset', '59.03%').attr('stop-color', '#3366ff');
  brandGrad.append('stop').attr('offset', '99.99%').attr('stop-color', '#392d9c');

  // Risk dot fill — radial gradient: opaque red core fading to fully transparent at the edge.
  // Combined with per-circle fill-opacity, severity reads as a soft glowing pin-point.
  const riskGrad = defs.append('radialGradient')
    .attr('id', 'risk-radial')
    .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
  riskGrad.append('stop').attr('offset', '0%').attr('stop-color', RISK_COLOR).attr('stop-opacity', 1);
  riskGrad.append('stop').attr('offset', '50%').attr('stop-color', RISK_COLOR).attr('stop-opacity', 0.8);
  riskGrad.append('stop').attr('offset', '100%').attr('stop-color', RISK_COLOR).attr('stop-opacity', 0);

  // Edge glow — subtle bloom along transition lines and pills
  const edgeGlow = defs.append('filter')
    .attr('id', 'edge-glow')
    .attr('x', '-100%').attr('y', '-100%')
    .attr('width', '300%').attr('height', '300%');
  edgeGlow.append('feGaussianBlur').attr('stdDeviation', 2).attr('result', 'eblur');
  edgeGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 0.6).attr('result', 'etight');
  const merge3 = edgeGlow.append('feMerge');
  merge3.append('feMergeNode').attr('in', 'eblur');
  merge3.append('feMergeNode').attr('in', 'eblur');
  merge3.append('feMergeNode').attr('in', 'etight');
  merge3.append('feMergeNode').attr('in', 'SourceGraphic');

  const root = svg.append('g');
  const zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.05, 8])
    .on('zoom', e => root.attr('transform', e.transform));
  svg.call(zoomBehaviour);

  const nodeById = new Map(data.nodes.map(n => [n.id, n]));
  const resolveNamespace = (id: string): string | undefined => {
    let cur: string | undefined = id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const n = nodeById.get(cur);
      if (!n) return undefined;
      if (n.namespace) return n.namespace;
      cur = n.parentId;
    }

    return undefined;
  };

  const colorFor = (n: IFlatNode): string => {
    const ns = resolveNamespace(n.id);
    const moduleColor = ns ? (MODULE_COLORS[ns] ?? MODULE_COLORS._) : NODE_DEFAULT_COLORS[n.type];
    if (n.type === 'domain') return d3.color(NODE_DEFAULT_COLORS.domain)?.brighter(0.6).formatHex() ?? NODE_DEFAULT_COLORS.domain;
    if (n.type === 'transition') return '#e6edf3';
    if (n.type === 'term') return '#ffffff'; // whitish — stardust
    if (n.type === 'risk') return RISK_COLOR; // unified red — intensity comes from size/opacity
    // Constraints inherit the parent entity's module color (resolveNamespace walks parent chain).
    if (n.type === 'entity' || n.type === 'state' || n.type === 'constraint') {
      return d3.color(moduleColor)?.brighter(0.7).formatHex() ?? moduleColor;
    }

    return moduleColor;
  };

  const nodes: ISimNode[] = data.nodes.map((n, i) => {
    const angle = (i / data.nodes.length) * 2 * Math.PI;
    const radius = 400 + Math.random() * 400;

    return {
      ...n,
      color: colorFor(n),
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
  const simNodeById = new Map(nodes.map(n => [n.id, n]));

  // Build transition lines from raw data (transition nodes themselves aren't rendered)
  const transitionEndpoints = new Map<string, { from?: string; to?: string }>();
  for (const e of rawData.edges) {
    if (e.type !== 'transition') continue;
    const cur = transitionEndpoints.get(e.source) ?? {};
    if (e.pointer === 'from') cur.from = e.target;
    if (e.pointer === 'to') cur.to = e.target;
    transitionEndpoints.set(e.source, cur);
  }

  interface ITransitionLine {
    transitionId: string;
    fromId: string;
    toId: string;
    label: string;
  }
  const rawNodeLabel = new Map(rawData.nodes.map(n => [n.id, n.label]));
  const transitionLines: ITransitionLine[] = [];
  for (const [tid, ep] of transitionEndpoints) {
    if (!ep.from || !ep.to) continue;
    if (ep.from === ep.to) continue; // self-loops aren't rendered as graph edges
    if (!simNodeById.has(ep.from) || !simNodeById.has(ep.to)) continue;
    transitionLines.push({
      transitionId: tid,
      fromId: ep.from,
      toId: ep.to,
      label: rawNodeLabel.get(tid) ?? '',
    });
  }

  // Force-link edges: exclude transitions (rendered as state-to-state lines) and dependencies
  // (rendered as decorative cross-entity arcs that don't pull anything).
  const edges: ISimEdge[] = data.edges
    .filter(e => e.type !== 'transition' && e.type !== 'dependency')
    .map(e => ({ source: e.source, target: e.target, type: e.type }));

  interface IDependencyLine {
    id: string;
    fromId: string;
    toId: string;
  }
  const dependencyLines: IDependencyLine[] = data.edges
    .filter(e => e.type === 'dependency' && e.pointer === 'depends-on' && simNodeById.has(e.source) && simNodeById.has(e.target))
    .map((e, i) => ({ id: `dep-${i}`, fromId: e.source, toId: e.target }));

  // Group states by their parent entity for cluster-shape forces
  const stateGroups = new Map<string, ISimNode[]>();
  for (const n of nodes) {
    if (n.type !== 'state' || !n.parentId) continue;
    if (!stateGroups.has(n.parentId)) stateGroups.set(n.parentId, []);
    stateGroups.get(n.parentId)!.push(n);
  }

  // Force: arrange states for an entity as a ring around their own cluster centroid,
  // and pull the whole cluster to a fixed offset from the entity.
  // Pill geometry (declared early so the min-length force closure can reference it)
  const PILL_FONT_SIZE = 4;
  const PILL_FONT_FAMILY = 'Menlo, "SF Mono", Consolas, monospace';
  // Monospace gives predictable character width; Menlo ~0.62 of font size
  const pillCharW = PILL_FONT_SIZE * 0.62;
  const PILL_PAD_X = 3;
  const PILL_HEIGHT = PILL_FONT_SIZE + 2;
  const PILL_CHEVRON = 3;
  const pillWidth = (label: string): number => Math.max(8, label.length * pillCharW + PILL_PAD_X * 2);
  const pillPath = (w: number): string => {
    const r = PILL_HEIGHT / 2;

    return `M 0,${-r} L ${w},${-r} L ${w + PILL_CHEVRON},0 L ${w},${r} L 0,${r} A ${r},${r} 0 0 1 0,${-r} Z`;
  };

  const transitionByPair = new Map<string, ITransitionLine>();
  for (const tl of transitionLines) transitionByPair.set(`${tl.fromId}::${tl.toId}`, tl);
  const reverseLabelByTid = new Map<string, string>();
  for (const tl of transitionLines) {
    const reverse = transitionByPair.get(`${tl.toId}::${tl.fromId}`);
    if (reverse) reverseLabelByTid.set(tl.transitionId, reverse.label ?? '');
  }

  // Force: ensure transition arrows are at least as long as their label text,
  // so the label fits along the line. If line is too short, push FROM/TO apart along the line.
  const transitionMinLengthForce = (strength: number) => {
    const force = (alpha: number): void => {
      for (const tl of transitionLines) {
        if (!tl.label) continue;
        const reverseLabel = reverseLabelByTid.get(tl.transitionId) ?? '';
        const ownPillFull = pillWidth(tl.label) + PILL_CHEVRON;
        const reversePillFull = reverseLabel ? pillWidth(reverseLabel) + PILL_CHEVRON : 0;
        // From pill chevron tip to FAR state edge must be ≥ 50px.
        // Line: [state radius][startOffset gap][pill+chevron][...][50px][state radius]
        const startOffset = NODE_SIZE.state + 10;
        const ownTipToFar = NODE_SIZE.state + 50 + startOffset + ownPillFull;
        const reverseTipToFar = reverseLabel
          ? NODE_SIZE.state + 50 + startOffset + reversePillFull
          : 0;
        // For bidirectional, also require the two pills not to collide in the middle
        // (and have at least 50px gap between their tips).
        const noOverlap = reverseLabel
          ? 2 * startOffset + ownPillFull + reversePillFull + 50
          : 0;
        const minLen = Math.max(ownTipToFar, reverseTipToFar, noOverlap);
        const from = simNodeById.get(tl.fromId);
        const to = simNodeById.get(tl.toId);
        if (!from || !to) continue;
        const fx = from.x ?? 0;
        const fy = from.y ?? 0;
        const tx = to.x ?? 0;
        const ty = to.y ?? 0;
        const dx = tx - fx;
        const dy = ty - fy;
        const len = Math.hypot(dx, dy) || 0.0001;
        if (len >= minLen) continue;
        const need = minLen - len;
        const ux = dx / len;
        const uy = dy / len;
        const push = (need / 2) * strength * alpha;
        from.vx = (from.vx ?? 0) - ux * push;
        from.vy = (from.vy ?? 0) - uy * push;
        to.vx = (to.vx ?? 0) + ux * push;
        to.vy = (to.vy ?? 0) + uy * push;
      }
    };

    return force;
  };

  // Each state is locked to a fixed angular slot around its parent entity.
  // Initials → west arc, terminals → east arc, middle → north/south arcs.
  const stateTargetAngle = new Map<string, number>();
  for (const [, group] of stateGroups) {
    if (group.length === 0) continue;
    const initials = group.filter(m => m.isInitial && !m.isTerminal);
    const terminals = group.filter(m => m.isTerminal && !m.isInitial);
    const middles = group.filter(m => !(m.isInitial && !m.isTerminal) && !(m.isTerminal && !m.isInitial));
    // West arc: from 3π/4 (bottom-left) to 5π/4 (top-left) — but using -π/2 as top in our convention
    // Our angles: 0 = east (right), π/2 = south (down), π = west (left), -π/2 = north (up)
    // West arc spans angle from π - SPREAD/2 to π + SPREAD/2 (centered at π = west)
    // East arc centered at 0
    const placeArc = (states: ISimNode[], centerAngle: number, spread: number): void => {
      const n = states.length;
      if (n === 0) return;
      if (n === 1) {
        stateTargetAngle.set(states[0].id, centerAngle);

        return;
      }
      const start = centerAngle - spread / 2;
      states.forEach((s, i) => {
        const a = start + (i / (n - 1)) * spread;
        stateTargetAngle.set(s.id, a);
      });
    };
    const westCenter = Math.PI;
    const eastCenter = 0;
    const westSpread = Math.min(Math.PI * 0.7, Math.max(Math.PI * 0.2, initials.length * 0.45));
    const eastSpread = Math.min(Math.PI * 0.7, Math.max(Math.PI * 0.2, terminals.length * 0.45));
    placeArc(initials, westCenter, westSpread);
    placeArc(terminals, eastCenter, eastSpread);
    // Middles split between north and south arcs around top/bottom
    if (middles.length > 0) {
      const topCount = Math.ceil(middles.length / 2);
      const top = middles.slice(0, topCount);
      const bottom = middles.slice(topCount);
      const topSpread = Math.min(Math.PI * 0.5, Math.max(Math.PI * 0.15, top.length * 0.4));
      const bottomSpread = Math.min(Math.PI * 0.5, Math.max(Math.PI * 0.15, bottom.length * 0.4));
      placeArc(top, -Math.PI / 2, topSpread);
      placeArc(bottom, Math.PI / 2, bottomSpread);
    }
  }
  const stateRingForce = (strength: number) => {
    const force = (alpha: number): void => {
      for (const [entityId, group] of stateGroups) {
        if (group.length === 0) continue;
        const entity = simNodeById.get(entityId);
        if (!entity || entity.x === undefined) continue;
        const ex = entity.x ?? 0;
        const ey = entity.y ?? 0;
        for (const m of group) {
          const a = stateTargetAngle.get(m.id);
          if (a === undefined) continue;
          const targetX = ex + STATE_ORBIT_R * Math.cos(a);
          const targetY = ey + STATE_ORBIT_R * Math.sin(a);
          m.vx = (m.vx ?? 0) + (targetX - (m.x ?? 0)) * strength * alpha;
          m.vy = (m.vy ?? 0) + (targetY - (m.y ?? 0)) * strength * alpha;
        }
      }
    };

    return force;
  };

  // Per-entity weight = count of its own child nodes (states + terms + constraints).
  // Used to bias the layout: heavyweight entities anchor near center, lightweight ones drift out.
  const entityWeight = new Map<string, number>();
  for (const n of nodes) {
    if (n.type === 'entity') entityWeight.set(n.id, 0);
  }
  for (const n of nodes) {
    if (n.parentId && entityWeight.has(n.parentId)) {
      entityWeight.set(n.parentId, (entityWeight.get(n.parentId) ?? 0) + 1);
    }
  }

  // Pin the domain node at the origin — the marketplace label sits at the gravitational center.
  const domainNode = nodes.find(n => n.type === 'domain');
  if (domainNode) {
    domainNode.fx = 0;
    domainNode.fy = 0;
    domainNode.x = 0;
    domainNode.y = 0;
  }

  // Hard exclusion zone around the domain decoration — kept generous so the logo always sits
  // in a clear "halo" of empty space, independent of the visual ring size.
  const DOMAIN_EXCLUSION_R = 600;

  // Minimum entity-to-entity separation: sized so the outer constraint fences (orbit + shuffle)
  // on adjacent clusters don't touch, plus a breathing gap.
  const outerRadius = (PARENT_ORBIT_R.constraint ?? STATE_ORBIT_R) + CONSTRAINT_SHUFFLE;
  const ENTITY_MIN_SEPARATION = outerRadius * 2 + 240;

  // Group entities by namespace (module). Each module gets a "centroid" position at a fixed
  // angle around the domain; entities then orbit their module centroid on a local ring.
  // Hierarchy: domain → module centroids → entities.
  const entitiesByModule = new Map<string, ISimNode[]>();
  for (const n of nodes) {
    if (n.type !== 'entity') continue;
    const mod = (n.namespace ?? '_');
    if (!entitiesByModule.has(mod)) entitiesByModule.set(mod, []);
    entitiesByModule.get(mod)!.push(n);
  }
  const MODULE_ORDER = ['Accounts', 'Commerce', 'Catalog', 'Notifications'];
  const moduleQueue = [
    ...MODULE_ORDER.filter(m => entitiesByModule.has(m)),
    ...[...entitiesByModule.keys()].filter(m => !MODULE_ORDER.includes(m)),
  ];
  // Packing radius: the actual hex-packing area entities need at ENTITY_MIN_SEPARATION
  // (theoretical minimum disc for N circles in a circle). Used for centroid placement and
  // angular allocation — this is where entities really sit.
  const modulePackingRadius = (n: number): number => {
    if (n <= 1) return 0;
    return ENTITY_MIN_SEPARATION * Math.sqrt(n) * 0.55;
  };
  // Zone radius (containment): packing radius + breathing buffer. The buffer is "outward"
  // breathing room — on the inner side the domain-exclusion force naturally clips the disc.
  const moduleZoneRadius = (n: number): number => {
    if (n <= 1) return 0;
    return modulePackingRadius(n) + 240; // matches the inter-cluster gap from ENTITY_MIN_SEPARATION
  };

  // First pass: per-module packingR, zoneR, centroid distance and the angle subtended at origin.
  // d = exclusion + packingR puts the innermost entity flush against the domain halo. The
  // containment zone extends outward past the packed area (and theoretically inward past the
  // halo, but domain-exclusion blocks entities from going there).
  const zoneRForModule = new Map<string, number>();
  const moduleDistance = new Map<string, number>();
  const angularExtent = new Map<string, number>();
  for (const mod of moduleQueue) {
    const group = entitiesByModule.get(mod) ?? [];
    const packR = modulePackingRadius(group.length);
    const zoneR = moduleZoneRadius(group.length);
    const d = DOMAIN_EXCLUSION_R + packR;
    zoneRForModule.set(mod, zoneR);
    moduleDistance.set(mod, d);
    // Angular extent uses packing radius (the actual occupied disc), not the looser containment.
    angularExtent.set(mod, packR > 0 ? 2 * Math.asin(Math.min(0.99, packR / d)) : 0);
  }

  // Distribute angles dynamically: each module gets its own subtended angle plus a proportional
  // share of the leftover gap. Big modules take a wide arc; tiny modules a slim slot. Packs the
  // canvas more efficiently than fixed cardinal directions.
  const totalExtent = [...angularExtent.values()].reduce((s, e) => s + e, 0);
  const minGapBetween = 0.18; // rad — minimum padding between adjacent modules
  const totalMinGap = minGapBetween * moduleQueue.length;
  const extraGapShare = Math.max(0, (2 * Math.PI - totalMinGap - totalExtent) / moduleQueue.length);
  const gapPerSlot = minGapBetween + extraGapShare;

  const moduleAngle = new Map<string, number>();
  {
    let cursor = -Math.PI / 2; // start at the top
    for (const mod of moduleQueue) {
      const ext = angularExtent.get(mod) ?? 0;
      cursor += gapPerSlot / 2;
      moduleAngle.set(mod, cursor + ext / 2);
      cursor += ext + gapPerSlot / 2;
    }
  }

  // Compute centroid positions and per-entity targets (all entities of a module → centroid).
  const entityTargetXY = new Map<string, { x: number; y: number }>();
  const moduleCentroid = new Map<string, { x: number; y: number; r: number; angle: number; zoneR: number }>();
  for (const mod of moduleQueue) {
    const group = entitiesByModule.get(mod) ?? [];
    if (group.length === 0) continue;
    const angle = moduleAngle.get(mod) ?? 0;
    const d = moduleDistance.get(mod) ?? DOMAIN_EXCLUSION_R;
    const zoneR = zoneRForModule.get(mod) ?? 0;
    const cmx = Math.cos(angle) * d;
    const cmy = Math.sin(angle) * d;
    moduleCentroid.set(mod, { x: cmx, y: cmy, r: d, angle, zoneR });

    group.forEach(e => {
      entityTargetXY.set(e.id, { x: cmx, y: cmy });
    });
  }

  const domainExclusionForce = (strength: number) => {
    let arr: ISimNode[] = [];
    const force = (alpha: number): void => {
      for (const n of arr) {
        if (n.type !== 'entity') continue;
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        const r = Math.hypot(x, y) || 0.0001;
        if (r >= DOMAIN_EXCLUSION_R) continue;
        const need = DOMAIN_EXCLUSION_R - r;
        const ux = x / r;
        const uy = y / r;
        n.vx = (n.vx ?? 0) + ux * need * strength * alpha;
        n.vy = (n.vy ?? 0) + uy * need * strength * alpha;
      }
    };
    force.initialize = (n: ISimNode[]): void => { arr = n; };

    return force;
  };

  // Map: entity id → its module's centroid and zoneR (used by module-containment force).
  const entityModuleInfo = new Map<string, { cx: number; cy: number; zoneR: number }>();
  for (const mod of moduleQueue) {
    const group = entitiesByModule.get(mod) ?? [];
    const cm = moduleCentroid.get(mod);
    if (!cm) continue;
    for (const e of group) {
      entityModuleInfo.set(e.id, { cx: cm.x, cy: cm.y, zoneR: cm.zoneR });
    }
  }

  // Soft wall at the module's disc boundary. Entities are free to roam inside the disc;
  // they only feel a force when they try to leave it. Combined with entity-repulsion this
  // produces a packed disc instead of all entities collapsing onto the centroid.
  const moduleContainmentForce = (strength: number) => {
    let arr: ISimNode[] = [];
    const force = (alpha: number): void => {
      for (const n of arr) {
        if (n.type !== 'entity') continue;
        const info = entityModuleInfo.get(n.id);
        if (!info) continue;
        const dx = (n.x ?? 0) - info.cx;
        const dy = (n.y ?? 0) - info.cy;
        const d = Math.hypot(dx, dy) || 0.0001;
        if (d <= info.zoneR) continue;
        const need = d - info.zoneR;
        const ux = dx / d;
        const uy = dy / d;
        n.vx = (n.vx ?? 0) - ux * need * strength * alpha;
        n.vy = (n.vy ?? 0) - uy * need * strength * alpha;
      }
    };
    force.initialize = (n: ISimNode[]): void => { arr = n; };

    return force;
  };

  // Centroid layout means each entity has an explicit 2D target — pull toward it directly.
  const entityTargetForce = (strength: number) => {
    let arr: ISimNode[] = [];
    const force = (alpha: number): void => {
      for (const n of arr) {
        if (n.type !== 'entity') continue;
        const tgt = entityTargetXY.get(n.id);
        if (!tgt) continue;
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        n.vx = (n.vx ?? 0) + (tgt.x - x) * strength * alpha;
        n.vy = (n.vy ?? 0) + (tgt.y - y) * strength * alpha;
      }
    };
    force.initialize = (n: ISimNode[]): void => { arr = n; };

    return force;
  };

  // Custom force: entity-entity hard separation (so clusters don't overlap).
  const entityRepulsionForce = (strength: number) => {
    let arr: ISimNode[] = [];
    const force = (alpha: number): void => {
      const ents = arr.filter(n => n.type === 'entity');
      for (let i = 0; i < ents.length; i++) {
        const a = ents[i];
        for (let j = i + 1; j < ents.length; j++) {
          const b = ents[j];
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const dist = Math.hypot(dx, dy) || 0.0001;
          if (dist >= ENTITY_MIN_SEPARATION) continue;
          const need = (ENTITY_MIN_SEPARATION - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          const push = need * strength * alpha;
          a.vx = (a.vx ?? 0) - ux * push;
          a.vy = (a.vy ?? 0) - uy * push;
          b.vx = (b.vx ?? 0) + ux * push;
          b.vy = (b.vy ?? 0) + uy * push;
        }
      }
    };
    force.initialize = (n: ISimNode[]): void => { arr = n; };

    return force;
  };

  // Assign each term/constraint a fixed angular slot around its parent entity, evenly spread on
  // its respective low orbit. Plus a deterministic per-node radial shuffle so the ring looks
  // like a "cloud" rather than a perfect circle.
  const orbitTargetAngle = new Map<string, number>();
  const orbitRadiusOffset = new Map<string, number>();
  const hashStr = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;

    return Math.abs(h);
  };
  const assignOrbitSlots = (type: TNodeType, shufflePx: number): void => {
    const byParent = new Map<string, ISimNode[]>();
    for (const n of nodes) {
      if (n.type !== type || !n.parentId) continue;
      if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
      byParent.get(n.parentId)!.push(n);
    }
    for (const [, group] of byParent) {
      const N = group.length;
      group.forEach((t, i) => {
        const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI;
        orbitTargetAngle.set(t.id, angle);
        const offset = ((hashStr(t.id) % 1000) / 1000 - 0.5) * shufflePx;
        orbitRadiusOffset.set(t.id, offset);
      });
    }
  };
  assignOrbitSlots('term', 21);
  // Constraint orbit sits OUTSIDE the state ring — wobbly enough to look like an organic fence.
  assignOrbitSlots('constraint', CONSTRAINT_SHUFFLE);
  // Risk orbit sits just inside the constraints — same clean-circle treatment, no fence.
  assignOrbitSlots('risk', 0);

  // Pull each term/constraint to its fixed angular slot at the parent's low/mid orbit.
  const radialAroundParent = () => {
    let arr: ISimNode[] = [];
    const force = (alpha: number): void => {
      for (const t of arr) {
        if (!t.parentId) continue;
        const baseR = PARENT_ORBIT_R[t.type];
        if (!baseR) continue;
        const p = simNodeById.get(t.parentId);
        if (!p || p.x === undefined || p.y === undefined) continue;
        const angle = orbitTargetAngle.get(t.id);
        if (angle === undefined) continue;
        const r = baseR + (orbitRadiusOffset.get(t.id) ?? 0);
        const targetX = (p.x ?? 0) + r * Math.cos(angle);
        const targetY = (p.y ?? 0) + r * Math.sin(angle);
        t.vx = (t.vx ?? 0) + (targetX - (t.x ?? 0)) * 1.8 * alpha;
        t.vy = (t.vy ?? 0) + (targetY - (t.y ?? 0)) * 1.8 * alpha;
      }
    };
    force.initialize = (n: ISimNode[]): void => { arr = n; };

    return force;
  };

  const chargeStrength = (n: ISimNode): number => {
    switch (n.type) {
      case 'term': return -45;
      case 'constraint': return -30;
      case 'risk': return -30;
      case 'transition': return -8;
      case 'state': return -300;
      case 'action': return -160;
      case 'entity': return -3500;
      case 'domain': return -4000;
      default: return -100;
    }
  };

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink<ISimNode, ISimEdge>(edges)
      .id(d => d.id)
      .distance(d => {
        const sType = (d.source as ISimNode).type;
        const tType = (d.target as ISimNode).type;
        if (sType === 'term' || tType === 'term') return 26;
        if (sType === 'state' || tType === 'state') return 160;
        // entity↔domain: don't fix at a single distance — peripheral bias decides the radius.
        if (sType === 'domain' || tType === 'domain') return 700;

        return 200;
      })
      .strength(d => {
        const sType = (d.source as ISimNode).type;
        const tType = (d.target as ISimNode).type;
        if (sType === 'term' || tType === 'term') return 0.7;
        if (sType === 'state' || tType === 'state') return 0.04;
        // Almost no pull — peripheral bias is the dominant radial force for entities.
        if (sType === 'domain' || tType === 'domain') return 0.02;

        return 0.25;
      }))
    .force('charge', d3.forceManyBody<ISimNode>().strength(chargeStrength))
    .force('collide', d3.forceCollide<ISimNode>(d => {
      if (d.type === 'state') return 24;
      if (d.type === 'term') return 4;
      if (d.type === 'constraint') return 4;
      if (d.type === 'risk') return 4;
      // Entities use a custom entity-entity repulsion (below), not the global collide,
      // so terms aren't pushed outside their parent entity's cluster.
      if (d.type === 'entity') return 0;

      return NODE_SIZE[d.type] + 3;
    }))
    // No forceCenter — explicit entity targets + domain pinning handle centring. forceCenter
    // would shift the whole graph to balance node mass, which breaks the centroid layout when
    // modules have very different entity counts.
    .force('parent-radial', radialAroundParent())
    .force('state-ring', stateRingForce(1.4))
    .force('entity-repulsion', entityRepulsionForce(3.5))
    .force('domain-exclusion', domainExclusionForce(1.5))
    .force('entity-target', entityTargetForce(0.04))
    .force('module-containment', moduleContainmentForce(2.5))
    .force('trans-min-length', transitionMinLengthForce(0.15))
    .alphaDecay(0.05);

  // Pre-tick to near-stable state before first render
  simulation.tick(300);

  // Per-edge linear gradient. Colour comes from the *owned* end (source / child) — each owned
  // entity stamps its identity onto its tether. The gradient brightens toward the owner end so
  // the direction of ownership reads visually.
  const ownershipGradId = (i: number): string => `own-grad-${i}`;
  const ownershipGradSel = defs.selectAll<SVGLinearGradientElement, ISimEdge>('linearGradient.own-grad')
    .data(edges)
    .join('linearGradient')
    .attr('class', 'own-grad')
    .attr('id', (_, i) => ownershipGradId(i))
    .attr('gradientUnits', 'userSpaceOnUse');
  ownershipGradSel.each(function (d) {
    const srcId = typeof d.source === 'string' ? d.source : d.source.id;
    const src = simNodeById.get(srcId);
    const ownedColor = src?.color ?? EDGE_COLOR;
    const g = d3.select(this);
    g.selectAll('stop').remove();
    // 0% = source end (owned, faint) → 100% = target end (owner, bright)
    g.append('stop').attr('offset', '0%').attr('stop-color', ownedColor).attr('stop-opacity', 0.55);
    g.append('stop').attr('offset', '100%').attr('stop-color', ownedColor).attr('stop-opacity', 1);
  });
  const linkSel = root.append('g')
    .attr('class', 'links')
    .selectAll<SVGLineElement, ISimEdge>('line')
    .data(edges)
    .join('line')
    .attr('stroke', (_, i) => `url(#${ownershipGradId(i)})`)
    .attr('stroke-width', 1.4);

  // Dependency arcs — inter-entity wormholes with a "depends on" pill at the midpoint.
  const DEPENDENCY_STROKE = '#22d3ee';
  const DEP_PULL = 0.15; // 0 = straight line; higher = more curved
  const dependencyLineSel = root.append('g')
    .attr('class', 'dependency-arcs')
    .attr('filter', 'url(#edge-glow)')
    .selectAll<SVGPathElement, IDependencyLine>('path')
    .data(dependencyLines)
    .join('path')
    .attr('stroke', DEPENDENCY_STROKE)
    .attr('stroke-width', 0.7)
    .attr('stroke-opacity', 0.55)
    .attr('fill', 'none');

  const depLabel = 'depends on';
  const depPillW = pillWidth(depLabel);
  const dependencyPillSel = root.append('g')
    .attr('class', 'dependency-pills')
    .attr('filter', 'url(#edge-glow)')
    .selectAll<SVGGElement, IDependencyLine>('g')
    .data(dependencyLines)
    .join('g');
  dependencyPillSel.append('path')
    .attr('d', pillPath(depPillW))
    .attr('fill', BG)
    .attr('stroke', DEPENDENCY_STROKE)
    .attr('stroke-width', 0.7)
    .attr('stroke-opacity', 0.9);
  dependencyPillSel.append('text')
    .attr('font-size', PILL_FONT_SIZE)
    .attr('font-family', PILL_FONT_FAMILY)
    .attr('fill', '#e6edf3')
    .attr('pointer-events', 'none')
    .attr('x', PILL_PAD_X)
    .attr('y', 0)
    .attr('dominant-baseline', 'central')
    .text(depLabel);

  // Constraint fence: thin closed polyline connecting each entity's constraints in angular order.
  // Looks like a wobbly enclosing wall around the entity's state cluster.
  const constraintsByEntity = new Map<string, ISimNode[]>();
  for (const n of nodes) {
    if (n.type !== 'constraint' || !n.parentId) continue;
    if (!constraintsByEntity.has(n.parentId)) constraintsByEntity.set(n.parentId, []);
    constraintsByEntity.get(n.parentId)!.push(n);
  }
  for (const [, group] of constraintsByEntity) {
    group.sort((a, b) => (orbitTargetAngle.get(a.id) ?? 0) - (orbitTargetAngle.get(b.id) ?? 0));
  }
  const fenceData = [...constraintsByEntity.entries()].filter(([, g]) => g.length >= 2);
  const fenceSel = root.append('g')
    .attr('class', 'constraint-fence')
    .attr('filter', 'url(#edge-glow)')
    .selectAll<SVGPolylineElement, [string, ISimNode[]]>('polyline')
    .data(fenceData)
    .join('polyline')
    .attr('stroke', d => simNodeById.get(d[0])?.color ?? NODE_DEFAULT_COLORS.constraint)
    .attr('stroke-width', 0.3)
    .attr('stroke-opacity', 0.4)
    .attr('fill', 'none');

  // Faint thread from each term to its parent entity, with a fading gradient — gives a
  // "rays around the star" effect (bright near entity → fades to almost invisible at term).
  const termTethers = nodes.filter(n => n.type === 'term' && n.parentId && simNodeById.has(n.parentId));
  const tetherGradientId = (n: ISimNode): string => `tg-${n.id.replace(/[^a-z0-9]/gi, '')}`;
  const tetherGradSel = defs.selectAll<SVGLinearGradientElement, ISimNode>('linearGradient.tether-grad')
    .data(termTethers)
    .join('linearGradient')
    .attr('class', 'tether-grad')
    .attr('id', tetherGradientId)
    .attr('gradientUnits', 'userSpaceOnUse');
  tetherGradSel.each(function () {
    const g = d3.select(this);
    g.selectAll('stop').remove();
    g.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.7);
    g.append('stop').attr('offset', '100%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.25);
  });
  const termTetherSel = root.append('g')
    .attr('class', 'term-tethers')
    .selectAll<SVGLineElement, ISimNode>('line')
    .data(termTethers)
    .join('line')
    .attr('stroke', d => `url(#${tetherGradientId(d)})`)
    .attr('stroke-width', 0.35);

  // Color of transition line = parent entity's color (state's parent)
  const colorOfTransition = (d: ITransitionLine): string => {
    const from = simNodeById.get(d.fromId);
    const entityId = from?.parentId;
    const entity = entityId ? simNodeById.get(entityId) : undefined;

    return entity?.color ?? '#e6edf3';
  };

  // Per-transition gradients (opacity fades from 1 at FROM end to 0.1 at TO end — laser-ray look)
  const transitionGradientId = (t: ITransitionLine): string => `tgrad-${t.transitionId.replace(/[^a-z0-9]/gi, '')}`;
  const gradientSel = defs.selectAll<SVGLinearGradientElement, ITransitionLine>('linearGradient.trans-grad')
    .data(transitionLines)
    .join('linearGradient')
    .attr('class', 'trans-grad')
    .attr('id', transitionGradientId)
    .attr('gradientUnits', 'userSpaceOnUse');
  gradientSel.each(function (d) {
    const color = colorOfTransition(d);
    const g = d3.select(this);
    g.selectAll('stop').remove();
    g.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 1);
    g.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.1);
  });

  // Transition lines: line FROM->TO with per-line opacity gradient (laser-ray look)
  const transitionLineSel = root.append('g')
    .attr('class', 'transition-lines')
    .attr('filter', 'url(#edge-glow)')
    .selectAll<SVGLineElement, ITransitionLine>('line')
    .data(transitionLines)
    .join('line')
    .attr('stroke', d => `url(#${transitionGradientId(d)})`)
    .attr('stroke-width', 1);

  const fromGroupIndex = new Map<string, number>();
  {
    const groupCounter = new Map<string, number>();
    for (const tl of transitionLines) {
      const idx = groupCounter.get(tl.fromId) ?? 0;
      fromGroupIndex.set(tl.transitionId, idx);
      groupCounter.set(tl.fromId, idx + 1);
    }
  }
  // Label pill (rounded-left, chevron-right) — chevron is the built-in arrow head pointing to TO
  const transitionLabelSel = root.append('g')
    .attr('class', 'transition-labels')
    .attr('filter', 'url(#edge-glow)')
    .selectAll<SVGGElement, ITransitionLine>('g')
    .data(transitionLines.filter(t => !!t.label))
    .join('g');
  // Pill body draws as a "split ray": background-filled interior with stroke matching the
  // transition line, so the line visually wraps around the text and converges at the chevron tip.
  transitionLabelSel.append('path')
    .attr('class', 'pill-bg')
    .attr('d', d => pillPath(pillWidth(d.label)))
    .attr('fill', BG)
    .attr('stroke', colorOfTransition)
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.9);
  transitionLabelSel.append('text')
    .attr('class', 'pill-text')
    .attr('font-size', PILL_FONT_SIZE)
    .attr('font-family', PILL_FONT_FAMILY)
    .attr('fill', '#e6edf3')
    .attr('pointer-events', 'none')
    .attr('x', PILL_PAD_X)
    .attr('y', 0)
    .attr('dominant-baseline', 'central')
    .text(d => d.label);

  // For transitions WITHOUT a label, render a small triangle in the middle as before
  const transitionMidSel = root.append('g')
    .attr('class', 'transition-mid')
    .attr('filter', 'url(#edge-glow)')
    .selectAll<SVGPolygonElement, ITransitionLine>('polygon')
    .data(transitionLines.filter(t => !t.label))
    .join('polygon')
    .attr('points', '-3,-3.5 4.5,0 -3,3.5')
    .attr('fill', colorOfTransition);

  const nodeSel = root.append('g')
    .attr('class', 'nodes')
    .selectAll<SVGCircleElement, ISimNode>('circle')
    .data(nodes.filter(n => n.type !== 'domain'))
    .join('circle')
    .attr('r', d => d.type === 'risk' ? (RISK_LEVEL_SIZE[d.label] ?? NODE_SIZE.risk) : NODE_SIZE[d.type])
    .attr('fill', d => {
      if (d.type === 'entity' || d.type === 'state' || d.type === 'domain') {
        return `url(#${ensureLuminousGradient(d.color)})`;
      }
      if (d.type === 'risk') return 'url(#risk-radial)';

      return d.color;
    })
    .attr('fill-opacity', d => {
      if (d.type === 'risk') return RISK_LEVEL_OPACITY[d.label] ?? 0.6;
      if (d.type === 'term') return 0.95;

      return 1;
    })
    .attr('stroke', 'none')
    .attr('filter', d => {
      if (d.type === 'domain' || d.type === 'entity' || d.type === 'state' || d.type === 'transition') {
        return 'url(#glow)';
      }
      if (d.type === 'term' || d.type === 'constraint' || d.type === 'risk') return 'url(#term-glow)';

      return null;
    })
    .style('cursor', 'grab');

  nodeSel.append('title').text(d => d.tooltip ? `${d.type}: ${d.label}\n${d.tooltip}` : `${d.type}: ${d.label}`);

  // Outer ring (with gap) for initial/terminal states
  const stateRings = nodes.filter(n => n.type === 'state' && (n.isInitial || n.isTerminal));
  const ringSel = root.append('g')
    .attr('class', 'state-rings')
    .selectAll<SVGCircleElement, ISimNode>('circle')
    .data(stateRings)
    .join('circle')
    .attr('r', NODE_SIZE.state + 2)
    .attr('fill', 'none')
    .attr('stroke', d => d.isInitial ? '#22c55e' : '#ef4444')
    .attr('stroke-width', 0.9)
    .attr('stroke-opacity', 1);

  // Domain at the centre — a branded ring with the SoftwareONE gradient and a two-line title
  // right-aligned inside it. Rendered before regular labels so entity labels can sit on top
  // when zoomed in.
  {
    const domainGroup = root.append('g').attr('class', 'domain-decor').attr('filter', 'url(#edge-glow)');
    const RING_R = 220;
    domainGroup.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', RING_R)
      .attr('fill', 'none')
      .attr('stroke', 'url(#so-brand-gradient)')
      .attr('stroke-width', 4)
      .attr('stroke-opacity', 0.9);
    const txt = domainGroup.append('text')
      .attr('text-anchor', 'end')
      .attr('font-family', 'system-ui, -apple-system, "Helvetica Neue", sans-serif')
      .attr('fill', 'url(#so-brand-gradient)')
      .attr('pointer-events', 'none');
    const innerX = RING_R - 28;
    txt.append('tspan')
      .attr('x', innerX)
      .attr('y', -20)
      .attr('font-size', 26)
      .attr('font-weight', 500)
      .attr('letter-spacing', 0.5)
      .attr('fill', '#ffffff')
      .text('SoftwareONE Marketplace');
    txt.append('tspan')
      .attr('x', innerX)
      .attr('y', 36)
      .attr('font-size', 66)
      .attr('font-weight', 800)
      .text('Canon');
  }

  // Labels for entities and states. Domain is rendered separately (ring + branded text).
  const labelSel = root.append('g')
    .attr('class', 'labels')
    .selectAll<SVGTextElement, ISimNode>('text')
    .data(nodes.filter(n => n.type === 'entity' || n.type === 'state'))
    .join('text')
    .attr('font-size', d => d.type === 'entity' ? 22 : 8)
    .attr('font-weight', d => d.type === 'entity' ? 600 : 400)
    .attr('fill', '#e6edf3')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('pointer-events', 'none')
    .text(d => d.label);

  // Term labels — placed radially outward from parent entity. Tiny font, faded, so they don't
  // overpower the picture but read when zoomed in.
  const termLabelNodes = nodes.filter(n => n.type === 'term' && n.parentId);
  const termLabelSel = root.append('g')
    .attr('class', 'term-labels')
    .selectAll<SVGTextElement, ISimNode>('text')
    .data(termLabelNodes)
    .join('text')
    .attr('font-size', 2.6)
    .attr('font-family', PILL_FONT_FAMILY)
    .attr('fill', '#94a3b8')
    .attr('pointer-events', 'none')
    .attr('dominant-baseline', 'central')
    .text(d => d.label);

  // Constraint labels — short canonId / actor on top, then up to two lines of the description
  // (~30 chars each, word-broken). Hints at the rule's content while keeping the dot compact.
  const wrapDesc = (s: string | undefined, charsPerLine = 30, maxLines = 2): string[] => {
    if (!s) return [];
    const trimmed = s.trim();
    if (!trimmed) return [];
    const lines: string[] = [];
    let rest = trimmed;
    while (lines.length < maxLines && rest.length > 0) {
      if (rest.length <= charsPerLine) {
        lines.push(rest);

        return lines;
      }
      let cut = rest.slice(0, charsPerLine);
      const lastSpace = cut.lastIndexOf(' ');
      if (lastSpace > charsPerLine / 2) cut = cut.slice(0, lastSpace);
      lines.push(cut);
      rest = rest.slice(cut.length).trim();
    }
    if (rest.length > 0 && lines.length > 0) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.length + 1 <= charsPerLine
        ? last + '…'
        : last.slice(0, charsPerLine - 1) + '…';
    }

    return lines;
  };
  const constraintLabelNodes = nodes.filter(n => n.type === 'constraint' && n.parentId);
  const constraintLabelSel = root.append('g')
    .attr('class', 'constraint-labels')
    .selectAll<SVGTextElement, ISimNode>('text')
    .data(constraintLabelNodes)
    .join('text')
    .attr('font-family', PILL_FONT_FAMILY)
    .attr('fill', d => d.color)
    .attr('pointer-events', 'none')
    .attr('dominant-baseline', 'central');
  constraintLabelSel.append('tspan')
    .attr('class', 'cl-id')
    .attr('font-size', 2.6)
    .attr('fill-opacity', 0.95)
    .text(d => d.label);
  constraintLabelSel.append('tspan')
    .attr('class', 'cl-desc-1')
    .attr('font-size', 2.0)
    .attr('fill-opacity', 0.6)
    .attr('dy', 2.4)
    .text(d => wrapDesc(d.tooltip)[0] ?? '');
  constraintLabelSel.append('tspan')
    .attr('class', 'cl-desc-2')
    .attr('font-size', 2.0)
    .attr('fill-opacity', 0.55)
    .attr('dy', 2.2)
    .text(d => wrapDesc(d.tooltip)[1] ?? '');

  // Risk labels — same structure as constraints. Overall text opacity scales with severity so
  // low/n/a risks fade into the background and high ones stand out.
  const riskLabelNodes = nodes.filter(n => n.type === 'risk' && n.parentId);
  const riskLabelSel = root.append('g')
    .attr('class', 'risk-labels')
    .selectAll<SVGTextElement, ISimNode>('text')
    .data(riskLabelNodes)
    .join('text')
    .attr('font-family', PILL_FONT_FAMILY)
    .attr('fill', d => d.color)
    .attr('opacity', d => RISK_LEVEL_OPACITY[d.label] ?? 0.6)
    .attr('pointer-events', 'none')
    .attr('dominant-baseline', 'central');
  riskLabelSel.append('tspan')
    .attr('class', 'cl-id')
    .attr('font-size', 2.6)
    .attr('fill-opacity', 0.95)
    .text(d => d.label);
  riskLabelSel.append('tspan')
    .attr('class', 'cl-desc-1')
    .attr('font-size', 2.0)
    .attr('fill-opacity', 0.6)
    .attr('dy', 2.4)
    .text(d => wrapDesc(d.tooltip)[0] ?? '');
  riskLabelSel.append('tspan')
    .attr('class', 'cl-desc-2')
    .attr('font-size', 2.0)
    .attr('fill-opacity', 0.55)
    .attr('dy', 2.2)
    .text(d => wrapDesc(d.tooltip)[1] ?? '');

  const updateDOM = (): void => {
    linkSel.each(function (d, i) {
      const sx = (d.source as ISimNode).x ?? 0;
      const sy = (d.source as ISimNode).y ?? 0;
      const tx = (d.target as ISimNode).x ?? 0;
      const ty = (d.target as ISimNode).y ?? 0;
      const line = this as SVGLineElement;
      line.setAttribute('x1', String(sx));
      line.setAttribute('y1', String(sy));
      line.setAttribute('x2', String(tx));
      line.setAttribute('y2', String(ty));
      // Keep the per-edge gradient aligned with the line so the bright stop stays at the owner end.
      const grad = document.getElementById(ownershipGradId(i));
      if (grad) {
        grad.setAttribute('x1', String(sx));
        grad.setAttribute('y1', String(sy));
        grad.setAttribute('x2', String(tx));
        grad.setAttribute('y2', String(ty));
      }
    });
    const stateR = NODE_SIZE.state;
    transitionLineSel.each(function (d) {
      const from = simNodeById.get(d.fromId);
      const to = simNodeById.get(d.toId);
      if (!from || !to) return;
      const fx = from.x ?? 0;
      const fy = from.y ?? 0;
      const tx = to.x ?? 0;
      const ty = to.y ?? 0;
      const dx = tx - fx;
      const dy = ty - fy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const trim = stateR + 1;
      const x1 = fx + ux * trim;
      const y1 = fy + uy * trim;
      const x2 = tx - ux * trim;
      const y2 = ty - uy * trim;
      const line = this as SVGLineElement;
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      const grad = document.getElementById(transitionGradientId(d));
      if (grad) {
        grad.setAttribute('x1', String(x1));
        grad.setAttribute('y1', String(y1));
        grad.setAttribute('x2', String(x2));
        grad.setAttribute('y2', String(y2));
      }
    });
    const entityR = NODE_SIZE.entity;
    dependencyLineSel.attr('d', d => {
      const from = simNodeById.get(d.fromId);
      const to = simNodeById.get(d.toId);
      if (!from || !to) return null;
      const fx = from.x ?? 0;
      const fy = from.y ?? 0;
      const tx = to.x ?? 0;
      const ty = to.y ?? 0;
      const dx = tx - fx;
      const dy = ty - fy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Trim arc endpoints to entity perimeter — arc starts/ends facing target
      const sx = fx + ux * entityR;
      const sy = fy + uy * entityR;
      const ex = tx - ux * entityR;
      const ey = ty - uy * entityR;
      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2;
      const cx = mx * (1 - DEP_PULL);
      const cy = my * (1 - DEP_PULL);

      return `M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`;
    });

    dependencyPillSel.each(function (d) {
      const from = simNodeById.get(d.fromId);
      const to = simNodeById.get(d.toId);
      if (!from || !to) return;
      const fx = from.x ?? 0;
      const fy = from.y ?? 0;
      const tx = to.x ?? 0;
      const ty = to.y ?? 0;
      const dx = tx - fx;
      const dy = ty - fy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const sx = fx + ux * entityR;
      const sy = fy + uy * entityR;
      const ex = tx - ux * entityR;
      const ey = ty - uy * entityR;
      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2;
      const cx = mx * (1 - DEP_PULL);
      const cy = my * (1 - DEP_PULL);
      // Quadratic bezier midpoint
      const midX = 0.25 * sx + 0.5 * cx + 0.25 * ex;
      const midY = 0.25 * sy + 0.5 * cy + 0.25 * ey;
      const angle = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
      const sel = d3.select(this as SVGGElement);
      // Center the pill on the midpoint (pill body spans local 0..w)
      sel.attr('transform', `translate(${midX - (depPillW / 2 * Math.cos(angle * Math.PI / 180))}, ${midY - (depPillW / 2 * Math.sin(angle * Math.PI / 180))}) rotate(${angle})`);
    });

    transitionLabelSel.each(function (d) {
      const f = simNodeById.get(d.fromId);
      const t = simNodeById.get(d.toId);
      if (!f || !t) return;
      const fx = f.x ?? 0;
      const fy = f.y ?? 0;
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      const dx = tx - fx;
      const dy = ty - fy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const startOffset = NODE_SIZE.state + 10;
      // Pill always sits ON the transition line, centered vertically. Sibling transitions from
      // the same FROM go to different TO states (different angles), so their pills don't collide.
      const originX = fx + ux * startOffset;
      const originY = fy + uy * startOffset;
      const sel = d3.select(this as SVGGElement);
      sel.attr('transform', `translate(${originX}, ${originY}) rotate(${angle})`);
    });
    transitionMidSel.attr('transform', d => {
      const f = simNodeById.get(d.fromId);
      const t = simNodeById.get(d.toId);
      if (!f || !t) return null;
      const fx = f.x ?? 0;
      const fy = f.y ?? 0;
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      const dx = tx - fx;
      const dy = ty - fy;
      const len = Math.hypot(dx, dy) || 1;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const shift = 4;
      const mx = fx + dx * 0.5 + (dx / len) * shift;
      const my = fy + dy * 0.5 + (dy / len) * shift;

      return `translate(${mx}, ${my}) rotate(${angle})`;
    });
    nodeSel
      .attr('cx', d => d.x ?? 0)
      .attr('cy', d => d.y ?? 0);
    ringSel
      .attr('cx', d => d.x ?? 0)
      .attr('cy', d => d.y ?? 0);
    labelSel
      .attr('x', d => d.x ?? 0)
      .attr('y', d => (d.y ?? 0) + NODE_SIZE[d.type] + 12);
    fenceSel.attr('points', d => {
      const group = d[1];
      const pts = group.map(c => `${c.x ?? 0},${c.y ?? 0}`);
      if (pts.length >= 3) pts.push(pts[0]); // close loop
      return pts.join(' ');
    });
    termTetherSel.each(function (d) {
      if (!d.parentId) return;
      const p = simNodeById.get(d.parentId);
      if (!p) return;
      const px = p.x ?? 0;
      const py = p.y ?? 0;
      const tx = d.x ?? 0;
      const ty = d.y ?? 0;
      const dx = tx - px;
      const dy = ty - py;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Start from entity perimeter, end just before the term dot
      const sx = px + ux * (NODE_SIZE.entity + 1);
      const sy = py + uy * (NODE_SIZE.entity + 1);
      const ex = tx - ux * (NODE_SIZE.term + 0.5);
      const ey = ty - uy * (NODE_SIZE.term + 0.5);
      const line = this as SVGLineElement;
      line.setAttribute('x1', String(sx));
      line.setAttribute('y1', String(sy));
      line.setAttribute('x2', String(ex));
      line.setAttribute('y2', String(ey));
      const grad = document.getElementById(tetherGradientId(d));
      if (grad) {
        grad.setAttribute('x1', String(sx));
        grad.setAttribute('y1', String(sy));
        grad.setAttribute('x2', String(ex));
        grad.setAttribute('y2', String(ey));
      }
    });
    termLabelSel.each(function (d) {
      if (!d.parentId) return;
      const p = simNodeById.get(d.parentId);
      if (!p) return;
      const dx = (d.x ?? 0) - (p.x ?? 0);
      const dy = (d.y ?? 0) - (p.y ?? 0);
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const labelDist = dist + 4; // outward of the term dot
      const lx = (p.x ?? 0) + ux * labelDist;
      const ly = (p.y ?? 0) + uy * labelDist;
      const sel = d3.select(this as SVGTextElement);
      sel.attr('x', lx);
      sel.attr('y', ly);
      // Anchor depends on which side of entity the term sits — keeps text away from the cluster
      sel.attr('text-anchor', ux > 0.15 ? 'start' : ux < -0.15 ? 'end' : 'middle');
    });
    const positionSatLabel = (el: SVGTextElement, d: ISimNode, dotR: number): void => {
      if (!d.parentId) return;
      const p = simNodeById.get(d.parentId);
      if (!p) return;
      const dx = (d.x ?? 0) - (p.x ?? 0);
      const dy = (d.y ?? 0) - (p.y ?? 0);
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const labelDist = dist + dotR + 7;
      const lx = (p.x ?? 0) + ux * labelDist;
      const ly = (p.y ?? 0) + uy * labelDist;
      const sel = d3.select(el);
      sel.attr('x', lx);
      sel.attr('y', ly);
      sel.attr('text-anchor', ux > 0.15 ? 'start' : ux < -0.15 ? 'end' : 'middle');
      const desc1 = el.querySelector('.cl-desc-1') as SVGTSpanElement | null;
      const desc2 = el.querySelector('.cl-desc-2') as SVGTSpanElement | null;
      if (desc1) desc1.setAttribute('x', String(lx));
      if (desc2) desc2.setAttribute('x', String(lx));
    };
    constraintLabelSel.each(function (d) {
      positionSatLabel(this as SVGTextElement, d, NODE_SIZE.constraint);
    });
    riskLabelSel.each(function (d) {
      const dotR = RISK_LEVEL_SIZE[d.label] ?? NODE_SIZE.risk;
      positionSatLabel(this as SVGTextElement, d, dotR);
    });
  };
  simulation.on('tick', updateDOM);

  // Children index — used to drag an entity together with its states / terms / constraints /
  // risks. Only the "structural" children (states/terms/constraints/risks) are bundled — child
  // entities (e.g. Product → Item, Parameter, …) drag independently as their own clusters.
  const childrenOf = new Map<string, ISimNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    if (n.type === 'entity' || n.type === 'domain') continue;
    if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
    childrenOf.get(n.parentId)!.push(n);
  }

  // Free drag: dragging an entity moves its whole cluster; dragging a child node moves only it.
  // Positions are pinned (fx/fy) after release so nothing snaps back.
  nodeSel.call(
    d3.drag<SVGCircleElement, ISimNode>()
      .on('start', (_event, d) => {
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        const dx = event.x - (d.x ?? 0);
        const dy = event.y - (d.y ?? 0);
        d.fx = event.x;
        d.fy = event.y;
        d.x = event.x;
        d.y = event.y;
        if (d.type === 'entity') {
          const children = childrenOf.get(d.id) ?? [];
          for (const c of children) {
            c.x = (c.x ?? 0) + dx;
            c.y = (c.y ?? 0) + dy;
            c.fx = c.x;
            c.fy = c.y;
          }
        }
        updateDOM();
      })
      .on('end', (_event, d) => {
        d.fx = d.x;
        d.fy = d.y;
        if (d.type === 'entity') {
          const children = childrenOf.get(d.id) ?? [];
          for (const c of children) {
            c.fx = c.x;
            c.fy = c.y;
          }
        }
      }),
  );

  // Initial fit
  svg.call(
    zoomBehaviour.transform,
    d3.zoomIdentity.translate(width / 2, height / 2).scale(0.6),
  );
};
