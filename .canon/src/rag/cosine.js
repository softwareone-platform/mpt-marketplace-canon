/**
 * Cosine similarity between two vectors.
 *
 *   cosine(a, b) → number in [-1, 1]
 *
 * Returns 0 if either vector is all-zeros (avoids division by zero).
 * Length mismatch is permissive — only the overlap is scored. Caller
 * is responsible for vector dimension consistency.
 */

const cosine = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export { cosine };
