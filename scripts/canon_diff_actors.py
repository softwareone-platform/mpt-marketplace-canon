"""
canon_diff_actors.py

Deterministic diff of the same platform object fetched under different
Actor tokens (Vendor, Operations, Client) — surfaces which fields are
present for one Actor and absent for another, i.e. Actor-based field
suppression (see PLATFORM_CANON_PREAMBLE.md Section 6.3).

Operations is treated as the suppression baseline, per the existing canon
convention (preamble Section 5.5: Operations tokens return all fields
without Actor-based field suppression).

This performs field-presence diffing only, not value diffing — a field
present under both Actors with different values is not reported (that's
ordinary object state, not suppression). List/array fields are compared
for presence as a single unit, not recursed into item-by-item, to keep
the diff focused on field-level suppression rather than per-item
collection contents.

Usage:
    python scripts/canon_diff_actors.py --operations <path> [--vendor <path>] [--client <path>] --out <path>

At least --operations plus one of --vendor/--client is required.
"""

import sys
import json
from pathlib import Path


def load_json(path):
    p = Path(path)
    if not p.exists():
        print(f"Error: file not found: {p}")
        sys.exit(1)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"Error: {p} is not valid JSON: {e}")
        sys.exit(1)


def flatten(obj, prefix=""):
    """
    Dot-path flatten a JSON object. Dicts are recursed into; lists are
    treated as a single leaf (not recursed into item-by-item).
    Returns {dot_path: value}.
    """
    paths = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                paths.update(flatten(value, path))
            else:
                paths[path] = value
    else:
        paths[prefix] = obj
    return paths


def diff_actor(baseline, other):
    """
    baseline, other: flattened {path: value} dicts.
    Returns (suppressed, unexpected) — paths non-null in baseline but
    absent from other, and paths present in other but absent from baseline.
    """
    suppressed = sorted(
        path for path, value in baseline.items()
        if value is not None and path not in other
    )
    unexpected = sorted(path for path in other if path not in baseline)
    return suppressed, unexpected


def parse_args(argv):
    opts = {}
    i = 0
    while i < len(argv):
        flag = argv[i]
        if flag in ("--operations", "--vendor", "--client", "--out") and i + 1 < len(argv):
            opts[flag[2:]] = argv[i + 1]
            i += 2
        else:
            print(f"Error: unrecognised argument '{flag}'.")
            sys.exit(1)

    if "operations" not in opts or "out" not in opts:
        print("Usage: python scripts/canon_diff_actors.py --operations <path> "
              "[--vendor <path>] [--client <path>] --out <path>")
        sys.exit(1)
    if "vendor" not in opts and "client" not in opts:
        print("Error: at least one of --vendor or --client is required alongside --operations.")
        sys.exit(1)

    return opts


def main():
    opts = parse_args(sys.argv[1:])

    operations = flatten(load_json(opts["operations"]))
    result = {"baseline": "operations"}

    for actor in ("vendor", "client"):
        if actor not in opts:
            continue
        actor_flat = flatten(load_json(opts[actor]))
        suppressed, unexpected = diff_actor(operations, actor_flat)
        result[actor] = {
            "suppressed_fields": suppressed,
            "unexpected_fields": unexpected,
        }
        note = f", {len(unexpected)} unexpected field(s) not in operations" if unexpected else ""
        print(f"{actor}: {len(suppressed)} field(s) suppressed vs. operations{note}")

    out_path = Path(opts["out"])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"Diff written to {out_path}")


if __name__ == "__main__":
    main()
