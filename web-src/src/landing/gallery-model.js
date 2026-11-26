/* Pure model for the screenshot gallery: which screens a role shows, hotspot geometry, responsive image sources.
   No DOM here, so node --test can exercise exactly what the build injects. */
import manifest from './shots-manifest.json' with { type: 'json' };
import webPins from './pins.json' with { type: 'json' };
import { SCREENS, ROLES, ANDROID_PINS } from './content.js';

export const MANIFEST = manifest.shots;
export const PINS = { ...webPins, ...ANDROID_PINS };
const BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s]));

export function screensFor(roleId, platform) {
  const role = ROLES.find((r) => r.id === roleId);
  return (role ? role.screens : []).map((id) => BY_ID[id]).filter((s) => s && s.platform === platform);
}

export function platformsFor(roleId) {
  return ['web', 'android'].filter((p) => screensFor(roleId, p).length > 0);
}

export const nextIndex = (i, n, step) => (((i + step) % n) + n) % n;

const clamp = (v) => Math.min(100, Math.max(0, Number(v) || 0));
export const pinStyle = (p) => `--x:${clamp(p.x)}%;--y:${clamp(p.y)}%`;

export const imgLoading = (isHero) => (isHero ? 'eager' : 'lazy');

export function shotFiles(id) {
  const m = MANIFEST[id];
  return m ? m.widths.flatMap((w) => ['avif', 'webp'].map((e) => `${id}-${w}.${e}`)) : [];
}

export function srcset(id, ext) {
  const m = MANIFEST[id];
  return m.widths.map((w) => `./landing/shots/${id}-${w}.${ext} ${w}w`).join(', ');
}

export const altFor = (s) => s.alt;
