/* DigitalKhatt mushaf browser checks (called from rc114-browser.mjs with its helpers). Real pack in dist/dk, mocked everything else. */
export async function dkChecks(h) {
  const { open, ok, eq, shot, mountMushaf } = h;
  const stageReady = (page) => page.waitForSelector('.hm-dk .hm-word', { timeout: 15000 });
  const wordBox = async (page, i) => { const b = await page.locator('.hm-dk .hm-word').nth(i).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const marksOf = (page) => page.evaluate(() => window.__mushafSession.getCounts().total);
  const tstate = (page) => page.evaluate(() => { const el = document.querySelector('.hm-dk'); return el ? { t: el.style.transform || '', o: el.style.opacity || '' } : null; });
  const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
  const sessionPage = (page) => page.evaluate(() => window.__mushafSession.getState().page);
  let ctx, page, errors, cdp;

  // ---- page 1: stage, ink, cartouche, attribution, word layer
  ({ ctx, page, errors } = await open(390, 'teacher')); await mountMushaf(page); await stageReady(page);
  ok(await page.evaluate(() => window.HalaqatiDk.enabled()), 'DK engine is enabled by default');
  const info = await page.evaluate(async () => {
    const d = await HalaqatiDk.pack.page(1), words = new Set(d.ids.filter((x) => !x.endsWith(':end')));
    const st = document.querySelector('.hm-dk').getBoundingClientRect(), host = document.querySelector('.hm-lines').getBoundingClientRect();
    return { words: words.size, dom: document.querySelectorAll('.hm-dk .hm-word').length, canvases: document.querySelectorAll('.hm-dk canvas').length, inside: st.width <= host.width + 1 && st.height <= host.height + 1, credit: document.querySelector('[data-credit]').textContent };
  });
  eq(info.dom, info.words, 'one hit box per word id on page 1'); eq(info.canvases, 2, 'two canvases (cartouche + ink)');
  ok(info.inside, 'the page fits its frame');
  ok(info.credit.includes('Amine Anane') && info.credit.includes('Tarteel') && info.credit.includes('DigitalKhatt') && info.credit.includes('Open Font License'), 'font and layout attribution is shown');
  const ink = await page.evaluate(() => { const px = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }; return { text: px(document.querySelector('.hm-dk-text')), bg: px(document.querySelector('.hm-dk-bg')) }; });
  ok(ink.text > 2000, 'the ink canvas has glyph pixels (' + ink.text + ')'); ok(ink.bg > 200, 'the cartouche canvas has pixels (' + ink.bg + ')');
  ok(await page.evaluate(() => !document.querySelector('.hm-dk .hm-word').textContent), 'the hit layer holds no Quran text');
  await shot(page, 'dk-page1-390');

  // ---- tools: tap, long press, keyboard, highlight, erase
  let b = await wordBox(page, 2); await page.mouse.click(b.x, b.y);
  eq((await marksOf(page)).mistakes, 1, 'tap marks a word'); eq(await page.locator('.hm-dk .hm-word.is-mistake').count(), 1, 'the mark is drawn on the word');
  await page.mouse.click(b.x, b.y); eq((await marksOf(page)).mistakes, 0, 'second tap removes it');
  b = await wordBox(page, 3); await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.waitForTimeout(650);
  ok(await page.locator('.hm-kinds').isVisible(), 'long press opens the kind menu'); await page.mouse.up();
  await page.locator('.hm-kinds button', { hasText: 'حركة' }).click();
  eq(await page.locator('.hm-dk .hm-word.is-harakah').count(), 1, 'long press marks the word as harakah');
  await page.click('[data-act="undo"]');
  await page.focus('.hm-dk .hm-word[tabindex="0"]'); await page.keyboard.press('Enter');
  eq((await marksOf(page)).mistakes, 1, 'keyboard Enter marks the focused word');
  await page.keyboard.press('ArrowLeft'); ok(await page.evaluate(() => document.activeElement.classList.contains('hm-word')), 'arrow keys keep the focus on a word');
  await page.keyboard.press('Control+z'); eq((await marksOf(page)).mistakes, 0, 'Ctrl+Z undoes');
  await page.click('[data-tool="highlight"]');
  const s0 = await wordBox(page, 1), s1 = await wordBox(page, 4);
  await page.mouse.move(s0.x, s0.y); await page.mouse.down(); await page.mouse.move((s0.x + s1.x) / 2, s0.y, { steps: 4 }); await page.mouse.move(s1.x, s1.y, { steps: 4 }); await page.mouse.up();
  ok(await page.locator('.hm-dk .hm-word.is-mistake').count() >= 4, 'drag highlights the span of words');
  await page.click('[data-tool="erase"]');
  await page.mouse.move(s0.x, s0.y); await page.mouse.down(); await page.mouse.move(s1.x, s1.y, { steps: 6 }); await page.mouse.up();
  eq(await page.locator('.hm-dk .hm-word.is-mistake').count(), 0, 'eraser drag clears the span');
  await page.click('[data-tool="tap"]');

  // ---- a mark survives a resize (relayout)
  b = await wordBox(page, 2); await page.mouse.click(b.x, b.y);
  await page.setViewportSize({ width: 700, height: 900 }); await page.waitForTimeout(600);
  eq(await page.locator('.hm-dk .hm-word.is-mistake').count(), 1, 'marks survive a resize');
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(500);

  // ---- Ctrl+wheel zoom and the reset button
  const box = await page.locator('.hm-lines').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -600); await page.keyboard.up('Control'); await page.waitForTimeout(200);
  let ts = await tstate(page); ok(/scale\(/.test(ts.t), 'Ctrl+wheel zooms (' + ts.t + ')'); ok(await page.isVisible('[data-act="zoomreset"]'), 'reset button appears when zoomed');
  await page.click('[data-act="zoomreset"]'); await page.waitForTimeout(200);
  eq((await tstate(page)).t, '', 'reset returns to 1x'); ok(!(await page.isVisible('[data-act="zoomreset"]')), 'reset button hides at 1x');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -4000); await page.keyboard.up('Control'); await page.waitForTimeout(150);
  ok(/scale\(4\)/.test((await tstate(page)).t), 'zoom stops at 4x'); await page.waitForTimeout(400); await shot(page, 'dk-zoom-390'); await page.click('[data-act="zoomreset"]');
  eq(errors, [], 'dk (mouse): no page errors'); await ctx.close();

  // ---- touch: tap, pinch, one-finger pan, swipe page turn
  ({ ctx, page, errors } = await open(390, 'teacher', { touch: true })); await mountMushaf(page); await stageReady(page);
  cdp = await ctx.newCDPSession(page);
  b = await wordBox(page, 2); await touch(cdp, 'touchStart', [b]); await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(200); eq((await marksOf(page)).mistakes, 1, 'touch tap marks a word');
  await page.click('[data-act="undo"]');
  const c = await page.locator('.hm-lines').boundingBox(), cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  await touch(cdp, 'touchStart', [{ x: cx - 40, y: cy }, { x: cx + 40, y: cy }]);
  for (let i = 1; i <= 8; i++) await touch(cdp, 'touchMove', [{ x: cx - 40 - i * 12, y: cy }, { x: cx + 40 + i * 12, y: cy }]);
  await touch(cdp, 'touchEnd', []); await page.waitForTimeout(250);
  ts = await tstate(page); const z = Number((/scale\(([\d.]+)\)/.exec(ts.t) || [])[1]);
  ok(z > 1.5 && z <= 4, 'two-finger pinch zooms (' + z + ')');
  const mk = await marksOf(page); eq(mk.mistakes + mk.prompts, 0, 'a pinch never marks a word');
  ok(await page.isVisible('[data-act="zoomreset"]'), 'reset button visible after the pinch');
  const before = ts.t;
  await touch(cdp, 'touchStart', [{ x: cx, y: cy }]);
  for (let i = 1; i <= 8; i++) await touch(cdp, 'touchMove', [{ x: cx + i * 10, y: cy + i * 4 }]);
  await touch(cdp, 'touchEnd', []); await page.waitForTimeout(200);
  ok((await tstate(page)).t !== before, 'one finger pans while zoomed'); eq((await marksOf(page)).mistakes, 0, 'panning never marks a word');
  await page.waitForTimeout(400); await shot(page, 'dk-pinch-390'); await page.click('[data-act="zoomreset"]'); await page.waitForTimeout(200);
  const p0 = await sessionPage(page);
  const seen = []; const poll = setInterval(() => page.evaluate(() => document.querySelectorAll('.hm-dk').length).then((n) => seen.push(n)).catch(() => {}), 25);
  await touch(cdp, 'touchStart', [{ x: c.x + 60, y: cy + 150 }]);
  for (let i = 1; i <= 8; i++) await touch(cdp, 'touchMove', [{ x: c.x + 60 + i * 20, y: cy + 150 }]);
  const mid = await tstate(page); await touch(cdp, 'touchEnd', []);
  await page.waitForFunction((p) => window.__mushafSession.getState().page !== p, p0, { timeout: 5000 }); await page.waitForTimeout(600); clearInterval(poll);
  eq(await sessionPage(page), p0 + 1, 'swipe right goes to the next page (RTL)');
  ok(mid && mid.o !== '' && Number(mid.o) < 1, 'the page fades while it is dragged (' + (mid && mid.o) + ')');
  ok(Math.max(0, ...seen) <= 1, 'two pages are never in the DOM together (max ' + Math.max(0, ...seen) + ')');
  eq((await marksOf(page)).mistakes, 0, 'swiping never marks a word');
  await touch(cdp, 'touchStart', [{ x: c.x + 300, y: cy + 150 }]);
  for (let i = 1; i <= 8; i++) await touch(cdp, 'touchMove', [{ x: c.x + 300 - i * 20, y: cy + 150 }]);
  await touch(cdp, 'touchEnd', []); await page.waitForTimeout(800);
  eq(await sessionPage(page), p0, 'swipe left goes back');
  await touch(cdp, 'touchStart', [{ x: c.x + 100, y: cy + 150 }]);
  for (let i = 1; i <= 3; i++) await touch(cdp, 'touchMove', [{ x: c.x + 100 + i * 6, y: cy + 150 }]);
  await touch(cdp, 'touchEnd', []); await page.waitForTimeout(600);
  eq(await sessionPage(page), p0, 'a short swipe springs back'); eq((await tstate(page)).t, '', 'and leaves no transform behind');
  eq(errors, [], 'dk (touch): no page errors'); await ctx.close();

  // ---- buttons: transform + opacity only; close; surah-start page
  ({ ctx, page, errors } = await open(390, 'teacher')); await mountMushaf(page); await stageReady(page);
  const props = page.evaluate(() => new Promise((res) => { const seenP = new Set(); const t0 = performance.now(); const tick = () => { document.querySelectorAll('.hm-dk').forEach((el) => el.getAnimations().forEach((a) => a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((n) => seenP.add(n))))); if (performance.now() - t0 < 900) requestAnimationFrame(tick); else res([...seenP]); }; tick(); }));
  await page.click('[data-act="next"]'); const seenProps = await props;
  ok(seenProps.length > 0 && seenProps.every((n) => ['opacity', 'transform', 'offset', 'easing', 'composite', 'computedOffset'].includes(n)), 'turn animation touches only opacity and transform (' + seenProps.join(',') + ')');
  eq(await sessionPage(page), 2, 'next button turns the page'); ok(/[2٢]/.test(await page.textContent('[data-pagecount]')), 'the counter follows the page');
  await page.click('[data-act="prev"]'); await page.waitForTimeout(700); eq(await sessionPage(page), 1, 'previous button turns back');
  eq((await tstate(page)).t, '', 'no transform is left on the settled page');
  await page.click('[data-act="next"]'); await page.waitForTimeout(700); await stageReady(page); await shot(page, 'dk-page2-surah-start-390');
  await page.click('[data-act="close"]'); ok(!(await page.evaluate(() => document.getElementById('mushafHost').open)), 'the close button closes the mushaf dialog');
  eq(errors, [], 'dk (buttons): no page errors'); await ctx.close();

  // ---- reduced motion: the page changes, nothing moves
  ({ ctx, page, errors } = await open(390, 'teacher', { reduced: true })); await mountMushaf(page); await stageReady(page);
  await page.click('[data-act="next"]'); await page.waitForTimeout(60);
  eq(await page.evaluate(() => [...document.querySelectorAll('.hm-dk')].reduce((n, el) => n + el.getAnimations().length, 0)), 0, 'reduced motion: no animation runs');
  await page.waitForFunction(() => window.__mushafSession.getState().page === 2); await stageReady(page);
  eq(errors, [], 'dk (reduced motion): no page errors'); await ctx.close();

  // ---- fallback to QCF: no pack, and the feature switch
  ({ ctx, page, errors } = await open(390, 'teacher', { blockDk: true })); await mountMushaf(page); await page.waitForSelector('.hm-error');
  eq(await page.evaluate(() => !!document.querySelector('.hm-dk')), false, 'without the pack the QCF mushaf takes over (no DK stage)');
  ok((await page.textContent('[data-credit]')).includes('Quran Foundation'), 'the QCF credit is shown on the fallback');
  eq(await page.evaluate(() => HalaqatiDk.pack.available()), false, 'pack availability reports false'); await ctx.close();
  ({ ctx, page } = await open(390, 'teacher')); await page.evaluate(() => localStorage.setItem('halaqati_mushaf_engine', 'qcf')); await mountMushaf(page); await page.waitForSelector('.hm-error');
  eq(await page.evaluate(() => !!document.querySelector('.hm-dk')), false, 'the feature switch forces the QCF mushaf'); await ctx.close();
}
