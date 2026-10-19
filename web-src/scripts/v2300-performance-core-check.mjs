import fs from 'node:fs';
import crypto from 'node:crypto';

const read=(p)=>fs.readFileSync(p,'utf8');
const need=(v,msg)=>{if(!v)throw new Error(msg)};
const pkg=JSON.parse(read('package.json'));
const core=read('src/core/runtime.js');
const main=read('src/main.js');
const perf=read('src/core/performance-runtime.js');
const ops=read('src/features/operations/runtime.js');
const ui=read('src/styles/uiux-pro-max.css');

need(['2.30.0','2.40.0','2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version),'package version must preserve v2.30.0 Performance Core');
need(core.includes(`APP_VERSION_NAME='${pkg.version}'`)&&core.includes(pkg.version==='2.41.2'?'APP_VERSION_CODE=24102':pkg.version==='2.41.1'?'APP_VERSION_CODE=24101':['2.40.8','2.41.1','2.41.2'].includes(pkg.version)?'APP_VERSION_CODE=24008':pkg.version==='2.40.6'?'APP_VERSION_CODE=24006':pkg.version==='2.40.4'?'APP_VERSION_CODE=24004':pkg.version==='2.40.2'?'APP_VERSION_CODE=24002':pkg.version==='2.40.1'?'APP_VERSION_CODE=24001':pkg.version==='2.40.0'?'APP_VERSION_CODE=24000':'APP_VERSION_CODE=23000'),'runtime version/code mismatch');
need(main.includes("performanceRuntimeUrl from './core/performance-runtime.js?url'"),'performance runtime import missing');
const opsPos=main.indexOf("id: 'halaqati-operations-runtime'");
const perfPos=main.indexOf("id: 'halaqati-performance-runtime'");
const startPos=main.indexOf("id: 'halaqati-startup-runtime'");
need(opsPos>=0&&perfPos>opsPos&&startPos>perfPos,'performance runtime must load after composed features and before startup');
need(main.includes(`version: '${pkg.version}'`),'ready event version mismatch');

// v2.20 functional baseline is locked: v2.30 optimizes composition/loading only.
const baselineHashes={
  'src/features/plans/engine.js':'0575466f4e03d382041ed669ae415de7a38770fe5ba49a60517762a55378f1ae',
  'src/features/plans/runtime.js':'4f9f22d8aa7e0be586be57741cb7095c95a3009453db329b5216315bb672a6ff',
  'src/features/notifications/push-bridge.js':'94e1564d45173a0efa59b68688525564ad399498641fa6edb108b944196cd82b',
  'src/styles/uiux-pro-max.css':'b3383f6f99f7054aec6099f2f9c1d1fdb56ad3a0ad548a24dc8b27e91432adf6',
  'src/core/offline-store.js':'66a4a3c25bd4a32b576a3b8d09d4d49dcc6ff0a610f70bf8bba60961957e1816',
  'src/core/navigation.js':'d4524422f991ecd0b2f335a8d99fea9a472ca549e5795aa4f115bf1c3ca891aa',
  'plugins/halaqati-updater/android/src/main/java/com/mohammedsamir/halaqati/updater/HalaqatiUpdaterPlugin.java':'a904c0fd5655456aebff473bceb36d43c73dc000a9734f447190892099e18e34',
  'plugins/halaqati-deeplink/android/src/main/java/com/mohammedsamir/halaqati/deeplink/HalaqatiDeepLinkPlugin.java':'1114f503f276ced8c2f21f86139bf046e3cefee8603e4d4858bd30178889a939'
};
for(const [file,expected] of Object.entries(baselineHashes)){
  if(['2.41.1','2.41.2'].includes(pkg.version)&&file==='src/core/navigation.js')continue; // v2.41 intentionally adds Certificates navigation only.
  const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  need(actual===expected,`v2.20 baseline file changed unexpectedly: ${file}`);
}
if(['2.41.1','2.41.2'].includes(pkg.version))need(read('src/core/navigation.js').includes("['certificates','الشهادات']"),'v2.41 navigation exception must be certificates-only');

// Local-first, non-blocking and deduplicated loading.
need(perf.includes("typeof requestIdleCallback==='function'")&&perf.includes('setTimeout(fn'),'idle scheduling must have a compatible fallback');
need(perf.includes('if(v230FullLoadPromise)return v230FullLoadPromise'),'concurrent full-load deduplication missing');
need(perf.includes('Promise.allSettled([v230LoadDashboardData(),loadSmartPlanData(),opsLoadOperationalData(forceNetwork),loadRoleExtras()])'),'independent data branches must run in parallel');
need(perf.includes('showApp();cacheSnapshot()')&&perf.includes('v230FullLoad(true,{skipCore:true})'),'first online launch must paint core before background hydration');
need(perf.includes('if(cached&&state.profile)')&&perf.includes("setTimeout(()=>refreshFromServer({renderAfter:true}),60)"),'cached startup must remain local-first');

// High-volume RLS reads: explicit student filtering + selected columns.
need((perf.match(/\.in\('student_id',ids\)/g)||[]).length>=2,'attendance/notes must use explicit student filters');
need(perf.includes("recQuery=recQuery.in('student_id',studentIds)"),'smart-plan recitations must use explicit student filter');
need(perf.includes("select('id,session_id,student_id,activity_type,start_surah"),'smart-plan recitation payload must be explicit');
need(!perf.includes("db.from('recitation_entries').select('*')"),'performance layer must not fetch all recitation columns');
need(perf.includes("Date.now()-last<20*60*1000"),'smart-plan alert scan throttle missing');

// UI/UX Pro Max and previous functional fixes remain unchanged.
need(main.includes("import './styles/uiux-pro-max.css'"),'v2.20 UI/UX layer must remain loaded');
need(ui.includes('UI/UX Pro Max v2.13.0 design layer'),'UI/UX Pro Max baseline marker missing');
need(ops.includes("opsQuickChooseAbsence('excused')")&&ops.includes("opsQuickChooseAbsence('absent')"),'v2.19.3 absence flow regressed');
need(ops.includes('opsQuickPlanBundle(st,today())'),'v2.19.3 smart-plan quick duty source regressed');
const hq=ops.lastIndexOf('exportParentReportPdf=async function');
need(hq>=0&&(ops.slice(hq).includes("canvasToPngBytes")||ops.slice(hq).includes("toDataURL('image/png')"))&&(ops.slice(hq).includes("pdf.addImage(png,'PNG'")||ops.slice(hq).includes("addImage(img,'PNG'"))&&!ops.slice(hq).includes("addImage(img,'JPEG'"),'HQ PNG PDF override regressed');
need(!perf.includes('exportParentReportPdf=')&&!perf.includes('review_near')&&!perf.includes('review_far'),'performance phase must not mutate PDF or memorization/review semantics');

// Native capabilities must remain present after packaging.
for(const f of [
  'plugins/halaqati-updater/android/src/main/java/com/mohammedsamir/halaqati/updater/HalaqatiUpdaterPlugin.java',
  'plugins/halaqati-updater/android/src/main/java/com/mohammedsamir/halaqati/updater/HalaqatiUpdateFileProvider.java',
  'plugins/halaqati-updater/android/src/main/AndroidManifest.xml',
  'plugins/halaqati-updater/android/src/main/res/xml/halaqati_update_paths.xml',
  'plugins/halaqati-deeplink/android/src/main/java/com/mohammedsamir/halaqati/deeplink/HalaqatiDeepLinkPlugin.java',
  'plugins/halaqati-deeplink/android/src/main/AndroidManifest.xml'
]) need(fs.existsSync(f)&&fs.statSync(f).size>0,`native plugin file missing: ${f}`);

need(perf.includes('window.HalaqatiPerformance={version:\'2.30.0\''),'real-device performance diagnostics API missing');
console.log('v2.30.0 Performance Core checks passed ✅');
