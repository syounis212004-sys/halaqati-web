"""Local Codex quality gates. Skill notes are attestations by the acting agent."""
import difflib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import sys

SCOPE = ("web-src", ".ua/tools", ".codex")
AGENT_COMMAND = ["python3", ".codex/enforce.py"]
MOTION_SKILLS = {
    "60fps-animation", "accessible-animation", "animation-forge", "gsap-web",
    "micro-interaction", "motion-director", "site-motion-excellence-director",
    "svg-animation", "web-motion-auditor", "gsap-core", "gsap-performance",
    "gsap-plugins", "gsap-scrolltrigger", "gsap-timeline", "gsap-utils",
    "halaqati-motion-guidance",
}
MOTION = re.compile(
    r"@(?:keyframes|starting-style)|\b(?:animation|transition)(?:-[\w-]+)?\s*:"
    r"|\b(?:gsap|HalaqatiMotion|ScrollTrigger|requestAnimationFrame|startViewTransition)\b"
    r"|\.animate\s*\(|prefers-reduced-motion|--hm-|:(?:hover|active|focus-visible)\b"
    r"|addEventListener\(\s*['\"](?:click|pointer\w*|touch\w*|animation\w*|transition\w*)\b"
    r"|\bon(?:click|pointer\w*|touch\w*)\s*="
)
AUDIT = re.compile(
    r"^\s*(?:[-*]\s+|\d+[.)]\s+)?(?:please\s+|أريد منك\s+|أريد أن ت|من فضلك\s+)?"
    r"(?:(?:/|\$)ponytail-audit\b|audit\s+(?!tests?\b)"
    r"|(?:perform|run|conduct)\s+(?:an?\s+)?(?:quality\s+|security\s+|code\s+)?audit\b"
    r"(?!\s+(?:tests?|hook tests?)\b)"
    r"|(?:دق[ّ]?ق|افحص أمنيًا|أجرِ?\s+تدقيق[اًًا]*|نفّ?ذ\s+تدقيق[اًًا]*)\b)",
    re.IGNORECASE | re.MULTILINE,
)
PATCH_PATH = re.compile(r"^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$")


def git(*args, cwd=None):
    return subprocess.check_output(["git", *args], cwd=cwd, stderr=subprocess.PIPE)


def names(raw):
    return [os.fsdecode(name) for name in raw.split(b"\0") if name]


def in_scope(name):
    return any(name.startswith(prefix + "/") for prefix in SCOPE)


def motion_source(name):
    return name.startswith("web-src/src/") or name == "web-src/index.html"


def digest(value):
    return hashlib.sha256(value).hexdigest()


def object_bytes(spec):
    result = subprocess.run(["git", "show", spec], capture_output=True)
    return result.stdout if result.returncode == 0 else b""


def worktree_file(name):
    file = Path(name)
    if file.is_symlink():
        return "120000", os.fsencode(os.readlink(file))
    if file.is_file():
        mode = "100755" if file.stat().st_mode & stat.S_IXUSR else "100644"
        return mode, file.read_bytes()
    return "", b""


def snapshot(base, staged=False, details=False):
    options = ["--cached"] if staged else []
    paths = set(names(git("diff", *options, "--no-renames", "--name-only", "-z", base, "--", *SCOPE)))
    if not staged:
        paths.update(names(git("ls-files", "--others", "--exclude-standard", "-z", "--", *SCOPE)))
    # Explicit test and hook files are in scope. Local runtime state lives in Git metadata.
    state = {}
    for name in sorted(paths):
        if staged:
            entry = git("ls-files", "--stage", "-z", "--", ":(literal)" + name)
            mode = entry.split(b" ", 1)[0].decode() if entry else ""
            data = object_bytes(":" + name) if entry else b""
        else:
            mode, data = worktree_file(name)
        item = {"hash": mode + ":" + digest(data)}
        if details:
            before = object_bytes(base + ":" + name)
            old = before.decode(errors="replace").splitlines()
            new = data.decode(errors="replace").splitlines()
            changes = []
            for action, first, last, start, end in difflib.SequenceMatcher(None, old, new).get_opcodes():
                if action != "equal":
                    changes.extend(old[first:last])
                    changes.extend(new[start:end])
            item["lines"] = len(changes)
            item["motion"] = motion_source(name) and any(motion_line(line) for line in changes)
        state[name] = item
    return state


def motion_line(line):
    return not line.lstrip().startswith(("//", "/*", "*", "<!--")) and bool(MOTION.search(line))


def hashes(snapshot):
    return {name: item["hash"] for name, item in snapshot.items()}


