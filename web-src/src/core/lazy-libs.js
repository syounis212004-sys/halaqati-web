import { loadClassicScript } from './script-loader.js';

const base = import.meta.env.BASE_URL;
const url = (name) => `${base}vendor/${name}`;

const defs = {
  xlsx: { test: () => !!window.XLSX, file: 'xlsx-0.18.5.min.js' },
  html2canvas: { test: () => !!window.html2canvas, file: 'html2canvas-1.4.1.min.js' },
  jspdf: { test: () => !!window.jspdf?.jsPDF, file: 'jspdf-2.5.1.umd.min.js' },
  mammoth: { test: () => !!window.mammoth, file: 'mammoth-1.8.0.browser.min.js' },
  pdfjs: { test: () => !!window.pdfjsLib, file: 'pdfjs-3.11.174.min.js' },
  tesseract: { test: () => !!window.Tesseract, file: 'tesseract-5.min.js' },
};

const inflight = new Map();

export async function ensureLib(name) {
  const d = defs[name];
  if (!d) throw new Error(`Unknown lazy library: ${name}`);
  if (d.test()) return;
  if (!inflight.has(name)) {
    inflight.set(name, loadClassicScript(url(d.file), { id: `halaqati-lib-${name}` })
      .then(() => {
        if (!d.test()) throw new Error(`لم تتهيأ مكتبة ${name} بعد التحميل`);
        if (name === 'pdfjs' && window.pdfjsLib?.GlobalWorkerOptions) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = url('pdfjs-3.11.174.worker.min.js');
        }
      }));
  }
  return inflight.get(name);
}

export async function ensureForImport(file) {
  const ext = String(file?.name || '').split('.').pop().toLowerCase();
  if (['xlsx','xls','csv'].includes(ext)) return ensureLib('xlsx');
  if (ext === 'docx') return ensureLib('mammoth');
  if (ext === 'pdf') return ensureLib('pdfjs');
  if (String(file?.type || '').startsWith('image/')) return ensureLib('tesseract');
}

window.HalaqatiLazy = { ensureLib, ensureForImport };
