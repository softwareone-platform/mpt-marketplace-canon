---
name: canon-setup
description: First-run bootstrap for a new clone — walk the human through creating .env (AzDO PAT, org URL, per-namespace repo map, optional live tokens), then perform the first clone of every required source repo. Run once per machine, before /canon-generate or /canon-drift-report.
---

# canon-setup

The one-time bootstrap that makes every other canon Skill runnable on a fresh clone. Nothing in `scripts/canon_*.py` works until `.env` exists and the source repo cache has been populated — `canon-generate` needs both, `canon-drift-report` needs the repo cache and the PAT. This Skill covers exactly that gap and stops: it **never** authors canon, never produces a draft, and never writes into `objects/` or `platform/`.

Two things it deliberately does **not** do: it does not read back, echo, or write secret values (the human types those into `.env` themselves), and it does not invent the private org/project/repo names — those are not in this public repo by design (`.env.example`) and must come from a colleague or an existing clone.

## Invocation

```
/canon-setup [--namespace <ns> ...] [--verify-only]
```

- no arguments — full bootstrap: preflight, `.env` walkthrough, then clone every namespace in `.env.example`.
- `--namespace <ns>` (repeatable) — bootstrap only the named namespaces' repos.
- `--verify-only` — skip the `.env` walkthrough; just preflight and report what is configured and cloned. Safe on an already-set-up machine.

## Step 0 — Preflight (Bash, no secrets touched)

Check and report all four before touching `.env`; a failure here explains a later error far better than the error does:

1. `python3 --version` — the scripts are stdlib-only Python 3. Note whether bare `python` exists; on many machines only `python3` is on PATH, and the README's examples say `python`.
2. `git --version` — **must be ≥ 2.31**. `canon_repo_sync.py` passes the PAT via `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`, which older git silently ignores — the auth header is then never sent and the clone fails as if the PAT were wrong.
3. `curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://dev.azure.com` — a `302` is healthy (redirect to sign-in). A timeout means network/proxy, not credentials.
4. `git -C . rev-parse --show-toplevel` — confirm the working directory is this repo; `canon_common.py` resolves `.env` and `config/` relative to the repo root.

## Step 1 — Collect the private values from a human source

`.env.example` ships the key names with empty values. The values are **not** recoverable from this repo. Ask the human to obtain, from a teammate or an existing working clone:

- the Azure DevOps **org URL** (`CANON_AZDO_ORG_URL`, e.g. `https://dev.azure.com/<org>`)
- the **project + repo list per namespace** (`CANON_REPOMAP_<NS>`, format `<project>:<repo>[,<repo>...]`)

The namespaces in `.env.example` are `CATALOG`, `COMMERCE`, `BILLING`, `ACCOUNTS`, `NOTIFICATIONS`, `AUDIT`. Several namespaces legitimately share a repo (a platform monorepo commonly appears first in every map) — that is expected, not a mistake.

**Repo order is load-bearing.** `config/canon_source_baselines.json` stores `sourceRepoCommits` positionally against `CANON_REPOMAP_<NS>` order. Reordering a namespace's repo list silently misaligns every existing baseline for that namespace against the wrong repo. Preserve the order given.

Never write these values into any tracked file, a commit message, or chat output that ends up in the repo.

## Step 2 — Create `.env`

```bash
cp .env.example .env    # only if .env does not already exist
```

If `.env` exists, do **not** overwrite it — read which keys are empty (key names only, never values) and fill only those.

`.env` is gitignored (`.gitignore` line 12), so there is no commit risk. Confirm that rather than assuming it.

## Step 3 — Mint the Azure DevOps PAT

Walk the human through it; do not attempt to automate it:

1. Go to `https://dev.azure.com/<org>/_usersSettings/tokens`, or the user icon (top right) → **Personal access tokens**.
2. **+ New Token.**
3. **Organization:** the org that holds the project from Step 1. A PAT is scoped to a single org — the wrong org in a multi-org account is the most common cause of a brand-new token still failing.
4. **Expiration:** note the date somewhere. This *will* expire and take the whole pipeline down with it (see Troubleshooting).
5. **Scopes:** choose **Custom defined**, then **Code → Read**. Not "Read & write", not "Full access" — `canon_repo_sync.py` has no push or commit code path by design, so write scope grants reach the tool will never use over real platform source.
6. **Create**, then copy the value immediately — it is shown exactly once.

## Step 4 — Fill in the keys

Tell the human to edit `.env` **in an editor, not via a shell command** — an `echo`/`sed` one-liner writes the PAT into shell history.

Required for cloning:

| Key | Value |
|---|---|
| `CANON_AZDO_PAT` | the PAT from Step 3 |
| `CANON_AZDO_ORG_URL` | org URL from Step 1 |
| `CANON_REPOMAP_<NS>` | `<project>:<repo>[,<repo>...]`, one per namespace |

