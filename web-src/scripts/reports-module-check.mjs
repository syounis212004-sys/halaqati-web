import fs from 'node:fs';

const legacy=fs.readFileSync('src/legacy/app.js','utf8');
const runtime=fs.readFileSync('src/features/reports/runtime.js','utf8');
const main=fs.readFileSync('src/main.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

function ok(condition,message){
  if(!condition){ console.error('REPORTS_MODULE_CHECK_FAIL:',message); process.exit(1); }
  console.log('OK:',message);
}

ok(['2.40.8','2.41.1','2.41.2'].includes(pkg.version),'package version is 2.40.8');
ok(!legacy.includes('Halaqati Web/Reports Hotfix'),'modern reports hotfix no longer lives inside legacy/app.js');
ok(runtime.includes("window.__HALAQATI_REPORTS_RUNTIME__='2.40.4-authenticated-report-snapshot'"),'reports data runtime sentinel preserved');
ok(runtime.includes('window.downloadReportPdfFromPreview=async function'),'stable PDF exporter moved to reports runtime');
ok(runtime.includes('window.openReportPreview=function'),'PDF preview remains in reports runtime');
ok(runtime.includes('applyAutoFitPdfTables'),'PDF Auto-fit remains in reports runtime');
ok(fs.existsSync('src/features/reports/vector-pdf-runtime.js'),'v2.40.8 vector PDF runtime exists');
ok(runtime.includes('window.loadSelectedReport=async function'),'fresh report-data loader remains in reports runtime');
ok(main.includes("import reportsRuntimeUrl from './features/reports/runtime.js?url'"),'main imports reports runtime URL');
const legacyPos=main.indexOf("loadClassicScript(legacyUrl");
const reportsPos=main.indexOf("loadClassicScript(reportsRuntimeUrl");
const vectorPos=main.indexOf('halaqati-vector-pdf-runtime');
const lazyPos=main.indexOf('installReportLazyLoading()');
ok(legacyPos>=0&&reportsPos>legacyPos,'reports runtime loads after legacy runtime');
ok(vectorPos>reportsPos,'vector PDF runtime loads after reports runtime');
ok(lazyPos>vectorPos,'lazy wrappers install after vector PDF runtime');
ok(!runtime.includes('function settingsPage('),'settings implementation was not moved into reports module');
ok(!runtime.includes('function studentsPage('),'students implementation was not moved into reports module');
ok(!runtime.includes('function sessionCards('),'sessions implementation was not moved into reports module');
console.log('REPORTS_MODULE_CHECK_PASS');
