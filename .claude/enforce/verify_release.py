"""Release verification used by the enforcement hooks (and runnable by hand: python3 verify_release.py <repo-root>).
Returns a list of problems; empty list = verified. Checks consistency only: it does not build or sign anything."""
import glob, hashlib, json, os, re, sys, zipfile


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def ver_tuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", v))


def check_update_zip(root, zpath):
    p = []
    name = os.path.basename(zpath)
    try:
        z = zipfile.ZipFile(zpath)
        names = {os.path.basename(n): n for n in z.namelist()}
        if "version.json" not in names or "Halaqati-latest.apk" not in names:
            return ["%s must contain version.json and Halaqati-latest.apk" % name]
        meta = json.loads(z.read(names["version.json"]))
        apk = z.read(names["Halaqati-latest.apk"])
    except Exception as e:
        return ["%s is unreadable: %s" % (name, e)]
    for k in ("versionName", "versionCode", "apkUrl", "sha256", "native"):
        if k not in meta:
            p.append("%s: version.json lacks %s" % (name, k))
    if p:
        return p
    if hashlib.sha256(apk).hexdigest() != meta["sha256"]:
        p.append("%s: sha256 in version.json does not match the APK inside the zip" % name)
    m = re.match(r"Halaqati-v([\d.]+)-publish-update\.zip$", name)
    if m and m.group(1) != meta["versionName"]:
        p.append("%s: file name version %s != version.json versionName %s" % (name, m.group(1), meta["versionName"]))
    if not str(meta["apkUrl"]).endswith("/Halaqati-latest.apk"):
        p.append("%s: apkUrl must end with /Halaqati-latest.apk" % name)
    cur = os.path.join(root, "version.json")
    if os.path.exists(cur):
        try:
            c = json.load(open(cur, encoding="utf-8"))
            if int(meta["versionCode"]) < int(c.get("versionCode", 0)):
                p.append("%s: versionCode %s is lower than the published %s" % (name, meta["versionCode"], c.get("versionCode")))
            if int(meta["versionCode"]) == int(c.get("versionCode", 0)) and meta["sha256"] != c.get("sha256"):
                p.append("%s: same versionCode as published but a different APK hash" % name)
        except Exception:
            pass
    return p


def gradle_version(text):
    c = re.search(r"versionCode\s*=\s*(\d+)", text)
    n = re.search(r'versionName\s*=\s*"([^"]+)"', text)
    return (int(c.group(1)), n.group(1)) if c and n else None


def check_rc(root, wf=None):
    p = []
    wfs = sorted(glob.glob(os.path.join(root, ".github", "workflows", "Halaqati_RC*.yml")),
                 key=lambda x: int(re.search(r"RC(\d+)", x).group(1)))
    if wf:
        wfs = [w for w in wfs if os.path.basename(w) == os.path.basename(wf)] or wfs
    if not wfs:
        return p
    w = wfs[-1]
    rc = re.search(r"RC(\d+)", w).group(1)
    text = open(w, encoding="utf-8").read()
    zp = os.path.join(root, "Halaqati_RC%s.zip" % rc)
    m = re.search(r"ARCHIVE_SHA256:\s*([0-9a-f]{64})", text)
    if not os.path.exists(zp):
        return ["RC%s: Halaqati_RC%s.zip is missing" % (rc, rc)]
    if not m or m.group(1) != sha(zp):
        p.append("RC%s: workflow ARCHIVE_SHA256 does not match Halaqati_RC%s.zip" % (rc, rc))
    wc = re.search(r"versionCode='(\d+)'", text)
    wn = re.search(r"assert data\['versionName'\]=='([^']+)'", text)
    try:
        z = zipfile.ZipFile(zp)
        g = [n for n in z.namelist() if n.endswith("app/build.gradle.kts")]
        zv = gradle_version(z.read(g[0]).decode("utf-8")) if g else None
    except Exception as e:
        return p + ["RC%s: zip unreadable: %s" % (rc, e)]
    if not zv:
        p.append("RC%s: cannot read the version inside the zip" % rc)
    elif not wc or not wn or (int(wc.group(1)), wn.group(1)) != zv:
        p.append("RC%s: workflow version (%s, %s) != version inside the zip %s" % (rc, wc and wc.group(1), wn and wn.group(1), zv))
    tree = os.path.join(root, "source", "app", "build.gradle.kts")
    if os.path.exists(tree) and zv and gradle_version(open(tree, encoding="utf-8").read()) != zv:
        p.append("RC%s: source/app/build.gradle.kts version differs from the pinned zip (rebuild the zip from source)" % rc)
    return p


def check(root, files, cfg=None, wf=None):
    problems = []
    files = files or []
    zips = [f for f in files if re.search(r"Halaqati-v[\d.]+-publish-update\.zip$", f)]
    for f in zips:
        if os.path.exists(os.path.join(root, f)):
            problems += check_update_zip(root, os.path.join(root, f))
    for f in files:
        if re.search(r"Halaqati-v[\d.]+-web\.zip$", f) and os.path.exists(os.path.join(root, f)):
            try:
                n = zipfile.ZipFile(os.path.join(root, f)).namelist()
                if "index.html" not in n or not any(x.startswith("assets/") for x in n):
                    problems.append("%s: web package lacks index.html or assets/" % f)
            except Exception as e:
                problems.append("%s: unreadable (%s)" % (f, e))
    rc_touched = wf is not None or any(re.search(r"(Halaqati_RC\d+\.zip|workflows/Halaqati_RC\d+\.yml|build\.gradle\.kts)$", f) for f in files)
    if rc_touched or (not files and wf is None and not zips):
        problems += check_rc(root, wf)
    return problems


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    zs = sorted((os.path.relpath(z, root) for z in glob.glob(os.path.join(root, "Halaqati-v*-publish-update.zip"))),
                key=lambda n: tuple(int(x) for x in re.findall(r"\d+", n)))[-1:]
    pr = check(root, zs + ["Halaqati_RC0.zip"], {}, None)
    print("\n".join(pr) or "release verification: OK")
    sys.exit(1 if pr else 0)
