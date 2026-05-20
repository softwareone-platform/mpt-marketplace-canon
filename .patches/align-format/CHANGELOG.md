# align-format — change log

Every transformation the patch applies to source MDs in `../../objects/`, with the rationale for each. The pipeline runs in two phases — format normalization first, opinionated content adaptations second. Each entry lists *what* changes, *why* it matters, and which sections / files are affected.

---

## Phase 1 — Format normalization

These transforms produce an MD that the parser can consume without ambiguity. They never invent data; they only rewrite shape.

### 1.1 Table dividers → `| --- | --- | ... |`

**What.** Every markdown table divider row is rewritten to `| --- | --- | ... |` — three dashes per column, single-space padding.

**Why.** The template matcher requires the divider literal between header and data rows to match exactly. Source MDs use cosmetic widths like `|------|---------------|` — no two are alike across files. Using a single canonical form lets one template work for all 22 objects.

**Affects.** Every table in every MD.

### 1.2 Section 4 — strip thematic rule subsections

**What.** Inside `## 4. Business Rules`, `### N.M ...` heading lines are removed; data rows below them remain.

**Why.** Some objects (Product Parameter) subdivide rules thematically: `### 4.1 Parameter Definition Rules`, `### 4.2 Constraint Rules`, `### 4.3 Parameter Value Rules`. Every subsection uses the same Rule schema, so removing the headings concatenates the rules into Section 4's single canonical table without information loss.

**Affects.** Product Parameter (3 subsections folded → 27 rules in one table).

### 1.3 Section 5 — expand attribute sub-fields with dot notation

**What.** Inside `## 5. Key Attributes`, a sub-section heading `### N.M <Name> Sub-fields` followed by a table of sub-fields gets folded into the main Attributes table. Each sub-field row becomes a main-table row with name `<parentCamelCase>.<sub-field>`. Columns in the sub-table that don't match the main table (e.g. "Actor Visibility") are appended to the row's Notes column.

**Why.** Sub-fields of an existing attribute belong on the same conceptual level as their parent — `parameters.fulfillment`, `externalIds.vendor` are already in main tables under that convention. Putting them in a sub-section that the parser would silently drop violates "one section = one canonical-shape table".

**Affects.** Product (`### 5.1 Settings Sub-fields` → 8 `settings.X` rows merged into main table).

### 1.4 Spin off `## N.M <X> Attributes` into separate canon files

**What.** A `## N.M <Name> Attributes` sub-section describes a *different* object embedded inside a parent's MD. The transform extracts its attributes into a new file `CANON_OBJECT_<Namespace>_<Parent>_<Name>.md` with full canonical structure (Identity inherited from parent, the spun-off attributes in Section 5, skeleton tables and `Pending canonisation.` sentinels in the rest). The sub-section is removed from the parent.

**Why.** One file = one object is the canonical contract. Embedding another object's attribute table inside a parent's section violates it. Trying to handle both in one parser pass produces silent data loss; spinning off makes the second object a first-class canon citizen with its own id, parent ref, and attributes — and the parser stays simple.

**Affects.** PricingPolicy (`## 5.1 Attachment Attributes` → new `CANON_OBJECT_Catalog_PricingPolicy_Attachment.md` with 8 attributes; parent ref points back to PricingPolicy).

### 1.5 Identity — fill missing Namespace and ID Prefix

**What.** If `## 1. Identity` lacks a `**Namespace:**` line, one is inserted with the namespace inferred from the filename (`CANON_OBJECT_<Namespace>_*.md`). If `**ID Prefix:**` is missing, `**ID Prefix:** None.` is inserted.

**Why.** The Identity template requires both fields. Older Canon authoring drafts (Webhook, ParameterGroup, ItemGroup, Template, ...) were written before these became mandatory — the data is implicit in the filename and never wrong, but the template's whitespace-lenient matcher needs to see the marker.

