// Dump full Canon graph to .canon/viz/public/graph.json.
// Refs get synthetic stable ids (`ref:<index>`) so the viz can
// reference them as first-class nodes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRepo } from '../src/parse.js';
import { toGraph } from '../src/graph.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const outPath = resolve(here, '..', 'viz', 'public', 'graph.json');

const parsed = parseRepo(repoRoot);
const { nodes, refs, mentionErrors } = toGraph(parsed.files);
const enrichedRefs = refs.map((r, i) => ({ ...r, id: `ref:${i}` }));

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ nodes, refs: enrichedRefs }, null, 2));

console.log(`dumped ${nodes.length} nodes + ${enrichedRefs.length} refs → ${outPath}`);
if (mentionErrors.length) console.warn(`  ${mentionErrors.length} mention errors`);