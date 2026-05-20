#!/usr/bin/env node
/**
 * CLI entry. Thin wrapper around src/cli.js dispatcher.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../src/cli.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.chdir(repoRoot);

run(process.argv.slice(2));
