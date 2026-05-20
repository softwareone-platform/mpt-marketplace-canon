# Patches

A patch is a directory whose layout mirrors the repo root (`objects/`, `platform/`, `preamble/`, `questions/`). Files inside a patch fully replace the corresponding files at the root — patches are file replacements, not diffs.

**Resolution.** The loader applies patches in alphabetic order of patch-id; the last write per relative path wins. The original files under `objects/` etc. are never modified.

**Conventions.**
- Patch IDs are kebab-case and unique. Prefix with a date or sequence (`2026-05-05-add-state-x`) if order matters; otherwise the alphabetic sort is the source of truth.
- A patch contains only files it intends to override. Missing files fall through to the originals (or to a previous patch).
- An empty patch directory is a no-op and is allowed.

**First patch: `align-format`.** Brings the source MDs into the strict format the parser requires. Lives here so the originals stay untouched. All future edits flow through their own patch directories produced by the edit-MCP server.
