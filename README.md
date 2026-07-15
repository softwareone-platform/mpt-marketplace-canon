# SoftwareOne Marketplace Canon

Authoritative product canon for the SoftwareOne Marketplace platform. Covers platform invariants, object lifecycles, state machines, business rules, and system behaviour. Built and maintained by the Marketplace product team as a structured reference for engineering, support, and onboarding.

---

## What is Canon?

> **canon** _(n.)_ — a collection of rules, principles, or works officially recognised as authoritative within a given domain.

Canon is the versioned knowledge base for the SoftwareOne Marketplace platform. It is a structured record of every platform object's identity, behaviour, business rules, and lifecycle — so that product decisions are made from a shared, reliable understanding of how the platform actually works, rather than from tribal knowledge or assumption.

---

## Repository Structure

```
mpt-marketplace-canon/
  preamble/
    PLATFORM_CANON_PREAMBLE.md        # Platform invariants, actor model, API conventions, namespace structure
  objects/
    CANON_OBJECT_Catalog_Product.md
    CANON_OBJECT_Catalog_PriceList.md
    ...                               # One file per platform object
  platform/
    CANON_PLATFORM_MarkdownRenderer.md
    ...                               # System behaviour not tied to a specific object
  questions/
    CANON_OPEN_QUESTIONS.md           # Known unknowns awaiting resolution
  templates/
    CANON_OBJECT_TEMPLATE.md          # Standard template for object canon documents
    CANON_AUTHORING_SESSION.md        # LLM session prompt for canon authoring
  scripts/
    convert_to_docx.py                # Convert canon Markdown files to .docx
    extract_objects.py                # Extract a namespace/object checklist from the OpenAPI spec
    extract_canon_schema.py           # Extract paths and schemas for a specific object from the OpenAPI spec
  .canon/                             # MCP runtime — see .canon/README.md
```

---

## Working with Canon through Claude

The `.canon/` directory ships a pair of MCP servers that expose the canon graph to an agent — read-only navigation and patch-based editing. Setup once per clone:

```bash
npm install
npm run setup
```

`setup` installs optional ML deps, warms up the local embedding model into `.canon/model-cache/`, builds the runtime bundles into `.canon/dist/`, and emits user-facing install artifacts into `dist/` at the repo root with absolute paths baked in for THIS clone.

### Install into Claude Desktop

**Option A — drag-and-drop:**
```bash
open dist/canon-read.mcpb
open dist/canon-edit.mcpb
```

**Option B — paste into `~/Library/Application Support/Claude/claude_desktop_config.json`:**
```bash
cat dist/claude_desktop_config.snippet.json
```

Restart Claude Desktop after installing.

### Install into Cursor

Paste the generated snippet into either project-level `.cursor/mcp.json` or global `~/.cursor/mcp.json`:

```bash
cat dist/cursor_mcp.snippet.json
```

Cursor can usually pick up MCP config changes automatically. If the servers do not appear, reload Cursor or toggle them under Settings > Tools & MCP.

### Install into Codex

Paste the generated TOML snippet into either global `~/.codex/config.toml` or project-level `.codex/config.toml`:

```bash
cat dist/codex_config.snippet.toml
```

Restart Codex after installing if the servers do not appear.

### Patch flow

The agent never edits source files directly. Edits land under `.patches/<id>/` as whole-file replacements; you commit them deliberately:

```bash
npm run apply <patch-id>            # validate (objects/ + that patch) + write into objects/
npm run apply <patch-id> -- --dry-run    # validate + report only
```

`apply` re-parses + validates from scratch with the named patch overlaid on `objects/` and refuses to write if anything is unclean. Other patches in `.patches/` are not considered — every patch is validated in isolation. Git flow runs in parallel — branch / commit / push patches and committed canon however your team prefers.

### Verify the install

```bash
npm test                            # full unit + integration suite
npm run validate                    # parse + validate objects/ (no patches)
npm run validate -- <patch-id>      # parse + validate objects/ + that patch
```

### When to re-run setup

- After cloning fresh
- After moving / renaming the workdir (the absolute paths in `.mcpb` go stale)
- After major dist changes (`npm run build` alone updates bundles, but the `.mcpb` manifests and install snippets are emitted only by `setup`)

---

## Authoring Principles

**If it isn't observed, confirmed, and documented — it isn't canon.**

- **The product manager is the authority, not the LLM.** Challenge, correct, and validate the output at every step. Canon that has not been reviewed by a domain expert is not canon.
- **Base canon on evidence.** Every rule, behaviour, and attribute must be derived from observed platform behaviour, API responses, or confirmed engineering input. Do not assume or infer.
- **When in doubt, park it.** Unconfirmed behaviour belongs in the open questions tracker, not in the canon document.
- **State facts, not opinions.** Canon describes how the platform works, not how it should work.
- **Be precise with language.** Avoid "usually", "typically", or "in most cases". If a rule has exceptions, document them explicitly.
- **Respect the invariants.** Platform invariants apply to every object without exception. Do not contradict or restate them per object.
- **One source of truth.** Reference rules documented elsewhere rather than restating them. Duplication leads to drift.
- **Version everything.** Every change must be reflected in the document's changelog. Canon is only trustworthy if its history is traceable.
- **Canon describes the platform, not a vendor's use of it.** Vendor-specific behaviour belongs in vendor canon.

