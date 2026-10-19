import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const gradlePath = path.join(root, 'plugins', 'halaqati-pdf', 'android', 'build.gradle');
const javaPath = path.join(root, 'plugins', 'halaqati-pdf', 'android', 'src', 'main', 'java', 'com', 'mohammedsamir', 'halaqati', 'pdf', 'HalaqatiPdfPlugin.java');

function mustFile(p, label) {
  if (!fs.existsSync(p) || fs.statSync(p).size === 0) throw new Error(`${label} missing/empty: ${p}`);
}
function mustInclude(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing: ${needle}`);
}
function mustNotInclude(text, needle, label) {
  if (text.includes(needle)) throw new Error(`${label} must not contain: ${needle}`);
}

mustFile(gradlePath, 'HalaqatiPdf build.gradle');
mustFile(javaPath, 'HalaqatiPdfPlugin.java');
const gradle = fs.readFileSync(gradlePath, 'utf8');
const java = fs.readFileSync(javaPath, 'utf8');

mustInclude(gradle, 'androidx.appcompat:appcompat', 'Capacitor 8 compile classpath');
mustInclude(gradle, 'androidxAppCompatVersion', 'Capacitor 8 AppCompat version wiring');
mustInclude(gradle, 'androidx.core:core', 'AndroidX Core compile classpath');
mustInclude(gradle, 'JavaVersion.VERSION_21', 'Java 21 compatibility');
mustInclude(java, 'createPrintDocumentAdapter', 'Chromium vector print adapter');
mustInclude(java, 'PrintManager', 'Android public PrintManager');
mustInclude(java, 'printManager.print', 'Android public print invocation');
mustInclude(java, "document.fonts.status==='loaded'", 'font readiness wait');
mustNotInclude(java, 'LayoutResultCallback', 'public API safety');
mustNotInclude(java, 'WriteResultCallback', 'public API safety');
mustNotInclude(java, 'html2canvas', 'vector-only PDF path');

console.log('HALAQATI_V2403_FIX6_PREFLIGHT_PASS');
console.log(`root=${root}`);
console.log('HalaqatiPdf: AppCompat/Core classpath + Java21 + Chromium PrintManager public API ✅');
