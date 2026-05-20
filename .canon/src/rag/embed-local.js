/**
 * Local sentence-embedding adapter.
 *
 *   createLocalEmbed({ model?, normalize?, dtype?, runtimeDir?, cacheDir? })
 *     → async (text) => number[]
 *
 * Wraps @huggingface/transformers v3, forced onto its WASM backend
 * (onnxruntime-web) so the bundle has no native .node modules. This
 * is what makes the package loadable inside Claude Desktop's hardened-
 * runtime UtilityProcess — native bindings signed by a non-Anthropic
 * Team ID are rejected by macOS library validation.
 *
 * Forcing the WASM branch in Node requires three tricks:
 *   1. Spoof `process.release.name` to a non-'node' value during the
 *      transformers import, so its IS_NODE_ENV check returns false
 *      and the module picks `supportedDevices = ['wasm']`.
 *   2. Import the web build via a direct file:// URL (the package's
 *      "exports" map blocks `@huggingface/transformers/dist/...`
 *      subpath imports under bare specifier resolution).
 *   3. Set `env.backends.onnx.wasm.wasmPaths` to an absolute file://
 *      URL pointing at onnxruntime-web/dist/, so its WASM loader
 *      resolves the runtime blobs from our node_modules.
 *
 * Model files are cached on disk via a tiny Cache API shim
 * (`env.customCache`) so subsequent runs reuse the ~22MB model
 * download.
 *
 * Resolution of the runtime (transformers + onnxruntime-web):
 *   1. `opts.runtimeDir` if explicitly provided
 *   2. `process.env.CANON_RUNTIME` if set (sidecar install: pin this
 *      to `<workdir>/.canon/runtime` so heavy deps live in the workdir
 *      rather than the package bundle)
 *   3. Walk-up node_modules via require.resolve (dev/local fallback)
 *
 * Same precedence for the model cache: `opts.cacheDir` →
 * `process.env.CANON_MODEL_CACHE` → `~/.cache/huggingface/transformers-cache`.
 *
 * Defaults:
 *   model      'Xenova/all-MiniLM-L6-v2' — 384-dim sentence embedding,
 *              decent retrieval baseline.
 *   normalize  true — L2-normalise output so cosine == dot product
 *              and thresholds map cleanly across queries.
 *   dtype      'q8' — quantised 8-bit, ~22MB model file. Pass 'fp32'
 *              for the full-precision variant (~87MB).
 *
 * The factory returns a single async embed function; the underlying
 * pipeline is initialised lazily on first call and reused thereafter.
 * Concurrent first calls share the same init promise.
 */

import { existsSync, promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

const createLocalEmbed = ({
  model = DEFAULT_MODEL,
  normalize = true,
  dtype = 'q8',
  runtimeDir,
  cacheDir,
} = {}) => {
  let extractorPromise = null;

  const getExtractor = () => {
    if (!extractorPromise) extractorPromise = initExtractor({ model, dtype, runtimeDir, cacheDir });
    return extractorPromise;
  };

  const embed = async (text) => {
    if (typeof text !== 'string') {
      throw new Error('embed-local: input must be a string');
    }
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize });
    return Array.from(output.data);
  };

  const warmup = async () => { await getExtractor(); };

  embed.model = model;
  embed.warmup = warmup;

  return embed;
};

const initExtractor = async ({ model, dtype, runtimeDir, cacheDir }) => {
  const root = resolveRuntimeDir(runtimeDir);
  const transformers = await loadWebTransformers(root);
  const { pipeline, env } = transformers;

  // We control caching ourselves; both built-in caches are tied to
  // browser-only globals (Cache API / FS module that the web bundle
  // doesn't import).
  env.allowLocalModels = false;
  env.useFSCache = false;
  env.useBrowserCache = false;

  env.useCustomCache = true;
  env.customCache = createFSCache(resolveCacheDir(cacheDir));

  env.backends.onnx.wasm.wasmPaths = resolveWasmPaths(root);

  return pipeline('feature-extraction', model, { dtype });
};

const resolveRuntimeDir = (explicit) => {
  if (explicit) return explicit;
  if (process.env.CANON_RUNTIME) return process.env.CANON_RUNTIME;
  return null;
};

const resolveCacheDir = (explicit) => {
  if (explicit) return explicit;
  if (process.env.CANON_MODEL_CACHE) return process.env.CANON_MODEL_CACHE;
  return resolve(homedir(), '.cache', 'huggingface', 'transformers-cache');
};

const loadWebTransformers = async (runtimeDir) => {
  // The web build's IS_NODE_ENV check reads process.release.name === 'node';
  // flip it for the duration of the import so the module-init code picks
  // supportedDevices=['wasm'] (else we get "Unsupported device").
  const realRelease = process.release;
  Object.defineProperty(process, 'release', {
    value: { ...realRelease, name: 'browser' },
    configurable: true,
  });
  try {
    const webBuild = resolveTransformersWebBuild(runtimeDir);
    return await import(pathToFileURL(webBuild).href);
  } finally {
    Object.defineProperty(process, 'release', {
      value: realRelease,
      configurable: true,
    });
  }
};

const resolveTransformersWebBuild = (runtimeDir) => {
  // The package's exports map blocks `./package.json` and `./dist/...`
  // subpath imports under bare resolution, so we have to find the dist
  // dir ourselves and import transformers.web.js directly.
  if (runtimeDir) {
    const fromRuntime = resolve(
      runtimeDir, 'node_modules/@huggingface/transformers/dist/transformers.web.js',
    );
    if (!existsSync(fromRuntime)) {
      throw new Error(
        `embed-local: CANON_RUNTIME=${runtimeDir} but transformers web build not found at `
        + `${fromRuntime}. Install @huggingface/transformers + onnxruntime-web into that runtime first.`,
      );
    }
    return fromRuntime;
  }
  // Dev fallback: resolve the default node entry (lives in dist/) and
  // pivot to its sibling transformers.web.js.
  const nodeEntry = require.resolve('@huggingface/transformers');
  return resolve(dirname(nodeEntry), 'transformers.web.js');
};

const resolveWasmPaths = (runtimeDir) => {
  // onnxruntime-web's WASM loader treats relative wasmPaths as URLs
  // relative to its own module location, not cwd. Hand it an absolute
  // file:// URL so dist/ort-wasm-*.wasm/.mjs resolve cleanly.
  if (runtimeDir) {
    const distDir = resolve(runtimeDir, 'node_modules/onnxruntime-web/dist');
    return pathToFileURL(distDir + '/').href;
  }
  const nodeEntry = require.resolve('onnxruntime-web');
  const distDir = dirname(nodeEntry);
  return pathToFileURL(distDir + '/').href;
};

// Minimal Cache API surface (match + put) backed by the local filesystem.
// Transformers.js calls this for tokenizer.json / config.json / *.onnx.
const createFSCache = (rootDir) => ({
  async match(request) {
    const url = typeof request === 'string' ? request : request.url;
    const path = urlToCachePath(rootDir, url);
    if (!existsSync(path)) return undefined;
    const buf = await fs.readFile(path);
    return new Response(buf);
  },
  async put(request, response) {
    const url = typeof request === 'string' ? request : request.url;
    const path = urlToCachePath(rootDir, url);
    await fs.mkdir(dirname(path), { recursive: true });
    const buf = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(path, buf);
  },
});

const urlToCachePath = (root, url) => {
  // E.g. https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json
  // → <root>/huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json
  const u = new URL(url);
  const parts = [u.host, ...u.pathname.split('/').filter(Boolean)];
  return resolve(root, ...parts);
};

export { createLocalEmbed, DEFAULT_MODEL };
