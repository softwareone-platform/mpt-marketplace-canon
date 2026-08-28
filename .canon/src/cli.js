// CLI dispatcher — debug + inspection. See `canon help` for commands.

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRepo } from './parse.js';
import { toGraph } from './graph.js';
import { createKb } from './kb.js';
import { validate, summarize } from './validate.js';
import { renderNode } from './render.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const load = (options) => {
  const parsed = parseRepo(repoRoot, options);
  const graph = toGraph(parsed.files);
  const kb = createKb(graph);
  return { parsed, graph, kb };
};

const fmtNode = (n) => `${n.type.padEnd(11)} ${n.id}${n.name ? `  — ${n.name}` : ''}`;

const cmds = {
  validate: (patchId) => {
    const options = patchId ? { patchIds: [patchId] } : {};
    const { parsed, graph } = load(options);
    const parseErrs = parsed.files.flatMap(f => f.errors);
    const ve = validate(graph);
    const corpora = 'objects/ + concepts/ + implementations/';
    const scope = patchId ? `${corpora} + .patches/${patchId}/` : corpora;
    console.log(`Scope: ${scope}`);
    console.log(`Files: ${parsed.files.length}`);
    console.log(`Parse errors:    ${parseErrs.length}`);
    console.log(`Mention errors:  ${(graph.mentionErrors || []).length}`);
    console.log(`Validation errors: ${ve.length}`);
    if (ve.length > 0) {
      console.log('By kind:', summarize(ve));
      for (const e of ve.slice(0, 20)) console.log(' ', JSON.stringify(e).slice(0, 200));
    }
    if (parseErrs.length > 0) {
      console.log('\nFirst parse errors:');
      for (const e of parseErrs.slice(0, 10)) console.log(`  [${e.section}] ${e.file}:${e.line} ${e.error.slice(0, 80)}`);
    }
  },

  overview: () => {
    const { kb } = load();
    for (const e of kb.overview()) {
      const childPart = Object.entries(e.children)
        .map(([t, c]) => `${t}=${c}`).join(', ');
      // '—' says "not applicable", not "unknown": neither a concept
      // nor an implementation sits in the namespace model at all.
      const ns = e.type === 'entity' ? (e.namespace || '?') : '—';
      console.log(`${e.id.padEnd(40)} ${e.type.padEnd(14)} ns=${ns.padEnd(14)} sm=${e.hasStateMachine ? '✓' : ' '} refs=${String(e.refs).padStart(3)}  ${childPart}`);
    }
  },

  find: (query) => {
    if (!query) { console.error('usage: canon find <query>'); process.exit(2); }
    const { kb } = load();
    const r = kb.find(query);
    console.log(`${r.total} hits, top ${r.hits.length}:`);
    for (const h of r.hits) console.log(`  ${String(h.score).padStart(4)}  ${h.type.padEnd(10)} ${h.id.padEnd(40)} ${h.name || ''}`);
  },

  get: (id) => {
    if (!id) { console.error('usage: canon get <id>'); process.exit(2); }
    const { kb } = load();
    const node = kb.get(id);
    if (!node) { console.error(`not found: ${id}`); process.exit(1); }
    console.log(JSON.stringify({
      ...node,
      parent: kb.parent(id)?.id || null,
      children: kb.children(id).map(c => c.id),
      refs: { outgoing: kb.from(id).length, incoming: kb.to(id).length },
    }, null, 2));
  },

  reveal: (id, depthStr) => {
    if (!id) { console.error('usage: canon reveal <id> [depth]'); process.exit(2); }
    const { kb } = load();
    const r = kb.reveal(id, { depth: depthStr ? +depthStr : 0 });
    if (!r) { console.error(`not found: ${id}`); process.exit(1); }
    console.log(`Node: ${r.node.id} (${r.node.type})`);
    console.log(`Refs: ${r.refs.length}, neighbors: ${r.neighbors.length}`);
    for (const ref of r.refs) {
      const ptr = Object.entries(ref.pointers || {}).map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`).join(', ');
      console.log(`  ${ref.type.padEnd(15)} { ${ptr} }${ref.description ? `  "${ref.description.slice(0, 80)}"` : ''}`);
    }
  },

  impact: (id, depthStr) => {
    if (!id) { console.error('usage: canon impact <id> [depth]'); process.exit(2); }
    const { kb } = load();
    const refs = kb.impact(id, { depth: depthStr ? +depthStr : 0 });
    console.log(`${refs.length} incoming refs:`);
    for (const ref of refs) {
      const ptr = Object.entries(ref.pointers || {}).map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`).join(', ');
      console.log(`  ${ref.type.padEnd(15)} from=${ref.owner.padEnd(36)} { ${ptr} }`);
    }
  },

  paths: (a, b, depthStr) => {
    if (!a || !b) { console.error('usage: canon paths <source-id> <target-id> [depth]'); process.exit(2); }
    const { kb } = load();
    const ps = kb.paths(a, b, { depth: depthStr ? +depthStr : 4 });
    console.log(`${ps.length} paths:`);
    for (const p of ps) console.log(' ', p.join(' → '));
  },

  describe: (id) => {
    if (!id) { console.error('usage: canon describe <entity-id>'); process.exit(2); }
    const { kb } = load();
    const node = kb.get(id);
    if (!node) { console.error(`not found: ${id}`); process.exit(1); }
    const prefix = id.split(':').slice(-1)[0];
    const all = kb.list().filter(n => n.id === id || n.id.startsWith(prefix + ':'));
    console.log(`=== ${id} (${all.length} nodes) ===`);
    for (const n of all) console.log('  ' + fmtNode(n));
    const ownRefs = all.flatMap(n => kb.from(n.id));
    console.log(`\nOwned refs: ${ownRefs.length}`);
    const byType = {};
    for (const r of ownRefs) byType[r.type] = (byType[r.type] || 0) + 1;
    for (const [t, c] of Object.entries(byType)) console.log(`  ${t}: ${c}`);
  },

  coverage: (id) => {
    if (!id) { console.error('usage: canon coverage <implementation-id>'); process.exit(2); }
    const { kb } = load();
    const c = kb.coverage(id);
    if (!c) { console.error(`not an implementation: ${id}`); process.exit(1); }
    console.log(`${c.id}  →  ${c.abstraction || '(none)'}${c.abstractionResolved ? '' : '   [UNRESOLVED]'}`);
    const show = (label, rows, extra = () => '') => {
      console.log(`\n${label} (${rows.length})`);
      for (const r of rows) console.log(`  ${r.type.padEnd(5)} ${r.id.padEnd(50)}${extra(r)}`);
    };
    show('Bound', c.bound, r => `← ${r.boundBy}`);
    // Not a defect list. Canon cannot tell "not implemented" from
    // "not recorded", and prints the pair as one thing on purpose.
    show('Unbound — not implemented, or not recorded', c.unbound);
    show('Own — introduced by this implementation', c.own);
  },

  render: (id) => {
    if (!id) { console.error('usage: canon render <entity-id|concept-id|implementation-id>'); process.exit(2); }
    const { kb } = load();
    const md = renderNode(kb, id);
    if (!md) { console.error(`nothing renderable at: ${id}`); process.exit(1); }
    process.stdout.write(md);
  },

  align: () => {
    const r = spawnSync('node', [resolve(here, '..', 'scripts', 'align.js')], { stdio: 'inherit' });
    process.exit(r.status || 0);
  },

  reindex: async () => {
    try {
      const { buildIndex } = await import('./rag/bootstrap.js');
      const index = await buildIndex(repoRoot);
      console.log(`reindexed: ${index.length} chunks → .canon/dist/rag.jsonl`);
    } catch (e) {
      console.error('reindex failed:', e.message);
      process.exit(1);
    }
  },

  discover: async (...args) => {
    if (args.length === 0) { console.error('usage: canon discover <query...>'); process.exit(2); }
    try {
      const { discover } = await import('./rag/bootstrap.js');
      const r = await discover(repoRoot, args.join(' '), { limit: 5 });
      for (const m of r.matches) {
        console.log(`${m.score.toFixed(3)}  ${m.file}:${m.window[0]}-${m.window[1]}`);
        console.log('  ' + m.snippet.slice(0, 200).replace(/\n/g, ' '));
      }
    } catch (e) {
      console.error('discover failed:', e.message);
      process.exit(1);
    }
  },

  stats: () => {
    const { graph } = load();
    const nByType = {};
    for (const n of graph.nodes) nByType[n.type] = (nByType[n.type] || 0) + 1;
    const rByType = {};
    for (const r of graph.refs) rByType[r.type] = (rByType[r.type] || 0) + 1;
    console.log('Nodes:', graph.nodes.length);
    for (const [t, c] of Object.entries(nByType)) console.log(`  ${t.padEnd(12)} ${c}`);
    console.log('Refs:', graph.refs.length);
    for (const [t, c] of Object.entries(rByType)) console.log(`  ${t.padEnd(15)} ${c}`);
  },
};