---

## Scripts

Three Python scripts are included in `scripts/` to support canon development workflows.

**Requirements for all scripts:** Python 3. `convert_to_docx.py` additionally requires [pandoc](https://pandoc.org/installing.html). `extract_objects.py` and `extract_canon_schema.py` require a copy of the SoftwareOne Marketplace OpenAPI spec in JSON format — not included in this repo.

---

### `convert_to_docx.py`

Converts all canon Markdown files to `.docx` format using pandoc. Converts every file in `preamble/`, `objects/`, and `platform/` and writes the output to a specified directory.

Used to produce `.docx` files for upload as Microsoft Copilot Agent knowledge (Copilot Agent Builder requires `.docx` format). Re-run whenever canon files are updated.

```
# Windows
python scripts/convert_to_docx.py C:/Users/yourname/Desktop/docx

# macOS / Linux
python scripts/convert_to_docx.py ~/Desktop/docx
```

---

### `extract_objects.py`

Parses the OpenAPI spec and extracts a structured checklist of all namespaces, objects, child objects, and grandchild objects — formatted as a Markdown backlog ready for use in `CANON_BACKLOG.md`.

Used to generate or refresh the Full Object Inventory in the backlog when the spec changes.

Path segments that aren't real objects (state-transition verbs like `publish`, other action verbs like `split`, non-object sub-resources like `icon`) are excluded via `config/canon_path_segment_exclusions.json` rather than a hardcoded list, scoped per-object since the same word can mean something different for a different object — the `canon-generate` Skill grows this file over time as it confirms new segments while generating each object's canon.

```
# Print to stdout
python scripts/extract_objects.py openapi.json

# Write to a file
python scripts/extract_objects.py openapi.json canon_checklist.md
```

---

### `extract_canon_schema.py`

Extracts all API paths and component schemas for a specific platform object from the OpenAPI spec, producing a trimmed JSON file. Follows all `$ref` chains to include every nested schema the object depends on.

Used to generate a focused, uploadable JSON extract for a canon authoring session — giving the LLM precise schema information for the object being canonised without loading the entire spec.

The OpenAPI spec can be downloaded from the [SoftwareOne Marketplace developer documentation](https://docs.platform.softwareone.com/developer-resources/rest-api/openapi-specification).

```
# Top-level object (use --exact to avoid pulling in child object paths)
python scripts/extract_canon_schema.py openapi.json catalog product --exact

# Child object (no --exact needed — the child path is already specific)
python scripts/extract_canon_schema.py openapi.json catalog template

# Multi-word object names use hyphens
python scripts/extract_canon_schema.py openapi.json catalog price-list
```

The `--exact` flag restricts matching to paths where the object is the terminal resource segment, excluding paths for child objects (e.g. `catalog/products/{id}/templates` would not be included when extracting `product --exact`). Without `--exact`, all paths containing the namespace and object keyword are matched.

Output is saved as `openapi_extract_{namespace}_{object}.json` in the same directory as the input spec.

---

## Using this Canon with an LLM

The structured format of this canon is designed to work well as context for large language models. Loading canon documents as project knowledge in an LLM lets you ask questions about platform behaviour, validate integration assumptions, and accelerate development without digging through documentation manually.

**Recommended approach:**
- Load `preamble/PLATFORM_CANON_PREAMBLE.md` into your LLM project knowledge first — it establishes the platform invariants and conventions that all object canon builds on.
- Add the canon documents relevant to your integration (e.g. `objects/CANON_OBJECT_Catalog_PriceList.md`) alongside it. For use with Microsoft Copilot Agent Builder, run `scripts/convert_to_docx.py` first to convert the Markdown files to `.docx` — Copilot Agent Builder requires `.docx` format.
- You can then ask the LLM to explain behaviours, check assumptions, or walk through lifecycle scenarios for any canonised object.

Canon documents are intentionally precise and unambiguous — which makes them significantly more reliable as LLM context than informal documentation or API reference alone.

### Using Canon as Microsoft Copilot Agent Knowledge

Microsoft Copilot Agent Builder requires knowledge files in `.docx` format. A conversion script is included in `scripts/` to convert all canon files from Markdown to `.docx` in one step.

**Requirements:** [pandoc](https://pandoc.org/installing.html) and Python 3.

**Usage:**
```
# Windows
python scripts/convert_to_docx.py C:/Users/yourname/Desktop/docx

# macOS
python scripts/convert_to_docx.py ~/Desktop/docx

# Linux
python scripts/convert_to_docx.py ~/Documents/docx
```

The script converts all files in `preamble/`, `objects/`, and `platform/` and writes `.docx` files to the specified output directory. Re-run it whenever canon files are updated.
