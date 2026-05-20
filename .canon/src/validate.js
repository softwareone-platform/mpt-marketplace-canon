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

  return errors;
};

// group errors by kind — `{ 'pointer-target-not-found': 47, ... }`
const summarize = (errors) => errors.reduce((acc, e) => {
  acc[e.kind] = (acc[e.kind] || 0) + 1;
  return acc;
}, {});

export { validate, summarize, isFuture };
