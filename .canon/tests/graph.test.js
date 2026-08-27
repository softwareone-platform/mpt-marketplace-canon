// graph.js — cell parsers, id derivation, mention scanner.
//
// The big toGraph() pipeline is exercised end-to-end by the canon-
// shape parse tests (parse.test.js); this file pins the smaller
// pure helpers that all the section emitters lean on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  kebab, entityIdFromFile, conceptIdFromFile, implementationIdFromFile, childId, toGraph,
} from '../src/graph.js';

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

// ── conceptIdFromFile ──────────────────────────────────────────────
//
// No namespace segment, and every concept gets a top-level id — a
// concept that narrows another is still its own document.

const conceptFileCases = [
  ['CANON_CONCEPT_Integration.md',       'marketplace:integration'],
  ['CANON_CONCEPT_VendorIntegration.md', 'marketplace:vendor-integration'],
];

for (const [file, expected] of conceptFileCases) {
  test(`conceptIdFromFile derives ${expected}`, () => {
    assert.equal(conceptIdFromFile(file), expected);
  });
}

test('conceptIdFromFile ignores object files', () => {
  assert.equal(conceptIdFromFile('CANON_OBJECT_Notifications_Webhook.md'), null);
});

test('entityIdFromFile ignores concept files', () => {
  assert.equal(entityIdFromFile('CANON_CONCEPT_Integration.md'), null);
});

// ── concept emission ───────────────────────────────────────────────

const conceptFile = (name, data = {}) => ({
  relPath: `CANON_CONCEPT_${name.replace(/\s+/g, '')}.md`,
  kind: 'concept',
  data: {
    concept_header: { version: '0.2', owner: 'Stu', last_updated: '2026-08-18', status: 'Draft' },
    concept_identity: {
      concept_name: name,
      parent_concept: 'None — top-level concept.',
      description: 'A system outside the platform.',
      aliases: 'Connector, Plugin',
    },
    ...data,
  },
  prose: {},
});

test('toGraph emits a concept node parented to the domain', () => {
  const { nodes, refs } = toGraph([conceptFile('Integration')]);
  const c = nodes.find(n => n.id === 'marketplace:integration');
  assert.equal(c.type, 'concept');
  assert.deepEqual(c.aliases, ['Connector', 'Plugin']);
  const parent = refs.find(r => r.type === 'parent' && r.owner === c.id);
  assert.equal(parent.pointers.parent, 'marketplace');
});

test('a concept carries its own header metadata', () => {
  const { nodes } = toGraph([conceptFile('Integration')]);
  const c = nodes.find(n => n.id === 'marketplace:integration');
  assert.equal(c.meta.version, '0.2');
  assert.equal(c.meta.status, 'Draft');
});

test('toGraph drops concept files without a Concept Name', () => {
  const { nodes } = toGraph([{
    relPath: 'CANON_CONCEPT_Empty.md', kind: 'concept',
    data: { concept_identity: {} }, prose: {},
  }]);
  assert.equal(nodes.find(n => n.id === 'marketplace:empty'), undefined);
});

// The one case hierarchy is for: a narrower concept is its own
// top-level document that further attributes the broader one.
test('a concept may name another concept as its parent', () => {
  const child = conceptFile('Vendor Integration');
  child.data.concept_identity.parent_concept = 'Integration';
  const { nodes, refs } = toGraph([conceptFile('Integration'), child]);
  const c = nodes.find(n => n.id === 'marketplace:vendor-integration');
  assert.equal(c.type, 'concept');
  const parent = refs.find(r => r.type === 'parent' && r.owner === c.id);
  assert.equal(parent.pointers.parent, 'marketplace:integration');
});

// §5 keeps its slot — what the subject exposes — but a concept
// exposes introduced entities rather than fields.
test('key-concept rows become terms flagged as key-concept', () => {
  const { nodes } = toGraph([conceptFile('Integration', {
    concept_key_concepts: {
      concepts: [{
        name: 'Correlation identifier',
        description: 'Its own identifier for a platform object.',
        notes: '—',
      }],
    },
  })]);
  const t = nodes.find(n => n.id === 'integration:correlation-identifier');
  assert.equal(t.type, 'term');
  assert.equal(t.meta.kind, 'key-concept');
  assert.equal(t.description, 'Its own identifier for a platform object.');
});

// A concept HAS an inside — canon simply does not claim to know all of
// it. §7.1 records the significant, confirmed part, and it goes
// through the object's own emitter.
test('a concept records internal events through the object emitter', () => {
  const { refs } = toGraph([conceptFile('Integration', {
    internal_events: {
      events: [{
        event: 'Upstream read',
        trigger: 'Work performed for a consuming Account',
        actors: '—',
        side_effect: 'Values written into the platform originate outside it.',
      }],
    },
  })]);
  const note = refs.find(r => r.type === 'note' && r.meta?.kind === 'event');
  assert.equal(note.owner, 'marketplace:integration');
  assert.match(note.description, /^Upstream read/);
  assert.equal(note.meta.trigger, 'Work performed for a consuming Account');
});

