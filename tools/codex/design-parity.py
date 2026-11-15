#!/usr/bin/env python3
"""Compare existing shared design tokens without generating or editing application files."""
import argparse
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--workspace", type=Path, required=True)
args = parser.parse_args()
app = args.workspace.resolve() / "halaqati-app"
web = args.workspace.resolve() / "halaqati-web"
native = Path(subprocess.check_output(["python3", str(app / "tools/codex/native-source.py"), "extract"], text=True).strip())
tokens = json.loads((native / "design/tokens.json").read_text())
css = (web / "web-src/src/styles/tokens.css").read_text()
variables = dict(re.findall(r"--t-([\w-]+)\s*:\s*([^;]+)", css))
failures = []
count = 0
for group in ["size", "radius", "space", "font", "tone", "family"]:
    for name, value in tokens[group].items():
        count += 1
        expected = str(value) + ("px" if group in ["size", "radius", "space", "font"] else "")
        actual = variables.get(f"{group}-{name}", "")
        matches = value in actual if group == "family" else actual.lower() == expected.lower()
        if not matches:
            failures.append(f"{group}.{name}: Android={expected}, Web={actual}")
print(json.dumps({"tokens_compared": count, "failures": failures}, ensure_ascii=False, indent=2))
raise SystemExit(bool(failures))
