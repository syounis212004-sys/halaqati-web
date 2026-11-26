// Pinch zoom / pan maths and the page-turn style (ports of zoomPinch in MushafDkPage.kt and the graphicsLayer block in MushafScreen.kt).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Z from '../src/features/native/dk/dk-zoom.mjs';
import * as T from '../src/features/native/dk/dk-turn.mjs';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m}: ${a} vs ${b}`);
const size = { w: 400, h: 600 };

test('zoom is limited to 1x..4x', () => {
  assert.equal(Z.MIN_ZOOM, 1); assert.equal(Z.MAX_ZOOM, 4);
  assert.equal(Z.pinch({ zoom: 3, pan: { x: 0, y: 0 }, size, factor: 5, centroid: { x: 200, y: 300 }, delta: { x: 0, y: 0 } }).zoom, 4);
  assert.equal(Z.pinch({ zoom: 1, pan: { x: 0, y: 0 }, size, factor: 0.2, centroid: { x: 200, y: 300 }, delta: { x: 0, y: 0 } }).zoom, 1);
});

test('pinch about the centre keeps the pan at zero', () => {
  const r = Z.pinch({ zoom: 1, pan: { x: 0, y: 0 }, size, factor: 2, centroid: { x: 200, y: 300 }, delta: { x: 0, y: 0 } });
  near(r.zoom, 2, 'zoom'); near(r.pan.x, 0, 'pan x'); near(r.pan.y, 0, 'pan y');
});

test('pinch about a corner moves the page so the point under the fingers stays put, within the pan limits', () => {
  const r = Z.pinch({ zoom: 1, pan: { x: 0, y: 0 }, size, factor: 2, centroid: { x: 400, y: 600 }, delta: { x: 0, y: 0 } });
  // p1 = (c - centre) * (1 - z1/z0) = (200,300) * -1 = (-200,-300); limits are (z1-1)*size/2 = (200,300)
  near(r.pan.x, -200, 'pan x'); near(r.pan.y, -300, 'pan y');
});

test('pan is clamped so the page cannot leave the frame, and returns to zero at 1x', () => {
  const r = Z.pinch({ zoom: 2, pan: { x: 190, y: 0 }, size, factor: 1, centroid: null, delta: { x: 100, y: 0 } });
  near(r.pan.x, 200, 'clamped to (z-1)*w/2');
  const back = Z.pinch({ zoom: 1.2, pan: { x: 30, y: 20 }, size, factor: 0.5, centroid: null, delta: { x: 0, y: 0 } });
  assert.equal(back.zoom, 1); assert.deepEqual(back.pan, { x: 0, y: 0 });
});

test('a single finger pans only when zoomed, with the tap tool, after it moved past the slop', () => {
  const base = { zoom: 2, tapToolOnly: true, travelled: 20, slop: 8, fingers: 1 };
  assert.equal(Z.shouldPan(base), true);
  assert.equal(Z.shouldPan({ ...base, zoom: 1 }), false, 'not zoomed');
  assert.equal(Z.shouldPan({ ...base, zoom: 1.01 }), false, 'practically not zoomed');
  assert.equal(Z.shouldPan({ ...base, tapToolOnly: false }), false, 'highlight/erase keep their drag');
  assert.equal(Z.shouldPan({ ...base, travelled: 3 }), false, 'a tap or long press is not a pan');
  assert.equal(Z.shouldPan({ ...base, fingers: 2, zoom: 1, tapToolOnly: false, travelled: 0 }), true, 'two fingers always zoom');
});

test('twoFingers returns the zoom factor, centroid and pan delta between two pointer frames', () => {
  const prev = [{ x: 100, y: 100 }, { x: 200, y: 100 }], now = [{ x: 90, y: 100 }, { x: 230, y: 100 }];
  const r = Z.twoFingers(prev, now);
  near(r.factor, 140 / 100, 'factor');
  near(r.centroid.x, 150, 'previous centroid x'); near(r.centroid.y, 100, 'previous centroid y');
  near(r.delta.x, 160 - 150, 'centroid moved'); near(r.delta.y, 0, 'dy');
});

test('wheel with Ctrl zooms around the pointer; plain wheel does not', () => {
  assert.ok(Z.wheelFactor({ deltaY: -100, ctrlKey: true }) > 1);
  assert.ok(Z.wheelFactor({ deltaY: 100, ctrlKey: true }) < 1);
  assert.equal(Z.wheelFactor({ deltaY: -100, ctrlKey: false }), 1);
  assert.ok(Math.abs(Z.wheelFactor({ deltaY: -100, ctrlKey: true }) * Z.wheelFactor({ deltaY: 100, ctrlKey: true }) - 1) < 1e-9, 'symmetric');
});

// ---------- page turn ----------
test('turnStyle: the page in view is opaque and full size; a page a whole page away is invisible', () => {
  const s0 = T.turnStyle(0, 400, true, false);
  assert.deepEqual(s0, { opacity: 1, translateX: 0, scale: 1 });
  const s1 = T.turnStyle(1, 400, true, false);
  assert.equal(s1.opacity, 0);
});

test('turnStyle follows the swipe only part of the way and fades (formulas of MushafScreen.kt)', () => {
  const s = T.turnStyle(0.5, 400, true, false);
  near(s.opacity, 1.4 - 1.8 * 0.5, 'opacity');
  near(s.scale, 0.96 + 0.04 * 0.5, 'scale');
  near(Math.abs(s.translateX), 0.4 * 0.5 * 400, 'translate is 40 percent of the travelled distance');
});

test('turnStyle direction follows the layout direction (RTL and LTR move opposite ways)', () => {
  const rtl = T.turnStyle(0.5, 400, true, false), ltr = T.turnStyle(0.5, 400, false, false);
  assert.equal(Math.sign(rtl.translateX), -Math.sign(ltr.translateX));
});

test('reduced motion: no movement and no scale, the page swaps at half the distance', () => {
  for (const off of [0.2, 0.49]) assert.deepEqual(T.turnStyle(off, 400, true, true), { opacity: 1, translateX: 0, scale: 1 });
  for (const off of [0.5, 0.8, 1]) assert.deepEqual(T.turnStyle(off, 400, true, true), { opacity: 0, translateX: 0, scale: 1 });
});

test('swipeDirection: next for a rightward swipe in RTL, only for a clear horizontal swipe', () => {
  assert.equal(T.swipeDirection(120, 10, 60, true), 1);
  assert.equal(T.swipeDirection(-120, 10, 60, true), -1);
  assert.equal(T.swipeDirection(120, 10, 60, false), -1, 'LTR is mirrored');
  assert.equal(T.swipeDirection(40, 0, 60, true), 0, 'too short');
  assert.equal(T.swipeDirection(100, 90, 60, true), 0, 'mostly vertical');
});

test('turn keyframes: out fades toward the swipe, in comes from the other side, never both visible', () => {
  const k = T.turnKeyframes(1, 400, true, false);
  assert.equal(k.out[0].opacity, 1); assert.equal(k.out[1].opacity, 0);
  assert.equal(k.in[0].opacity, 0); assert.equal(k.in[1].opacity, 1);
  assert.equal(Math.sign(k.out[1].translateX), -Math.sign(k.in[0].translateX));
  assert.ok(Math.abs(k.out[1].translateX) <= 0.4 * 400 + 1e-9, 'partial travel only');
  const r = T.turnKeyframes(1, 400, true, true);
  assert.equal(r.out[1].translateX, 0); assert.equal(r.in[0].translateX, 0);
});

test('only transform and opacity are ever produced', () => {
  const s = T.turnStyle(0.3, 400, true, false);
  assert.deepEqual(Object.keys(s).sort(), ['opacity', 'scale', 'translateX']);
  assert.equal(T.toCss(s), `translate3d(${s.translateX}px,0,0) scale(${s.scale})`);
});
