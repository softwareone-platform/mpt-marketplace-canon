// dump full graph slice for one entity (audit aid).
// usage: node .canon/scripts/dump-entity.js <kebab-name>

import { parseRepo } from '../src/parse.js';
import { toGraph } from '../src/graph.js';

const arg = (process.argv[2] || '').toLowerCase();
if (!arg) {
  console.error('Usage: dump-entity.js <entity-suffix>');
  process.exit(1);
}

const parsed = parseRepo('.');
const { nodes, refs } = toGraph(parsed.files);
const entityId = `marketplace:${arg}`;
const prefix = arg;

const ent = nodes.find(n => n.type === 'entity' && n.id === entityId);
if (!ent) {
  console.error(`Entity ${entityId} not found.`);
  console.error('Known entities:');
  for (const n of nodes.filter(n => n.type === 'entity').sort((a, b) => a.id.localeCompare(b.id))) {
    console.error(`  ${n.id}`);
  }
  process.exit(1);
}

const inEntity = (id) => id === entityId || id.startsWith(prefix + ':');
const myNodes = nodes.filter(n => inEntity(n.id));
const myRefs = refs.filter(r => inEntity(r.owner));

const fmt = (v) => v === undefined ? '' : (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

const printNode = (n) => {
  console.log(`  ${n.type}  ${n.id}`);
  if (n.name) console.log(`    name: ${n.name}`);
  if (n.description) console.log(`    desc: ${String(n.description).slice(0, 120)}${String(n.description).length > 120 ? '…' : ''}`);
  if (n.aliases?.length) console.log(`    aliases: ${n.aliases.join(', ')}`);
  for (const [k, v] of Object.entries(n.meta || {})) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    console.log(`    meta.${k}: ${fmt(v)}`);
  }
};

const printRef = (r) => {
  const ptrs = Object.entries(r.pointers || {})
    .map(([role, t]) => `${role}=${Array.isArray(t) ? `[${t.join(', ')}]` : t}`)
    .join(', ');
  const meta = Object.entries(r.meta || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}=${fmt(v)}`)
    .join(', ');
  console.log(`  ${r.type.padEnd(15)} ${r.owner.padEnd(36)} { ${ptrs} }${meta ? ` [${meta}]` : ''}`);
  if (r.description) console.log(`     "${String(r.description).slice(0, 140)}${String(r.description).length > 140 ? '…' : ''}"`);
};

console.log(`=== ENTITY: ${entityId} ===\n`);
printNode(ent);

const groups = ['domain', 'state', 'transition', 'action', 'term'];
for (const g of groups) {
  const xs = myNodes.filter(n => n.type === g && n.id !== entityId);
  if (xs.length === 0) continue;
  console.log(`\n--- ${g.toUpperCase()}S (${xs.length}) ---`);
  for (const n of xs) printNode(n);
}

console.log(`\n--- REFS BY TYPE ---`);
const refTypes = ['parent', 'transition', 'action-binding', 'constraint', 'risk', 'note', 'dependency'];
for (const rt of refTypes) {
  const xs = myRefs.filter(r => r.type === rt);
  if (xs.length === 0) continue;
  console.log(`\n${rt} (${xs.length}):`);
  for (const r of xs) printRef(r);
}

console.log(`\nTotal: ${myNodes.length} nodes, ${myRefs.length} refs`);
