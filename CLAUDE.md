# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is not application code — it's a versioned knowledge base. `objects/`, `platform/`, and `preamble/` are the authoritative source-of-truth Markdown describing the SoftwareOne Marketplace platform's objects, state machines, business rules, and invariants. Everything else in the repo (`.canon/`, `scripts/`, `.claude/skills/`) exists to produce, validate, or query that Markdown — it is tooling in service of the content, not the point of the repo.

## Two separate subsystems — do not conflate them

1. **`.canon/`** — a Node.js MCP app (owned by a different engineer, Anton) that parses committed canon Markdown into an in-memory graph and exposes it via read/edit MCP servers and a patch-based edit flow (`.patches/<id>/` → `npm run apply`). See `.canon/README.md` for its internals. Unless a task explicitly concerns this app, leave it alone.
2. **Canon-authoring tooling** (`scripts/canon_*.py`, `config/canon_pipeline.config.json`, `.claude/skills/canon-generate/`, `.claude/skills/canon-submit-pr/`) — the automated pipeline that gathers evidence and drafts new/updated canon documents. This is almost always what "add canon" or "describe more of the platform" work actually means.

## Commands

**`.canon/` app** (run from repo root, needs `npm install && npm run setup` once per clone):
```bash
npm test                          # full unit + integration suite
npm run validate                  # parse + validate objects/ (no patches)
npm run validate -- <patch-id>    # parse + validate objects/ + a candidate patch
npm run apply <patch-id>          # write a validated patch into objects/
npm run apply <patch-id> -- --dry-run
npm run stats / overview / find / reindex   # read-side CLI queries against objects/
```

**Canon spec/schema scripts** (existing, in `scripts/`, Python 3, stdlib-only unless noted):
```bash
python scripts/extract_canon_schema.py <openapi.json> <namespace> <object> [--exact]   # trimmed OpenAPI extract for one object
python scripts/extract_objects.py <openapi.json> [output.md]                          # namespace/object checklist from the spec
python scripts/convert_to_docx.py <output_dir>                                         # requires pandoc; converts preamble/objects/platform to .docx
```
`extract_objects.py` excludes non-object path segments via `config/canon_path_segment_exclusions.json`, not a hardcoded list — entries are scoped per-object (`namespace.object[.child...]`, e.g. `catalog.products`), split into `state_transition_verbs` / `action_verbs` / `non_object_resources`, with `_global` reserved for patterns confirmed to apply across many objects (e.g. `icon`). `canon-generate`'s Step 1 grows this file over time as it confirms new segments object-by-object, rather than needing a code change per new verb.

**Canon-generation pipeline scripts** (`scripts/canon_*.py`, invoked by the `canon-generate` Skill, not normally run standalone):
```bash
python scripts/canon_fetch_openapi_spec.py <staging|prod> --out <path>   # unauthenticated; live spec per environment.openapiUrl
python scripts/canon_fetch_live.py <namespace> <object> <id> --path <api_path> --env <staging|prod> --out-dir <dir> [--actor <vendor|operations|client|all>]
python scripts/canon_diff_actors.py --operations <path> [--vendor <path>] [--client <path>] --out <path>
python scripts/canon_repo_sync.py <namespace>
```
All four read config from `config/canon_pipeline.config.json` and secrets from `.env` (copy from `.env.example`; never commit real values). `canon_fetch_live.py` is architecturally GET-only for every environment — there is no `--method` flag and no code path for a write request; do not add one. `canon_fetch_openapi_spec.py` exists because STAGING can be ahead of PROD (preamble §7) — always pull the spec for the environment you're about to call rather than reusing one cached copy across both.

## Canon-generation pipeline architecture

The documented manual authoring flow (`templates/CANON_SESSION_START.md` + `templates/CANON_AUTHORING_SESSION_PROMPT.md` — a conversational session pasting one hand-fetched JSON sample) is largely superseded by an automated three-Skill pipeline:

