#!/usr/bin/env python3
"""Halaqati skill enforcement for Claude Code hooks (works in Claude Code cloud sessions: python3 stdlib only).

Sub-commands (wired in .claude/settings.json):
  prompt         UserPromptSubmit  - task type (debug/audit) + user waivers (only the human's prompt can create them)
  record-skill   PostToolUse(Skill) - append the invocation to the log and the actor's state
  record-tool    PostToolUse(Bash|Read|Grep|mcp__playwright__*) - evidence of .ua/ graph use and Playwright use
  gate           PreToolUse        - deny Edit/Write/MultiEdit/NotebookEdit/Bash/MCP-publish when required skills are missing
  stop           Stop              - block finishing a large change that was never reviewed
  subagent-stop  SubagentStop      - same, for the subagent's own edits
  subagent-start SubagentStart     - tell the subagent which skills it must invoke itself
  report         prints a summary of the logs (invocation record only; it cannot prove the skill's result was applied)

An "actor" is (session_id, agent_id or "main"): sub-agents are tracked separately and must invoke skills themselves.
"""
import fcntl, fnmatch, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(os.path.join(HERE, "..", ".."))
ED = os.path.join(ROOT, ".claude", "enforce")
STATE_DIR, LOG_DIR = os.path.join(ED, "state"), os.path.join(ED, "log")
sys.path.insert(0, HERE)


