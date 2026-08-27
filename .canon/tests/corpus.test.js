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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseRepo, sliceSections } from '../src/parse.js';
import { toGraph, ROOT_TYPES } from '../src/graph.js';
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

test('overview covers every root type and nothing else', () => {
  assert.equal(kb.overview().length,
    ROOT_TYPES.reduce((a, t) => a + kb.list(t).length, 0));
});

test('overview rows carry a root type', () => {
  const untyped = kb.overview().filter(r => !ROOT_TYPES.includes(r.type));
  assert.deepEqual(untyped, []);
});

// ── captured text is complete ──────────────────────────────────────
//
// Content-independent: whatever the corpus says, every `- [ ]` line a
// file has in Section 10 must reach the parsed value. This is what
// silently truncated to one line, taking canon's own record of its
// known unknowns with it.

const sectionOf = (md, heading, next) => {
  const from = md.indexOf(heading);
  if (from === -1) return null;
  const to = md.indexOf(next, from);
  return md.slice(from, to === -1 ? undefined : to);
};

const countChecklist = (text) =>
  (text || '').split('\n').filter(l => l.trim().startsWith('- [ ]')).length;

// `f.dir` — a file is no longer necessarily under objects/
const sourceOf = (f) => readFileSync(join(repoRoot, f.dir, f.relPath), 'utf8');

for (const f of parsed.files) {
  const raw = sourceOf(f);
  const section = sectionOf(raw, '## 10. Open Questions', '## 11.');
  if (!section) continue;
  const inFile = countChecklist(section);
  if (inFile === 0) continue;

  test(`open questions survive parsing — ${f.relPath}`, () => {
    assert.equal(countChecklist(f.data.open_questions?.open_questions), inFile);
  });
}

// The rule between two sections belongs to neither of them. Asserted
// over the real corpus at the slicing layer, where the guarantee is —
// a handful of descriptions legitimately contain a `---` mid-body, so
// the invariant is about how a body ENDS, not what it contains.
test('no section body ends with a separator', () => {
  const offenders = [];
  for (const f of parsed.files) {
    const raw = sourceOf(f);
    const { head, sections } = sliceSections(raw, undefined);
    const endsWithRule = (body) => {
      const lines = body.split('\n');
      let end = lines.length;
      while (end > 0 && lines[end - 1].trim() === '') end--;
      return end > 0 && lines[end - 1].trim() === '---';
    };
    if (endsWithRule(head)) offenders.push(`${f.relPath}:<head>`);
    for (const sec of sections) {
      if (endsWithRule(sec.body)) offenders.push(`${f.relPath}:${sec.heading}`);
    }
  }
  assert.deepEqual(offenders, []);
});

// ── concepts ───────────────────────────────────────────────────────
//
// A concept document is a partial of an object one. These pin the
// parts that are deliberately absent, so removing one later is a
// decision rather than an accident.

test('every concept has a parent ref', () => {
  const orphans = kb.list('concept').filter(c => kb.parent(c.id) === null);
  assert.deepEqual(orphans, []);
});

test('a concept parents only the domain or another concept', () => {
  const wrong = kb.list('concept')
    .map(c => kb.parent(c.id))
    .filter(p => p.type !== 'domain' && p.type !== 'concept');
  assert.deepEqual(wrong, []);
});

test('no concept carries states, transitions or actions', () => {
  const wrong = kb.list('concept').flatMap(c =>
    kb.descendants(c.id, { node: ['state', 'transition', 'action'] }));
  assert.deepEqual(wrong, []);
});

test('every concept-owned term is a §5 key concept', () => {
  const stray = kb.list('concept')
    .flatMap(c => kb.descendants(c.id, { node: ['term'] }))
    .filter(t => t.meta?.kind !== 'key-concept');
  assert.deepEqual(stray, []);
});

// ── implementations ────────────────────────────────────────────────
//
// The corpus carries none yet — the type landed before the first
// vendor document. These pin the invariants now, so the first one to
// arrive is checked on the way in rather than after the fact.

test('every implementation names an abstraction that exists', () => {
  const dangling = kb.list('implementation')
    .filter(i => !kb.get(kb.from(i.id, 'implements')[0]?.pointers?.target));
  assert.deepEqual(dangling, []);
});

test('every implementation is parented to the domain', () => {
  const wrong = kb.list('implementation').filter(i => kb.parent(i.id)?.type !== 'domain');
  assert.deepEqual(wrong, []);
});

test('no implementation carries states, transitions or actions', () => {
  const wrong = kb.list('implementation').flatMap(i =>
    kb.descendants(i.id, { node: ['state', 'transition', 'action'] }));
  assert.deepEqual(wrong, []);
});

// A binding that points somewhere else is not a weaker binding, it is
// a different claim — and validate refuses it. This says the corpus
// has none, which is a different statement from validate having a
// check.
test('every element binding lands inside its own abstraction', () => {
  const stray = kb.list('implementation').flatMap(i => {
    const abstraction = kb.from(i.id, 'implements')[0]?.pointers?.target;
    return kb.descendants(i.id, { node: ['term', 'rule'] })
      .flatMap(n => kb.from(n.id, 'implements'))
      .filter(r => {
        const t = r.pointers?.target;
        return t !== abstraction && !kb.ancestors(t).some(a => a.id === abstraction);
      });
  });
  assert.deepEqual(stray, []);
});
