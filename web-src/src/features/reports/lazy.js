import { ensureLib } from '../../core/lazy-libs.js';

function wrap(name, libs) {
  const fn = window[name];
  if (typeof fn !== 'function' || fn.__halaqatiLazyWrapped) return;
  const wrapped = async function (...args) {
    for (const lib of libs) await ensureLib(lib);
    return fn.apply(this, args);
  };
  wrapped.__halaqatiLazyWrapped = true;
  window[name] = wrapped;
}

export function installReportLazyLoading() {
  wrap('exportReportsExcel', ['xlsx']);
  wrap('exportStudentsExcel', ['xlsx']);
  wrap('exportCurrentReportImage', ['html2canvas']);
  wrap('reportCanvas', ['html2canvas']);
  // v2.40.8 primary Chromium direct-save does not need jsPDF/html2canvas; compatibility fallback loads them lazily when required.
  wrap('downloadReportPdfFromPreview', []);
  // v2.11 maps this to preview. If an older branch still exports immediately,
  // the required libs are loaded before it runs.
  if (typeof window.exportCurrentReportPdf === 'function' && window.exportCurrentReportPdf !== window.openReportPreview) {
    wrap('exportCurrentReportPdf', []);
  }
}
