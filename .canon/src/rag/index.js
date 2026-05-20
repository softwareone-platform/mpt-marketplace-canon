/**
 * Concept-to-prose discovery for source MD files.
 *
 *   createRag({ window?, precision?, embed }) → Rag
 *
 *   Rag = {
 *     reindex(sources)               → Promise<IndexEntry[]>
 *     discover(query, index, opts?)  → Promise<DiscoverResult>
 *   }
 *
 * Pure factory. Settings:
 *
 *   window     'paragraph' (default) | 'lines:N'
 *   precision  cosine-similarity threshold in [-1, 1]; matches with
 *              score < precision are filtered out. Default 0 — no
 *              filter, return top-`limit` sorted by score and let the
 *              caller decide. Empty results when there's clearly a
 *              best-but-weak match are worse UX than a low-confidence
 *              suggestion with a visible score, so the gate is opt-in.
 *              Override per call via discover(query, index, { precision }).
 *   embed      async (text: string) → number[]   — required adapter
 *
 * Shapes:
 *
 *   IndexEntry      = { file, window: [startLine, endLine], text, vector }
 *   Match           = { file, window, snippet, score }
 *   DiscoverResult  = { matches: Match[], stats?: Stats }
 *   Stats           = { total, distribution: {max,p75,p50,p25,min}, aboveThreshold: {0.5,0.4,0.3,0.2} }
 *
 * Discover query forms:
 *
 *   discover('tree', index)
 *     — single string. Embedded once, search by that vector.
 *
 *   discover(['tree', 'softwood', 'lumber'], index)
 *     — array of synonyms. Each is embedded; vectors averaged + L2-
 *       normalised; search by the centroid. Better signal than a
 *       concatenated string for synonym fields, because it's the
 *       geometric centre of the conceptual cluster rather than a
 *       single longer-token sequence.
 *
 * Discover modes:
 *
 *   discover(query, index, { precision: 0.4 })
 *     — filter out matches below the cosine threshold. Apply when the
 *       baseline is noisy and you want only strong signal.
 *
 *   discover(query, index, { stats: true })
 *     — return only score distribution + threshold counts, NO snippets.
 *       Use to calibrate `precision` for a follow-up real call without
 *       pulling content into context. Stats include max/p75/p50/p25/min
 *       and counts of matches above 0.5/0.4/0.3/0.2.
 *
 * Two reindex/read scenarios — and only two:
 *
 *   1. reindex on apply: caller passes the post-apply sources
 *      ([{ name, content }] from workspace), gets back IndexEntry[].
 *      Caller persists. Full rebuild — no incremental, no watch.
 *
 *   2. discover on query: caller reads the persisted index, passes it
 *      with a query (string or string[]). Returns ranked file/window
 *      matches, or just stats if requested.
 *
 * RAG knows nothing about graph structure, schema, patches, or live
 * registry — only sources. It carries no domain semantics into the
 * matches; the only product is "where in the prose does this concept
 * sit", localised to file + window for downstream editing.
 */

import { chunkText, parseWindow } from './chunker.js';
import { cosine } from './cosine.js';

const STATS_THRESHOLDS = [0.5, 0.4, 0.3, 0.2];

const createRag = ({ window = 'paragraph', precision = 0, embed } = {}) => {
  if (typeof embed !== 'function') {
    throw new Error('rag: embed (async (text) => number[]) is required');
  }
  parseWindow(window);
  if (typeof precision !== 'number' || precision < -1 || precision > 1) {
    throw new Error(`rag: precision must be a number in [-1, 1] (got ${precision})`);
  }

  const reindex = async (sources) => {
    const out = [];
    for (const src of sources ?? []) {
      const file = src?.name;
      const content = src?.content;
      if (typeof file !== 'string' || typeof content !== 'string') continue;
      for (const chunk of chunkText(content, window)) {
        const vector = await embed(chunk.text);
        if (!Array.isArray(vector)) {
          throw new Error(`rag: embed adapter returned non-array for "${file}" window ${chunk.window.join('-')}`);
        }
        out.push({ file, window: chunk.window, text: chunk.text, vector });
      }
    }

    return out;
  };

  const discover = async (query, index, opts = {}) => {
    const { limit = 10, precision: callPrecision, stats = false } = opts;
    const threshold = typeof callPrecision === 'number' ? callPrecision : precision;

    const queries = normalizeQueries(query);
    if (queries.length === 0) {
      return stats ? { matches: [], stats: emptyStats() } : { matches: [] };
    }
    if (!Array.isArray(index) || index.length === 0) {
      return stats ? { matches: [], stats: emptyStats() } : { matches: [] };
    }

    const qVec = await embedCentroid(queries, embed);

    const scored = [];
    for (const entry of index) {
      if (!entry || !Array.isArray(entry.vector)) continue;
      scored.push({ score: cosine(qVec, entry.vector), entry });
    }
    scored.sort((a, b) => b.score - a.score);

    if (stats) {
      return { matches: [], stats: computeStats(scored.map(s => s.score)) };
    }

    const matches = [];
    for (const s of scored) {
      if (s.score < threshold) break;  // sorted desc; stop at first miss
      matches.push({
        file: s.entry.file,
        window: s.entry.window,
        snippet: s.entry.text,
        score: s.score,
      });
      if (matches.length >= Math.max(1, limit | 0)) break;
    }

    return { matches };
  };

  return Object.freeze({ reindex, discover });
};

const normalizeQueries = (query) => {
  if (typeof query === 'string') return query.length > 0 ? [query] : [];
  if (Array.isArray(query)) {
    return query.filter((q) => typeof q === 'string' && q.length > 0);
  }
  return [];
};

const embedCentroid = async (queries, embed) => {
  const vectors = [];
  for (const q of queries) {
    const v = await embed(q);
    if (!Array.isArray(v)) {
      throw new Error('rag: embed adapter returned non-array for query');
    }
    vectors.push(v);
  }
  if (vectors.length === 1) return vectors[0];
  return l2Normalize(meanVector(vectors));
};

const meanVector = (vectors) => {
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) mean[i] += v[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= vectors.length;
  return mean;
};

const l2Normalize = (v) => {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  const out = new Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
};

const computeStats = (scoresDesc) => {
  const total = scoresDesc.length;
  const aboveThreshold = {};
  for (const t of STATS_THRESHOLDS) {
    aboveThreshold[t.toFixed(1)] = scoresDesc.filter((s) => s >= t).length;
  }
  return {
    total,
    distribution: {
      max: total > 0 ? scoresDesc[0] : null,
      p75: pickPercentile(scoresDesc, 0.75),
      p50: pickPercentile(scoresDesc, 0.50),
      p25: pickPercentile(scoresDesc, 0.25),
      min: total > 0 ? scoresDesc[total - 1] : null,
    },
    aboveThreshold,
  };
};

const pickPercentile = (sortedDesc, p) => {
  // sortedDesc is descending; pick the score where p% of all scores
  // are ≤ this value. For p=0.75 we want a high-end score; for p=0.25
  // a low-end score.
  if (sortedDesc.length === 0) return null;
  const idx = Math.round((1 - p) * (sortedDesc.length - 1));
  return sortedDesc[idx];
};

const emptyStats = () => ({
  total: 0,
  distribution: { max: null, p75: null, p50: null, p25: null, min: null },
  aboveThreshold: Object.fromEntries(STATS_THRESHOLDS.map((t) => [t.toFixed(1), 0])),
});

export { createRag };
export { chunkText, parseWindow } from './chunker.js';
export { cosine } from './cosine.js';
