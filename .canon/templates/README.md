# Canon section templates

One template per canonical section, written in the matcher DSL from `../src/template.js`. The parser slices an MD by section markers (level-2 headers `## N. <Title>` and the file header before section 1) and runs each slice through its template. A successful match yields a structured object; the parser merges these objects into the canonical graph (nodes + refs).

The unprefixed templates describe an **object**. The three `concept-*.md` templates describe the only parts of a **Concept** that differ — a concept document is a partial of an object one and reuses `business-rules.md`, `internal-events.md`, `cross-effects.md`, `failure-modes.md` and `open-questions.md` unchanged. The four `implementation-*.md` templates are the concept's again, with an `Implements` column added to §4 and §5. Which kind a document is comes from its own first line (`# Object Canon:` / `# Concept Canon:` / `# Implementation Canon:`), never from the directory it sits in. Everything under "Strict format requirements" applies to all three.

## Strict format requirements

Templates assume the source MD follows the format below. Originals that don't comply are aligned in `.patches/align-format/`, never in place.

### File-level

- File starts with `# Object Canon: <Name>` — or `# Concept Canon: <Name>`, or `# Implementation Canon: <Name>`. The prefix is mandatory and is what declares the document's kind.
- Followed by a blockquote with four lines: Version, Owner, Last Updated, Status.
- Sections appear in numeric order, each headed `## N. <Title>` with a blank line before and after the header.
- Section 7 is split into `### 7.1 Internal Events` and `### 7.2 Cross-Object State Effects`.
- Section 3 is split into `### 3.1 States`, `### 3.2 Transitions`, `### 3.3 State Diagram`. The diagram in 3.3 is not parsed (it is derived from 3.2).
- Empty sections use the literal sentinel `_None._` on its own line — never absence.
- The `---` rule between two sections belongs to neither. The slicer removes the whole trailing run of rules and blank lines from every section body (and from the file header), keeping one newline — a table row is anchored by the line break after it. Sections may still contain a `---` mid-body; only the trailing one is formatting.
- **A template file's own trailing newline is not part of the format.** It is dropped at compile time, so a capture that ends a template runs to the end of its section instead of stopping at the first line break. Write templates with or without it; both compile identically. The whitespace *inside* an `#each` body is a different matter — it is what separates one row from the next, and is never dropped.

### Tables

- Pipes `|` at line start and end, padded by a single space inside.
- Header row, then divider row, then data rows. No blank lines inside a table.
- Divider row is canonicalised to `| --- | --- | ... |` — three dashes per column, single-space padding. Visual alignment of column widths is dropped; renderers don't care, the matcher requires literal equality on the divider.
- Column headers and order are fixed per section (see individual templates).
- Cells are trimmed; multiline cells are not supported. Long content uses `<br>` to remain on one logical row.

### Identity

```
**Object Name:** <Name>

**Namespace:** <one-of: Catalog | Commerce | Billing | Administration | Notifications | Audit>

**Parent Object:** <"None — top-level object." or "<Namespace>: <Object>">

**ID Prefix:** <three-letter-prefix or "None.">

**Description:**
<prose>

**Also Known As:**
<comma-separated names, or "None known.">
```

### Ownership table

```
| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
```

Actors are exactly `Vendor`, `Operations`, `Client`, in that order. Permission cells are `Yes` or `No` (no other tokens). Notes may be empty (cell still must contain at least a space).

### States table

```
| State | Description | Initial State? | Terminal State? |
```

Initial / Terminal cells are `Yes` or `No`. Exactly one row may have `Initial State? = Yes`. Multiple terminals are allowed.

### Transitions table

```
| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
```

`#` is `T1`, `T2`, ... `T1` is the creation transition; `From State` is the literal `—` (em-dash). Permitted Actors is a comma-separated list drawn from the Actors set.

### Business Rules table

```
| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
```

Rule IDs are `BR-NNN` or `BR-NNNa` (sub-rules).

### Attributes table

```
| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
```

The "Mutable After [State]?" column from older drafts is dropped — state-conditional mutability moves into Notes. Type tokens are free text (`String`, `Enum`, `Object`, `Integer`, ...).

### Relationships table

```
| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
```

Relationship Type is `Parent`, `Child`, or `Association`. Lifecycle Dependency is free text.

### Internal Events table (7.1)

```
| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
```

### Cross-Object Effects table (7.2)

```
| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
```

`Automated?` is `Yes` or `No`.

### Failure Modes table (9)

```
| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
```

Risk Level is `High`, `Medium`, or `Low` (capitalised).

### Open Questions (10)

