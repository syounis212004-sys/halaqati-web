// Regression guards for the 2026-11-16 audit fixes (web). Plain node, no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };

// 1) No raw database text inside <option> markup (stored XSS sink).
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
const rawOption = /<option[^>]*>\$\{\s*(?!esc\(|e\(|h\()[A-Za-z_.?]*(full_name|\.name|\.title)\s*\}<\/option>/;
for (const f of walk(path.join(root, 'src'))) {
  read(path.relative(root, f)).split('\n').forEach((line, i) => {
    ok(!rawOption.test(line), `unescaped name in <option>: ${path.relative(root, f)}:${i + 1}`);
  });
}

// 2) Native Google sign-in: tokens in the deep link are accepted only while a sign-in we started is pending.
const auth = read('src/features/auth/runtime.js');
const start = auth.indexOf('const NATIVE_OAUTH_PENDING_KEY');
const end = auth.indexOf('async function finishNativeGoogleLogin');
ok(start > 0 && end > start, 'pending-sign-in helpers missing');
const store = new Map();
let now = 1_000_000;
const sandbox = {
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  Date: { now: () => now },
};
vm.createContext(sandbox);
vm.runInContext(auth.slice(start, end) + ';this.mark=markNativeOAuthPending;this.take=takeNativeOAuthPending;this.ttl=NATIVE_OAUTH_TTL_MS', sandbox);
ok(sandbox.take() === false, 'a forged callback with nothing pending must be refused');
sandbox.mark(); ok(sandbox.take() === true, 'a callback right after our own sign-in must be accepted');
ok(sandbox.take() === false, 'the pending flag must be one-shot');
sandbox.mark(); now += sandbox.ttl + 1; ok(sandbox.take() === false, 'a stale pending flag must be refused');
store.set('halaqati_native_oauth_pending', String(now + 5000)); ok(sandbox.take() === false, 'a pending flag from the future must be refused');
const finish = auth.slice(end, auth.indexOf('async function', end + 10));
ok(/takeNativeOAuthPending\(\)/.test(finish) && finish.indexOf('takeNativeOAuthPending()') < finish.indexOf('setSession'), 'finishNativeGoogleLogin must check the pending flag before setSession');
ok(/markNativeOAuthPending\(\);[\s\S]{0,80}signInWithOAuth/.test(auth), 'loginWithGoogle must mark the sign-in as pending before opening the browser');

// 3) Sign-out removes the downloaded student snapshot but keeps unsynced operations.
const lo = auth.indexOf('async function logout()');
ok(lo > 0 && auth.slice(lo, lo + 500).includes('await clearLocalStudentData(uid)'), 'logout must clear local student data');
const off = read('src/core/offline-store.js');
const cs = off.slice(off.indexOf('async clearSnapshot'), off.indexOf('async migrateLegacy'));
ok(cs.includes('SNAPSHOTS') && !cs.includes('OUTBOX'), 'clearSnapshot must touch only the snapshot store');

if (errors.length) { console.error('Audit fixes check FAILED\n - ' + errors.join('\n - ')); process.exit(1); }
console.log('Audit fixes check passed');
