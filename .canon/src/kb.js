// In-memory KB over { nodes, refs }. Pure queries — to mutate, rebuild.
// Pointer shape on refs is { role: target | target[] }; the helpers
// below treat both forms uniformly.

// ── pointers ───────────────────────────────────────────────────────

const flatPointers = function* (ref) {
  for (const [role, val] of Object.entries(ref.pointers || {})) {
    if (Array.isArray(val)) {
      for (const t of val) yield { role, target: t };
    } else if (val !== undefined && val !== null) {
      yield { role, target: val };
    }
  }
};

const pointerTargets = (ref) => [...flatPointers(ref)].map(p => p.target);

const matches = (filter, value) => !filter || filter.includes(value);

// ── indexes ────────────────────────────────────────────────────────

const buildIndexes = ({ nodes, refs }) => {
  const byId = new Map();
  const byType = new Map();
  const fromOwner = new Map();   // owner → ref[]
  const toTarget = new Map();    // target → ref[]

  for (const n of nodes) {
    byId.set(n.id, n);
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type).push(n);
  }
  for (const r of refs) {
    if (!fromOwner.has(r.owner)) fromOwner.set(r.owner, []);
    fromOwner.get(r.owner).push(r);
    for (const { target } of flatPointers(r)) {
      if (!toTarget.has(target)) toTarget.set(target, []);
      toTarget.get(target).push(r);
    }
  }
  return { byId, byType, fromOwner, toTarget };
};

// ── find ───────────────────────────────────────────────────────────

const tokenize = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);

const scoreNode = (node, qTokens) => {
  // Higher weight for id/name matches; lower for description / meta.
  const idTokens = tokenize(node.id);
  const nameTokens = tokenize(node.name);
  const aliasTokens = (node.aliases || []).flatMap(tokenize);
  const descTokens = tokenize(node.description);
  const metaText = JSON.stringify(node.meta || {}).toLowerCase();
  let score = 0;
  for (const q of qTokens) {
    if (idTokens.includes(q)) score += 5;
    if (nameTokens.includes(q)) score += 4;
    if (aliasTokens.includes(q)) score += 3;
    if (descTokens.includes(q)) score += 1;
    if (metaText.includes(q)) score += 0.5;
  }
  return score;
};

const find = (idx) => (query, opts = {}) => {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return { hits: [], total: 0 };
  const limit = opts.limit ?? 50;
  const wanted = opts.node;
  const hits = [];
  for (const node of idx.byId.values()) {
    if (wanted && !matches(wanted, node.type)) continue;
    const score = scoreNode(node, qTokens);
    if (score > 0) hits.push({ id: node.id, type: node.type, name: node.name, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, limit), total: hits.length };
};

// ── traversal ──────────────────────────────────────────────────────

const parentOf = (idx) => (id) => {
  const refs = idx.fromOwner.get(id) || [];
  for (const r of refs) {
    if (r.type !== 'parent') continue;
    for (const { role, target } of flatPointers(r)) {
      if (role === 'parent') return idx.byId.get(target) || null;
    }
  }
  return null;
};

const childrenOf = (idx) => (id, opts = {}) => {
  const refs = idx.toTarget.get(id) || [];
  const out = [];
  const seen = new Set();
  for (const r of refs) {
    if (r.type !== 'parent') continue;
    if (!seen.has(r.owner)) {
      const c = idx.byId.get(r.owner);
      if (c && (!opts.node || matches(opts.node, c.type))) {
        out.push(c);
        seen.add(r.owner);
      }
    }
  }
  return out;
};

const ancestorsOf = (idx) => {
  const _parent = parentOf(idx);
  return (id, opts = {}) => {
    const out = [];
    const seen = new Set([id]);
    let cur = id;
    while (cur) {
      const p = _parent(cur);
      if (!p || seen.has(p.id)) break;
      seen.add(p.id);
      if (!opts.node || matches(opts.node, p.type)) out.push(p);
      cur = p.id;
    }
    return out;
  };
};

const descendantsOf = (idx) => {
  const _children = childrenOf(idx);
  return (id, opts = {}) => {
    const out = [];
    const seen = new Set([id]);
    const stack = [id];
    while (stack.length > 0) {
      const cur = stack.pop();
      for (const c of _children(cur)) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        if (!opts.node || matches(opts.node, c.type)) out.push(c);
        stack.push(c.id);
      }
    }
    return out;
  };
};

