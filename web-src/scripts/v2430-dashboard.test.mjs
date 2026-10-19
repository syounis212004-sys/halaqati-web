import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fn(path,name){let s=read(path),start=s.indexOf('function '+name+'('),end=s.indexOf('\nfunction ',start+1);return s.slice(start,end<0?undefined:end)}
const plans='src/features/plans/runtime.js';
const context={today:()=> '2026-09-07',surahs:Array.from({length:114},(_,i)=>'سورة '+(i+1)),fmt:String,smartPlansEngine:{isPassing:r=>r.evaluation==='good'},smartPlanStudentRecitations:()=>[],smartPlanDateOfRecord:r=>r.date};
vm.createContext(context);
for(const name of ['smartPlanHifzCursorScore','smartPlanAcceptedAyahRanges','smartPlanSegmentsFromSteps','smartPlanSegmentsText','decorateSmartPlanAssignment'])vm.runInContext(fn(plans,name),context);
const plan={plan_type:'hifz',settings:{memorization_line_keys:['1:2','2:1']}};
const progress={linePlan:true,completedLineKeys:['1:2'],assignment:{pages:1/15},retryLineKeys:[]};
test('completed boundary ayah cannot reappear through a line outside the plan',()=>{
 context.smartPlanRouteSteps=()=>[{surah:58,ayah:10,allLineKeys:['1:1','1:2'],lineKeys:['1:2'],page:1},{surah:57,ayah:12,lineKeys:['2:1'],page:2}];
 let a=context.decorateSmartPlanAssignment(plan,progress);assert.equal(a.ayahSegments.length,1);assert.equal(a.ayahSegments[0].surah,57);assert.equal(a.pages,.07);
});
test('previously accepted exact ayah is excluded without altering completed counters',()=>{
 context.smartPlanStudentRecitations=()=>[{activity_type:'new_hifz',start_surah:58,end_surah:58,start_ayah:1,end_ayah:22,date:'2026-08-15',evaluation:'good'}];
 let p={...progress,completedLineKeys:[]};let a=context.decorateSmartPlanAssignment(plan,p,'student');assert.equal(a.ayahSegments[0].surah,57);assert.equal(p.completedLineKeys.length,0);
});
test('required retry is still shown even for previously accepted ayah',()=>{
 let a=context.decorateSmartPlanAssignment(plan,{...progress,assignment:{pages:.07,blockedByRetry:true},retryLineKeys:['1:2']},'student');assert.equal(a.ayahSegments[0].surah,58);
});
test('rest day does not fabricate ayahs',()=>{assert.equal(context.decorateSmartPlanAssignment(plan,{...progress,assignment:{pages:0}}).ayahSegments.length,0)});
test('range text preserves start then end and leaves the record unchanged',()=>{
 let src=fn('src/features/sessions/runtime.js','recitationRangeText');vm.runInContext(src,context);
 let r={start_surah:28,end_surah:28,start_ayah:20,end_ayah:29,pages_count:1.4},before=JSON.stringify(r);assert.equal(context.recitationRangeText(r),'من سورة 28 20 إلى سورة 28 29');assert.equal(JSON.stringify(r),before);
});
test('dashboard preview count includes every hidden student',()=>{
 const src=fn('src/features/operations/runtime.js','opsMiniList');let c={esc:String};vm.createContext(c);vm.runInContext(src,c);let html=c.opsMiniList(Array.from({length:41},(_,i)=>({id:String(i),full_name:'طالب '+i})));assert.equal((html.match(/studentProfile/g)||[]).length,2);assert.ok(html.includes('+ 39 آخرين'));
});
test('chart shows real values, zero state and missing-data state distinctly',()=>{
 let source=read('src/features/guardian/runtime.js'),start=source.indexOf('  function guardianMiniChart('),end=source.indexOf('  window.setGuardianTrendDays',start),daily=[{date:'2026-09-01',hifz:1.4},{date:'2026-09-02',hifz:2.4}];
 let c={state:{guardianTrendDays:7},chartData:()=>daily,fmt:String,gDash:()=>({trend:{daily}})};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 let html=c.guardianMiniChart({});assert.ok(html.includes('<svg'));assert.ok(html.includes('3.8'));assert.ok(html.includes('2026-09-01'));assert.ok(html.includes('عرض التفاصيل اليومية'));
 daily=[];assert.ok(c.guardianMiniChart({}).includes('لا توجد صفحات حفظ مسجلة'));
 c.gDash=()=>({});assert.ok(c.guardianMiniChart({}).includes('لم تتوفر بيانات الرسم بعد'));
});
