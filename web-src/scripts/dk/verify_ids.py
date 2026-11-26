#!/usr/bin/env python3
"""Checks the generated dk/ids.bin against the QF API word ids (api/p{n}.json cache of verses/by_page with words): for every page the id sequence must be identical,
except that merged DK pairs repeat an id. Usage: verify_ids.py <assets/dk dir> <api cache dir>"""
import gzip, json, sys, os
d, api = sys.argv[1], sys.argv[2]
ids = gzip.open(os.path.join(d, "ids.bin"), "rt").read().split("\n")
bad = 0
for n in range(1, 605):
    want = []
    for m in (n - 1, n, n + 1):
        f = os.path.join(api, f"p{m}.json")
        if not os.path.exists(f): continue
        for v in json.load(open(f))["verses"]:
            for w in v["words"]:
                if w.get("v2_page") == n:
                    want.append((w["line_number"], v["verse_key"] + ":" + ("end" if w["char_type_name"] == "end" else str(w["position"]))))
    want = [x[1] for x in want]
    got = []
    for x in ids[n - 1].split(","):
        if not got or got[-1] != x: got.append(x)       # collapse merged pairs
    if sorted(got) != sorted(want) or got != want:
        bad += 1; print("page", n, "mismatch", len(got), len(want), [x for x in got if x not in want][:3], [x for x in want if x not in got][:3])
print("pages with id mismatch:", bad)
sys.exit(1 if bad else 0)
