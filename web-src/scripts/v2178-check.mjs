import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL('../'+path, import.meta.url),'utf8')}
function must(ok,msg){if(!ok){console.error('V2178_CHECK_FAIL:',msg);process.exit(1)}}

const pkg=JSON.parse(read('package.json'));
const core=read('src/core/runtime.js');
const main=read('src/main.js');
const sessions=read('src/features/sessions/runtime.js');
const startup=read('src/core/startup.js');
const engine=read('src/features/plans/engine.js');
const plans=read('src/features/plans/runtime.js');
const index=read('index.html');

must(pkg.version==='2.18.2','package version must be 2.18.2');
must(core.includes("APP_VERSION_NAME='2.18.2'")&&core.includes('APP_VERSION_CODE=21802'),'runtime version mismatch');
must(main.includes("version: '2.18.2'"),'ready event must expose 2.18.0');

must(sessions.includes('cacheRecentSessionRostersForOffline'),'recent session roster pre-cache is missing');
must(sessions.includes('persistSessionRosterCache(id,state.sessionRoster)'),'opened server session is not persisted for offline edit');
must(sessions.includes('تفاصيل هذه الجلسة غير محفوظة على الجهاز بعد'),'unsafe empty offline roster guard is missing');
must(sessions.includes('لا يمكن فتح هذه الجلسة للتعديل دون إنترنت قبل تنزيل تفاصيلها'),'offline reopen guard is missing');
must(startup.includes('cacheRecentSessionRostersForOffline(30)'),'startup recent-session offline cache warmup is missing');

must(engine.includes("['good', 'very_good', 'excellent'].includes(evaluation)"),'good+ acceptance rule is missing');
must(engine.includes("evaluation === 'repeat'")&&engine.includes("return false"),'repeat/weak retry block is missing');
must(plans.includes("tathbit:'إعادة الحفظ السابق'"),'clear retry label is missing');
must(plans.includes("آخر تسميع يحتاج إعادة؛ يعاد المقدار السابق فقط، و«جيد» لا يوقف الخطة."),'retry explanation is missing');
must(plans.includes("if(hifz)min.value='good'"),'hifz plan form does not force accepted-good rule');
must(plans.includes('if(state.sessionView)setTimeout(()=>injectSmartPlanSessionWidgets(state.sessionView),0)'),'open session plan widgets are not refreshed after plan load');
must(index.includes('في خطط الحفظ: جيد فأعلى مقبول، و«إعادة» فقط توقف التقدم.'),'hifz quality rule is not explained in the UI');
must(!plans.includes("tathbit:'تثبيت إجباري'"),'old mandatory tathbit label is still present');

console.log('Halaqati v2.18.0 offline-session + accepted-good smart-plan checks passed.');
