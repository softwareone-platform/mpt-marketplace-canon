"""
canon_fetch_openapi_spec.py

Downloads the live OpenAPI spec for a given environment, so canon-generate
always extracts schema from the spec that actually matches the environment
it's about to call. STAGING can be ahead of PROD (PLATFORM_CANON_PREAMBLE.md
Section 7: STAGING is used for early access to major releases before PROD
promotion), so a single manually-downloaded spec file can be current for one
environment while stale for the other.

This is an unauthenticated GET against a public spec endpoint — no bearer
token is used or required.

Usage:
    python scripts/canon_fetch_openapi_spec.py <staging|prod> --out <path>

Looks up config/canon_pipeline.config.json: environments.<env>.openapiUrl
"""

import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from canon_common import load_config

ENVS = ["staging", "prod"]


def parse_args(argv):
    if len(argv) < 1:
        print("Usage: python scripts/canon_fetch_openapi_spec.py <staging|prod> --out <path>")
        sys.exit(1)

    env = argv[0]
    if env not in ENVS:
        print(f"Error: unknown environment '{env}'. Must be one of: {', '.join(ENVS)}.")
        sys.exit(1)

    opts = {}
    rest = argv[1:]
    i = 0
    while i < len(rest):
        if rest[i] == "--out" and i + 1 < len(rest):
            opts["out"] = rest[i + 1]
            i += 2
        else:
            print(f"Error: unrecognised argument '{rest[i]}'.")
            sys.exit(1)

    if "out" not in opts:
        print("Error: --out is required.")
        sys.exit(1)

    return env, opts["out"]


def main():
    env, out_path = parse_args(sys.argv[1:])

    config = load_config()
    url = config.get("environments", {}).get(env, {}).get("openapiUrl")
    if not url:
        print(f"Error: environments.{env}.openapiUrl is not set in config/canon_pipeline.config.json.")
        sys.exit(1)

    req = urllib.request.Request(url, method="GET")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        print(f"Error: HTTP {e.code} {e.reason} fetching OpenAPI spec from {env}.")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Error: network failure reaching {env} spec URL ({e.reason}).")
        sys.exit(1)

    try:
        body = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        print("Error: response body was not valid JSON.")
        sys.exit(1)

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(body, indent=2), encoding="utf-8")
    print(f"OpenAPI spec ({env}) written to {out} ({len(raw)} bytes)")


if __name__ == "__main__":
    main()
