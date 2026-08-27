// graph → array of { kind, ...context } violations. Pure: nothing
// throws, nothing mutates.

import { NODES, REFS } from './schema.js';

// future:* placeholders are the explicit "not canonised yet" escape
// hatch — skip existence checks against them
const FUTURE_PREFIX = 'marketplace:future:';
const isFuture = (id) => typeof id === 'string' && id.startsWith(FUTURE_PREFIX);

// ── fields ─────────────────────────────────────────────────────────

const checkField = (node, field, ftype, errors) => {
  const required = ftype.endsWith('!');
  const base = ftype.replace('!', '');
  const v = node[field];
  if (required && (v === undefined || v === null || v === '')) {
    errors.push({ kind: 'missing-required-field', node: node.id, field });
    return;
  }
  if (v === undefined || v === null) return;
  if (base === 'string' && typeof v !== 'string') {
    errors.push({ kind: 'wrong-field-type', node: node.id, field, expected: 'string', actual: typeof v });
  } else if (base === 'string[]') {
    if (!Array.isArray(v)) {
      errors.push({ kind: 'wrong-field-type', node: node.id, field, expected: 'string[]', actual: typeof v });
    } else {
      for (const item of v) {
        if (typeof item !== 'string') {
          errors.push({ kind: 'wrong-field-type', node: node.id, field, expected: 'string[]', actual: `array<${typeof item}>` });
          break;
        }
      }
    }
  }
};

// ── pointers ───────────────────────────────────────────────────────

const checkPointer = (ref, role, ptrSpec, val, byId, errors) => {
  const targets = Array.isArray(val) ? val : [val];
  if (ptrSpec.min !== undefined && targets.length < ptrSpec.min) {
    errors.push({
      kind: 'pointer-min',
      owner: ref.owner, refType: ref.type, role,
      count: targets.length, min: ptrSpec.min,
    });
  }
  if (ptrSpec.max !== undefined && targets.length > ptrSpec.max) {
    errors.push({
      kind: 'pointer-max',
      owner: ref.owner, refType: ref.type, role,
      count: targets.length, max: ptrSpec.max,
    });
  }
  for (const t of targets) {
    if (typeof t !== 'string') {
      errors.push({ kind: 'pointer-non-string', owner: ref.owner, refType: ref.type, role, target: t });
      continue;
    }
    if (isFuture(t)) continue;
    const target = byId.get(t);
    if (!target) {
      errors.push({ kind: 'pointer-target-not-found', owner: ref.owner, refType: ref.type, role, target: t });
      continue;
    }
    if (ptrSpec.target !== '*' && Array.isArray(ptrSpec.target)
        && !ptrSpec.target.includes(target.type)) {
      errors.push({
        kind: 'wrong-pointer-target-type',
        owner: ref.owner, refType: ref.type, role, target: t,
        targetType: target.type, expected: ptrSpec.target,
      });
    }
  }
};

// ── bindings ───────────────────────────────────────────────────────

// The schema can say an `implements` ref points at a term. It cannot
// say it points at a term OF THE ABSTRACTION THIS DOCUMENT REALISES,
// and that is the whole content of the type: a binding to somewhere
// else is not a weaker binding, it is a different claim. Three things
// are checked, all of them about where a pointer lands rather than
// what shape it has:
//
//   implements-abstraction-unresolved — the document names an
//     abstraction canon does not have. Unlike an unresolved Parent
//     Object, this cannot degrade to a `future:` stub: with no
//     abstraction there is nothing for the element bindings to be
//     checked against, so every one of them would pass vacuously.
//   implements-outside-abstraction — the row binds a real element of
//     some other subject.
//   implements-type-mismatch — a rule bound to a term, or a term to a
//     rule. Both are nodes, so the pointer check lets it through.
//
// Nothing here is checked about what is NOT bound. An element the
// abstraction declares and no row names is not an error — it is the
// answer to "what about B?", and it is reported by `coverage`, not by
// validate.
const ancestorsOf = (id, parentOf) => {
  const seen = new Set();
  let cur = parentOf.get(id);
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    cur = parentOf.get(cur);
  }
  return seen;
};

