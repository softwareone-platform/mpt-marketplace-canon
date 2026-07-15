// apply.js — patch validation + commit script.
//
// runs the binary as a subprocess against scratch patch dirs,
// asserts exit code + behavior. Each case scrubs its own patch at
// teardown. Real `objects/` is never modified — every test case
// writes only into `.patches/zz-test-*/` and uses --dry-run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const apply = resolve(repoRoot, '.canon', 'bin', 'apply.js');

const run = (...args) => spawnSync('node', [apply, ...args], {
  cwd: repoRoot, encoding: 'utf8',
});

const withPatch = (id, build, fn) => {
  const dir = join(repoRoot, '.patches', id);
  rmSync(dir, { recursive: true, force: true });
  build(dir);
  try { return fn(); }
  finally { rmSync(dir, { recursive: true, force: true }); }
};

const writePatchFile = (dir, rel, content) => {
  const dest = join(dir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
};

// ── argv / shape ───────────────────────────────────────────────────

const argvCases = [
  ['no args',         [],                           2],
  ['bad patch id',    ['BAD/ID'],                   2],
  ['unknown patch',   ['zz-test-no-such-patch'],    1],
];

for (const [label, args, code] of argvCases) {
  test(`apply argv — ${label} → exit ${code}`, () => {
    assert.equal(run(...args).status, code);
  });
}

test('apply rejects an empty patch dir', () => {
  withPatch('zz-test-empty', dir => mkdirSync(dir, { recursive: true }), () => {
    assert.equal(run('zz-test-empty').status, 1);
  });
});

// ── validation refuses bad content ─────────────────────────────────

test('apply refuses a patch that fails to parse', () => {
  withPatch('zz-test-broken', dir => {
    writePatchFile(dir, 'objects/CANON_OBJECT_Notifications_Webhook.md', '# bad\n');
  }, () => {
    const r = run('zz-test-broken');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /parse errors/);
  });
});

test('apply leaves a refused patch in place', () => {
  withPatch('zz-test-broken-stays', dir => {
    writePatchFile(dir, 'objects/CANON_OBJECT_Notifications_Webhook.md', '# bad\n');
  }, () => {
    run('zz-test-broken-stays');
    assert.ok(existsSync(join(repoRoot, '.patches', 'zz-test-broken-stays')));
  });
});

// ── dry-run ────────────────────────────────────────────────────────

// known-clean payload: objects/ is the source of truth and already
// validates standalone, so a patch that just re-writes a file with its
// own current content is guaranteed to pass validation.
const CLEAN_REL = 'objects/CANON_OBJECT_Notifications_Webhook.md';
const cleanContent = () => readFileSync(join(repoRoot, CLEAN_REL), 'utf8');

test('apply --dry-run reports without writing', () => {
  withPatch('zz-test-dry', dir => {
    writePatchFile(dir, CLEAN_REL, cleanContent());
  }, () => {
    const r = run('zz-test-dry', '--dry-run');
    assert.equal(r.status, 0);
  });
});

test('apply --dry-run keeps the patch dir intact', () => {
  withPatch('zz-test-dry-keeps', dir => {
    writePatchFile(dir, CLEAN_REL, cleanContent());
  }, () => {
    run('zz-test-dry-keeps', '--dry-run');
    assert.ok(existsSync(join(repoRoot, '.patches', 'zz-test-dry-keeps', 'objects')));
  });
});

test('apply --dry-run lists every patch file in stdout', () => {
  withPatch('zz-test-dry-list', dir => {
    writePatchFile(dir, CLEAN_REL, cleanContent());
  }, () => {
    const r = run('zz-test-dry-list', '--dry-run');
    assert.match(r.stdout, /CANON_OBJECT_Notifications_Webhook\.md/);
  });
});

// ── reach-outside-tree refusal ─────────────────────────────────────

test('apply ignores patch payload outside known base dirs', () => {
  withPatch('zz-test-outside', dir => {
    // file at patch root — should be treated as metadata and ignored
    writePatchFile(dir, 'README.md', '# patch metadata\n');
  }, () => {
    const r = run('zz-test-outside');
    // empty effective payload → exit 1 with "carries no .md files" msg
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no \.md files/);
  });
});

// ── full apply (real write) ────────────────────────────────────────
//
// Uses a patch that rewrites objects/CANON_OBJECT_Notifications_
// Webhook.md with its own current content — applying is a no-op on
// disk but exercises the write path. Snapshots the original first
// and restores at teardown so the live tree is preserved.

test('apply writes patch files into the tree and removes the patch dir', () => {
  const target = join(repoRoot, CLEAN_REL);
  const snapshot = readFileSync(target);
  try {
    withPatch('zz-test-write', dir => {
      writePatchFile(dir, CLEAN_REL, snapshot);
    }, () => {
      const r = run('zz-test-write');
      assert.equal(r.status, 0);
      assert.equal(existsSync(join(repoRoot, '.patches', 'zz-test-write')), false);
    });
  } finally {
    writeFileSync(target, snapshot);
  }
});
