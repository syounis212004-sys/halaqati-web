#!/usr/bin/env python3
"""Simulation tests for the enforcement hooks: feeds real hook-input JSON to enforce.py in a throw-away project.
Run: python3 .claude/enforce/test_enforce.py   (exit 0 = all pass). Does not touch the real project or its state."""
import hashlib, json, os, shutil, subprocess, sys, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
RULES = os.environ.get("ENFORCE_TEST_RULES", os.path.join(HERE, "rules.json"))
IS_WEB = "web" in json.load(open(RULES)).get("publish", {}).get("workflow_regex", "") or "update_and_pages" in open(RULES).read()
UI = "web-src/src/features/native/community.js" if IS_WEB else "source/app/src/main/java/com/x/halaqati/ui/screens/A.kt"
LOGIC = "web-src/src/core/state.js" if IS_WEB else "source/app/src/main/java/com/x/halaqati/data/SupabaseApi.kt"
PASS = FAIL = 0


def project():
    d = tempfile.mkdtemp(prefix="enf-")
    os.makedirs(d + "/.claude/enforce")
    for f in ("enforce.py", "verify_release.py"):
        shutil.copy(os.path.join(HERE, f), d + "/.claude/enforce/" + f)
    shutil.copy(RULES, d + "/.claude/enforce/rules.json")
    subprocess.run(["git", "init", "-q", d]); subprocess.run(["git", "-C", d, "config", "user.email", "t@t"]); subprocess.run(["git", "-C", d, "config", "user.name", "t"])
    open(d + "/.gitignore", "w").write(".claude/enforce/state/\n.claude/enforce/log/\n")
    subprocess.run(["git", "-C", d, "add", "-A"]); subprocess.run(["git", "-C", d, "commit", "-qm", "baseline"])
    return d


def run(d, cmd, payload, sid="S1"):
    payload = dict(payload, session_id=sid)
    env = dict(os.environ, CLAUDE_PROJECT_DIR=d)
    r = subprocess.run([sys.executable, d + "/.claude/enforce/enforce.py", cmd], input=json.dumps(payload), capture_output=True, text=True, env=env)
    return r.returncode, r.stdout, r.stderr


def edit(d, path, text="x\n", tool="Edit", **kw):
    ti = {"file_path": os.path.join(d, path), ("content" if tool == "Write" else "new_string"): text}
    return run(d, "gate", dict({"tool_name": tool, "tool_input": ti}, **kw))


def skill(d, name, **kw):
    return run(d, "record-skill", dict({"tool_name": "Skill", "tool_input": {"skill": name}}, **kw))


def bash(d, command, **kw):
    return run(d, "gate", dict({"tool_name": "Bash", "tool_input": {"command": command}}, **kw))


def check(name, cond, extra=""):
    global PASS, FAIL
    PASS += cond; FAIL += (not cond)
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  <- " + str(extra)[:300]))


def ui_skills(d, **kw):
    for s in (["ui-ux-pro-max"] if IS_WEB else ["ui-ux-pro-max", "android-design"]):
        skill(d, s, **kw)


# 1. UI edit blocked without skills, allowed with them
d = project()
rc, _, err = edit(d, UI)
check("UI edit without skills is denied (exit 2)", rc == 2 and "ui-ux-pro-max" in err, (rc, err))
if not IS_WEB:
    skill(d, "ui-ux-pro-max")
    check("UI edit with only one of the two required skills is still denied", edit(d, UI)[0] == 2)
