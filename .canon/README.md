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

- **MD is the source of truth.** `objects/` is canon — self-validating, no implicit overlays. Graph is rebuilt in memory on every run; nothing persistent is written back.
- **Schema is hard-coded.** `src/schema.js` enumerates the exact node and ref types. New types mean editing the file and the code that touches them.
- **Parsing is template-driven.** Each section has a template; the matcher extracts data with a small DSL, the consumer (graph.js) maps that data onto schema. New section formats need a new template + emitter.
- **Two pieces of whitespace are not content.** The `---` between sections is stripped from every body by the slicer, and a template file's own trailing newline is dropped at compile time. Both used to be load-bearing by accident: the rule ended up inside whichever field closed a section, and the newline became the terminator of any capture that ended a template, cutting multi-line values at their first line break.
- **Editing is patch-by-replacement.** The edit MCP accepts whole-file replacements, persists them under `.patches/<id>/`, re-parses + validates with **only that patch overlaid** on `objects/`, and reports back. No op-log, no diff format.
- **Two MCP servers.** `canon-read` is read-only and sees `objects/` only (no patches). `canon-edit` adds the patch tools; after each `patch_write` its in-memory graph reflects `objects/` + the active patch (siblings ignored). Separate processes so the edit surface can stay detached when only read access is wanted.
- **Patches are sibling overlays, never combined.** Each patch under `.patches/<id>/` is its own candidate edit, validated in isolation. The loader (`src/load.js`) overlays nothing by default; callers opt in via `{ patchIds: [id] }`. This is the same isolation model used by the edit MCP and `apply.js`.
- **Apply is human.** A patch only becomes part of `objects/` when someone runs `bin/apply.js <id>`. The script re-parses + validates from scratch with that patch overlaid (no shared state with the edit MCP) and refuses to write if anything is unclean. `--dry-run` reports the file list without touching disk.

## CLI scope

`canon validate` and `canon-apply` both honour the opt-in overlay model:

- `canon validate` — checks `objects/` standalone. Use to confirm the committed canon is clean. Via npm: `npm run validate`.
- `canon validate <patch-id>` — checks `objects/ + .patches/<patch-id>/`. Use to preview a candidate patch. Via npm: `npm run validate -- <patch-id>` (the `--` is required so npm forwards the patch id to the script).
- `canon-apply <patch-id> [--dry-run]` — validates `objects/ + .patches/<patch-id>/`, then (without `--dry-run`) copies the patch files into `objects/` and removes `.patches/<patch-id>/`.

Other read-side commands (`overview`, `find`, `reveal`, etc.) always run against `objects/`. If you want to inspect a candidate state, apply the patch first.
