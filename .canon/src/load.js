// Patch-aware MD loader. originals + .patches/<id>/<base>/ overlays
// applied in alphabetic patch-id order; last write per relPath wins.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PATCHES_DIR = '.patches';

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

const listPatches = (repoRoot) => {
  const dir = join(repoRoot, PATCHES_DIR);
  if (!isDir(dir)) return [];

  return readdirSync(dir)
    .filter(name => !name.startsWith('.') && !name.startsWith('_'))
    .filter(name => isDir(join(dir, name)))
    .sort();
};

const listMd = (dir) =>
  isDir(dir) ? readdirSync(dir).filter(n => n.endsWith('.md')).sort() : [];

const readEntry = (relPath, absDir, source) => ({
  relPath,
  absPath: join(absDir, relPath),
  content: readFileSync(join(absDir, relPath), 'utf8'),
  source,
});

const loadMdSet = (repoRoot, baseDir) => {
  const baseAbs = join(repoRoot, baseDir);
  const map = new Map();

  for (const name of listMd(baseAbs)) {
    map.set(name, readEntry(name, baseAbs, 'original'));
  }

  for (const patchId of listPatches(repoRoot)) {
    const dir = join(repoRoot, PATCHES_DIR, patchId, baseDir);
    for (const name of listMd(dir)) map.set(name, readEntry(name, dir, `patch:${patchId}`));
  }

  return [...map.values()].sort((a, b) => a.relPath.localeCompare(b.relPath));
};

export { loadMdSet, listPatches };
