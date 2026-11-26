import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATURES, ROLES, FAQ, STEPS } from '../src/landing/content.js';
import { landingHtml, faqJsonLd, appJsonLd } from '../src/landing/markup.js';

const html = landingHtml({ version: '9.9.9' });
const root = new URL('../', import.meta.url);

test('every advertised feature is backed by an existing source file', () => {
  for (const f of FEATURES) assert.ok(fs.existsSync(new URL(f.proof, root)), `${f.id} -> ${f.proof}`);
});

test('all twelve requested feature areas are present', () => {
  const ids = FEATURES.map((f) => f.id).sort();
  assert.deepEqual(ids, ['attendance', 'certificates', 'contests', 'guardians', 'halaqas', 'mushaf', 'permissions', 'plans', 'recitation', 'reports', 'sponsorship', 'students']);
});

test('the five roles exist and each explains why the role needs the app', () => {
  assert.deepEqual(ROLES.map((r) => r.id), ['admin', 'teacher', 'supervisor', 'guardian', 'donor']);
  ROLES.forEach((r) => assert.equal(r.needs.length, 4));
});

test('APK link is the root-level latest file and matches version.json', () => {
  const v = JSON.parse(fs.readFileSync(new URL('../version.json', root), 'utf8'));
  assert.ok(v.apkUrl.endsWith('/Halaqati-latest.apk'));
  assert.ok(fs.existsSync(new URL('../Halaqati-latest.apk', root)));
  assert.match(html, /href="\.\/Halaqati-latest\.apk" download/);
});

test('every in-page anchor has a target and ids are unique', () => {
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const [, h] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(h), 'dead anchor #' + h);
});

test('no landing id collides with the application DOM', () => {
  const app = fs.readFileSync(new URL('index.html', root), 'utf8');
  const appIds = new Set([...app.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, id] of html.matchAll(/ id="([^"]+)"/g)) assert.ok(!appIds.has(id), 'collides: ' + id);
});

test('semantic structure: one h1, one main, labelled sections, FAQ as details', () => {
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.equal((html.match(/<main[ >]/g) || []).length, 1);
  assert.equal((html.match(/<details/g) || []).length, FAQ.length);
  assert.ok(STEPS.length >= 5);
});

test('no Quranic verse text is written in the landing code or copy', () => {
  const files = ['content.js', 'markup.js', 'demo.js', 'index.js'].map((f) => fs.readFileSync(new URL('../src/landing/' + f, import.meta.url), 'utf8')).join('\n');
  assert.ok(!/بسم الله الرحمن|الحمد لله رب العالمين|قل هو الله|ذلك الكتاب|[ۖۗۘۙۚۛۜ۞﴾﴿]/.test(files));
});

test('structured data is valid JSON-LD for FAQ and application', () => {
  const faq = faqJsonLd(), app = appJsonLd('1.0');
  assert.equal(faq['@type'], 'FAQPage');
  assert.equal(faq.mainEntity.length, FAQ.length);
  assert.equal(app['@type'], 'SoftwareApplication');
  assert.ok(!('aggregateRating' in app) && !('offers' in app), 'no invented ratings or prices');
  JSON.parse(JSON.stringify([faq, app]));
});

test('the landing is wired through the entry point without touching main.js', () => {
  const entry = fs.readFileSync(new URL('src/entry.js', root), 'utf8');
  const index = fs.readFileSync(new URL('index.html', root), 'utf8');
  assert.match(index, /src="\/src\/entry\.js"/);
  assert.match(entry, /import\('\.\/main\.js'\)/);
  assert.match(entry, /import\('\.\/landing\/index\.js'\)/);
  assert.ok(!/landing/.test(fs.readFileSync(new URL('src/main.js', root), 'utf8')), 'main.js must stay landing-free');
});
