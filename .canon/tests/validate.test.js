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

// ── concepts ───────────────────────────────────────────────────────

const conceptGraph = () => ({
  nodes: [
    { id: 'marketplace', type: 'domain', name: 'Marketplace' },
    { id: 'marketplace:integration', type: 'concept', name: 'Integration' },
    { id: 'marketplace:vendor-integration', type: 'concept', name: 'Vendor Integration' },
  ],
  refs: [
    { type: 'parent', owner: 'marketplace:integration', pointers: { parent: 'marketplace' } },
    { type: 'parent', owner: 'marketplace:vendor-integration', pointers: { parent: 'marketplace:integration' } },
  ],
});

test('a concept parented to the domain validates', () => {
  assert.deepEqual(validate(conceptGraph()), []);
});

test('a concept may parent another concept', () => {
  const wrong = validate(conceptGraph()).filter(e => e.kind === 'wrong-pointer-target-type');
  assert.deepEqual(wrong, []);
});

test('a concept without a name is a missing-required-field', () => {
  const g = conceptGraph();
  g.nodes.push({ id: 'marketplace:nameless', type: 'concept' });
  g.refs.push({ type: 'parent', owner: 'marketplace:nameless', pointers: { parent: 'marketplace' } });
  assert.ok(validate(g).map(e => e.kind).includes('missing-required-field'));
});

test('a concept without a parent ref is a node-ref-min', () => {
  const g = conceptGraph();
  g.nodes.push({ id: 'marketplace:orphan', type: 'concept', name: 'Orphan' });
  assert.ok(validate(g).map(e => e.kind).includes('node-ref-min'));
});

test('a term may hang off a concept', () => {
  const g = conceptGraph();
  g.nodes.push({ id: 'integration:public-api', type: 'term', name: 'Public API', description: 'Calls.' });
  g.refs.push({ type: 'parent', owner: 'integration:public-api', pointers: { parent: 'marketplace:integration' } });
  assert.deepEqual(validate(g), []);
});

// A concept has no lifecycle and no concept template emits a state,
// but `parent` constrains its target type and not its owner's — so
// the schema alone does not forbid one. The guard is that nothing
// builds it. Pinned so the limit is visible rather than assumed: if
// concepts ever need a structural lifecycle guard, this test is the
// first thing that has to change.
test('the schema alone does not forbid a state under a concept — the emitters do', () => {
  const g = conceptGraph();
  g.nodes.push({ id: 'integration:running', type: 'state', name: 'Running' });
  g.refs.push({ type: 'parent', owner: 'integration:running', pointers: { parent: 'marketplace:integration' } });
  assert.deepEqual(validate(g), []);
});

// ── bindings ───────────────────────────────────────────────────────

// The schema can only say an implements ref points at a term. Whether
// it points at a term OF THE RIGHT SUBJECT is the whole content of the
// type, and it is checked here.

const implGraph = () => ({
  nodes: [
    { id: 'marketplace', type: 'domain', name: 'Marketplace' },
    { id: 'marketplace:integration', type: 'concept', name: 'Integration' },
    { id: 'integration:actor-credential', type: 'term', name: 'Actor credential', description: 'A token.' },
    { id: 'integration:br-004', type: 'rule', name: 'BR-004', description: 'Credentials expire.' },
    { id: 'marketplace:microsoft', type: 'implementation', name: 'Microsoft' },
    { id: 'microsoft:tenant-id', type: 'term', name: 'Tenant id', description: 'An Entra tenant.' },
  ],
  refs: [
    { type: 'parent', owner: 'marketplace:integration', pointers: { parent: 'marketplace' } },
    { type: 'parent', owner: 'integration:actor-credential', pointers: { parent: 'marketplace:integration' } },
    { type: 'parent', owner: 'integration:br-004', pointers: { parent: 'marketplace:integration' } },
    { type: 'parent', owner: 'marketplace:microsoft', pointers: { parent: 'marketplace' } },
    { type: 'implements', owner: 'marketplace:microsoft', pointers: { target: 'marketplace:integration' } },
    { type: 'parent', owner: 'microsoft:tenant-id', pointers: { parent: 'marketplace:microsoft' } },
    { type: 'implements', owner: 'microsoft:tenant-id', pointers: { target: 'integration:actor-credential' } },
  ],
});