def fingerprint(snapshot):
    return digest(json.dumps(hashes(snapshot), sort_keys=True).encode())



def staged_paths():
    return set(names(git("diff", "--cached", "--no-renames", "--name-only", "-z", "HEAD", "--", *SCOPE)))


def active_diff(state, full, include=()):
    return {name: item for name, item in full.items()
            if name in include or item["hash"] != state["before"].get(name)}


def current_diff(state):
    return fingerprint(active_diff(state, snapshot(state["head"]), staged_paths()))

def allowed_check(argv):
    if argv in (
        ["node", ".ua/tools/verify-graph.mjs", "."],
        ["node", ".ua/tools/safe-literal.test.mjs"],
        ["python3", ".codex/test_enforce.py"],
        ["git", "diff", "--check"],
        ["git", "diff", "--cached", "--check"],
    ):
        return True
    if argv[:2] == ["node", "--test"] and len(argv) > 2:
        return all(in_scope(name) and name.endswith(".test.mjs") and ".." not in Path(name).parts
                   and re.fullmatch(r"[\w./-]+", name) for name in argv[2:])
    return (
        argv == ["npm", "--prefix", "web-src", "test"]
        or len(argv) == 5 and argv[:4] == ["npm", "--prefix", "web-src", "run"]
        and bool(re.fullmatch(r"check:[a-z0-9-]+", argv[4]))
    )


def note_valid(kind, skill, summary):
    by_kind = {"motion": MOTION_SKILLS, "review": {"ponytail-review"}, "audit": {"ponytail-audit"}}
    return skill in by_kind.get(kind, ()) and len(summary.split()) >= 6 and len(summary) <= 1000


def work_fingerprint():
    head = git("rev-parse", "HEAD").decode().strip()
    return digest((head + fingerprint(snapshot(head))).encode())


def receipt(args, work=""):
    return "HALAQATI_CODEX_OK:" + digest(json.dumps([args, work]).encode())


def parse_command(command):
    try:
        return shlex.split(command)
    except ValueError:
        return []


def evidence(args, response, state):
    if args[:2] != AGENT_COMMAND:
        return
    output = response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)
    payload = args[2:]
    if len(payload) == 4 and payload[0] == "note" and note_valid(*payload[1:]) and receipt(payload) in output:
        kind = payload[1]
        state["evidence"][kind] = {
            "skill": payload[2], "summary": payload[3],
            "diff": current_diff(state) if kind == "review" else None,
        }
    if payload[:2] == ["check", "--"] and allowed_check(payload[2:]) and receipt(payload, work_fingerprint()) in output:
        current = current_diff(state)
        state["checks"].setdefault(current, [])
        if payload[2:] not in state["checks"][current]:
            state["checks"][current].append(payload[2:])


def missing(state, changes, full):
    reasons = []
    notes = state["evidence"]
    current = fingerprint(full)
    if any(item["motion"] for item in changes.values()) and "motion" not in notes:
        reasons.append("apply a relevant motion skill and record the motion decision")
    lines = [item["lines"] for item in changes.values()]
    if (max(lines, default=0) >= 60 or sum(lines) >= 150) and notes.get("review", {}).get("diff") != current:
        reasons.append("apply ponytail-review and record findings for this exact diff")
    if state["audit"] and "audit" not in notes:
        reasons.append("apply ponytail-audit and record its scope and result")
    checks = state["checks"].get(current, [])
    if changes and not any(argv[0] != "git" for argv in checks):
        reasons.append("run a passing check for this exact diff via .codex/enforce.py check")
    return reasons



def commit_mode(args):
    dry_run = False
    options = iter(args)
    for arg in options:
        if arg in {"-m", "--message"}:
            if next(options, None) is None:
                return "other"
        elif arg == "--dry-run":
            dry_run = True
        elif arg in {"--amend", "--no-edit", "--edit", "-q", "--quiet", "--signoff"}:
            continue
        elif not (arg.startswith("-m") and len(arg) > 2 or arg.startswith("--message=")):
            return "other"
    return "dry-run" if dry_run else "staged"

def motion_patch(command, tool_root):
    active = False
    for line in command.splitlines():
        match = PATCH_PATH.match(line)
        if match:
            candidate = Path(os.path.abspath(tool_root / match[1]))
            active = candidate.is_relative_to(Path.cwd()) and motion_source(candidate.relative_to(Path.cwd()).as_posix())
            active = active and not line.startswith("*** Delete File:")
            continue
        if active and line.startswith(("+", "-")) and motion_line(line[1:]):
            return True
    return False


def deny(reason):
    return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                  "permissionDecisionReason": reason}}


