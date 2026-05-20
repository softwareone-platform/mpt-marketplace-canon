// graph.js — cell parsers, id derivation, mention scanner.
//
// The big toGraph() pipeline is exercised end-to-end by the canon-
// shape parse tests (parse.test.js); this file pins the smaller
// pure helpers that all the section emitters lean on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { kebab, entityIdFromFile, childId, toGraph } from '../src/graph.js';

// ── kebab ──────────────────────────────────────────────────────────

const kebabCases = [
  ['Webhook',           'webhook'],
  ['Unit of Measure',   'unit-of-measure'],
  ['Product Item',      'product-item'],
  ['ItemGroup',         'item-group'],
  ['parameters.fulfillment', 'parameters-fulfillment'],
  ['  ALL CAPS  ',      'all-caps'],
  ['',                  ''],
];

for (const [input, expected] of kebabCases) {
  test(`kebab(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
    assert.equal(kebab(input), expected);
  });
}

// ── entityIdFromFile ───────────────────────────────────────────────

const fileIdCases = [
  ['CANON_OBJECT_Notifications_Webhook.md',         'marketplace:webhook'],
  ['CANON_OBJECT_Catalog_Product.md',               'marketplace:product'],
  ['CANON_OBJECT_Catalog_Product_Item.md',          'marketplace:product-item'],
  ['CANON_OBJECT_Catalog_Product_ItemGroup.md',     'marketplace:product-item-group'],
  ['CANON_OBJECT_Catalog_PricingPolicy.md',         'marketplace:pricing-policy'],
];

for (const [file, expected] of fileIdCases) {
  test(`entityIdFromFile derives ${expected}`, () => {
    assert.equal(entityIdFromFile(file), expected);
  });
}

test('entityIdFromFile returns null for non-canon filenames', () => {
  assert.equal(entityIdFromFile('README.md'), null);
});

// ── childId ────────────────────────────────────────────────────────

const childIdCases = [
  ['marketplace:webhook',     'Enabled',          'webhook:enabled'],
  ['marketplace:product-item','Draft',            'product-item:draft'],
  ['marketplace:webhook',     'Disable Webhook',  'webhook:disable-webhook'],
  ['marketplace:webhook',     'parameters.fulfillment', 'webhook:parameters-fulfillment'],
];

for (const [parent, name, expected] of childIdCases) {
  test(`childId(${parent}, ${JSON.stringify(name)}) === ${expected}`, () => {
    assert.equal(childId(parent, name), expected);
  });
}

// ── mention scanner — happy paths ──────────────────────────────────

const mentionFixture = (description) => [{
  relPath: 'CANON_OBJECT_Catalog_Foo.md',
  data: {
    identity: {
      object_name: 'Foo',
      namespace: 'Catalog',
      description,
    },
  },
  prose: {},
}, {
  relPath: 'CANON_OBJECT_Catalog_Bar.md',
  data: { identity: { object_name: 'Bar', namespace: 'Catalog' } },
  prose: {},
}, {
  relPath: 'CANON_OBJECT_Commerce_Baz.md',
  data: { identity: { object_name: 'Baz', namespace: 'Commerce', aliases: 'BZ' } },
  prose: {},
}];

const mentionCases = [
  // [label, description, expectedTargets]
  ['by exact id',          'See [[marketplace:bar]] for context.',  ['marketplace:bar']],
  ['by Object Name',       'See [[Bar]] for context.',              ['marketplace:bar']],
  ['by alias',             'See [[BZ]] for context.',               ['marketplace:baz']],
  ['case insensitive',     'See [[bar]] / [[BAR]].',                ['marketplace:bar']],
  ['multiple targets',     'See [[Bar]] and [[Baz]].',              ['marketplace:bar', 'marketplace:baz']],
  ['no mentions',          'Plain text with no markup.',            null],
  ['self-mention dropped', 'See [[Foo]] (self).',                   null],
];

for (const [label, description, expected] of mentionCases) {
  test(`mention scanner — ${label}`, () => {
    const { refs } = toGraph(mentionFixture(description));
    const m = refs.find(r => r.type === 'mention' && r.owner === 'marketplace:foo');
    if (expected === null) {
      assert.equal(m, undefined);
      return;
    }
    assert.deepEqual(m.pointers.target, [...expected].sort());
  });
}

// ── mention scanner — error path ───────────────────────────────────

test('broken [[key]] is reported in mentionErrors', () => {
  const { mentionErrors } = toGraph(mentionFixture('See [[NotARealThing]].'));
  assert.equal(mentionErrors.length, 1);
});

test('broken [[key]] error carries the unresolved key', () => {
  const { mentionErrors } = toGraph(mentionFixture('See [[NotARealThing]].'));
  assert.equal(mentionErrors[0].key, 'NotARealThing');
});

// ── domain root + entity emission ──────────────────────────────────

test('toGraph always emits the marketplace domain node', () => {
  const { nodes } = toGraph([]);
  assert.ok(nodes.find(n => n.id === 'marketplace' && n.type === 'domain'));
});

test('toGraph drops files without an Object Name', () => {
  const out = toGraph([{
    relPath: 'CANON_OBJECT_Catalog_Empty.md',
    data: { identity: {} },
    prose: {},
  }]);
  assert.equal(out.nodes.find(n => n.id === 'marketplace:empty'), undefined);
});

test('toGraph splits aliases on `;` and strips parentheticals', () => {
  const { nodes } = toGraph([{
    relPath: 'CANON_OBJECT_Notifications_Webhook.md',
    data: {
      identity: {
        object_name: 'Webhook',
        namespace: 'Notifications',
        aliases: 'WBH (API identifier prefix); Hook',
      },
    },
    prose: {},
  }]);
  const w = nodes.find(n => n.id === 'marketplace:webhook');
  assert.deepEqual(w.aliases, ['WBH', 'Hook']);
});

test('toGraph captures parent-object qualifier text in entity meta', () => {
  const { nodes } = toGraph([{
    relPath: 'CANON_OBJECT_Catalog_Lonely.md',
    data: {
      identity: {
        object_name: 'Lonely',
        namespace: 'Catalog',
        parent_object: 'None — top-level Catalog object.',
      },
    },
    prose: {},
  }]);
  const e = nodes.find(n => n.id === 'marketplace:lonely');
  assert.equal(e.meta.parentObjectNote, 'top-level Catalog object.');
});
