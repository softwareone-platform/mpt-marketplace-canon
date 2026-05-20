// validate.js — schema-driven graph checks.
//
// Each case feeds a tiny graph that violates one rule, asserts the
// expected error kind shows up in the report.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validate, summarize, isFuture } from '../src/validate.js';

// minimum legal graph — domain + one entity with a parent ref
const baseGraph = () => ({
  nodes: [
    { id: 'marketplace', type: 'domain', name: 'Marketplace' },
    { id: 'marketplace:foo', type: 'entity', name: 'Foo' },
  ],
  refs: [
    { type: 'parent', owner: 'marketplace:foo', pointers: { parent: 'marketplace' } },
  ],
});

// ── happy path ─────────────────────────────────────────────────────

test('clean graph yields no errors', () => {
  assert.deepEqual(validate(baseGraph()), []);
});

// ── violations table ───────────────────────────────────────────────
//
// each row mutates a copy of the base graph, then asserts the named
// error kind appears in the report.

const violationCases = [
  ['unknown-node-type', g => g.nodes.push({ id: 'foo:weird', type: 'mystery' })],

  ['duplicate-id',      g => g.nodes.push({ id: 'marketplace:foo', type: 'entity', name: 'Dup' })],

  ['missing-required-field',
    g => g.nodes.push({ id: 'foo:s', type: 'state' /* no name */, })
      || g.refs.push({ type: 'parent', owner: 'foo:s', pointers: { parent: 'marketplace:foo' } })],

  ['unknown-ref-type',
    g => g.refs.push({ type: 'mystery-ref', owner: 'marketplace:foo', pointers: {} })],

  ['ref-owner-not-found',
    g => g.refs.push({ type: 'parent', owner: 'marketplace:ghost', pointers: { parent: 'marketplace' } })],

  ['wrong-ref-owner-type',
    // transition refs must be owned by a transition node
    g => g.refs.push({
      type: 'transition', owner: 'marketplace:foo',
      pointers: { from: 'marketplace', to: 'marketplace' },
    })],

  ['unknown-pointer-role',
    g => g.refs.push({
      type: 'parent', owner: 'marketplace:foo',
      pointers: { parent: 'marketplace', ghost: 'marketplace' },
    })],

  ['pointer-target-not-found',
    g => g.refs.push({
      type: 'note', owner: 'marketplace:foo',
      pointers: { about: 'marketplace:nope' },
    })],

  ['node-ref-min',
    // entity needs exactly 1 parent ref — drop the only one
    g => { g.refs.length = 0; }],

  ['node-ref-max',
    // add a second parent ref to violate max:1
    g => g.refs.push({
      type: 'parent', owner: 'marketplace:foo',
      pointers: { parent: 'marketplace' },
    })],
];

for (const [kind, mutate] of violationCases) {
  test(`detects ${kind}`, () => {
    const g = baseGraph();
    mutate(g);
    const errors = validate(g);
    assert.ok(errors.some(e => e.kind === kind), `expected kind=${kind}, got ${JSON.stringify(summarize(errors))}`);
  });
}

// ── future placeholders ────────────────────────────────────────────

test('future:* targets do not trigger pointer-target-not-found', () => {
  const g = baseGraph();
  g.refs.push({
    type: 'note', owner: 'marketplace:foo',
    pointers: { about: 'marketplace:future:ghost' },
  });
  const errors = validate(g);
  assert.equal(errors.filter(e => e.kind === 'pointer-target-not-found').length, 0);
});

const isFutureCases = [
  ['marketplace:future:user', true],
  ['marketplace:foo',          false],
  ['',                          false],
  [null,                        false],
  [undefined,                   false],
];

for (const [id, expected] of isFutureCases) {
  test(`isFuture(${JSON.stringify(id)}) === ${expected}`, () => {
    assert.equal(isFuture(id), expected);
  });
}

// ── summarize ──────────────────────────────────────────────────────

test('summarize buckets errors by kind', () => {
  const errors = [
    { kind: 'duplicate-id', id: 'a' },
    { kind: 'duplicate-id', id: 'b' },
    { kind: 'unknown-node-type', node: 'a' },
  ];
  assert.deepEqual(summarize(errors), { 'duplicate-id': 2, 'unknown-node-type': 1 });
});

test('summarize on empty input is an empty object', () => {
  assert.deepEqual(summarize([]), {});
});
