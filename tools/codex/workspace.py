#!/usr/bin/env python3
"""Create/verify two independent sibling checkouts without switching existing branches."""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--root", type=Path, required=True)
args = parser.parse_args()
args.root.mkdir(parents=True, exist_ok=True)
for name in ("halaqati-app", "halaqati-web"):
    path = args.root.resolve() / name
    url = f"https://github.com/syounis212004-sys/{name}.git"
    if not path.exists():
        subprocess.run(["git", "clone", "--depth", "1", url, str(path)], check=True)
    remote = subprocess.check_output(["git", "-C", str(path), "remote", "get-url", "origin"], text=True).strip()
    if remote.removesuffix(".git") not in (url.removesuffix(".git"), f"git@github.com:syounis212004-sys/{name}"):
        raise SystemExit(f"Unexpected origin at {path}; preserving existing checkout")
    subprocess.run(["git", "-C", str(path), "ls-remote", "origin", "HEAD"], check=True)
    subprocess.run(["git", "-C", str(path), "status", "--short", "--branch"], check=True)
    print(f"Verified independent checkout: {path}", flush=True)
editor = args.root.resolve() / "halaqati.code-workspace"
if not editor.exists():
    editor.write_text(json.dumps({"folders": [{"name": "Halaqati Android", "path": "halaqati-app"}, {"name": "Halaqati Web", "path": "halaqati-web"}], "settings": {"editor.formatOnSave": False}}, indent=2) + "\n")
print(f"Workspace editor configuration: {editor}")
