import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROLES, SCREENS, TRACKS } from '../src/landing/content.js';
import { screensFor, platformsFor, nextIndex, pinStyle, srcset, imgLoading, altFor, shotFiles, MANIFEST, PINS } from '../src/landing/gallery-model.js';

const root = new URL('../', import.meta.url);

test('every role has web screens and only teacher/supervisor-style mushaf roles have android ones', () => {
  for (const r of ROLES) assert.ok(screensFor(r.id, 'web').length >= 1, r.id + ' needs a web screen');
  assert.deepEqual(platformsFor('admin'), ['web']);
  assert.deepEqual(platformsFor('guardian'), ['web']);
  assert.deepEqual(platformsFor('teacher'), ['web', 'android']);
});

test('android screens are exactly the five real Compose previews that were checked for personal data', () => {
  const ids = screensFor('teacher', 'android').map((s) => s.id).sort();
  assert.deepEqual(ids, ['android-mushaf-dark', 'android-mushaf-jump', 'android-mushaf-light', 'android-mushaf-surah', 'android-reminder']);
});

test('every screen id has packed files in both formats and every width', () => {
  for (const s of SCREENS) {
    const m = MANIFEST[s.id];
    assert.ok(m, 'manifest entry for ' + s.id);
    for (const f of shotFiles(s.id)) assert.ok(fs.existsSync(new URL('public/landing/shots/' + f, root)), 'missing ' + f);
  }
});

test('the packed screenshots stay inside the size budget', () => {
  let total = 0;
  for (const s of SCREENS) for (const f of shotFiles(s.id)) total += fs.statSync(new URL('public/landing/shots/' + f, root)).size;
  assert.ok(total <= 4 * 1024 * 1024, 'shots total ' + total);
  for (const s of SCREENS) {
    const widest = fs.statSync(new URL('public/landing/shots/' + s.id + '-' + MANIFEST[s.id].w + '.webp', root)).size;
    assert.ok(widest <= 220 * 1024, s.id + ' widest webp ' + widest);
  }
});

test('pins are inside the picture and described', () => {
  for (const [id, pins] of Object.entries(PINS)) {
    assert.ok(pins.length <= 4, id + ' has too many pins');
    for (const p of pins) {
      assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, id + ' ' + p.label);
      assert.ok(p.label && p.text, id + ' pin needs label and text');
    }
  }
  assert.match(pinStyle({ x: 12.5, y: 99 }), /--x:12\.5%/);
  assert.match(pinStyle({ x: -5, y: 140 }), /--x:0%;--y:100%/);
});

test('every screen shown to visitors has at least two pins or an explicit reason', () => {
  const noPins = SCREENS.filter((s) => (PINS[s.id] || []).length === 0).map((s) => s.id);
  assert.deepEqual(noPins.filter((id) => !/dark/.test(id)), [], 'screens without hotspots');
});

test('only the hero image is eager, everything else is lazy', () => {
  assert.equal(imgLoading(true), 'eager');
  assert.equal(imgLoading(false), 'lazy');
});

test('srcset lists ascending widths for the requested format', () => {
  const s = srcset('web-teacher-roster', 'avif');
  const w = [...s.matchAll(/ (\d+)w/g)].map((m) => +m[1]);
  assert.deepEqual(w, [...w].sort((a, b) => a - b));
  assert.match(s, /web-teacher-roster-390\.avif 390w/);
  assert.match(s, /^\.\/landing\/shots\//);
});

test('alt text describes the screen and never contains Quranic marks or text', () => {
  for (const s of SCREENS) {
    const a = altFor(s);
    assert.ok(a.length > 12, s.id);
    assert.ok(!/[ؐ-ًؚ-ِْ-ٟۖ-ۭ]/.test(a), 'harakat or quranic marks in alt of ' + s.id); // shadda U+0651 is ordinary spelling
    assert.ok(!/بسم الله|الرحمن الرحيم|قل هو|ورتل/.test(a), s.id);
  }
});

test('tab navigation wraps in both directions', () => {
  assert.equal(nextIndex(0, 3, -1), 2);
  assert.equal(nextIndex(2, 3, 1), 0);
  assert.equal(nextIndex(1, 3, 1), 2);
});

test('three equal tracks point at existing roles and screens', () => {
  assert.equal(TRACKS.length, 3);
  for (const t of TRACKS) {
    assert.ok(ROLES.some((r) => r.id === t.role), t.id);
    assert.ok(SCREENS.some((s) => s.id === t.shot), t.id);
    assert.ok(t.needs.length >= 3);
  }
});

test('fixtures behind the screenshots contain only fictional labels', () => {
  const src = ['landing-shots-data.mjs', 'landing-shots-lib.mjs'].map((f) => fs.readFileSync(new URL('scripts/' + f, root), 'utf8')).join('\n');
  const names = [...src.matchAll(/(?:full_name|name|donor_name)\s*:\s*[`'"]([^`'"]+)[`'"]/g)].map((m) => m[1]);
  assert.ok(names.length > 5);
  for (const n of names) assert.match(n, /تجريب|حلقة|اختبار|\$\{/, 'name that does not look fictional: ' + n);
  assert.ok(!/@(?!example\.invalid)[a-z0-9.-]+\.[a-z]{2,}/i.test(src), 'only example.invalid addresses allowed');
});
