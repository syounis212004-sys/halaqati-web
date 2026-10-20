/* Halaqati RC27.47 — web twin of the app's registration / approval hierarchy (RC27.42-47):
   • CompleteSignupScreen after the first sign-in (name, phone, account type, guardian: child's id + birth date)
   • waiting screen with the real approval stage + "retry linking the child"
   • ApprovalsScreen (طلبات الاعتماد) with the identity-fill section (list, search, paste from Excel) + home inbox card
   • guardian "add a child" dialog, weekly summary card, "ناقص: الهوية" badge helper.
   Only the RPCs the app calls: rc_complete_signup, rc_request_guardian_link, rc_my_signup_status, rc_pending_requests,
   rc_review_request (+ the best-effort push_approval_events edge call). No schema or data changes. */
(function(){
  'use strict';
  const NX=window.NX,h=NX.h,ic=NX.icon;
  const today=()=>new Date().toISOString().slice(0,10);
  const online=()=>navigator.onLine&&state.networkVerified!==false&&!state.offline;
  const role=()=>state.profile?.role;
  const ROLE_AR={guardian:'ولي أمر',teacher:'محفّظ',supervisor:'مشرف حلقات'};
  const friendly=e=>{const m=String(e?.message||e||'');return /Could not find the function|PGRST202/i.test(m)?'لم يُطبَّق تحديث قاعدة البيانات الخاص بالاعتماد بعد. تواصل مع مسؤول النظام.':(m||'تعذر تنفيذ العملية')};
  async function rpc(name,args){const r=await db.rpc(name,args||{});if(r.error)throw r.error;return r.data}
  const latin=s=>String(s||'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));

  // ---------- IdentityImport (port of IdentityImport.kt) ----------
  const normName=s=>String(s||'').trim().replace(/[ً-ٰٟـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').toLowerCase();
  function parseDate(raw){
    const t=latin(raw).trim().replace(/[\/.]/g,'-'),iso=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t),dmy=/^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(t);
    let y,m,d;if(iso){y=+iso[1];m=+iso[2];d=+iso[3]}else if(dmy){d=+dmy[1];m=+dmy[2];y=+dmy[3]}else return null;
    const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
    const s=dt.toISOString().slice(0,10);return (s>today()||y<1950)?null:s;
  }
  function parseList(text){
    const rows=[];let bad=0;
    String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(line=>{
      const cells=line.split(/[\t,;|]/).map(c=>c.trim()).filter(Boolean),nid=cells[1]?latin(cells[1]).replace(/\D/g,''):'',date=cells[2]?parseDate(cells[2]):null;
      if(cells.length>=3&&nid.length>=5&&date)rows.push({name:cells[0],nid,date});else bad++;
    });
    return {rows,bad};
  }
  window.NXIdentity={normName,parseDate,parseList,missing:st=>st.status==='active'&&(!String(st.national_id||'').trim()||!String(st.date_of_birth||'').trim()),
    lacks:st=>[!String(st.national_id||'').trim()?'الهوية':'',!String(st.date_of_birth||'').trim()?'تاريخ الميلاد':''].filter(Boolean).join(' و')};

  // ---------- complete signup ----------
  const SU={role:'guardian',err:null,busy:false};
  function signupHtml(p){
    const chips=NX.chips(['guardian','teacher','supervisor'].map(r=>({label:ROLE_AR[r],selected:SU.role===r,onclick:`NXSignup.role('${r}')`})),{wrap:true});
    const guardian=SU.role==='guardian'?`<p class="nx-confirm-text">ولي الأمر يربط ابنه برقم الهوية وتاريخ الميلاد. يمر الطلب بموافقة محفّظ الحلقة ثم تأكيد مسؤول النظام.</p>${NX.field('رقم هوية الطالب',{id:'nxSuNid',inputmode:'numeric'})}${NX.field('تاريخ ميلاد الطالب',{id:'nxSuDob',type:'date',max:today()})}`:'';
    return `<div class="nx-stack"><h2 class="nx-su-t">إكمال الحساب</h2><p class="nx-confirm-text">أكمل بياناتك لإرسال طلب الاعتماد. ${SU.role==='guardian'?'سيراجع المحفّظ ثم المسؤول طلبك.':SU.role==='teacher'?'يعتمدك المشرف أو مسؤول النظام.':'يعتمدك مسؤول النظام.'}</p>
      ${NX.field('الاسم الكامل',{id:'nxSuName',value:(p.full_name&&p.full_name!=='مستخدم جديد'&&!String(p.full_name).includes('@'))?p.full_name:''})}
      ${NX.field('رقم الجوال',{id:'nxSuPhone',type:'tel',inputmode:'tel'})}
      <div class="nx-t-title-s">نوع الحساب</div>${chips}${guardian}
      ${SU.err?NX.notice(h(SU.err),'danger'):''}
      ${NX.btn(SU.busy?'جارٍ الإرسال…':'إرسال طلب الاعتماد',{full:true,disabled:SU.busy,onclick:'NXSignup.submit()'})}
      ${NX.btn('تسجيل الخروج',{kind:'text',onclick:'logout()'})}</div>`;
  }
  function showSignup(p){
    if(typeof hideAuthForms==='function')hideAuthForms();
    let box=document.getElementById('nxSignupPanel');
    if(!box){box=document.createElement('div');box.id='nxSignupPanel';box.className='approval-panel nx-su';(document.getElementById('pendingPanel')||document.getElementById('auth')).insertAdjacentElement('afterend',box)}
    SU.role=['guardian','teacher','supervisor'].includes(p.requested_role)?p.requested_role:SU.role;
    box.classList.remove('hidden');box.innerHTML=signupHtml(p);
  }
  function keepForm(){const g=id=>document.getElementById(id)?.value||'';return {name:g('nxSuName'),phone:g('nxSuPhone'),nid:g('nxSuNid'),dob:g('nxSuDob')}}
  window.NXSignup={
    role(r){const f=keepForm();SU.role=r;SU.err=null;showSignup({...state.profile,full_name:f.name||state.profile?.full_name});const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v};set('nxSuName',f.name);set('nxSuPhone',f.phone)},
    async submit(){
      const f=keepForm(),nid=latin(f.nid).replace(/\D/g,'');
      if(f.name.trim().length<3)return fail('اكتب الاسم الكامل (3 أحرف على الأقل)');
      if(SU.role==='guardian'){if(nid.length<5)return fail('رقم الهوية غير صالح');if(!f.dob||f.dob>today())return fail('اختر تاريخ ميلاد صحيحًا')}
      if(!online())return fail('إكمال الحساب يحتاج اتصالًا بالإنترنت');
      SU.busy=true;SU.err=null;repaint(f);
      try{
        const res=await rpc('rc_complete_signup',{p_name:f.name.trim(),p_phone:f.phone.trim(),p_role:SU.role,p_national_id:SU.role==='guardian'?nid:null,p_birth_date:SU.role==='guardian'?f.dob:null});
        if(res&&res.ok===false){SU.err=res.error||'تعذر إكمال الحساب'}
        else{SU.busy=false;if(typeof refreshFromServer==='function')await refreshFromServer({renderAfter:true});else if(typeof checkApproval==='function')await checkApproval();return}
      }catch(e){SU.err=friendly(e)}
      SU.busy=false;repaint(f);
      function fail(m){SU.err=m;repaint(f);return false}
    }
  };
  function repaint(f){showSignup(state.profile||{});const set=(id,v)=>{const e=document.getElementById(id);if(e&&v)e.value=v};set('nxSuName',f.name);set('nxSuPhone',f.phone);set('nxSuNid',f.nid);set('nxSuDob',f.dob)}

  // waiting screen: real stage text + retry linking for guardians
  async function decoratePending(p){
    const box=document.getElementById('pendingPanel');if(!box)return;
    document.getElementById('nxSignupPanel')?.classList.add('hidden');
    const rejected=p.approval_status==='rejected',blocked=p.approval_status==='approved'&&!p.active;
    if(!rejected&&!blocked&&online()){
      try{const r=await rpc('rc_my_signup_status');const t=r&&r.text;if(t){const el=document.getElementById('pendingText');if(el)el.textContent=`${t}. الوصول إلى بيانات الحلقة لن يفتح حتى يكتمل الاعتماد.`}}catch(_e){}
    }
    const guardian=(p.requested_role==='guardian'||p.role==='guardian');
    if(guardian&&!rejected&&!blocked&&!document.getElementById('nxRetryLink')){
      const b=document.createElement('div');b.id='nxRetryLink';b.className='nx-su-retry';b.innerHTML=NX.btn('إعادة محاولة ربط الطالب',{kind:'outlined',icon:'PersonAdd',full:true,onclick:'NXApprovals.addChild(true)'});box.appendChild(b);
    }
  }
  if(typeof showAccessStatus==='function'){
    const base=showAccessStatus;
    showAccessStatus=function(p){
      if(p&&p.approval_status==='pending'&&p.onboarded===false){showSignup(p);return}
      const r=base.apply(this,arguments);decoratePending(p);return r;
    };
  }
  if(typeof hideAuthForms==='function'){const baseHide=hideAuthForms;hideAuthForms=function(){baseHide.apply(this,arguments);document.getElementById('nxSignupPanel')?.classList.add('hidden');document.getElementById('nxRetryLink')?.remove()}}

  // ---------- add a child (guardian) ----------
  function addChild(retry){
    NX.dialog('nxAddChild',retry?'إعادة محاولة ربط الطالب':'ربط ابن/ابنة',`<p class="nx-confirm-text">أدخل رقم هوية الطالب وتاريخ ميلاده. يمر الطلب بموافقة المحفّظ ثم تأكيد مسؤول النظام.</p>${NX.field('رقم هوية الطالب',{id:'nxAcNid',inputmode:'numeric'})}${NX.field('تاريخ ميلاد الطالب',{id:'nxAcDob',type:'date',max:today()})}<div id="nxAcMsg"></div>`,{cls:'nx-small-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nxAddChild')"})}${NX.btn('إرسال الطلب',{onclick:'NXApprovals.sendChild()',id:'nxAcGo'})}`});
  }
  async function sendChild(){
    const nid=latin(document.getElementById('nxAcNid').value).replace(/\D/g,''),dob=document.getElementById('nxAcDob').value,msg=document.getElementById('nxAcMsg'),go=document.getElementById('nxAcGo');
    const show=(t,k)=>{msg.innerHTML=NX.notice(h(t),k)};
    if(nid.length<5)return show('رقم الهوية غير صالح','danger');
    if(!dob||dob>today())return show('تاريخ الميلاد غير صحيح','danger');
    if(!online())return show('الطلب يحتاج اتصالًا بالإنترنت','danger');
    go.disabled=true;
    try{const res=await rpc('rc_request_guardian_link',{p_national_id:nid,p_birth_date:dob});
      if(res&&res.ok===false){show(res.error||'تعذر إرسال الطلب','danger');go.disabled=false;return}
      NX.closeDialog('nxAddChild');toast('تم إرسال الطلب وبانتظار الاعتماد');
    }catch(e){show(friendly(e),'danger');go.disabled=false}
  }

  // ---------- approvals page ----------
  const A={items:[],loading:false,msg:null,err:false,busy:null,idOpen:false,idQuery:'',idExp:null,idNote:null};
  const stageAr=r=>r.kind==='link'&&r.stage==='teacher'?'بانتظار موافقة المحفّظ':r.kind==='link'&&r.stage==='admin'?`وافق المحفّظ${r.teacher_name?` (${h(r.teacher_name)})`:''} · بانتظار التأكيد`:'طلب حساب جديد';
  async function load(){
    A.loading=true;paint();
    try{const d=await rpc('rc_pending_requests');A.items=Array.isArray(d)?d:[];A.msg=null}
    catch(e){A.err=true;A.msg=/rc_pending_requests/i.test(String(e?.message))?'لم يُطبَّق تحديث قاعدة البيانات الخاص بالاعتماد بعد.':friendly(e)}
    A.loading=false;paint();
  }
  async function review(kind,id,approve,reason){
    if(!online()){A.err=true;A.msg='المراجعة تحتاج اتصالًا مباشرًا بالخادم';return paint()}
    A.busy=id;paint();
    const req=A.items.find(r=>r.id===id);
    try{
      const res=await rpc('rc_review_request',{p_kind:kind,p_id:id,p_action:approve?'approve':'reject',p_reason:(reason||'').trim()||null});
      if(res&&res.ok===false){A.err=true;A.msg=res.error||'تعذر تنفيذ العملية'}
      else{A.err=false;A.msg=approve?`تمت الموافقة على طلب ${req?.name||''}`:`تم رفض طلب ${req?.name||''}`;try{db.functions.invoke('halaqati-notify',{body:{action:'push_approval_events'}}).catch(()=>{})}catch(_e){}}
    }catch(e){A.err=true;A.msg=friendly(e)}
    A.busy=null;load();
  }
  function reject(id,name){
    NX.dialog('nxReject',`رفض طلب ${h(name)}`,NX.field('سبب الرفض (اختياري)',{html:'<textarea id="nxRejReason"></textarea>'}),{cls:'nx-small-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nxReject')"})}${NX.btn('تأكيد الرفض',{kind:'danger',onclick:`NXApprovals.doReject('${id}')`})}`});
  }
  function card(r){
    const b=A.busy!=null;
    return NX.card(`<div class="nx-stack-s"><div class="nx-row"><span class="nx-metric-ic">${ic(r.kind==='link'?'FamilyRestroom':'PersonAdd',24)}</span><div class="nx-grow"><div class="nx-t-title-m">${h(r.name||'بدون اسم')}</div><div class="nx-t-body-s nx-muted">${ROLE_AR[r.role]||'مستخدم'}${r.email?' · '+h(r.email):''}</div></div></div>
      ${r.kind==='link'?`<div class="nx-t-body-m">الطالب: ${h(r.student||'')}${r.halaqa?' · '+h(r.halaqa):''}</div>`:''}
      ${r.phone?`<div class="nx-t-body-s nx-muted">الجوال: ${h(r.phone)}</div>`:''}
      ${NX.pill(stageAr(r),'info')}
      <div class="nx-row">${NX.btn(r.kind==='link'&&role()==='admin'?'تأكيد وربط':'موافقة',{disabled:b,cls:'nx-grow',onclick:`NXApprovals.review('${r.kind}','${r.id}',true)`})}${NX.btn('رفض',{kind:'outlined',disabled:b,cls:'nx-grow',onclick:`NXApprovals.reject('${r.id}','${h(String(r.name||'').replace(/'/g,''))}')`})}</div></div>`,{cls:'nx-emph'});
  }
  // identity-fill section
  function idMissing(){return (window.RC27?.master?.students||state.students||[]).filter(NXIdentity.missing).sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'ar'))}
  function identity(){
    const miss=idMissing();if(!miss.length)return '';
    const q=normName(A.idQuery),shown=miss.filter(s=>!q||normName(s.full_name).includes(q)).slice(0,200);
    let body='';
    if(A.idOpen){
      body=`${NX.btn('لصق قائمة من Excel',{kind:'outlined',full:true,icon:'ContentPasteGo',onclick:'NXApprovals.paste()'})}${NX.search(A.idQuery,'بحث باسم الطالب',{oninput:'NXApprovals.idSearch(this.value)',id:'nxIdSearch'})}
      <div class="nx-id-list">${shown.map(s=>{const open=A.idExp===s.id;return `<div class="nx-id-row"><button type="button" class="nx-id-head" onclick="NXApprovals.idToggle('${s.id}')"><div class="nx-grow"><div class="nx-t-title-s">${h(s.full_name)}</div><div class="nx-t-body-s nx-muted">ناقص: ${NXIdentity.lacks(s)}</div></div>${ic(open?'KeyboardArrowUp':'KeyboardArrowDown',22)}</button>${open?`<div class="nx-id-form">${NX.field('رقم الهوية',{id:'nxId_'+s.id,value:s.national_id||'',inputmode:'numeric'})}${NX.field('تاريخ الميلاد',{id:'nxDob_'+s.id,type:'date',max:today(),value:s.date_of_birth?String(s.date_of_birth).slice(0,10):''})}<div id="nxIdErr_${s.id}"></div>${NX.btn('حفظ',{full:true,onclick:`NXApprovals.idSave('${s.id}')`})}</div>`:''}</div>`}).join('')||'<p class="nx-t-body-s nx-muted">لا نتائج مطابقة.</p>'}</div>`;
    }
    return NX.card(`<div class="nx-stack-s"><button type="button" class="nx-id-head nx-id-top" onclick="NXApprovals.idOpenToggle()"><div class="nx-grow"><div class="nx-t-title-m">بيانات هوية الطلاب (${miss.length} ناقصة)</div><div class="nx-t-body-s nx-muted">ربط أولياء الأمور برقم الهوية وتاريخ الميلاد يحتاج هذه البيانات.</div></div>${ic(A.idOpen?'KeyboardArrowUp':'KeyboardArrowDown',22)}</button>${A.idNote?NX.notice(h(A.idNote),'success'):''}${body}</div>`);
  }
  function pageHtml(){
    const sub=role()==='admin'?'طلبات الحسابات الجديدة وطلبات ربط أولياء الأمور بالطلاب.':role()==='supervisor'?'طلبات المحفّظين الجدد. اعتماد المشرفين وأولياء الأمور من مسؤول النظام.':'طلبات أولياء الأمور المرتبطة بطلاب حلقتك. بعد موافقتك يؤكد مسؤول النظام.';
    return `<div class="nx-approvals"><div class="nx-section"><div><h3>طلبات الاعتماد</h3><div class="nx-t-body-s nx-muted">${sub}</div></div>${NX.iconBtn('Refresh',{title:'تحديث',onclick:'NXApprovals.load()',tile:true})}</div>
      <div class="nx-stack">${identity()}${A.msg?NX.notice(h(A.msg),A.err?'danger':'success'):''}${A.loading&&!A.items.length?NX.skeleton(3):!A.items.length?NX.empty('لا توجد طلبات بانتظارك الآن',{icon:'PersonSearch'}):`<div class="nx-appr-grid">${A.items.map(card).join('')}</div>`}</div></div>`;
  }
  function paint(){if(state.page!=='approvals')return;const c=document.getElementById('content');if(!c)return;const keep=document.activeElement?.id==='nxIdSearch'?{s:document.activeElement.selectionStart}:null;c.innerHTML=pageHtml();if(keep){const e=document.getElementById('nxIdSearch');e?.focus();try{e?.setSelectionRange(keep.s,keep.s)}catch(_e){}}}
  window.NXApprovals={
    load,review,reject,addChild,sendChild,paint,
    doReject(id){const r=A.items.find(x=>x.id===id),why=document.getElementById('nxRejReason')?.value||'';NX.closeDialog('nxReject');review(r?.kind||'account',id,false,why)},
    idOpenToggle(){A.idOpen=!A.idOpen;paint()},idToggle(id){A.idExp=A.idExp===id?null:id;paint()},idSearch(v){A.idQuery=v;paint()},
    async idSave(id){
      const nid=latin(document.getElementById('nxId_'+id)?.value).replace(/\D/g,''),dob=document.getElementById('nxDob_'+id)?.value||'',err=document.getElementById('nxIdErr_'+id);
      const show=t=>{err.innerHTML=NX.notice(h(t),'danger')};
      if(nid.length<5)return show('رقم الهوية غير صالح');if(!dob||dob>today())return show('اختر تاريخ ميلاد صحيحًا');
      const s=(state.students||[]).find(x=>x.id===id);
      try{await patchStudentsOfflineFirst([id],{national_id:nid,date_of_birth:dob});A.idExp=null;A.idNote=`تم حفظ ${s?.full_name||''} · المتبقي ${idMissing().length}`;paint()}catch(e){show(String(e?.message||e))}
    },
    paste(){
      NX.dialog('nxIdPaste','لصق قائمة الهويات',`<p class="nx-confirm-text">انسخ من Excel ثلاثة أعمدة: الاسم، رقم الهوية، تاريخ الميلاد، والصقها هنا. يُطابَق الاسم مع الطلاب الناقصين ثم تُحفظ دفعة واحدة.</p>${NX.field('الصق هنا',{html:'<textarea id="nxPasteTa" rows="7" oninput="NXApprovals.pasteChange()"></textarea>'})}<div id="nxPasteInfo"></div>`,{footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nxIdPaste')"})}${NX.btn('حفظ',{id:'nxPasteGo',disabled:true,onclick:'NXApprovals.pasteSave()'})}`});
    },
    pasteMatch(){
      const text=document.getElementById('nxPasteTa')?.value||'',p=parseList(text),by={};idMissing().forEach(s=>{(by[normName(s.full_name)]||(by[normName(s.full_name)]=[])).push(s)});
      const ok=p.rows.filter(r=>(by[normName(r.name)]||[]).length===1),no=p.rows.filter(r=>(by[normName(r.name)]||[]).length!==1);
      return {p,ok,no,by};
    },
    pasteChange(){
      const m=this.pasteMatch(),info=document.getElementById('nxPasteInfo'),go=document.getElementById('nxPasteGo');
      if(!document.getElementById('nxPasteTa').value.trim()){info.innerHTML='';go.disabled=true;go.querySelector('span').textContent='حفظ';return}
      info.innerHTML=NX.notice(`جاهز للحفظ: ${m.ok.length} · غير مطابق: ${m.no.length} · أسطر غير مقروءة: ${m.p.bad}`,'info')+(m.no.length?`<p class="nx-t-body-s nx-muted">غير مطابق: ${m.no.slice(0,6).map(r=>h(r.name)).join('، ')}</p>`:'');
      go.disabled=!m.ok.length;go.querySelector('span').textContent=`حفظ ${m.ok.length}`;
    },
    async pasteSave(){
      const m=this.pasteMatch();if(!m.ok.length)return;const go=document.getElementById('nxPasteGo');go.disabled=true;
      for(const r of m.ok){const s=m.by[normName(r.name)][0];try{await patchStudentsOfflineFirst([s.id],{national_id:r.nid,date_of_birth:r.date})}catch(_e){}}
      NX.closeDialog('nxIdPaste');A.idNote=`تم حفظ ${m.ok.length} طالبًا · المتبقي ${idMissing().length}`;paint();
    }
  };

  // ---------- wiring: nav item, page, home card, titles ----------
  const canReview=()=>['admin','supervisor','teacher'].includes(role());
  if(window.RC27_ICONS)window.RC27_ICONS.approvals=ic('PersonAdd',24);
  if(typeof navItems==='function'){
    const baseNav=navItems;
    navItems=function(){const r=baseNav.apply(this,arguments);if(canReview()&&Array.isArray(r)&&!r.some(x=>x[0]==='approvals')){const i=r.findIndex(x=>x[0]==='users'||x[0]==='halaqas');r.splice(i>=0?i+1:r.length,0,['approvals','طلبات الاعتماد'])}return r};
  }
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const r=await baseRender.apply(this,arguments);
      try{
        if(state.page==='approvals'&&canReview()){const t=document.getElementById('pageTitle');if(t)t.textContent='طلبات الاعتماد';paint();if(!A.loadedAt||Date.now()-A.loadedAt>20000){A.loadedAt=Date.now();load()}}
        else if(state.page==='home'&&canReview())homeCard();
        else if(state.page==='home'&&role()==='guardian')guardianExtras();
      }catch(e){console.warn('approvals',e)}
      return r;
    };
  }
  let cnt={n:0,at:0};
  async function homeCard(){
    if(!online())return;
    const put=()=>{const c=document.getElementById('content');if(!c||state.page!=='home'||c.querySelector('.nx-appr-home'))return;if(!cnt.n)return;
      const el=document.createElement('div');el.className='nx-appr-home';el.innerHTML=NX.insight('info','PersonAdd','طلبات اعتماد بانتظارك',`${cnt.n} طلب بحاجة إلى مراجعتك`,{onclick:"go('approvals')",count:cnt.n});
      const host=c.querySelector('.dk-aside')||c.querySelector('.nh-aside')||c.firstElementChild;if(host)host.insertAdjacentElement(host.classList.contains('dk-aside')||host.classList.contains('nh-aside')?'afterbegin':'afterend',el)};
    if(Date.now()-cnt.at>60000){cnt.at=Date.now();try{const d=await rpc('rc_pending_requests');cnt.n=Array.isArray(d)?d.length:0}catch(_e){cnt.n=0}}
    put();
  }
  function guardianExtras(){
    const t=setInterval(()=>{const box=document.getElementById('rc27GOv');if(!box||state.page!=='home'){clearInterval(t);return}
      if(box.querySelector('.nx-addchild')||!box.querySelector('.nh-gside'))return;
      box.querySelector('.nh-gside').insertAdjacentHTML('beforeend',`<div class="nx-addchild">${NX.btn('إضافة ابن/ابنة',{kind:'outlined',icon:'PersonAdd',full:true,onclick:'NXApprovals.addChild(false)'})}</div>`);clearInterval(t)},400);
    setTimeout(()=>clearInterval(t),8000);
  }
})();