- **`/canon-generate <namespace> <object>`** gathers evidence — OpenAPI schema (`extract_canon_schema.py`), live JSON per Actor/environment (`canon_fetch_live.py`), an Actor-suppression diff (`canon_diff_actors.py`), and source-code research over a synced Azure DevOps repo (`canon_repo_sync.py` + a read-only sub-agent) — then drafts the canon document. The draft is written **only** to gitignored `.evidence/<namespace>_<object>/<run>/draft/` and it also makes direct bookkeeping edits to `questions/CANON_OPEN_QUESTIONS.md` and `questions/CANON_BACKLOG.md` (see below) — resolved questions are incorporated directly into canon with an inline citation, not tracked in a separate file. If evidence gathered for one object corrects another, already-canonised object, that correction is made directly rather than deferred. **It never writes into `objects/` or `platform/`.**
- **`/canon-generate-batch`** runs `canon-generate`'s evidence-gathering concurrently across several objects (soft guidance: 3–5) via the `Workflow` tool, instead of one object at a time. It exists because three of `canon-generate`'s own mechanics aren't safe to run in parallel unmodified: `canon_repo_sync.py` has no concurrency protection and several namespaces share one on-disk repo cache (so repo syncs are pre-synced serially, before any fan-out, one per distinct namespace); the shared bookkeeping files (`CANON_OPEN_QUESTIONS.md`'s cross-object `ENV-NNN` prefix, `CANON_BACKLOG.md`) have no locking (so all bookkeeping writes happen serially, one object at a time, done by the orchestrating session itself, never by concurrent subagents); and a `Workflow`-spawned subagent can't interactively ask the human anything (so the per-object "resolve candidates" round becomes one consolidated round across the whole batch, run as a hard break between the parallel evidence-gathering phase and a serial finalization phase). Same draft-only boundary as `canon-generate` — never writes into `objects/` or `platform/`.
- **`/canon-submit-pr <namespace> <object>`** is the explicit human-triggered step that promotes a reviewed draft into `objects/` and opens a PR. It enforces **one commit per PR** (subsequent runs amend + `git push --force-with-lease`, never a second commit or a bare `--force`); a PR is **not** restricted to one platform object — related objects (e.g. a cross-object dependency discovered mid-generation, or several objects from the same `canon-generate-batch` run) are expected to be bundled into the same PR when they belong together, subject to human confirmation of scope.

Full rationale for these safety boundaries (PROD is real customer data, hence GET-only; canon is only trustworthy once a human has reviewed it) lives in the Skill files themselves — read them before modifying this pipeline.

## Authoring principles for canon content

These govern anything written into `objects/` or `platform/`, whether by hand or via the pipeline above (from this repo's own README and `templates/CANON_AUTHORING_SESSION_PROMPT.md`):

- Base every rule, behaviour, and attribute on observed evidence (API responses, source code, confirmed engineering input) — never assume or infer by analogy to other objects.
- Unconfirmed behaviour is an open question (`questions/CANON_OPEN_QUESTIONS.md`, ID = object's API prefix + sequence, e.g. `PRD-001`; `ENV-NNN` for cross-cutting platform questions), not a guess written into canon.
- State facts, not opinions — avoid "usually"/"typically"; if a rule has exceptions, name them.
- Never restate `preamble/PLATFORM_CANON_PREAMBLE.md` invariants per-object — reference them.
- Cross-reference other objects as `Namespace: Object` (e.g. `Commerce: Order`), and additionally as a `[[WikiLink]]` (e.g. `[[Order]]`) wherever the object's canonical name appears in prose or table cells — `.canon/`'s graph parser only creates a cross-object edge from the bracket syntax, so a plain-text or backtick-only mention is a silent completeness gap, not an error. Link the object's exact `Object Name` (never your own object — self-mentions aren't bracketed), plural suffix outside the brackets (`[[Order]]s`), never nested inside backticks, never for an object not yet canonised, and only the first mention per table cell/paragraph. Applies to Section 1 Description, Section 4 Business Rules, Section 7 Lifecycle Events (not the Affected Object identifier column), Section 8, and Section 9 — not Section 5/6's Description columns, the preamble, or changelogs. Full rules (enum-vs-object judgment, section-by-section detail) are codified in `.claude/skills/canon-generate/SKILL.md`'s "Wikilinking other objects".
- Never say "hard delete" or "cascade deletion" — use "permanently removed — no longer retrievable via the API"; the platform never cascades deletions (deletion guards are documented explicitly instead).
- Every change to a canon document gets a changelog row; a canon doc with no open questions is considered complete for its current version.
- File naming: `CANON_OBJECT_<Namespace>_<Object>.md`, or `CANON_OBJECT_<Namespace>_<Parent>_<Child>.md` for child objects.
- Canon documents business rules and observed behavior, not technical implementation — the OpenAPI spec, live JSON samples, and source-code research are evidence used to *derive* a business rule, and none of that derivation mechanism (internal class/method names, file paths, line numbers, query-filter mechanics) belongs in canon content. This repo is public; that level of detail belongs to a separate, private engineering repo.
- Rule Statements (and any other primary content column) are short and to the point — one or two sentences for the general constraint. Supplementary detail (enumerated concrete values, a mapping, an example) belongs in the Notes column.
- Notes columns hold additional behavioral information only — never a citation ("Confirmed directly", "Confirmed by [name]"), never attribution, never "Corrects prior canon"/"New, not in prior canon" framing. Canon is a present-state snapshot; corrections and their provenance belong only in the Changelog. An empty Notes cell is `—`.
- An empty Open Questions section says exactly "No open questions at this time." — no recap of which questions were previously resolved, descoped, or reopened.
