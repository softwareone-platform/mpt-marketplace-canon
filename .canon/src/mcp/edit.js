// Edit MCP. Agent submits whole-file replacements; server persists
// as a patch, parses+validates, reports back. Files are the unit of
// change — no diff format.
//
// Apply (committing a patch into objects/) is deliberately NOT here;
// that's a human action via a separate bin/apply.js.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parseRepo } from '../parse.js';
import { toGraph, ROOT_TYPES } from '../graph.js';
import { createKb } from '../kb.js';
import { validate, summarize } from '../validate.js';
import { renderNode } from '../render.js';
import { tools as readTools } from './read.js';

const PATCHES = '.patches';

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

// `options` is forwarded to parseRepo. Pass { patchIds: [id] } to
// overlay one patch on top of objects/; omit to load objects/ alone.
const reload = (repoRoot, options) => {
  const parsed = parseRepo(repoRoot, options);
  const graph = toGraph(parsed.files);
  const kb = createKb(graph);
  const errors = validate(graph);
  const parseErrors = parsed.files.flatMap(f => f.errors);
  const mentionErrors = graph.mentionErrors || [];
  return { kb, graph, parsed, errors, parseErrors, mentionErrors };
};

const ensurePatchDir = (repoRoot, patchId, base) => {
  const dir = join(repoRoot, PATCHES, patchId, base);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const writeTools = (repoRoot, ctx) => ({
  patch_list: {
    description: 'List every patch directory under .patches/. Patches are siblings — each is an independent overlay over objects/, never combined. Pick a target id (existing or new) before patch_write.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => {
      const dir = join(repoRoot, PATCHES);
      if (!isDir(dir)) return { patches: [] };
      const ids = readdirSync(dir)
        .filter(name => !name.startsWith('.') && isDir(join(dir, name)))
        .sort();
      return { patches: ids };
    },
  },

  patch_files: {
    description: 'List every file inside one patch (relative paths under that patch directory). Use to see what a sibling patch already touches before reusing or forking its id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id }) => {
      const root = join(repoRoot, PATCHES, id);
      if (!isDir(root)) return { error: `patch not found: ${id}`, files: [] };
      const out = [];
      const walk = (dir, prefix) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          const rel = prefix ? `${prefix}/${name}` : name;
          if (isDir(full)) walk(full, rel);
          else if (name.endsWith('.md')) out.push(rel);
        }
      };
      walk(root, '');
      return { patch: id, files: out };
    },
  },

  patch_read: {
    description: 'Read the effective content of a path under a patch — the patch override if the file already exists in this patch, otherwise the original at the repo root. Use to start from current state before composing a whole-file replacement. The patch under inspection is in isolation: sibling patches are never overlaid.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        path: { type: 'string', description: 'Path relative to the patch root, e.g. objects/CANON_OBJECT_Notifications_Webhook.md' },
      },
      required: ['id', 'path'],
      additionalProperties: false,
    },
    handler: ({ id, path }) => {
      const patched = join(repoRoot, PATCHES, id, path);
      const original = join(repoRoot, path);
      if (existsSync(patched)) return { source: `patch:${id}`, path, content: readFileSync(patched, 'utf8') };
      if (existsSync(original)) return { source: 'original', path, content: readFileSync(original, 'utf8') };
      return { error: `not found in patch ${id} or original`, path };
    },
  },

  patch_write: {
    description: 'Write whole-file replacements into a patch. Each entry MUST be the complete file content; partial / diff-style updates are not supported. After writing, the server reloads the graph with ONLY this patch overlaid on objects/ (sibling patches in .patches/ are ignored — same isolation model as bin/apply.js) and returns parse + validate results so you can see whether the patch is clean. Pre-existing file in the patch is overwritten. The patch is NOT committed — a human runs bin/apply.js <id> to land it into objects/.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Patch id (alphanumeric / dash). Created on first write.' },
        files: {
          type: 'array',
          description: 'List of file replacements.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path relative to the patch root, e.g. objects/CANON_OBJECT_*.md' },
              content: { type: 'string', description: 'Full file content. Trailing newline included.' },
            },
            required: ['path', 'content'],
            additionalProperties: false,
          },
        },
      },
      required: ['id', 'files'],
      additionalProperties: false,
    },
    handler: ({ id, files }) => {
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) {
        return { error: `invalid patch id: must match [a-zA-Z0-9-]+` };
      }
      const written = [];
      for (const f of files) {
        if (typeof f.path !== 'string' || typeof f.content !== 'string') {
          return { error: `bad file entry: { path, content } both required as strings` };
        }
        // Disallow path traversal.
        if (f.path.includes('..') || f.path.startsWith('/')) {
          return { error: `unsafe path: ${f.path}` };
        }
        const abs = join(repoRoot, PATCHES, id, f.path);
        const subdir = abs.slice(0, abs.lastIndexOf('/'));
        mkdirSync(subdir, { recursive: true });
        writeFileSync(abs, f.content);
        written.push(f.path);
      }

      // Reload + validate with THIS patch overlaid (isolation: other
      // patches in .patches/ are ignored — same model as apply).
      ctx.state = reload(repoRoot, { patchIds: [id] });
      return {
        patch: id,
        written,
        parse_errors: ctx.state.parseErrors.length,
        mention_errors: ctx.state.mentionErrors.length,
        validation_errors: ctx.state.errors.length,
        validation_summary: summarize(ctx.state.errors),
        first_errors: ctx.state.errors.slice(0, 5),
      };
    },
  },

  patch_render: {
    description: 'Render every entity, Concept and Implementation in the current graph as canonical MD. Use to bootstrap a new patch from graph state, OR to inspect what render.js produces. Returns one file per node (path + content) — entities under objects/, concepts under concepts/, implementations under implementations/.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of entity, concept or implementation ids. If omitted, renders all of them.',
        },
      },
      additionalProperties: false,
    },
    handler: ({ ids } = {}) => {
      const kb = ctx.state.kb;
      const renderable = ids
        ? ids.map(id => kb.get(id)).filter(n => n && ROOT_TYPES.includes(n.type))
        : ROOT_TYPES.flatMap(t => kb.list(t));
      const files = renderable.map(n => ({
        path: pathFor(n),
        content: renderNode(kb, n.id),
      }));
      return { files };
    },
  },
});

