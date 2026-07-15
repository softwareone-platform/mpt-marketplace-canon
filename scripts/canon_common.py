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
