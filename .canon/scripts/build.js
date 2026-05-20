// esbuild → .canon/dist/{canon, canon-read, canon-edit}.js.
// SDK + yaml + transformers + onnxruntime-web stay external. dist
// still needs node_modules + .canon/templates/ alongside at runtime.

import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const distDir = resolve(repoRoot, '.canon', 'dist');

const EXTERNAL = [
  '@modelcontextprotocol/sdk',
  '@modelcontextprotocol/sdk/*',
  'yaml',
  '@huggingface/transformers',
  'onnxruntime-web',
];

const ENTRIES = [
  'bin/canon.js',
  'bin/canon-read.js',
  'bin/canon-edit.js',
];

// ESM bundles can't use require directly. Provide one for any
// downstream code that expects CommonJS-style require (e.g. embed-
// local's lazy lookups). Source files already carry the shebang.
const banner = 'import { createRequire as __createRequire } from "node:module";\n' +
  'const require = __createRequire(import.meta.url);\n';

await Promise.all(ENTRIES.map(entry => build({
  entryPoints: [resolve(repoRoot, '.canon', entry)],
  outfile: resolve(distDir, entry.replace(/^bin\//, '')),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: EXTERNAL,
  banner: { js: banner },
  logLevel: 'warning',
})));

console.log(`built ${ENTRIES.length} bundles → ${distDir}`);
