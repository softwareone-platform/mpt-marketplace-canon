// template.js — compile + match
//
// data-driven: each cluster of related assertions is a `cases` table
// fed into a single test loop. Adding a new edge case = one row.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compile, match } from '../src/template.js';

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
  // first capture succeeds; second fails its terminator (no \n)
  const r = match(compile('A: { a } B: { b }\n'), 'A: one B: two');
  assert.equal(r.captures.length, 1);
});

test('failed match error message describes what was not found', () => {
  const r = match(compile('A: { a }\nB: { b }\n'), 'A: one\nC: two\n');
  assert.match(r.error, /not found/);
});
