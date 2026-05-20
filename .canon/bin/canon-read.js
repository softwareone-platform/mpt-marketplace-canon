#!/usr/bin/env node
/**
 * Read-only MCP entry. stdio transport.
 *
 * Loads source MDs + .patches/ overlay once at startup, parses,
 * builds the graph, opens the MCP read server. Re-runs on restart;
 * for live edit-and-reload behaviour, use the edit-MCP companion.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRepo } from '../src/parse.js';
import { toGraph } from '../src/graph.js';
import { createKb } from '../src/kb.js';
import { createReadServer } from '../src/mcp/read.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.chdir(repoRoot);

// pin model cache to the workdir-local location unless the caller
// has explicitly set it themselves (via .mcpb env, etc.)
process.env.CANON_MODEL_CACHE ??= resolve(repoRoot, '.canon', 'model-cache');

const parsed = parseRepo('.');
const graph = toGraph(parsed.files);
const kb = createKb(graph);

const totalErr = parsed.files.reduce((a, f) => a + f.errors.length, 0);
const mentionErr = graph.mentionErrors?.length || 0;
process.stderr.write(`canon-read: ${parsed.files.length} files, ${graph.nodes.length} nodes, ${graph.refs.length} refs`);
if (totalErr || mentionErr) process.stderr.write(` (parse errors: ${totalErr}, mention errors: ${mentionErr})`);
process.stderr.write('\n');

const server = createReadServer(kb, { repoRoot });
const transport = new StdioServerTransport();
await server.connect(transport);
