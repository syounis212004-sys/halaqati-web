#!/usr/bin/env python3
"""Run independent project checks and retain every exit code, including failures."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--browser", action="store_true", help="Web only: BASE_URL preview must be running")
args = parser.parse_args()
output = root / ".codex-work/checks"
output.mkdir(parents=True, exist_ok=True)
checks = [("tooling-lint", ["npm", "--prefix", "tools/codex", "run", "lint"])]
if (root / "web-src").is_dir():
    checks.append(("app-lint", ["npm", "--prefix", "tools/codex", "run", "lint:app"]))
    checks.extend([
        ("syntax", ["npm", "--prefix", "web-src", "run", "check:legacy"]),
        ("unit", ["npm", "--prefix", "web-src", "test"]),
        ("build", ["npm", "--prefix", "web-src", "run", "build"]),
    ])
    if args.browser:
        checks.extend([
            ("browser", ["npm", "--prefix", "web-src", "run", "check:browser"]),
            ("visual-accessibility", ["npm", "--prefix", "tools/codex", "run", "test:visual"]),
        ])
else:
    checks.append(("archive-tool-tests", [sys.executable, "tools/codex/test_native_source.py"]))
    checks.extend((name, [sys.executable, "tools/codex/gradle.py", task]) for name, task in [
        ("unit", ":app:testDebugUnitTest"), ("lint", ":app:lintDebug"), ("build", ":app:assembleDebug")
    ])
results = []
for name, command in checks:
    start = time.monotonic()
    with (output / f"{name}.log").open("w") as log:
        try:
            code = subprocess.run(command, cwd=root, stdout=log, stderr=subprocess.STDOUT, timeout=1800).returncode
            status = "PASS" if code == 0 else "FAIL"
        except (OSError, subprocess.TimeoutExpired) as error:
            log.write(str(error))
            code, status = None, "NOT AVAILABLE"
    record = {"check": name, "status": status, "exit_code": code, "seconds": round(time.monotonic() - start, 2), "command": command}
    results.append(record)
    print(f"{status}: {name} (log: {output / (name + '.log')})", flush=True)
(output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
raise SystemExit(any(result["status"] != "PASS" for result in results))
