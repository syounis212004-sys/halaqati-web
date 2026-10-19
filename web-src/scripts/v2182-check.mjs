import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSmartPlansEngine} from '../src/features/plans/engine.js';
const engine=createSmartPlansEngine();

const runtime=fs.readFileSync(new URL('../src/features/plans/runtime.js',import.meta.url),'utf8');
const legacy=fs.readFileSync(new URL('../src/legacy/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/styles/app.css',import.meta.url),'utf8');
const reportsRuntime=fs.readFileSync(new URL('../src/features/reports/runtime.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

assert.equal(pkg.version,'2.18.2');
assert.ok(runtime.includes('smartPlanRenderMemo'));
assert.ok(runtime.includes("minimum_daily_mode:'dynamic'"));
assert.ok(!runtime.includes('حد أدنى ${fmt(next.progress.minimumDaily||0)} ص'));
assert.ok(legacy.includes("reportTrack:state.reportTrack||'all'"));
assert.ok(legacy.includes("general_hifz:'مسار الحفظ العام'"));
assert.ok(legacy.includes("tathbit:'مسار التثبيت'"));
assert.ok(!legacy.includes("reportTrackAr={all:'جميع المسارات',general_hifz:'مسار الحفظ العام',tathbit:'مسار التثبيت',sard"));
assert.ok(legacy.includes('supervision-actions-grid'));
assert.ok(css.includes('v2.18.2 — actionable supervision dashboard'));
assert.ok(reportsRuntime.includes('window.reportStudents=function(trackOverride=null)'));
assert.ok(reportsRuntime.includes('window.reportStatsRows=function(trackOverride=null)'));
assert.ok(legacy.includes("['general_hifz','tathbit'].map(t=>attendanceReportSection"));
assert.ok(legacy.includes("['general_hifz','tathbit'].map(t=>recitationsReportSection"));

function lineKeys(pages){
  const out=[];
  for(let p=1;p<=pages;p++)for(let line=1;line<=15;line++)out.push(`${p}:${line}`);
  return out;
}
function plan(targetPages){
  return {
    id:'p',scope_type:'student',halaqa_id:'h',student_id:'s',plan_type:'hifz',
    target_units:targetPages,target_pages:targetPages,start_date:'2026-09-01',end_date:'2026-09-20',
    schedule_weekdays:[0,1,2,3,4,5,6],catch_up_weekday:null,max_daily_multiplier:1.5,
    auto_extend:true,quality_gate_enabled:true,minimum_evaluation:'good',
    milestone_mode:'none',milestone_requires_approval:false,delay_alert_days:3,status:'active',
    settings:{minimum_daily_mode:'dynamic',memorization_line_keys:lineKeys(targetPages)}
  };
}
let ten=engine.calculateProgress({plan:plan(10),studentId:'s',today:'2026-09-01'});
let twenty=engine.calculateProgress({plan:plan(20),studentId:'s',today:'2026-09-01'});
assert.equal(ten.dynamicDailyMinimum,0.5);
assert.ok(ten.dailyTarget>=0.46&&ten.dailyTarget<=0.54);
assert.equal(twenty.dynamicDailyMinimum,1);
assert.ok(twenty.dailyTarget>=0.93&&twenty.dailyTarget<=1.07);

console.log('Halaqati v2.18.2 smart-plan pace, supervision dashboard, and report-track checks passed.');
