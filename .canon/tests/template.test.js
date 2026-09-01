// template.js — compile + match
//
// data-driven: each cluster of related assertions is a `cases` table
// fed into a single test loop. Adding a new edge case = one row.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compile, match } from '../src/template.js';
import { sliceSections, parseSections, parseFile, detectKind } from '../src/parse.js';
import { toGraph } from '../src/graph.js';
import { createKb } from '../src/kb.js';
import { renderImplementation } from '../src/render.js';

// ── compile errors ─────────────────────────────────────────────────

const compileErrors = [
  ['invalid path',                    '{ 1foo }',                              /Invalid path/],
  ['unclosed each',                   '{ #each x in xs }\n| { x.a } |',       /Unclosed/],
  ['unmatched /each',                 '{ /each }',                             /Unexpected/],
  ['adjacent captures',               '{ a }{ b }',                            /Adjacent captures/],
  ['each body without leading literal','PRE { #each x in xs }{ x.a } |\n{ /each }', /must start with literal/],
  ['each body without trailing anchor','PRE { #each x in xs }| { x.a }{ /each }',   /must end with literal/],
  ['duplicate as-name',               'A { foo as k } B { bar as k }',         /Duplicate/],
  ['annotate references missing key', 'A { #annotate ghost }',                 /no `as` key/],
];

for (const [label, src, re] of compileErrors) {
  test(`compile rejects: ${label}`, () => {
    assert.throws(() => compile(src), re);
  });
}

test('compile produces an ast for a valid template', () => {
  assert.ok(compile('hello { name }').ast);
});

// ── match: simple capture cases ────────────────────────────────────

const captureCases = [
  // [label, template, input, picker, expected]
  ['plain',          'Name: { name }\n',    'Name: Alice\n',    r => r.data.name,        'Alice'],
  ['nested path',    'Hi { user.name }!',   'Hi Alice!',        r => r.data.user.name,   'Alice'],
  ['ws-tolerant',    'Name: { name }\n',    'Name:    Alice\n', r => r.data.name,        'Alice'],
  ['trims value',    'Name: { name }\n',    'Name:   Alice  \n',r => r.data.name,        'Alice'],
];

for (const [label, tpl, input, pick, expected] of captureCases) {
  test(`match captures (${label})`, () => {
    assert.equal(pick(match(compile(tpl), input)), expected);
  });
}

// ── match: ok / not-ok outcomes ────────────────────────────────────

const okCases = [
  ['valid input',              'Name: { name }\n', 'Name: Alice\n', true],
  ['missing literal',          'Name: { name }\n', 'Title: Alice\n', false],
  ['matching newline count',   'A: { a }\nB: { b }\n', 'A: 1\nB: 2\n', true],
  ['too few newlines',         'A: { a }\n\nB: { b }\n', 'A: 1\nB: 2\n', false],
];

for (const [label, tpl, input, expected] of okCases) {
  test(`match.ok=${expected} when ${label}`, () => {
    assert.equal(match(compile(tpl), input).ok, expected);
  });
}

// ── match: as <name> captures ──────────────────────────────────────

const namedCaptureCases = [
  ['explicit name',     'Name: { name as person }\n', 'Name: Alice\n', 'person'],
  ['legacy `as key`',   'User: { user.id as key }\n', 'User: 42\n',    'user.id'],
];

for (const [label, tpl, input, expectedName] of namedCaptureCases) {
  test(`match named capture (${label})`, () => {
    assert.equal(match(compile(tpl), input).keys[0].name, expectedName);
  });
}

test('match captures collects every capture in order', () => {
  const r = match(compile('A { x }\nB { y as named }\nC { z }\n'), 'A 1\nB 2\nC 3\n');
  assert.equal(r.captures.length, 3);
});

// ── match: #each blocks ────────────────────────────────────────────

