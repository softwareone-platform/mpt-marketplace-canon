"""
canon_baseline.py

Owns the committed drift baseline sidecar `config/canon_source_baselines.json` —
the per-canon-file record of the source commit(s), spec version, and spec
fingerprint the canon was last verified against. Read/updated by the
canon-drift skills and advanced at promotion time by canon-submit-pr.

The sidecar is keyed by canon filename (the stable promoted identity, already
the join key between questions/CANON_BACKLOG.md and objects/). Each entry also
stores the normalised namespace/object/parent so get/record can match without
reconstructing the PascalCase filename (which is lossy, e.g. ErpLink).

`sourceRepoCommits` is a POSITIONAL array aligned to CANON_REPOMAP_<NS> order —
private repo NAMES are never written here (they live in gitignored .env); bare
commit SHAs are opaque and carry no repo name or content.

Usage:
    python scripts/canon_baseline.py get <namespace> <object> [--parent <p>]
    python scripts/canon_baseline.py record <namespace> <object> [--parent <p>] \\
        --file CANON_OBJECT_<Ns>_<Obj>.md --spec-version <v> \\
        --commit <sha> [--commit <sha> ...] \\
        (--fingerprint <fp.json> | --extract <extract.json>)
    python scripts/canon_baseline.py list [--namespace <ns>]
    python scripts/canon_baseline.py list-canonised [--namespace <ns>]

    # Object->source-path cache (gitignored config/canon_source_paths.local.json):
    python scripts/canon_baseline.py paths-get <namespace> <object> [--parent p]
    python scripts/canon_baseline.py paths-set <namespace> <object> [--parent p] \\
        --file CANON_OBJECT_<Ns>_<Obj>.md --path <src/path> [--path ...]

`list-canonised` reads questions/CANON_BACKLOG.md and prints the worklist of
canonised (🟢/🟡) objects — the enumerable set the drift report scans. The
paths cache is per-clone and NOT committed (source paths reveal internal repo
structure); it sharpens the source channel when present and is refreshed by
canon-drift-update. Stdlib only; matches the other canon_*.py CLI conventions.
"""

import re
import sys
import json
import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from canon_common import REPO_ROOT, normalise  # noqa: E402
from canon_drift_scan import fingerprint  # noqa: E402

BASELINES_FILE = REPO_ROOT / "config" / "canon_source_baselines.json"
# The object->source-path cache is GITIGNORED and per-clone: source file paths
# reveal internal repo structure, which must not enter this public repo (unlike
# opaque commit SHAs). It sharpens the source channel for whoever has it locally
# and degrades gracefully to the name-token heuristic when absent.
PATHS_FILE = REPO_ROOT / "config" / "canon_source_paths.local.json"
BACKLOG_FILE = REPO_ROOT / "questions" / "CANON_BACKLOG.md"


# --------------------------------------------------------------------------- #
# Sidecar read/write                                                          #
# --------------------------------------------------------------------------- #

def load_baselines():
    if not BASELINES_FILE.exists():
        return {"version": 1, "baselines": {}}
    data = json.loads(BASELINES_FILE.read_text(encoding="utf-8"))
    data.setdefault("version", 1)
    data.setdefault("baselines", {})
    return data


def save_baselines(data):
    # Deterministic key ordering keeps diffs (and merge conflicts) minimal.
    data["baselines"] = dict(sorted(data["baselines"].items()))
    BASELINES_FILE.write_text(
        json.dumps(data, indent=2, sort_keys=False) + "\n", encoding="utf-8"
    )


def _match_key(baselines, namespace, obj, parent):
    """Find the filename key of the entry matching a normalised ns/obj/parent."""
    for key, entry in baselines.items():
        if (entry.get("namespace") == namespace
                and entry.get("object") == obj
                and (entry.get("parent") or None) == (parent or None)):
            return key
    return None


# --------------------------------------------------------------------------- #
# Object -> source-path cache (gitignored, per-clone) — the #6-(b) precision    #
# aid: exact source files a canon-drift-update confirmed for an object.        #
# --------------------------------------------------------------------------- #

