import { ensureLib, ensureForImport } from '../../core/lazy-libs.js';

function wrap(name, before) {
  const fn = window[name];
  if (typeof fn !== 'function' || fn.__halaqatiLazyWrapped) return;
  const wrapped = async function (...args) {
    await before(...args);
    return fn.apply(this, args);
  };
  wrapped.__halaqatiLazyWrapped = true;
  window[name] = wrapped;
}

export function installImportLazyLoading() {
  wrap('readImportFile', async (file) => ensureForImport(file));
  wrap('downloadImportTemplate', async () => ensureLib('xlsx'));
}