const eachCases = [
  // [label, template, input, expectedListLen]
  ['empty list',  'H\n{ #each row in rows }\n| { row.a } |\n{ /each }\n', 'H\n', 0],
  ['two rows',    'H\n{ #each row in rows }\n| { row.a } | { row.b } |\n{ /each }\n', 'H\n| 1 | x |\n| 2 | y |\n', 2],
  ['four rows',   'H\n{ #each r in rows }\n| { r.a } | { r.b } |\n{ /each }\n', 'H\n| 1 | a |\n| 2 | b |\n| 3 | c |\n| 4 | d |\n', 4],
  ['stops at non-matching line', 'H\n{ #each row in rows }\n| { row.a } |\n{ /each }\n', 'H\n| 1 |\n| 2 |\nfoo\n', 2],
];

for (const [label, tpl, input, len] of eachCases) {
  test(`each block — ${label} → list length ${len}`, () => {
    const r = match(compile(tpl), input);
    const listKey = Object.keys(r.data)[0];
    assert.equal(r.data[listKey].length, len);
  });
}

test('each block preserves field values inside iterations', () => {
  const tpl = compile('H\n{ #each row in rows }\n| { row.a } | { row.b } |\n{ /each }\n');
  const r = match(tpl, 'H\n| 1 | x |\n| 2 | y |\n');
  assert.equal(r.data.rows[1].b, 'y');
});

// ── match: line numbers ────────────────────────────────────────────

const lineCases = [
  ['captures.line 1-indexed for first match',
    '# header\n\nName: { name }\n', '# header\n\nName: Alice\n', r => r.captures[0].line, 3],
  ['captures.line lands on the value, not preceding ws',
    'A:\n{ value }\n', 'A:\nfoo\n', r => r.captures[0].line, 2],
  ['failure line is a number',
    '# header\n\nName: { name }\n', '# header\n\nTitle: Alice\n', r => typeof r.line, 'number'],
];

for (const [label, tpl, input, pick, expected] of lineCases) {
  test(`line tracking — ${label}`, () => {
    assert.equal(pick(match(compile(tpl), input)), expected);
  });
}

// ── match: annotate slots ──────────────────────────────────────────

test('annotate slot is collected for an in-scope key', () => {
  const r = match(
    compile('Name: { name as person }\n{ #annotate person }\n'),
    'Name: Alice\n\n',
  );
  assert.equal(r.slots.length, 1);
});

test('annotate slot carries its key name', () => {
  const r = match(
    compile('Name: { name as person }\n{ #annotate person }\n'),
    'Name: Alice\n\n',
  );
  assert.equal(r.slots[0].name, 'person');
});

// ── match: real canon-shaped input ─────────────────────────────────

const canonShapeCases = [
  // em-dash sentinel for empty cells (matches what align.js inserts)
  ['em-dash cell value preserved',
    'H\n{ #each r in rows }\n| { r.a } | { r.b } |\n{ /each }\n',
    'H\n| 1 | x |\n| 2 | — |\n| 3 | y |\n',
    r => r.data.rows[1].b, '—'],
  // wikilink-wrapped directives still parse
  ['HTML-comment-wrapped each block',
    'H\n<!-- { #each r in rs } -->\n| { r.a } |\n<!-- { /each } -->\n',
    'H\n| 1 |\n| 2 |\n',
    r => r.data.rs.length, 2],
];

for (const [label, tpl, input, pick, expected] of canonShapeCases) {
  test(`canon-shape — ${label}`, () => {
    assert.equal(pick(match(compile(tpl), input)), expected);
  });
}

// ── match: error path ──────────────────────────────────────────────

test('failed match captures committed before the failing point survive', () => {
  // first capture succeeds; second fails its terminator (no ' END')
  const r = match(compile('A: { a } B: { b } END'), 'A: one B: two');
  assert.equal(r.captures.length, 1);
});

// ── a template's own trailing newline is the file ending ───────────
//
// It used to be compiled as a literal, which made it the terminator of
// any capture that ended a template — cutting multi-line values at
// their first line break — and something the input then had to match.

test('a capture at the end of a template runs past the first line break', () => {
  const r = match(compile('## Q\n\n{ q }\n'), '## Q\n\n- one\n- two\n- three\n');
  assert.equal(r.ok, true);
  assert.equal(r.data.q, '- one\n- two\n- three');
});

test('a template with no trailing newline behaves identically', () => {
  const withNl = match(compile('## Q\n\n{ q }\n'), '## Q\n\n- one\n- two\n');
  const without = match(compile('## Q\n\n{ q }'), '## Q\n\n- one\n- two\n');
  assert.deepEqual(withNl.data, without.data);
});