def load_paths():
    if not PATHS_FILE.exists():
        return {"version": 1, "paths": {}}
    data = json.loads(PATHS_FILE.read_text(encoding="utf-8"))
    data.setdefault("version", 1)
    data.setdefault("paths", {})
    return data


def save_paths(data):
    data["paths"] = dict(sorted(data["paths"].items()))
    PATHS_FILE.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _match_paths_key(paths, namespace, obj, parent):
    for key, entry in paths.items():
        if (entry.get("namespace") == namespace
                and entry.get("object") == obj
                and (entry.get("parent") or None) == (parent or None)):
            return key
    return None


# --------------------------------------------------------------------------- #
# Backlog worklist — the canonised (🟢/🟡) objects                             #
# --------------------------------------------------------------------------- #

_STATUS_CANONISED = ("🟢", "🟡")
_LINK_RE = re.compile(r"\[([^\]]+\.md)\]\(")  # [CANON_OBJECT_....md](...)


def list_canonised(namespace_filter=None):
    """
    Parse CANON_BACKLOG.md per-namespace tables; return the rows that have a
    canonised status and a Canon File link. namespace comes from the `## <Ns>`
    section header; object/parent from the first two columns (already normalised
    API-path segments).
    """
    rows = []
    current_ns = None
    for line in BACKLOG_FILE.read_text(encoding="utf-8").splitlines():
        h = re.match(r"^##\s+([A-Za-z][A-Za-z-]*)\s*$", line)
        if h:
            current_ns = normalise(h.group(1))
            continue
        if not (line.startswith("|") and current_ns):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 6:
            continue
        obj, parent, status, last_updated, canon_file = cells[0], cells[1], cells[2], cells[3], cells[4]
        if not any(s in status for s in _STATUS_CANONISED):
            continue
        m = _LINK_RE.search(canon_file)
        if not m:
            continue
        if namespace_filter and current_ns != normalise(namespace_filter):
            continue
        rows.append({
            "namespace": current_ns,
            "object": normalise(obj),
            "parent": None if parent in ("—", "-", "") else normalise(parent),
            "file": m.group(1),
            "status": "🟢" if "🟢" in status else "🟡",
            "lastUpdated": last_updated,
        })
    return rows


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #

def _parse_common(rest):
    """Extract [--parent p] and return (parent, remaining_flags_dict)."""
    opts = {"parent": None, "commits": [], "file": None, "spec_version": None,
            "fingerprint": None, "extract": None, "namespace": None, "paths": []}
    i = 0
    while i < len(rest):
        f = rest[i]
        if f == "--parent" and i + 1 < len(rest):
            opts["parent"] = normalise(rest[i + 1]); i += 2
        elif f == "--commit" and i + 1 < len(rest):
            opts["commits"].append(rest[i + 1]); i += 2
        elif f == "--path" and i + 1 < len(rest):
            opts["paths"].append(rest[i + 1]); i += 2
        elif f == "--file" and i + 1 < len(rest):
            opts["file"] = rest[i + 1]; i += 2
        elif f == "--spec-version" and i + 1 < len(rest):
            opts["spec_version"] = rest[i + 1]; i += 2
        elif f == "--fingerprint" and i + 1 < len(rest):
            opts["fingerprint"] = rest[i + 1]; i += 2
        elif f == "--extract" and i + 1 < len(rest):
            opts["extract"] = rest[i + 1]; i += 2
        elif f == "--namespace" and i + 1 < len(rest):
            opts["namespace"] = rest[i + 1]; i += 2
        else:
            print(f"Error: unrecognised argument '{f}'.")
            sys.exit(1)
    return opts


def _today():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


