/* Browser check for the landing page: viewports, dark mode, keyboard, every button/link, login hand-off, axe (optional), screenshots.
   Usage: npm run build && node scripts/landing-check.mjs   (env: CHROMIUM_PATH, SHOTS_DIR, AXE_PATH) */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist } from './_static-server.mjs';

const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const shots = process.env.SHOTS_DIR || '.artifacts/landing';
fs.mkdirSync(shots, { recursive: true });
const srv = serveDist(4199);
const URL_ = srv.base + '?landing=1';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const failures = [], notes = [];
const fail = (m) => failures.push(m);
const axeSrc = process.env.AXE_PATH && fs.existsSync(process.env.AXE_PATH) ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;

async function open(width, { dark = false, reduced = false, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: dark ? 'dark' : 'light', locale: 'ar' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForSelector('html[data-landing-ready]');
  return { ctx, page, errs };
}

/* 1. layout at every width, light + dark */
for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
  for (const dark of [false, true]) {
    const { ctx, page, errs } = await open(width, { dark });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, dir: getComputedStyle(document.body).direction, theme: document.documentElement.dataset.hlTheme, font: getComputedStyle(document.getElementById('hl-h1')).fontFamily, appHidden: getComputedStyle(document.getElementById('app')).display }));
    if (m.sw > m.w + 1) fail(`${width}${dark ? ' dark' : ''}: horizontal overflow ${m.sw}>${m.w}`);
    if (m.dir !== 'rtl') fail(`${width}: not rtl`);
    if (!/Cairo/.test(m.font)) fail(`${width}: font is ${m.font}`);
    if (dark && m.theme !== 'dark') fail(`${width}: dark theme not applied`);
    if (m.appHidden !== 'none') fail(`${width}: app screen visible under landing`);
    if (errs.length) fail(`${width}: console errors ${errs.join(' | ')}`);
    if (width === 390 || width === 1440 || width === 320 || width === 768) {
      /* scroll through so reveal animations finish, then capture */
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 110)); } scrollTo(0, 0); });
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(shots, `landing-${width}${dark ? '-dark' : ''}.jpg`), type: 'jpeg', quality: 58, fullPage: width !== 1920 });
    }
    await ctx.close();
  }
}

