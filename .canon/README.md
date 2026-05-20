# `.canon/`

Implementation of the canon app. The repo root holds source-of-truth markdown (`objects/`, `platform/`, `preamble/`, `questions/`); this directory holds the code that parses those MDs into a graph and exposes them over MCP and the CLI.

## Layout

```
.canon/
  bin/
    canon.js            CLI dispatcher
    canon-read.js       read-only MCP entry
    canon-edit.js       edit MCP entry
    apply.js            commit a patch into the working tree
  src/
    schema.js           node + ref types (hard-coded)
    template.js         tiny template DSL — compile + match
    parse.js            MD → per-section data + prose
    graph.js            sections → { nodes, refs }
    kb.js               find / reveal / impact / paths / overview
    validate.js         schema-driven graph check
    render.js           graph slice → canonical MD
    load.js             patch-aware MD loader
    cli.js              argv dispatcher
    mcp/
      read.js           kb queries as tools
      edit.js           read tools + patch_write / patch_read / patch_render
    rag/                local WASM embeddings + cosine search
  templates/*.md        one per section, drives parse + render
  scripts/
    align.js            objects/ → .patches/align-format/
    build.js            esbuild → dist/
    dump-entity.js      audit aid
    audit-counts.js     audit aid
  dist/                 built bundles (gitignored)
```

## How it hangs together

- **MD is the source of truth.** Graph is rebuilt in memory on every run; nothing persistent is written back.
- **Schema is hard-coded.** `src/schema.js` enumerates the exact node and ref types. New types mean editing the file and the code that touches them.
- **Parsing is template-driven.** Each section has a template; the matcher extracts data with a small DSL, the consumer (graph.js) maps that data onto schema. New section formats need a new template + emitter.
- **Editing is patch-by-replacement.** The edit MCP accepts whole-file replacements, persists them as a patch, re-parses + validates with the overlay, and reports back. No op-log, no diff format.
- **Two MCP servers.** `canon-read` is read-only; `canon-edit` adds the patch tools. Separate processes so the edit surface can stay detached when only read access is wanted.
- **Apply is human.** A patch under `.patches/<id>/` only becomes part of `objects/` when someone runs `bin/apply.js <id>`. The script re-parses + validates from scratch (no shared state with the edit MCP) and refuses to write if anything is unclean. `--dry-run` reports the file list without touching disk.
