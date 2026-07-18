---
name: canon-drift-update
description: Reconcile drift for a canonised object — detect what changed in source/spec since its baseline, then draft a SCOPED edit of the existing canon (touched sections only) for PM review. Draft-only; hands to /canon-submit-pr. Run /canon-drift-report first to see what drifted.
---

# canon-drift-update

The reconciliation half of the drift pipeline. `/canon-drift-report` tells you *which* canon drifted; this Skill takes the object(s) you pick and produces a **scoped** update draft — it edits only the sections the drift touched and preserves everything else verbatim, in contrast to `/canon-generate`, which re-derives the whole object from a full evidence sweep. Same boundaries as `canon-generate`: it **only ever produces a draft** in `.evidence/`, never writes into `objects/`, and promotion is the separate `/canon-submit-pr`. Detection is git + spec only by default; `--live-verify` adds a single live GET.

**The critical guardrail (CLAUDE.md):** code is *evidence, not the arbiter of intent*. A source change is a trigger to **review**, never an instruction to conform — surface intent-vs-implementation divergences to the PM (the same resolution round `canon-generate` uses), never silently rewrite canon to match the code. No internal source identifiers ever appear in the draft (this repo is public).

## Required reading before drafting

Read in full (as `canon-generate` requires): `preamble/PLATFORM_CANON_PREAMBLE.md`, `templates/CANON_OBJECT_TEMPLATE.md`, `templates/CANON_AUTHORING_SESSION_PROMPT.md`, and `.claude/skills/canon-generate/SKILL.md`'s "Wikilinking other objects" and Step 6 rules. This Skill does not restate them.

## Invocation

```
/canon-drift-update <namespace> <object> [--parent <p>] [--live-verify]
```
or one object-spec per line for several objects (same grammar as `canon-generate-batch`).

## Step 0 — Preflight

Normalise `<namespace>`/`<object>`/`<parent>`; get the exact canon filename from `python scripts/canon_baseline.py list-canonised`. Confirm `objects/<filename>` exists (else stop — recommend `/canon-generate` for a new object) and **read it in full** — it is the base you will scope-edit. Load the baseline: `python scripts/canon_baseline.py get <namespace> <object> [--parent p]`.

## Step 1 — Repo sync + HEAD

`python scripts/canon_repo_sync.py <namespace>` (serial per distinct namespace when several objects — shared cache, no locking). `git -C <path> rev-parse HEAD` per synced path.

## Step 2 — Spec fetch + extract + fingerprint

`canon_fetch_openapi_spec.py staging` → `extract_canon_schema.py <spec> <namespace> <object> [--exact]` → `canon_drift_scan.py fingerprint <extract.json>` (the current fingerprint).

## Step 3 — Baseline gate

No baseline recorded → `canon_baseline.py record …` the current commit(s)+spec version+fingerprint and **stop** (there is nothing to diff yet; `/canon-drift-report` normally seeds this). Otherwise continue.

## Step 4 — Detect

`python scripts/canon_drift_scan.py scan --repo <path> --base <baseline sha> [--repo … --base …] <matcher> --baseline-fp <baseline fingerprint file> --current-fp <current fingerprint file>` → the drift record (source lines-changed + matched files + spec delta + escalate flag). Choose `<matcher>` exactly as `canon-drift-report` Step 3: `--source-path` entries from `canon_baseline.py paths-get` if the cache has this object, else `--token` name variants. **If the record shows zero source drift and zero spec delta, stop** — nothing to update; the baseline may still be advanced at promotion.

## Step 5 — Escalation gate

