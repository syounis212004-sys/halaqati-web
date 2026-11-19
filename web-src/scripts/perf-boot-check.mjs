/* Boot scripts: ~65 classic scripts must execute in EXACTLY the recorded order (they share globals), but must be FETCHED in parallel:
 * one round trip, not 65 (on a 150 ms network a serial chain costs ~10 s). Real Chromium, 150 ms RTT, no service worker.
 * Usage: node scripts/perf-boot-check.mjs   (serves ./dist, so run `npm run build` first) */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serveDist } from './_static-server.mjs';

const { base, close } = serveDist(+(process.env.PERF_PORT || 4183));
const expected = JSON.parse(fs.readFileSync(new URL('./fixtures/boot-script-order.json', import.meta.url), 'utf8'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
await ctx.route(/https:\/\//, r => r.abort());
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8, latency: 150 });
await page.addInitScript(() => { window.__order = []; new MutationObserver(m => { for (const x of m) for (const n of x.addedNodes) if (n.tagName === 'SCRIPT' && n.id) window.__order.push(n.id); }).observe(document, { childList: true, subtree: true }); });
/* scripts in flight at the same time: request start .. loading finished, only the app's own .js files under /assets and /core */
const live = new Map(); let inflight = 0, peak = 0;
cdp.on('Network.requestWillBeSent', e => { if (/127\.0\.0\.1.*\.js(\?|$)/.test(e.request.url) && e.type === 'Script') { live.set(e.requestId, 1); inflight++; peak = Math.max(peak, inflight); } });
const done = e => { if (live.delete(e.requestId)) inflight--; };
cdp.on('Network.loadingFinished', done); cdp.on('Network.loadingFailed', done);
await page.goto(base); await page.waitForFunction(() => window.__hmRender && !!window.HalaqatiCertificates, null, { timeout: 180000 });
const got = await page.evaluate(() => ({ ids: window.__order, hints: [...document.querySelectorAll('link[rel=preload][as=script]')].length }));
ok(JSON.stringify(got.ids) === JSON.stringify(expected), `scripts run in the recorded order (${got.ids.length} of ${expected.length}${JSON.stringify(got.ids) === JSON.stringify(expected) ? '' : '; first difference at ' + got.ids.findIndex((x, i) => x !== expected[i])})`);
ok(got.hints >= expected.length - 2, `every boot script has a preload hint (${got.hints} hints for ${expected.length} scripts)`);
ok(peak >= 20, `boot scripts are fetched in parallel (peak in flight: ${peak}, was 1 when loaded one after another)`);
await browser.close(); close();
console.log(fails ? `\n${fails} boot check(s) FAILED` : '\nBoot checks: all passed');
process.exit(fails ? 1 : 0);
