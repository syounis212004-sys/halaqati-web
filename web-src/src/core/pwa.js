import { registerSW } from 'virtual:pwa-register';
import { createUpdateBanner } from './update-ui.js';

export function registerHalaqatiPwa() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { createUpdateBanner(updateSW); },
    onOfflineReady() { console.info('Halaqati core is ready offline'); },
    onRegisterError(error) { console.warn('Halaqati service worker registration failed', error); },
  });
}
