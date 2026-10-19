import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const core=read('src/core/runtime.js');
const reports=read('src/features/reports/runtime.js');
assert.ok(['2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version));
assert.ok(core.includes(`APP_VERSION_NAME='${pkg.version}'`)&&core.includes(pkg.version==='2.41.2'?'APP_VERSION_CODE=24102':pkg.version==='2.41.1'?'APP_VERSION_CODE=24101':['2.40.8','2.41.1','2.41.2'].includes(pkg.version)?'APP_VERSION_CODE=24008':pkg.version==='2.40.6'?'APP_VERSION_CODE=24006':pkg.version==='2.40.4'?'APP_VERSION_CODE=24004':pkg.version==='2.40.2'?'APP_VERSION_CODE=24002':'APP_VERSION_CODE=24001'));
assert.ok(reports.includes("#reportPreviewPaper .pro-table-wrap{width:100%!important;min-width:0!important;max-width:100%!important"),'PDF table wrapper must stay inside page width');
assert.ok(reports.includes('table-layout:fixed!important'),'PDF tables must use fixed layout for deterministic A4 containment');
assert.ok(!reports.includes('.pro-table-wrap{width:max-content!important'),'max-content table wrapper must not return');
assert.ok(reports.includes("colgroup.dataset.hfAutofit='1'")&&reports.includes('pdfColumnWeights(table,head,kinds)'),'dynamic PDF colgroup auto-fit is required');
assert.ok(reports.includes("cell.style.whiteSpace='nowrap'")&&reports.includes('shrinkPdfNameCells(table)'),'student names must remain single-line with safe shrink-to-fit');
assert.ok(reports.includes('applyAutoFitPdfTables(element)')&&reports.includes('metrics.width'),'PDF renderer must capture explicit fitted page bounds');
if(!['2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version)){
  assert.ok(reports.includes("const PDF_PNG_COMPRESSION='NONE'"),'HQ report PDF must not use FAST image compression');
  assert.ok(reports.includes("canvas.toBlob")&&reports.includes("pdf.addImage(pngBytes,'PNG'"),'report PDF must remain lossless PNG without base64 canvas duplication');
}else{
  const vector=read('src/features/reports/vector-pdf-runtime.js');
  assert.ok(vector.includes('table-header-group')&&vector.includes('break-inside:avoid'),'vector PDF must preserve auto-fit/page-break behavior');
}
for(const file of [
  'plugins/halaqati-updater/android/src/main/java/com/mohammedsamir/halaqati/updater/HalaqatiUpdaterPlugin.java',
  'plugins/halaqati-updater/android/src/main/java/com/mohammedsamir/halaqati/updater/HalaqatiUpdateFileProvider.java',
  'plugins/halaqati-deeplink/android/src/main/java/com/mohammedsamir/halaqati/deeplink/HalaqatiDeepLinkPlugin.java'
]) assert.ok(fs.existsSync(file)&&fs.statSync(file).size>100,`native plugin missing: ${file}`);
console.log('HALAQATI_V2401_PDF_AUTOFIT_CHECK_PASS');