ui_skills(d)
check("UI edit after invoking the required skills is allowed", edit(d, UI)[0] == 0)
# 2. namespaced skill names count
d = project(); skill(d, "someplugin:ui-ux-pro-max"); skill(d, "android-design")
check("plugin-namespaced skill name satisfies the rule", edit(d, UI)[0] == 0)
# 3. sub-agent independence
d = project(); ui_skills(d)
check("main agent allowed", edit(d, UI)[0] == 0)
rc, _, err = edit(d, UI, agent_id="sub1", agent_type="general-purpose")
check("sub-agent does NOT inherit the main agent's skills (denied)", rc == 2, (rc, err))
ui_skills(d, agent_id="sub1", agent_type="general-purpose")
check("sub-agent allowed after invoking skills itself", edit(d, UI, agent_id="sub1")[0] == 0)
check("a different sub-agent is still denied", edit(d, UI, agent_id="sub2")[0] == 2)
# 4. exempt files
d = project()
check("markdown/doc edits are not governed", edit(d, "docs/notes.md")[0] == 0)
# 5. protected enforcement files + user-only waiver
d = project()
check("editing .claude/enforce/rules.json is denied", edit(d, ".claude/enforce/rules.json")[0] == 2)
check("editing .claude/settings.json is denied", edit(d, ".claude/settings.json")[0] == 2)
check("a Bash redirect into the enforcement dir is denied", bash(d, "echo {} > .claude/enforce/rules.json")[0] == 2)
check("Claude cannot waive via tool input text", (skill(d, "ENFORCE-WAIVE: config") and edit(d, ".claude/enforce/rules.json")[0] == 2))
run(d, "prompt", {"prompt": "ENFORCE-WAIVE: config testing the waiver"})
check("the user's prompt waiver unlocks the protected path", edit(d, ".claude/enforce/rules.json")[0] == 0)
# 6. large edit needs .ua evidence
d = project(); ui_skills(d); skill(d, "test-driven-development")
big = "\n".join("line %d" % i for i in range(80))
check("large edit without .ua graph evidence is denied", edit(d, UI, big, tool="Write")[0] == 2)
run(d, "record-tool", {"tool_name": "Bash", "tool_input": {"command": "grep -n Foo .ua/knowledge-graph.json"}})
check("large edit after consulting .ua is allowed", edit(d, UI, big, tool="Write")[0] == 0)
d = project(); ui_skills(d); skill(d, "understand-anything:understand-diff")
check("understand-anything skill also satisfies the large-edit rule", edit(d, UI, big, tool="Write")[0] == 0)
# 7. motion content rule
d = project(); ui_skills(d)
motion = "@keyframes x{}" if IS_WEB else "val a by animateFloatAsState(1f)"
check("motion code without halaqati-motion-guidance is denied", edit(d, UI, motion)[0] == 2)
skill(d, "halaqati-motion-guidance")
check("motion code after halaqati-motion-guidance is allowed", edit(d, UI, motion)[0] == 0)
# 8. debug task type
d = project(); skill(d, "test-driven-development")
run(d, "prompt", {"prompt": "اصلح الخطأ في المزامنة"})
rc, _, err = edit(d, LOGIC)
check("bug-fix task: logic edit needs systematic-debugging", rc == 2 and "systematic-debugging" in err, (rc, err))
skill(d, "superpowers:systematic-debugging")
check("bug-fix task: allowed after systematic-debugging", edit(d, LOGIC)[0] == 0)
d = project(); skill(d, "test-driven-development")
check("without a debug prompt only TDD is needed", edit(d, LOGIC)[0] == 0)
# 9. shell writes
d = project()
check("Bash redirect into a governed UI file is denied", bash(d, "echo 'x' > " + UI)[0] == 2)
check("Bash sed -i on a governed file is denied", bash(d, "sed -i 's/a/b/' " + UI)[0] == 2)
check("read-only Bash on a governed file is allowed", bash(d, "cat " + UI)[0] == 0)
# 10. commit gate (backstop for shell edits) + review requirement + Playwright
d = project(); os.makedirs(os.path.dirname(os.path.join(d, UI)), exist_ok=True)
open(os.path.join(d, UI), "w").write("changed\n")
rc, _, err = bash(d, "git commit -am wip")
check("git commit of a governed file edited without skills is denied", rc == 2, (rc, err))
ui_skills(d)
if IS_WEB:
    rc, _, err = bash(d, "git commit -am wip")
    check("web UI commit without Playwright evidence is denied", rc == 2 and "Playwright" in err, (rc, err))
    run(d, "record-tool", {"tool_name": "mcp__playwright__browser_navigate", "tool_input": {"url": "http://x"}})
