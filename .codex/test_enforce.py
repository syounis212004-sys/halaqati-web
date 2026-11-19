"""Exercise the Codex hook wire contract in disposable Git repositories."""
import json
from pathlib import Path
import shlex
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

SCRIPT = Path(__file__).with_name("enforce.py")
MOTION_PATCH = """*** Begin Patch
*** Update File: web-src/src/example.js
@@
+panel.animate([], { duration: 100 });
*** End Patch"""
NOTE = "python3 .codex/enforce.py note "
CHECK = "python3 .codex/enforce.py check -- node --test .ua/tools/example.test.mjs"


class EnforcementTest(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory(prefix="halaqati-codex-hook-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.git("init", "-q")
        self.write("web-src/src/example.js", "const value = 1;\n")
        self.write(".ua/tools/example.test.mjs", "import assert from 'node:assert/strict'; assert.ok(true);\n")
        self.git("add", ".")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture")
        self.turn = "turn-1"
        self.start("Update project tooling.")

    def write(self, path, text):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding="utf-8")

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root)

    def hook(self, event, **kwargs):
        payload = dict(cwd=str(self.root), session_id="session-1", turn_id=self.turn,
                       hook_event_name=event, **kwargs)
        result = subprocess.run([sys.executable, SCRIPT], cwd=self.root, input=json.dumps(payload),
                                text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def start(self, prompt):
        return self.hook("UserPromptSubmit", prompt=prompt)

    def stop(self, continued=False):
        return self.hook("Stop", stop_hook_active=continued)

    def pre(self, command, tool="Bash"):
        return self.hook("PreToolUse", tool_name=tool, tool_input={"command": command})

    def post(self, command, response, cwd=None):
        return self.hook("PostToolUse", tool_name="Bash",
                         tool_input={"command": command, "workdir": str(cwd or self.root)}, tool_response=response)

    def note(self, kind, name):
        summary = "Checked source and affected call sites. Documented the observed result and relevant limits."
        command = NOTE + shlex.join([kind, name, summary])
        result = subprocess.check_output([sys.executable, SCRIPT, *shlex.split(command)[2:]], cwd=self.root, text=True)
        self.post(command, result)

    def check(self, expect=0):
        result = subprocess.run([sys.executable, SCRIPT, *shlex.split(CHECK)[2:]], cwd=self.root,
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, expect, result.stdout + result.stderr)
        self.post(CHECK, result.stdout)
        return result.stdout

    def assert_denial(self, output, reason):
        details = output["hookSpecificOutput"]
        self.assertEqual(details["permissionDecision"], "deny")
        self.assertIn(reason, details["permissionDecisionReason"])

    def test_read_and_reference_to_audit_do_not_require_evidence(self):
        self.start("Update the hook for ponytail-audit and review a previous report.")
        self.assertEqual(self.pre("git log -1 --format='git commit'"), {})
        self.assertEqual(self.pre("cat .claude/skills/ponytail-review/SKILL.md"), {})
        self.assertEqual(self.stop(), {})

    def test_actual_audit_needs_application_note_in_the_same_turn(self):
        self.start("دقّق جودة أدوات الرسم المعرفي.")
        self.post("cat .claude/skills/ponytail-audit/SKILL.md", "skill text")
        self.assertIn("ponytail-audit", self.stop()["reason"])
        self.note("audit", "ponytail-audit")
        self.assertEqual(self.stop(), {})
        self.turn = "turn-2"
        self.start("Audit the render path.")
        self.assertIn("ponytail-audit", self.stop()["reason"])
        self.assertIn("ponytail-audit", self.stop(True)["systemMessage"])

    def test_patch_requires_motion_note_but_unrelated_patch_does_not(self):
        self.assertEqual(self.pre(MOTION_PATCH.replace("panel.animate([], { duration: 100 });", "const total = value + 1;"), "apply_patch"), {})
        self.assert_denial(self.pre(MOTION_PATCH, "apply_patch"), "motion")
        self.note("motion", "gsap-core")
        self.assertEqual(self.pre(MOTION_PATCH, "apply_patch"), {})

    def test_shell_edits_are_checked_at_stop_and_need_a_successful_current_check(self):
        self.check()
        self.write("web-src/src/example.js", "panel.animate([], { duration: 100 });\n")
        self.assertIn("motion", self.stop()["reason"])
        self.note("motion", "gsap-core")
        self.assertIn("passing check", self.stop()["reason"])
        self.check()
        self.assertEqual(self.stop(), {})

    def test_failed_check_does_not_satisfy_stop(self):
        self.write(".ua/tools/example.test.mjs", "throw new Error('failed test');\n")
        self.check(expect=1)
        self.assertIn("passing check", self.stop()["reason"])

    def test_large_staged_change_requires_review_and_current_tests(self):
        self.write("web-src/src/example.js", "const n = 1;\n" * 60)
        self.git("add", "web-src")
        self.check()
        self.post("cat .claude/skills/ponytail-review/SKILL.md", "skill text")
        self.assert_denial(self.pre("git commit -m fixture"), "ponytail-review")
        self.note("review", "ponytail-review")
        self.assertEqual(self.pre("git commit -m fixture"), {})
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture")
        self.assertEqual(self.stop(), {})
        self.write("web-src/src/example.js", "const n = 2;\n" * 61)
        self.git("add", "web-src")
        self.assert_denial(self.pre("git commit -m fixture"), "ponytail-review")

    def test_commit_that_would_stage_more_than_reviewed_is_denied(self):
        self.write("web-src/src/example.js", "const n = 2;\n")
        self.assert_denial(self.pre("git commit -am fixture"), "stage")
        self.assert_denial(self.pre("git commit -m fixture -- web-src/src/example.js"), "stage")
        self.assertEqual(self.pre("git commit --dry-run"), {})
        self.assertEqual(self.pre("echo 'git commit -am fixture'"), {})

    def test_audit_tests_as_a_task_does_not_trigger_a_full_audit(self):
        self.start("Run audit tests and report their exit status.")
        self.assertEqual(self.stop(), {})

    def test_successful_check_must_leave_the_reviewed_files_unchanged(self):
        self.write(".ua/tools/example.test.mjs", "import fs from 'node:fs'; fs.appendFileSync('web-src/src/example.js', '// changed');\n")
        self.check(expect=1)
        self.assertIn("passing check", self.stop()["reason"])

    def test_existing_changes_do_not_block_read_only_task(self):
        self.write("web-src/src/example.js", "panel.animate([], {});\n" * 60)
        self.start("Explain the source file.")
        self.assertEqual(self.stop(), {})

    def test_unrelated_preexisting_edits_need_not_be_staged(self):
        self.write("web-src/src/unrelated.js", "panel.animate([], {});\n" * 60)
        self.start("Update one source file without touching the existing change.")
        self.write("web-src/src/example.js", "const n = 2;\n")
        self.git("add", "web-src/src/example.js")
        self.check()
        self.assertEqual(self.pre("git commit -m fixture"), {})

    def test_partial_stage_does_not_reuse_worktree_evidence(self):
        self.write("web-src/src/example.js", "const n = 2;\n")
        self.git("add", "web-src")
        self.write("web-src/src/example.js", "const n = 3;\n")
        self.check()
        self.assert_denial(self.pre("git commit -m fixture"), "passing check")

    def test_only_success_of_the_named_command_counts_as_a_check(self):
        self.write("web-src/src/example.js", "const n = 2;\n")
        message = self.check()
        self.start("Try tooling.")
        self.write("web-src/src/example.js", "const n = 3;\n")
        self.post("echo " + shlex.quote(message), message)
        self.assertIn("passing check", self.stop()["reason"])


if __name__ == "__main__":
    unittest.main()
