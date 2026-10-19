import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=read('src/main.js'),core=read('src/core/runtime.js'),reports=read('src/features/reports/runtime.js'),live=read('src/features/live-halaqa/runtime.js'),liveCss=read('src/styles/live-halaqa.css'),digits=read('src/core/latin-digits-runtime.js'),pkg=JSON.parse(read('package.json'));
const failures=[];const ok=(c,m)=>{if(!c)failures.push(m)};
ok(['2.40.0','2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version),'package version must preserve v2.40.x Live Halaqa');
ok(core.includes(`APP_VERSION_NAME='${pkg.version}'`)&&core.includes(pkg.version==='2.41.2'?'APP_VERSION_CODE=24102':pkg.version==='2.41.1'?'APP_VERSION_CODE=24101':['2.40.8','2.41.1','2.41.2'].includes(pkg.version)?'APP_VERSION_CODE=24008':pkg.version==='2.40.6'?'APP_VERSION_CODE=24006':pkg.version==='2.40.4'?'APP_VERSION_CODE=24004':pkg.version==='2.40.2'?'APP_VERSION_CODE=24002':pkg.version==='2.40.1'?'APP_VERSION_CODE=24001':'APP_VERSION_CODE=24000'),'core app version/code missing');
ok(main.includes("./styles/live-halaqa.css")&&main.includes('halaqati-live-halaqa-runtime'),'Live Halaqa CSS/runtime not loaded');
ok(main.indexOf('halaqati-performance-runtime')<main.indexOf('halaqati-live-halaqa-runtime')&&main.indexOf('halaqati-live-halaqa-runtime')<main.indexOf('halaqati-startup-runtime'),'Live Halaqa must load after performance and before startup');
ok(digits.includes("ar-EG-u-nu-latn")&&digits.includes('MutationObserver'),'Latin digit runtime missing');
ok(core.includes("toLocaleString('ar-EG-u-nu-latn'"),'fmt must use Latin digits');
ok(['2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version)?reports.includes('table-layout:fixed!important'):reports.includes('table-layout:auto!important'),'PDF table layout regression');
ok(!reports.includes('.pro-table .name{width:20%!important'),'fixed 20% student-name PDF width must be removed');
ok(reports.includes('applyAutoFitPdfTables')&&reports.includes('hf-col-compact')&&reports.includes('hf-col-name'),'PDF autofit classifier missing');
if(['2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version)){const vector=read('src/features/reports/vector-pdf-runtime.js');ok(vector.includes('HalaqatiPdf')&&vector.includes('@page'),'v2.40.4+ vector PDF layer missing')}else{ok(reports.includes(['2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version)?"const PDF_PNG_COMPRESSION='NONE'":"const PDF_PNG_COMPRESSION='FAST'")&&reports.includes(pkg.version==='2.40.2'?'PDF_PRINT_SCALE=PDF_TARGET_DPI/PDF_CSS_DPI':'printScale=300/96'),'PDF HQ pipeline must remain unchanged');}
ok(live.includes('data-halaqati-action="quick-memorization"')&&live.includes("action==='quick-memorization'"),'quick memorization delegated tap handler missing');
ok(live.includes('openLiveHalaqa')&&live.includes('liveHalaqaFinish')&&live.includes('liveHalaqaToggleWakeLock'),'Live Halaqa core actions missing');
ok(liveCss.includes('height:100dvh')&&liveCss.includes('flex:1 1 auto')&&liveCss.includes('safe-area-inset-bottom'),'Live Halaqa must remain a one-screen mobile-first flow');
ok(live.includes('saveReportOffline')&&live.includes('localAttendanceSave')&&live.includes('saveSessionOfflineFirst'),'Offline-first Live Halaqa persistence missing');
ok(live.includes('opsQuickPlanBundle')&&live.includes('opsAssignmentText'),'Live Halaqa must use the existing Smart Plan assignment engine');
if(failures.length){console.error('v2.40.0 checks failed:\n- '+failures.join('\n- '));process.exit(1)}
console.log('v2.40.0 Live Halaqa checks passed');
