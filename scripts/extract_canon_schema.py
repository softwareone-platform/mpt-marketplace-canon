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
With --exact, matching is anchored on the object segment: the object's own collection
and by-id paths, plus its instance action endpoints (a single trailing verb segment,
e.g. /publish, /activate, /block), are matched — but child-object sub-collections are
not. For example:
    /public/v1/catalog/products                  MATCHED (collection)
    /public/v1/catalog/products/{id}             MATCHED (by id)
    /public/v1/catalog/products/{id}/publish     MATCHED (action endpoint on the object)
    /public/v1/catalog/products/{id}/media       NOT MATCHED (child sub-collection — has deeper paths)
    /public/v1/catalog/products/{id}/media/{id}  NOT MATCHED (child object)

An action endpoint is distinguished from a child sub-collection structurally: an action
is a single literal segment that terminates the path (nothing extends it), whereas a
child sub-collection has deeper paths beneath it (e.g. its own {id}). This is what makes
the object's own §3.2 transition endpoints available to the drafter without pulling in
every child object's paths.

The output is saved as a trimmed JSON file you can upload to your LLM session.
"""

import json
import sys
import os
import re


def normalise(s):
    """Lowercase and hyphenate a string for comparison."""
    return s.lower().replace(" ", "-")


def _is_param(segment):
    """True if a path segment is an {id}-style parameter placeholder."""
    return segment.startswith("{") and segment.endswith("}")


def find_matching_paths(spec, namespace, object_name, exact=False):
    """
    Find all API paths containing both the namespace and object as whole
    path segments, with the namespace segment appearing before the object
    segment. Matching is segment-based, not substring-based — this matters
    because a raw substring search on "item" would also match inside
    "item-groups", silently pulling in a different object's paths.

    If exact=True, matching is anchored on the object segment and includes:
      - the object's collection path            (.../<object>)
      - its by-id path                          (.../<object>/{id})
      - its instance action endpoints           (.../<object>/{id}/<verb>)
    but excludes child-object sub-collections   (.../<object>/{id}/<child>/...).

    An action endpoint and a child sub-collection are the same shape
    (<object>/{id}/<segment>), so they are told apart structurally: an action
    verb is a single literal segment that terminates the path (no other path
    extends it), whereas a child sub-collection has deeper paths beneath it
    (e.g. its own {id}). Including action endpoints is what makes the object's
    own Section 3.2 transition endpoints available to the drafter; excluding
    child sub-collections is the original purpose of --exact.
    """
    ns = normalise(namespace)
    obj = normalise(object_name)
    # Also match plural form (append 's' if not already ending in 's')
    obj_plural = obj if obj.endswith("s") else obj + "s"

    all_paths = list(spec.get("paths", {}).keys())

    matched = {}
    for path, definition in spec.get("paths", {}).items():
        segments = [s for s in path.split("/") if s]
        segments_lower = [s.lower() for s in segments]

        if ns not in segments_lower:
            continue
        # Namespace is always the leading segment in this API's path convention,
        # so the first occurrence is the one that matters even if the same
        # word reappears later (e.g. /accounts/accounts/{id}/...).
        ns_pos = segments_lower.index(ns)

        if exact:
            # Anchor on the first object-named segment appearing after the
            # namespace (so a repeat of the namespace word can't be mistaken
            # for the object, and vice versa).
            obj_pos = None
            for i in range(ns_pos + 1, len(segments)):
                if segments_lower[i] in (obj, obj_plural):
                    obj_pos = i
                    break
            if obj_pos is None:
                continue

            tail = segments[obj_pos + 1:]
            literal_tail = [s for s in tail if not _is_param(s)]

            if not literal_tail:
                # .../<object> or .../<object>/{id} — collection or by-id.
                matched[path] = definition
            elif len(literal_tail) == 1 and not _is_param(tail[-1]):
                # .../<object>/{id}/<verb> — a single literal that ends the path.
                # Include only if nothing extends it (an action endpoint); if a
                # deeper path exists beneath it, it's a child sub-collection root.
                prefix = path.rstrip("/") + "/"
                has_deeper = any(p != path and p.startswith(prefix) for p in all_paths)
                if not has_deeper:
                    matched[path] = definition
            # else: two or more literal segments after the object, or the trailing
            # literal is itself parameterised further — a child object's path. Skip.
        else:
            obj_positions = [i for i, s in enumerate(segments_lower) if s in (obj, obj_plural)]
            if any(pos > ns_pos for pos in obj_positions):
                matched[path] = definition

    return matched


def collect_refs(obj, refs=None):
    """
    Collect all $ref values from a JSON object. Iterative (explicit stack)
    rather than recursive, so this has no dependency on Python's recursion
    limit regardless of how deeply nested a schema is.
    """
    if refs is None:
        refs = set()
    stack = [obj]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            for key, value in current.items():
                if key == "$ref" and isinstance(value, str):
                    match = re.match(r"#/components/schemas/(.+)", value)
                    if match:
                        refs.add(match.group(1))
                else:
                    stack.append(value)
        elif isinstance(current, list):
            stack.extend(current)
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
