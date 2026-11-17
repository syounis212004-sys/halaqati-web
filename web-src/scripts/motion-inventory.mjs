/* Interactive-element inventory: walks every page of every role (injected test profile, no network) and classifies what a person can
   touch, so motion coverage is measured instead of guessed. Output: .artifacts/inventory.json + a summary table on stdout. */
import { openApp } from './motion-record.mjs';
import fs from 'node:fs';

const ROLES = ['admin', 'supervisor', 'teacher', 'guardian', 'observer'];
const VIEWPORTS = [{ n: 'm390', width: 390, height: 844 }, { n: 'd1440', width: 1440, height: 900 }];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const classify = () => {
  const out = [];
  const seen = new Set();
  const sel = 'button,a[href],a[onclick],input,select,textarea,summary,[onclick],[role=button],[role=tab],[role=switch],[role=menuitem],[tabindex="0"],dialog';
  document.querySelectorAll(sel).forEach(el => {
    if (seen.has(el)) return; seen.add(el);
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase(), cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className);
    const type = (el.getAttribute('type') || '').toLowerCase(), role = el.getAttribute('role') || '';
    const text = (el.textContent || '').trim(), onlyIcon = el.querySelector('svg') && text.length <= 2;
    let kind = 'other';
    if (tag === 'dialog') kind = 'dialog';
    else if (tag === 'input' && ['checkbox'].includes(type)) kind = 'checkbox';
    else if (tag === 'input' && type === 'radio') kind = 'radio';
    else if (tag === 'input' && ['text', 'search', 'email', 'tel', 'number', 'password', 'url', 'date', 'time', ''].includes(type)) kind = type === 'password' ? 'password-field' : 'text-field';
    else if (tag === 'input') kind = 'input-' + (type || 'text');
    else if (tag === 'textarea') kind = 'text-field';
    else if (tag === 'select') kind = 'select';
    else if (tag === 'summary') kind = 'accordion';
    else if (role === 'tab' || /(^|[\s-])(tab|seg|segment)/.test(cls)) kind = 'tab/segment';
    else if (role === 'switch' || /switch|toggle/.test(cls)) kind = 'switch';
    else if (/(^|\s)(nx-chip|chip|pill)/.test(cls)) kind = 'chip';
    else if (/mobile-nav|(^|\s)nav\b|nav-item/.test(cls) || el.closest('#mobileNav,#nav')) kind = 'navigation';
    else if (/menu-btn|nx-menu|kebab|more/.test(cls)) kind = 'menu-trigger';
    else if (/fab/.test(cls)) kind = 'fab';
    else if ((tag === 'button' || role === 'button') && onlyIcon) kind = 'icon-button';
    else if (tag === 'button' && /danger|delete|remove|red/.test(cls)) kind = 'button-danger';
    else if (tag === 'button' && /primary|filled|btn-primary|nx-btn(?!\S*(outlined|text|soft))/.test(cls)) kind = 'button-primary';
    else if (tag === 'button') kind = 'button-secondary';
    else if (tag === 'a') kind = 'link';
    else if (/card|row|item|tile/.test(cls)) kind = 'card/row (clickable)';
    const dur = cs.transitionDuration.split(',').map(s => parseFloat(s) * (s.includes('ms') ? 1 : 1000));
    const props = cs.transitionProperty;
    const hasTransition = dur.some(d => d > 0) && !/^none$/.test(props);
    out.push({ kind, tag, sig: tag + '.' + cls.split(/\s+/).filter(Boolean).slice(0, 2).join('.'), visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', hasTransition, props: props.slice(0, 60), hasSvg: !!el.querySelector('svg') });
  });
  return out;
};

const all = [];
for (const vp of VIEWPORTS) for (const role of ROLES) {
  const { context, page, errors } = await openApp({ ...vp, role });
  const pages = await page.evaluate(() => { try { return navItems().map(x => x[0]).filter(p => p && p !== 'more'); } catch (e) { return ['home']; } });
  const uniq = [...new Set([...pages, 'home', 'settings', 'notifications'])];
  for (const p of uniq) {
    await page.evaluate(p => go(p), p); await sleep(900);
    const items = await page.evaluate(classify);
    all.push({ vp: vp.n, role, page: p, items });
  }
  if (errors.length) console.log('pageerror', role, vp.n, errors.slice(0, 2));
  await context.close();
}
fs.mkdirSync('.artifacts', { recursive: true });
fs.writeFileSync('.artifacts/inventory.json', JSON.stringify(all));

/* summary */
const byKind = {}; let total = 0, totalVis = 0;
const sigs = new Map();
for (const e of all) for (const it of e.items) {
  total++; if (it.visible) totalVis++;
  const k = byKind[it.kind] ||= { n: 0, vis: 0, trans: 0, svg: 0 };
  k.n++; if (it.visible) k.vis++; if (it.hasTransition) k.trans++; if (it.hasSvg) k.svg++;
  const s = it.kind + ' ' + it.sig; const c = sigs.get(s) || { n: 0, trans: 0 }; c.n++; if (it.hasTransition) c.trans++; sigs.set(s, c);
}
console.log(`pages walked: ${all.length} (${ROLES.length} roles x ${VIEWPORTS.length} viewports); element instances: ${total} (${totalVis} visible); distinct component signatures: ${sigs.size}`);
console.log('kind'.padEnd(24) + 'count'.padStart(7) + 'visible'.padStart(9) + 'withTransition'.padStart(16) + 'withSVG'.padStart(9));
Object.entries(byKind).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(k.padEnd(24) + String(v.n).padStart(7) + String(v.vis).padStart(9) + (Math.round(100 * v.trans / v.n) + '%').padStart(16) + String(v.svg).padStart(9)));
const lacking = [...sigs.entries()].filter(([, v]) => v.trans === 0).sort((a, b) => b[1].n - a[1].n).slice(0, 25);
console.log('\nmost frequent component signatures with NO state transition at all:');
lacking.forEach(([s, v]) => console.log(String(v.n).padStart(6) + '  ' + s));
process.exit(0);
