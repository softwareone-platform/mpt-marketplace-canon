---
name: canon-drift-report
description: Read-only staleness scan — rank canonised objects by how far their source/spec has drifted since a recorded baseline, and print a ranked report. Never drafts, never writes objects/, needs no live tokens. Feeds /canon-drift-update.
---

# canon-drift-report

The detection half of the drift pipeline. Canon is trusted only "as of **Last Updated**" (`questions/CANON_BACKLOG.md`), and the platform keeps evolving in the source repos and the OpenAPI spec, so 🟢 canon silently goes stale. This Skill answers *which* canon has drifted and *by how much*, as a ranked worklist — it does **not** change any canon. It produces **no draft** and writes nothing into `objects/`; its only tracked-tree write is seeding new baselines in `config/canon_source_baselines.json` (bookkeeping, see Step 4). Reconciling the drift it surfaces is the separate `/canon-drift-update`.

Detection is two cheap, headless channels — a **source** channel (`git diff` lines-changed since the baseline commit) and a **spec** channel (a fingerprint diff of the object's OpenAPI surface). Neither needs a live object ID or a `CANON_TOKEN_*` (only the Code-Read PAT that `canon_repo_sync.py` already uses, plus the unauthenticated spec GET) — so `--all` runs unattended.

## Invocation

```
/canon-drift-report [--all] [--namespace <namespace>] [<namespace> <object> [--parent <p>] ...]
```

- `--all` — scan every canonised object (backlog rows with status 🟢/🟡 and a Canon File link).
- `--namespace <ns>` — restrict `--all` to one namespace.
- an explicit list — scan only the named objects (same normalised grammar as `/canon-generate`).

## Step 0 — Build the worklist

- `--all` (optionally `--namespace`): `python scripts/canon_baseline.py list-canonised [--namespace <ns>]` returns the canonised objects (namespace, object, parent, canon filename, status). That is the scan set.
- Explicit list: normalise each `<namespace>/<object>/<parent>` (via the object's own row from `list-canonised`, which also gives the exact canon filename). Confirm each `objects/<filename>` exists — drift only applies to existing canon; if an object is not canonised, note it and recommend `/canon-generate` instead.

## Step 1 — Serial repo pre-sync (Bash)

Compute the distinct namespaces in the worklist. Run `python scripts/canon_repo_sync.py <namespace>` **one at a time** (never concurrently — shared on-disk cache, no locking; same rationale as `canon-generate-batch` Step C). For each synced path it prints, capture the current commit: `git -C <path> rev-parse HEAD`. If a namespace's sync fails (missing `CANON_REPOMAP_<NS>` / auth), **exclude that namespace's objects** from the scan and list them as "source unavailable" in the report — do not guess a repo location.

## Step 2 — Fetch the spec once per environment

`python scripts/canon_fetch_openapi_spec.py staging --out <tmp>/openapi_staging.json` (unauthenticated). Fetch once and reuse across every object in the run. (STAGING is authoritative for schema grounding, per `canon-generate` Step 1.)

## Step 3 — Detect per object (headless — no sub-agent, no tokens, no draft)

For each object:
1. `python scripts/extract_canon_schema.py <spec> <namespace> <object> [--exact]` (use `--exact` for top-level objects, non-exact for children — see the script's docstring), then `python scripts/canon_drift_scan.py fingerprint <extract.json>` → the **current** fingerprint.
2. `python scripts/canon_baseline.py get <namespace> <object> [--parent p]`:
   - **No baseline yet** → `python scripts/canon_baseline.py record <namespace> <object> [--parent p] --file <canon filename> --spec-version <spec info.version> --commit <sha> [--commit <sha> …] --extract <extract.json>`. This is the **bootstrap** (decision C): record the current commit(s), spec version, and fingerprint, mark the object **"baseline established — no diff yet"**, and move on. Real drift is measured from the next run. Pass `--commit` once per synced repo path, in `CANON_REPOMAP_<NS>` order.
   - **Baseline exists** → run `python scripts/canon_drift_scan.py scan --repo <path> --base <baseline sha> [--repo … --base …] <matcher> --baseline-fp <baseline fingerprint> --current-fp <current fingerprint>`, where `<matcher>` is chosen in Step 3. Write the baseline's stored `specFingerprint` to a temp file for `--baseline-fp`.
3. **Source-channel matcher** — how the source diff is filtered to this object:
   - **Precise (preferred):** `python scripts/canon_baseline.py paths-get <namespace> <object> [--parent p]`. If it returns a non-empty list, pass each as `--source-path <p>` — an exact match with no sibling bleed. This cache is populated by `/canon-drift-update` and is per-clone (gitignored); a fresh clone/CI simply won't have it yet.
   - **Fallback (name tokens):** if the cache is empty, pass `--token <T>` for the object's PascalCase singular and plural (e.g. `orders` → `Order`, `Orders`) **and** the entity schema component name(s) in the extract's `components.schemas`. This is a deliberate triage heuristic (decision 6a): it over-matches sibling churn, which is fine because the ranking is only a shortlist — the human elects what to draft, and `/canon-drift-update`'s research separates real change from noise (and refreshes the path cache so the next scan is precise).

## Step 4 — Rank and report (in chat; no file written)

Rank the objects that had a baseline by `sourceLinesChanged` (descending — the shipped metric, decision D); surface the spec-delta counts alongside (not blended into the score, decision 4); flag `escalate`. Print, in the chat, a ranked markdown table:

| Rank | Object | Canon file | Src lines Δ | Spec Δ (paths / attrs / enums ±) | Escalate? | Recommended action |

- **Escalate = yes** rows (from the scan's `escalateReasons` — a state/status enum change, or documented paths removed) get the recommendation **"full `/canon-generate` refresh"**, not an incremental update — a scoped edit can't safely touch §3 or an object split/merge.
- Other drifted rows get **"`/canon-drift-update <ns> <obj>`"**.
- **Zero-drift** rows (source 0 and spec-delta 0) are summarised as "no drift" (not individually listed unless few).
- List separately any objects that were **baseline-established** this run, and any **excluded** (source unavailable, not canonised).

Do **not** write a report `.md` file (matches the no-report-file / draft-only conventions). End with the one-line instruction to run `/canon-drift-update <namespace> <object> …` on the chosen subset.

## Step 5 — Baselines seeded this run

If Step 3 recorded any new baselines (first run / newly-canonised objects), `config/canon_source_baselines.json` now has uncommitted changes. Tell the human: commit that file so the baselines are shared (the first `--all` run seeds every object at once; subsequent runs write nothing unless a new object was canonised). This file is committed by `/canon-submit-pr` on the next promotion, or the human can commit the seed directly — it contains only commit SHAs (no repo names) and public-spec-derived fingerprints.

## What this Skill never does

- Never produces a draft and never writes into `objects/` or `platform/` — it only reads canon and (on first-see) seeds baselines.
- Never fetches a live object or uses a `CANON_TOKEN_*` — source + spec channels only.
- Never edits canon to match code — it reports drift; the PM decides what (if anything) canon should say, via `/canon-drift-update`.
