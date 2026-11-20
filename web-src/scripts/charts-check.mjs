/* Stats visuals: progress rings fill to their value and the line chart is revealed in reading direction (RTL: right to left) on page entry;
 * a re-render with the SAME numbers plays nothing; with a CHANGED number the ring moves from the old value. Real Chromium; rc49_donor_report mocked.
 * Usage: BASE_URL=http://127.0.0.1:4173/ node scripts/charts-check.mjs */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
let pct = 82;

async function open(reduced = 'no-preference') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: reduced });
  await context.route(/https:\/\//, async r => {
    const u = new URL(r.request().url()); if (!/supabase\.co/.test(u.host)) return r.abort();
    const rep = { students: 51, sessions: 16, hifz_pages: 556, review_pages: 0, tathbit_pages: 91.67, attendance_pct: pct, winners: 0 };
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: /rc49_donor_report/.test(u.pathname) ? JSON.stringify(rep) : '[]' }).catch(() => {});
  });
  const page = await context.newPage(); page.on('pageerror', () => {});
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 45000 });
  await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
  await page.evaluate(() => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) }; state.profile = { id: id(1), role: 'observer', full_name: 'مانح', active: true, approval_status: 'approved' };
    state.offline = false; state.networkVerified = true; state.halaqas = []; state.students = []; state.sessions = [];
    document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden');
  });
  return { context, page };
}
const snap = page => page.evaluate(() => {
  const c = document.getElementById('content');
  const ring = c.querySelector('svg circle[stroke-dasharray]'), line = c.querySelector('svg polyline');
  const anims = el => el ? el.getAnimations().length + (el.ownerSVGElement ? el.ownerSVGElement.getAnimations().length : 0) : -1;
  return { hasRing: !!ring, hasLine: !!line, ringAnims: anims(ring), lineAnims: line ? line.ownerSVGElement.getAnimations().length : -1, dash: ring && ring.getAttribute('stroke-dasharray'), inline: ring && ring.getAttribute('style') };
});
const enter = async page => { await page.evaluate(() => { state.page = 'home'; render(); }); await page.waitForFunction(() => /صفحة حفظ/.test(document.getElementById('content').innerText), null, { timeout: 15000 }); await page.waitForTimeout(60); };

{
  const { context, page } = await open();
  await enter(page);
  const a = await snap(page);
  ok(a.hasRing && a.hasLine, `donor home has a ring and a line chart (ring ${a.hasRing}, line ${a.hasLine})`);
  ok(a.ringAnims > 0, `ring plays a fill animation on page entry (${a.ringAnims} animations)`);
  ok(a.lineAnims > 0, `line chart is revealed on page entry (${a.lineAnims} animations)`);
  const dir = await page.evaluate(() => { const svg = document.querySelector('#content svg polyline').ownerSVGElement; const k = svg.getAnimations().flatMap(x => x.effect.getKeyframes()).find(k => k.clipPath); return k ? [k.clipPath, svg.getAnimations()[0].effect.getKeyframes().at(-1).clipPath] : null; });
  ok(dir && /inset\(0(px)? 0(px)? 0(px)? 100%\)/.test(dir[0]), `reveal starts from the right edge (RTL reading direction): ${dir ? dir[0] : 'none'}`);
  await page.waitForTimeout(1500);
  const b = await snap(page);
  ok(b.ringAnims === 0 && b.lineAnims === 0 && b.dash === a.dash && !b.inline, `everything settles: no running animation, final dash "${b.dash}", no inline residue`);
  /* same numbers again: nothing replays */
  await page.evaluate(() => { render(); }); await page.waitForTimeout(150);
  const c = await snap(page);
  ok(c.ringAnims === 0 && c.lineAnims === 0, `re-render with the same numbers plays nothing (ring ${c.ringAnims}, line ${c.lineAnims})`);
  await context.close();
}
{ /* changed value on the same page */
  pct = 82;
  const { context, page } = await open();
  await enter(page); await page.waitForTimeout(1500);
  pct = 40;
  const moved = await page.evaluate(async () => {
    window.RC50 && (RC50.repCache = {}); HalaqatiSwr.clear() /* donor read RPCs are now cached for 20 s like every other read; a refresh clears them */; render(); await new Promise(r => setTimeout(r, 400));
    const ring = document.querySelector('#content svg circle[stroke-dasharray]');
    return { dash: ring.getAttribute('stroke-dasharray'), anims: ring.getAnimations().length };
  });
  const to = (40 * 1.131).toFixed(1);
  ok(moved.dash.startsWith(to.slice(0, 3)) && moved.anims > 0, `changed value (82 -> 40): ring animates to ${to} (now "${moved.dash}", ${moved.anims} animation)`);
  await context.close();
}
{ /* reduced motion: final state at once, nothing animates */
  pct = 82;
  const { context, page } = await open('reduce');
  await enter(page);
  const r = await snap(page);
  ok(r.hasRing && r.ringAnims === 0 && r.lineAnims === 0 && /^92\./.test(r.dash), `reduced motion: final ring "${r.dash}" immediately, no animation`);
  await context.close();
}
await browser.close();
console.log(fails ? `\n${fails} chart check(s) FAILED` : '\nChart checks: all passed');
process.exit(fails ? 1 : 0);