**Affects.** ~15 of 22 files.

### 1.6 Identity — reorder fields to canonical order

**What.** All `**Field:**` blocks in `## 1. Identity` are extracted and re-emitted in the order: Object Name → Namespace → Parent Object → ID Prefix → Description → Also Known As. Description and Also Known As are forced to block style (`**Description:**` on its own line, value on the next).

**Why.** Older drafts emit Aliases before Description, or Description inline with the marker. Both forms break the Identity template. Reordering and forcing block style for prose fields fixes both.

**Affects.** All MDs that have Identity.

### 1.7 Section table headers — alias dialect mapping

**What.** Each table is recognized by its section heading and rewritten to a canonical column layout:

- `## 5. Key Attributes` → `Attribute / Type / Description / Set By / Mutable After Creation? / Notes` (extra columns like `Mutable After [State]?`, `Visible To`, `Mutable After Processing?` are folded into Notes as `<col>: <value>.`)
- `### 7.2 Cross-Object State Effects` → `Triggering Event / Affected Object / Effect on Affected Object / Automated? / Condition / Notes` (the alias `Effect` is mapped to `Effect on Affected Object`).
- `## 6. Relationships to Other Objects` → standard form (`Lifecycle Dependency` ↔ `Lifecycle Dependency?` aliasing).
- `### 3.2 Transitions` → `# / From State / To State / Action / Trigger / Permitted Actor(s) / Preconditions / Outcome / Side Effects`. Older `ID / From / To / Action / Actor / Precondition / Notes` dialect is mapped to the new one.
- `### 3.1 States` → `State / Description / Initial State? / Terminal State?`.

**Why.** Two header dialects coexist in source MDs: the older one (used by Account, Seller, Agreement, Asset, Order, Subscription) and the newer one (Webhook, Product, Order Item, ...). Without alias mapping, the dialect-mismatched data is silently dropped. The parser sees one canonical form regardless of authoring vintage.

**Affects.** Every transitions / attributes / cross-effects / relationships table.

### 1.8 Empty cells → em-dash sentinel `—`

**What.** Empty cells in any markdown table (`| ... |  | ... |`) get an em-dash inserted: `| ... | — | ... |`.

**Why.** The matcher's terminator search for an empty `{ capture }` followed by ` |` finds the next ` |` anywhere in input — typically several rows down — and consumes everything in between. A single non-whitespace token in the cell makes the per-row terminator unambiguous. `graph.js` treats `—` as the empty value at consumption time, so semantics are preserved.

**Affects.** Roughly half of all data rows.

### 1.9 Collapse double blank lines

**What.** Runs of two or more blank lines are collapsed to one.

**Why.** Earlier transforms occasionally leave consecutive blanks (e.g. blockquote stripping followed by table normalization). The matcher is whitespace-lenient between tokens but only across one newline boundary in some configurations; collapsing avoids brittle edge cases.

**Affects.** Cosmetic; touches most files.

---

## Phase 2 — Opinionated content adaptations

These transforms shape the canon into the form the runtime expects, beyond pure formatting. Each one reflects a deliberate authoring decision about how marketplace-canon should look.

Some adaptations consult an optional reference graph (path via the `CANON_REFERENCE_GRAPH` env var) for canonical name lookups. When the env var is absent, those adaptations skip silently — the patch under `.patches/align-format/objects/` is committed already adapted, so consumers don't need to re-run align to ship a working canon.

### 2.1 Expand combined transition rows

**What.** Transition rows whose From or To column contains alternation (`Active / Enabled`, `None / Inactive`) or the literal `Any` are expanded into the cartesian product of individual states. Row ids are renumbered (`T3` → `T3a`, `T3b`, ...). For `Any`, the expansion uses every non-terminal state declared in `### 3.1 States`.