test('a bound implementation validates', () => {
  assert.deepEqual(validate(implGraph()), []);
});

test('an implementation without an implements ref is a node-ref-min', () => {
  const g = implGraph();
  g.refs = g.refs.filter(r => !(r.type === 'implements' && r.owner === 'marketplace:microsoft'));
  assert.ok(validate(g).map(e => e.kind).includes('node-ref-min'));
});

// A `future:` stub is the corpus-wide escape hatch for an unresolved
// reference, and here it must not be: with no abstraction, every
// element binding would pass vacuously.
test('an unresolved abstraction is reported, not tolerated as a stub', () => {
  const g = implGraph();
  g.refs.find(r => r.type === 'implements' && r.owner === 'marketplace:microsoft')
    .pointers.target = 'marketplace:future:integration';
  const kinds = validate(g).map(e => e.kind);
  assert.ok(kinds.includes('implements-abstraction-unresolved'));
});

test('binding an element of some other subject is refused', () => {
  const g = implGraph();
  g.nodes.push({ id: 'marketplace:erp', type: 'concept', name: 'ERP' });
  g.nodes.push({ id: 'erp:identifier', type: 'term', name: 'Identifier', description: 'Which ERP.' });
  g.refs.push({ type: 'parent', owner: 'marketplace:erp', pointers: { parent: 'marketplace' } });
  g.refs.push({ type: 'parent', owner: 'erp:identifier', pointers: { parent: 'marketplace:erp' } });
  g.refs.find(r => r.owner === 'microsoft:tenant-id' && r.type === 'implements')
    .pointers.target = 'erp:identifier';
  const e = validate(g).find(x => x.kind === 'implements-outside-abstraction');
  assert.equal(e.abstraction, 'marketplace:integration');
  assert.equal(e.target, 'erp:identifier');
});

// Both are nodes, so the pointer check lets it through.
test('a term bound to a rule is a type mismatch', () => {
  const g = implGraph();
  g.refs.find(r => r.owner === 'microsoft:tenant-id' && r.type === 'implements')
    .pointers.target = 'integration:br-004';
  const e = validate(g).find(x => x.kind === 'implements-type-mismatch');
  assert.equal(e.ownerType, 'term');
  assert.equal(e.targetType, 'rule');
});

test('an element binding outside any implementation is refused', () => {
  const g = implGraph();
  g.nodes.push({ id: 'integration:stray', type: 'term', name: 'Stray', description: 'Wrong place.' });
  g.refs.push({ type: 'parent', owner: 'integration:stray', pointers: { parent: 'marketplace:integration' } });
  g.refs.push({ type: 'implements', owner: 'integration:stray', pointers: { target: 'integration:actor-credential' } });
  const kinds = validate(g).map(e => e.kind);
  assert.ok(kinds.includes('implements-outside-implementation'));
});

// Silence about an element is the design, not a defect: canon cannot
// tell "not implemented" from "not recorded", and validate must not
// invent the distinction by complaining.
test('an unbound element of the abstraction is not a validation error', () => {
  const g = implGraph();
  g.nodes.push({ id: 'integration:instance', type: 'term', name: 'Instance', description: 'A registered run.' });
  g.refs.push({ type: 'parent', owner: 'integration:instance', pointers: { parent: 'marketplace:integration' } });
  assert.deepEqual(validate(g), []);
});

test('an implementation may bind an object as its abstraction', () => {
  const g = implGraph();
  g.nodes.push({ id: 'marketplace:order', type: 'entity', name: 'Order' });
  g.refs.push({ type: 'parent', owner: 'marketplace:order', pointers: { parent: 'marketplace' } });
  g.refs.find(r => r.type === 'implements' && r.owner === 'marketplace:microsoft')
    .pointers.target = 'marketplace:order';
  const kinds = validate(g).map(e => e.kind);
  assert.ok(!kinds.includes('wrong-pointer-target-type'));
  assert.ok(kinds.includes('implements-outside-abstraction'));   // the term still binds Integration
});