Optional now, required later by `canon-generate`'s live-sample step (`canon_fetch_live.py`): the six `CANON_TOKEN_<ENV>_<ACTOR>` bearer tokens. **Cloning does not need them** — leave them empty and finish the bootstrap rather than blocking on them. `canon-drift-report` never needs them at all.

Two parser gotchas in `canon_common.load_dotenv`, both of which fail as a confusing auth error rather than a parse error:

- **No quotes.** It does `value.strip()` but never strips quote characters, so `CANON_AZDO_PAT="abc"` sends literal quotes in the auth header. Bare values only. Surrounding whitespace is fine.
- **A shell export silently wins.** It only sets a key `if key not in os.environ`. If any of these are exported in the shell or a profile, editing `.env` changes nothing. Check with `printenv CANON_AZDO_PAT` (which prints nothing when correctly unset).

## Step 5 — Verify the config resolves, without revealing secrets

Confirm each required key is **present and non-empty** by key name only — never print, log, or echo a value, and never `cat .env`. Reporting "set / MISSING" per key is sufficient and is what the human needs.

`require_env` exits(1) naming the exact missing variable, so a missing key produces a precise message on first run anyway.

## Step 6 — First clone, one namespace at a time

```bash
python3 scripts/canon_repo_sync.py <namespace>
```

**Serially. Never concurrently.** The script has no locking and namespaces share one on-disk cache, so parallel syncs race — the same constraint `canon-generate-batch` works around.

On a fresh machine each repo is a full clone, so the first run is slow; subsequent runs are fetch + reset. Repos are cloned into `reposCacheDir` from `config/canon_pipeline.config.json` (default `~/.cache/mpt-canon-pipeline/repos`), overridable with `CANON_REPOS_DIR`. That location is deliberately outside this repo's working tree so platform source can never be committed into the public canon repo.

Tell the human what the cache is: a **disposable read-only mirror**. Every sync hard-resets to the repo's default branch, so any local edit made there is discarded without warning. It is not a place to work.

If a namespace fails, fix it before continuing rather than proceeding — the same misconfiguration usually affects all of them (every namespace map tends to start with the same shared repo, so one bad PAT fails all six identically).

## Step 7 — Verify the clones

For each synced path the script prints, report the repo, its HEAD (`git -C <path> rev-parse --short HEAD`) and the tip commit date. Flag anything conspicuous rather than assuming it is wrong: a repo whose default branch has genuinely been dormant for a long time is normal and is **not** evidence of a bad clone — check the tip date against the remote before calling it stale.

## Step 8 — Hand off

State plainly what is and is not usable:

- **Ready now:** `/canon-drift-report` (source + spec channels, no live tokens). On a fresh clone every object is unbaselined, so the first run **seeds baselines and reports "no diff yet"** — that is correct behaviour, not a failure, and `config/canon_source_baselines.json` will then have uncommitted changes to commit.
- **Ready now:** `/canon-generate` for its spec + source evidence.
- **Not ready until the `CANON_TOKEN_*` values are filled:** `canon-generate`'s live multi-Actor sampling.
- Note that `config/canon_source_paths.local.json` (the precise object→source-path cache) is per-clone and gitignored, so a new machine starts on the token-matching fallback until `/canon-drift-update` has run.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `fatal: could not read Username for 'https://dev.azure.com'` | **401** — git fell back to an interactive credential prompt with no TTY. PAT expired, revoked, or malformed (quotes in `.env`). | Re-mint per Step 3. This is the expiry failure mode; it hits every namespace identically. |
| `The requested URL returned error: 403` | Authenticated but **under-scoped** — PAT lacks Code: Read, or is scoped to the wrong org/project. | Re-mint with Code → Read on the correct org. |
| `Error: required environment variable 'X' is not set.` | Key missing or empty in `.env`, or `.env` absent. | Fill that key (Step 4). |
| Auth fails even with a freshly minted PAT | A stale shell `export` shadows `.env`, or git < 2.31 ignores `GIT_CONFIG_*`. | `printenv CANON_AZDO_PAT`; check `git --version`. |
| `Error: config file not found` | Not running from the repo root. | `cd` to the repo root. |

## What this Skill never does

- Never authors or edits canon, and never writes into `objects/`, `platform/`, or `concepts/`.
- Never prints, echoes, logs, or commits a secret value, and never edits `.env` on the human's behalf.
- Never invents an org, project, or repo name, and never commits one into this public repo.
- Never runs namespace syncs concurrently.
- Never pushes to a source repo — `canon_repo_sync.py` is architecturally read-only; do not add a write path.
