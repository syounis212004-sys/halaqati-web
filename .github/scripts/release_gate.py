#!/usr/bin/env python3
"""Release gate for GitHub Actions. Fails the job (exit 1) unless the update about to be published is internally consistent:
  - version.json sha256 == sha256 of the APK that will be served
  - the publish-update zip carries the same APK and version.json
  - versionName/versionCode match what the workflow expects
  - versionCode is not lower than the currently published one (same code => same APK hash)
Usage:
  release_gate.py app <verified_dir> <update_publish_dir> <expected_versionName> <expected_versionCode>
  release_gate.py web <repo_dir> <apk_path> <version_json_path>
It runs AFTER the build/test/lint/signing steps (default `if: success()`), so a failed earlier step already stops the job."""
import hashlib, json, os, sys, urllib.request, zipfile, glob

LIVE = "https://syounis212004-sys.github.io/halaqati-web/version.json"


def sha(b):
    return hashlib.sha256(b).hexdigest()


def committed_meta():
    """Baseline fallback: the version.json committed on the checked-out HEAD (the previous release), never the file the workflow just rewrote."""
    import subprocess
    try:
        return json.loads(subprocess.run(["git", "show", "HEAD:version.json"], capture_output=True, text=True, check=True, timeout=20).stdout)
    except Exception:
        return None


def live_meta():
    try:
        with urllib.request.urlopen(urllib.request.Request(LIVE, headers={"User-Agent": "release-gate"}), timeout=20) as r:
            return json.load(r)
    except Exception as e:
        print("::warning::could not read the live version.json (%s); falling back to the committed one" % e)
        c = committed_meta()
        # fail closed: with no baseline the downgrade/same-code check cannot run, so the release must not proceed silently
        return c if c else {"__no_baseline__": True}


def fail(msgs):
    for m in msgs:
        print("::error::release gate: " + m)
    sys.exit(1)


def not_lower(meta, live, problems):
    if live and live.get("__no_baseline__"):
        problems.append("cannot establish the published baseline (live version.json and the committed copy are both unreadable)")
    elif live:
        if int(meta["versionCode"]) < int(live.get("versionCode", 0)):
            problems.append("versionCode %s is lower than the published %s" % (meta["versionCode"], live.get("versionCode")))
        elif int(meta["versionCode"]) == int(live.get("versionCode", 0)) and live.get("sha256") and meta["sha256"] != live["sha256"]:
            problems.append("same versionCode as the published one but a different APK hash")


def gate_app(verified, publish, name, code):
    problems = []
    meta = json.load(open(os.path.join(publish, "version.json"), encoding="utf-8"))
    apk_serving = open(os.path.join(publish, "Halaqati-latest.apk"), "rb").read()
    apks = glob.glob(os.path.join(verified, "Halaqati-v%s-release.apk" % name))
    if len(apks) != 1:
        problems.append("expected exactly one verified release APK for %s, found %d" % (name, len(apks)))
    else:
        verified_apk = open(apks[0], "rb").read()
        if sha(verified_apk) != sha(apk_serving):
            problems.append("the APK to be served differs from the verified, signed release APK")
    if meta.get("sha256") != sha(apk_serving):
        problems.append("version.json sha256 does not match Halaqati-latest.apk")
    if meta.get("versionName") != name or int(meta.get("versionCode", 0)) != int(code):
        problems.append("version.json (%s, %s) != expected (%s, %s)" % (meta.get("versionName"), meta.get("versionCode"), name, code))
    zp = os.path.join(verified, "Halaqati-v%s-publish-update.zip" % name)
    if not os.path.exists(zp):
        problems.append("publish-update zip is missing")
    else:
        z = zipfile.ZipFile(zp)
        if sha(z.read("Halaqati-latest.apk")) != sha(apk_serving) or json.loads(z.read("version.json")) != meta:
            problems.append("publish-update zip content differs from the verified APK/version.json")
    if not str(meta.get("apkUrl", "")).endswith("/Halaqati-latest.apk"):
        problems.append("apkUrl must end with /Halaqati-latest.apk")
    not_lower(meta, live_meta(), problems)
    if problems:
        fail(problems)
    print("release gate OK: %s (%s) sha256=%s" % (name, code, meta["sha256"]))


def gate_web(repo, apk, vj):
    problems = []
    meta = json.load(open(vj, encoding="utf-8"))
    data = open(apk, "rb").read()
    if meta.get("sha256") != sha(data):
        problems.append("version.json sha256 does not match Halaqati-latest.apk")
    for k in ("versionName", "versionCode", "apkUrl", "sha256", "native"):
        if k not in meta:
            problems.append("version.json lacks " + k)
    if not problems:
        not_lower(meta, live_meta(), problems)
    if problems:
        fail(problems)
    print("release gate OK: %s (%s) sha256=%s" % (meta["versionName"], meta["versionCode"], meta["sha256"]))


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) == 5 and a[0] == "app":
        gate_app(a[1], a[2], a[3], a[4])
    elif len(a) == 4 and a[0] == "web":
        gate_web(a[1], a[2], a[3])
    else:
        print(__doc__); sys.exit(2)
