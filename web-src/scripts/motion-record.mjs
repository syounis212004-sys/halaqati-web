/* Motion recorder: captures motion OVER TIME (CDP screencast) so it can be judged by eye, not just asserted.
   Usage: BASE_URL=http://127.0.0.1:5173/ LABEL=before node scripts/motion-record.mjs [scenario ...]
   Output: .artifacts/motion-rec/<LABEL>/<scenario>-<viewport>/{frames,sheet.png,movie.mp4}
   The sheet tiles one frame every STEP ms with its timestamp, so start / middle / end, speed and jumps are visible.
   Test data is injected (no network: https is aborted), same approach as scripts/motion-check.mjs. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const LABEL = process.env.LABEL || 'run';
const STEP = +(process.env.STEP || 70);
const OUT = `.artifacts/motion-rec/${LABEL}`;
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function openApp({ width, height, dark = false, reduce = false, role = 'admin' }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference', colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
  await context.route(/https:\/\//, r => r.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 45000 });
  await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(({ dark, role }) => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) };
    state.profile = { id: id(1), role, full_name: 'د. محمد سمير أبو يونس', active: true, approval_status: 'approved' };
    state.offline = true; state.networkVerified = false;
    state.halaqas = [0, 1, 2].map(i => ({ id: id(10 + i), name: ['حلقة معاوية بن أبي سفيان', 'حلقة عمر بن الخطاب', 'حلقة الفاروق'][i], active: true, halaqa_type: 'regular' }));
    state.students = Array.from({ length: 12 }, (_, i) => ({ id: id(100 + i), full_name: 'طالب ' + i + ' أبو يونس', status: 'active', halaqa_id: state.halaqas[i % 3].id, track_code: 'general_hifz', enrollment_date: '2026-01-01' }));
    state.sessions = [{ id: id(4), halaqa_id: state.halaqas[0].id, session_date: today(), session_type: 'tasmee', status: 'open', title: 'جلسة اليوم', activity_data: {} }];
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (dark) document.body.classList.add('dark');
  }, { dark, role });
  await page.evaluate(() => go('home')); await sleep(1500);
  return { context, page, errors };
}

/* run `act` while recording; returns [{t, file}] */
async function record(page, dir, act) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir + '/frames', { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; let t0 = null; const writes = [];
  cdp.on('Page.screencastFrame', f => {
    const ts = f.metadata.timestamp * 1000; if (t0 === null) t0 = ts;
    const file = `${dir}/frames/${String(frames.length).padStart(4, '0')}.jpg`;
    frames.push({ t: Math.round(ts - t0), file });
    writes.push(fs.promises.writeFile(file, Buffer.from(f.data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
  await sleep(120);
  await act();
  await cdp.send('Page.stopScreencast'); await Promise.all(writes); await cdp.detach();
  return frames;
}

function sheet(frames, dir, cols = 8, maxMs = +(process.env.MAXMS || 1500)) {
  if (!frames.length) return;
  const picks = []; const end = Math.min(maxMs, frames[frames.length - 1].t);
  for (let t = 0; t <= end; t += STEP) { let f = frames[0]; for (const x of frames) if (x.t <= t) f = x; picks.push({ t, file: f.file }); }
  const list = picks.map(p => ['-label', `${p.t}ms`, p.file]).flat();
  execFileSync('montage', [...list, '-tile', `${cols}x`, '-geometry', '+3+3', '-pointsize', '16', '-background', '#222', '-fill', '#fff', '-resize', '230x', `${dir}/sheet.png`]);
  /* movie from the real frame timestamps */
  const txt = frames.map((f, i) => `file '${process.cwd()}/${f.file}'\nduration ${Math.max(.016, ((frames[i + 1]?.t ?? f.t + 100) - f.t) / 1000)}`).join('\n');
  fs.writeFileSync(dir + '/list.txt', txt + `\nfile '${process.cwd()}/${frames[frames.length - 1].file}'\n`);
  try { execFileSync('/usr/bin/ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', dir + '/list.txt', '-vsync', 'vfr', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', dir + '/movie.mp4']); } catch (_e) { /* optional */ }
}

/* state to reach BEFORE recording starts, so the sheet shows only the motion under test */
export const SETUPS = {
  async 'card-expand'(page) { await page.evaluate(() => go('students')); await sleep(1500); },
  async 'roster-expand'(page) { await page.evaluate(() => { state.sessionView = state.sessions[0].id; go('sessions'); }); await sleep(1800); },
  async 'sort-filter'(page) { await page.evaluate(() => go('students')); await sleep(1500); },
  async 'drawer-drag'(page) { await page.evaluate(() => toggleDrawer(true)); await sleep(800); },
  async 'drawer-drag-cancel'(page) { await page.evaluate(() => toggleDrawer(true)); await sleep(800); },
  async 'dialog-reverse'(page) { await sleep(10); },
};
export const SCENARIOS = {
  /* students list -> halaqas: page change choreography */
  async 'page-change'(page) { await page.evaluate(() => go('students')); await sleep(1200); await page.evaluate(() => go('home')); await sleep(1300); },
  async 'page-change-fast'(page) { await page.evaluate(async () => { for (const p of ['students', 'plans', 'sessions', 'halaqas']) { go(p); await new Promise(r => setTimeout(r, 160)); } }); await sleep(1300); },
  async 'dialog'(page) { await page.evaluate(() => document.getElementById('halaqaDlg').showModal()); await sleep(600); await page.evaluate(() => document.getElementById('halaqaDlg').close()); await sleep(600); },
  async 'drawer'(page) { await page.evaluate(() => toggleDrawer(true)); await sleep(800); await page.evaluate(() => toggleDrawer(false)); await sleep(600); },
  async 'drawer-reverse'(page) { await page.evaluate(() => toggleDrawer(true)); await sleep(120); await page.evaluate(() => toggleDrawer(false)); await sleep(700); },
  async 'nav-pill'(page) { await page.evaluate(() => go('sessions')); await sleep(1200); await page.evaluate(() => go('plans')); await sleep(1300); },
  async 'card-expand'(page) { const b = page.locator('.nst-card-main').first(); if (!(await b.count())) return; await b.click(); await sleep(700); await b.click(); await sleep(700); },
  async 'roster-expand'(page) { await page.evaluate(() => NSR.toggle(state.students[0].id)); await sleep(800); await page.evaluate(() => NSR.toggle(state.students[0].id)); await sleep(700); },
  async 'sort-filter'(page) { await page.evaluate(() => { NSS.sortBy('name'); }); await sleep(900); await page.evaluate(() => { NSS.sortBy('name'); }); await sleep(900); },
  async 'loading-to-content'(page) { await page.evaluate(() => go('plans')); await sleep(1800); },
  async 'drawer-drag'(page) {
    const cdp = await page.context().newCDPSession(page); const y = 400;
    const pt = (x) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(120) });
    for (let x = 120; x <= 260; x += 14) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x) }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(700);
  },
  async 'drawer-drag-cancel'(page) {
    const cdp = await page.context().newCDPSession(page); const y = 400; const pt = (x) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(120) });
    for (let x = 120; x <= 170; x += 5) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x) }); await sleep(30); }
    await sleep(250);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(700);
  },
  async 'toast'(page) { await page.evaluate(() => toast('تم الحفظ بنجاح')); await sleep(1400); },
  async 'counters'(page) { await page.evaluate(() => go('plans')); await sleep(800); await page.evaluate(() => go('home')); await sleep(1400); },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
  for (const vp of [{ n: 'm390', width: 390, height: 844 }, { n: 'd1440', width: 1440, height: 900 }]) {
    const { context, page, errors } = await openApp(vp);
    for (const name of names) {
      if (vp.n === 'd1440' && name.startsWith('drawer')) continue; if (vp.n === 'm390' && name === 'sort-filter') { /* cards on phones: same re-render path */ } /* the drawer is a phone surface */
      const dir = `${OUT}/${name}-${vp.n}`;
      if (SETUPS[name]) await SETUPS[name](page); else { await page.evaluate(() => go('home')); await sleep(1300); }
      const frames = await record(page, dir, () => SCENARIOS[name](page));
      sheet(frames, dir, vp.n === 'm390' ? 10 : 6);
      console.log(`${name}-${vp.n}: ${frames.length} frames -> ${dir}/sheet.png`);
    }
    if (errors.length) console.log('pageerror:', errors.slice(0, 3));
    await context.close();
  }
  await browser.close();
}