test('a concept cross-effect points at the object it affects', () => {
  const files = [
    conceptFile('Integration', {
      cross_effects: {
        effects: [{
          trigger: 'Reconciliation run',
          affected: 'Notifications: Webhook',
          effect: 'Records are created and removed.',
          automated: 'Yes',
          condition: 'Always',
          notes: '—',
        }],
      },
    }),
    {
      relPath: 'CANON_OBJECT_Notifications_Webhook.md', kind: 'object',
      data: { identity: { object_name: 'Webhook', namespace: 'Notifications' } }, prose: {},
    },
  ];
  const { refs } = toGraph(files);
  const note = refs.find(r => r.type === 'note' && r.meta?.kind === 'cross-effect');
  assert.equal(note.owner, 'marketplace:integration');
  assert.equal(note.pointers.about, 'marketplace:webhook');
  assert.equal(note.meta.automated, true);
});

// §4 is not a concept-specific emitter — it is the object's, unchanged.
test('a concept reuses the object Business Rules emitter', () => {
  const { nodes } = toGraph([conceptFile('Integration', {
    business_rules: {
      rules: [{ id: 'BR-001', statement: 'One Actor only.', states: 'N/A', actor_scope: 'All', notes: '—' }],
    },
  })]);
  const rule = nodes.find(n => n.id === 'integration:br-001');
  assert.equal(rule.type, 'rule');
  assert.equal(rule.meta.states, 'N/A');
});

test('a concept resolves [[mentions]] and owns them', () => {
  const files = [
    conceptFile('Integration', {
      business_rules: {
        rules: [{ id: 'BR-001', statement: 'Bounded by the [[Webhook]].', states: 'N/A', actor_scope: 'All', notes: '' }],
      },
    }),
    {
      relPath: 'CANON_OBJECT_Notifications_Webhook.md', kind: 'object',
      data: { identity: { object_name: 'Webhook', namespace: 'Notifications' } }, prose: {},
    },
  ];
  const { refs, mentionErrors } = toGraph(files);
  assert.deepEqual(mentionErrors, []);
  const mention = refs.find(r => r.type === 'mention' && r.owner === 'integration:br-001');
  assert.deepEqual(mention.pointers.target, ['marketplace:webhook']);
});

test('[[Integration]] resolves to the concept from an object', () => {
  const files = [
    conceptFile('Integration'),
    {
      relPath: 'CANON_OBJECT_Notifications_Webhook.md', kind: 'object',
      data: { identity: { object_name: 'Webhook', namespace: 'Notifications', description: 'Called by an [[Integration]].' } },
      prose: {},
    },
  ];
  const { refs, mentionErrors } = toGraph(files);
  assert.deepEqual(mentionErrors, []);
  const mention = refs.find(r => r.type === 'mention' && r.owner === 'marketplace:webhook');
  assert.deepEqual(mention.pointers.target, ['marketplace:integration']);
});

// A platform object reaches a concept's key concept by full id —
// the ERP case: ErpLink referencing the ERP concept's identifier term.
test('an object can mention a concept key concept by full id', () => {
  const files = [
    conceptFile('Integration', {
      concept_key_concepts: {
        concepts: [{ name: 'Correlation identifier', description: 'Its own id for an object.', notes: '' }],
      },
    }),
    {
      relPath: 'CANON_OBJECT_Notifications_Webhook.md', kind: 'object',
      data: { identity: { object_name: 'Webhook', namespace: 'Notifications', description: 'Holds an [[integration:correlation-identifier]].' } },
      prose: {},
    },
  ];
  const { refs, mentionErrors } = toGraph(files);
  assert.deepEqual(mentionErrors, []);
  const mention = refs.find(r => r.type === 'mention' && r.owner === 'marketplace:webhook');
  assert.deepEqual(mention.pointers.target, ['integration:correlation-identifier']);
});

// ── implementation emission ────────────────────────────────────────

// An implementation is a concept that has stopped being general. Same
// id shape, same emitters; what differs is one edge and one column.

const implFileCases = [
  ['CANON_IMPLEMENTATION_Microsoft.md', 'marketplace:microsoft'],
  ['CANON_IMPLEMENTATION_AdobeVIP.md', 'marketplace:adobe-vip'],
];

for (const [file, expected] of implFileCases) {
  test(`implementationIdFromFile derives ${expected}`, () => {
    assert.equal(implementationIdFromFile(file), expected);
  });
}

test('implementationIdFromFile ignores concept and object files', () => {
  assert.equal(implementationIdFromFile('CANON_CONCEPT_Integration.md'), null);
  assert.equal(implementationIdFromFile('CANON_OBJECT_Notifications_Webhook.md'), null);
});

test('conceptIdFromFile ignores implementation files', () => {
  assert.equal(conceptIdFromFile('CANON_IMPLEMENTATION_Microsoft.md'), null);
});

