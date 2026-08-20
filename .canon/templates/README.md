# Canon section templates

One template per canonical section, written in the matcher DSL from `../src/template.js`. The parser slices an MD by section markers (level-2 headers `## N. <Title>` and the file header before section 1) and runs each slice through its template. A successful match yields a structured object; the parser merges these objects into the canonical graph (nodes + refs).

## Strict format requirements

Templates assume the source MD follows the format below. Originals that don't comply are aligned in `.patches/align-format/`, never in place.

### File-level

- File starts with `# Object Canon: <Name>` (literal prefix mandatory).
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