```
- [ ] [<Q-ID>]: <Question statement.>
```

Or the literal `_None._` if there are no open questions.

### Changelog (11)

Not parsed. The renderer regenerates it from version metadata, but the parser ignores changelog content.

---

## Concept sections (`concept-*.md`)

A concept document carries sections **1, 4, 5, 7, 9, 10, 11** — and no others. Sections 2, 3, 6 and 8 are absent because they presume the platform owns the subject. Only §1 and §5 need their own template.

### File-level

- File starts with `# Concept Canon: <Name>`.
- Same four-line blockquote header as an object. Unlike an object's, these reach the graph as concept `meta`, so a concept round-trips its own header instead of having one synthesised.

### Identity (1)

```
**Concept Name:** <Name>

**Parent Concept:** <"None — top-level concept." or "<Concept>">

**Description:**
<prose>

**Also Known As:**
<comma-separated names, or "None known.">
```

No Namespace and no ID Prefix: a Concept sits outside the namespace model and the platform issues it no identifier. `Parent Concept` resolves through the same name index an object's `Parent Object` uses, and points at the domain or at a broader concept — never at an entity.

### Key Concepts table (5)

```
| Concept | Description | Notes |
```

Occupies the slot an object's Key Attributes does, and for the analogous reason: §5 is what the subject exposes. An object exposes fields; a concept exposes the entities it introduces, so the columns that presume ownership — "Set By", "Mutable After Creation?" — are gone. Each row becomes a `term` node with `meta.kind: 'key-concept'`, individually addressable, so a platform object references one by full id: `[[erp-system:identifier]]`. Description is mandatory — it is the node's description, and unlike an object's §5 it **is** `[[WikiLink]]`-scanned: grounding a term on the platform entity it is defined against is the point of the section. The Notes column is not scanned for a term — only rules have their notes scanned — so a link there is inert.

### Lifecycle Events & Side Effects (7)

`internal-events.md` and `cross-effects.md`, unchanged, under the same `## 7.` container and the same `### 7.1` / `### 7.2` sub-headings. Both halves are kept: a Concept *has* an inside, canon simply does not claim to know all of it, so 7.1 records the significant confirmed part — an internal event cycle, an upstream system the concept draws data from — and 7.2 records what that causes in the domain. In 7.1 "Permitted Actor(s)" is usually `—`, because these are the concept's own workings and no platform Actor performs them.

### Business Rules (4), Failure Modes (9), Open Questions (10)

The object templates, unchanged, parsed by the object emitters. A concept writes `N/A` in "Applies In State(s)" — which the object template already prescribes for a stateless subject, so no variant is needed.

---

## Implementation sections (`implementation-*.md`)

An implementation document carries the same sections a concept does — **1, 4, 5, 7, 9, 10, 11** — because it is the same shape. What differs is one column in §4 and §5, and what §1 names.

### File-level

- File starts with `# Implementation Canon: <Name>`.
- Same four-line blockquote header, reaching the graph as implementation `meta`.
- Loaded from `implementations/`, which need not exist until the first document.

### Identity (1)

```
**Implementation Name:** <Name>

**Implements:** <Concept or object name>

**Description:**
<prose>

**Also Known As:**
<comma-separated names, or "None known.">
```

`Implements` resolves through the same name index as `Parent Object` and `Parent Concept`, but it is a different edge and a different ref type: `parent` is containment and always points at the domain here, `implements` is realisation. Exactly one, and — unlike the other two — an unresolved value is a validation error rather than a `future:` stub, because bindings cannot be checked against an abstraction that does not exist.

### Business Rules (4) and Key Concepts (5)

The concept's tables with one column added before Notes:

```
| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Implements | Notes |
| Concept | Description | Implements | Notes |
```

`Implements` holds the **full id** of an element of the abstraction — `integration:br-004`, `integration:actor-credential` — or is empty. A bare name is not accepted, for the same reason `[[mentions]]` refuse bare child names: they collide across subjects. `validate.js` checks that the target is inside the named abstraction's own subtree and that the types match; an empty cell is not checked at all, because it says the row is this implementation's own.

An element of the abstraction that no row names is **unbound**, and that is reported by `canon coverage <id>` rather than by the validator — canon cannot tell "not implemented" from "not recorded", and neither is an error.

### Lifecycle Events (7), Failure Modes (9), Open Questions (10)

The object templates, unchanged, exactly as for a concept. None of them binds: their rows become anonymous refs with no id, so there is nothing for an `Implements` column to point at. A correspondence to an event of the abstraction goes in Notes as prose.
