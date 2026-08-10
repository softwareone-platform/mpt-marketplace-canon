"""
convert_to_docx.py

Converts all canon Markdown files to .docx using pandoc.

Usage:
    python scripts/convert_to_docx.py <output_dir>

Examples:
    Windows: python scripts/convert_to_docx.py C:/Users/yourname/Desktop/docx
    macOS:   python scripts/convert_to_docx.py ~/Desktop/docx
    Linux:   python scripts/convert_to_docx.py ~/Documents/docx

Requirements:
    - pandoc installed and on PATH (https://pandoc.org/installing.html)
"""

import subprocess
import sys
from pathlib import Path

# --- Configuration ---
REPO_ROOT = Path(__file__).resolve().parent.parent

SOURCE_DIRS = [
    REPO_ROOT / "preamble",
    REPO_ROOT / "objects",
    REPO_ROOT / "platform",
]

# --- Arguments ---
if len(sys.argv) != 2:
    print("Usage: python scripts/convert_to_docx.py <output_dir>")
    print("  Windows: python scripts/convert_to_docx.py C:/Users/yourname/Desktop/docx")
    print("  macOS:   python scripts/convert_to_docx.py ~/Desktop/docx")
    print("  Linux:   python scripts/convert_to_docx.py ~/Documents/docx")
    sys.exit(1)

OUTPUT_DIR = Path(sys.argv[1]).expanduser()

# --- Setup ---
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Check pandoc is available
try:
    result = subprocess.run(["pandoc", "--version"], capture_output=True, text=True)
    pandoc_version = result.stdout.splitlines()[0]
    print(f"Using {pandoc_version}\n")
except FileNotFoundError:
    print("ERROR: pandoc not found on PATH.")
    print("Install it from https://pandoc.org/installing.html then re-run this script.")
    sys.exit(1)

# --- Convert ---
converted = []
failed = []

for source_dir in SOURCE_DIRS:
    if not source_dir.exists():
        print(f"Skipping {source_dir.name}/ — directory not found")
        continue

    md_files = sorted(source_dir.glob("*.md"))
    if not md_files:
        print(f"Skipping {source_dir.name}/ — no .md files found")
        continue

    print(f"Converting {source_dir.name}/")
    for md_file in md_files:
        output_file = OUTPUT_DIR / (md_file.stem + ".docx")
        result = subprocess.run(
            [
                "pandoc",
                str(md_file),
                "-o", str(output_file),
                "--from", "markdown",
                "--to", "docx",
                "-s",  # standalone document
            ],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(f"  ✓ {md_file.name} → {output_file.name}")
            converted.append(md_file.name)
        else:
            print(f"  ✗ {md_file.name} — FAILED")
            print(f"    {result.stderr.strip()}")
            failed.append(md_file.name)

# --- Summary ---
print(f"\n{'='*50}")
print(f"Done. {len(converted)} converted, {len(failed)} failed.")
if failed:
    print(f"\nFailed files:")
    for f in failed:
        print(f"  - {f}")
print(f"\nOutput: {OUTPUT_DIR}")
