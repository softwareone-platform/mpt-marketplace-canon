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
"""

import json
import sys
from pathlib import Path


def extract_objects(spec_path: Path) -> dict:
    """
    Parse the OpenAPI spec and return a dict of:
        { namespace: { object: [paths] } }
    """
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)

    paths = spec.get("paths", {})
    namespaces = {}

    for path in paths:
        # Expect paths like /public/v1/{namespace}/{object}/...
        parts = [p for p in path.split("/") if p]

        # Strip leading 'public', 'v1' or similar version prefix
        while parts and (parts[0] in ("public", "v1") or parts[0].startswith("v")):
            parts.pop(0)

        if len(parts) < 2:
            continue

        namespace = parts[0]
        obj = parts[1]

        # Skip path parameter segments as object names
        if obj.startswith("{"):
            continue

        if namespace not in namespaces:
            namespaces[namespace] = {}
        if obj not in namespaces[namespace]:
            namespaces[namespace][obj] = []
        namespaces[namespace][obj].append(path)

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

    print(f"Parsing {spec_path.name}...")
    namespaces = extract_objects(spec_path)

    total_objects = sum(len(objs) for objs in namespaces.values())
    print(f"Found {len(namespaces)} namespace(s), {total_objects} object(s).\n")

    checklist = format_checklist(namespaces)

    if output_path:
        output_path.write_text(checklist, encoding="utf-8")
        print(f"Checklist written to {output_path}")
    else:
        print(checklist)


if __name__ == "__main__":
    main()
