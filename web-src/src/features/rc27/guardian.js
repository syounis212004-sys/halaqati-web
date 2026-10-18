/* Halaqati v2.63.22 — guardian: the child's other programs; background notification cleanup. */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v);
  const KIND={tajweed:'التلاوة والتجويد',tilawah:'التلاوة والتجويد',training:'برنامج تأهيلي',course:'دورة',other:'برنامج'};
  async function programsFor(st){
    const m0=new Date().toISOString().slice(0,8)+'01',m1=new Date().toISOString().slice(0,10);
    const [hs,mem]=await Promise.all([db.from('halaqas').select('id,name,halaqa_type').limit(200),db.from('student_halaqa_memberships').select('halaqa_id,status').eq('student_id',st.id).limit(50)]);
    if(hs.error)throw hs.error;
    const byId=new Map((hs.data||[]).map(x=>[x.id,x])),ids=[...new Set([...(mem.data||[]).filter(x=>(x.status||'active')==='active').map(x=>x.halaqa_id),st.halaqa_id].filter(Boolean))].filter(id=>byId.has(id)&&byId.get(id).halaqa_type&&byId.get(id).halaqa_type!=='regular');
    if(!ids.length)return [];
    const f=q=>q.eq('student_id',st.id).gte('sessions.session_date',m0).lte('sessions.session_date',m1).neq('sessions.status','cancelled').limit(500);
    const [att,rec]=await Promise.all([f(db.from('attendance_records').select('status,sessions!inner(session_date,halaqa_id,status)')),f(db.from('recitation_entries').select('evaluation,safety_percentage,sessions!inner(session_date,halaqa_id,status)'))]);
    return ids.map(id=>{const a=(att.data||[]).filter(r=>r.sessions?.halaqa_id===id),r=(rec.data||[]).filter(x=>x.sessions?.halaqa_id===id),s=r.map(x=>x.safety_percentage).filter(v=>v!=null).map(Number);
      return {name:byId.get(id).name,type:byId.get(id).halaqa_type,sessions:a.length,present:a.filter(x=>x.status==='present'||x.status==='late').length,absent:a.filter(x=>x.status==='absent').length,recs:r.length,avg:s.length?Math.round(s.reduce((x,y)=>x+y,0)/s.length*10)/10:null}});
  }
  async function fill(){
    const box=document.getElementById('rc27GuardianPrograms');if(!box)return;
    try{
      let html='';
      for(const st of (state.students||[]).filter(s=>s.status!=='withdrawn')){
        const rows=await programsFor(st);
        if(rows.length)html+=`<div class="card"><b>البرامج الأخرى — ${h(st.full_name)}</b>${rows.map(p=>`<div class="rc27-prog-row"><div><b>${h(p.name)}</b> <span class="muted">${KIND[p.type]||'برنامج'}</span></div><div class="muted">هذا الشهر: ${p.sessions} جلسة · حضور ${p.present} · غياب ${p.absent}</div><div class="muted">${p.recs?`تسميعات ${p.recs}${p.avg!=null?` · متوسط الجودة ${p.avg}%`:''}`:'لا توجد تسميعات مسجلة هذا الشهر'}</div></div>`).join('')}</div>`;
      }
      if(box.isConnected)box.innerHTML=html;
    }catch(_e){}
  }
  if(typeof guardianHomePage==='function'){
    const base=guardianHomePage;
    guardianHomePage=function(){const r=base.apply(this,arguments);setTimeout(fill,0);return r+'<div id="rc27GuardianPrograms"></div>'};
  }
  // Daily cleanup of old notifications (read ones are removed after a while) — server-side RPC, best effort, once per day.
  let cleanupTimer=setInterval(async()=>{
    try{
      if(!navigator.onLine||!state.user||!state.networkVerified)return;
      const k='halaqati_notif_cleanup_'+state.user.id,t=new Date().toISOString().slice(0,10);
      if(localStorage.getItem(k)===t){clearInterval(cleanupTimer);return}
      const {error}=await db.rpc('rc27_cleanup_notifications',{p_days:30,p_all:false});
      if(!error){localStorage.setItem(k,t);clearInterval(cleanupTimer)}
    }catch(_e){}
  },15000);

  // ---------- Student profile: achievements, archived plan months, programs ----------
  const PLAN_AR={hifz:'حفظ',sard:'سرد',review:'مراجعة',tathbit:'تثبيت'};
  const fm=v=>typeof fmt==='function'?fmt(v):v;
  async function fillProfileExtras(id){
    const box=document.getElementById('rc27ProfileExtras');if(!box)return;
    const parts=[];
    try{
      const month=new Date().toISOString().slice(0,8)+'01';
      const [badges,hist]=await Promise.all([db.rpc('rc182_refresh_student_badges_exact',{p_student_id:id,p_month:month}),db.rpc('student_plan_month_history',{p_student_id:id})]);
      const bs=Array.isArray(badges.data)?badges.data:[];
      if(bs.length)parts.push(`<div class="card"><h3>إنجازات الشهر</h3>${bs.map(b=>`<div class="rc27-prog-row"><b>🏅 ${h(b.title||'إنجاز')}</b><div class="muted">${h(b.description||'')}</div></div>`).join('')}</div>`);
      const hs=Array.isArray(hist.data)?hist.data:[];
      if(hs.length)parts.push(`<div class="card"><h3>أشهر الخطة السابقة (أرشيف)</h3>${hs.slice(0,12).map(x=>`<div class="rc27-prog-row"><b>${h(String(x.period_month||'').slice(0,7))}</b> <span class="muted">${h(PLAN_AR[x.plan_type]||x.plan_type||'')}${x.title?' · '+h(x.title):''}</span><div class="muted">${x.target_pages!=null?`مقرر ${fm(x.target_pages)} ص · منجز ${fm(x.done_pages||0)} ص`:''}${x.sard_target_pages?` · سرد ${fm(x.sard_done_pages||0)}/${fm(x.sard_target_pages)}`:''}</div><div class="muted">حضور ${x.present??0} · غياب ${x.absent??0}${x.quality!=null?` · جودة ${fm(x.quality)}%`:''}</div></div>`).join('')}</div>`);
    }catch(_e){}
    try{
      if(state.profile?.role!=='guardian'){
        const [mem,hs]=await Promise.all([db.from('student_halaqa_memberships').select('halaqa_id,status').eq('student_id',id),db.from('halaqas').select('id,name,halaqa_type').limit(200)]);
        const by=new Map((hs.data||[]).map(x=>[x.id,x])),rows=(mem.data||[]).filter(m=>by.has(m.halaqa_id));
        if(rows.length)parts.push(`<div class="card"><h3>المشاركة في برامج</h3>${rows.map(m=>`<div class="rc27-prog-row"><b>${h(by.get(m.halaqa_id).name)}</b> <span class="muted">${m.status==='active'?'نشط':m.status==='completed'?'أتم البرنامج':h(m.status)}</span></div>`).join('')}</div>`);
      }
    }catch(_e){}
    if(box.isConnected)box.innerHTML=parts.join('');
  }
  if(typeof studentProfile==='function'){
    const baseProfile=studentProfile;
    studentProfile=function(id){
      const r=baseProfile.apply(this,arguments);
      try{const c=document.getElementById('content');if(c&&c.querySelector('.profile-details')){c.insertAdjacentHTML('beforeend','<div id="rc27ProfileExtras"></div>');setTimeout(()=>fillProfileExtras(id),0)}}catch(_e){}
      return r;
    };
  }
})();
