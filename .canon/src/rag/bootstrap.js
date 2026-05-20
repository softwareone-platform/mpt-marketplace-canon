// RAG bootstrap + persistence.
//
// Index source = patched `objects/*.md` (same merge the parser sees).
// Stored at `.canon/dist/rag.jsonl` as one JSON-per-line, full rebuild
// only (no incremental).
//
// Heavy deps (@huggingface/transformers + onnxruntime-web) are needed
// only at reindex time. If they're not installed, a cached index is
// still usable for `discover` — reindex throws with an install hint.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createRag } from './index.js';
import { loadMdSet } from '../load.js';

const INDEX_FILE = '.canon/dist/rag.jsonl';

// ── sources ────────────────────────────────────────────────────────

const sourcesFor = (repoRoot) =>
  loadMdSet(repoRoot, 'objects').map(({ relPath, content }) => ({
    name: relPath, content,
  }));

// ── persistence ────────────────────────────────────────────────────

const loadIndex = (repoRoot) => {
  const path = join(repoRoot, INDEX_FILE);
  if (!existsSync(path)) return null;

  return readFileSync(path, 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l));
};

const writeIndex = (repoRoot, index) => {
  const path = join(repoRoot, INDEX_FILE);
  mkdirSync(join(repoRoot, '.canon', 'dist'), { recursive: true });
  writeFileSync(path, index.map(e => JSON.stringify(e)).join('\n') + '\n');
};

// ── lazy embed adapter ─────────────────────────────────────────────

let embedPromise = null;

const getEmbed = async () => {
  if (embedPromise) return embedPromise;
  embedPromise = (async () => {
    try {
      const { createLocalEmbed } = await import('./embed-local.js');
      return createLocalEmbed({});
    } catch (e) {
      throw new Error(
        `RAG embedding requires @huggingface/transformers + onnxruntime-web. `
        + `Install via: npm install @huggingface/transformers@^3 onnxruntime-web. `
        + `Underlying error: ${e.message}`
      );
    }
  })();
  return embedPromise;
};

// ── build / ensure ─────────────────────────────────────────────────

const buildIndex = async (repoRoot) => {
  const embed = await getEmbed();
  const rag = createRag({ embed });
  const index = await rag.reindex(sourcesFor(repoRoot));
  writeIndex(repoRoot, index);
  return index;
};

// load cached index if present, else rebuild. Never silently rebuilds
// on staleness — caller passes force=true to refresh.
const ensureIndex = async (repoRoot, { force = false } = {}) => {
  let index = force ? null : loadIndex(repoRoot);
  if (!index) index = await buildIndex(repoRoot);

  // index may have come from disk — embed not initialised yet, lazy it
  let embedFn = null;
  const lazyRag = createRag({
    embed: async (text) => {
      if (!embedFn) embedFn = await getEmbed();
      return embedFn(text);
    },
  });

  return { rag: lazyRag, index };
};

const discover = async (repoRoot, query, opts = {}) => {
  const { rag, index } = await ensureIndex(repoRoot);
  return rag.discover(query, index, opts);
};

export { sourcesFor, loadIndex, writeIndex, buildIndex, ensureIndex, discover };