test('a real terminator still bounds a capture', () => {
  const r = match(compile('A:\n{ a }\n\nB:\n{ b }\n'), 'A:\none\n\nB:\ntwo\n');
  assert.equal(r.data.a, 'one');
  assert.equal(r.data.b, 'two');
});

// The whitespace literal INSIDE an each body is what separates one row
// from the next, and is not dropped.
test('a table still matches every row, including the last', () => {
  const tpl = '| H |\n| --- |\n{ #each r in rs }\n| { r.v } |\n{ /each }\n';
  const r = match(compile(tpl), '| H |\n| --- |\n| 1 |\n| 2 |\n| 3 |\n');
  assert.equal(r.ok, true);
  assert.equal(r.data.rs.length, 3);
});

test('a table whose input ends flush after its last row keeps that row', () => {
  const tpl = '| H |\n| --- |\n{ #each r in rs }\n| { r.v } |\n{ /each }\n';
  const r = match(compile(tpl), '| H |\n| --- |\n| 1 |\n| 2 |\n');
  assert.equal(r.data.rs.length, 2);
});

test('failed match error message describes what was not found', () => {
  const r = match(compile('A: { a }\nB: { b }\n'), 'A: one\nC: two\n');
  assert.match(r.error, /not found/);
});

// ── the `---` between sections belongs to neither ──────────────────
//
// A section is sliced from its heading to the next one, which sweeps
// up the rule that separates them. Left in the body, it ends up inside
// whichever field the section ends with.

const sectionBody = (md, heading) =>
  sliceSections(md).sections.find(x => x.heading === heading)?.body;

const IDENTITY_MD = [
  '## 1. Identity',
  '',
  '**Also Known As:**',
  'None known.',
  '',
  '---',
  '',
  '## 2. Ownership & Visibility',
  '',
].join('\n');

test('a section body does not carry the rule that follows it', () => {
  const body = sectionBody(IDENTITY_MD, '## 1. Identity');
  assert.ok(!body.split('\n').some(l => l.trim() === '---'), body);
  assert.match(body, /None known\.\n$/);
});

// three files in the corpus carry a doubled rule
test('a doubled rule is stripped in full', () => {
  const md = IDENTITY_MD.replace('---\n\n## 2.', '---\n\n---\n\n## 2.');
  const body = sectionBody(md, '## 1. Identity');
  assert.ok(!body.split('\n').some(l => l.trim() === '---'), body);
});

test('the file header is trimmed the same way', () => {
  const md = '# Object Canon: X\n\n> **Status:** Draft\n\n---\n\n## 1. Identity\n\n';
  const { head } = sliceSections(md);
  assert.ok(!head.split('\n').some(l => l.trim() === '---'), head);
});

// the newline that survives is load-bearing: it anchors the last row
test('a body keeps exactly one trailing newline', () => {
  const md = '## 5. Key Attributes\n\n| A |\n| --- |\n| x |\n\n---\n\n## 6. X\n';
  const body = sectionBody(md, '## 5. Key Attributes');
  assert.match(body, /\| x \|\n$/);
});

// ── document kinds ─────────────────────────────────────────────────
//
// Objects and concepts share section numbers and mean different things
// by §1. The banner on the document's own first line is what decides
// which it is — not the directory it came from, so moving a file never
// silently changes its meaning.

const CONCEPT_MD = [
  '# Concept Canon: Integration',
  '',
  '> **Version:** 0.1',
  '> **Owner:** Unassigned',
  '> **Last Updated:** 2026-08-19',
  '> **Status:** Draft',
  '',
  '---',
  '',
  '## 1. Identity',
  '',
  '**Concept Name:** Integration',
  '',
  '**Parent Concept:** None — top-level concept.',
  '',
  '**Description:**',
  'A system outside the platform.',
  '',
  '**Also Known As:**',
  'Connector',
  '',
  '---',
  '',
  '## 5. Key Concepts',
  '',
  '| Concept | Description | Notes |',
  '| --- | --- | --- |',
  '| Correlation identifier | Its own identifier for a platform object. | — |',
  '',
  '---',
  '',
  '## 7. Lifecycle Events & Side Effects',
  '',
  '### 7.1 Internal Events',
  '',
  '| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |',
  '| --- | --- | --- | --- |',
  '| Upstream read | Work for a consuming Account | — | Values originate outside the platform. |',
  '',
].join('\n');

