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
  concepts/
    CANON_CONCEPT_Integration.md
    ...                               # One file per Concept — see below
  implementations/
    ...                               # One file per named realisation of a Concept — see below
  platform/
    CANON_PLATFORM_MarkdownRenderer.md
    ...                               # System behaviour not tied to a specific object
  questions/
    CANON_OPEN_QUESTIONS.md           # Known unknowns awaiting resolution
  templates/
    CANON_OBJECT_TEMPLATE.md          # Standard template for object canon documents
    CANON_CONCEPT_TEMPLATE.md         # Standard template for concept canon documents
    CANON_IMPLEMENTATION_TEMPLATE.md  # Standard template for implementation canon documents
    CANON_AUTHORING_SESSION.md        # LLM session prompt for canon authoring
  scripts/
    convert_to_docx.py                # Convert canon Markdown files to .docx
    extract_objects.py                # Extract a namespace/object checklist from the OpenAPI spec
    extract_canon_schema.py           # Extract paths and schemas for a specific object from the OpenAPI spec
  .canon/                             # MCP runtime — see .canon/README.md
```

---

## Objects, Concepts and Implementations

Canon holds three kinds of document. Ownership separates the first two; generality separates the second from the third.

An **Object** is a thing the platform owns: an API collection, an ID prefix, a lifecycle, an Actor who creates it. `objects/` is one file per object.

A **Concept** is a thing the platform does *not* own but must still reason about — an integration, an ERP system, a vendor's own platform. A Concept *has* an inside; canon simply does not claim to know all of it, so it records the entities the concept introduces, the significant part of its workings that is confirmed, and what it causes in the domain. `concepts/` is one file per Concept.

A Concept document is a **partial of an object document** — it uses only section numbers the object template already defines, and means by them what the object means:

```
  1. Identity                     reduced: no Namespace, no ID Prefix
  4. Business Rules               unchanged; "Applies In State(s)" is N/A
  5. Key Concepts                 the slot where an object lists Key Attributes
  7. Lifecycle Events & Side Effects    unchanged, 7.1 and 7.2 both
  9. Failure Modes & Edge Cases   unchanged
 10. Open Questions               unchanged
 11. Changelog                    unchanged
```

The gaps are the point. Sections 2, 3, 6 and 8 are absent because a Concept has no ownership matrix, no observable state machine, no relationships of its own to declare, and nothing the platform creates or deletes — and a reader who knows the object template sees that immediately.

Two sections are worth spelling out:

- **§5 Key Concepts** occupies the slot where an object lists its Key Attributes, and for the same reason: §5 is what the subject exposes. A Concept exposes *introduced entities* rather than fields — an ERP system introduces the notion of an identifier — and each becomes an addressable node, so a platform object references it from the object's own canon (`[[erp-system:identifier]]`). That direction matters: a Concept never enumerates the platform. That `Accounts: ErpLink` exists is the platform's fact about itself, not the ERP's fact about the platform.
- **§7 keeps both halves.** 7.1 records what is confirmed about the concept's own workings — an internal event cycle, an upstream system it draws data from. That is internal and significant, and it is not an effect. 7.2 records what the concept causes in the domain, and is the one place a Concept document names platform objects: the acting subject describing its own effects, exactly as an object's 7.2 does.

**Hierarchy is the exception.** A Concept is an arrow pointing out of the domain. When one genuinely narrows another, the narrower is its own document naming the broader as `Parent Concept`, and it *further attributes* the parent rather than replacing it. Where a relationship holds for any instance, refer to the parent; where it is specific to a kind, refer to the child.

An **Implementation** is one named realisation of an abstraction canon already records — Microsoft's integration, this ERP product, that vendor's marketplace. `implementations/` is one file per Implementation, and the directory need not exist until the first one is written.

Where a Concept *declares*, an Implementation *binds*. It is the Concept shape again with one column added to §4 and §5, naming the element of the abstraction each row realises:

```
| Concept   | Description                | Implements                   | Notes |
| Tenant id | The directory tenant used. | integration:actor-credential |       |
| Sku map   | Vendor-specific mapping.   |                              |       |
```

The first row says *this is what the abstraction's actor credential turns out to be here*. The second introduces something the abstraction has no notion of, which is the other half of what an Implementation is for.

**What is not bound is unbound, and canon says no more than that.** An element the abstraction declares and no row names is reported as unbound — not as missing, not as unimplemented, because canon genuinely cannot tell "this realisation does not do that" from "nobody has written it down". `canon coverage <id>` prints the three lists: bound, unbound, and own. An implementation that *knows* an element does not apply says so by binding it and letting the value state that there is nothing to state.

Bindings reach §4 rules and §5 concepts only — those are the sections whose rows become addressable nodes. Events, effects and failure modes are emitted as anonymous refs with no id to point at, so an implementation states its own and notes the correspondence in prose.

**Narrowing and realising are different edges.** "Back-office ERP integration" is a *Concept* that narrows "Integration", because it is still a kind: it declares a contract without saying which ERP product holds up its end. "NetSuite" is an *Implementation*, because it is one thing. Narrowing uses `Parent Concept`; realising uses `Implements`.

**Which kind a document is comes from its own first line** — `# Object Canon:`, `# Concept Canon:` or `# Implementation Canon:` — not from the directory it sits in. A file that moves does not change meaning, and a file with no banner fails to parse rather than being guessed at.

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

The agent never edits source files directly. Edits land under `.patches/<id>/` as whole-file replacements, mirroring the source directories (`objects/`, `concepts/`, `implementations/`, `platform/`, `preamble/`, `questions/`); you commit them deliberately:

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
- **Version everything.** Every change must be reflected in the document's changelog, which is ordered newest-first — the most recent entry at the top, the oldest at the bottom. Canon is only trustworthy if its history is traceable.
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