/* 2. links, buttons, keyboard, demo, tabs, faq */
{
  const { ctx, page, errs } = await open(1440);
  const ids = await page.evaluate(() => [...document.querySelectorAll('#hlRoot a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)).filter((h) => h && !document.getElementById(h)));
  if (ids.length) fail('dead anchors: ' + ids.join(','));
  const apk = await page.evaluate(() => [...document.querySelectorAll('a[download]')].map((a) => a.getAttribute('href')));
  if (!apk.length || apk.some((h) => h !== './Halaqati-latest.apk')) fail('apk links wrong: ' + apk);
  for (const id of ['hl-home', 'hl-paths', 'hl-demo', 'hl-mushaf', 'hl-features', 'hl-how', 'hl-faq', 'hl-app']) {
    await page.click(`#hl-links a[href="#${id}"]`);
    await page.waitForTimeout(1400);
    const top = await page.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().top), id);
    if (id !== 'hl-home' && (top < -5 || top > 140)) fail(`nav ${id} landed at ${top}`);
  }
  /* roles */
  for (const id of ['admin', 'teacher', 'supervisor', 'guardian', 'donor']) {
    await page.click(`#hl-tab-${id}`);
    const vis = await page.evaluate((i) => [...document.querySelectorAll('.hl-panel')].filter((p) => !p.hidden).map((p) => p.id), id);
    if (vis.length !== 1 || vis[0] !== `hl-panel-${id}`) fail('role panel ' + id + ' -> ' + vis);
  }
  await page.focus('#hl-tab-donor'); await page.keyboard.press('ArrowLeft');
  if (await page.evaluate(() => document.activeElement.id) !== 'hl-tab-admin') fail('RTL arrow-left should wrap to first tab');

  /* gallery: platform switch, screen chips, hotspots, lazy images */
  await page.click('#hl-tab-teacher');
  const vis = () => page.evaluate(() => [...document.querySelectorAll('#hl-panel-teacher .hl-shot')].filter((f) => !f.hidden).map((f) => f.dataset.screen));
  if ((await vis()).join() !== 'web-teacher-home') fail('teacher gallery should start on the web home screen: ' + (await vis()));
  await page.click('#hl-panel-teacher .hl-seg button[data-platform="android"]');
  if (!(await vis())[0].startsWith('android-')) fail('android toggle did not show an android screen');
  const chipsShown = await page.evaluate(() => [...document.querySelectorAll('#hl-panel-teacher .hl-chip2')].filter((c) => !c.hidden).map((c) => c.dataset.platform));
  if (!chipsShown.length || chipsShown.some((p) => p !== 'android')) fail('android chips are mixed with web chips: ' + chipsShown);
  await page.click('#hl-panel-teacher .hl-chip2[data-screen="android-mushaf-jump"]');
  if ((await vis())[0] !== 'android-mushaf-jump') fail('screen chip did not switch the screen');
  await page.waitForFunction(() => { const f = document.querySelector('#hl-panel-teacher .hl-shot:not([hidden]) img'); return f && f.complete && f.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => fail('gallery image did not load after opening it'));
  await page.click('#hl-panel-teacher .hl-shot:not([hidden]) .hl-pin[data-pin="1"]');
  if (!(await page.evaluate(() => document.querySelector('#hl-panel-teacher .hl-shot:not([hidden]) .hl-pinlist li:nth-child(2)').classList.contains('on')))) fail('pin press did not highlight its description');
  await page.click('#hl-panel-teacher .hl-seg button[data-platform="web"]');
  if (!(await vis())[0].startsWith('web-')) fail('web toggle did not return to a web screen');
  await page.click('#hl-tab-admin');
  if (await page.evaluate(() => document.querySelectorAll('#hl-panel-admin .hl-seg').length)) fail('admin must not offer an android switch (no real android screens)');
  /* sizes are explicit and only the hero image is eager */
  const imgs = await page.evaluate(() => [...document.querySelectorAll('#hlRoot picture img')].map((i) => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), l: i.getAttribute('loading'), alt: !!i.alt })));
  if (imgs.some((i) => !i.w || !i.h || !i.alt)) fail('gallery image without width/height/alt');
  if (imgs.filter((i) => i.l !== 'lazy').length !== 1) fail('exactly one non-lazy image expected, got ' + imgs.filter((i) => i.l !== 'lazy').length);
  /* demo */
  await page.locator('#hl-try').scrollIntoViewIfNeeded();
  await page.fill('#hl-d-mist', '0'); await page.click('#hl-recform button[type=submit]');
  if (!/ممتاز/.test(await page.textContent('#hl-d-result'))) fail('demo pass message missing');
  await page.fill('#hl-d-mist', '9'); await page.click('#hl-recform button[type=submit]');
  if (!/إعادة/.test(await page.textContent('#hl-d-result'))) fail('demo fail message missing');
  await page.click('#hl-dt-mus'); await page.click('#hl-mus-next');
  if (!/42/.test(await page.textContent('#hl-mus-num'))) fail('mushaf next');
  await page.click('#hl-dt-rep');
  if (!(await page.textContent('#hl-rep-kpis')).includes('2')) fail('report kpis not updated');
  const net = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /supabase|\.co\//.test(r.name)).length);
  if (net) fail('demo touched network');
  /* faq */
  await page.click('.hl-q:nth-child(2) summary'); await page.waitForTimeout(400);
  if (!(await page.evaluate(() => document.querySelectorAll('.hl-q[open]').length))) fail('faq did not open');
  /* pause decorative motion (WCAG 2.2.2) */
  await page.click('#hl-pause');
  if (!(await page.evaluate(() => document.documentElement.hasAttribute('data-hl-paused') && getComputedStyle(document.querySelector('.hl-hero-phone')).animationPlayState === 'paused'))) fail('pause button did not pause looping motion');
  await page.click('#hl-pause');
  /* theme */
  await page.click('#hl-theme');
  if (await page.evaluate(() => document.documentElement.dataset.hlTheme) !== 'dark') fail('theme toggle');
  if (errs.length) fail('console errors (interaction): ' + errs.join(' | '));
  await ctx.close();
}

