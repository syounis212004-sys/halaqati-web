import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowLanding } from '../src/landing/gate.js';

const visitor = { search: '', hash: '', storageKeys: [], native: false, standalone: false, webdriver: false };
const run = (o = {}) => shouldShowLanding({ ...visitor, ...o });

test('anonymous first-time visitor sees the landing page', () => assert.equal(run(), true));
test('cached offline identity goes straight to the app', () => assert.equal(run({ storageKeys: ['halaqati_v24_last_auth'] }), false));
test('supabase session token goes straight to the app', () => assert.equal(run({ storageKeys: ['x', 'sb-abcdef-auth-token'] }), false));
test('unrelated storage keys do not hide the landing page', () => assert.equal(run({ storageKeys: ['halaqati_theme_v4', 'sb-abc-other'] }), true));
test('login deep links skip the landing page', () => {
  assert.equal(run({ hash: '#login' }), false);
  assert.equal(run({ search: '?app=1' }), false);
});
test('password recovery and OAuth returns skip the landing page', () => {
  assert.equal(run({ hash: '#access_token=a&type=recovery' }), false);
  assert.equal(run({ search: '?type=recovery' }), false);
  assert.equal(run({ search: '?code=abc123' }), false);
  assert.equal(run({ hash: '#access_token=a&refresh_token=b' }), false);
  assert.equal(run({ search: '?error_description=denied' }), false);
});
test('native Capacitor shell and installed PWA skip the landing page', () => {
  assert.equal(run({ native: true }), false);
  assert.equal(run({ standalone: true }), false);
});
test('automation skips the landing page unless it is forced', () => {
  assert.equal(run({ webdriver: true }), false);
  assert.equal(run({ webdriver: true, search: '?landing=1' }), true);
});
test('?landing=1 never overrides a real session or a recovery link', () => {
  assert.equal(run({ search: '?landing=1', storageKeys: ['halaqati_v24_last_auth'] }), false);
  assert.equal(run({ search: '?landing=1&type=recovery' }), false);
});