const help = () => {
  console.log('usage: canon <command> [args]');
  console.log('');
  console.log('Commands:');
  console.log('  validate [patch-id]       — parse + validate the whole corpus; with an arg, overlays that patch');
  console.log('  overview                  — list every entity, concept and implementation, summary line');
  console.log('  find <query>              — substring search');
  console.log('  get <id>                  — node + parent + children');
  console.log('  reveal <id> [depth]       — outgoing refs + neighbors');
  console.log('  impact <id> [depth]       — incoming refs');
  console.log('  paths <a> <b> [depth]     — shortest paths between two nodes');
  console.log('  describe <id>             — full graph slice for one entity, concept or implementation');
  console.log('  coverage <id>             — what an implementation binds of its abstraction, and what it leaves unbound');
  console.log('                              (an umbrella id covers its whole family; a part id covers that part alone)');
  console.log('  render <id>               — render an entity, concept or implementation as canonical MD on stdout');
  console.log('  align                     — re-run align.js (regenerate .patches/align-format/)');
  console.log('  reindex                   — rebuild RAG index from sources (slow first run)');
  console.log('  discover <query...>       — RAG semantic search; runs reindex if no cached index');
  console.log('  stats                     — node/ref counts by type');
  console.log('');
  console.log('MCP servers:');
  console.log('  bin/canon-read.js         — read-only MCP, stdio');
  console.log('  bin/canon-edit.js         — edit-side MCP with patch_write tool, stdio');
};

const run = (argv) => {
  const [cmd, ...args] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    help();
    return;
  }
  const fn = cmds[cmd];
  if (!fn) {
    console.error(`unknown command: ${cmd}`);
    help();
    process.exit(2);
  }
  fn(...args);
};

export { run, cmds };
