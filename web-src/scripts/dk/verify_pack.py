#!/usr/bin/env python3
"""Fails unless the generated mushaf pack is complete: glyphs.bin, p1..p604.bin and ids.bin with 604 lines of ids. Usage: verify_pack.py <assets/dk dir>"""
import gzip, os, sys, json
d = sys.argv[1]
missing = [n for n in ['glyphs.bin', 'ids.bin'] + [f'p{i}.bin' for i in range(1, 605)] if not os.path.isfile(os.path.join(d, n))]
if missing: raise SystemExit(f'pack incomplete, missing {len(missing)} files, first: {missing[:3]}')
ids = gzip.open(os.path.join(d, 'ids.bin'), 'rt').read().split('\n')
if len(ids) != 604 or any(not l for l in ids): raise SystemExit(f'ids.bin must have 604 non-empty lines, has {len(ids)}')
words = sum(len(l.split(',')) for l in ids)
ends = sum(l.count(':end') for l in ids)
if ends != 6236: raise SystemExit(f'expected 6236 ayah-end markers, found {ends}')
if not (83000 < words < 84500): raise SystemExit(f'unexpected word count {words}')
g = json.load(gzip.open(os.path.join(d, 'glyphs.bin'), 'rt'))
if len(g) < 500: raise SystemExit(f'too few glyph outlines: {len(g)}')
for i in (1, 300, 604):
    pg = json.load(gzip.open(os.path.join(d, f'p{i}.bin'), 'rt'))
    if len(pg) < 8: raise SystemExit(f'page {i} has {len(pg)} lines')
print(f'pack OK: 604 pages, {words} word ids, {ends} ayah ends, {len(g)} glyph outlines')