def load_rules():
    try:
        with open(os.path.join(ED, "rules.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # invalid config must not silently disable enforcement
        deny("enforcement config .claude/enforce/rules.json is unreadable (%s). Fix it (needs the user's ENFORCE-WAIVE: config)." % e)


def deny(msg):
    sys.stderr.write("BLOCKED by Halaqati skill enforcement: " + msg + "\n")
    sys.exit(2)


def log(name, rec):
    os.makedirs(LOG_DIR, exist_ok=True)
    rec["ts"] = int(time.time())
    with open(os.path.join(LOG_DIR, name), "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


class State:
    """Per-session state file with an exclusive lock (sub-agent hooks can run concurrently)."""
    def __init__(self, sid):
        os.makedirs(STATE_DIR, exist_ok=True)
        self.path = os.path.join(STATE_DIR, re.sub(r"[^A-Za-z0-9_.-]", "_", sid or "nosession") + ".json")
        self.fh = open(self.path, "a+", encoding="utf-8")
        fcntl.flock(self.fh, fcntl.LOCK_EX)
        self.fh.seek(0)
        raw = self.fh.read()
        self.d = json.loads(raw) if raw.strip() else {}
        self.d.setdefault("actors", {}); self.d.setdefault("task", []); self.d.setdefault("waivers", {})

    def actor(self, key):
        return self.d["actors"].setdefault(key, {"skills": [], "tools": [], "lines": 0, "last_edit": 0, "review_ts": 0, "ua": False})

    def save(self):
        self.fh.seek(0); self.fh.truncate(); self.fh.write(json.dumps(self.d, ensure_ascii=False)); self.fh.flush()
        fcntl.flock(self.fh, fcntl.LOCK_UN); self.fh.close()


def actor_key(p):
    return p.get("agent_id") or "main"


def norm(name):
    return (name or "").strip().lower()


def has_skill(skills, want):
    """want 'ui-ux-pro-max' matches 'ui-ux-pro-max' and 'plugin:ui-ux-pro-max'; want 'ua' matches any understand-anything:*"""
    want = norm(want)
    for s in skills:
        s = norm(s)
        if want == "ua":
            if s.startswith("understand-anything:"):
                return True
        elif s == want or s.endswith(":" + want):
            return True
    return False


def rel(path):
    try:
        ap = os.path.abspath(path if os.path.isabs(path) else os.path.join(ROOT, path))
        r = os.path.relpath(ap, ROOT)
        return None if r.startswith("..") else r.replace(os.sep, "/")
    except Exception:
        return None


def match(globs, r):
    return any(fnmatch.fnmatch(r, g) for g in globs)


def edit_texts(tool, ti):
    if tool == "Write":
        return [ti.get("content", "")]
    if tool == "Edit":
        return [ti.get("new_string", "")]
    if tool == "MultiEdit":
        return [e.get("new_string", "") for e in ti.get("edits", [])]
    if tool == "NotebookEdit":
        return [ti.get("new_source", "")]
    return []


def requirements(rules, r, texts, task_types):
    """Return {requirement: reason} for editing path r."""
    need = {}
    for pr in rules.get("path_rules", []):
        if match(pr["globs"], r):
            for s in pr["require"]:
                need[s] = pr.get("why", pr["id"])
    joined = "\n".join(texts)
    for cr in rules.get("content_rules", []):
        if match(cr.get("scope_globs", ["*"]), r) and re.search(cr["pattern"], joined):
            for s in cr["require"]:
                need[s] = cr.get("why", cr["id"])
    for t in task_types:
        tr = rules.get("task_rules", {}).get(t)
        if tr and match(tr["applies_to_globs"], r):
            for s in tr["require"]:
                need[s] = tr.get("why", "task type: " + t)
    return need


def missing_for(need, skills, waivers):
    out = []
    for s, why in need.items():
        if has_skill(skills, s) or s in waivers or ("*" in waivers):
            continue
        out.append((s, why))
    return out


def how_to(miss):
    names = ", ".join(s for s, _ in miss)
    reasons = "; ".join("%s: %s" % (s, w) for s, w in miss)
    return ("invoke the Skill tool for [%s] yourself (each agent/sub-agent must do it once per session), then retry. Reason: %s. "
            "A skill invocation is recorded in .claude/enforce/log/skills.jsonl; only the user can waive a rule by writing "
            "'ENFORCE-WAIVE: <skill-or-rule>' in a prompt." % (names, reasons))


def large_edit_needs_ua(rules, r, lines, total):
    le = rules.get("large_edit", {})
    return match(le.get("globs", []), r) and (lines >= le.get("lines", 60) or total >= le.get("total_lines", 150))


def changed_files():
    try:
        out = subprocess.run(["git", "-C", ROOT, "status", "--porcelain", "-uall"], capture_output=True, text=True, timeout=20).stdout
        files = []
        for line in out.splitlines():
            p = line[3:].split(" -> ")[-1].strip().strip('"')
            if p:
                files.append(p)
        return files
    except Exception:
        return []


WRITE_HINT = re.compile(r"(>>?\s*\S|\btee\b|\bsed\s+-[a-zA-Z]*i|\bperl\s+-[a-zA-Z]*i|\bgit\s+apply\b|\bpatch\b|\bmv\s|\bcp\s|\binstall\s|write_text|write_bytes|\.write\(|open\([^)]*['\"][wax]|\bdd\b|\btruncate\b|\brm\s)")


def bash_targets(rules, cmd):
    """Heuristic: governed paths that a shell command seems to write. Bash can always be obfuscated; the commit gate is the backstop."""
    if not WRITE_HINT.search(cmd):
        return []
    hits = []
    for tok in set(re.findall(r"[\w./@+-]+", cmd)):
        r = rel(tok) if ("/" in tok or "." in tok) else None
        if r and not r.startswith(".claude/enforce/state") and (match(rules.get("protected", []), r) or governed(rules, r)):
            hits.append(r)
    return sorted(set(hits))


def governed(rules, r):
    if match(rules.get("exempt", []), r):
        return False
    return any(match(pr["globs"], r) for pr in rules.get("path_rules", []))


def union_skills(st):
    s = []
    for a in st.d["actors"].values():
        s += a["skills"]
    return s


def union_tools(st):
    t = []
    for a in st.d["actors"].values():
        t += a["tools"]
    return t


def task_types(st):
    return st.d.get("task", [])


def waivers(st):
    return set(st.d.get("waivers", {}).keys())


# ---------------------------------------------------------------- hooks
def cmd_prompt(p):
    rules = load_rules()
    text = p.get("prompt", "") or ""
    st = State(p.get("session_id"))
    for m in re.finditer(r"ENFORCE-WAIVE:\s*([A-Za-z0-9:_*.-]+)\s*(.*)", text):
        st.d["waivers"][m.group(1)] = {"reason": m.group(2)[:200], "ts": int(time.time())}
        log("events.jsonl", {"event": "waiver", "session": p.get("session_id"), "rule": m.group(1), "reason": m.group(2)[:200]})
    for t, tr in rules.get("task_rules", {}).items():
        if re.search(tr["prompt_regex"], text, re.I) and t not in st.d["task"]:
            st.d["task"].append(t)
            log("events.jsonl", {"event": "task-type", "session": p.get("session_id"), "type": t})
    st.save()


def cmd_record_skill(p):
    skill = (p.get("tool_input") or {}).get("skill", "")
    if not skill:
        return
    st = State(p.get("session_id"))
    a = st.actor(actor_key(p))
    a["skills"].append(skill)
    if has_skill([skill], "ponytail-review"):
        a["review_ts"] = int(time.time())
    st.save()
    log("skills.jsonl", {"session": p.get("session_id"), "agent": actor_key(p), "agent_type": p.get("agent_type"), "skill": skill})


def cmd_record_tool(p):
    tool, ti = p.get("tool_name", ""), p.get("tool_input") or {}
    ev = None
    blob = json.dumps(ti, ensure_ascii=False)
    if tool.startswith("mcp__playwright__"):
        ev = tool
    elif tool in ("Bash", "Read", "Grep", "Glob") and ("/.ua/" in blob or ".ua/knowledge-graph" in blob or ".ua/" in blob.replace("\\/", "/")):
        ev = "ua-graph"
    if not ev:
        return
    st = State(p.get("session_id"))
    a = st.actor(actor_key(p))
    if ev == "ua-graph":
        a["ua"] = True
    elif ev not in a["tools"]:
        a["tools"].append(ev)
    st.save()
    log("skills.jsonl", {"session": p.get("session_id"), "agent": actor_key(p), "evidence": ev})


def gate_edit(p, rules, tool, ti):
    fp = ti.get("file_path") or ti.get("notebook_path") or ""
    r = rel(fp) if fp else None
    if r is None:
        return
    st = State(p.get("session_id"))
    a = st.actor(actor_key(p))
    w = waivers(st)
    decision = ("allow", [])
    try:
        if match(rules.get("protected", []), r):
            if "config" not in w and "*" not in w:
                decision = ("deny", [("config", "enforcement files are protected; the user must write 'ENFORCE-WAIVE: config <reason>'")])
        elif not match(rules.get("exempt", []), r):
            texts = edit_texts(tool, ti)
            need = requirements(rules, r, texts, task_types(st))
            lines = sum(t.count("\n") + 1 for t in texts if t)
            if need and large_edit_needs_ua(rules, r, lines, a["lines"] + lines):
                need["ua"] = "large edit: consult the .ua knowledge graph first (Understand Anything skill, or read/grep .ua/knowledge-graph.json)"
            miss = []
            for s, why in need.items():
                if s == "ua":
                    if not (a["ua"] or has_skill(a["skills"], "ua") or "ua" in w or "*" in w):
                        miss.append((s, why))
                elif not (has_skill(a["skills"], s) or s in w or "*" in w):
                    miss.append((s, why))
            if miss:
                decision = ("deny", miss)
            else:
                a["lines"] += lines
                a["last_edit"] = int(time.time())
    finally:
        st.save()
    log("events.jsonl", {"event": "gate", "session": p.get("session_id"), "agent": actor_key(p), "tool": tool, "path": r,
                         "decision": decision[0], "missing": [m[0] for m in decision[1]]})
    if decision[0] == "deny":
        deny("cannot %s %s: %s" % (tool, r, how_to(decision[1])))


def check_release_artifacts(rules, files, wf=None):
    import verify_release
    return verify_release.check(ROOT, files, rules.get("publish", {}), wf)


def gate_bash(p, rules, ti):
    cmd = ti.get("command", "")
    st = State(p.get("session_id"))
    a = st.actor(actor_key(p))
    w = waivers(st)
    problems = []
    try:
        # 1) shell writes to governed or protected paths
        for r in bash_targets(rules, cmd):
            if match(rules.get("protected", []), r):
                if "config" not in w and "*" not in w:
                    problems.append("protected path %s (needs the user's ENFORCE-WAIVE: config)" % r)
                continue
            need = requirements(rules, r, [cmd], task_types(st))
            miss = [(s, why) for s, why in need.items() if not (has_skill(a["skills"], s) or s in w or "*" in w)]
            if miss:
                problems.append("shell write to %s: %s" % (r, how_to(miss)))
        # 2) commit/push gate: skills for every changed governed file, review for large changes, Playwright for web UI, release verification
        if re.search(r"\bgit\s+(-C\s+\S+\s+)?(commit|push)\b", cmd):
            files = [f for f in changed_files() if not match(rules.get("exempt", []), f)]
            sess_skills, sess_tools = union_skills(st), union_tools(st)
            for f in files:
                if match(rules.get("protected", []), f):
                    if "config" not in w and "*" not in w:
                        problems.append("changed protected file %s (needs ENFORCE-WAIVE: config)" % f)
                    continue
                need = requirements(rules, f, [], task_types(st))
                miss = [(s, why) for s, why in need.items() if not (has_skill(sess_skills, s) or s in w or "*" in w)]
                if miss:
                    problems.append("%s changed without %s" % (f, how_to(miss)))
            cg = rules.get("commit_gate", {})
            total = sum(x["lines"] for x in st.d["actors"].values())
            last_edit = max([x["last_edit"] for x in st.d["actors"].values()] + [0])
            review = max([x["review_ts"] for x in st.d["actors"].values()] + [0])
            if total >= cg.get("large_total_lines", 150) and review < last_edit and "ponytail-review" not in w and "*" not in w:
                problems.append("large change (%d edited lines) not reviewed after the last edit: invoke the ponytail-review skill, then commit" % total)
            pw = cg.get("playwright_paths", [])
            if pw and any(match(pw, f) for f in files) and not any(t.startswith("mcp__playwright__") for t in sess_tools) and "playwright" not in w and "*" not in w:
                problems.append("web UI files changed but no Playwright MCP tool was used this session (use mcp__playwright__browser_navigate/take_screenshot on a runnable page, or the user writes ENFORCE-WAIVE: playwright <reason>)")
            if "release" not in w and "*" not in w:
                problems += check_release_artifacts(rules, [f for f in changed_files()])
        # 3) any other command that publishes: gh workflow run / gh release
        if re.search(r"\bgh\s+(workflow\s+run|release\s+(create|upload))\b", cmd) and "release" not in w and "*" not in w:
            problems += check_release_artifacts(rules, [])
    finally:
        st.save()
    log("events.jsonl", {"event": "gate", "session": p.get("session_id"), "agent": actor_key(p), "tool": "Bash",
                         "decision": "deny" if problems else "allow", "missing": problems[:5]})
    if problems:
        deny("; ".join(problems))


def gate_mcp(p, rules, tool, ti):
    wf = str(ti.get("workflow_id", ""))
    if tool.endswith("actions_run_trigger") and ti.get("method") == "run_workflow" and re.search(rules.get("publish", {}).get("workflow_regex", r"Halaqati_RC\d+\.yml"), wf):
        st = State(p.get("session_id")); w = waivers(st); st.save()
        problems = [] if ("release" in w or "*" in w) else check_release_artifacts(rules, [], wf)
        log("events.jsonl", {"event": "gate", "session": p.get("session_id"), "agent": actor_key(p), "tool": tool, "workflow": wf,
                             "decision": "deny" if problems else "allow", "missing": problems[:5]})
        if problems:
            deny("workflow %s is not verified: %s" % (wf, "; ".join(problems)))


def cmd_gate(p):
    rules = load_rules()
    tool, ti = p.get("tool_name", ""), p.get("tool_input") or {}
    if tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
        gate_edit(p, rules, tool, ti)
    elif tool == "Bash":
        gate_bash(p, rules, ti)
    elif tool.startswith("mcp__github__"):
        gate_mcp(p, rules, tool, ti)


def stop_check(p, per_agent):
    if p.get("stop_hook_active"):
        return None
    rules = load_rules()
    st = State(p.get("session_id")); w = waivers(st)
    actors = {actor_key(p): st.actor(actor_key(p))} if per_agent else st.d["actors"]
    types = task_types(st); st.save()
    if "*" in w:
        return None
    total = sum(x["lines"] for x in actors.values())
    last_edit = max([x["last_edit"] for x in actors.values()] + [0])
    review = max([x["review_ts"] for x in actors.values()] + [0])
    msgs = []
    if total >= rules.get("commit_gate", {}).get("large_total_lines", 150) and review < last_edit and "ponytail-review" not in w:
        msgs.append("%d edited lines were never reviewed after the last edit: invoke the ponytail-review skill and report its findings" % total)
    if "audit" in types and not per_agent and not any(has_skill(x["skills"], "ponytail-audit") for x in actors.values()) and "ponytail-audit" not in w:
        msgs.append("this was an audit task but the ponytail-audit skill was never invoked")
    return "; ".join(msgs) or None


def cmd_stop(p, per_agent=False):
    m = stop_check(p, per_agent)
    log("events.jsonl", {"event": "subagent-stop" if per_agent else "stop", "session": p.get("session_id"), "agent": actor_key(p), "blocked": bool(m)})
    if m:
        print(json.dumps({"decision": "block", "reason": "Skill enforcement: " + m}, ensure_ascii=False))


def cmd_subagent_start(p):
    rules = load_rules()
    req = sorted({s for pr in rules.get("path_rules", []) for s in pr["require"]})
    msg = ("Skill enforcement is active. You are a sub-agent: your own edits are gated separately from the main agent. "
           "Before editing governed files, invoke the Skill tool yourself for the skills your files need (%s), and consult the .ua knowledge graph "
           "(grep .ua/knowledge-graph.json) before large edits. Do this once; do not re-read skills you already invoked." % ", ".join(req))
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "SubagentStart", "additionalContext": msg}}, ensure_ascii=False))


