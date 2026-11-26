#!/usr/bin/env python3
"""Packs raw landing screenshots into responsive AVIF/WebP files + a manifest.

Usage: python3 scripts/landing-shots-pack.py RAW_WEB_DIR ANDROID_PREVIEW_DIR
Outputs: public/landing/shots/<id>-<width>.{avif,webp}, src/landing/shots-manifest.json

Android sources are an explicit allowlist: only previews that were visually checked to contain no personal data
(the halaqa-card previews carry real names and must never be listed here)."""
import json, os, sys
from PIL import Image

RAW_WEB, ANDROID = sys.argv[1], sys.argv[2]
OUT = 'public/landing/shots'
os.makedirs(OUT, exist_ok=True)

ANDROID_ALLOW = {  # output id -> Compose preview file
    'android-mushaf-light': 'mushaf_light_411.png',
    'android-mushaf-dark': 'mushaf_dark_411.png',
    'android-mushaf-surah': 'dk_ui_p511.png',
    'android-mushaf-jump': 'dk_ui_jump_page.png',
    'android-reminder': 'rc114_reminder_light.png',
}
WIDTHS = {'phone': [390, 780], 'desktop': [720, 1440]}

sources = {}
for f in sorted(os.listdir(RAW_WEB)):
    if f.endswith('.png') and f.startswith('web-'):
        sources[f[:-4]] = os.path.join(RAW_WEB, f)
for k, f in ANDROID_ALLOW.items():
    sources[k] = os.path.join(ANDROID, f)

manifest, total = {}, 0
for sid, path in sources.items():
    im = Image.open(path).convert('RGB')
    w, h = im.size
    kind = 'desktop' if w > h else 'phone'
    widths = [x for x in WIDTHS[kind] if x <= w] or [w]
    ph = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    entry = {'kind': kind, 'w': widths[-1], 'h': round(h * widths[-1] / w), 'widths': widths, 'ph': '#%02x%02x%02x' % ph, 'bytes': 0}
    for tw in widths:
        th = round(h * tw / w)
        r = im.resize((tw, th), Image.LANCZOS)
        for ext, kw in (('webp', dict(quality=74, method=6)), ('avif', dict(quality=48, speed=6))):
            fp = os.path.join(OUT, f'{sid}-{tw}.{ext}')
            r.save(fp, ext.upper(), **kw)
            entry['bytes'] += os.path.getsize(fp)
    total += entry['bytes']
    manifest[sid] = entry
    print(f"{sid:34s} {kind:7s} {entry['w']}x{entry['h']} {entry['bytes'] // 1024} KB")

with open('src/landing/shots-manifest.json', 'w', encoding='utf8') as fh:
    json.dump({'total_bytes': total, 'shots': manifest}, fh, ensure_ascii=False, indent=1)
print('total', total // 1024, 'KB for', len(manifest), 'screens')
