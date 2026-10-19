import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const core=read('src/core/runtime.js');
const reports=read('src/features/reports/runtime.js');
assert.ok(['2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version));
assert.ok(core.includes(`APP_VERSION_NAME='${pkg.version}'`)&&core.includes(pkg.version==='2.41.2'?'APP_VERSION_CODE=24102':pkg.version==='2.41.1'?'APP_VERSION_CODE=24101':['2.40.8','2.41.1','2.41.2'].includes(pkg.version)?'APP_VERSION_CODE=24008':pkg.version==='2.40.6'?'APP_VERSION_CODE=24006':pkg.version==='2.40.4'?'APP_VERSION_CODE=24004':'APP_VERSION_CODE=24002'));
assert.ok(reports.includes('applyAutoFitPdfTables')&&reports.includes('pdfColumnWeights(table,head,kinds)'),'v2.40.2 auto-fit baseline must remain');
if(pkg.version==='2.40.2'){
  assert.ok(reports.includes('PDF_NATIVE_TILE_MAX_PIXELS=1_500_000')&&reports.includes('addPdfSegmentTiled'),'v2.40.2 memory-safe raster baseline missing');
}else{
  const vector=read('src/features/reports/vector-pdf-runtime.js');
  const java=read('plugins/halaqati-pdf/android/src/main/java/com/mohammedsamir/halaqati/pdf/HalaqatiPdfPlugin.java');
  assert.ok(vector.includes('buildVectorHtml')&&!/new\s+jsPDF|html2canvas/.test(vector),'v2.40.4+ must replace raster PDF export');
  assert.ok(
    java.includes('createPrintDocumentAdapter') &&
    java.includes('PrintManager') &&
    java.includes('printManager.print') &&
    java.includes('PrintAttributes.MediaSize.ISO_A4'),
    'v2.40.4+ Android Chromium vector PDF Public API plugin missing'
  );
  assert.ok(
    !/new\s+PrintDocumentAdapter\.(LayoutResultCallback|WriteResultCallback)/.test(java),
    'v2.40.4+ must not instantiate hidden PrintDocumentAdapter callbacks'
  );
}
for(const file of [
  'plugins/halaqati-updater/android/src/main/java/com/mohammedsamir/halaqati/updater/HalaqatiUpdaterPlugin.java',
  'plugins/halaqati-updater/android/src/main/java/com/mohammedsamir/halaqati/updater/HalaqatiUpdateFileProvider.java',
  'plugins/halaqati-deeplink/android/src/main/java/com/mohammedsamir/halaqati/deeplink/HalaqatiDeepLinkPlugin.java'
]) assert.ok(fs.existsSync(file)&&fs.statSync(file).size>100,`native plugin missing: ${file}`);
console.log('HALAQATI_V2402_COMPATIBILITY_CHECK_PASS');
