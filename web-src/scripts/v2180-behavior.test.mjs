import assert from 'node:assert/strict';
import test from 'node:test';
import { createSmartPlansEngine } from '../src/features/plans/engine.js';
const engine=createSmartPlansEngine();
function base(overrides={}){return {id:'p',scope_type:'student',halaqa_id:'h',student_id:'s',plan_type:'hifz',target_units:20,target_pages:20,start_date:'2026-09-01',end_date:'2026-09-30',schedule_weekdays:[0,1,2,3,4,5,6],catch_up_weekday:null,max_daily_multiplier:1.5,auto_extend:true,quality_gate_enabled:true,minimum_evaluation:'good',milestone_mode:'none',milestone_requires_approval:false,delay_alert_days:3,status:'active',settings:{minimum_daily_mode:'dynamic'},...overrides}}
function rec(date,pages,id='r',evaluation='excellent'){return {id,student_id:'s',activity_type:'new_hifz',pages_count:pages,evaluation,sessions:{session_date:date,halaqa_id:'h'},created_at:date+'T12:00:00Z'}}
test('being far ahead never removes tomorrow minimum hifz',()=>{let p=engine.calculateProgress({plan:base(),studentId:'s',recitations:[rec('2026-09-01',7)],today:'2026-09-02'});assert.ok(p.aheadBy>0);assert.ok(p.dailyTarget>0);assert.ok(p.assignment.pages>0)});
test('good is accepted and repeat alone blocks memorisation',()=>{assert.equal(engine.isPassing(rec('2026-09-01',1,'good','good'),base()),true);assert.equal(engine.isPassing(rec('2026-09-01',1,'repeat','repeat'),base()),false)});
test('intensive sard week pauses hifz and resumes afterwards',()=>{let plan=base({settings:{minimum_daily_mode:'dynamic',pause_ranges:[{from:'2026-09-08',to:'2026-09-14',reason:'sard_week'}]}});let during=engine.calculateProgress({plan,studentId:'s',today:'2026-09-10'});assert.equal(during.pauseReason,'sard_week');assert.equal(during.assignment.pages,0);let after=engine.calculateProgress({plan,studentId:'s',today:'2026-09-15'});assert.notEqual(after.pauseReason,'sard_week');assert.ok(after.dailyTarget>0)});

test('good is accepted across hifz, sard, review and tathbit; repeat blocks all',()=>{
  for(const planType of ['hifz','sard','review','tathbit']){
    const p=base({plan_type:planType});
    assert.equal(engine.isPassing(rec('2026-09-01',1,`good-${planType}`,'good'),p),true,`${planType} good should pass`);
    assert.equal(engine.isPassing(rec('2026-09-01',1,`repeat-${planType}`,'repeat'),p),false,`${planType} repeat should block`);
  }
});
