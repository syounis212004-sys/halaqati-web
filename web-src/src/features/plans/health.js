(function () {
  'use strict';
  async function record(db,plan,student,progress,date,notify,phase) {
    const weekday=new Date(date+'T12:00:00Z').getUTCDay(),days=phase?.schedule_weekdays?.length?phase.schedule_weekdays:plan.schedule_weekdays||[0,1,2,3,4];
    const hifz=phase?phase.phase_type==='hifz':plan.plan_type==='hifz'&&Number(date.slice(8,10))<=22;
    const expected=Number(progress.plannedByToday)||0,done=Number(progress.completed)||0;
    const r=await db.rpc('rc19_record_plan_health',{p_plan_id:plan.id,p_student_id:student.id,p_day:date,
      p_scheduled:hifz&&days.includes(weekday)&&weekday!==plan.catch_up_weekday,p_health:progress.health,
      p_ratio:expected<=.001?1:done/expected,p_expected_pages:expected,p_completed_pages:done,p_behind_pages:Number(progress.behindBy)||0});
    if(r.error)throw new Error(r.error.message||String(r.error));
    const status=Array.isArray(r.data)?r.data[0]:r.data;
    if(!status?.should_notify)return 'done';
    const sent=await notify({action:'event_student',kind:'system',student_id:student.id,
      source_key:`smart-plan-health:${plan.id}:${student.id}:${status.episode_key||date}`,
      title:`يحتاج متابعة · ${student.full_name}`,body:`استمر التأخر عن الخطة ليومي حفظ متتاليين. المنجز ${done} ص، والمطلوب حتى اليوم ${expected} ص، والتأخر ${Number(progress.behindBy)||0} ص.`,
      deep_link:`student:${student.id}`,data:{smart_plan_id:plan.id,health:progress.health,red_streak:status.red_streak||0}});
    if(sent==null||sent.error)return 'pending';
    const marked=await db.rpc('rc19_mark_plan_health_notified',{p_plan_id:plan.id,p_student_id:student.id,p_day:date});
    if(marked.error)throw new Error(marked.error.message||String(marked.error));
    return 'done';
  }
  /* Same (plan, student, day, numbers) already recorded cleanly on this device: skip the server call. A record that still owes a notification is never remembered. */
  const MEMO='halaqati_plan_health_memo_',keyOf=(plan,student)=>plan.id+':'+student.id,sigOf=(progress,date)=>[date,progress.health,Number(progress.plannedByToday)||0,Number(progress.completed)||0,Number(progress.behindBy)||0].join('|');
  function read(uid,date){try{const m=JSON.parse(localStorage.getItem(MEMO+uid)||'null');return m&&m.day===date?m.sigs:{}}catch(e){return {}}}
  function unchanged(uid,plan,student,progress,date){return read(uid,date)[keyOf(plan,student)]===sigOf(progress,date)}
  function remember(uid,plan,student,progress,date){try{const sigs=read(uid,date);sigs[keyOf(plan,student)]=sigOf(progress,date);localStorage.setItem(MEMO+uid,JSON.stringify({day:date,sigs}))}catch(e){}}
  window.HalaqatiPlanHealth={record,unchanged,remember};
})();