const bannerCases = [
  ['# Object Canon: Webhook',      'object'],
  ['# Concept Canon: Integration', 'concept'],
  ['#  Concept Canon: Spaced',     'concept'],
  ['# Implementation Canon: Microsoft', 'implementation'],
  ['# Platform Canon: Renderer',   null],
  ['Just some prose',              null],
  ['',                             null],
];

for (const [first, expected] of bannerCases) {
  test(`detectKind(${JSON.stringify(first.slice(0, 28))}) === ${expected}`, () => {
    assert.equal(detectKind(first + '\n\nbody'), expected);
  });
}

test('a concept parses off its own banner, with no kind supplied', () => {
  const r = parseSections(CONCEPT_MD, '<concept>');
  assert.deepEqual(r.errors, []);
  assert.equal(r.data._kind, 'concept');
  assert.equal(r.data.concept_identity.concept_name, 'Integration');
  assert.equal(r.data.concept_key_concepts.concepts.length, 1);
  // §7 is the object's own template, reused unchanged
  assert.equal(r.data.internal_events.events.length, 1);
});

test('a document with no banner fails loudly instead of being guessed at', () => {
  const r = parseSections('## 1. Identity\n\n**Object Name:** Nope\n', '<none>');
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].section, 'banner');
  assert.match(r.errors[0].error, /Object Canon.*Concept Canon.*Implementation Canon/);
});

test('an explicit kind still overrides detection, and the wrong one does not silently succeed', () => {
  const r = parseSections(CONCEPT_MD, '<concept>', 'object');
  assert.ok(r.errors.length > 0);
});

test('an unknown kind throws rather than guessing', () => {
  assert.throws(() => parseSections(CONCEPT_MD, '<c>', 'platform'), /unknown document kind/);
});

// filename and banner are two independent statements of the same fact
test('a filename that disagrees with the banner is reported', () => {
  const r = parseFile('objects', { relPath: 'CANON_OBJECT_Catalog_Thing.md', source: 'original', content: CONCEPT_MD });
  const mismatch = r.errors.filter(e => /filename declares/.test(e.error));
  assert.equal(mismatch.length, 1);
});

test('a filename that agrees with the banner is not reported', () => {
  const r = parseFile('concepts', { relPath: 'CANON_CONCEPT_Integration.md', source: 'original', content: CONCEPT_MD });
  assert.deepEqual(r.errors, []);
  assert.equal(r.kind, 'concept');
  assert.equal(r.dir, 'concepts');
});

// ── implementation ─────────────────────────────────────────────────
//
// The concept shape with one column added to §4 and §5. These prove
// the column survives the whole loop — MD → graph → MD → graph —
// because a binding that renders as prose and re-parses as nothing is
// worse than no binding at all.

const IMPLEMENTATION_MD = [
  '# Implementation Canon: Microsoft',
  '',
  '> **Version:** 0.1',
  '> **Owner:** Unassigned',
  '> **Last Updated:** 2026-08-21',
  '> **Status:** Draft',
  '',
  '---',
  '',
  '## 1. Identity',
  '',
  '**Implementation Name:** Microsoft',
  '',
  '**Implements:** Integration',
  '',
  '**Parent Implementation:** None — top-level implementation.',
  '',
  '**Description:**',
  'One named realisation.',
  '',
  '**Also Known As:**',
  'None known.',
  '',
  '---',
  '',
  '## 4. Business Rules',
  '',
  '| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Implements | Notes |',
  '| --- | --- | --- | --- | --- | --- |',
  '| BR-001 | Tokens expire after 90 days. | N/A | Vendor | integration:br-004 | — |',
  '| BR-002 | Quota is per tenant. | N/A | Vendor | — | — |',
  '',
  '---',
  '',
  '## 5. Key Concepts',
  '',
  '| Concept | Description | Implements | Notes |',
  '| --- | --- | --- | --- |',
  '| Tenant id | The Entra tenant. | integration:actor-credential | — |',
  '| Sku map | Vendor-specific catalogue mapping. | — | — |',
  '',
  '---',
  '',
  '## 7. Lifecycle Events & Side Effects',
  '',
  '### 7.1 Internal Events',
  '',
  '| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |',
  '| --- | --- | --- | --- |',
  '| OAuth flow | First connect | — | A token is issued. |',
  '',
].join('\n');

