/* Halaqati v2.63.22 — smart plan phases timeline (read-only view of the native RC11+ phase tables).
   Phases are created / moved / rebased only from the Android app: those writes keep invariants (revisions, frozen results,
   Sard anchors) that this web layer deliberately does not touch. */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v);
  const TYPE={hifz:'حفظ',sard:'سرد'},ST={draft:'مسودة',active:'جارية',completed:'مكتملة',archived:'مؤرشفة'},PS={not_started:'لم تبدأ',active:'جارية',completed:'مكتملة',skipped:'مستثناة'};
  const fm=v=>typeof fmt==='function'?fmt(v):v;
  async function fill(){
    const box=document.getElementById('rc27Phases');if(!box)return;
    try{
      const ids=new Set((state.students||[]).map(s=>s.id));
      const [ph,ps,pl]=await Promise.all([db.from('smart_plan_phases').select('*').neq('status','archived').order('plan_id').order('phase_order').limit(2000),db.from('smart_plan_phase_states').select('*').limit(5000),db.from('smart_plans').select('id,student_id,scope_type,status,plan_type,title').eq('scope_type','student').neq('status','archived').limit(1000)]);
      if(ph.error)throw ph.error;
      const planOf=new Map((pl.data||[]).map(p=>[p.id,p])),states=new Map((ps.data||[]).map(s=>[s.phase_id+'|'+s.student_id,s])),today=new Date().toISOString().slice(0,10);
      const byStudent=new Map;
      (ph.data||[]).forEach(p=>{const plan=planOf.get(p.plan_id);if(!plan||!ids.has(plan.student_id))return;(byStudent.get(plan.student_id)||byStudent.set(plan.student_id,[]).get(plan.student_id)).push(p)});
      const rows=[...byStudent.entries()].slice(0,60).map(([sid,list])=>{
        const st=state.students.find(s=>s.id===sid);
        return `<div class="card"><b>${h(st?.full_name||'طالب')}</b>${list.map(p=>{const s=states.get(p.id+'|'+sid),cur=p.status==='active'&&p.start_date<=today&&today<=p.end_date,target=p.target_pages!=null?`${fm(p.target_pages)} ص`:(p.goal_mode==='open'?'مفتوح':'—');
          return `<div class="rc27-phase ${cur?'now':''}"><div><b>${p.phase_order}. ${h(p.title||TYPE[p.phase_type])}</b> <span class="badge">${TYPE[p.phase_type]||p.phase_type}</span>${cur?' <span class="badge rc27-prog-badge">الحالية</span>':''}</div><div class="muted">${h(p.start_date)} → ${h(p.end_date)} · الهدف ${target} · ${ST[p.status]||h(p.status)}</div>${s?`<div class="muted">حالة الطالب: ${PS[s.status]||h(s.status)}${s.completion_percent!=null?` · ${fm(s.completion_percent)}%`:''}${s.frozen_completed_pages!=null?` · منجز ${fm(s.frozen_completed_pages)}/${fm(s.frozen_target_pages||0)} ص`:''}${Number(s.carry_shortfall_pages)>0?` · مرحَّل ${fm(s.carry_shortfall_pages)} ص`:''}</div>`:''}</div>`}).join('')}</div>`}).join('');
      if(box.isConnected)box.innerHTML=`<div class="section-head"><h3>مراحل الخطط</h3></div><div class="notice">عرض للقراءة فقط. إنشاء المراحل والانتقال بينها وضبط النطاق من تطبيق أندرويد.</div>${rows||'<div class="empty">لا توجد مراحل خطط لطلاب هذا النطاق.</div>'}`;
    }catch(e){if(box.isConnected)box.innerHTML=''}
  }
  if(typeof plansPage==='function'){
    const base=plansPage;
    plansPage=function(){
      const r=base.apply(this,arguments);
      if(state.profile?.role==='guardian'||typeof roleCanManage!=='function'||!roleCanManage())return r;
      if(/^<div class="hero"><h2>الخطط الذكية<\/h2><p>الخطط الذكية خاصة/.test(r))return r;
      setTimeout(fill,0);return r+'<div id="rc27Phases"></div>';
    };
  }
})();
