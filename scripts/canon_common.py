"""
canon_common.py

Shared helpers for the canon-generate pipeline scripts: .env loading,
pipeline config loading, and object-name normalisation.

Not a CLI — imported by canon_fetch_live.py, canon_diff_actors.py, and
canon_repo_sync.py. Standard library only, no third-party dependency.

normalise() matches extract_canon_schema.py's convention exactly
(lowercase, spaces to hyphens) so namespace/object names resolve
identically across every pipeline script.
"""

import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = REPO_ROOT / ".env"
CONFIG_FILE = REPO_ROOT / "config" / "canon_pipeline.config.json"


def normalise(s):
    """Lowercase and hyphenate a string for comparison. Matches extract_canon_schema.py."""
    return s.lower().replace(" ", "-")


def load_dotenv(env_path=None):
    """
    Populate os.environ from a plain KEY=VALUE .env file. Existing
    environment variables always take precedence over the file. Does
    nothing if the file doesn't exist — .env is optional if the caller
    already exported variables directly in their shell.
    """
    path = Path(env_path) if env_path else ENV_FILE
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


def require_env(var_name):
    """Fetch a required environment variable, or exit(1) naming the exact missing var."""
    value = os.environ.get(var_name)
    if not value:
        print(f"Error: required environment variable '{var_name}' is not set.")
        print("Set it in your shell, or add it to .env (see .env.example).")
        sys.exit(1)
    return value


def load_config(config_path=None):
    """Load config/canon_pipeline.config.json, or exit(1) if missing/invalid."""
    path = Path(config_path) if config_path else CONFIG_FILE
    if not path.exists():
        print(f"Error: config file not found: {path}")
        sys.exit(1)
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: {path} is not valid JSON: {e}")
        sys.exit(1)


def token_env_var(env, actor):
    """CANON_TOKEN_<ENV>_<ACTOR> — e.g. token_env_var('staging', 'vendor') -> CANON_TOKEN_STAGING_VENDOR."""
    return f"CANON_TOKEN_{env.upper()}_{actor.upper()}"


def repo_map_env_var(namespace):
    """CANON_REPOMAP_<NAMESPACE> — namespace uppercased, hyphens to underscores."""
    return "CANON_REPOMAP_" + namespace.upper().replace("-", "_")


def azdo_org_url():
    """
    Azure DevOps org URL from the CANON_AZDO_ORG_URL environment variable.
    Kept in .env (gitignored) rather than the committed config so the private
    org URL is never published in this public repo. See .env.example.
    """
    return require_env("CANON_AZDO_ORG_URL")


def namespace_repo_map(namespace):
    """
    Resolve the Azure DevOps project + repo list for a namespace from the
    CANON_REPOMAP_<NAMESPACE> environment variable (see .env.example).

    Format: "<project>:<repo>[,<repo>...]" — e.g. "ProjectName:core-repo,extension-repo".
    Returns (project, [repos]). Kept in .env (gitignored) rather than the
    committed config so private project/repo names are never published in
    this public repo. Exits(1) with a namespace-specific message if the
    variable is unset or malformed.
    """
    var = repo_map_env_var(namespace)
    raw = os.environ.get(var)
    if not raw:
        print(f"Error: required environment variable '{var}' is not set.")
        print(f"Add it to .env (see .env.example) with the Azure DevOps project "
              f"and repo name(s) for the '{namespace}' namespace, in the form "
              f"<project>:<repo>[,<repo>...].")
        sys.exit(1)
    project, sep, repos_raw = raw.partition(":")
    project = project.strip()
    repos = [r.strip() for r in repos_raw.split(",") if r.strip()]
    if not sep or not project or not repos:
        print(f"Error: {var} must be in the form <project>:<repo>[,<repo>...] "
              f"(got '{raw}').")
        sys.exit(1)
    return project, repos
