"""
canon_repo_sync.py

Clones or syncs Azure DevOps platform source repos into a local cache
directory, for read-only research during canon authoring. Never pushes,
commits, or otherwise writes back to Azure DevOps — there is no code path
for it, by design, matching the read-only posture of canon_fetch_live.py.

The cache directory lives outside this repo's working tree by default
(reposCacheDir in config/canon_pipeline.config.json, override via the
CANON_REPOS_DIR environment variable) so cloned platform source code is
never a candidate for accidental commit into the canon repo.

Usage:
    python scripts/canon_repo_sync.py <namespace>

Reads the Azure DevOps org URL and the namespace's project/repo mapping
from environment variables (see .env.example) — kept in .env (gitignored)
rather than the committed config so private org/project/repo names are
never published in this public repo:
    CANON_AZDO_ORG_URL      -> e.g. "https://dev.azure.com/<org>"
    CANON_REPOMAP_<NAMESPACE> -> "<project>:<repo>[,<repo>...]"
The disposable cache location (reposCacheDir) still comes from
config/canon_pipeline.config.json, overridable via CANON_REPOS_DIR.

Requires:
    CANON_AZDO_PAT environment variable (Code Read scope PAT). See .env.example.
    The PAT is passed to git via a per-process environment variable
    (GIT_CONFIG_*), never as a CLI argument and never written into the
    repo's remote URL — so it never lands in shell history, `ps` argv,
    or .git/config.

Each sync is a hard reset to the repo's default branch on Azure DevOps —
this is a disposable read-only mirror, not a place to make or keep local
edits. Any local changes in the cache directory will be discarded.
"""

import sys
import os
import base64
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from canon_common import (
    load_dotenv,
    load_config,
    require_env,
    normalise,
    azdo_org_url,
    namespace_repo_map,
)


def auth_header_value(pat):
    encoded = base64.b64encode(f":{pat}".encode("utf-8")).decode("ascii")
    return f"AUTHORIZATION: Basic {encoded}"


def git_env_with_auth(pat):
    """
    Injects the AzDO auth header via env vars rather than `-c` CLI flags
    or a credentialed URL, so the PAT never appears in argv or .git/config.
    """
    env = os.environ.copy()
    env["GIT_CONFIG_COUNT"] = "1"
    env["GIT_CONFIG_KEY_0"] = "http.extraHeader"
    env["GIT_CONFIG_VALUE_0"] = auth_header_value(pat)
    return env


def run_git(args, cwd=None, env=None):
    """Runs git as an argv list (never shell=True, never push/commit — no such call exists here)."""
    result = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        print(f"Error: git {' '.join(args[:2])} failed:\n{result.stderr.strip()}")
        sys.exit(1)
    return result.stdout.strip()


def sync_repo(org_url, project, repo, cache_dir, pat):
    target = cache_dir / repo
    clone_url = f"{org_url.rstrip('/')}/{project}/_git/{repo}"
    auth_env = git_env_with_auth(pat)

    if (target / ".git").exists():
        print(f"Syncing existing clone: {target}")
        run_git(["fetch", "--quiet", "origin"], cwd=target, env=auth_env)
        run_git(["remote", "set-head", "origin", "--auto"], cwd=target, env=auth_env)
        default_ref = run_git(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd=target)
        branch = default_ref.rsplit("/", 1)[-1]
        run_git(["reset", "--hard", f"origin/{branch}"], cwd=target)
    else:
        print(f"Cloning {repo} into {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
        run_git(["clone", "--quiet", clone_url, str(target)], env=auth_env)

    print(f"  ready: {target}")
    return target


def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/canon_repo_sync.py <namespace>")
        sys.exit(1)

    namespace = normalise(sys.argv[1])
    load_dotenv()
    config = load_config()
    pat = require_env("CANON_AZDO_PAT")

    org_url = azdo_org_url()
    project, repos = namespace_repo_map(namespace)

    cache_dir_raw = os.environ.get("CANON_REPOS_DIR") or config.get(
        "reposCacheDir", "~/.cache/mpt-canon-pipeline/repos"
    )
    cache_dir = Path(cache_dir_raw).expanduser()
    cache_dir.mkdir(parents=True, exist_ok=True)

    print(f"Namespace '{namespace}' -> project '{project}', {len(repos)} repo(s)")
    synced = [sync_repo(org_url, project, repo, cache_dir, pat) for repo in repos]

    print("Done. Synced paths:")
    for path in synced:
        print(f"  {path}")


if __name__ == "__main__":
    main()
