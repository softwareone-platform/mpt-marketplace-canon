// kb.js — graph-query surface
//
// Built on a tiny synthetic fixture so each test runs against a known
// shape. Real-canon assertions live in a separate test file; this one
// proves the query primitives work in isolation.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createKb } from '../src/kb.js';

// ── fixture ────────────────────────────────────────────────────────
//
//   marketplace
//     └─ marketplace:foo  (entity, name "Foo", aliases [Effigy])
//          ├─ foo:active  (state, initial)
//          ├─ foo:dead    (state, terminal)
//          ├─ foo:transmute  (transition, active → dead)
//          └─ foo:burn    (action — binds the transition)
//     └─ marketplace:bar  (entity, name "Bar")
//          └─ bar:idle    (state)
//
//   constraint: foo says something about bar
//   note:       foo mentions a future:ghost target

const fixture = {
  nodes: [
    { id: 'marketplace', type: 'domain', name: 'Marketplace' },

    { id: 'marketplace:foo', type: 'entity', name: 'Foo',
      description: 'Foo is the prime widget.', aliases: ['Effigy'],
      meta: { namespace: 'Catalog', hasStateMachine: true } },
    { id: 'foo:active', type: 'state', name: 'Active', meta: { initial: true } },
    { id: 'foo:dead',   type: 'state', name: 'Dead',   meta: { terminal: true } },
    { id: 'foo:transmute', type: 'transition', name: 'Transmute', meta: { canonId: 'T1' } },
    { id: 'foo:burn',   type: 'action', name: 'Burn' },

    { id: 'marketplace:bar', type: 'entity', name: 'Bar',
      description: 'Bar is the secondary widget.',
      meta: { namespace: 'Catalog', hasStateMachine: false } },
    { id: 'bar:idle', type: 'state', name: 'Idle' },
  ],
  refs: [
    { type: 'parent', owner: 'marketplace:foo', pointers: { parent: 'marketplace' } },
    { type: 'parent', owner: 'marketplace:bar', pointers: { parent: 'marketplace' } },
    { type: 'parent', owner: 'foo:active',     pointers: { parent: 'marketplace:foo' } },
    { type: 'parent', owner: 'foo:dead',       pointers: { parent: 'marketplace:foo' } },
    { type: 'parent', owner: 'foo:transmute',  pointers: { parent: 'marketplace:foo' } },
    { type: 'parent', owner: 'foo:burn',       pointers: { parent: 'marketplace:foo' } },
    { type: 'parent', owner: 'bar:idle',       pointers: { parent: 'marketplace:bar' } },

    { type: 'transition', owner: 'foo:transmute',
      pointers: { from: 'foo:active', to: 'foo:dead' } },

    { type: 'action-binding', owner: 'foo:burn',
      pointers: { step: ['foo:transmute'] } },

    { type: 'constraint', owner: 'marketplace:foo',
      description: 'Foo must not mutate Bar.',
      pointers: { subject: 'marketplace:foo', target: 'marketplace:bar' } },

    { type: 'note', owner: 'marketplace:foo',
      description: 'See also the ghost.',
      pointers: { about: 'marketplace:future:ghost' },
      meta: { kind: 'open-question' } },
  ],
};

const kb = createKb(fixture);

// ── primitives ─────────────────────────────────────────────────────

const primitiveCases = [
  ['get returns the node by id',
    () => kb.get('marketplace:foo')?.name, 'Foo'],
  ['get returns undefined for unknown id',
    () => kb.get('marketplace:nope'), undefined],
  ['has returns true for known id',
    () => kb.has('foo:active'), true],
  ['has returns false for unknown id',
    () => kb.has('foo:ghost'), false],
  ['list with type filter returns only that type',
    () => kb.list('state').length, 3],
  ['list without filter returns every node',
    () => kb.list().length, 8],
];

for (const [label, fn, expected] of primitiveCases) {
  test(`primitive — ${label}`, () => {
    assert.deepEqual(fn(), expected);
  });
}

// ── from / to ──────────────────────────────────────────────────────

const refLookupCases = [
  // [label, fn → number, expected]
  // foo owns: parent + constraint + note  (3)
  ['from(id) returns every outgoing ref',
    () => kb.from('marketplace:foo').length, 3],
  ['from(id, type) filters by ref type',
    () => kb.from('marketplace:foo', 'parent').length, 1],
  // foo is target of: 4 child parent-refs + constraint.subject  (5)
  ['to(id) returns every incoming ref',
    () => kb.to('marketplace:foo').length, 5],
  ['to(id, type) filters by ref type',
    () => kb.to('marketplace:foo', 'parent').length, 4],
  ['from on unknown id returns empty array',
    () => kb.from('marketplace:ghost').length, 0],
  ['to on unknown id returns empty array',
    () => kb.to('marketplace:ghost').length, 0],
];

for (const [label, fn, expected] of refLookupCases) {
  test(`refs — ${label}`, () => assert.equal(fn(), expected));
}

