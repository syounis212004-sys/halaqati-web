import { registerSW } from 'virtual:pwa-register';
import { createUpdateBanner } from './update-ui.js';

/**
 * Auto-update: the new service worker is applied as soon as it is safe, with no manual cache clearing.
 * - the browser checks for a new version on start, every 10 minutes, when the tab becomes visible and when the network returns;
 * - when a new version is waiting it is applied immediately if nothing is being edited (no unsynced work, no open dialog,
 *   no focused field); otherwise the banner is shown and the update is retried every 30 s until it is safe;
 * - a one-minute guard prevents reload loops.
 */
const GUARD_KEY = 'halaqati_auto_update_at';

function safeToApply() {
  try {
    if (window.halaqatiHasPendingWork?.()) return false;
    if (document.querySelector('dialog[open]')) return false;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    return true;
  } catch (_e) { return true; }
}

export function registerHalaqatiPwa() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let registration = null;
  let retry = null;
  const check = () => { try { registration?.update(); } catch (_e) { /* offline */ } };

  const apply = () => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(GUARD_KEY) || 0); } catch (_e) { /* private mode */ }
    if (Date.now() - last < 60000) { createUpdateBanner(updateSW); return; }
    try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch (_e) { /* ignore */ }
    updateSW(true);
  };
  const tryApply = () => {
    if (safeToApply()) { clearInterval(retry); retry = null; apply(); return true; }
    return false;
  };

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg || null;
      if (registration) setInterval(check, 10 * 60 * 1000);
    },
    onNeedRefresh() {
      if (tryApply()) return;
      createUpdateBanner(updateSW);
      if (!retry) retry = setInterval(tryApply, 30000);
    },
    onOfflineReady() { console.info('Halaqati core is ready offline'); },
    onRegisterError(error) { console.warn('Halaqati service worker registration failed', error); },
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', check);
}
