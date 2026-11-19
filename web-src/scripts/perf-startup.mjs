/* Startup performance on a slow network and a slow CPU. Real Chromium, CDP throttling, a static server that behaves like GitHub Pages
 * (gzip, Cache-Control max-age=600, no brotli). Supabase is answered locally so only the app's own delivery is measured.
 * Usage: node scripts/perf-startup.mjs [--json out.json]     (builds nothing: serve ./dist, so run `npm run build` first)
 * Scenarios: first visit, repeat visit (service worker + HTTP cache), signed-in launch from the local snapshot. */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serveDist } from './_static-server.mjs';

const { base: BASE, close: closeServer } = serveDist(+(process.env.PERF_PORT || 4180));

const PROFILES = {
  'fast3g (1.6 Mbps, 150 ms)': { down: 1.6e6 / 8, up: 0.75e6 / 8, rtt: 150 },
  'slow3g (400 kbps, 400 ms)': { down: 0.4e6 / 8, up: 0.4e6 / 8, rtt: 400 },
};
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });

async function newPage(ctx, prof, cpu) {
  const page = await ctx.newPage(); page.on('pageerror', () => {});
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: prof.down, uploadThroughput: prof.up, latency: prof.rtt });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const net = { requests: 0, bytes: 0 }; const seen = new Map();
  cdp.on('Network.requestWillBeSent', e => { if (/127\.0\.0\.1/.test(e.request.url)) { net.requests++; seen.set(e.requestId, e.request.url); } });
  cdp.on('Network.loadingFinished', e => { if (seen.has(e.requestId)) net.bytes += e.encodedDataLength; });
  return { page, net, cdp };
}
const slim = u => u.replace(BASE, '');
async function scenario(profName, cpu, name, run) {
  const prof = PROFILES[profName]; const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow', locale: 'ar' });
  await ctx.route(/https:\/\//, r => /supabase\.co/.test(new URL(r.request().url()).host) ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-allow-origin': '*' }, body: '[]' }) : r.abort());
  const out = await run(ctx, prof, cpu); await ctx.close(); return { profile: profName, scenario: name, ...out };
}
const vitals = page => page.evaluate(() => new Promise(res => {
  let lcp = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* unsupported */ }
  setTimeout(() => { const nav = performance.getEntriesByType('navigation')[0], fcp = performance.getEntriesByName('first-contentful-paint')[0];
    res({ fcp: Math.round(fcp ? fcp.startTime : 0), lcp: Math.round(lcp), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) }); }, 300);
}));
const longTasks = page => page.evaluate(() => performance.getEntriesByType('longtask').reduce((a, e) => a + Math.max(0, e.duration - 50), 0) | 0);

const results = [];
for (const profName of Object.keys(PROFILES)) {
  const cpu = 4;
  results.push(await scenario(profName, cpu, 'first visit (login screen)', async (ctx, prof, cpu) => {
    const { page, net } = await newPage(ctx, prof, cpu); const t0 = Date.now();
    await page.addInitScript(() => { window.addEventListener('halaqati:ready', () => { window.__ready = Math.round(performance.now()); }); window.__tbt = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* none */ } });
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.waitForFunction(() => { const a = document.getElementById('auth'); return a && !a.classList.contains('hidden') && a.offsetHeight > 0 && !document.getElementById('rc27Splash'); }, null, { timeout: 120000 });
    const interactive = Date.now() - t0; await page.waitForFunction(() => window.__ready, null, { timeout: 120000 }); const readyMs = await page.evaluate(() => window.__ready); const v = await vitals(page);
    return { ...v, readyMs, loginVisibleMs: interactive, requests: net.requests, kb: Math.round(net.bytes / 1024), tbtMs: Math.round(await page.evaluate(() => window.__tbt)) };
  }));
  results.push(await scenario(profName, cpu, 'repeat visit (cached)', async (ctx, prof, cpu) => {
    const { page, net } = await newPage(ctx, prof, cpu);
    await page.goto(BASE, { waitUntil: 'load', timeout: 180000 }); await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(r => !!(r && r.active)), null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500); net.requests = 0; net.bytes = 0; const t0 = Date.now();
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => { const a = document.getElementById('auth'); return a && !a.classList.contains('hidden') && a.offsetHeight > 0 && !document.getElementById('rc27Splash'); }, null, { timeout: 120000 });
    const ms = Date.now() - t0; const v = await vitals(page);
    return { ...v, loginVisibleMs: ms, requests: net.requests, kb: Math.round(net.bytes / 1024), tbtMs: 0 };
  }));
}
await browser.close(); closeServer();
console.table(results.map(r => ({ profile: r.profile.split(' ')[0], scenario: r.scenario, 'FCP ms': r.fcp, 'LCP ms': r.lcp, 'login visible ms': r.loginVisibleMs, 'READY (interactive) ms': r.readyMs ?? '', requests: r.requests, 'KB over wire': r.kb, 'TBT ms': r.tbtMs })));
const jp = process.argv.indexOf('--json'); if (jp > -1) fs.writeFileSync(process.argv[jp + 1], JSON.stringify(results, null, 1));