def main():
    argv = sys.argv[1:]
    if not argv:
        print("Usage: python scripts/canon_baseline.py <get|record|list|list-canonised> ...")
        sys.exit(1)
    cmd, rest = argv[0], argv[1:]

    if cmd == "list-canonised":
        opts = _parse_common(rest)
        print(json.dumps(list_canonised(opts["namespace"]), indent=2))
        return

    if cmd == "paths-get":
        if len(rest) < 2:
            print("Usage: python scripts/canon_baseline.py paths-get <namespace> <object> [--parent p]")
            sys.exit(1)
        ns, obj = normalise(rest[0]), normalise(rest[1])
        opts = _parse_common(rest[2:])
        data = load_paths()
        key = _match_paths_key(data["paths"], ns, obj, opts["parent"])
        print(json.dumps(data["paths"].get(key, {}).get("sourcePaths", []) if key else []))
        return

    if cmd == "paths-set":
        if len(rest) < 2:
            print("Usage: python scripts/canon_baseline.py paths-set <namespace> <object> [--parent p] "
                  "--file <F> --path <src/path> [--path ...]")
            sys.exit(1)
        ns, obj = normalise(rest[0]), normalise(rest[1])
        opts = _parse_common(rest[2:])
        if not opts["paths"]:
            print("Error: paths-set needs at least one --path <src/path>.")
            sys.exit(1)
        data = load_paths()
        key = _match_paths_key(data["paths"], ns, obj, opts["parent"])
        if key is None:
            if not opts["file"]:
                print("Error: new path-cache entry needs --file <CANON_OBJECT_...md>.")
                sys.exit(1)
            key = opts["file"]
        data["paths"][key] = {
            "namespace": ns, "object": obj, "parent": opts["parent"],
            "sourcePaths": sorted(set(opts["paths"])),
            "updated": _today(),
        }
        save_paths(data)
        print(f"Cached {len(opts['paths'])} source path(s) for {key}.")
        return

    if cmd == "list":
        opts = _parse_common(rest)
        data = load_baselines()
        out = {k: v for k, v in data["baselines"].items()
               if not opts["namespace"] or v.get("namespace") == normalise(opts["namespace"])}
        print(json.dumps(out, indent=2))
        return

    if cmd == "get":
        if len(rest) < 2:
            print("Usage: python scripts/canon_baseline.py get <namespace> <object> [--parent p]")
            sys.exit(1)
        ns, obj = normalise(rest[0]), normalise(rest[1])
        opts = _parse_common(rest[2:])
        data = load_baselines()
        key = _match_key(data["baselines"], ns, obj, opts["parent"])
        if key is None:
            print("none")
            return
        print(json.dumps({key: data["baselines"][key]}, indent=2))
        return

    if cmd == "record":
        if len(rest) < 2:
            print("Usage: python scripts/canon_baseline.py record <namespace> <object> [--parent p] "
                  "--file <F> --spec-version <v> --commit <sha> ... (--fingerprint <fp.json>|--extract <extract.json>)")
            sys.exit(1)
        ns, obj = normalise(rest[0]), normalise(rest[1])
        opts = _parse_common(rest[2:])
        data = load_baselines()
        key = _match_key(data["baselines"], ns, obj, opts["parent"])
        if key is None:
            if not opts["file"]:
                print("Error: new baseline needs --file <CANON_OBJECT_...md> (no existing entry to update).")
                sys.exit(1)
            key = opts["file"]
        # Resolve the fingerprint (pre-computed or from an extract).
        if opts["fingerprint"]:
            fp = json.loads(Path(opts["fingerprint"]).read_text(encoding="utf-8"))
        elif opts["extract"]:
            fp = fingerprint(json.loads(Path(opts["extract"]).read_text(encoding="utf-8")))
        else:
            print("Error: record needs --fingerprint <fp.json> or --extract <extract.json>.")
            sys.exit(1)
        entry = data["baselines"].get(key, {})
        entry.update({
            "namespace": ns,
            "object": obj,
            "parent": opts["parent"],
            "sourceRepoCommits": opts["commits"] or entry.get("sourceRepoCommits", []),
            "specVersion": opts["spec_version"] if opts["spec_version"] is not None else entry.get("specVersion"),
            "baselineDate": _today(),
            "driftMetric": "lines-changed",
            "specFingerprint": fp,
        })
        data["baselines"][key] = entry
        save_baselines(data)
        print(f"Recorded baseline for {key} (namespace={ns}, object={obj}, parent={opts['parent']}).")
        return

    print(f"Error: unknown subcommand '{cmd}'.")
    sys.exit(1)


if __name__ == "__main__":
    main()