const checkImplements = (nodes, refs, byId, errors) => {
  const parentOf = new Map();
  for (const r of refs) {
    if (r.type === 'parent' && r.owner && r.pointers?.parent) {
      parentOf.set(r.owner, r.pointers.parent);
    }
  }

  // owner id → the abstraction its document realises
  const abstractionOf = new Map();
  for (const r of refs) {
    if (r.type !== 'implements') continue;
    const owner = byId.get(r.owner);
    if (owner?.type !== 'implementation') continue;
    const target = r.pointers?.target;
    if (isFuture(target) || (typeof target === 'string' && !byId.has(target))) {
      errors.push({ kind: 'implements-abstraction-unresolved', node: r.owner, target });
      continue;
    }
    abstractionOf.set(r.owner, target);
  }

  for (const r of refs) {
    if (r.type !== 'implements') continue;
    const owner = byId.get(r.owner);
    if (!owner || owner.type === 'implementation') continue;

    const root = [...ancestorsOf(owner.id, parentOf)]
      .find(a => byId.get(a)?.type === 'implementation');
    if (!root) {
      errors.push({ kind: 'implements-outside-implementation', node: owner.id });
      continue;
    }
    const abstraction = abstractionOf.get(root);
    if (!abstraction) continue;   // already reported at document level

    const target = byId.get(r.pointers?.target);
    if (!target) continue;        // already reported by the pointer check
    if (target.type !== owner.type) {
      errors.push({
        kind: 'implements-type-mismatch',
        node: owner.id, target: target.id,
        ownerType: owner.type, targetType: target.type,
      });
    }
    if (target.id !== abstraction && !ancestorsOf(target.id, parentOf).has(abstraction)) {
      errors.push({
        kind: 'implements-outside-abstraction',
        node: owner.id, target: target.id, abstraction,
      });
    }
  }
};

// ── walk ───────────────────────────────────────────────────────────

const validate = (graph) => {
  const errors = [];
  const { nodes = [], refs = [] } = graph;

  const byId = new Map();
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || !n.id) {
      errors.push({ kind: 'malformed-node', node: n });
      continue;
    }
    if (byId.has(n.id)) errors.push({ kind: 'duplicate-id', id: n.id });
    else byId.set(n.id, n);
  }

  for (const n of nodes) {
    const spec = NODES[n.type];
    if (!spec) {
      errors.push({ kind: 'unknown-node-type', node: n.id, type: n.type });
      continue;
    }
    for (const [field, ftype] of Object.entries(spec.fields || {})) {
      checkField(n, field, ftype, errors);
    }
  }

  const refsByOwner = new Map();
  for (const r of refs) {
    if (!r || typeof r !== 'object') {
      errors.push({ kind: 'malformed-ref', ref: r });
      continue;
    }
    if (!refsByOwner.has(r.owner)) refsByOwner.set(r.owner, []);
    refsByOwner.get(r.owner).push(r);
  }

  for (const r of refs) {
    const spec = REFS[r.type];
    if (!spec) {
      errors.push({ kind: 'unknown-ref-type', owner: r.owner, refType: r.type });
      continue;
    }

    const owner = byId.get(r.owner);
    if (!owner) {
      if (!isFuture(r.owner)) {
        errors.push({ kind: 'ref-owner-not-found', owner: r.owner, refType: r.type });
      }
    } else if (Array.isArray(spec.owner) && !spec.owner.includes(owner.type)) {
      errors.push({
        kind: 'wrong-ref-owner-type',
        owner: r.owner, refType: r.type,
        ownerType: owner.type, expected: spec.owner,
      });
    }

    const ptrs = r.pointers || {};
    for (const [role, val] of Object.entries(ptrs)) {
      const ptrSpec = spec.pointers?.[role];
      if (!ptrSpec) {
        errors.push({ kind: 'unknown-pointer-role', owner: r.owner, refType: r.type, role });
        continue;
      }
      checkPointer(r, role, ptrSpec, val, byId, errors);
    }

    for (const [role, ptrSpec] of Object.entries(spec.pointers || {})) {
      if (ptrSpec.min !== undefined && ptrSpec.min > 0
          && (ptrs[role] === undefined || ptrs[role] === null
              || (Array.isArray(ptrs[role]) && ptrs[role].length === 0))) {
        errors.push({
          kind: 'missing-required-pointer',
          owner: r.owner, refType: r.type, role, min: ptrSpec.min,
        });
      }
    }
  }

  for (const n of nodes) {
    const spec = NODES[n.type];
    if (!spec) continue;
    const myRefs = refsByOwner.get(n.id) || [];
    for (const [refType, mult] of Object.entries(spec.refs || {})) {
      const count = myRefs.filter(r => r.type === refType).length;
      if (mult.min !== undefined && count < mult.min) {
        errors.push({ kind: 'node-ref-min', node: n.id, refType, count, min: mult.min });
      }
      if (mult.max !== undefined && count > mult.max) {
        errors.push({ kind: 'node-ref-max', node: n.id, refType, count, max: mult.max });
      }
    }
  }

  checkImplements(nodes, refs, byId, errors);

  return errors;
};

// group errors by kind — `{ 'pointer-target-not-found': 47, ... }`
const summarize = (errors) => errors.reduce((acc, e) => {
  acc[e.kind] = (acc[e.kind] || 0) + 1;
  return acc;
}, {});

export { validate, summarize, isFuture };
