"""
canon_drift_scan.py

Headless drift-detection core for the canon-drift skills. Two channels, both
runnable without live API tokens:

  - SOURCE channel: `git diff --numstat <baseline>..HEAD` in a synced source
    repo, filtered to files whose path matches the object's name tokens, summed
    to a lines-changed score (the ranking metric).
  - SPEC channel: a deterministic diff of the object's OpenAPI "fingerprint"
    (matched paths, attribute name:type:required, enum value sets) between a
    stored baseline fingerprint and the current one.

It also produces the shared `fingerprint(extract)` used by canon_baseline.py to
snapshot an object's spec surface at baseline time.

Nothing here fetches live objects or reads canon prose — it is pure git + spec
math so it can run over the whole backlog for a ranked report.

Usage:
    # Emit the fingerprint of an extracted-schema JSON (from extract_canon_schema.py):
    python scripts/canon_drift_scan.py fingerprint <extract.json>

    # Diff two fingerprints (baseline vs current):
    python scripts/canon_drift_scan.py spec-diff --baseline <fp.json> --current <fp.json>

    # Source lines-changed for an object across one or more synced repos.
    # Match by --token (name heuristic) OR, if a path cache exists, by exact
    # --source-path entries (precise; overrides tokens when present):
    python scripts/canon_drift_scan.py source --repo <path> --base <sha> \\
        [--repo <path> --base <sha> ...] (--token Order --token Orders | --source-path <file/dir> ...)

    # Full drift record (source + spec), the record the skills consume:
    python scripts/canon_drift_scan.py scan --repo <path> --base <sha> \\
        [--repo <path> --base <sha> ...] --token Order [--token ...] \\
        --baseline-fp <fp.json> --current-fp <fp.json>

Only positional subcommand + a hand-rolled flag loop (no argparse), matching the
other canon_*.py scripts. Reads no secrets itself; the caller supplies repo
paths and commits (obtained via canon_repo_sync.py + `git rev-parse HEAD`).
"""

import sys
import json
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from canon_common import REPO_ROOT  # noqa: E402  (shared root; kept for parity/paths)

HTTP_METHODS = ("get", "post", "put", "delete", "patch")


# --------------------------------------------------------------------------- #
# Fingerprint — the object's public OpenAPI surface, derived from an extract.  #
# --------------------------------------------------------------------------- #

def _schema_type(prop):
    """Best-effort single-token type for a schema property."""
    if "$ref" in prop:
        return "->" + prop["$ref"].split("/")[-1]
    if "allOf" in prop and prop["allOf"]:
        first = prop["allOf"][0]
        if "$ref" in first:
            return "->" + first["$ref"].split("/")[-1]
    if "items" in prop:
        item = prop["items"]
        inner = item.get("$ref", "").split("/")[-1] or item.get("type", "?")
        return "array<" + inner + ">"
    return prop.get("type", "?")


def fingerprint(extract):
    """
    Build a deterministic, public-safe fingerprint of an object's OpenAPI
    surface from an extract_canon_schema.py JSON. Captures exactly the surface
    canon documents: paths (§1/§3), attributes (§5), and enum value sets.
    """
    paths = []
    for path, ops in (extract.get("paths") or {}).items():
        for method in HTTP_METHODS:
            if method in ops:
                paths.append(f"{method.upper()} {path}")

    attributes = {}
    enums = {}
    schemas = ((extract.get("components") or {}).get("schemas") or {})
    for name, schema in schemas.items():
        if isinstance(schema.get("enum"), list):
            enums[name] = sorted(str(v) for v in schema["enum"])
        props = schema.get("properties")
        if isinstance(props, dict):
            required = set(schema.get("required") or [])
            fields = []
            for pname, prop in props.items():
                req = "req" if pname in required else "opt"
                fields.append(f"{pname}:{_schema_type(prop)}:{req}")
            attributes[name] = sorted(fields)

    return {
        "paths": sorted(paths),
        "attributes": attributes,
        "enums": enums,
    }


# --------------------------------------------------------------------------- #
# Spec diff — baseline fingerprint vs current fingerprint.                     #
# --------------------------------------------------------------------------- #