test('an implementation parses off its own banner', () => {
  const r = parseSections(IMPLEMENTATION_MD, '<impl>');
  assert.deepEqual(r.errors, []);
  assert.equal(r.data._kind, 'implementation');
  assert.equal(r.data.implementation_identity.implementation_name, 'Microsoft');
  assert.equal(r.data.implementation_identity.implements, 'Integration');
  assert.equal(r.data.implementation_business_rules.rules.length, 2);
  assert.equal(r.data.implementation_key_concepts.concepts[0].implements,
    'integration:actor-credential');
  // §7 is the object template, inherited through the concept dispatch
  assert.equal(r.data.internal_events.events.length, 1);
});

test('an implementation filename that agrees with the banner is not reported', () => {
  const r = parseFile('implementations', {
    relPath: 'CANON_IMPLEMENTATION_Microsoft.md', source: 'original', content: IMPLEMENTATION_MD,
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.kind, 'implementation');
  assert.equal(r.dir, 'implementations');
});

test('a concept filename over an implementation banner is reported', () => {
  const r = parseFile('concepts', {
    relPath: 'CANON_CONCEPT_Microsoft.md', source: 'original', content: IMPLEMENTATION_MD,
  });
  assert.equal(r.errors.filter(e => /filename declares/.test(e.error)).length, 1);
});

const implFixture = () => {
  const impl = parseFile('implementations', {
    relPath: 'CANON_IMPLEMENTATION_Microsoft.md', source: 'original', content: IMPLEMENTATION_MD,
  });
  const abstraction = {
    relPath: 'CANON_CONCEPT_Integration.md', dir: 'concepts', kind: 'concept', prose: {},
    data: {
      concept_identity: { concept_name: 'Integration', parent_concept: 'None — top-level concept.' },
      concept_key_concepts: {
        concepts: [{ name: 'Actor credential', description: 'A token.', notes: '—' }],
      },
      business_rules: {
        rules: [{ id: 'BR-004', statement: 'Credentials expire.', states: 'N/A', actor_scope: 'Vendor', notes: '—' }],
      },
    },
  };
  return [abstraction, impl];
};

test('render → parse returns the same bindings', () => {
  const kb = createKb(toGraph(implFixture()));
  const md = renderImplementation(kb, 'marketplace:microsoft');
  const back = parseSections(md, '<rendered>');
  assert.deepEqual(back.errors, []);
  assert.equal(back.data._kind, 'implementation');
  assert.equal(back.data.implementation_identity.implements, 'Integration');

  const byName = Object.fromEntries(
    back.data.implementation_key_concepts.concepts.map(c => [c.name, c.implements]));
  assert.equal(byName['Tenant id'], 'integration:actor-credential');
  assert.equal(byName['Sku map'], '—');

  const byId = Object.fromEntries(
    back.data.implementation_business_rules.rules.map(r => [r.id, r.implements]));
  assert.equal(byId['BR-001'], 'integration:br-004');
  assert.equal(byId['BR-002'], '—');
});

// The graph is the thing that has to survive, not the bytes.
test('render → parse → graph preserves the implements refs', () => {
  const first = toGraph(implFixture());
  const md = renderImplementation(createKb(first), 'marketplace:microsoft');
  const reparsed = parseFile('implementations', {
    relPath: 'CANON_IMPLEMENTATION_Microsoft.md', source: 'original', content: md,
  });
  const second = toGraph([implFixture()[0], reparsed]);

  const binds = (g) => g.refs.filter(r => r.type === 'implements')
    .map(r => `${r.owner} → ${r.pointers.target}`).sort();
  assert.deepEqual(binds(second), binds(first));
});