// ── refs ───────────────────────────────────────────────────────────

const filterRefsBy = (refs, opts, idx) => {
  let result = refs;
  if (opts.ref) result = result.filter(r => matches(opts.ref, r.type));
  if (opts.role) result = result.filter(r => {
    for (const { role } of flatPointers(r)) {
      if (matches(opts.role, role)) return true;
    }
    return false;
  });
  if (opts.node) result = result.filter(r => {
    const owner = idx.byId.get(r.owner);
    if (owner && matches(opts.node, owner.type)) return true;
    for (const { target } of flatPointers(r)) {
      const t = idx.byId.get(target);
      if (t && matches(opts.node, t.type)) return true;
    }
    return false;
  });
  return result;
};

const fromOf = (idx) => (id, refType) => {
  const all = idx.fromOwner.get(id) || [];
  return refType ? all.filter(r => r.type === refType) : all;
};

const toOf = (idx) => (id, refType) => {
  const all = idx.toTarget.get(id) || [];
  return refType ? all.filter(r => r.type === refType) : all;
};

// ── reveal — outgoing refs (+ neighbors) ───────────────────────────

const revealOf = (idx) => (id, opts = {}) => {
  const node = idx.byId.get(id);
  if (!node) return null;

  const depth = opts.depth ?? 0;
  const visited = new Set();
  const refs = [];
  const seenRef = new Set();
  const neighbors = new Map();

  const visit = (cur, d) => {
    if (visited.has(cur)) return;
    visited.add(cur);

    const own = filterRefsBy(idx.fromOwner.get(cur) || [], opts, idx);
    for (const r of own) {
      const key = `${r.owner}::${r.type}::${JSON.stringify(r.pointers)}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      refs.push(r);
      for (const { target } of flatPointers(r)) {
        if (target !== id) {
          const t = idx.byId.get(target);
          if (t) neighbors.set(target, t);
        }
      }
    }
    if (d < depth) {
      for (const r of own) {
        for (const { target } of flatPointers(r)) visit(target, d + 1);
      }
    }
  };
  visit(id, 0);
  return { node, refs, neighbors: [...neighbors.values()] };
};

// ── impact — incoming refs ─────────────────────────────────────────

const impactOf = (idx) => (id, opts = {}) => {
  const depth = opts.depth ?? 0;
  const visited = new Set();
  const refs = [];
  const seenRef = new Set();

  const visit = (cur, d) => {
    if (visited.has(cur)) return;
    visited.add(cur);

    const incoming = filterRefsBy(idx.toTarget.get(cur) || [], opts, idx);
    const here = opts.role
      ? incoming.filter(r => {
          for (const { role, target } of flatPointers(r)) {
            if (target === cur && opts.role.includes(role)) return true;
          }
          return false;
        })
      : incoming;
    for (const r of here) {
      const key = `${r.owner}::${r.type}::${JSON.stringify(r.pointers)}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      refs.push(r);
    }
    if (d < depth) {
      for (const r of here) {
        visit(r.owner, d + 1);
        for (const { target } of flatPointers(r)) visit(target, d + 1);
      }
    }
  };
  visit(id, 0);
  return refs;
};

// ── paths — BFS shortest, undirected over refs ─────────────────────

const pathsOf = (idx) => (sourceId, targetId, opts = {}) => {
  const maxDepth = opts.depth ?? 4;
  const limit = opts.limit ?? 8;
  if (!idx.byId.has(sourceId) || !idx.byId.has(targetId)) return [];
  if (sourceId === targetId) return [[sourceId]];

  const refTypeFilter = opts.ref;
  const neighbors = (id) => {
    const out = new Set();
    const outgoing = idx.fromOwner.get(id) || [];
    const incoming = idx.toTarget.get(id) || [];
    for (const r of [...outgoing, ...incoming]) {
      if (refTypeFilter && !refTypeFilter.includes(r.type)) continue;
      for (const { target } of flatPointers(r)) out.add(target);
      out.add(r.owner);
    }
    out.delete(id);
    return [...out];
  };

  const found = [];
  const queue = [[sourceId]];
  const visited = new Map([[sourceId, 0]]);
  while (queue.length > 0 && found.length < limit) {
    const path = queue.shift();
    const last = path[path.length - 1];
    if (path.length - 1 > maxDepth) continue;
    if (last === targetId) {
      found.push(path);
      continue;
    }
    for (const next of neighbors(last)) {
      if (path.includes(next)) continue;
      const prevDepth = visited.get(next);
      if (prevDepth !== undefined && prevDepth < path.length) continue;
      visited.set(next, path.length);
      queue.push([...path, next]);
    }
  }
  return found;
};