// ── structural traversal ───────────────────────────────────────────

const traversalCases = [
  ['parent of state returns its entity',
    () => kb.parent('foo:active')?.id, 'marketplace:foo'],
  ['parent of entity returns the domain',
    () => kb.parent('marketplace:foo')?.id, 'marketplace'],
  ['parent of root returns null',
    () => kb.parent('marketplace'), null],
  ['parent of unknown id returns null',
    () => kb.parent('foo:ghost'), null],
  ['children returns direct children only',
    () => kb.children('marketplace:foo').length, 4],
  ['children with node filter narrows by type',
    () => kb.children('marketplace:foo', { node: ['state'] }).length, 2],
  ['descendants walks the full subtree',
    () => kb.descendants('marketplace').length, 7],
  ['ancestors walks up to root',
    () => kb.ancestors('foo:active').length, 2],
];

for (const [label, fn, expected] of traversalCases) {
  test(`traversal — ${label}`, () => assert.equal(fn(), expected));
}

// ── find ───────────────────────────────────────────────────────────

const findCases = [
  ['name token matches entity', 'foo',  hits => hits[0].id === 'marketplace:foo'],
  ['alias matches entity',      'effigy', hits => hits[0].id === 'marketplace:foo'],
  ['empty query returns nothing', '', hits => hits.length === 0],
  ['unknown query returns nothing', 'zzz', hits => hits.length === 0],
];

for (const [label, query, predicate] of findCases) {
  test(`find — ${label}`, () => {
    assert.ok(predicate(kb.find(query).hits));
  });
}

test('find limit caps the hit list', () => {
  // total population is small here; assert the option is honoured by
  // requesting one hit
  assert.ok(kb.find('foo', { limit: 1 }).hits.length <= 1);
});

test('find filters by node type', () => {
  const hits = kb.find('foo', { node: ['state'] }).hits;
  assert.ok(hits.every(h => h.id.startsWith('foo:') || h.id === 'foo'));
});

// ── reveal ─────────────────────────────────────────────────────────

const revealCases = [
  ['reveal returns null on unknown id',
    () => kb.reveal('marketplace:ghost'), null],
  ['reveal at depth 0 returns only owned refs',
    () => kb.reveal('marketplace:foo').refs.length, 3],
  ['reveal collects neighbors from outgoing pointers',
    () => kb.reveal('marketplace:foo').neighbors.length > 0, true],
];

for (const [label, fn, expected] of revealCases) {
  test(`reveal — ${label}`, () => assert.equal(fn(), expected));
}

test('reveal with ref filter scopes to a ref type', () => {
  const r = kb.reveal('marketplace:foo', { ref: ['constraint'] });
  assert.ok(r.refs.every(x => x.type === 'constraint'));
});

// ── impact ─────────────────────────────────────────────────────────

const impactCases = [
  // bar is target of: bar:idle parent + constraint.target  (2)
  ['impact returns incoming refs',
    () => kb.impact('marketplace:bar').length, 2],
  ['impact on unknown id returns empty array',
    () => kb.impact('marketplace:ghost').length, 0],
  ['impact with role filter scopes to that role',
    () => kb.impact('marketplace:bar', { role: ['target'] }).length, 1],
];

for (const [label, fn, expected] of impactCases) {
  test(`impact — ${label}`, () => assert.equal(fn(), expected));
}

// ── paths ──────────────────────────────────────────────────────────

const pathCases = [
  ['paths same-node returns trivial path',
    () => kb.paths('marketplace:foo', 'marketplace:foo')[0].length, 1],
  ['paths between connected nodes returns at least one',
    () => kb.paths('marketplace:foo', 'marketplace:bar', { depth: 3 }).length > 0, true],
  ['paths with unknown source returns empty',
    () => kb.paths('marketplace:ghost', 'marketplace:bar').length, 0],
  ['paths with unknown target returns empty',
    () => kb.paths('marketplace:foo', 'marketplace:ghost').length, 0],
];

for (const [label, fn, expected] of pathCases) {
  test(`paths — ${label}`, () => assert.equal(fn(), expected));
}

test('paths limit caps the result count', () => {
  const r = kb.paths('marketplace:foo', 'marketplace:bar', { depth: 6, limit: 1 });
  assert.ok(r.length <= 1);
});

// ── overview ───────────────────────────────────────────────────────

test('overview returns one row per entity', () => {
  assert.equal(kb.overview().length, 2);
});

test('overview rows carry namespace from entity meta', () => {
  const row = kb.overview().find(r => r.id === 'marketplace:foo');
  assert.equal(row.namespace, 'Catalog');
});

test('overview rows count children by type', () => {
  const row = kb.overview().find(r => r.id === 'marketplace:foo');
  assert.equal(row.children.state, 2);
});

test('overview hasStateMachine flag mirrors entity meta', () => {
  const foo = kb.overview().find(r => r.id === 'marketplace:foo');
  assert.equal(foo.hasStateMachine, true);
});
