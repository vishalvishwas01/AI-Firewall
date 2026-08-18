import json
from pathlib import Path
import jcs

manifest_path = Path("package-manifest.json")
canonical_path = Path("package-manifest.canonical.json")

with manifest_path.open("r", encoding="utf-8") as f:
    manifest = json.load(f)

canonical = jcs.canonicalize(manifest)

canonical_path.write_bytes(canonical)

print(f"Canonical manifest written to: {canonical_path}")
print(f"Canonical bytes: {len(canonical)}")