const implFile = (name, data = {}) => ({
  relPath: `CANON_IMPLEMENTATION_${name.replace(/\s+/g, '')}.md`,
  kind: 'implementation',
  data: {
    implementation_header: { version: '0.1', owner: 'Stu', last_updated: '2026-08-21', status: 'Draft' },
    implementation_identity: {
      implementation_name: name,
      implements: 'Integration',
      description: 'One named realisation.',
      aliases: 'None known.',
    },
    ...data,
  },
  prose: {},
});

// Containment and realisation are separate edges on purpose: "what is
// inside X" and "what realises X" have to stay different questions.
test('an implementation parents the domain and implements its abstraction', () => {
  const { nodes, refs } = toGraph([conceptFile('Integration'), implFile('Microsoft')]);
  const i = nodes.find(n => n.id === 'marketplace:microsoft');
  assert.equal(i.type, 'implementation');
  assert.equal(refs.find(r => r.type === 'parent' && r.owner === i.id).pointers.parent, 'marketplace');
  assert.equal(refs.find(r => r.type === 'implements' && r.owner === i.id).pointers.target,
    'marketplace:integration');
});

test('toGraph drops implementation files without an Implementation Name', () => {
  const { nodes } = toGraph([{
    relPath: 'CANON_IMPLEMENTATION_Empty.md', kind: 'implementation',
    data: { implementation_identity: {} }, prose: {},
  }]);
  assert.equal(nodes.find(n => n.id === 'marketplace:empty'), undefined);
});

// The abstraction is resolved through the same name index as a Parent
// Object, so an unknown one becomes a stub — which validate then
// refuses, because bindings cannot be checked against nothing.
test('an unknown abstraction resolves to a future stub', () => {
  const { refs } = toGraph([implFile('Microsoft')]);
  const r = refs.find(x => x.type === 'implements' && x.owner === 'marketplace:microsoft');
  assert.equal(r.pointers.target, 'marketplace:future:integration');
});

test('a bound §5 row emits an implements ref alongside its parent ref', () => {
  const { nodes, refs } = toGraph([conceptFile('Integration'), implFile('Microsoft', {
    implementation_key_concepts: {
      concepts: [{
        name: 'Tenant id',
        description: 'The Entra tenant the work is performed against.',
        implements: 'integration:actor-credential',
        notes: '—',
      }],
    },
  })]);
  const t = nodes.find(n => n.id === 'microsoft:tenant-id');
  assert.equal(t.type, 'term');
  assert.equal(t.meta.kind, 'key-concept');
  assert.equal(refs.find(r => r.type === 'implements' && r.owner === t.id).pointers.target,
    'integration:actor-credential');
});

// Extending the abstraction is half the point of the type, so an
// empty cell is a statement and not an omission.
test('an unbound §5 row emits no implements ref', () => {
  const { refs } = toGraph([conceptFile('Integration'), implFile('Microsoft', {
    implementation_key_concepts: {
      concepts: [{ name: 'Sku map', description: 'Vendor-specific.', implements: '—', notes: '—' }],
    },
  })]);
  assert.equal(refs.find(r => r.type === 'implements' && r.owner === 'microsoft:sku-map'), undefined);
});

test('a bound §4 rule emits an implements ref', () => {
  const { nodes, refs } = toGraph([conceptFile('Integration'), implFile('Microsoft', {
    implementation_business_rules: {
      rules: [{
        id: 'BR-001', statement: 'Tokens expire after 90 days.',
        states: 'N/A', actor_scope: 'Vendor',
        implements: 'integration:br-004', notes: '—',
      }],
    },
  })]);
  assert.equal(nodes.find(n => n.id === 'microsoft:br-001').type, 'rule');
  assert.equal(refs.find(r => r.type === 'implements' && r.owner === 'microsoft:br-001').pointers.target,
    'integration:br-004');
});

// §7 and §9-10 are the object emitters, reached through the concept
// path — an implementation adds no section of its own.
test('an implementation records internal events through the object emitter', () => {
  const { refs } = toGraph([conceptFile('Integration'), implFile('Microsoft', {
    internal_events: {
      events: [{ event: 'OAuth flow', trigger: 'First connect', actors: '—', side_effect: 'A token is issued.' }],
    },
  })]);
  const note = refs.find(r => r.type === 'note' && r.meta?.kind === 'event'
    && r.owner === 'marketplace:microsoft');
  assert.match(note.description, /^OAuth flow/);
});

// The object path must not have grown an implements ref by way of the
// shared emitters — an object row has no such column to read.
test('an object emits no implements refs', () => {
  const { refs } = toGraph([{
    relPath: 'CANON_OBJECT_Notifications_Webhook.md',
    data: {
      identity: { object_name: 'Webhook', namespace: 'Notifications' },
      business_rules: {
        rules: [{ id: 'BR-001', statement: 'A rule.', states: 'Any', actor_scope: 'Vendor', notes: '' }],
      },
    },
    prose: {},
  }]);
  assert.deepEqual(refs.filter(r => r.type === 'implements'), []);
});
