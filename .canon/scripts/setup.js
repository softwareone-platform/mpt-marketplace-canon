#!/usr/bin/env node
// One-shot post-clone setup. Idempotent — re-run after the workdir
// moves, or to refresh the bundles / model.
//
// 1. verify the optional deps (@huggingface/transformers + onnxruntime-web)
// 2. warm up the embedding model into .canon/model-cache/
// 3. build the dist bundles via build.js
// 4. emit dist/canon-read.mcpb / dist/canon-edit.mcpb at repo root
//    with absolute paths baked in for THIS workdir
// 5. emit dist/claude_desktop_config.snippet.json — manual-install fallback

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import AdmZip from 'adm-zip';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const pkgVersion = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;
const internalDist = join(repoRoot, '.canon', 'dist');     // bundled JS, RAG cache — devs
const userDist = join(repoRoot, 'dist');                    // .mcpb + snippet — end users
const modelCacheDir = join(repoRoot, '.canon', 'model-cache');
const rel = (abs) => relative(repoRoot, abs);

process.env.CANON_MODEL_CACHE = modelCacheDir;

const step = (n, label) => console.log(`\n[${n}/5] ${label}`);

// ── 1. optional deps ───────────────────────────────────────────────

step(1, 'optional deps');

const optionalDeps = ['@huggingface/transformers', 'onnxruntime-web'];
const missing = optionalDeps.filter(name =>
  !existsSync(join(repoRoot, 'node_modules', ...name.split('/'))));

if (missing.length > 0) {
  console.log(`installing ${missing.join(', ')}`);
  const r = spawnSync('npm', ['install', '--include=optional'], { cwd: repoRoot, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('npm install failed');
    process.exit(r.status || 1);
  }
} else {
  console.log('present');
}

// ── 2. warm up the model ───────────────────────────────────────────

step(2, `warm up embedding model → ${rel(modelCacheDir)}`);

mkdirSync(modelCacheDir, { recursive: true });

try {
  const { createLocalEmbed } = await import('../src/rag/embed-local.js');
  const embed = createLocalEmbed({ cacheDir: modelCacheDir });
  const t0 = Date.now();
  await embed('warmup');
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (e) {
  console.error(`failed: ${e.message}`);
  console.error('  RAG will not work until this is fixed; the MCP servers themselves still run.');
}

// ── 3. build dist bundles ──────────────────────────────────────────

step(3, `build bundles → ${rel(internalDist)}`);
{
  const r = spawnSync('node', [join(here, 'build.js')], {
    cwd: repoRoot,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

// ── 4. emit .mcpb manifests (user-facing) ──────────────────────────

step(4, `emit .mcpb extensions → ${rel(userDist)}`);

const workdirName = basename(repoRoot);
const KINDS = [
  ['read', 'Read', 'Read-only access to the canon graph (overview / find / reveal / impact / paths / discover).'],
  ['edit', 'Edit', 'Read access plus patch_write / patch_read / patch_render against .patches/.'],
];

mkdirSync(userDist, { recursive: true });

for (const [kind, label, description] of KINDS) {
  const outFile = join(userDist, `canon-${kind}.mcpb`);
  const entry = join(internalDist, `canon-${kind}.js`);

  const launcher = `import(${JSON.stringify(pathToFileURL(entry).href)});\n`;

  const manifest = JSON.stringify({
    dxt_version: '0.1',
    name: `canon-${kind}-${workdirName}`,
    display_name: `Canon ${label} — ${workdirName}`,
    version: pkgVersion,
    description,
    author: { name: workdirName },
    server: {
      type: 'node',
      entry_point: 'server/index.mjs',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/server/index.mjs'],
        env: { CANON_MODEL_CACHE: modelCacheDir },
      },
    },
  }, null, 2) + '\n';

  rmSync(outFile, { recursive: true, force: true });

  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(manifest, 'utf8'));
  zip.addFile('server/index.mjs', Buffer.from(launcher, 'utf8'));
  zip.writeZip(outFile);

  console.log(`  ${rel(outFile)}`);
}

// ── 5. claude_desktop_config snippet ───────────────────────────────

step(5, 'emit claude_desktop_config snippet');

const snippetPath = join(userDist, 'claude_desktop_config.snippet.json');
const snippet = { mcpServers: {} };
for (const [kind] of KINDS) {
  snippet.mcpServers[`canon-${kind}-${workdirName}`] = {
    command: 'node',
    args: [join(internalDist, `canon-${kind}.js`)],
    env: { CANON_MODEL_CACHE: modelCacheDir },
  };
}
writeFileSync(snippetPath, JSON.stringify(snippet, null, 2) + '\n');
console.log(`  ${rel(snippetPath)}`);

// ── done ───────────────────────────────────────────────────────────

console.log('');
console.log('install in Claude Desktop:');
console.log(`  open ${rel(join(userDist, 'canon-read.mcpb'))}`);
console.log(`  open ${rel(join(userDist, 'canon-edit.mcpb'))}`);
console.log('');
console.log('or paste the snippet manually:');
console.log(`  cat ${rel(snippetPath)}`);
console.log('');
console.log('then restart Claude Desktop.');
