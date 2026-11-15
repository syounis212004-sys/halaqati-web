#!/usr/bin/env python3
"""Install the repository's existing design skills from a pinned source snapshot."""
import hashlib
import io
from pathlib import Path
import shutil
import tarfile
import urllib.request

root = Path(__file__).resolve().parents[2]
names = ["frontend-design", "android-design", "ui-ux-pro-max", "mobile-android-design"]
source = root / ".claude/skills"
if all((source / name / "SKILL.md").is_file() for name in names):
    print("Using preserved repository design skills")
else:
    url = "https://codeload.github.com/syounis212004-sys/halaqati-app/tar.gz/f0e0bdc1f443ca8c3666007f45e16adc79481c88"
    data = urllib.request.urlopen(url, timeout=90).read()
    if hashlib.sha256(data).hexdigest() != "108a6e0555d1a78eb17d2887bb194fe734dd128a7034800be9a1e9dfad757bbd":
        raise SystemExit("Pinned skill archive checksum mismatch")
    dest = root / ".codex-work/skills"
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as bundle:
        for member in bundle.getmembers():
            prefix = "halaqati-app-f0e0bdc1f443ca8c3666007f45e16adc79481c88/.claude/skills/"
            if not member.name.startswith(prefix):
                continue
            relative = Path(member.name[len(prefix):])
            if not relative.parts or relative.parts[0] not in names:
                continue
            if relative.is_absolute() or ".." in relative.parts or member.issym() or member.islnk():
                raise SystemExit("Unsafe skill archive entry")
            output = dest / relative
            if member.isdir():
                output.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                output.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(member) as reader, output.open("wb") as writer:
                    shutil.copyfileobj(reader, writer)
    # Adapt command paths only in the disposable installation, preserving source files.
    for path in dest.rglob("*.md"):
        path.write_text(path.read_text().replace(".claude/skills/", ".agents/skills/"))
    print("Installed pinned design skills into", dest)
for name in names:
    target = root / ".agents/skills" / name
    if not (target / "SKILL.md").is_file():
        raise SystemExit(f"Skill discovery failed: {target}")
print("Verified 4 design skill entry points")