def cmd_report(_):
    def rd(n):
        try:
            return [json.loads(l) for l in open(os.path.join(LOG_DIR, n), encoding="utf-8") if l.strip()]
        except FileNotFoundError:
            return []
    sk, ev = rd("skills.jsonl"), rd("events.jsonl")
    print("NOTE: this proves skills were INVOKED (recorded by a PostToolUse hook). It cannot prove their guidance was applied well.")
    for s in sk:
        print("invoked" if "skill" in s else "evidence", s.get("session", "")[:8], s.get("agent"), s.get("skill") or s.get("evidence"))
    for e in ev:
        if e.get("event") == "gate":
            print("gate", e["decision"], e.get("agent"), e.get("tool"), e.get("path") or "", e.get("missing") or "")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "report":
        return cmd_report(None)
    try:
        p = json.loads(sys.stdin.read() or "{}")
    except Exception:
        p = {}
    try:
        {"prompt": cmd_prompt, "record-skill": cmd_record_skill, "record-tool": cmd_record_tool, "gate": cmd_gate,
         "stop": cmd_stop, "subagent-stop": lambda x: cmd_stop(x, True), "subagent-start": cmd_subagent_start}[cmd](p)
    except SystemExit:
        raise
    except Exception as e:  # a bug in the hook must not brick the session; it is logged
        log("events.jsonl", {"event": "hook-error", "cmd": cmd, "error": repr(e)[:300]})
        sys.stderr.write("enforce.py internal error (ignored, logged): %r\n" % (e,))
        sys.exit(1)


if __name__ == "__main__":
    main()