// Reverse of the parse-side filename derivation. We don't keep the
// original file mapping on the node, so synthesize a stable form.
const pathFor = (node) => {
  const tail = node.id.split(':').slice(-1)[0]
    .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (node.type === 'concept') return `concepts/CANON_CONCEPT_${tail}.md`;
  if (node.type === 'implementation') return `implementations/CANON_IMPLEMENTATION_${tail}.md`;
  const ns = node.meta?.namespace || 'Catalog';
  return `objects/CANON_OBJECT_${ns}_${tail}.md`;
};

const createEditServer = (repoRoot, { name = 'canon-edit', version = '0.1.0' } = {}) => {
  const ctx = { state: reload(repoRoot) };

  const server = new Server({ name, version }, { capabilities: { tools: {} } });

  // Combine read + write. Read tools reuse a kb closure; we wrap them
  // to always pull the current kb from ctx.state.
  const buildReadTools = () => {
    const t = readTools(ctx.state.kb, repoRoot);
    // Re-bind handlers to use ctx.state at call time, not the snapshot
    // captured at server start.
    return Object.fromEntries(Object.entries(t).map(([name, def]) => [
      name,
      {
        ...def,
        handler: (args) => {
          const fresh = readTools(ctx.state.kb, repoRoot);
          return fresh[name].handler(args);
        },
      },
    ]));
  };

  const tbl = {
    ...buildReadTools(),
    ...writeTools(repoRoot, ctx),
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(tbl).map(([name, t]) => ({
      name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    const t = tbl[name];
    if (!t) return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
    try {
      const result = await t.handler(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `error: ${e.message}` }], isError: true };
    }
  });

  return server;
};

export { createEditServer };
