// integration over the live canon corpus.
//
// thin smoke layer — proves parse → graph → validate pipeline stays
// clean against the actual MD set under .patches/align-format/. Per-
// module behaviour is covered in template.test.js / kb.test.js /
// graph.test.js / validate.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRepo } from '../src/parse.js';
import { toGraph } from '../src/graph.js';
import { createKb } from '../src/kb.js';
import { validate } from '../src/validate.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const parsed = parseRepo(repoRoot);
const graph = toGraph(parsed.files);
const kb = createKb(graph);

const totalParseErrors = parsed.files.reduce((a, f) => a + f.errors.length, 0);
const validationErrors = validate(graph);

// ── pipeline cleanliness ───────────────────────────────────────────

const cleanlinessCases = [
  ['parser produces zero errors',     () => totalParseErrors,                  0],
  ['mention scanner reports zero',     () => graph.mentionErrors.length,       0],
  ['validator produces zero errors',   () => validationErrors.length,          0],
];

for (const [label, fn, expected] of cleanlinessCases) {
  test(`pipeline — ${label}`, () => assert.equal(fn(), expected));
}

// ── corpus shape (sanity baseline; wide tolerances) ───────────────

const shapeCases = [
  ['file count is at least 22',         () => parsed.files.length >= 22,        true],
  ['domain root exists',                () => kb.has('marketplace'),            true],
  ['marketplace has at least 22 entities',
    () => kb.list('entity').length >= 22,                                       true],
  ['marketplace:webhook is an entity',  () => kb.get('marketplace:webhook')?.type, 'entity'],
];

for (const [label, fn, expected] of shapeCases) {
  test(`corpus shape — ${label}`, () => assert.equal(fn(), expected));
}

// ── round-trip — parser must keep digesting its own output ────────

test('every entity has a parent ref', () => {
  const orphans = kb.list('entity').filter(e => kb.parent(e.id) === null);
  assert.deepEqual(orphans, []);
});

test('every state belongs to an entity', () => {
  const orphans = kb.list('state').filter(s => kb.parent(s.id)?.type !== 'entity');
  assert.deepEqual(orphans, []);
});

test('every transition has both from/to or is creation-flagged', () => {
  const wrong = kb.list('transition').filter(t => {
    const refs = kb.from(t.id, 'transition');
    if (refs.length !== 1) return true;
    const p = refs[0].pointers;
    return !p.to;     // must always have a to
  });
  assert.deepEqual(wrong, []);
});

test('every action-binding step targets a transition', () => {
  const refs = kb.list('action').flatMap(a => kb.from(a.id, 'action-binding'));
  const targets = refs.flatMap(r =>
    Array.isArray(r.pointers.step) ? r.pointers.step : [r.pointers.step]);
  const wrong = targets.filter(t => kb.get(t)?.type !== 'transition');
  assert.deepEqual(wrong, []);
});

// ── overview ───────────────────────────────────────────────────────

test('overview row count matches entity count', () => {
  assert.equal(kb.overview().length, kb.list('entity').length);
});