// ── coverage ───────────────────────────────────────────────────────

// What an implementation actually binds, and what it leaves alone.
//
// The unbound list is the point. An element the abstraction declares
// and this implementation does not name is reported as unbound and
// nothing more: canon cannot tell "deliberately not implemented" from
// "nobody has written it down", and inventing a distinction it does
// not have would be worse than the gap. An implementation that means
// the first states it — a row naming the element whose value says so
// — and that row then shows up as bound.
const coverageOf = (idx) => (implId) => {
  const impl = idx.byId.get(implId);
  if (!impl || impl.type !== 'implementation') return null;

  const _descendants = descendantsOf(idx);
  const abstractionId = (idx.fromOwner.get(implId) || [])
    .find(r => r.type === 'implements')?.pointers?.target;
  const abstraction = abstractionId ? idx.byId.get(abstractionId) : undefined;

  const boundBy = new Map();   // abstraction element id → binding node id
  const own = [];
  for (const n of _descendants(implId, { node: ['term', 'rule'] })) {
    const target = (idx.fromOwner.get(n.id) || [])
      .find(r => r.type === 'implements')?.pointers?.target;
    if (target) boundBy.set(target, n.id);
    else own.push({ id: n.id, type: n.type, name: n.name });
  }

  const declared = abstraction
    ? _descendants(abstractionId, { node: ['term', 'rule'] })
    : [];
  const row = (n) => ({ id: n.id, type: n.type, name: n.name });

  return {
    id: implId,
    name: impl.name,
    abstraction: abstractionId || null,
    abstractionResolved: !!abstraction,
    bound: declared.filter(n => boundBy.has(n.id))
      .map(n => ({ ...row(n), boundBy: boundBy.get(n.id) })),
    unbound: declared.filter(n => !boundBy.has(n.id)).map(row),
    own,
  };
};

// ── overview ───────────────────────────────────────────────────────

// Entities, then concepts, then implementations. Neither of the latter
// two has a namespace or a state machine by definition, so both come
// back null / false rather than being omitted — one row shape covers
// all three, and `type` is what tells them apart.
const overviewOf = (idx) => () => [
  ...(idx.byType.get('entity') || []),
  ...(idx.byType.get('concept') || []),
  ...(idx.byType.get('implementation') || []),
].map(e => {
  const childCounts = {};
  for (const r of idx.toTarget.get(e.id) || []) {
    if (r.type !== 'parent') continue;
    const owner = idx.byId.get(r.owner);
    if (owner) childCounts[owner.type] = (childCounts[owner.type] || 0) + 1;
  }
  const own = idx.fromOwner.get(e.id) || [];
  const incoming = idx.toTarget.get(e.id) || [];

  return {
    id: e.id,
    type: e.type,
    name: e.name,
    namespace: e.meta?.namespace || null,
    hasStateMachine: !!e.meta?.hasStateMachine,
    children: childCounts,
    refs: own.length + incoming.length,
  };
});

// ── factory ────────────────────────────────────────────────────────

const createKb = (graph) => {
  const idx = buildIndexes(graph);
  return Object.freeze({
    get: (id) => idx.byId.get(id),
    has: (id) => idx.byId.has(id),
    list: (type) => type ? (idx.byType.get(type) || []).slice() : [...idx.byId.values()],
    from: fromOf(idx),
    to: toOf(idx),
    parent: parentOf(idx),
    children: childrenOf(idx),
    ancestors: ancestorsOf(idx),
    descendants: descendantsOf(idx),
    find: find(idx),
    reveal: revealOf(idx),
    impact: impactOf(idx),
    paths: pathsOf(idx),
    overview: overviewOf(idx),
    coverage: coverageOf(idx),
  });
};

export { createKb };
