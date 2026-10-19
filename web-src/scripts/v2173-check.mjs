import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const core=read('src/core/runtime.js');
const auth=read('src/features/auth/runtime.js');
const students=read('src/features/students/runtime.js');
const sessions=read('src/features/sessions/runtime.js');
const legacy=read('src/legacy/app.js');
const main=read('src/main.js');
const sql=read('Halaqati-v2.17.3-monthly-stats-fix.sql');
const pkg=JSON.parse(read('package.json'));

function must(v,msg){if(!v){console.error('FAIL:',msg);process.exit(1)}}

must(pkg.version==='2.18.2','package version must be 2.18.2');
must(core.includes("APP_VERSION_NAME='2.18.2'")&&core.includes('APP_VERSION_CODE=21802'),'runtime version constants must be 2.18.2 / 21802');
must(main.includes("version: '2.18.2'"),'ready event must expose 2.18.0');

must(core.includes('const localDateKey=')&&core.includes('const today=()=>localDateKey(new Date())'),'today must use local calendar date');
must(core.includes('const monthStart=(ym=null)=>')&&!core.includes("const today=()=>new Date().toISOString().slice(0,10)"),'UTC calendar helper regression');
must(auth.includes("state.homeMonthly=[...state.monthly]"),'current month home cache missing');
must(students.includes('function shiftHomeMonth')&&students.includes('function homeMonthPicker'),'home month selector missing');
must(students.includes("db.from('monthly_student_stats').select('*').eq('month_start',monthStart(ym))"),'selected-month stats query missing');

must(sessions.includes('function uploadSession')&&sessions.includes("se.status='closed'"),'session upload/close flow missing');
must(sessions.includes('function reopenSession')&&sessions.includes("se.status='open'"),'session reopen/edit flow missing');
must(sessions.includes('function editSessionData')&&sessions.includes('sessionDlg.dataset.editId'),'session metadata edit flow missing');
must(sessions.includes('حذف الجلسة نهائياً')&&sessions.includes("db.from('sessions').delete()"),'permanent session delete flow missing');
must(sessions.includes("dedupeKey:`session:${se.id}`"),'session edits must merge into the same offline session operation');

must(legacy.includes("function toAsciiDigits(value='')"),'Arabic/Persian digit conversion missing');
must(legacy.includes('function normalizeQuranNumberInput(el)'), 'Quran numeric normalizer missing');
must(legacy.includes('inputmode="numeric"')&&legacy.includes('pattern="[0-9]*"')&&legacy.includes('dir="ltr"'),'Quran editable numeric inputs must use ASCII-friendly text fields');
must(legacy.includes("Math.min(max,Math.max(1"),'ayah max validation missing');

must(sql.includes('with (security_invoker = true)'),'monthly view must preserve security_invoker');
must(sql.includes('select student_id, month_start from attendance')&&sql.includes('union')&&sql.includes('select student_id, month_start from rec'),'monthly view must union attendance and recitation months');
must(sql.includes('se.session_date::timestamp')&&!sql.includes('se.session_date::timestamp with time zone'),'session DATE must not be converted through timestamptz');

const toAsciiDigits=value=>String(value).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
must(toAsciiDigits('١٢٣')==='123','Arabic-Indic digit conversion failed');
must(toAsciiDigits('۱۲۳')==='123','Persian digit conversion failed');
must(toAsciiDigits('123')==='123','ASCII digits changed unexpectedly');

const localDateKey=d=>`${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
must(localDateKey(new Date(2026,7,31))==='2026-08-31','Aug 31 local date boundary failed');
must(localDateKey(new Date(2026,8,1))==='2026-09-01','Sep 1 local date boundary failed');

console.log('Halaqati v2.18.0 month/session/digits checks passed.');
