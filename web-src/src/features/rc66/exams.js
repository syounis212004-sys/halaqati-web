/* Halaqati web 2.89.14 — exams, association team, subscription banner. */
(function(){
  const R=window.RC50;if(!R||window.__rc66Exams)return;window.__rc66Exams=true;
  const e=v=>typeof window.esc==='function'?window.esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>state?.profile?.role;
  const NEED='لم يُطبَّق تحديث قاعدة البيانات الخاص بالاختبارات (RC65) بعد.';
  const miss=err=>/student_exams|exam_settings|rc65_|42P01|PGRST/i.test(String(err&&err.message||err));
  const MODES={hifz:'حفظ',tajweed:'تجويد',hifz_tajweed:'حفظ وتجويد',sard:'سرد'};
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const fmt=v=>{v=num(v);return v===Math.floor(v)?String(v):v.toFixed(1)};
  const X=R.exams={st:[],ex:[],set:{pass_mark:80,excellent:95,very_good:90,good:85,mistake_weight:2,hesitation_weight:1,prompt_weight:.5},q:'',f:'all',draft:null};
  const grade=s=>s>=X.set.excellent?'ممتاز':s>=X.set.very_good?'جيد جدًا':s>=X.set.good?'جيد':s>=X.set.pass_mark?'مقبول':'لم يجتز';
  const label=d=>d.kind==='range'?(d.custom||'نطاق مخصص'):d.kind==='juz'?`الجزء ${d.from}`:`الأجزاء ${d.from}–${d.to}`;
  const canExam=()=>['admin','supervisor','teacher'].includes(role());
  const day=t=>{try{return window.gazaFmt?gazaFmt.day(t):String(t||'').slice(0,10)}catch(_e){return String(t||'').slice(0,10)}};

  async function load(){
    const [s,x,st]=await Promise.all([
      db.from('exam_settings').select('*').limit(1),
      db.from('student_exams').select('*').order('exam_date',{ascending:false}).order('created_at',{ascending:false}).limit(400),
      db.rpc('rc65_exam_students')]);
    if(x.error)throw x.error;
    if(s.data&&s.data[0])X.set=Object.assign(X.set,s.data[0]);
    X.ex=x.data||[];X.st=Array.isArray(st.data)?st.data:[];
  }
  const nameOf=id=>(X.st.find(s=>s.id===id)||{}).full_name||'طالب';
  function card(x){
    const ok=!!x.passed,c=ok?'var(--primary,#0B6E4F)':'var(--danger,#C62828)';
    return `<button type="button" class="ex-card" style="border:1.5px solid ${c}" onclick="RC50.exams.detail('${e(x.id)}')">
      <span class="ex-score" style="background:${c}">${e(fmt(x.score))}</span>
      <span class="ex-main"><b>${e(nameOf(x.student_id))}</b><small>${e(x.label)} · ${e(MODES[x.mode]||x.mode)}</small><small>${e(day(x.exam_date))}${num(x.attempt)>1?` · المحاولة ${e(x.attempt)}`:''}</small></span>
      <span class="ex-grade" style="background:${c}">${e(grade(num(x.score)))}</span></button>`;
  }
  R.page('exams',{title:'الاختبارات',roles:['admin','supervisor','teacher','guardian'],render:async()=>{
    try{await load()}catch(err){return R.card(R.empty(miss(err)?NEED:(err.message||'تعذر تحميل الاختبارات')))}
    const q=X.q.trim(),rows=X.ex.filter(x=>(X.f==='all'||(X.f==='passed')===!!x.passed)&&(!q||(nameOf(x.student_id)+' '+x.label).includes(q)));
    const mp=new Date().toISOString().slice(0,7),mo=X.ex.filter(x=>String(x.exam_date).startsWith(mp)),mpass=mo.filter(x=>x.passed).length;
    const chip=(k,t)=>`<button type="button" class="ex-chip ${X.f===k?'on':''}" onclick="RC50.exams.filter('${k}')">${t}</button>`;
    return `<style>.ex-card{display:flex;gap:12px;align-items:center;width:100%;text-align:right;background:var(--surface,#fff);border-radius:18px;padding:12px;margin:0 0 8px;font:inherit}.ex-score{min-width:56px;height:56px;border-radius:50%;color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px}.ex-main{flex:1;display:grid;gap:2px}.ex-main small{opacity:.8}.ex-grade{color:#fff;border-radius:99px;padding:3px 10px;font-weight:700;font-size:12px}.ex-chip{border:1px solid var(--line,#ccc);background:transparent;border-radius:99px;padding:6px 14px;font:inherit}.ex-chip.on{background:var(--primary,#0B6E4F);color:#fff;border-color:transparent}.ex-bar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}</style>
      <div class="dn-tiles">${R.tile('هذا الشهر',mo.length)}${R.tile('ناجحون',mpass)}${R.tile('لم يجتازوا',mo.length-mpass)}</div>
      <div class="ex-bar"><input class="dn-in" style="flex:1;min-width:160px" placeholder="بحث باسم الطالب أو الجزء" value="${e(X.q)}" oninput="RC50.exams.search(this.value)">${canExam()?R.btn('اختبار جديد','RC50.exams.newSheet()'):''}${role()==='admin'?R.btn('الإعدادات','RC50.exams.settings()','tonal'):''}</div>
      <div class="ex-bar">${chip('all',`الكل (${X.ex.length})`)}${chip('passed',`ناجح (${X.ex.filter(x=>x.passed).length})`)}${chip('failed',`لم يجتز (${X.ex.filter(x=>!x.passed).length})`)}</div>
      <div id="exList">${rows.length?rows.map(card).join(''):R.card(R.empty(X.ex.length?'لا توجد نتائج مطابقة':'لا توجد اختبارات بعد'))}</div>`;
  }});
  X.filter=k=>{X.f=k;window.render&&render()};
  X.search=v=>{X.q=v;const q=v.trim(),rows=X.ex.filter(x=>(X.f==='all'||(X.f==='passed')===!!x.passed)&&(!q||(nameOf(x.student_id)+' '+x.label).includes(q)));const b=document.getElementById('exList');if(b)b.innerHTML=rows.length?rows.map(card).join(''):R.card(R.empty('لا توجد نتائج مطابقة'))};

  // ---- new exam ----
  const stepper=(id,l,v,min,max)=>`<label class="dn-field"><span>${l}</span><input id="${id}" class="dn-in" type="number" inputmode="numeric" min="${min}" max="${max}" value="${v}" oninput="RC50.exams.calc()"></label>`;
  X.newSheet=()=>{
    X.draft={kind:'juz',from:30,to:30,mode:'hifz',scoring:'deduction',m:0,h:0,p:0,qn:5};
    const opts=X.st.map(s=>`<option value="${e(s.id)}">${e(s.full_name)}${s.halaqa_name?' · '+e(s.halaqa_name):''}</option>`).join('');
    const sel=(id,o)=>`<select id="${id}" class="dn-in" onchange="RC50.exams.calc(true)">${o}</select>`;
    R.sheet('dnExam','اختبار جديد',`<label class="dn-field"><span>الطالب</span><select id="exStu" class="dn-in" onchange="RC50.exams.calc()"><option value="">— اختر الطالب —</option>${opts}</select></label>
      <label class="dn-field"><span>نطاق الاختبار</span>${sel('exKind','<option value="juz">جزء كامل</option><option value="juz_range">أجزاء مجتمعة</option><option value="range">نطاق مخصص</option>')}</label>
      <div id="exRange">${stepper('exFrom','من الجزء',30,1,30)}${stepper('exTo','إلى الجزء',30,1,30)}</div>
      <label class="dn-field"><span>نمط الاختبار</span>${sel('exMode',Object.entries(MODES).map(([k,v])=>`<option value="${k}">${v}</option>`).join(''))}</label>
      <label class="dn-field"><span>طريقة الدرجة</span>${sel('exScoring','<option value="deduction">خصم بالأخطاء من 100</option><option value="questions">بالأسئلة</option>')}</label>
      <div id="exScoreBox"></div>
      <label class="dn-field"><span>ملاحظات (اختياري)</span><textarea id="exNotes" class="dn-in" rows="2"></textarea></label>
      <div id="exLive" class="dn-card" style="font-weight:800"></div>`,R.btn('حفظ نتيجة الاختبار','RC50.exams.save()'));
    X.calc(true);
  };
  function read(){
    const g=id=>document.getElementById(id),d=X.draft;
    d.kind=g('exKind').value;d.mode=g('exMode').value;d.scoring=g('exScoring').value;
    d.from=Math.min(30,Math.max(1,num(g('exFrom').value)||1));d.to=d.kind==='juz'?d.from:Math.min(30,Math.max(d.from,num(g('exTo').value)||d.from));
    d.custom=(g('exCustom')||{}).value||'';
    if(d.scoring==='deduction'){d.m=num((g('exM')||{}).value);d.h=num((g('exH')||{}).value);d.p=num((g('exP')||{}).value)}
    else{d.qn=Math.min(10,Math.max(1,num((g('exQn')||{}).value)||5));d.qs=[...Array(d.qn).keys()].map(i=>num((g('exQ'+i)||{}).value))}
    return d;
  }
  X.calc=rebuild=>{
    const d=read(),g=id=>document.getElementById(id);
    if(rebuild){
      g('exRange').innerHTML=d.kind==='range'?`<label class="dn-field"><span>وصف النطاق</span><input id="exCustom" class="dn-in" value="${e(d.custom||'')}" oninput="RC50.exams.calc()"></label>`:(d.kind==='juz'?stepper('exFrom','رقم الجزء',d.from,1,30):stepper('exFrom','من الجزء',d.from,1,30)+stepper('exTo','إلى الجزء',d.to,1,30));
      g('exScoreBox').innerHTML=d.scoring==='deduction'?stepper('exM',`أخطاء (−${fmt(X.set.mistake_weight)})`,d.m||0,0,99)+stepper('exH',`ترددات (−${fmt(X.set.hesitation_weight)})`,d.h||0,0,99)+stepper('exP',`تنبيهات (−${fmt(X.set.prompt_weight)})`,d.p||0,0,99)
        :stepper('exQn','عدد الأسئلة',d.qn||5,1,10)+[...Array(d.qn||5).keys()].map(i=>`<label class="dn-field"><span>درجة السؤال ${i+1} من ${fmt(100/(d.qn||5))}</span><input id="exQ${i}" class="dn-in" type="number" step="0.5" min="0" oninput="RC50.exams.calc()"></label>`).join('');
      Object.assign(d,read());
    }
    const s=d.scoring==='deduction'?Math.max(0,100-d.m*X.set.mistake_weight-d.h*X.set.hesitation_weight-d.p*X.set.prompt_weight):Math.min(100,(d.qs||[]).reduce((a,b)=>a+b,0));
    d.score=Math.round(s*10)/10;d.passed=d.score>=X.set.pass_mark;
    const stu=g('exStu').value,att=X.ex.filter(x=>x.student_id===stu&&x.label===label(d)).length+1;d.attempt=att;
    const live=g('exLive');live.style.background=d.passed?'var(--primary,#0B6E4F)':'var(--danger,#C62828)';live.style.color='#fff';
    live.textContent=`الدرجة ${fmt(d.score)} · ${grade(d.score)} · حد النجاح ${fmt(X.set.pass_mark)}${att>1?` · المحاولة ${att}`:''}`;
  };
  X.save=async()=>{
    const d=read();X.calc();const stu=document.getElementById('exStu').value;
    if(!stu)return R.toast('اختر الطالب');if(d.kind==='range'&&!String(d.custom).trim())return R.toast('اكتب وصف النطاق');
    const st=X.st.find(s=>s.id===stu);
    const row={id:crypto.randomUUID(),student_id:stu,halaqa_id:st&&st.halaqa_id||null,examiner_id:state.user.id,exam_date:new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Gaza'})).toISOString().slice(0,10).replace(/T.*/,''),
      kind:d.kind,from_juz:d.kind==='range'?null:d.from,to_juz:d.kind==='range'?null:d.to,label:label(d),mode:d.mode,scoring:d.scoring,
      mistakes:d.scoring==='deduction'?d.m:0,hesitations:d.scoring==='deduction'?d.h:0,prompts:d.scoring==='deduction'?d.p:0,
      questions:d.scoring==='questions'?d.qs.map(s=>({score:s,max:Math.round(1000/d.qn)/10})):null,score:d.score,pass_mark:X.set.pass_mark,passed:d.passed,attempt:d.attempt,notes:(document.getElementById('exNotes').value||'').trim()||null};
    const r=await db.from('student_exams').insert(row);
    if(r.error)return R.toast(miss(r.error)?NEED:r.error.message);
    R.closeSheet('dnExam');R.toast(d.passed?'سُجّل النجاح 🎉':'سُجّلت النتيجة');window.render&&render();
  };
  X.detail=id=>{
    const x=X.ex.find(v=>v.id===id);if(!x)return;
    const can=role()==='admin'||x.examiner_id===state.user.id;
    R.sheet('dnExamD',nameOf(x.student_id),`<div class="dn-card" style="background:${x.passed?'var(--primary,#0B6E4F)':'var(--danger,#C62828)'};color:#fff;font-weight:800;font-size:20px">${e(fmt(x.score))} · ${e(grade(num(x.score)))}</div>
      <p>${e(x.label)} · ${e(MODES[x.mode]||x.mode)}</p><p>التاريخ: ${e(day(x.exam_date))} · المحاولة ${e(x.attempt||1)} · حد النجاح ${e(fmt(x.pass_mark))}</p>
      ${x.scoring==='deduction'?`<p>أخطاء ${e(x.mistakes)} · ترددات ${e(x.hesitations)} · تنبيهات ${e(x.prompts)}</p>`:`<p>الأسئلة: ${(x.questions||[]).map(q=>e(fmt(q.score))+'/'+e(fmt(q.max))).join(' · ')}</p>`}
      ${x.notes?`<p>ملاحظات: ${e(x.notes)}</p>`:''}
      ${x.passed&&['admin','teacher'].includes(role())?`<p class="dn-muted">اجتاز الاختبار — أصدر شهادة اجتياز من صفحة «الشهادات».</p>`:''}`,
      can?R.btn('حذف الاختبار',`RC50.exams.del('${e(x.id)}')`,'danger'):'');
  };
  X.del=id=>NX.confirm('حذف الاختبار','سيُحذف هذا الاختبار نهائيًا.','حذف',async()=>{
    const r=await db.from('student_exams').delete().eq('id',id);if(r.error)return R.toast(r.error.message);
    R.closeSheet('dnExamD');R.toast('حُذف الاختبار');window.render&&render();
  },{danger:true});
  X.settings=()=>{
    const s=X.set,f=(id,l,v)=>`<label class="dn-field"><span>${l}</span><input id="${id}" class="dn-in" type="number" step="0.5" value="${e(v)}"></label>`;
    R.sheet('dnExamS','إعدادات الاختبار',f('esP','حد النجاح',s.pass_mark)+f('esE','ممتاز من',s.excellent)+f('esV','جيد جدًا من',s.very_good)+f('esG','جيد من',s.good)+f('esM','قيمة خصم الخطأ',s.mistake_weight)+f('esH','قيمة خصم التردد',s.hesitation_weight)+f('esQ','قيمة خصم التنبيه',s.prompt_weight),R.btn('حفظ','RC50.exams.saveSettings()'));
  };
  X.saveSettings=async()=>{
    const g=id=>num(document.getElementById(id).value),p=g('esP'),ex=g('esE'),v=g('esV'),gd=g('esG');
    if(!(p<=gd&&gd<=v&&v<=ex&&ex<=100))return R.toast('رتّب الحدود: النجاح ≤ جيد ≤ جيد جدًا ≤ ممتاز ≤ 100');
    const r=await db.from('exam_settings').update({pass_mark:p,excellent:ex,very_good:v,good:gd,mistake_weight:g('esM'),hesitation_weight:g('esH'),prompt_weight:g('esQ')}).eq('id',1);
    if(r.error)return R.toast(r.error.message);
    R.closeSheet('dnExamS');R.toast('حُفظت الإعدادات');window.render&&render();
  };

  // ---- association team ----
  R.page('team',{title:'فريق الجمعية',roles:['admin','supervisor'],render:async()=>{
    const [p,h,l]=await Promise.all([
      db.from('profiles').select('id,full_name,role,phone,active').in('role',['teacher','supervisor']).order('full_name').limit(500),
      db.from('halaqas').select('id,name').limit(300),db.from('halaqa_teachers').select('halaqa_id,teacher_id').limit(1500)]);
    if(p.error)return R.card(R.empty(p.error.message));
    const hn=Object.fromEntries((h.data||[]).map(x=>[x.id,x.name])),links=l.data||[];
    const row=m=>{const hs=links.filter(k=>k.teacher_id===m.id).map(k=>hn[k.halaqa_id]).filter(Boolean);
      return `<div class="dn-card"><b>${e(m.full_name)}</b><br><small>${m.role==='supervisor'?'مشرف':'محفّظ'+(hs.length?' · '+e(hs.join('، ')):' · بلا حلقة')}${m.phone?' · '+e(m.phone):''}${m.active===false?' · مجمَّد':''}</small></div>`};
    const all=p.data||[],sup=all.filter(m=>m.role==='supervisor'),tch=all.filter(m=>m.role==='teacher');
    return `<h3>المشرفون (${sup.length})</h3>${sup.map(row).join('')||R.empty('لا يوجد مشرفون')}<h3>المحفّظون (${tch.length})</h3>${tch.map(row).join('')||R.empty('لا يوجد محفّظون')}`;
  }});

  // ---- navigation ----
  const prevNav=window.navItems;
  window.navItems=function(){
    const items=prevNav.apply(this,arguments),r=role();
    if(!items.some(x=>x[0]==='exams')){
      const i=items.findIndex(x=>x[0]==='certificates'),ni=['exams',r==='guardian'?'اختبارات أبنائي':'الاختبارات'];
      items.splice(i<0?items.length:i+1,0,ni);
    }
    if(['admin','supervisor'].includes(r)&&!items.some(x=>x[0]==='team')){
      const i=items.findIndex(x=>x[0]==='approvals');items.splice(i<0?items.length:i+1,0,['team','فريق الجمعية']);
    }
    return items;
  };

  // ---- subscription banner (admin / supervisor) ----
  (async function(){
    try{
      await new Promise(r=>setTimeout(r,2500));
      if(!['admin','supervisor'].includes(role())||!navigator.onLine)return;
      const {data}=await db.rpc('rc66_my_subscription');if(!data)return;
      const days=data.days_left,w=data.writable!==false;let t='';
      if(!w)t='انتهى اشتراك الجمعية وفترة السماح: التطبيق للقراءة فقط. تواصل مع الإدارة للتجديد.';
      else if(days!=null&&days<0)t=`انتهى اشتراك الجمعية وأنت ضمن فترة السماح (${(data.grace_days||30)+days} يومًا متبقية).`;
      else if(days!=null&&days<=15)t=`ينتهي اشتراك الجمعية بعد ${days} يومًا.`;
      if(!t)return;
      const b=document.createElement('div');b.setAttribute('role','status');
      b.style.cssText='position:sticky;top:0;z-index:50;padding:8px 14px;font-weight:700;text-align:center;color:#fff;background:'+(w&&(days||0)>=0?'#F2B01E;color:#2a2000':'#C62828');
      b.textContent=t;document.body.prepend(b);
    }catch(_e){}
  })();
})();
