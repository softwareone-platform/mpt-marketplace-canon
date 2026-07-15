#!/usr/bin/env node
/**
 * Edit MCP entry. stdio transport.
 *
 * Loads the graph at startup, opens MCP server with read + write
 * tools. Each `patch_write` reloads in-memory state so the agent
 * sees its own writes immediately.
 *
 * Apply (committing a patch into objects/) is NOT exposed here —
 * that is a deliberate human action via a separate `bin/apply.js`.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEditServer } from '../src/mcp/edit.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.chdir(repoRoot);

process.env.CANON_MODEL_CACHE ??= resolve(repoRoot, '.canon', 'model-cache');

const pkgVersion = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;

process.stderr.write(`canon-edit: serving from ${repoRoot}\n`);

const server = createEditServer(repoRoot, { version: pkgVersion });
const transport = new StdioServerTransport();
await server.connect(transport);
