# `.canon/`

Implementation of the canon app. The repo root holds source-of-truth markdown (`objects/`, `concepts/`, `implementations/`, `platform/`, `preamble/`, `questions/`); this directory holds the code that parses those MDs into a graph and exposes them over MCP and the CLI.

Three of those directories are parsed: `objects/`, `concepts/` and `implementations/`. The rest are read by humans only. `implementations/` need not exist — a missing corpus directory is tolerated, so the first implementation document creates it.

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
    kb.js               find / reveal / impact / paths / overview / coverage
    validate.js         schema-driven graph check
    render.js           graph slice → canonical MD
    load.js             patch-aware MD loader
    cli.js              argv dispatcher
    mcp/
      read.js           kb queries as tools
      edit.js           read tools + patch_write / patch_read / patch_render
    rag/                local WASM embeddings + cosine search
  templates/*.md        one per section, drives parse + render
                        (3 `concept-*.md` and 4 `implementation-*.md`
                        — both kinds reuse the object templates for
                        §7 and §9–11)
  scripts/
    align.js            objects/ → .patches/align-format/
    build.js            esbuild → dist/
    dump-entity.js      audit aid
    audit-counts.js     audit aid
  dist/                 built bundles (gitignored)
```

## How it hangs together

- **MD is the source of truth.** `objects/`, `concepts/` and `implementations/` are canon — self-validating, no implicit overlays. Graph is rebuilt in memory on every run; nothing persistent is written back.
- **Three document kinds, one graph.** A concept document is a *partial* of an object one: same section numbers, same templates and same emitters for §4, §7 and §9–11, with §2, §3, §6 and §8 absent because they presume the platform owns the subject. Only §1 and §5 are its own — §5 keeps its slot (what the subject exposes) but a concept exposes introduced entities rather than fields. An implementation is the concept again with an `Implements` column in §4 and §5, so `IMPLEMENTATION_SECTION_DISPATCH` is built by overriding three rows of the concept's table rather than restating it. Adding a section to every kind means touching one table.
- **Containment and realisation are separate refs, and an implementation uses both.** `parent` says which document contains this one, `implements` says what it realises. For a concept `parent` is the domain or the broader concept it narrows; for an implementation it is the domain or the umbrella implementation this document is one part of, which is how a realisation too large for one file is written. `validate.js` holds the two together: a part's abstraction must be *strictly* below its umbrella's, so a family cannot be grown without naming the narrower concept each part is about. Because containment is what `descendants` walks, `kb.coverage` over an umbrella aggregates the whole family's bindings with no special case.
- **Binding is a ref, and its correctness is not a schema property.** The `implements` ref carries both edges: document → abstraction, and row → the element it realises. The schema can say the target is a term; only `checkImplements` in `validate.js` can say it is a term *of the right subject*, type-matched, inside a real abstraction. What is **not** bound is deliberately unchecked — `kb.coverage()` reports it, because "not implemented" and "not recorded" are the same state of knowledge and canon does not invent a distinction between them.
- **The banner decides the kind, not the directory.** `detectKind()` reads the document's first line and matches it against the `KINDS` table (`# Object Canon:` / `# Concept Canon:` / `# Implementation Canon:`). `CORPUS_DIRS` only says where to look, and the directory a file came from is recorded on it as `dir`. A file with neither banner is a parse error, and a filename that contradicts its banner is reported — id derivation goes by filename and parsing by banner, so a disagreement would otherwise parse fine and then be dropped for want of an id.
- **Schema is hard-coded.** `src/schema.js` enumerates the exact node and ref types. New types mean editing the file and the code that touches them.
- **Parsing is template-driven.** Each section has a template; the matcher extracts data with a small DSL, the consumer (graph.js) maps that data onto schema. New section formats need a new template + emitter.
- **Two pieces of whitespace are not content.** The `---` between sections is stripped from every body by the slicer, and a template file's own trailing newline is dropped at compile time. Both used to be load-bearing by accident: the rule ended up inside whichever field closed a section, and the newline became the terminator of any capture that ended a template, cutting multi-line values at their first line break.
- **Editing is patch-by-replacement.** The edit MCP accepts whole-file replacements, persists them under `.patches/<id>/`, re-parses + validates with **only that patch overlaid** on `objects/`, and reports back. No op-log, no diff format.
- **Two MCP servers.** `canon-read` is read-only and sees `objects/` only (no patches). `canon-edit` adds the patch tools; after each `patch_write` its in-memory graph reflects `objects/` + the active patch (siblings ignored). Separate processes so the edit surface can stay detached when only read access is wanted.
- **Patches are sibling overlays, never combined.** Each patch under `.patches/<id>/` is its own candidate edit, validated in isolation. The loader (`src/load.js`) overlays nothing by default; callers opt in via `{ patchIds: [id] }`. This is the same isolation model used by the edit MCP and `apply.js`. Overlays are per source directory, so a patch may carry `objects/`, `concepts/` and `implementations/` files together.
- **`scripts/align.js` is objects-only, deliberately.** It normalises the formatting of legacy object drafts. Concepts and implementations are authored against templates that are already canonical, so there is nothing to align — if that stops being true, aligning them is its own job with its own normalisers.
- **Apply is human.** A patch only becomes part of `objects/` when someone runs `bin/apply.js <id>`. The script re-parses + validates from scratch with that patch overlaid (no shared state with the edit MCP) and refuses to write if anything is unclean. `--dry-run` reports the file list without touching disk.

## CLI scope

`canon validate` and `canon-apply` both honour the opt-in overlay model:

- `canon validate` — checks the corpus standalone. Use to confirm the committed canon is clean. Via npm: `npm run validate`.
- `canon validate <patch-id>` — checks the corpus + `.patches/<patch-id>/`. Use to preview a candidate patch. Via npm: `npm run validate -- <patch-id>` (the `--` is required so npm forwards the patch id to the script).
- `canon-apply <patch-id> [--dry-run]` — validates the corpus + `.patches/<patch-id>/`, then (without `--dry-run`) copies each patch file into the source directory it mirrors and removes `.patches/<patch-id>/`.

Other read-side commands (`overview`, `find`, `reveal`, `coverage`, etc.) always run against the committed corpus. If you want to inspect a candidate state, apply the patch first.
