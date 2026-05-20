/**
 * Source chunkers — pure functions that split MD content into
 * addressable windows. Each chunk is `{ window: [startLine, endLine],
 * text }` where line numbers are 1-indexed and inclusive.
 *
 * Two strategies:
 *
 *   'paragraph'   — split on blank lines (\n\n+); each non-empty run
 *                   of consecutive non-blank lines becomes a chunk.
 *   'lines:N'     — fixed N-line buckets, no overlap; fully-blank
 *                   buckets are skipped.
 *
 * Adding strategies is a matter of extending parseWindow + chunkText.
 */

const parseWindow = (spec) => {
  if (spec === 'paragraph') return { kind: 'paragraph' };
  const m = /^lines:(\d+)$/.exec(spec ?? '');
  if (m) {
    const n = Number(m[1]);
    if (n > 0) return { kind: 'lines', n };
  }
  throw new Error(`rag: unknown window "${spec}" (expected 'paragraph' or 'lines:N')`);
};

const chunkParagraph = (lines) => {
  const chunks = [];
  let start = -1;
  let buf = [];
  const flush = (endLine) => {
    if (buf.length === 0) return;
    chunks.push({ window: [start + 1, endLine + 1], text: buf.join('\n') });
    buf = [];
    start = -1;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') {
      flush(i - 1);
    } else {
      if (start === -1) start = i;
      buf.push(line);
    }
  }
  flush(lines.length - 1);

  return chunks;
};

const chunkLines = (lines, n) => {
  const chunks = [];
  for (let i = 0; i < lines.length; i += n) {
    const slice = lines.slice(i, i + n);
    if (slice.every((l) => l.trim() === '')) continue;
    chunks.push({
      window: [i + 1, i + slice.length],
      text: slice.join('\n'),
    });
  }

  return chunks;
};

const chunkText = (content, windowSpec) => {
  if (typeof content !== 'string' || content.length === 0) return [];
  const w = parseWindow(windowSpec);
  const lines = content.split('\n');
  if (w.kind === 'paragraph') return chunkParagraph(lines);

  return chunkLines(lines, w.n);
};

export { parseWindow, chunkText };
