#!/usr/bin/env python3
"""Parse PostgreSQL SQL locally; never connects to a database."""
import argparse
from pathlib import Path
from pglast import parse_sql

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("paths", nargs="+", type=Path)
args = parser.parse_args()
failures = 0
count = 0
for path in args.paths:
    paths = sorted(path.rglob("*.sql")) if path.is_dir() else [path]
    for item in paths:
        count += 1
        try:
            parse_sql(item.read_text(encoding="utf-8-sig"))
        except Exception as error:
            failures += 1
            print(f"FAIL {item}: {error}")
print(f"Parsed {count} SQL files; {failures} failures. SQL semantics/RLS require separate database tests.")
raise SystemExit(bool(failures))
