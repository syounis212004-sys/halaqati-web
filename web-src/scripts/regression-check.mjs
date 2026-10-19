import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const legacy=read('src/legacy/app.js'),core=read('src/core/runtime.js'),nav=read('src/core/navigation.js'),auth=read('src/features/auth/runtime.js'),students=read('src/features/students/runtime.js'),sessions=read('src/features/sessions/runtime.js'),settings=read('src/features/settings/runtime.js'),reports=read('src/features/reports/runtime.js'),vector=read('src/features/reports/vector-pdf-runtime.js'),main=read('src/main.js');
const s=[legacy,core,nav,auth,students,sessions,settings,reports,vector].join('\n');
const required=['function settingsPage()','function getThemePrefs()','function applySavedTheme()','function studentDirectoryRows()','async function exportStudentsExcel()','async function exportStudentsWord()','window.openStudentsPdfPreview=function()','window.openReportPreview=function()','applyAutoFitPdfTables','window.downloadReportPdfFromPreview=async function()','window.printReportPdfFromPreview=async function()'];
for(const token of required){if(!s.includes(token)){console.error('MISSING:',token);process.exit(1)}}
if(!['2.40.8','2.41.1','2.41.2'].includes(pkg.version)||!core.includes(`const APP_VERSION_NAME='${pkg.version}';`)||!core.includes(pkg.version==='2.41.2'?'const APP_VERSION_CODE=24102;':pkg.version==='2.41.1'?'const APP_VERSION_CODE=24101;':'const APP_VERSION_CODE=24008;')){console.error('Version mismatch');process.exit(1)}
if(!main.includes('halaqati-vector-pdf-runtime')){console.error('PDF runtime not loaded');process.exit(1)}
for(const token of ['HalaqatiPdf','@page','buildVectorHtml','nativeSaveHtmlPdf','saveHtmlPdf','compatibilityRasterExport','hf-preview-save-status','cairo-pdf.ttf'])if(!vector.includes(token)){console.error('PDF regression:',token);process.exit(1)}
if(vector.includes('html2canvas')){console.error('Page-raster html2canvas leaked into v2.40.8 direct vector export');process.exit(1)}
if(!reports.includes("paper.dataset.orientation=orientation.value")||!reports.includes("paper.style.fontFamily=font.value+', sans-serif'")||!reports.includes('paper.style.color=textColor.value')||!reports.includes('el.style.color=accent.value')||!reports.includes('contenteditable="true"')||!reports.includes('id="hfPrintPdf"')){console.error('PDF preview controls regression');process.exit(1)}
const dataStart=legacy.indexOf('function dataPage(){'),dataEnd=legacy.indexOf('\n',dataStart),dataBlock=legacy.slice(dataStart,dataEnd);
if(dataBlock.includes('exportReportsExcel()')||!dataBlock.includes('exportStudentsExcel()')||!dataBlock.includes('exportStudentsWord()')||!dataBlock.includes('openStudentsPdfPreview()')){console.error('Student export actions regression');process.exit(1)}
console.log('Regression checks passed: preview controls + Auto-fit + Chromium direct vector save + modal-visible status + isolated printing.');