check("commit allowed once skills (and Playwright for web) are recorded", bash(d, "git commit -am wip")[0] == 0)
d = project(); ui_skills(d); skill(d, "test-driven-development")
run(d, "record-tool", {"tool_name": "Read", "tool_input": {"file_path": d + "/.ua/knowledge-graph.json"}})
for i in range(3):
    edit(d, UI, "\n".join("l" for _ in range(70)), tool="Write")
os.makedirs(os.path.dirname(os.path.join(d, UI)), exist_ok=True); open(os.path.join(d, UI), "w").write("changed\n")
if IS_WEB:
    run(d, "record-tool", {"tool_name": "mcp__playwright__browser_navigate", "tool_input": {}})
rc, _, err = bash(d, "git push origin main")
check("large change without ponytail-review blocks commit/push", rc == 2 and "ponytail-review" in err, (rc, err))
import time; time.sleep(1.1); skill(d, "ponytail-review")
check("after ponytail-review the push gate passes", bash(d, "git push origin main")[0] == 0)
# 11. Stop / SubagentStop
d = project(); ui_skills(d)
run(d, "record-tool", {"tool_name": "Bash", "tool_input": {"command": "cat .ua/knowledge-graph.json"}})
for i in range(3):
    edit(d, UI, "\n".join("l" for _ in range(70)), tool="Write")
rc, out, _ = run(d, "stop", {"stop_hook_active": False})
check("Stop is blocked for a large unreviewed change", '"decision": "block"' in out, out)
check("Stop does not loop when stop_hook_active", run(d, "stop", {"stop_hook_active": True})[1].strip() == "")
skill(d, "ponytail-review")
check("Stop allowed after ponytail-review", run(d, "stop", {"stop_hook_active": False})[1].strip() == "")
d = project(); ui_skills(d, agent_id="sub9"); run(d, "record-tool", {"tool_name": "Bash", "tool_input": {"command": "grep x .ua/knowledge-graph.json"}, "agent_id": "sub9"})
for i in range(3):
    edit(d, UI, "\n".join("l" for _ in range(70)), tool="Write", agent_id="sub9")
check("SubagentStop blocks that sub-agent's own unreviewed large edits", '"decision": "block"' in run(d, "subagent-stop", {"agent_id": "sub9", "stop_hook_active": False})[1])
check("SubagentStop does not block a sub-agent that edited nothing", run(d, "subagent-stop", {"agent_id": "other", "stop_hook_active": False})[1].strip() == "")
# 12. audit task needs ponytail-audit before finishing
d = project(); run(d, "prompt", {"prompt": "نفذ تدقيق أمني للمشروع"})
check("security-audit task cannot finish without ponytail-audit", '"decision": "block"' in run(d, "stop", {"stop_hook_active": False})[1])
skill(d, "ponytail-audit")
check("audit task can finish after ponytail-audit", run(d, "stop", {"stop_hook_active": False})[1].strip() == "")
# 13. skill invocations are logged per agent
d = project(); skill(d, "android-design", agent_id="subX", agent_type="Explore")
log = open(d + "/.claude/enforce/log/skills.jsonl").read()
check("skill invocation is logged with session, agent and skill", '"agent": "subX"' in log and '"skill": "android-design"' in log, log)
# 14. SubagentStart injects the instruction
check("SubagentStart adds context telling the sub-agent to invoke skills itself", "invoke the Skill tool yourself" in run(project(), "subagent-start", {})[1])
# 15. release verification
d = project()
if IS_WEB:
    def mkzip(name, sha_ok, code=29200, ver="2.92.0"):
        apk = b"APKDATA"; meta = {"versionName": ver, "versionCode": code, "apkUrl": "https://x/Halaqati-latest.apk", "sha256": hashlib.sha256(apk).hexdigest() if sha_ok else "0" * 64, "native": True}
        with zipfile.ZipFile(os.path.join(d, name), "w") as z:
            z.writestr("version.json", json.dumps(meta)); z.writestr("Halaqati-latest.apk", apk)
    mkzip("Halaqati-v2.92.0-publish-update.zip", False)
    ui_skills(d)
    rc, _, err = bash(d, "git add -A && git commit -m publish")
    check("publishing an update zip whose sha256 does not match its APK is denied", rc == 2 and "sha256" in err, (rc, err))
    mkzip("Halaqati-v2.92.0-publish-update.zip", True)
    check("a consistent update zip passes the release check", bash(d, "git commit -am publish")[0] == 0, bash(d, "git commit -am publish"))
    mkzip("Halaqati-v2.92.0-publish-update.zip", True, ver="2.91.9")
    check("update zip whose file name and version.json disagree is denied", bash(d, "git push")[0] == 2)
