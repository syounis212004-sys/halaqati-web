/* Halaqati v2.63.22 — work scope (halaqa / program), program metadata and participants.
   Mirrors the native HalaqaScopeRules / WorkModeRules: a person works inside one halaqa or program,
   or inside the "halaqat" kind or the "programs" kind when both exist. */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const RC=window.RC27=window.RC27||{master:null,refs:null,memberships:[]};
  const TYPE_AR={regular:'حلقة',tajweed:'برنامج تجويد',tilawah:'برنامج تلاوة',training:'برنامج تدريب',course:'دورة',other:'برنامج'};
  window.RC27_TYPE_AR=TYPE_AR;
  const isProgram=x=>!!x&&!!x.halaqa_type&&x.halaqa_type!=='regular';
  window.rc27IsProgram=isProgram;
  const visibleHalaqas=()=>((RC.master&&RC.master.halaqas)||state.halaqas||[]).filter(x=>x.active!==false&&!x.archived_at);

  // ---------- Halaqa form / cards ----------
  window.rc27ToggleProgramFields=function(){const t=document.getElementById('hqType')?.value||'regular';document.querySelectorAll('#hqProgramBox .rc27-prog').forEach(e=>{e.style.display=t==='regular'?'none':''})};
  window.rc27FillHalaqaForm=function(x){
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v==null?'':v};
    set('hqType',x?.halaqa_type||'regular');set('hqStarts',x?.starts_on);set('hqEnds',x?.ends_on);set('hqSpec',x?.program_specialization);set('hqLevel',x?.program_level);set('hqAssess',x?.assessment_type);set('hqKind',x?.program_kind);
    const sec=document.getElementById('hqSecondary');if(sec)sec.checked=x?x.allow_secondary_members!==false:true;
    const ap=document.getElementById('hqAffectsPlan');if(ap)ap.checked=!!x?.affects_primary_plan;
    rc27ToggleProgramFields();
  };
  window.rc27ReadHalaqaForm=function(){
    const v=id=>document.getElementById(id)?.value||'',type=v('hqType')||'regular',starts=v('hqStarts')||null,ends=v('hqEnds')||null;
    if(starts&&ends&&ends<starts){toast('تاريخ النهاية قبل تاريخ البداية');return false}
    const prog=type!=='regular';
    return {halaqa_type:type,starts_on:prog?starts:null,ends_on:prog?ends:null,program_kind:prog?(v('hqKind').trim()||null):null,program_specialization:prog?(v('hqSpec')||null):null,program_level:prog?(v('hqLevel')||null):null,assessment_type:prog?(v('hqAssess')||null):null,allow_secondary_members:prog?!!document.getElementById('hqSecondary')?.checked:true,affects_primary_plan:prog?!!document.getElementById('hqAffectsPlan')?.checked:false};
  };
  window.rc27TypeBadge=x=>isProgram(x)?`<span class="badge rc27-prog-badge">${h(TYPE_AR[x.halaqa_type]||'برنامج')}</span>`:'';
  window.rc27ParticipantsButton=x=>(isProgram(x)&&typeof roleCanManage==='function'&&roleCanManage())?`<button class="mini" onclick="rc27OpenParticipants('${x.id}')">المشاركون</button>`:'';

  // ---------- Participants (student_halaqa_memberships) ----------
  function dlg(){let d=document.getElementById('rc27Dlg');if(!d){d=document.createElement('dialog');d.id='rc27Dlg';d.className='rc27-dlg';document.body.appendChild(d)}return d}
  const masterStudents=()=>(RC.master&&RC.master.students)||state.students||[];
  window.rc27OpenParticipants=async function(hid,filter=''){
    const d=dlg(),hq=state.halaqas.find(x=>x.id===hid);if(!hq)return;
    if(!d.open)d.showModal();
    d.innerHTML=`<div class="card"><h3>مشاركو ${h(hq.name)}</h3><div class="muted">جارٍ التحميل…</div></div>`;
    const {data,error}=await db.from('student_halaqa_memberships').select('id,student_id,status,membership_type,joined_at').eq('halaqa_id',hid);
    if(error){d.innerHTML=`<div class="card"><h3>المشاركون</h3><div class="notice">تعذر التحميل: ${h(error.message||error)}</div></div><div class="form-actions"><button class="btn btn-ghost" onclick="rc27CloseDlg()">إغلاق</button></div>`;return}
    const members=data||[],ms=new Map(members.map(m=>[m.student_id,m])),all=masterStudents();
    const rows=members.map(m=>{const s=all.find(x=>x.id===m.student_id);return `<div class="card"><div class="row"><div class="grow"><b>${h(s?.full_name||'طالب')}</b><div class="muted">${m.status==='active'?'نشط':m.status==='completed'?'أتم البرنامج':m.status==='withdrawn'?'منسحب':h(m.status)}</div></div>${m.status==='active'?`<button class="mini" onclick="rc27SetMember('${hid}','${m.id}','completed')">إتمام</button><button class="mini red" onclick="rc27SetMember('${hid}','${m.id}','withdrawn')">انسحاب</button>`:`<button class="mini" onclick="rc27SetMember('${hid}','${m.id}','active')">إعادة تفعيل</button>`}</div></div>`}).join('');
    const q=(typeof normalizeNameJs==='function'?normalizeNameJs:x=>String(x||'').toLowerCase())(filter);
    const cand=all.filter(s=>s.status!=='withdrawn'&&!ms.has(s.id)&&(!q||(typeof normalizeNameJs==='function'?normalizeNameJs(s.full_name):s.full_name).includes(q))).slice(0,30);
    d.innerHTML=`<div class="card"><h3>مشاركو ${h(hq.name)} (${members.filter(m=>m.status==='active').length})</h3><div class="muted">أضف طلابًا من أي حلقة ليشاركوا في هذا البرنامج.</div></div>${rows||'<div class="empty">لا يوجد مشاركون بعد.</div>'}<div class="card"><b>إضافة مشارك</b><input class="input" id="rc27PartSearch" placeholder="ابحث باسم الطالب" value="${h(filter)}" onchange="rc27OpenParticipants('${hid}',this.value)"><div class="rc27-chips" style="margin-top:8px">${cand.map(s=>`<span class="rc27-chip" onclick="rc27AddMember('${hid}','${s.id}')">+ ${h(s.full_name)}</span>`).join('')||'<span class="muted">لا نتائج</span>'}</div></div><div class="form-actions"><button class="btn btn-ghost" onclick="rc27CloseDlg();loadAll(true).then(()=>render())">إغلاق</button></div>`;
  };
  window.rc27AddMember=async function(hid,sid){
    const {error}=await db.from('student_halaqa_memberships').insert({student_id:sid,halaqa_id:hid,membership_type:'participant',status:'active'});
    if(error)return toast('تعذرت الإضافة: '+(error.message||error));toast('تمت إضافة المشارك');rc27OpenParticipants(hid);
  };
  window.rc27SetMember=async function(hid,mid,status){
    const {error}=await db.from('student_halaqa_memberships').update({status,ended_at:status==='active'?null:new Date().toISOString().slice(0,10)}).eq('id',mid);
    if(error)return toast('تعذر التحديث: '+(error.message||error));rc27OpenParticipants(hid);
  };

  // ---------- Scope resolution ----------
  const scopeKey=()=>'halaqati_scope_v1_'+(state.user?.id||'x');
  function saved(){try{return JSON.parse(localStorage.getItem(scopeKey())||'{}')}catch(_e){return {}}}
  function save(sc){try{localStorage.setItem(scopeKey(),JSON.stringify(sc))}catch(_e){}}
  function effective(){
    const hs=visibleHalaqas(),ids=hs.map(x=>x.id),sc=saved(),role=state.profile?.role||'';
    if(role==='guardian')return {selectedId:null,overview:false,switcher:false,mixed:false,kind:'regular',hs};
    const reg=hs.some(x=>!isProgram(x)),prog=hs.some(isProgram),mixed=reg&&prog;
    let selectedId=null,overview=false,switcher=hs.length>1;
    if(ids.length===1)selectedId=ids[0];
    else if(sc.halaqaId&&ids.includes(sc.halaqaId))selectedId=sc.halaqaId;
    else if(ids.length>1&&(role==='admin'||role==='supervisor'))overview=true;
    else if(ids.length>1)selectedId=ids[0];
    let kind=null;
    if(!selectedId){kind=mixed?(sc.kind==='program'?'program':'regular'):(prog?'program':'regular')}
    else kind=isProgram(hs.find(x=>x.id===selectedId))?'program':'regular';
    return {selectedId,overview,switcher,mixed,kind,hs};
  }
  window.rc27Scope=effective;
  window.rc27SelectScope=function(v){const sc=saved();sc.halaqaId=v||null;save(sc);applyScope();render()};
  window.rc27SelectKind=function(k){const sc=saved();sc.kind=k;sc.halaqaId=null;save(sc);applyScope();render()};

  function memberSet(hid){return new Set((RC.memberships||[]).filter(m=>m.halaqa_id===hid&&m.status==='active').map(m=>m.student_id))}
  function mergeBack(key,lastKey){
    const M=RC.master,cur=state[key]||[],curIds=new Set(cur.map(x=>x.id)),prev=RC[lastKey]||new Set();
    M[key]=M[key].filter(x=>!(prev.has(x.id)&&!curIds.has(x.id)));
    const idx=new Map(M[key].map((x,i)=>[x.id,i]));
    cur.forEach(x=>{if(idx.has(x.id))M[key][idx.get(x.id)]=x;else M[key].push(x)});
  }
  function applyScope(){
    const M=RC.master;if(!M)return;
    if(RC.refs&&state.students===RC.refs.students&&state.sessions===RC.refs.sessions){mergeBack('students','lastStu');mergeBack('sessions','lastSes')}
    const e=effective(),hs=e.hs,progIds=new Set(hs.filter(isProgram).map(x=>x.id)),regIds=new Set(hs.filter(x=>!isProgram(x)).map(x=>x.id));
    let sessOk=()=>true,stuOk=()=>true;
    if(e.selectedId){const mem=memberSet(e.selectedId);sessOk=s=>s.halaqa_id===e.selectedId;stuOk=s=>s.halaqa_id===e.selectedId||mem.has(s.id)}
    else if(e.mixed||(progIds.size&&regIds.size)){
      if(e.kind==='program'){const mem=new Set((RC.memberships||[]).filter(m=>m.status==='active'&&progIds.has(m.halaqa_id)).map(m=>m.student_id));sessOk=s=>progIds.has(s.halaqa_id);stuOk=s=>progIds.has(s.halaqa_id)||mem.has(s.id)}
      else{sessOk=s=>regIds.has(s.halaqa_id);stuOk=s=>regIds.has(s.halaqa_id)}
    }
    const students=M.students.filter(stuOk),ids=new Set(students.map(s=>s.id)),byStu=a=>(a||[]).filter(x=>!x.student_id||ids.has(x.student_id));
    state.students=students;state.sessions=M.sessions.filter(sessOk);state.goals=byStu(M.goals);state.monthly=byStu(M.monthly);
    state.leaderDaily=byStu(M.leaderDaily);state.leaderMonthly=byStu(M.leaderMonthly);state.dailySummary=byStu(M.dailySummary);
    if(state.homeMonthlyLoadedKey===(state.homeSelectedMonth||'')&&M.homeMonthly)state.homeMonthly=byStu(M.homeMonthly);
    RC.refs={students:state.students,sessions:state.sessions,monthly:state.monthly};RC.lastStu=new Set(state.students.map(x=>x.id));RC.lastSes=new Set(state.sessions.map(x=>x.id));
  }
  window.rc27ApplyScope=applyScope;

  async function afterLoad(){
    const fresh=!RC.refs||state.students!==RC.refs.students||state.sessions!==RC.refs.sessions;
    if(fresh){
      RC.master={halaqas:state.halaqas,students:state.students,sessions:state.sessions,goals:state.goals,monthly:state.monthly,leaderDaily:state.leaderDaily,leaderMonthly:state.leaderMonthly,dailySummary:state.dailySummary,homeMonthly:state.homeMonthly};
      if(navigator.onLine&&state.networkVerified){
        try{const r=await db.from('student_halaqa_memberships').select('student_id,halaqa_id,status').limit(10000);if(!r.error)RC.memberships=r.data||[]}catch(_e){}
        const e=effective();
        if(e.selectedId&&!RC.master.sessions.some(s=>s.halaqa_id===e.selectedId)){
          try{const r=await db.from('sessions').select('*').eq('halaqa_id',e.selectedId).order('session_date',{ascending:false}).limit(120);if(!r.error&&r.data?.length){const seen=new Set(RC.master.sessions.map(s=>s.id));RC.master.sessions=[...RC.master.sessions,...r.data.filter(s=>!seen.has(s.id))]}}catch(_e){}
        }
      }
    }
    applyScope();
  }
  if(typeof loadAll==='function'){
    const baseLoad=loadAll;
    loadAll=async function(){const r=await baseLoad.apply(this,arguments);try{await afterLoad()}catch(e){console.warn('rc27 scope',e)}return r};
  }

  // ---------- Scope bar + overview ----------
  const SCOPED_PAGES=['home','sessions','students','plans','reports','certificates','ranking'];
  function barHtml(){
    const e=effective();if(!e.switcher||state.profile?.role==='guardian')return '';
    const hs=e.hs,reg=hs.filter(x=>!isProgram(x)),prog=hs.filter(isProgram);
    const opt=x=>`<option value="${x.id}" ${e.selectedId===x.id?'selected':''}>${h(x.name)}</option>`;
    const group=(label,list)=>list.length?`<optgroup label="${label}">${list.map(opt).join('')}</optgroup>`:'';
    const kinds=(e.mixed&&!e.selectedId)?`<div class="rc27-kinds"><button class="${e.kind==='regular'?'active':''}" onclick="rc27SelectKind('regular')">الحلقات</button><button class="${e.kind==='program'?'active':''}" onclick="rc27SelectKind('program')">البرامج</button></div>`:'';
    return `<div class="rc27-scope"><select aria-label="نطاق العمل" onchange="rc27SelectScope(this.value)"><option value="">${e.mixed?'كل الحلقات والبرامج':'كل الحلقات'}</option>${group('الحلقات',reg)}${group('البرامج',prog)}</select>${kinds}</div>`;
  }
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const r=await baseRender.apply(this,arguments);
      try{
        const c=document.getElementById('content');
        if(c&&SCOPED_PAGES.includes(state.page)&&!state.sessionView&&state.profile&&!c.querySelector('.rc27-scope')){const b=barHtml();if(b)c.insertAdjacentHTML('afterbegin',b)}
      }catch(e){console.warn('rc27 bar',e)}
      return r;
    };
  }
  window.rc27OverviewHtml=function(){
    const e=effective();if(!e.overview)return '';
    const today=(typeof window.today==='function'?window.today():new Date().toISOString().slice(0,10)),M=RC.master||{sessions:state.sessions,students:state.students};
    const rows=e.hs.map(x=>{const ss=M.sessions.filter(s=>s.halaqa_id===x.id),mem=memberSet(x.id);return {x,count:M.students.filter(s=>s.status!=='withdrawn'&&(s.halaqa_id===x.id||mem.has(s.id))).length,todayS:ss.some(s=>String(s.session_date).startsWith(today)),last:ss.map(s=>s.session_date).sort().pop()||null,n:ss.length}});
    return `<div class="section-head"><h3>نظرة عامة على الحلقات</h3></div>${rows.map(r=>`<div class="card rc27-ov" onclick="rc27SelectScope('${r.x.id}')"><div class="row"><div class="grow"><b>${h(r.x.name)}</b> ${rc27TypeBadge(r.x)}<div class="muted">${r.count} طالب · ${r.n} جلسة${r.last?` · آخر جلسة ${h(r.last)}`:''}</div></div><span class="badge ${r.todayS?'ok':''}">${r.todayS?'جلسة اليوم':'لا جلسة اليوم'}</span></div></div>`).join('')}`;
  };

  // ---------- Grouped lists (halaqa then month) ----------
  const monthName=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  function monthLabel(k){return k==='0000-00'?'بدون تاريخ':`${monthName[Number(k.slice(5,7))-1]||''} ${k.slice(0,4)}`}
  function groupByMonth(rows,dateOf){const m=new Map;rows.forEach(r=>{const d=String(dateOf(r)||'');const k=/^\d{4}-\d{2}/.test(d)?d.slice(0,7):'0000-00';(m.get(k)||m.set(k,[]).get(k)).push(r)});return [...m.entries()].sort((a,b)=>a[0]==='0000-00'?1:b[0]==='0000-00'?-1:b[0].localeCompare(a[0]))}
  function openKeys(keys){const d=new Date(),cur=d.toISOString().slice(0,7);d.setMonth(d.getMonth()-1);const prev=d.toISOString().slice(0,7);const o=keys.filter(k=>k===cur||k===prev);return o.length?new Set(o):new Set(keys.filter(k=>k!=='0000-00').slice(0,1))}
  window.rc27GroupSessions=function(rows,render1){
    const hq=id=>state.halaqas.find(x=>x.id===id),byH=new Map;rows.forEach(s=>(byH.get(s.halaqa_id)||byH.set(s.halaqa_id,[]).get(s.halaqa_id)).push(s));
    return [...byH.entries()].map(([hid,list])=>{
      const months=groupByMonth(list,s=>s.session_date),op=openKeys(months.map(m=>m[0]));
      const inner=months.map(([k,items])=>`<details class="rc27-month" ${op.has(k)?'open':''}><summary>${h(monthLabel(k))} <span>${items.length}</span></summary>${render1(items)}</details>`).join('');
      return byH.size>1?`<div class="rc27-hgroup"><div class="rc27-hhead">${h(hq(hid)?.name||'حلقة')} ${rc27TypeBadge(hq(hid))}<span>${list.length}</span></div>${inner}</div>`:inner;
    }).join('');
  };
  if(typeof sessionCards==='function'){
    const baseSC=sessionCards;
    sessionCards=function(rows){
      if(arguments.length&&rows!==state.sessions)return baseSC.apply(this,arguments);
      if(!state.sessions.length)return baseSC.call(this,state.sessions);
      return rc27GroupSessions(state.sessions,items=>baseSC.call(this,items));
    };
  }
  if(typeof studentCards==='function'){
    const baseST=studentCards;
    studentCards=function(rows,selectable){
      const list=rows||activeStudents();
      const groups=new Map;list.forEach(s=>(groups.get(s.halaqa_id)||groups.set(s.halaqa_id,[]).get(s.halaqa_id)).push(s));
      if(groups.size<2||list.length<2)return baseST.apply(this,arguments);
      return [...groups.entries()].map(([hid,items])=>{const x=state.halaqas.find(y=>y.id===hid);return `<div class="rc27-hgroup"><div class="rc27-hhead">${h(x?.name||'بدون حلقة')} ${rc27TypeBadge(x)}<span>${items.length}</span></div>${baseST.call(this,items,selectable)}</div>`}).join('');
    };
  }

  // ---------- Home overview ----------
  if(typeof homePage==='function'){
    const baseHome=homePage;
    homePage=function(){const r=baseHome.apply(this,arguments);if(state.profile?.role==='guardian')return r;const o=rc27OverviewHtml();return o?r+o:r};
  }

  // ---------- Session types follow the halaqa kind (programs: tilawah / test / lesson only) ----------
  window.rc27FilterSessionTypes=function(){
    const hq=state.halaqas.find(x=>x.id===document.getElementById('sessionHalaqa')?.value),prog=isProgram(hq),sel=document.getElementById('sessionType');if(!sel)return;
    const hifz=['tasmee','sard','review','tajweed'];
    [...sel.options].forEach(o=>{const hide=prog?hifz.includes(o.value):o.value==='tilawah';o.hidden=hide;o.disabled=hide});
    if(sel.selectedOptions[0]?.disabled){const ok=[...sel.options].find(o=>!o.disabled);if(ok){sel.value=ok.value;try{updateSessionActivityFields()}catch(_e){}}}
  };
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='sessionHalaqa')rc27FilterSessionTypes()});
  if(typeof openSession==='function'){
    const baseOpen=openSession;
    openSession=function(){const r=baseOpen.apply(this,arguments);setTimeout(rc27FilterSessionTypes,0);return r};
  }

  // ---------- Quick recitation buttons follow the student / session kind (native SessionWorkflowRules) ----------
  window.rc27QuickButtons=function(st,se){
    const hq=state.halaqas.find(x=>x.id===se?.halaqa_id),b=(type,label)=>`<button onclick="quickOpenRecitation('${st.id}','${se.id}','${type}')">+ ${label}</button>`;
    if(isProgram(hq))return `<div class="quick-rec-buttons">${b('tilawah','تلاوة')}${b('test','اختبار')}</div>`;
    if(st.track_code==='tathbit')return `<div class="quick-rec-buttons">${b('review_far','تثبيت')}</div>`;
    return `<div class="quick-rec-buttons">${b('new_hifz','حفظ')}${b('review_near','مراجعة')}${b('sard','سرد')}</div>`;
  };
})();
