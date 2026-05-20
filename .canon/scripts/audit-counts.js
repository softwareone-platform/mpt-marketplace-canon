// per-file count audit — MD rows vs graph nodes/refs.
// fast first pass before line-by-line review.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRepo } from '../src/parse.js';
import { toGraph } from '../src/graph.js';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, '..', '..', '.patches', 'align-format', 'objects');

const countTableRows = (md, sectionRegex) => {
  const lines = md.split('\n');
  const start = lines.findIndex(l => sectionRegex.test(l));
  if (start < 0) return 0;
  let i = start + 1;
  while (i < lines.length && !lines[i].trim().startsWith('|')) {
    if (/^## /.test(lines[i]) || /^### /.test(lines[i])) return 0;
    i++;
  }
  // skip header + divider
  i += 2;
  let n = 0;
  while (i < lines.length && lines[i].trim().startsWith('|')) { n++; i++; }
  return n;
};

const r = parseRepo('.');
const { nodes, refs } = toGraph(r.files);

console.log('file'.padEnd(48) + 'BR  attr  trans  rels  events  fail');
for (const f of r.files) {
  const md = readFileSync(join(dir, f.relPath), 'utf8');
  const brRows = countTableRows(md, /^## 4\. Business Rules/);
  const attrRows = countTableRows(md, /^## 5\. Key Attributes/);
  const transRows = countTableRows(md, /^### 3\.2 Transitions/);
  const relsRows = countTableRows(md, /^## 6\. Relationships/);
  const eventsRows = countTableRows(md, /^### 7\.1 Internal Events/);
  const failRows = countTableRows(md, /^## 9\. Failure Modes/);

  // graph counts for this file's entity
  const m = f.relPath.match(/^CANON_OBJECT_[A-Za-z]+_(.+)\.md$/);
  if (!m) continue;
  // Match graph.js's kebab order: CamelCase split BEFORE lowercase.
  const prefix = m[1]
    .replace(/_/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
  const entityId = `marketplace:${prefix}`;
  const myRefs = refs.filter(r => r.owner === entityId);
  const myNodes = nodes.filter(n => n.id.startsWith(prefix + ':'));
  const brCount = myRefs.filter(r => r.type === 'constraint' && r.meta?.canonId?.startsWith('BR')).length;
  const termCount = myNodes.filter(n => n.type === 'term').length;
  const transCount = myNodes.filter(n => n.type === 'transition').length;
  const relsCount = myRefs.filter(r =>
    (r.type === 'dependency' && r.meta?.canonSection === '6.relationships') ||
    (r.type === 'note' && (r.meta?.kind === 'association' || r.meta?.relationshipType))
  ).length;
  const eventsCount = myRefs.filter(r => r.type === 'note' && r.meta?.kind === 'event').length;
  const failCount = myRefs.filter(r => r.type === 'risk').length;

  const cmp = (md, gr) => `${md}/${gr}${md === gr ? ' ' : '!'}`;
  const short = f.relPath.replace('CANON_OBJECT_', '');
  console.log(short.padEnd(48)
    + cmp(brRows, brCount).padEnd(8)
    + cmp(attrRows, termCount).padEnd(8)
    + cmp(transRows, transCount).padEnd(8)
    + cmp(relsRows, relsCount).padEnd(8)
    + cmp(eventsRows, eventsCount).padEnd(8)
    + cmp(failRows, failCount).padEnd(8));
}
