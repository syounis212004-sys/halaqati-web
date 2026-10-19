import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const core=read('src/core/runtime.js');
const main=read('src/main.js');
const plans=read('src/features/plans/runtime.js');
const sessions=read('src/features/sessions/runtime.js');
const html=read('index.html');
const css=read('src/styles/app.css');
function must(v,msg){if(!v){console.error('FAIL:',msg);process.exit(1)}}
must(pkg.version==='2.18.2','package version must be 2.18.2');
must(core.includes("APP_VERSION_NAME='2.18.2'")&&core.includes('APP_VERSION_CODE=21802'),'runtime version constants must be 2.18.2 / 21802');
must(main.includes("version: '2.18.2'"),'ready event must expose 2.18.0');
// Accepted latest hifz: good/very_good/excellent pass, repeat remains rejected by engine.
must(plans.includes("minimum_evaluation:'good'"),'smart-plan suggested start must accept good recitations');
must(plans.includes("memorization_start_source=settings.auto_start?'last_accepted_recitation':'manual'"),'accepted-recitation source marker missing');
must(plans.includes('آخر حفظ مقبول'),'smart-plan UI wording missing');
// Session search must retain all roster cards and only hide/show them.
must(sessions.includes('visibleStudents=q?all.filter')&&sessions.includes('students=all'),'session search must render the full roster');
must(sessions.includes("id=\"rosterSearchEmpty\"")&&sessions.includes("empty.classList.toggle('hidden',n>0)"),'session search empty-state recovery missing');
// Smart plan search in dashboard and composer.
must(plans.includes('function filterSmartPlanDashboard')&&plans.includes('data-smart-plan-student-name'),'smart-plan dashboard search missing');
must(plans.includes('function filterSmartPlanStudentOptions')&&html.includes('id="spStudentSearch"'),'smart-plan composer student search missing');
// Dark mode contrast surfaces.
must(css.includes('v2.17.4 — dark-mode contrast')&&css.includes('body.dark .update-card')&&css.includes('body.dark .smart-plan-track')&&css.includes('body.dark .notice'),'dark mode contrast overrides missing');
console.log('Halaqati v2.18.0 smart-plan/search/dark-mode checks passed.');