def spec_diff(baseline_fp, current_fp):
    b_paths = set(baseline_fp.get("paths") or [])
    c_paths = set(current_fp.get("paths") or [])

    b_attrs = baseline_fp.get("attributes") or {}
    c_attrs = current_fp.get("attributes") or {}
    attr_added, attr_removed, attr_changed = [], [], []
    for name in sorted(set(b_attrs) | set(c_attrs)):
        bset = set(b_attrs.get(name) or [])
        cset = set(c_attrs.get(name) or [])
        # A field's "name:type:req" changing shows as one removed + one added
        # entry; report as changed when the field name is on both sides.
        b_names = {e.split(":", 1)[0] for e in bset}
        c_names = {e.split(":", 1)[0] for e in cset}
        for entry in sorted(cset - bset):
            fld = entry.split(":", 1)[0]
            (attr_changed if fld in b_names else attr_added).append(f"{name}.{entry}")
        for entry in sorted(bset - cset):
            fld = entry.split(":", 1)[0]
            if fld not in c_names:
                attr_removed.append(f"{name}.{entry}")

    b_enums = baseline_fp.get("enums") or {}
    c_enums = current_fp.get("enums") or {}
    enum_added, enum_removed = [], []
    for name in sorted(set(b_enums) | set(c_enums)):
        bset = set(b_enums.get(name) or [])
        cset = set(c_enums.get(name) or [])
        for v in sorted(cset - bset):
            enum_added.append(f"{name}={v}")
        for v in sorted(bset - cset):
            enum_removed.append(f"{name}={v}")

    return {
        "pathsAdded": sorted(c_paths - b_paths),
        "pathsRemoved": sorted(b_paths - c_paths),
        "attributesAdded": sorted(attr_added),
        "attributesRemoved": sorted(attr_removed),
        "attributesChanged": sorted(attr_changed),
        "enumsAdded": sorted(enum_added),
        "enumsRemoved": sorted(enum_removed),
    }


def spec_delta_counts(sd):
    return {
        "paths": len(sd["pathsAdded"]) + len(sd["pathsRemoved"]),
        "attributes": len(sd["attributesAdded"]) + len(sd["attributesRemoved"]) + len(sd["attributesChanged"]),
        "enums": len(sd["enumsAdded"]) + len(sd["enumsRemoved"]),
    }


# --------------------------------------------------------------------------- #
# Source diff — lines-changed for the object across synced repos.             #
# --------------------------------------------------------------------------- #