Do **not** attempt a scoped edit — instead report and recommend a full `/canon-generate` — when any of:
- the scan sets `escalate` (a state/status enum change, or documented paths removed — §3 is template all-or-nothing and an object split/merge can't be patched incrementally);
- your reading of the drift maps it to **more than ~3 canon sections** (at that point it's a re-derivation, not a patch).

Otherwise proceed to a scoped draft.

## Step 6 — Diff-scoped source research (read-only sub-agent)

Launch a read-only sub-agent (the `canon-generate` Step 5 pattern — never writes/commits/pushes into the synced repo), scoped to **what changed since the baseline**, not the whole object. Give it: the synced repo path(s); `git -C <path> diff <baseline sha>..HEAD` (and the matched files from Step 4); the current canon file; and the Step 4 spec delta. Brief it to:
- explain, `file:line` and marked `[read]`/`[inferred]`, what each relevant change *does* and which canon section(s) it bears on;
- **distinguish behavioural change from refactor/rename noise** — say explicitly when a matched file changed with no behavioural effect on this object (the ranking over-matches by design);
- apply the intent-vs-impl caveat: report divergences between the code and documented intent for PM adjudication; never assert the code is the intended behaviour;
- flag if the change actually needs a *different* object's canon corrected (report it back, as `canon-generate` Step 6 does).

Write findings to `.evidence/<namespace>_<object>/<run>/repo_notes.md`. `--live-verify` (opt-in) additionally does one `canon_fetch_live.py` GET (the only token-needing step) to confirm the current shape. Several objects: serial pre-sync then a `Workflow` fan-out mirroring `canon-generate-batch` Step D (including its template-exact-structure agent brief).

**Refresh the source-path cache (#6-(b)):** from the sub-agent's `file:line` citations, collect the distinct repo-relative source files that genuinely belong to this object and record them — `python scripts/canon_baseline.py paths-set <namespace> <object> [--parent p] --file <canon filename> --path <src/file> [--path …]`. This sharpens the next `/canon-drift-report` source scan from the name-token heuristic to exact-file matching. The cache is per-clone and **gitignored** (`config/canon_source_paths.local.json`) — internal source paths must never enter this public repo — so this write is not committed and not part of the PR.

## Step 7 — Scoped draft + resolve candidates

Copy the current `objects/<filename>` to `.evidence/<namespace>_<object>/<run>/draft/<filename>` and edit **only the drift-touched sections**, leaving every other section byte-for-byte unchanged. Apply the same authoring rules as `canon-generate` Step 6 (atomic `BR-NNN`, `Namespace: Object` + `[[WikiLink]]` conventions, no source identifiers, short Rule Statements, Notes = behaviour only) and **template-exact structure** (per the `canon-generate-batch` §D brief: §3 all-or-nothing; §5 exactly the 6 columns; one transition per (From,To) pair; `| --- |` separators). Add a newest-first §11 changelog row describing the drift reconciled (e.g. "Updated §4/§5 to reflect source changes since the recorded baseline"). Resolve every candidate question with the human in one batched round (`canon-generate` Step 6 outcomes: confirmed fact folded in plainly; a lead chased; a genuine unknown becomes a tracked open question). Put a section-by-section diff summary in your chat reply.

## Step 8 — Bookkeeping + baseline + handoff

- **Backlog** (`questions/CANON_BACKLOG.md`): set the object's row to 🟡 with a note like `Drift update drafted <date> via canon-drift-update — pending PM review.` Leave **Last Updated** / **Canon File** for promotion.
- **Open questions** (`questions/CANON_OPEN_QUESTIONS.md`): add any genuinely-unresolved candidates, per `canon-generate` Step 7.
- **Baseline** (`config/canon_source_baselines.json`): `canon_baseline.py record <namespace> <object> [--parent p] --spec-version <current> --commit <current HEAD> [--commit …] --extract <extract.json>` — advance the pending baseline to the current commit(s)+fingerprint in the working tree. It is **committed by `/canon-submit-pr` at promotion** (so a discarded draft can be reverted by resetting the file); do not commit it here.
- Tell the human to review the draft, then run `/canon-submit-pr <namespace> <object>`. Promotion, the single commit, and the PR are all handled there.

## What this Skill never does

- Never writes into `objects/` or `platform/`; never promotes or opens a PR itself.
- Never re-derives the whole object — only the drift-touched sections (escalate to `/canon-generate` when the change is structural).
- Never conforms canon to code — divergences go to the PM.
