/* Interactive mushaf: colour, touch-target, focus and motion rules, checked on the shipped CSS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../src/styles/native-mushaf.css', import.meta.url), 'utf8');

const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const block = sel => { const i = css.indexOf(sel + ' {'); assert.ok(i >= 0, 'missing block ' + sel); return css.slice(i, css.indexOf('}', i)); };
const token = (b, name) => { const m = new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})').exec(b); assert.ok(m, 'missing token ' + name); return m[1]; };

for (const [mode, sel] of [['light', '.hm-mushaf-root'], ['dark', 'body.dark .hm-mushaf-root']]) {
  test(`${mode} theme: text 4.5:1, mistake and prompt marks 3:1 against the page, and the two marks are told apart`, () => {
    const b = block(sel), bg = token(b, '--hm-page-bg'), ink = token(b, '--hm-page-ink'), mi = token(b, '--hm-mark-mistake'), pr = token(b, '--hm-mark-prompt');
    assert.ok(ratio(ink, bg) >= 4.5, `ink ${ratio(ink, bg).toFixed(2)}`);
    assert.ok(ratio(mi, bg) >= 3, `mistake ${ratio(mi, bg).toFixed(2)}`);
    assert.ok(ratio(pr, bg) >= 3, `prompt ${ratio(pr, bg).toFixed(2)}`);
    assert.notEqual(mi.toLowerCase(), pr.toLowerCase());
  });
}

test('colour is never the only cue: mistake = solid underline + × badge, prompt = dashed underline + ت badge', () => {
  assert.match(css, /\.hm-word\.is-mistake\s*\{[^}]*text-decoration-style:\s*solid/);
  assert.match(css, /\.hm-word\.is-prompt\s*\{[^}]*text-decoration-style:\s*dashed/);
  assert.match(css, /\.hm-word\.is-mistake::after\s*\{[^}]*content:\s*"×"/);
  assert.match(css, /\.hm-word\.is-prompt::after\s*\{[^}]*content:\s*"ت"/);
});

test('touch targets: tools and type buttons are at least 44px high, with a visible keyboard focus ring', () => {
  for (const sel of ['.hm-tool', '.hm-type', '.hm-pagebtn']) assert.match(block(sel), /min-height:\s*(4[4-9]|[5-9]\d)px/, sel);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px/);
});

test('motion: marks may fade in, but prefers-reduced-motion removes every transition and animation', () => {
  assert.match(css, /transition:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*transition:\s*none[\s\S]*animation:\s*none/);
});

test('the page keeps the printed proportions: 14:20 with a 15-row grid', () => {
  assert.match(block('.hm-page'), /aspect-ratio:\s*14\s*\/\s*20/);
  assert.match(css, /grid-template-rows:\s*repeat\(15,\s*1fr\)/);
});