def _git(repo, args):
    result = subprocess.run(
        ["git", "-C", str(repo)] + args,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout


def _match_by_paths(path, source_paths):
    """Exact file match, or prefix match for a cached directory (ends with '/')."""
    for sp in source_paths:
        if path == sp or (sp.endswith("/") and path.startswith(sp)):
            return True
    return False


def source_scan(repo_bases, tokens, source_paths=None):
    """
    repo_bases: list of (repo_path, baseline_sha). Returns lines-changed +
    matched files across `<base>..HEAD`.

    Matching precedence:
      - If `source_paths` is given (the #6-(b) object->source-path cache — the
        exact files/dirs a prior canon-drift-update confirmed for this object),
        match changed files against those paths. Precise; no sibling bleed.
      - Otherwise fall back to `tokens` (case-insensitive substring of the
        changed-file path — the triage heuristic, decision 6a).
    """
    use_paths = bool(source_paths)
    low_tokens = [t.lower() for t in tokens if t]
    total = 0
    matched = []
    warnings = []
    any_changes = False
    for repo, base in repo_bases:
        try:
            head = _git(repo, ["rev-parse", "HEAD"]).strip()
        except RuntimeError as e:
            warnings.append(f"{repo}: {e}")
            continue
        if not base:
            warnings.append(f"{repo}: no baseline commit recorded")
            continue
        try:
            numstat = _git(repo, ["diff", "--numstat", f"{base}..{head}"])
        except RuntimeError as e:
            warnings.append(f"{repo}: {e} (baseline SHA missing from history? re-baseline)")
            continue
        for line in numstat.splitlines():
            parts = line.split("\t")
            if len(parts) != 3:
                continue
            added, deleted, path = parts
            if added == "-" or deleted == "-":  # binary file
                continue
            any_changes = True
            hit = _match_by_paths(path, source_paths) if use_paths \
                else any(tok in path.lower() for tok in low_tokens)
            if hit:
                total += int(added) + int(deleted)
                matched.append(path)
    if use_paths and any_changes and not matched:
        warnings.append("cached source paths matched no changed files — may be stale; "
                        "re-run canon-drift-update to refresh the path cache")
    return {
        "linesChanged": total,
        "matchedFiles": sorted(set(matched)),
        "matchMode": "paths" if use_paths else "tokens",
        "warnings": warnings,
    }


# --------------------------------------------------------------------------- #
# Escalation — structural changes that must go to a full /canon-generate.      #
# --------------------------------------------------------------------------- #

def escalation_reasons(spec_d):
    """
    Structural drift the incremental path must NOT try to patch. Section-count
    escalation (>~3 sections) is a judgment left to the skill; here we flag the
    unambiguous structural ones the scan can see.
    """
    reasons = []
    # State-machine change: an enum whose name looks like a lifecycle status set changed.
    status_enum_changed = any(
        e.split("=", 1)[0].lower().endswith("status")
        for e in (spec_d["enumsAdded"] + spec_d["enumsRemoved"])
    )
    if status_enum_changed:
        reasons.append("state/status enum values changed (likely §3 state-machine change)")
    if spec_d["pathsRemoved"]:
        reasons.append("one or more documented paths removed (possible object split/merge/removal)")
    return reasons


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #

def _load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _collect_repo_bases(rest):
    """Parse repeated --repo <path> [--base <sha>] pairs, --token, --source-path,
    and --baseline-fp/--current-fp into a bundle."""
    repo_bases = []
    tokens = []
    source_paths = []
    baseline_fp = current_fp = None
    i = 0
    pending_repo = None
    while i < len(rest):
        flag = rest[i]
        if flag == "--repo" and i + 1 < len(rest):
            if pending_repo is not None:
                repo_bases.append((pending_repo, None))
            pending_repo = rest[i + 1]; i += 2
        elif flag == "--base" and i + 1 < len(rest):
            repo_bases.append((pending_repo, rest[i + 1])); pending_repo = None; i += 2
        elif flag == "--token" and i + 1 < len(rest):
            tokens.append(rest[i + 1]); i += 2
        elif flag == "--source-path" and i + 1 < len(rest):
            source_paths.append(rest[i + 1]); i += 2
        elif flag == "--baseline-fp" and i + 1 < len(rest):
            baseline_fp = _load(rest[i + 1]); i += 2
        elif flag == "--current-fp" and i + 1 < len(rest):
            current_fp = _load(rest[i + 1]); i += 2
        else:
            print(f"Error: unrecognised argument '{flag}'.")
            sys.exit(1)
    if pending_repo is not None:
        repo_bases.append((pending_repo, None))
    return repo_bases, tokens, source_paths, baseline_fp, current_fp


def main():
    argv = sys.argv[1:]
    if not argv:
        print("Usage: python scripts/canon_drift_scan.py <fingerprint|spec-diff|source|scan> ...")
        sys.exit(1)
    cmd, rest = argv[0], argv[1:]

    if cmd == "fingerprint":
        if len(rest) != 1:
            print("Usage: python scripts/canon_drift_scan.py fingerprint <extract.json>")
            sys.exit(1)
        print(json.dumps(fingerprint(_load(rest[0])), indent=2, sort_keys=True))
        return

    if cmd == "spec-diff":
        _, _, _, baseline_fp, current_fp = _collect_repo_bases(rest)
        if baseline_fp is None or current_fp is None:
            print("Error: spec-diff needs --baseline-fp <path> and --current-fp <path>.")
            sys.exit(1)
        print(json.dumps(spec_diff(baseline_fp, current_fp), indent=2))
        return

    if cmd == "source":
        repo_bases, tokens, source_paths, _, _ = _collect_repo_bases(rest)
        if not repo_bases:
            print("Error: source needs at least one --repo <path> --base <sha>.")
            sys.exit(1)
        print(json.dumps(source_scan(repo_bases, tokens, source_paths), indent=2))
        return

    if cmd == "scan":
        repo_bases, tokens, source_paths, baseline_fp, current_fp = _collect_repo_bases(rest)
        if baseline_fp is None or current_fp is None:
            print("Error: scan needs --baseline-fp and --current-fp.")
            sys.exit(1)
        src = source_scan(repo_bases, tokens, source_paths)
        sd = spec_diff(baseline_fp, current_fp)
        reasons = escalation_reasons(sd)
        record = {
            "sourceLinesChanged": src["linesChanged"],
            "sourceMatchedFiles": src["matchedFiles"],
            "sourceWarnings": src["warnings"],
            "specDeltaCounts": spec_delta_counts(sd),
            "specDelta": sd,
            "escalate": bool(reasons),
            "escalateReasons": reasons,
        }
        print(json.dumps(record, indent=2))
        return

    print(f"Error: unknown subcommand '{cmd}'.")
    sys.exit(1)


if __name__ == "__main__":
    main()
