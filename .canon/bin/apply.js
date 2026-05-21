#!/usr/bin/env node
// Apply a patch into the working tree. Independent validation:
// parse + graph + schema, all from scratch, no shared state with the
// edit MCP. Refuses to write if anything is unclean.
//
// usage:
//   apply.js <patch-id>           write
//   apply.js <patch-id> --dry-run report only

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRepo } from '../src/parse.js';
import { toGraph } from '../src/graph.js';
import { validate, summarize } from '../src/validate.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── argv ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const patchId = args.find(a => !a.startsWith('--'));

if (!patchId) {
  console.error('usage: apply.js <patch-id> [--dry-run]');
  process.exit(2);
}
if (!/^[a-z0-9][a-z0-9-]*$/i.test(patchId)) {
  console.error(`bad patch id: ${patchId}`);
  process.exit(2);
}

const patchRoot = join(repoRoot, '.patches', patchId);
if (!existsSync(patchRoot) || !statSync(patchRoot).isDirectory()) {
  console.error(`patch not found: ${patchRoot}`);
  process.exit(1);
}

// ── enumerate patch files ──────────────────────────────────────────

// patch payload only flows through these subdirs. Anything at the
// patch root (README.md, CHANGELOG.md, ...) is metadata — ignored.
const KNOWN_BASES = ['objects', 'platform', 'preamble', 'questions'];

const walk = (dir, rel) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const here = rel ? `${rel}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, here));
    else if (name.endsWith('.md')) out.push({ relPath: here, absSrc: full });
  }
  return out;
};

const files = KNOWN_BASES.flatMap(base => {
  const dir = join(patchRoot, base);
  return existsSync(dir) ? walk(dir, base) : [];
});

if (files.length === 0) {
  console.error('patch carries no .md files under any known base dir.');
  process.exit(1);
}

// ── independent validation ─────────────────────────────────────────

const parsed = parseRepo(repoRoot, { patchIds: [patchId] });
const graph = toGraph(parsed.files);
const errors = validate(graph);

const parseErrors = parsed.files.flatMap(f => f.errors);
const mentionErrors = graph.mentionErrors || [];

const blocking =
  parseErrors.length + mentionErrors.length + errors.length;

if (blocking > 0) {
  console.error(`patch ${patchId} would not validate cleanly — refusing to apply.`);
  console.error('');
  if (parseErrors.length > 0) {
    console.error(`parse errors: ${parseErrors.length}`);
    for (const e of parseErrors.slice(0, 10)) {
      console.error(`  [${e.section}] ${e.file}:${e.line}  ${e.error.slice(0, 120)}`);
    }
  }
  if (mentionErrors.length > 0) {
    console.error(`mention errors: ${mentionErrors.length}`);
    for (const e of mentionErrors.slice(0, 10)) {
      console.error(`  [[${e.key}]] in ${e.id || e.ownerNode || e.owner}`);
    }
  }
  if (errors.length > 0) {
    console.error(`validation errors: ${errors.length}`);
    console.error(`  by kind: ${JSON.stringify(summarize(errors))}`);
    for (const e of errors.slice(0, 10)) {
      console.error(`  ${JSON.stringify(e).slice(0, 200)}`);
    }
  }
  process.exit(1);
}

// ── apply ──────────────────────────────────────────────────────────

console.log(`patch ${patchId}: ${files.length} file(s) ready to apply.`);

if (dryRun) {
  console.log('--dry-run: nothing written.');
  for (const f of files) console.log(`  would write: ${f.relPath}`);
  process.exit(0);
}

for (const f of files) {
  const dest = join(repoRoot, f.relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(f.absSrc));
  console.log(`  wrote: ${f.relPath}`);
}

rmSync(patchRoot, { recursive: true, force: true });
console.log(`removed: .patches/${patchId}/`);
console.log('done.');
