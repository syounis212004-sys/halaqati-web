/* Button states: pressed -> busy (shimmer) -> success (pulse) OR error (ring + short shake). Real Chromium, network mocked.
 * Usage: BASE_URL=http://127.0.0.1:4173/ node scripts/buttons-check.mjs */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function open(reduced = 'no-preference', width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: reduced });
  await context.route(/https:\/\//, r => r.abort());
  const page = await context.newPage(); page.on('pageerror', () => {});
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 45000 });
  await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
  await page.evaluate(() => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) }; state.profile = { id: id(1), role: 'admin', full_name: 'x', active: true, approval_status: 'approved' };
    state.halaqas = []; state.students = []; state.sessions = []; state.page = 'home';
    document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); render();
    const b = document.createElement('button'); b.id = 'tbtn'; b.type = 'button'; b.className = 'nx-btn nx-filled'; b.textContent = 'حفظ'; b.style.cssText = 'position:fixed;top:120px;left:20px;z-index:99999';
    document.body.appendChild(b);
  });
  await page.waitForTimeout(800);
  return { context, page };
}
/* press the button, the app disables it (busy), the operation ends, the app re-enables it, then shows a message */
const flow = (page, msg, { press = true, wait = 220 } = {}) => page.evaluate(async ({ msg, press, wait }) => {
  const b = document.getElementById('tbtn'), sleep = ms => new Promise(r => setTimeout(r, ms)), style0 = b.getAttribute('style');
  if (press) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  b.disabled = true; await sleep(120); b.disabled = false; await sleep(30);
  window.toast(msg); await sleep(wait);
  const anims = b.getAnimations().filter(a => a.effect && a.effect.getKeyframes().some(k => 'translate' in k)).length;
  const out = { err: b.classList.contains('hm-err'), okc: b.classList.contains('hm-ok'), shake: anims, busy: b.classList.contains('hm-busy') };
  await sleep(1100);
  out.after = { err: b.classList.contains('hm-err'), running: b.getAnimations().length, style: b.getAttribute('style') === style0 };
  return out;
}, { msg, press, wait });

{
  const { context, page } = await open();
  const e = await flow(page, 'تعذر الحفظ، حاول مرة أخرى');
  ok(e.err && e.shake === 1 && !e.okc && !e.busy, `failure: the pressed button gets an error ring and ONE shake (err ${e.err}, shake anims ${e.shake}, busy ${e.busy})`);
  ok(!e.after.err && e.after.running === 0 && e.after.style, `failure state cleans up (err ${e.after.err}, running ${e.after.running}, inline style untouched)`);
  const s = await flow(page, 'تم الحفظ بنجاح');
  ok(s.okc && !s.err, `success still pulses, never shows the error state (ok ${s.okc}, err ${s.err})`);
  const n = await flow(page, 'تعذر الحفظ', { press: false });
  ok(!n.err, `an error message with no button just pressed marks nothing (err ${n.err})`);
  const again = await flow(page, 'فشل الإرسال');
  ok(again.err && again.shake === 1, `a second failure plays once, not stacked (shake anims ${again.shake})`);
  await context.close();
}
{ /* reduced motion: the ring (colour) stays so the failure is visible, but nothing moves */
  const { context, page } = await open('reduce');
  const e = await flow(page, 'تعذر الحفظ');
  ok(e.err && e.shake === 0, `reduced motion: error ring only, no shake (err ${e.err}, shake anims ${e.shake})`);
  await context.close();
}
await browser.close();
console.log(fails ? `\n${fails} button check(s) FAILED` : '\nButton checks: all passed');
process.exit(fails ? 1 : 0);
