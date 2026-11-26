// Static guards for the RC114 parity layer: boot order, RPC whitelist (no new server logic), no direct table access, no motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const files = ['features/contests/ui.js', 'features/contribute/ui.js', 'features/reminders/ui.js'];

test('boot order: contests, reminders, contribute run after rc86 and before startup', () => {
  const main = src('main.js');
  const order = [...main.matchAll(/\[\w+Url, '([\w-]+)'\]/g)].map((m) => m[1]);
  const i86 = order.indexOf('halaqati-rc86-parity'), iS = order.indexOf('halaqati-startup-runtime');
  assert.deepEqual(order.slice(i86 + 1, iS), ['halaqati-rc114-contests', 'halaqati-rc114-reminders', 'halaqati-rc114-contribute']);
  assert.match(main, /window\.ContestRules\s*=\s*contestRules/);
  assert.match(main, /window\.ReminderLogic\s*=\s*reminderLogic/);
  assert.match(main, /styles\/rc114\.css/);
});

test('the new UI calls only RPCs that already exist on the server', () => {
  const allowed = new Set(['contest_submit', 'contest_my', 'contest_admin_list', 'contest_visible', 'contest_decide', 'contest_donor_halaqas']);
  const used = new Set();
  for (const f of files) for (const m of src(f).matchAll(/(?:rpc|list)\('([a-z0-9_]+)'/g)) used.add(m[1]);
  assert.ok(used.size >= 6, 'expected the contest RPCs to be used');
  for (const n of used) assert.ok(allowed.has(n), 'unexpected RPC ' + n);
});

test('the new UI never touches tables directly and has no sign-in or role logic', () => {
  for (const f of files) {
    const s = src(f);
    assert.doesNotMatch(s, /\bdb\.from\(|\.insert\(|\.upsert\(|\.delete\(/, f);
    assert.doesNotMatch(s, /auth\.(signIn|signUp)/, f);
  }
});

test('contribute page is limited to the four roles and the donor/student are excluded', () => {
  const s = src('features/contribute/ui.js');
  assert.match(s, /const ROLES=\['guardian','teacher','supervisor','admin'\]/);
  assert.doesNotMatch(s.replace(/\/\*[\s\S]*?\*\//g, ''), /observer|student/);
});

test('local reminder keeps everything in localStorage and says it cannot fire when the browser is closed', () => {
  const ui = src('features/reminders/ui.js');
  assert.doesNotMatch(ui, /rpc\(|db\./);
  assert.match(ui, /لا يمكن للمتصفح إرسال إشعار وهو مغلق/);
  assert.match(src('features/reminders/schedule.mjs'), /localStorage|storage/);
});

test('no animation or transition is introduced (reduced motion safe by construction)', () => {
  const css = src('styles/rc114.css');
  assert.doesNotMatch(css, /@keyframes|transition\s*:|animation\s*:/);
  for (const f of files) assert.doesNotMatch(src(f), /requestAnimationFrame|\.animate\(|gsap/, f);
});