**Why.** Authors used `Active / Enabled` and `Any` as shorthand for "this transition exists for each of these states." The graph model requires a single (from, to) pair per transition. Without expansion, the kebabed cell `active-enabled` is treated as one fictitious state and the transition has broken pointers. Expanding produces real transitions per state pair, all sharing the row's other data (action, actors, preconditions, outcome).

**Affects.** Account (T3, T4 — Active/Enabled), PricingPolicy (T2 None/Inactive, T4 Any).

### 2.2 Canonicalise action names

**What.** For every transition row, the Action / Trigger column is normalised to a canonical name. Source MDs are inconsistent here — sometimes a proper name (`Place Order`), sometimes descriptive prose (`Vendor terminates directly`), sometimes a shortened verb (`Re-publish`), sometimes empty. The patch substitutes a canonical name per (from, to) pair.

**Why.** Action ids are derived from the column value; an inconsistent column produces unstable, ambiguous, or empty ids. A single canonical name per action gives every action a stable id and a human-readable label, and lets multiple transitions covered by the same action coalesce cleanly via action-binding refs.

**Affects.** Account, Seller, Asset, Subscription, Product Item, Product Media, Product Terms / Variant, Webhook, PriceList Item, Pricing Policy.

### 2.3 Add missing state rows

**What.** When a transition row references a state in From or To that isn't declared in `### 3.1 States`, a new row is inserted into the states table with sensible defaults for description, Initial?, and Terminal?.

**Why.** Several source MDs (Product Item, Product Media, Product Terms, Product Terms Variant) reference a `Deleted` state in transition rows but never list it in section 3.1. The graph would otherwise carry broken transition pointers. Adding the row preserves the source MD as the single point of truth.

**Affects.** Product Item, Product Media, Product Terms, Product Terms Variant — one `Deleted` row each.

### 2.4 Add missing attribute rows

**What.** Where the runtime expects an attribute to be visible at the top level of a Section 5 table but the source carries it only as prose (e.g. inside a Business Rule statement), a row is added to the Attributes table.

**Why.** Cross-entity reference fields like `Asset.priceList`, `Asset.agreement`, `Asset.licensee` are described in BR-015 as Asset attributes but aren't listed structurally in the Attributes table. Surfacing them as proper rows gives those fields term nodes and makes them findable, navigable, and renderable.

**Affects.** Asset (price-list, listing, agreement, product, licensee references), Agreement / Order / Subscription (`references`), and a few smaller cases.

---

## Phase 3 — Parser-side handling of prose and links

These are not transforms inside this patch; they are runtime behaviours of `.canon/src/parse.js` and `.canon/src/graph.js`. Documented here so the full data flow is in one place.

### 3.1 Free-text prose captured as `note` refs

Every blockquote (`> ...`) and any section whose body is prose-only (no `|` table rows) is extracted by `parse.js` and emitted by `graph.js` as a `note` ref with `meta.kind=section-prose`, `meta.section=<key>`, owner=entity, subject=entity. Nothing in the source is silently dropped — if it doesn't fit a structured template, it lands in the graph as a note carrying the original text. This covers author-side `**Note:** ...` paragraphs, Section 7.2 prose like "No cross-object state effects.", and template-guidance blockquotes alike. Downstream tools can filter by `meta.kind=section-prose` if they want the structured-only view.

### 3.2 Obsidian-style `[[key]]` mentions emit `mention` refs

`graph.js` post-pass scans all node and ref descriptions for `[[key]]` patterns. The key resolves against an index of (a) any node id, (b) any entity Object Name, (c) any entity alias — case-insensitive. Resolved mentions accumulate per owner-entity into a single `mention` ref with `pointers.target=[targets...]`. Self-mentions and duplicates dedupe. **Broken `[[key]]` (no resolution) is a parse error**, surfaced via `toGraph`'s `mentionErrors` return — never silent. This is the format-explicit alternative to heuristic name-mention detection in prose: authors add `[[X]]` markup only where the link matters semantically; everything else is plain text.