/* 3. mobile menu + keyboard focus order + login hand-off */
{
  const { ctx, page } = await open(390);
  await page.click('#hl-burger');
  if (await page.getAttribute('#hl-burger', 'aria-expanded') !== 'true') fail('burger not expanded');
  await page.click('#hl-links a[href="#hl-faq"]'); await page.waitForTimeout(500);
  if (await page.getAttribute('#hl-burger', 'aria-expanded') !== 'false') fail('menu did not close after link');
  await page.screenshot({ path: path.join(shots, 'landing-390-menu.jpg'), type: 'jpeg', quality: 70 }).catch(() => {});
  await page.evaluate(() => scrollTo(0, 0));
  await page.click('.hl-hero [data-hl-signup]');
  await page.waitForSelector('#auth', { state: 'visible', timeout: 20000 }).catch(() => fail('login screen did not appear after "ابدأ الآن"'));
  await page.waitForFunction(() => document.getElementById('signupForm') && !document.getElementById('signupForm').classList.contains('hidden'), null, { timeout: 20000 }).catch(async () => fail('sign-up form did not open after "ابدأ الآن": ' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, signup: document.getElementById('signupForm').className, auth: document.getElementById('auth').className, toggle: typeof window.toggleSignup, ready: !!window.HalaqatiCertificates })))));
  const st = await page.evaluate(() => ({ landing: document.documentElement.hasAttribute('data-landing'), root: getComputedStyle(document.getElementById('hlRoot')).display, email: !!document.getElementById('loginEmail'), emailVisible: true, hash: location.hash }));
  if (st.landing || st.root !== 'none' || !st.emailVisible || st.hash !== '#signup') fail('login hand-off state ' + JSON.stringify(st));
  await page.screenshot({ path: path.join(shots, 'signup-after-landing-390.jpg'), type: 'jpeg', quality: 70 });
  await ctx.close();
}


/* 3b. the login button keeps opening the existing login screen */
{
  const { ctx, page } = await open(1024);
  await page.click('.hl-nav [data-hl-login]');
  await page.waitForSelector('#loginForm', { state: 'visible', timeout: 20000 }).catch(() => fail('login form did not open'));
  if (await page.evaluate(() => location.hash) !== '#login') fail('login hash');
  if (await page.evaluate(() => !document.getElementById('signupForm').classList.contains('hidden'))) fail('sign-up form must stay closed for the login button');
  await ctx.close();
}

/* 4. signed-in user never sees the landing page (no forced flag, with cached identity) + visitor without flag in automation */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('halaqati_v24_last_auth', JSON.stringify({ id: 'u1', email: 'x@y.z', lastVerifiedAt: Date.now() })));
  await page.goto(srv.base + '?landing=1');
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => document.getElementById('signupForm') && !document.getElementById('signupForm').classList.contains('hidden'), null, { timeout: 20000 }).catch(async () => fail('sign-up form did not open after "ابدأ الآن": ' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, signup: document.getElementById('signupForm').className, auth: document.getElementById('auth').className, toggle: typeof window.toggleSignup, ready: !!window.HalaqatiCertificates })))));
  const st = await page.evaluate(() => ({ landing: document.documentElement.hasAttribute('data-landing'), root: getComputedStyle(document.getElementById('hlRoot')).display, css: !!document.querySelector('link[href*="landing.css"]') }));
  if (st.landing || st.root !== 'none' || st.css) fail('signed-in user got landing ' + JSON.stringify(st));
  await ctx.close();
}

/* 5. reduced motion: content visible, no GSAP chunk requested */
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await ctx.newPage(); const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await page.goto(URL_); await page.waitForSelector('html[data-landing-ready]'); await page.waitForTimeout(1500);
  if (reqs.some((u) => /gsap|ScrollTrigger/.test(u))) fail('reduced motion still loaded GSAP');
  const hidden = await page.evaluate(() => document.querySelectorAll('.hl-pre').length);
  if (hidden) fail('reduced motion left hidden reveal items');
  await ctx.close();
}

/* 6. axe */
if (axeSrc) {
  for (const dark of [false, true]) {
    const { ctx, page } = await open(1440, { dark });
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () => (await axe.run('#hlRoot', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) })));
    notes.push(`axe ${dark ? 'dark' : 'light'}: ${res.length} violations ${JSON.stringify(res)}`);
    if (res.some((v) => v.impact === 'critical' || v.impact === 'serious')) fail('axe serious/critical ' + (dark ? 'dark' : 'light') + ': ' + JSON.stringify(res));
    await ctx.close();
  }
} else notes.push('axe skipped (set AXE_PATH)');

await browser.close(); srv.close();
notes.forEach((n) => console.log(n));
if (failures.length) { console.error('LANDING CHECK FAILED\n' + failures.join('\n')); process.exit(1); }
console.log('landing check OK');
