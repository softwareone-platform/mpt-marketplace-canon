"""
extract_canon_schema.py

Extracts all paths and component schemas related to a specific platform object
from the SoftwareOne Marketplace OpenAPI spec.

Usage:
    python extract_canon_schema.py <path_to_spec> <namespace> <object> [--exact]

Options:
    --exact     Only match paths where the object is the terminal resource segment.
                Use this for top-level objects (e.g. catalog product) to avoid
                pulling in all child object paths.

Examples:
    python extract_canon_schema.py openapi.json catalog product --exact
    python extract_canon_schema.py openapi.json catalog template
    python extract_canon_schema.py openapi.json catalog price-list
    python extract_canon_schema.py openapi.json audit record
    python extract_canon_schema.py openapi.json notifications webhook

Without --exact, any path containing both the namespace and object keyword is matched.
With --exact, only paths where the object is the final resource (before an optional
{id} segment) are matched. For example:
    /public/v1/catalog/products          MATCHED
    /public/v1/catalog/products/{id}     MATCHED
    /public/v1/catalog/products/{id}/templates   NOT MATCHED

The output is saved as a trimmed JSON file you can upload to your LLM session.
"""

import json
import sys
import os
import re


def normalise(s):
    """Lowercase and hyphenate a string for comparison."""
    return s.lower().replace(" ", "-")


def find_matching_paths(spec, namespace, object_name, exact=False):
    """
    Find all API paths containing both the namespace and object keyword,
    with the namespace appearing before the object in the path.

    If exact=True, only match paths where the object is the terminal resource
    segment (optionally followed by a single {id} parameter segment).
    """
    ns = normalise(namespace)
    obj = normalise(object_name)
    # Also match plural form (append 's' if not already ending in 's')
    obj_plural = obj if obj.endswith("s") else obj + "s"

    matched = {}
    for path, definition in spec.get("paths", {}).items():
        path_lower = path.lower()

        ns_index = path_lower.find(ns)
        if ns_index == -1:
            continue

        if exact:
            # Split path into segments, ignoring empty strings
            segments = [s for s in path.split("/") if s]
            # Remove trailing {id}-style parameter segments to find terminal resource
            clean_segments = [s for s in segments if not (s.startswith("{") and s.endswith("}"))]
            if not clean_segments:
                continue
            terminal = clean_segments[-1].lower()
            # Match if terminal segment is the object (singular or plural)
            # and namespace appears before it
            if terminal in (obj, obj_plural):
                obj_index = path_lower.rfind(terminal)
                if ns_index < obj_index:
                    matched[path] = definition
        else:
            obj_index = path_lower.find(obj)
            if obj_index == -1:
                obj_index = path_lower.find(obj_plural)
            if obj_index != -1 and ns_index < obj_index:
                matched[path] = definition

    return matched


def collect_refs(obj, refs=None):
    """Recursively collect all $ref values from a JSON object."""
    if refs is None:
        refs = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key == "$ref" and isinstance(value, str):
                match = re.match(r"#/components/schemas/(.+)", value)
                if match:
                    refs.add(match.group(1))
            else:
                collect_refs(value, refs)
    elif isinstance(obj, list):
        for item in obj:
            collect_refs(item, refs)
    return refs


def resolve_schemas(spec, initial_refs):
    """
    Resolve all schemas including nested $refs.
    Keeps following references until no new ones are found.
    """
    all_schemas = spec.get("components", {}).get("schemas", {})
    resolved = {}
    to_resolve = set(initial_refs)

    while to_resolve:
        current = to_resolve.pop()
        if current in resolved:
            continue
        if current in all_schemas:
            schema = all_schemas[current]
            resolved[current] = schema
            nested_refs = collect_refs(schema)
            for ref in nested_refs:
                if ref not in resolved:
                    to_resolve.add(ref)

    return resolved


def extract(spec_path, namespace, object_name, exact=False):
    print(f"\nLoading spec from: {spec_path}")
    with open(spec_path, "r", encoding="utf-8") as f:
        spec = json.load(f)

    mode = "exact" if exact else "broad"
    print(f"Searching for namespace='{namespace}' object='{object_name}' (mode: {mode})")
    matched_paths = find_matching_paths(spec, namespace, object_name, exact=exact)

    if not matched_paths:
        print(f"\nNo paths found.")
        print("Tips:")
        print("  - Try without --exact if you used it")
        print("  - Try singular form of the object name (e.g. 'template' not 'templates')")
        print("  - Use hyphens for multi-word names (e.g. 'price-list')")
        print("\nExample usages:")
        print("  python extract_canon_schema.py openapi.json catalog product --exact")
        print("  python extract_canon_schema.py openapi.json catalog template")
        print("  python extract_canon_schema.py openapi.json audit record")
        sys.exit(1)

    print(f"Found {len(matched_paths)} matching path(s):")
    for path in matched_paths:
        print(f"  {path}")

    initial_refs = collect_refs(matched_paths)
    print(f"\nResolving {len(initial_refs)} component schema(s)...")

    resolved_schemas = resolve_schemas(spec, initial_refs)
    print(f"Resolved {len(resolved_schemas)} schema(s) total (including nested).")

    trimmed = {
        "openapi": spec.get("openapi"),
        "info": spec.get("info"),
        "paths": matched_paths,
        "components": {
            "schemas": resolved_schemas
        }
    }

    safe_namespace = normalise(namespace)
    safe_object = normalise(object_name)
    suffix = "_exact" if exact else ""
    output_filename = f"openapi_extract_{safe_namespace}_{safe_object}{suffix}.json"
    output_path = os.path.join(os.path.dirname(os.path.abspath(spec_path)), output_filename)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(trimmed, f, indent=2)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\nSaved to: {output_path}")
    print(f"File size: {size_kb:.1f} KB")
    print("\nDone. Upload this file to your LLM session alongside your canon template.")


if __name__ == "__main__":
    if len(sys.argv) < 4 or len(sys.argv) > 5:
        print("Usage: python extract_canon_schema.py <path_to_spec> <namespace> <object> [--exact]")
        print("Example: python extract_canon_schema.py openapi.json catalog product --exact")
        sys.exit(1)

    spec_file = sys.argv[1]
    namespace = sys.argv[2]
    object_keyword = sys.argv[3]
    exact_mode = len(sys.argv) == 5 and sys.argv[4] == "--exact"

    if not os.path.exists(spec_file):
        print(f"Error: File not found: {spec_file}")
        sys.exit(1)

    extract(spec_file, namespace, object_keyword, exact=exact_mode)
