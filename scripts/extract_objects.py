"""
extract_objects.py

Parses a SoftwareOne Marketplace OpenAPI JSON spec and extracts a structured
list of namespaces and objects, formatted as a canon backlog checklist.

Usage:
    python scripts/extract_objects.py <path_to_openapi.json> [output_file]

Examples:
    python scripts/extract_objects.py openapi.json
    python scripts/extract_objects.py openapi.json canon_checklist.md

If no output file is specified, prints to stdout.

The script infers namespaces and objects from the API path structure:
    /public/v1/{namespace}/{object}/...
    /public/v1/{namespace}/{object}/{id}/{child}/...
    /public/v1/{namespace}/{object}/{id}/{child}/{id}/{grandchild}/...

Path segments that aren't real objects (state transition verbs like "publish",
non-object sub-resources like "icon") are excluded via config/canon_path_segment_exclusions.json,
not a hardcoded list — the canon-generate Skill grows this file over time as it
confirms new segments object-by-object (see its Step 1).
"""

import json
import sys
from pathlib import Path

# Path segments known to not represent a canonicalizable object — state
# transition verbs (e.g. "publish"), other action verbs (e.g. "split"), and
# read-only non-object sub-resources (e.g. "icon" — preamble Section 9).
# Tracked per-object in a JSON file rather than hardcoded here, since the
# same word can mean different things for different objects — new entries
# are confirmed and added by the canon-generate Skill (see its Step 1)
# without a code change. "_global" holds patterns confirmed as applying
# across many objects (e.g. icon) rather than being object-specific.
EXCLUSIONS_PATH = Path(__file__).resolve().parent.parent / "config" / "canon_path_segment_exclusions.json"
EXCLUSION_CATEGORIES = ("state_transition_verbs", "action_verbs", "non_object_resources")


def load_exclusions(path: Path = EXCLUSIONS_PATH) -> dict:
    if not path.exists():
        print(f"ERROR: exclusions file not found: {path}")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def is_param(segment: str) -> bool:
    return segment.startswith("{")


def is_excluded(scope_key: str, segment: str, exclusions: dict) -> bool:
    """
    Checks `segment` against the given scope's three categories (e.g. scope
    "catalog.products" for Product-level segments), falling back to
    "_global" for patterns confirmed to apply across many objects.
    """
    segment = segment.lower()
    for scope in (scope_key, "_global"):
        categories = exclusions.get(scope, {})
        for category in EXCLUSION_CATEGORIES:
            if segment in categories.get(category, {}):
                return True
    return False


def extract_objects(spec_path: Path, exclusions: dict) -> dict:
    """
    Parse the OpenAPI spec and return a dict of:
        { namespace: { object: { child: set(grandchild_objects) } } }
    """
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)

    paths = spec.get("paths", {})

    # namespaces[namespace][object][child] = set of grandchildren
    namespaces = {}

    for path in paths:
        parts = [p for p in path.split("/") if p]

        # Strip leading 'public', 'v1' or similar version prefix
        while parts and (parts[0] in ("public", "v1") or parts[0].startswith("v")):
            parts.pop(0)

        if len(parts) < 2:
            continue

        namespace = parts[0]
        obj = parts[1]

        if is_param(obj) or is_excluded(namespace, obj, exclusions):
            continue

        if namespace not in namespaces:
            namespaces[namespace] = {}
        if obj not in namespaces[namespace]:
            namespaces[namespace][obj] = {}

        object_scope = f"{namespace}.{obj}"

        # Child: /{namespace}/{obj}/{id}/{child}
        if len(parts) >= 4 and is_param(parts[2]) and not is_param(parts[3]) and not is_excluded(object_scope, parts[3], exclusions):
            child = parts[3]
            if child not in namespaces[namespace][obj]:
                namespaces[namespace][obj][child] = set()

            child_scope = f"{object_scope}.{child}"

            # Grandchild: /{namespace}/{obj}/{id}/{child}/{id}/{grandchild}
            if len(parts) >= 6 and is_param(parts[4]) and not is_param(parts[5]) and not is_excluded(child_scope, parts[5], exclusions):
                grandchild = parts[5]
                namespaces[namespace][obj][child].add(grandchild)

    return namespaces


def format_checklist(namespaces: dict) -> str:
    lines = []
    lines.append("# SoftwareOne Marketplace — Canon Object Checklist")
    lines.append("")
    lines.append("Generated from OpenAPI spec. Use this as a backlog for canon coverage.")
    lines.append("")
    lines.append("Legend: [ ] = not started, [~] = in progress, [x] = complete")
    lines.append("")

    for namespace in sorted(namespaces):
        lines.append(f"## {namespace.capitalize()}")
        lines.append("")
        for obj in sorted(namespaces[namespace]):
            lines.append(f"- [ ] {obj}")
            for child in sorted(namespaces[namespace][obj]):
                lines.append(f"  - [ ] {child}")
                for grandchild in sorted(namespaces[namespace][obj][child]):
                    lines.append(f"    - [ ] {grandchild}")
        lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/extract_objects.py <path_to_openapi.json> [output_file]")
        sys.exit(1)

    spec_path = Path(sys.argv[1])
    if not spec_path.exists():
        print(f"ERROR: File not found: {spec_path}")
        sys.exit(1)

    output_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else None

    exclusions = load_exclusions()

    print(f"Parsing {spec_path.name}...")
    namespaces = extract_objects(spec_path, exclusions)

    total_objects = sum(len(objs) for objs in namespaces.values())
    total_children = sum(
        len(children)
        for objs in namespaces.values()
        for children in objs.values()
    )
    total_grandchildren = sum(
        len(grandchildren)
        for objs in namespaces.values()
        for children in objs.values()
        for grandchildren in children.values()
    )
    print(f"Found {len(namespaces)} namespace(s), {total_objects} object(s), "
          f"{total_children} child object(s), {total_grandchildren} grandchild object(s).\n")

    checklist = format_checklist(namespaces)

    if output_path:
        output_path.write_text(checklist, encoding="utf-8")
        print(f"Checklist written to {output_path}")
    else:
        print(checklist)


if __name__ == "__main__":
    main()
