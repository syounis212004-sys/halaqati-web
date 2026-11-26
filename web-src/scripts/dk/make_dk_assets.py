#!/usr/bin/env python3
"""Experimental DigitalKhatt pack generator (never committed output: the page streams encode the Quran text).
Reads madina.json (https://digitalkhatt.org/assets/layouts/madina.json) and writes app/src/main/assets/dk/{glyphs.bin,p1..p604.bin,ids.bin}.
Files are gzip data without a .gz suffix (AGP would rename/decompress .gz assets).
ids.bin: gzip text, one line per page: the word id (sura:ayah:pos or sura:ayah:end, the same ids as MushafEngine) of every DK word of the text lines,
in reading order. Ayah numbers come from the ayah-end glyphs (cp 58193 + ayah - 1) and the sura from the number reset, so no API is needed.
DK splits a few one-word QF units in two; those pairs share one id and are merged on screen (MERGE).
Usage: make_dk_assets.py <madina.json> <out assets dir>
"""
import gzip, json, os, sys
MERGE = {(2, 181, 3), (8, 6, 4), (13, 37, 8), (37, 130, 3)}   # DK word k and k+1 form one QF word (verified against the API by verify_ids.py)
END0, END1 = 58193, 58478
def r(v): return round(v, 1)
def path_list(paths): return [[[r(c) for c in e] for e in p["path"]] for p in paths]
def main(src, out):
    D = json.load(open(src)); os.makedirs(out, exist_ok=True)
    G = {}
    for cp, g in D["glyphs"].items():
        e = {"b": [r(x) for x in g["bbox"]], "d": path_list(g["default"])}
        if g.get("limits"): e["lim"] = g["limits"]
        for k, s in (("minLeft", "ml"), ("maxLeft", "xl"), ("minRight", "mr"), ("maxRight", "xr")):
            if g.get(k): e[s] = path_list(g[k])
        G[cp] = e
    with gzip.open(os.path.join(out, "glyphs.bin"), "wt", encoding="utf-8") as f: json.dump(G, f, separators=(",", ":"))
    sura, ayah, dkpos, qf, same = 0, 1, 0, 0, False
    ids_lines = []
    for i, p in enumerate(D["pages"], start=1):
        lines, ids = [], []
        for L in p["lines"]:
            t = L.get("type", 0); flat, word = [], []
            if t == 1: sura += 1; ayah, dkpos, qf, same = 1, 0, 0, False
            def flush():
                nonlocal ayah, dkpos, qf, same
                if not word: return
                if len(word) == 1 and END0 <= word[0] <= END1:
                    if word[0] - END0 + 1 != ayah: raise SystemExit(f"page {i}: end marker {word[0]-END0+1} != ayah {ayah} (sura {sura})")
                    ids.append(f"{sura}:{ayah}:end"); ayah += 1; dkpos, qf, same = 0, 0, False
                else:
                    dkpos += 1
                    if same: same = False            # second half of a merged pair: same id as the first
                    else:
                        qf += 1
                        if (sura, ayah, dkpos) in MERGE: same = True
                    ids.append(f"{sura}:{ayah}:{qf}")
                word.clear()
            for g in L["glyphs"]:
                flat += [g["codepoint"], g.get("x_advance", 0), g.get("x_offset", 0), g.get("y_offset", 0), g.get("lefttatweel", 0), g.get("righttatweel", 0)]
                if t == 0:
                    if g["codepoint"] == 32: flush()
                    else: word.append(g["codepoint"])
            if t == 0: flush()
            lines.append([t, L.get("x", 0), L.get("xscale", 1), flat])
        with gzip.open(os.path.join(out, f"p{i}.bin"), "wt", encoding="utf-8") as f: json.dump(lines, f, separators=(",", ":"))
        ids_lines.append(",".join(ids))
    with gzip.open(os.path.join(out, "ids.bin"), "wt", encoding="utf-8") as f: f.write("\n".join(ids_lines))
if __name__ == "__main__": main(sys.argv[1], sys.argv[2])