def state_path(payload):
    name = digest(payload["session_id"].encode())
    return Path(os.fsdecode(git("rev-parse", "--absolute-git-dir").strip())) / "halaqati-codex" / (name + ".json")


def save(file, state):
    temp = file.with_suffix(f".{os.getpid()}.tmp")
    temp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    temp.replace(file)


def handle(payload):
    event = payload["hook_event_name"]
    inputs = payload.get("tool_input", {})
    command = inputs.get("command") or ""
    args = parse_command(command)
    tool = payload.get("tool_name")
    commit = tool == "Bash" and args[:2] == ["git", "commit"]
    apply_patch = tool == "apply_patch"
    relevant = (event in {"UserPromptSubmit", "Stop"} or event == "PreToolUse" and (commit or apply_patch)
                or event == "PostToolUse" and args[:2] == AGENT_COMMAND)
    if not relevant:
        return {}
    tool_root = Path(inputs.get("workdir") or payload["cwd"])
    if not tool_root.is_absolute():
        tool_root = Path(payload["cwd"]) / tool_root
    os.chdir(os.fsdecode(git("rev-parse", "--show-toplevel", cwd=payload["cwd"]).strip()))
    file = state_path(payload)
    file.parent.mkdir(mode=0o700, exist_ok=True)
    with file.with_suffix(".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        return run_event(payload, file, args, command, tool_root, commit, apply_patch)


def run_event(payload, file, args, command, tool_root, commit, apply_patch):
    event = payload["hook_event_name"]
    turn = payload["turn_id"]
    if event == "UserPromptSubmit":
        head = git("rev-parse", "HEAD").decode().strip()
        save(file, {"head": head, "turn": turn, "before": hashes(snapshot(head)),
                    "audit": bool(AUDIT.search(payload.get("prompt", ""))), "evidence": {}, "checks": {}})
        return {}
    mode = commit_mode(args[2:]) if commit else None
    if commit and (mode == "dry-run" or git("rev-parse", "--show-toplevel", cwd=tool_root).strip() != os.fsencode(Path.cwd())):
        return {}
    if mode == "other":
        if staged_paths() or git("diff", "--name-only", "-z", "--", *SCOPE):
            return deny("Halaqati: stage the intended files explicitly and run a plain git commit -m after checking them.")
        return {}
    if not file.exists():
        if commit and staged_paths():
            return deny("Halaqati: quality hooks need a new prompt to initialize tracking before committing.")
        return {}
    state = json.loads(file.read_text(encoding="utf-8"))
    if state["turn"] != turn:
        return {}
    if event == "PostToolUse" and tool_root.resolve() == Path.cwd():
        evidence(args, payload.get("tool_response"), state)
        save(file, state)
    if event == "PreToolUse" and apply_patch and "motion" not in state["evidence"] and motion_patch(command, tool_root):
        return deny("Halaqati: apply a relevant motion skill and record your motion decision before this patch.")
    if event == "PreToolUse" and commit:
        staged = staged_paths()
        if not staged:
            return {}
        full = snapshot(state["head"], staged=True, details=True)
        changes = {name: item for name, item in full.items() if name in staged}
        reasons = missing(state, changes, active_diff(state, full, staged))
        if reasons:
            return deny("Halaqati: " + ", ".join(reasons) + ".")
    if event == "Stop":
        full = snapshot(state["head"], details=True)
        reasons = missing(state, active_diff(state, full), active_diff(state, full, staged_paths()))
        if reasons:
            message = "Halaqati: " + ", ".join(reasons) + ". Report any unresolved item explicitly."
            return {"systemMessage": message} if payload.get("stop_hook_active") else {"decision": "block", "reason": message}
    return {}


def cli(args):
    if len(args) == 4 and args[0] == "note" and note_valid(*args[1:]):
        print(receipt(args))
        return 0
    if args[:2] == ["check", "--"] and allowed_check(args[2:]):
        before = work_fingerprint()
        result = subprocess.run(args[2:])
        if result.returncode:
            return result.returncode if result.returncode > 0 else 1
        if work_fingerprint() == before:
            print(receipt(args, before))
            return 0
        print("Check changed tracked or in-scope untracked files. Re-run on the resulting diff.", file=sys.stderr)
        return 1
    print("Usage: enforce.py note <motion|review|audit> <skill> '<specific summary>'; "
          "or enforce.py check -- <supported test command>", file=sys.stderr)
    return 2


if __name__ == "__main__":
    if len(sys.argv) > 1:
        sys.exit(cli(sys.argv[1:]))
    print(json.dumps(handle(json.load(sys.stdin)), ensure_ascii=False))