else:
    os.makedirs(d + "/.github/workflows"); os.makedirs(d + "/source/app")
    open(d + "/source/app/build.gradle.kts", "w").write('versionCode = 29200\nversionName = "2.92.0"\n')
    def mkrc(sha_ok, wf_code="29200", wf_name="2.92.0", zip_code="29200", zip_name="2.92.0"):
        with zipfile.ZipFile(d + "/Halaqati_RC200.zip", "w") as z:
            z.writestr("P/app/build.gradle.kts", 'versionCode = %s\nversionName = "%s"\n' % (zip_code, zip_name))
        sha = hashlib.sha256(open(d + "/Halaqati_RC200.zip", "rb").read()).hexdigest() if sha_ok else "f" * 64
        open(d + "/.github/workflows/Halaqati_RC200.yml", "w").write("env:\n  ARCHIVE_SHA256: %s\nrun: |\n  assert \"versionCode='%s'\" in badging\n  assert data['versionName']=='%s'\n" % (sha, wf_code, wf_name))
    trig = {"tool_name": "mcp__github__actions_run_trigger", "tool_input": {"method": "run_workflow", "workflow_id": "Halaqati_RC200.yml", "ref": "main"}}
    mkrc(False)
    rc, _, err = run(d, "gate", trig)
    check("triggering an RC workflow whose pinned zip hash is wrong is denied", rc == 2 and "ARCHIVE_SHA256" in err, (rc, err))
    mkrc(True, wf_code="29199")
    check("triggering with workflow/zip version mismatch is denied", run(d, "gate", trig)[0] == 2)
    mkrc(True, zip_code="29100", zip_name="2.91.0")
    check("triggering when source version differs from the pinned zip is denied", run(d, "gate", trig)[0] == 2)
    mkrc(True)
    check("a consistent RC (zip hash, versions) may be triggered", run(d, "gate", trig)[0] == 0)
    mkrc(False)
    run(d, "prompt", {"prompt": "ENFORCE-WAIVE: release emergency"})
    check("the user can waive the release check explicitly", run(d, "gate", trig)[0] == 0)

# 16. a command that writes files AND commits cannot slip past the commit gate
d = project(); ui_skills(d)
if IS_WEB:
    run(d, "record-tool", {"tool_name": "mcp__playwright__browser_navigate", "tool_input": {}})
rc, _, err = bash(d, "python3 - <<'EOF'\nopen('x.txt','w').write('1')\nEOF\ngit add -A && git commit -m 'sneaky'")
check("write-and-commit in ONE command is denied", rc == 2 and "own command" in err, (rc, err))
rc, _, err = bash(d, "git commit -m 'a -> b' 2>&1 | head -3")
check("a plain commit with a '2>&1' redirect and '->' in the message is not misflagged", rc == 0, (rc, err))
rc, _, err = bash(d, "echo hi > notes.txt && git commit -am x")
check("redirect-then-commit in ONE command is denied", rc == 2, (rc, err))
print("\n%d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
