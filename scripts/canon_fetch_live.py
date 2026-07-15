"""
canon_fetch_live.py

Fetches a single platform object by ID from a live MPT API environment,
using a bearer token scoped to a specific Actor (Vendor, Operations, or
Client). Used by the canon-generate pipeline to gather real JSON samples
and empirically diff Actor-based field suppression.

Usage:
    python scripts/canon_fetch_live.py <namespace> <object> <id> --path <api_path> --env <staging|prod> --out-dir <dir> [--actor <vendor|operations|client|all>] [--select <value>]

--select is an optional passthrough of the platform's own read-only field-
inclusion / reference-expansion query parameter (preamble Section 6.2) —
e.g. `--select +secret,+statistics` to see fields omitted by default. It
never changes the request method or adds any write capability.

Examples:
    python scripts/canon_fetch_live.py catalog product PRD-1234 \\
        --path /public/v1/catalog/products/{id} --env staging \\
        --out-dir .evidence/catalog_product/20260715T120000Z

    python scripts/canon_fetch_live.py catalog product PRD-1234 \\
        --path /public/v1/catalog/products/{id} --env prod --actor operations \\
        --out-dir .evidence/catalog_product/20260715T120000Z

    python scripts/canon_fetch_live.py notifications webhook WBH-1234 \\
        --path /public/v1/notifications/webhooks/{id} --env staging --actor operations \\
        --select +secret,+statistics,+lastSuccess,+lastFailure,+lastCall \\
        --out-dir .evidence/notifications_webhook/20260715T120000Z/omitted-fields

SAFETY — READ BEFORE MODIFYING:
This tool performs HTTP GET requests only. There is no --method flag and
no code path that constructs a POST/PUT/PATCH/DELETE request, for either
environment. This is deliberate: PROD holds real customer data, and this
tool must remain incapable of writing to it, not merely instructed not to.
Do not add a --method flag or a request-body argument to this script.

It also fetches exactly one object by ID per invocation — never a list/
collection endpoint. Do not add pagination or bulk-export support.

Base URLs come only from config/canon_pipeline.config.json — there is no
--base-url override, so a fetch can never be redirected to an endpoint
other than the configured one for the named environment.

Bearer tokens are read only from environment variables (CANON_TOKEN_<ENV>_
<ACTOR>, see .env.example) — never accepted as a CLI argument (which would
leak into shell history / `ps`), never printed, never written into output
files.
"""

import sys
import json
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from canon_common import normalise, load_dotenv, load_config, token_env_var, require_env

ACTORS = ["vendor", "operations", "client"]
ENVS = ["staging", "prod"]


def assert_get_only(env, method):
    """
    Hard safety boundary — do not remove or weaken. This is the single
    enforced checkpoint for the "this tool is GET-only, in every
    environment" constraint. Called at the top of main(), before any URL
    is built, any token is read, or any network call is made.
    """
    if env not in ENVS:
        print(f"Error: unknown environment '{env}'. Must be one of: {', '.join(ENVS)}.")
        sys.exit(1)
    if method != "GET":
        print("Error: this tool only ever performs GET requests. "
              "No write capability exists for any environment.")
        sys.exit(1)


def build_url(base_url, path, object_id, select=None):
    if not base_url:
        print("Error: no baseUrl configured. Fill in config/canon_pipeline.config.json "
              "environments.<env>.baseUrl before fetching.")
        sys.exit(1)
    if not path.startswith("/"):
        print(f"Error: --path must start with '/' (got '{path}').")
        sys.exit(1)
    url = base_url.rstrip("/") + path.replace("{id}", object_id)
    if select:
        # select= is a read-only field-inclusion/reference-expansion parameter
        # (preamble Section 6.2) — it does not change the request method or
        # add any write capability.
        url += "?select=" + urllib.parse.quote(select, safe=",+-")
    return url


def fetch_one(url, token):
    """Performs exactly one HTTP GET. Returns (status, parsed_json, raw_byte_length)."""
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        # Headers (incl. Authorization) are deliberately withheld from output.
        print(f"Error: HTTP {e.code} {e.reason} fetching object.")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Error: network failure reaching API host ({e.reason}).")
        sys.exit(1)

    try:
        body = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        print("Error: response body was not valid JSON.")
        sys.exit(1)

    return resp.status, body, len(raw)


def fetch_for_actor(env, actor, url, out_dir):
    token = require_env(token_env_var(env, actor))
    status, body, size = fetch_one(url, token)
    out_path = out_dir / "live" / env / f"{actor}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(body, indent=2), encoding="utf-8")
    print(f"  {actor}: HTTP {status}, {size} bytes -> {out_path}")


def parse_args(argv):
    if len(argv) < 3:
        print("Usage: python scripts/canon_fetch_live.py <namespace> <object> <id> "
              "--path <api_path> --env <staging|prod> --out-dir <dir> "
              "[--actor <vendor|operations|client|all>] [--select <value>]")
        sys.exit(1)

    namespace, object_name, object_id = argv[0], argv[1], argv[2]
    opts = {"actor": "all"}

    rest = argv[3:]
    i = 0
    while i < len(rest):
        flag = rest[i]
        if flag in ("--path", "--env", "--out-dir", "--actor", "--select") and i + 1 < len(rest):
            opts[flag[2:].replace("-", "_")] = rest[i + 1]
            i += 2
        else:
            print(f"Error: unrecognised argument '{flag}'.")
            sys.exit(1)

    for required in ("path", "env", "out_dir"):
        if required not in opts:
            print(f"Error: --{required.replace('_', '-')} is required.")
            sys.exit(1)

    return normalise(namespace), normalise(object_name), object_id, opts


def main():
    namespace, object_name, object_id, opts = parse_args(sys.argv[1:])

    env = opts["env"]
    assert_get_only(env, "GET")

    actor = opts["actor"]
    if actor != "all" and actor not in ACTORS:
        print(f"Error: --actor must be one of: all, {', '.join(ACTORS)}.")
        sys.exit(1)

    load_dotenv()
    config = load_config()
    base_url = config.get("environments", {}).get(env, {}).get("baseUrl")
    url = build_url(base_url, opts["path"], object_id, select=opts.get("select"))

    out_dir = Path(opts["out_dir"])
    actors_to_fetch = ACTORS if actor == "all" else [actor]

    print(f"Fetching {namespace}/{object_name} id={object_id} from {env} "
          f"for actor(s): {', '.join(actors_to_fetch)}")
    for a in actors_to_fetch:
        fetch_for_actor(env, a, url, out_dir)

    print("Done.")


if __name__ == "__main__":
    main()
