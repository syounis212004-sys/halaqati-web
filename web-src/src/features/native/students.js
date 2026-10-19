/* RC27.40 native screens: students — web twin of StudentsScreen / GoldenStudentCard / StudentDetailSheet /
   StudentEditorDialog / GuardianLinkDialog / StudentProfileScreen / StudentFollowUpScreen (CoreScreens.kt,
   StudentProfileScreen.kt, StudentFollowUpScreen.kt). Data layer = the legacy web handlers (saveMasterLocal,
   restoreStudent, openDailyForStudent, openPlan, bulk*…); markup = the NX kit. Desktop = data table + side panel. */
(function(){
  'use strict';
  if(typeof NX==='undefined'||typeof studentsPage!=='function')return;
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ic=(n,s,c)=>typeof mi==='function'?mi(n,s,c):'';
  const $id=id=>document.getElementById(id);
  const isDk=()=>document.documentElement.getAttribute('data-view')==='desktop';
  const manage=()=>typeof canManageStudents==='function'&&canManageStudents();
  const staff=()=>typeof roleCanManage==='function'&&roleCanManage();
  const online=()=>navigator.onLine&&state.networkVerified!==false&&!state.offline;
  const N=v=>{v=Number(v);if(!isFinite(v))return '0';return Math.abs(v-Math.round(v))<.005?String(Math.round(v)):String(Math.round(v*10)/10)};
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const P=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?new Date(+m[1],+m[2]-1,+m[3],12):null};
  const addD=(s,n)=>{const d=P(s);d.setDate(d.getDate()+n);return iso(d)};
  const T=()=>typeof today==='function'?today():iso(new Date());
  const DAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const STATUS_AR={active:'نشط',inactive:'غير نشط',suspended:'موقوف',withdrawn:'منسحب'};
  const stAr=s=>STATUS_AR[s]||s||'—';
  const stKind=s=>s==='active'?'success':s==='suspended'?'warning':s==='withdrawn'?'neutral':'info';
  const trackName=t=>t==='tathbit'?'التثبيت':'الحفظ العام';
  const ACT_AR={tathbit:'تثبيت',new_hifz:'حفظ جديد',review_near:'مراجعة قريبة',review_far:'مراجعة بعيدة',sard:'سرد',tilawah:'تلاوة',test:'اختبار'};
  const actShort=v=>({new_hifz:'حفظ',hifz:'حفظ',sard:'سرد',review_near:'مراجعة',review_far:'مراجعة',review:'مراجعة',test:'اختبار',tathbit:'تثبيت'}[v]||v||'—');
  const TYPE_LABEL={tajweed:'التلاوة والتجويد',tilawah:'التلاوة والتجويد',training:'تأهيلية',course:'دورة'};
  const SORTS=[['alpha','ترتيب أبجدي'],['recent','الأحدث'],['progress','حسب المسار'],['points','الأعلى نقاطاً'],['oldest','الأكبر سناً'],['youngest','الأصغر سناً'],['joined_old','الأقدم التحاقاً']];
  const STATUSES=[['active','الطلاب الحاليون'],['all','كل الحالات'],['inactive','غير نشط'],['suspended','موقوف'],['withdrawn','المنسحبون / الأرشيف']];
  const TRACKS=[['all','كل المسارات'],['general_hifz','الحفظ العام'],['tathbit','التثبيت']];

  const S={expanded:null,limit:60,sort:null,panelId:null,det:null,ed:null,gl:null,profileId:null,profilePage:null,prof:null,snap:new Map(),ga:{},searchT:0,fuT:0,fuRefocus:false,msg:null};
  const NSS=window.NSS={S};

  // ---------- data helpers ----------
  const masterHalaqas=()=>(window.RC27&&window.RC27.master&&window.RC27.master.halaqas)||state.halaqas||[];
  const masterStudents=()=>(window.RC27&&window.RC27.master&&window.RC27.master.students)||state.students||[];
  const findStudent=id=>state.students.find(x=>x.id===id)||masterStudents().find(x=>x.id===id)||null;
  const monthRow=id=>(state.monthly||[]).find(x=>x.student_id===id)||null;
  function ctx(){
    const hs=masterHalaqas(),hq=new Map(hs.map(x=>[x.id,x])),mem=new Map();
    ((window.RC27&&window.RC27.memberships)||[]).forEach(m=>{if(m.status!=='active')return;if(!mem.has(m.student_id))mem.set(m.student_id,new Set());mem.get(m.student_id).add(m.halaqa_id)});
    const cats=new Map((state.categories||[]).map(c=>[c.id,c]));
    return {hq,mem,cats,hname:id=>(hq.get(id)||{}).name||'',cname:id=>(cats.get(id)||{}).name||'',sec:st=>[...(mem.get(st.id)||[])].filter(i=>i!==st.halaqa_id).map(i=>(hq.get(i)||{}).name).filter(Boolean)};
  }
  const isProgram=hq=>hq&&typeof rc27IsProgram==='function'&&rc27IsProgram(hq);
  function age(dob){const d=P(dob);if(!d)return null;const n=new Date();let a=n.getFullYear()-d.getFullYear();const m=n.getMonth()-d.getMonth();if(m<0||(m===0&&n.getDate()<d.getDate()))a--;return a>=3&&a<=100?a:null}

  /** Active smart-plan snapshot for a student (web twin of PlanSnapshot) with goal-based fallback. */
  function snap(st){
    if(S.snap.has(st.id))return S.snap.get(st.id);
    let r=null;
    try{
      if(typeof effectiveSmartPlans==='function'&&typeof smartPlanProgress==='function'){
        const plans=effectiveSmartPlans(st),plan=plans.find(p=>['hifz','tathbit'].includes(p.plan_type))||plans[0];
        if(plan){const pr=smartPlanProgress(plan,st.id);r={plan,progress:pr,pct:Math.max(0,Math.min(100,Number(pr.percentage)||0)),daily:Number(pr.dailyTarget??(pr.assignment&&pr.assignment.pages)??0)}}
      }
    }catch(e){r=null}
    if(!r){
      const g=(state.goals||[]).find(x=>x.student_id===st.id),m=monthRow(st.id);
      if(g&&Number(g.target_hifz_pages)>0)r={goal:g,pct:Math.min(100,Math.round(Number(m&&m.hifz_pages||0)/Number(g.target_hifz_pages)*100)),daily:Number(g.target_daily_hifz_pages||0)};
    }
    S.snap.set(st.id,r);return r;
  }
  const memo=fn=>{let on=false;try{if(typeof beginSmartPlanRenderMemo==='function'){beginSmartPlanRenderMemo();on=true}}catch(e){}try{return fn()}finally{try{if(on&&typeof endSmartPlanRenderMemo==='function')endSmartPlanRenderMemo()}catch(e){}}};

  // ---------- filtering ----------
  const normStatus=()=>{const s=state.studentStatus||'active';return s==='removed'?'withdrawn':s};
  function filtered(C){
    const q=(state.studentSearch||'').trim(),nq=typeof normalizeNameJs==='function'?normalizeNameJs(q):q.toLowerCase();
    const status=normStatus(),hv=state.studentHalaqa||'all',cv=state.studentCategory||'all',tv=state.studentTrack||'all';
    const nm=s=>typeof normalizeNameJs==='function'?normalizeNameJs(s):String(s||'').toLowerCase();
    let rows=(state.students||[]).filter(s=>{
      if(q&&!(nm(s.full_name).includes(nq)||[s.national_id,s.phone,s.guardian_phone].some(v=>String(v||'').includes(q))||nm(s.guardian_name).includes(nq)))return false;
      if(!(status==='all'||s.status===status||(q&&status==='active'&&s.status==='suspended')))return false;
      if(tv!=='all'&&!(tv==='none'?!s.track_code:(s.track_code===tv||(tv==='general_hifz'&&s.track_code==='sard'))))return false;
      if(hv!=='all'&&s.halaqa_id!==hv&&!(C.mem.get(s.id)&&C.mem.get(s.id).has(hv)))return false;
      if(cv!=='all'&&!(cv==='none'?!s.category_id:s.category_id===cv))return false;
      return true;
    });
    const ar=(a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar');
    if(S.sort){
      const {key,dir}=S.sort,mm=id=>monthRow(id)||{};
      const val={name:s=>s.full_name,halaqa:s=>C.hname(s.halaqa_id),hifz:s=>Number(mm(s.id).hifz_pages||0),review:s=>Number(mm(s.id).review_pages||0),sard:s=>Number(mm(s.id).sard_pages||0),absent:s=>Number(mm(s.id).absent_days||0),plan:s=>{const x=snap(s);return x?x.pct:-1},status:s=>s.status}[key]||(s=>s.full_name);
      rows.sort((a,b)=>{const x=val(a),y=val(b);return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'ar'))*dir||ar(a,b)});
      return rows;
    }
    const mode=state.studentSort||'alpha';
    if(mode==='progress')return rows.sort((a,b)=>String(a.track_code||'').localeCompare(String(b.track_code||''))||ar(a,b));
    if(mode==='recent'&&typeof sortStudentsList==='function')return sortStudentsList(rows,'joined_new');
    if(mode!=='alpha'&&typeof sortStudentsList==='function')return sortStudentsList(rows,mode);
    return rows.sort(ar);
  }
  const filterCount=()=>[normStatus()!=='active',(state.studentTrack||'all')!=='all',(state.studentCategory||'all')!=='all',(state.studentSort||'alpha')!=='alpha'].filter(Boolean).length;
  const lazyReset=()=>{S.limit=isDk()?200:60};

  // ---------- small UI parts ----------
  const avatar=(st,size)=>{const u=state.photoUrls&&state.photoUrls[st.id];return u?`<span class="nx-avatar ns-photo" style="width:${size||46}px;height:${size||46}px"><img src="${h(u)}" alt=""></span>`:NX.avatar(st.full_name,{size})};
  const personBadge=size=>`<span class="ns-person" style="width:${size}px;height:${size}px">${ic('Person',Math.round(size*.5))}</span>`;
  const miniMetric=(label,value)=>`<div class="ns-mini"><b>${value}</b><span>${label}</span></div>`;
  const line=(label,value)=>`<div class="ns-line"><span>${label}</span><b>${h(value||'—')}</b></div>`;
  const healthPill=pr=>{const k=pr.health==='green'?'success':pr.health==='yellow'?'warning':'danger';return NX.pill(h(pr.healthLabel||'—'),k)};
  const sel=(label,options,value,onchange,o={})=>NX.select(label,options.map(x=>({value:x[0],label:x[1]})),{value,onchange,id:o.id,cls:o.cls});

  // ====================================================================================================
  //  STUDENTS LIST
  // ====================================================================================================
  const legacyStudentsPage=studentsPage;

  function toolbarPhone(){
    const n=filterCount();
    return `<div class="ns-bar">${NX.search(state.studentSearch,'بحث بالاسم أو الهوية',{id:'nsSearch',oninput:'NSS.search(this.value)',trailing:NX.iconBtn('Tune',{title:'الفلاتر',badge:n||null,onclick:'NSS.filters()'})})}${manage()?`<button type="button" class="ns-add" aria-label="إضافة" title="إضافة" onclick="openStudent()">${ic('Add',24)}</button>`:''}${moreMenu()}</div>`;
  }
  function moreMenu(){
    if(!manage())return '';
    const on=state.selectionMode;
    return NX.kebab([
      {label:on?'إنهاء التحديد':'تحديد الطلاب',icon:'Check',onclick:()=>toggleSelectionMode()},
      {label:'تحديد الظاهر',icon:'Done',hidden:!on,onclick:()=>NSS.selectAll()},
      {label:'إدارة الفئات',icon:'Edit',onclick:()=>openCategories(state.studentHalaqa&&state.studentHalaqa!=='all'?state.studentHalaqa:(state.halaqas[0]||{}).id)},
    ],{title:'المزيد'});
  }
  function catOptions(){
    const hv=state.studentHalaqa||'all';
    return [['all','كل الفئات'],['none','بدون فئة']].concat((state.categories||[]).filter(c=>c.active!==false&&(hv==='all'||c.halaqa_id===hv)).map(c=>[c.id,c.name||'فئة']));
  }
  function halaqaOptions(){return [['all','كل الحلقات']].concat(masterHalaqas().filter(x=>x.active!==false).map(x=>[x.id,x.name||'حلقة']))}
  function toolbarDesktop(total){
    const n=filterCount();
    return `<div class="ns-dk-head"><div class="ns-dk-title"><h2>الطلاب</h2><span id="nsCount" class="ns-count">${total}</span></div>
      <div class="ns-dk-actions">${NX.search(state.studentSearch,'بحث بالاسم أو الهوية أو الجوال',{id:'nsSearch',oninput:'NSS.search(this.value)',cls:'ns-dk-search'})}${manage()?NX.btn('طالب جديد',{icon:'Add',onclick:'openStudent()'}):''}${moreMenu()}</div></div>
      <div class="ns-dk-filters">${sel('الحلقة',halaqaOptions(),state.studentHalaqa||'all',"NSS.set('studentHalaqa',this.value)")}${sel('الفئة',catOptions(),state.studentCategory||'all',"NSS.set('studentCategory',this.value)")}${sel('المسار',TRACKS,state.studentTrack||'all',"NSS.set('studentTrack',this.value)")}${sel('الحالة',STATUSES,normStatus(),"NSS.set('studentStatus',this.value)")}${sel('الترتيب',SORTS,S.sort?'':(state.studentSort||'alpha'),"NSS.set('studentSort',this.value)")}${n?NX.btn('إعادة تعيين',{kind:'text',small:true,icon:'Close',onclick:'NSS.reset()'}):''}</div>`;
  }

  function cardHtml(st,C){
    const sn=snap(st),open=S.expanded===st.id,removed=st.status==='withdrawn',selMode=state.selectionMode&&manage(),selected=state.selectedStudents&&state.selectedStudents.has(st.id);
    const hname=C.hname(st.halaqa_id),sec=C.sec(st),cat=C.cname(st.category_id),a=age(st.date_of_birth),m=monthRow(st.id),dup=typeof isDuplicateStudent==='function'&&isDuplicateStudent(st);
    const subtitle=[trackName(st.track_code),hname].concat(sec.length?['+'+sec.length+' برنامج']:[]).filter(Boolean).join(' · ');
    const more=[cat?'الفئة: '+cat:'',a!=null?'العمر: '+a+' سنة':'',sec.length?'البرامج: '+sec.join('، '):''].filter(Boolean).join(' · ')||'لا توجد تفاصيل إضافية';
    const stats=m?[st.track_code==='tathbit'?'تثبيت '+N(m.tathbit_pages)+' ص':'حفظ '+N(m.hifz_pages)+' ص','مراجعة '+N(m.review_pages)+' ص','غياب '+(m.absent_days||0)].join(' · '):'';
    const acts=removed
      ?`${manage()?NX.btn('استعادة',{kind:'tonal',icon:'Restore',onclick:`restoreStudent('${st.id}')`}):''}${isOwner()?NX.btn('حذف نهائي',{kind:'danger',onclick:`NSS.purge('${st.id}')`}):''}`
      :`${staff()?NX.btn('تسميع اليوم',{onclick:`NSS.recite('${st.id}')`}):''}${NX.btn('الملف الشخصي',{kind:'tonal',onclick:`studentProfile('${st.id}')`})}${staff()?NX.btn('الخطة',{kind:'tonal',onclick:`openPlan('${st.id}')`}):''}`;
    return `<div class="ns-card ${open?'open':''} ${selected?'selected':''} ${removed?'removed':''}" data-stcard="${st.id}">
      <div class="ns-card-head">${selMode?`<input class="ns-check" type="checkbox" aria-label="تحديد ${h(st.full_name)}" ${selected?'checked':''} onchange="toggleStudentSelection('${st.id}',this.checked)">`:''}<button type="button" class="ns-card-main" onclick="NSS.toggle('${st.id}')" aria-expanded="${open?'true':'false'}">${avatar(st,46)}<span class="ns-card-t"><b>${h(st.full_name)}</b><small>${h(subtitle)}</small></span></button>${dup?NX.pill('مكرر','warning'):''}${NX.pill(h(stAr(st.status)),stKind(st.status))}<button type="button" class="nx-iconbtn" aria-label="${open?'طي تفاصيل الطالب':'فتح تفاصيل الطالب'}" title="${open?'طي تفاصيل الطالب':'فتح تفاصيل الطالب'}" onclick="NSS.toggle('${st.id}')">${ic(open?'ExpandLess':'ExpandMore',24)}</button></div>
      ${sn?`<div class="ns-plan-row"><span class="g">الخطة ${N(sn.pct)}%</span><span>ورد اليوم ${N(sn.daily)} ص</span></div>`:''}
      <div class="ns-card-more"><div class="ns-card-more-in">
        <p class="ns-soft">${h(more)}</p>${stats?`<p class="ns-stats">${h(stats)}</p>`:''}
        ${acts?`<div class="ns-acts-row">${acts}</div>`:''}
        ${manage()?`<button type="button" class="nx-btn nx-text ns-edit-link" onclick="NSS.detail('${st.id}',true)">${ic('Edit',17)}<span>تعديل بيانات الطالب والانتساب</span></button>`:''}
      </div></div></div>`;
  }

  function tableHtml(rows,C){
    const manageOn=manage(),selMode=state.selectionMode&&manageOn;
    const th=(k,l,cls)=>`<th class="sortable ${cls||''} ${S.sort&&S.sort.key===k?'on':''}" onclick="NSS.sortBy('${k}')" scope="col">${l}${S.sort&&S.sort.key===k?ic(S.sort.dir>0?'ExpandLess':'ExpandMore',16):''}</th>`;
    const body=rows.map(st=>{
      const m=monthRow(st.id)||{},sn=snap(st),removed=st.status==='withdrawn',selected=state.selectedStudents&&state.selectedStudents.has(st.id),sec=C.sec(st),dup=typeof isDuplicateStudent==='function'&&isDuplicateStudent(st);
      const ib=(icon,t,fn)=>`<button type="button" class="ns-ib" title="${t}" aria-label="${t}" onclick="event.stopPropagation();${fn}">${ic(icon,19)}</button>`;
      const kebab=manageOn?NX.kebab([
        {label:'تعديل البيانات',icon:'Edit',onclick:()=>openStudent(st.id)},
        {label:'ولي الأمر',icon:'SupervisorAccount',hidden:removed,onclick:()=>NSS.guardianLink(st.id)},
        {label:'أرشفة / سحب الطالب',icon:'Archive',hidden:removed,danger:true,onclick:()=>NSS.archive(st.id)},
        {label:'استعادة الطالب',icon:'Restore',hidden:!removed,onclick:()=>restoreStudent(st.id)},
        {label:'حذف نهائي',icon:'DeleteForever',hidden:!(removed&&isOwner()),danger:true,onclick:()=>NSS.purge(st.id)},
      ],{cls:'ns-ib'}):'';
      return `<tr class="ns-row ${selected?'selected':''} ${S.panelId===st.id?'active':''} ${removed?'removed':''}" data-stcard="${st.id}" data-sid="${st.id}" tabindex="0" onclick="NSS.rowClick(event,'${st.id}')" ondblclick="studentProfile('${st.id}')">
        ${selMode?`<td class="ns-c-sel" onclick="event.stopPropagation()"><input class="ns-check" type="checkbox" aria-label="تحديد ${h(st.full_name)}" ${selected?'checked':''} onchange="toggleStudentSelection('${st.id}',this.checked)"></td>`:''}
        <td class="ns-c-name"><div class="ns-name">${avatar(st,36)}<div><b>${h(st.full_name)}</b>${dup?' '+NX.pill('مكرر','warning'):''}<small>${h(st.guardian_phone||st.phone||'')}</small></div></div></td>
        <td>${h(C.hname(st.halaqa_id)||'—')}${sec.length?`<small class="ns-sub">+${sec.length} برنامج</small>`:''}</td>
        <td>${h(C.cname(st.category_id)||'—')}</td>
        <td>${trackName(st.track_code)}</td>
        <td class="num">${N(m.hifz_pages)}</td><td class="num">${N(m.review_pages)}</td><td class="num">${N(m.sard_pages)}</td><td class="num">${m.absent_days||0}</td>
        <td class="ns-c-plan">${sn?`<div class="ns-pct">${NX.progress(sn.pct)}<b>${N(sn.pct)}%</b></div>`:'<span class="ns-sub">—</span>'}</td>
        <td>${NX.pill(h(stAr(st.status)),stKind(st.status))}</td>
        <td class="ns-c-acts" onclick="event.stopPropagation()"><div class="ns-hover-acts">${!removed&&staff()?ib('RecordVoiceOver','تسميع اليوم',`NSS.recite('${st.id}')`)+ib('AutoGraph','الخطة',`openPlan('${st.id}')`):''}${ib('Person','الملف الشخصي',`studentProfile('${st.id}')`)}${kebab}</div></td></tr>`;
    }).join('');
    return `<div class="ns-table-wrap"><table class="ns-table"><thead><tr>${selMode?'<th class="ns-c-sel"></th>':''}${th('name','الطالب')}${th('halaqa','الحلقة')}<th scope="col">الفئة</th><th scope="col">المسار</th>${th('hifz','حفظ الشهر','num')}${th('review','مراجعة','num')}${th('sard','سرد','num')}${th('absent','غياب','num')}${th('plan','الخطة')}${th('status','الحالة')}<th scope="col" class="ns-c-acts"></th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function emptyHtml(){
    const q=(state.studentSearch||'').trim();
    return NX.empty(q?'لا توجد نتائج مطابقة للبحث':'لا يوجد طلاب حتى الآن',{icon:'SearchOff',label:'إعادة تعيين الفلاتر',onclick:'NSS.reset()'});
  }
  function listHtml(){
    const C=ctx(),all=filtered(C),rows=all.slice(0,S.limit);
    let out='';
    if(S.msg)out+=NX.notice(h(S.msg),'error');
    if(!all.length)return out+emptyHtml()+dupHtml(C);
    out+=dupHtml(C);
    if(isDk()){out+=tableHtml(rows,C)}
    else{
      const multi=(state.studentHalaqa||'all')==='all'&&masterHalaqas().filter(x=>x.active!==false).length>1;
      if(multi){
        const groups=new Map();rows.forEach(s=>{const k=s.halaqa_id||'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s)});
        const keys=[...groups.keys()].sort((a,b)=>(a===''?1:0)-(b===''?1:0)||C.hname(a).localeCompare(C.hname(b),'ar'));
        out+=`<div class="ns-list">${keys.map(k=>`<h4 class="ns-group">${h((C.hname(k)||'بدون حلقة')+' · '+groups.get(k).length+' طالب')}</h4>`+groups.get(k).map(s=>cardHtml(s,C)).join('')).join('')}</div>`;
      }else out+=`<div class="ns-list">${rows.map(s=>cardHtml(s,C)).join('')}</div>`;
    }
    if(all.length>rows.length)out+=`<div class="ns-more">${NX.btn(`عرض المزيد (${all.length-rows.length})`,{kind:'outlined',onclick:'NSS.more()'})}</div>`;
    return out;
  }
  function dupHtml(C){
    if(!manage()||normStatus()==='withdrawn'||typeof duplicateMap!=='function')return '';
    let n=0;try{n=[...duplicateMap().values()].filter(x=>x.length>1).length}catch(e){}
    if(!n)return '';
    return `<div class="ns-dup">${NX.insight('warning','WarningAmber',`تم رصد ${n} مجموعات أسماء مكررة`,'راجع النسخ المكررة قبل إزالتها',{count:n,body:NX.btn('كشف المكرر وتحديد النسخ',{kind:'tonal',small:true,onclick:'selectDuplicateCopies()'})})}</div>`;
  }
  function bulkHtml(){
    if(!(state.selectionMode&&manage()))return '';
    const cats=(state.categories||[]).filter(c=>c.active!==false),removedView=normStatus()==='withdrawn';
    const body=removedView
      ?`${NX.btn('استعادة المحدد',{kind:'tonal',small:true,icon:'Restore',onclick:'NSS.bulk("bulkRestoreStudents")'})}${isOwner()?NX.btn('حذف نهائي للمحدد',{kind:'danger',small:true,onclick:'NSS.bulk("bulkPermanentDeleteStudents")'}):''}`
      :`<div class="ns-bulk-set">${NX.select('الفئة',[{value:'',label:'اختر فئة'},{value:'__none',label:'بدون فئة'}].concat(cats.map(c=>({value:c.id,label:c.name}))),{id:'bulkCategory'})}${NX.btn('تعيين الفئة',{kind:'tonal',small:true,onclick:'bulkAssignCategory()'})}</div><div class="ns-bulk-set">${NX.select('المسار',[{value:'',label:'اختر مساراً'},{value:'__none',label:'بدون مسار'}].concat(Object.entries(assignableStudentTracks).map(([k,v])=>({value:k,label:v}))),{id:'bulkTrack'})}${NX.btn('تعيين المسار',{kind:'tonal',small:true,onclick:'bulkAssignTrack()'})}</div>${NX.btn('إزالة المحدد',{kind:'danger',small:true,icon:'Archive',onclick:'NSS.bulk("bulkRemoveStudents")'})}`;
    return `<div class="ns-bulk"><b class="ns-bulk-n">المحدد: <span id="selectedCount">${state.selectedStudents.size}</span></b>${body}${NX.btn('إنهاء التحديد',{kind:'text',small:true,onclick:'toggleSelectionMode()'})}</div>`;
  }

  function panelHtml(){
    const st=S.panelId&&findStudent(S.panelId);
    if(!st){S.panelId=null;return `<div class="ns-panel-empty">${NX.empty('اختر طالباً من الجدول لعرض بياناته وخطته وآخر تسميعاته هنا',{icon:'Person'})}</div>`}
    return `<div class="ns-panel-head">${NX.btn('فتح الملف الكامل',{kind:'tonal',small:true,icon:'Person',onclick:`studentProfile('${st.id}')`})}${NX.iconBtn('Close',{title:'إغلاق اللوحة',onclick:'NSS.closePanel()'})}</div><div class="ns-panel-body" id="nsPanelBody">${detailInner(st)}</div><div class="ns-panel-foot" id="nsPanelFoot">${detailFoot(st)}</div>`;
  }

  function studentsPageNative(){
    const role=state.profile&&state.profile.role;
    if(role==='guardian')return legacyStudentsPage.apply(this,arguments);
    if(S.profileId)return profileHtml();
    return memo(()=>{
      S.snap.clear();lazyReset();
      const C=ctx(),total=filtered(C).length;
      if(isDk()){
        return `<div class="ns-page ns-dk"><div class="ns-dk-main">${toolbarDesktop(total)}<div id="nsList" class="ns-dk-list">${listHtml()}</div>${bulkHtml()}</div><aside class="ns-panel" id="nsPanel" aria-label="تفاصيل الطالب">${panelHtml()}</aside></div>`;
      }
      return `<div class="ns-page">${toolbarPhone()}<div id="nsList">${listHtml()}</div>${bulkHtml()}</div>`;
    });
  }
  studentsPage=studentsPageNative;
  // studentCards (used by other legacy pages) → same native cards
  const legacyStudentCards=typeof studentCards==='function'?studentCards:null;
  if(legacyStudentCards)studentCards=function(rows,selectable){
    try{rows=rows||activeStudents();if(!rows.length)return emptyHtml();return memo(()=>{const C=ctx();return `<div class="ns-list">${rows.map(s=>cardHtml(s,C)).join('')}</div>`})}catch(e){return legacyStudentCards.apply(this,arguments)}
  };

  function refreshList(){
    const el=$id('nsList');if(!el)return;
    memo(()=>{S.snap.clear();el.innerHTML=listHtml();const c=$id('nsCount');if(c)c.textContent=filtered(ctx()).length});
  }
  NSS.search=v=>{clearTimeout(S.searchT);S.searchT=setTimeout(()=>{state.studentSearch=v;lazyReset();refreshList()},220)};
  NSS.set=(k,v)=>{state[k]=v;if(k==='studentHalaqa')state.studentCategory='all';if(k==='studentSort')S.sort=null;lazyReset();render();if($id('nsFilters')&&$id('nsFilters').open)setTimeout(NSS.filters,0)};
  NSS.reset=()=>{state.studentSearch='';state.studentTrack='all';state.studentStatus='active';state.studentHalaqa='all';state.studentCategory='all';state.studentSort='alpha';S.sort=null;lazyReset();NX.closeDialog('nsFilters');render()};
  NSS.more=()=>{S.limit+=isDk()?200:60;refreshList()};
  NSS.toggle=id=>{
    const prev=S.expanded;S.expanded=prev===id?null:id;
    document.querySelectorAll('.ns-card.open').forEach(c=>{c.classList.remove('open');const b=c.querySelector('.ns-card-main');if(b)b.setAttribute('aria-expanded','false')});
    if(S.expanded){const c=document.querySelector(`.ns-card[data-stcard="${id}"]`);if(c){c.classList.add('open');const b=c.querySelector('.ns-card-main');if(b)b.setAttribute('aria-expanded','true')}}
    document.querySelectorAll('.ns-card').forEach(c=>{const open=c.classList.contains('open'),btn=c.querySelector('.ns-card-head > .nx-iconbtn');if(btn){btn.innerHTML=ic(open?'ExpandLess':'ExpandMore',24);btn.title=btn.ariaLabel=open?'طي تفاصيل الطالب':'فتح تفاصيل الطالب'}});
  };
  NSS.sortBy=k=>{S.sort=S.sort&&S.sort.key===k?{key:k,dir:-S.sort.dir}:{key:k,dir:1};render()};
  NSS.selectAll=()=>{state.selectionMode=true;filtered(ctx()).forEach(s=>state.selectedStudents.add(s.id));render()};
  NSS.bulk=fn=>{
    const n=state.selectedStudents.size;if(!n)return toast('حدد طالباً واحداً على الأقل');
    const map={bulkRemoveStudents:['إزالة المحدد',`إزالة ${n} طالباً من القائمة الحالية مع الاحتفاظ بسجلهم وتقاريرهم؟`,'إزالة',false],bulkRestoreStudents:['استعادة المحدد',`استعادة ${n} طالباً إلى القائمة الحالية؟`,'استعادة',false],bulkPermanentDeleteStudents:['حذف نهائي',`حذف ${n} طالباً نهائياً؟ سيتم حذف جميع سجلاتهم المرتبطة ولا يمكن التراجع.`,'حذف نهائي',true]}[fn];
    viaConfirm(map[0],map[1],map[2],()=>window[fn](),map[3]||fn==='bulkRemoveStudents');
  };
  /** NX.confirm then run a legacy handler that still calls window.confirm() internally (auto-accepted). */
  function viaConfirm(title,text,ok,fn,danger){
    NX.confirm(title,text,ok,async()=>{const oc=window.confirm;window.confirm=()=>true;try{await fn()}finally{window.confirm=oc}},{danger});
  }
  NSS.purge=id=>{
    const st=findStudent(id);if(!st)return;
    viaConfirm('حذف نهائي',`حذف الطالب «${st.full_name}» نهائياً؟ سيتم حذف سجلاته المرتبطة مثل الحضور والتسميع والخطط والملاحظات، ولا يمكن التراجع عن هذا الإجراء.`,'حذف نهائي',()=>permanentlyDeleteStudent(id),true);
  };
  NSS.archive=id=>{
    const st=findStudent(id);if(!st)return;
    const back=st.status==='withdrawn';
    NX.confirm(back?'استعادة الطالب':'أرشفة الطالب',back?'سيعود الطالب إلى قائمة الطلاب الحاليين مع بقاء سجله كاملًا.':'سيُنقل الطالب إلى المنسحبين / الأرشيف دون حذف الجلسات أو التسميعات أو التقارير.',back?'استعادة':'أرشفة',async()=>{
      try{
        if(back)await restoreStudent(id);
        else{await saveMasterLocal('student',id,{status:'withdrawn',withdrawn_at:new Date().toISOString(),withdrawn_by:state.user&&state.user.id});state.selectedStudents.delete(id);toast('تمت إزالة الطالب محلياً وستتم المزامنة تلقائياً');render()}
        if(S.det&&S.det.id===id){S.det.status=(findStudent(id)||{}).status||S.det.status;S.det.track=(findStudent(id)||{}).track_code||S.det.track;paintDetail()}
      }catch(e){toast(e.message||'تعذر تحديث حالة الطالب')}
    },{danger:!back});
  };
  NSS.recite=id=>{NX.closeDialog('nsDetail');if(typeof openDailyForStudent==='function')openDailyForStudent(id)};
  NSS.rowClick=(e,id)=>{if(e.target.closest('input,button,a'))return;NSS.selectRow(id)};
  NSS.selectRow=id=>{
    S.panelId=id;
    document.querySelectorAll('.ns-row.active').forEach(r=>r.classList.remove('active'));
    const row=document.querySelector(`.ns-row[data-sid="${id}"]`);if(row)row.classList.add('active');
    const p=$id('nsPanel');if(p){p.innerHTML=panelHtml();p.classList.add('open');loadDetail(id)}
  };
  NSS.closePanel=()=>{S.panelId=null;S.det=null;document.querySelectorAll('.ns-row.active').forEach(r=>r.classList.remove('active'));const p=$id('nsPanel');if(p){p.innerHTML=panelHtml()}};

  // ---------- filter sheet (CompactFilterSelect ×5) ----------
  NSS.filters=()=>{
    const n=filterCount();
    const body=`<div class="ns-fgrid">${sel('الحالة',STATUSES,normStatus(),"NSS.set('studentStatus',this.value)",{cls:'ns-fsel'})}${sel('المسار',TRACKS,state.studentTrack||'all',"NSS.set('studentTrack',this.value)",{cls:'ns-fsel'})}${sel('الحلقة',halaqaOptions(),state.studentHalaqa||'all',"NSS.set('studentHalaqa',this.value)",{cls:'ns-fsel'})}${sel('الفئة',catOptions(),state.studentCategory||'all',"NSS.set('studentCategory',this.value)",{cls:'ns-fsel'})}</div>${sel('الترتيب',SORTS.slice(0,3).concat(SORTS.slice(3)),S.sort?'':(state.studentSort||'alpha'),"NSS.set('studentSort',this.value)",{cls:'ns-fsel'})}`;
    NX.dialog('nsFilters','فلاتر الطلاب',body,{cls:'ns-filters-dlg',footer:`${NX.btn('إعادة تعيين',{kind:'outlined',cls:'nx-grow',onclick:'NSS.reset()'})}${NX.btn('عرض الطلاب',{cls:'nx-grow',onclick:"NX.closeDialog('nsFilters')"})}`});
  };

  // ====================================================================================================
  //  STUDENT DETAIL (StudentDetailSheet) — bottom sheet on phones, side panel on desktop
  // ====================================================================================================
  NSS.detail=(id,sheet)=>{
    const st=findStudent(id);if(!st)return;
    if(isDk()&&!sheet){NSS.selectRow(id);return}
    if(isDk()){NSS.selectRow(id);return}
    S.det={id,loading:true,online:online(),raw:st,recs:[],att:[],err:null,track:st.track_code==='sard'?'general_hifz':(st.track_code||'general_hifz'),status:st.status,saving:false};
    NX.dialog('nsDetail','',`<div id="nsSheetBody">${detailInner(st)}</div>`,{cls:'ns-detail-dlg',footer:detailFoot(st)});
    loadDetail(id);
  };
  async function loadDetail(id){
    const st=findStudent(id);if(!st)return;
    const on=online();
    S.det={id,loading:true,online:on,raw:st,recs:[],att:[],err:null,track:st.track_code==='sard'?'general_hifz':(st.track_code||'general_hifz'),status:st.status,saving:false};
    paintDetail();
    if(!on){S.det.loading=false;paintDetail();return}
    const from=T().slice(0,8)+'01',to=T();
    try{
      const [raw,rec,att]=await Promise.all([
        db.from('students').select('*').eq('id',id).limit(1),
        db.from('recitation_entries').select('id,activity_type,start_page,end_page,start_surah,start_ayah,end_surah,end_ayah,pages_count,evaluation,points,mistakes,prompts,created_at,sessions!inner(session_date,session_type,title)').eq('student_id',id).gte('sessions.session_date',from).lte('sessions.session_date',to).order('created_at',{ascending:false}).limit(1000),
        db.from('attendance_records').select('status,arrival_minutes_late,excuse_reason,recorded_at,sessions!inner(session_date)').eq('student_id',id).gte('sessions.session_date',from).lte('sessions.session_date',to).order('recorded_at',{ascending:false}).limit(1000)]);
      if(!S.det||S.det.id!==id)return;
      const r=(raw.data||[])[0];if(r){S.det.raw=r;S.det.track=r.track_code==='sard'?'general_hifz':(r.track_code||S.det.track);S.det.status=r.status||S.det.status}
      S.det.recs=rec.data||[];S.det.att=att.data||[];
      if(raw.error&&rec.error)S.det.err=(raw.error.message||'تعذر تحميل تفاصيل الطالب');
    }catch(e){if(S.det&&S.det.id===id)S.det.err=e.message||'تعذر تحميل تفاصيل الطالب'}
    if(S.det&&S.det.id===id){S.det.loading=false;paintDetail()}
  }
  function paintDetail(){
    if(!S.det)return;const st=findStudent(S.det.id);if(!st)return;
    const pb=$id('nsPanelBody'),sb=$id('nsSheetBody');
    if(pb&&S.panelId===S.det.id){pb.innerHTML=detailInner(st);const f=$id('nsPanelFoot');if(f)f.innerHTML=detailFoot(st)}
    if(sb){const c=sb.closest('.nx-dlg-content');const top=c?c.scrollTop:0;sb.innerHTML=detailInner(st);if(c)c.scrollTop=top;const f=sb.closest('.nx-dlg-body')?.querySelector('.nx-dlg-foot');if(f)f.innerHTML=detailFoot(st)}
  }
  function detailFoot(st){
    const D=S.det&&S.det.id===st.id?S.det:null;
    if(D&&D.loading)return '';
    return NX.btn(`${online()?'بدء تسميع':'بدء تسميع أوفلاين ·'} ${h(st.full_name)}`,{icon:'RecordVoiceOver',full:true,cls:'ns-start',disabled:!!(D&&D.saving),onclick:`NSS.recite('${st.id}')`});
  }
  function detailInner(st){
    const D=S.det&&S.det.id===st.id?S.det:{loading:true,online:online(),raw:st,recs:[],att:[],track:st.track_code,status:st.status};
    const m=monthRow(st.id),recs=D.recs||[],att=D.att||[],hasData=!!m||recs.length>0||att.length>0;
    const sumBy=(f)=>recs.filter(f).reduce((a,r)=>a+Number(r.pages_count||0),0);
    const hifz=m?Number(m.hifz_pages||0):sumBy(r=>r.activity_type==='new_hifz'),review=m?Number(m.review_pages||0):sumBy(r=>['review_near','review_far'].includes(r.activity_type)),sard=m?Number(m.sard_pages||0):sumBy(r=>r.activity_type==='sard');
    const cnt=s=>att.filter(a=>a.status===s).length;
    const present=att.length?cnt('present')+cnt('late'):(m?Number(m.present_days||0):0),absent=att.length?cnt('absent'):(m?Number(m.absent_days||0):0),late=att.length?cnt('late'):(m?Number(m.late_days||0):0);
    const mv=v=>hasData?v:'—',d=new Date(),monthLabel=MONTHS[d.getMonth()]+' '+d.getFullYear(),raw=D.raw||st;
    const head=`<div class="ns-dhead">${state.photoUrls&&state.photoUrls[st.id]?avatar(st,52):personBadge(52)}<div class="nx-grow"><h3 class="ns-dname">${h(st.full_name)}</h3><small>${D.track==='tathbit'?'مسار التثبيت':'مسار الحفظ العام'}</small></div>${NX.pill(h(stAr(D.status)),D.status==='active'?'success':D.status==='suspended'?'warning':'neutral')}</div>`;
    let out=head;
    if(D.err)out+=NX.notice(h(D.err),'danger');
    if(!D.online)out+=NX.notice('وضع الأوفلاين: بيانات الطالب محفوظة محليًا، وأي تعديل أو تسميع سيُضاف إلى صندوق المزامنة تلقائيًا.','warning');
    if(D.loading)return out+NX.skeleton(3);
    out+=`<div class="ns-minis">${miniMetric('حفظ الشهر',mv(N(hifz)+' ص'))}${miniMetric('مراجعة',mv(N(review)+' ص'))}${miniMetric('سرد',mv(N(sard)+' ص'))}${miniMetric('الحضور',mv(present))}${miniMetric('الغياب',mv(absent))}${miniMetric('التأخر',mv(late))}</div><p class="ns-cap">${hasData?'أرقام '+monthLabel+' فقط'+(D.online?'':' — من آخر مزامنة'):'لا توجد بيانات محفوظة لهذا الشهر على الجهاز بعد، تظهر بعد أول مزامنة.'}</p>`;
    const sn=snap(st);
    if(sn&&sn.progress){
      const pr=sn.progress,plan=sn.plan;
      out+=NX.card(`<div class="nx-row nx-between"><div class="nx-grow"><div class="nx-t-title-m">الخطة الذكية</div><small class="nx-muted">${h(plan.title||(typeof smartPlanTypeAr!=='undefined'&&smartPlanTypeAr[plan.plan_type])||plan.plan_type||'')}</small></div>${healthPill(pr)}</div>${NX.progress(sn.pct)}<p class="ns-plan-line">الإنجاز ${N(pr.percentage)}% · المتبقي ${N(pr.remaining)} صفحة · اليوم ${N(pr.assignment&&pr.assignment.pages)} صفحة</p>`,{cls:'ns-ecard'});
    }
    out+=NX.card(`<div class="nx-t-title-m">البيانات الأساسية</div>${line('المرحلة',raw.school_grade)}${line('جوال ولي الأمر',raw.guardian_phone)}${line('بريد ولي الأمر',raw.guardian_email)}${line('تاريخ الميلاد',raw.date_of_birth)}`,{cls:'ns-ecard'});
    const archived=D.status==='withdrawn';
    out+=NX.card(`<div class="nx-t-title-m ns-b">إدارة الطالب</div><div class="ns-two">${NX.btn('تعديل البيانات',{kind:'outlined',full:true,onclick:`openStudent('${st.id}')`})}${NX.btn('ولي الأمر',{kind:'outlined',full:true,onclick:`NSS.guardianLink('${st.id}')`})}</div>${staff()&&!archived?NX.btn('الخطة',{kind:'tonal',full:true,icon:'AutoGraph',onclick:`openPlan('${st.id}')`}):''}${NX.btn(archived?'استعادة الطالب':'أرشفة / سحب الطالب',{kind:archived?'filled':'danger',full:true,disabled:D.saving,onclick:`NSS.archive('${st.id}')`})}<p class="ns-cap">الأرشفة لا تحذف الجلسات أو التسميعات أو التقارير؛ ويمكن استعادة الطالب لاحقًا.</p>`,{cls:'ns-ecard ns-stack'});
    out+=`<div class="nx-t-title-m ns-h">آخر التسميعات</div>`;
    out+=recs.length?`<div class="ns-recs">${recs.slice(0,6).map(r=>recRow(r,true)).join('')}</div>`:NX.empty('لا توجد تسميعات مسجلة هذا الشهر',{icon:'MenuBook'});
    out+=NX.card(`<div class="nx-t-title-m ns-b">تعديل سريع</div>${NX.chips([['general_hifz','الحفظ العام'],['tathbit','التثبيت']].map(([k,l])=>({label:l,selected:D.track===k,check:false,onclick:`NSS.quick('track','${k}')`})),{wrap:true})}${NX.chips([['active','نشط'],['inactive','غير نشط'],['suspended','موقوف'],['withdrawn','منسحب']].map(([k,l])=>({label:l,selected:D.status===k,check:false,onclick:`NSS.quick('status','${k}')`})),{wrap:true})}${NX.btn(D.saving?'جاري الحفظ…':D.online?'حفظ التعديل':'حفظ محليًا',{full:true,disabled:D.saving,onclick:'NSS.quickSave()'})}`,{cls:'ns-ecard ns-stack'});
    return `<div class="ns-dstack">${out}</div>`;
  }
  NSS.quick=(k,v)=>{if(!S.det)return;S.det[k]=v;paintDetail()};
  NSS.quickSave=async()=>{
    const D=S.det;if(!D||D.saving)return;D.saving=true;paintDetail();
    try{
      const st=findStudent(D.id),patch={track_code:D.track,status:D.status};
      if(D.status==='withdrawn'&&st.status!=='withdrawn'){patch.withdrawn_at=new Date().toISOString();patch.withdrawn_by=state.user&&state.user.id}
      if(D.status!=='withdrawn'&&st.status==='withdrawn'){patch.withdrawn_at=null;patch.withdrawn_by=null}
      await saveMasterLocal('student',D.id,patch);
      toast(online()?'تم حفظ التعديل':'تم الحفظ محلياً وستتم المزامنة تلقائياً');
      D.saving=false;render();paintDetail();
    }catch(e){D.saving=false;D.err=e.message||'تعذر تحديث الطالب';paintDetail()}
  };
  function rangeLabel(r){
    try{if(typeof recitationRangeText==='function')return recitationRangeText(r)}catch(e){}
    return r.start_page?`ص ${r.start_page}${r.end_page&&r.end_page!==r.start_page?' – '+r.end_page:''}`:'—';
  }
  function recRow(r,sheet){
    const date=(r.sessions&&r.sessions.session_date)||'';
    return `<div class="ns-rec">${ic('MenuBook',sheet?22:19)}<div class="nx-grow"><b>${sheet?h(ACT_AR[r.activity_type]||r.activity_type):h(date+' · '+actShort(r.activity_type))}</b><small>${sheet?h(date+' · '+rangeLabel(r)):h(rangeLabel(r))}</small></div><div class="ns-rec-n"><b>${N(r.pages_count)} ص</b>${!sheet&&r.safety_percentage!=null?`<small>${N(r.safety_percentage)}%</small>`:''}</div></div>`;
  }

  // ====================================================================================================
  //  GUARDIAN AUTOCOMPLETE (GuardianAutocompleteField) + GuardianLinkDialog
  // ====================================================================================================
  const gAccounts=()=>state.guardianAccounts||[];
  const gLabel=g=>[g.full_name||g.email||'ولي أمر',g.phone,g.email].filter(Boolean).join(' · ');
  function gaHtml(key,cfg){
    const G=S.ga[key]||(S.ga[key]={q:'',sel:null,onPick:null});if(cfg)Object.assign(G,cfg);
    return `<div class="ns-ga" id="nsGa-${key}"><label class="nx-field"><span>ولي الأمر</span><div class="ns-ga-box">${ic('AccountCircle',20)}<input id="nsGaIn-${key}" value="${h(G.q)}" placeholder="ابحث باسم ولي الأمر أو جواله" autocomplete="off" oninput="NSS.gaInput('${key}',this.value)" onfocus="NSS.gaList('${key}',true)">${G.sel?`<button type="button" class="nx-iconbtn ns-ga-x" aria-label="إزالة الربط" title="إزالة الربط" onclick="NSS.gaPick('${key}','')">${ic('Close',18)}</button>`:''}</div><small>${gAccounts().length?'يمكن ربط ولي الأمر نفسه بأكثر من طالب':'لا توجد حسابات أولياء أمور معتمدة'}</small></label><div class="ns-ga-list" id="nsGaList-${key}" hidden></div></div>`;
  }
  NSS.gaList=(key,show)=>{
    const G=S.ga[key],el=$id('nsGaList-'+key);if(!G||!el)return;
    if(!show){el.hidden=true;return}
    const nq=(typeof normalizeNameJs==='function'?normalizeNameJs:x=>String(x).toLowerCase())(G.q),raw=String(G.q||'').toLowerCase();
    const rows=gAccounts().filter(g=>!G.q||G.sel&&G.sel.full_name===G.q||normalizeNameJs(g.full_name||'').includes(nq)||String(g.email||'').toLowerCase().includes(raw)||String(g.phone||'').includes(G.q)).slice(0,8);
    el.innerHTML=`<button type="button" class="ns-ga-opt" onmousedown="event.preventDefault()" onclick="NSS.gaPick('${key}','')"><span>بدون ولي أمر مرتبط</span></button>`+rows.map(g=>`<button type="button" class="ns-ga-opt ${G.sel&&G.sel.id===g.id?'on':''}" onmousedown="event.preventDefault()" onclick="NSS.gaPick('${key}','${g.id}')">${ic('AccountCircle',18)}<span>${h(gLabel(g))}</span></button>`).join('');
    el.hidden=false;
  };
  NSS.gaInput=(key,v)=>{const G=S.ga[key];if(!G)return;G.q=v;if(G.sel&&G.sel.full_name!==v){G.sel=null;const x=document.querySelector(`#nsGa-${key} .ns-ga-x`);if(x)x.remove()}NSS.gaList(key,true)};
  NSS.gaPick=(key,id)=>{
    const G=S.ga[key];if(!G)return;const g=id?gAccounts().find(x=>x.id===id):null;
    G.sel=g||null;G.q=g?(g.full_name||g.email||''):'';
    const box=$id('nsGa-'+key);if(box){box.outerHTML=gaHtml(key)}
    if(G.onPick)G.onPick(g);
  };
  document.addEventListener('click',e=>{document.querySelectorAll('.ns-ga-list:not([hidden])').forEach(l=>{if(!l.parentElement.contains(e.target))l.hidden=true})});

  NSS.guardianLink=async sid=>{
    const list=masterStudents().filter(s=>s.status!=='withdrawn');
    if(!list.length)return;
    S.gl={sid:sid||list[0].id,saving:false,err:null};
    let cur='';const st0=findStudent(S.gl.sid);cur=(st0&&st0._guardian_id)||'';
    if(online()){try{const g=await db.from('student_guardians').select('guardian_id').eq('student_id',S.gl.sid).eq('is_primary',true).maybeSingle();cur=(g.data&&g.data.guardian_id)||cur}catch(e){}}
    const g0=gAccounts().find(x=>x.id===cur)||null;
    S.ga.gl={q:g0?(g0.full_name||''):'',sel:g0,onPick:null};
    paintGL(list);
  };
  function paintGL(list){
    const G=S.gl;list=list||masterStudents().filter(s=>s.status!=='withdrawn');
    const body=`${G.err?NX.notice(h(G.err),'danger'):''}${NX.select('الطالب',list.map(s=>({value:s.id,label:s.full_name})),{id:'nsGlStudent',value:G.sid,onchange:'NSS.glStudent(this.value)'})}${gaHtml('gl')}`;
    NX.dialog('nsGuardian','ربط ولي الأمر بالطالب',body,{cls:'ns-gl-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nsGuardian')",disabled:G.saving})}${NX.btn(G.saving?'جاري الحفظ…':'حفظ الربط',{disabled:G.saving||!G.sid,onclick:'NSS.glSave()'})}`});
  }
  NSS.glStudent=async id=>{
    S.gl.sid=id;let cur=(findStudent(id)||{})._guardian_id||'';
    if(online()){try{const g=await db.from('student_guardians').select('guardian_id').eq('student_id',id).eq('is_primary',true).maybeSingle();cur=(g.data&&g.data.guardian_id)||cur}catch(e){}}
    const g0=gAccounts().find(x=>x.id===cur)||null;S.ga.gl.sel=g0;S.ga.gl.q=g0?(g0.full_name||''):'';paintGL();
  };
  NSS.glSave=async()=>{
    const G=S.gl;if(G.saving)return;G.saving=true;paintGL();
    try{
      await saveMasterLocal('student',G.sid,{},{guardianProvided:true,guardianId:S.ga.gl.sel?S.ga.gl.sel.id:null});
      NX.closeDialog('nsGuardian');toast('تم حفظ ربط ولي الأمر');render();
      if(S.det&&S.det.id===G.sid)loadDetail(G.sid);
      if(S.profileId===G.sid)loadProfile(G.sid);
    }catch(e){G.saving=false;G.err=e.message||'تعذر ربط ولي الأمر';paintGL()}
  };

  // ====================================================================================================
  //  STUDENT EDITOR (StudentEditorDialog)
  // ====================================================================================================
  const legacyOpenStudent=typeof openStudent==='function'?openStudent:null;
  openStudent=async function(id){
    id=id||'';
    if(!manage())return toast('لا تملك صلاحية تعديل الطلاب');
    if(!state.halaqas.length){return typeof setupFirstHalaqa==='function'?setupFirstHalaqa():undefined}
    const st=id?findStudent(id):null;
    if(id&&!st&&legacyOpenStudent)return legacyOpenStudent(id);
    const act=masterHalaqas().filter(x=>x.active!==false);
    const hid=(st&&st.halaqa_id)||(act[0]&&act[0].id)||(state.halaqas[0]&&state.halaqas[0].id)||'';
    let gid=(st&&st._guardian_id)||'';
    if(st&&online()){try{const g=await db.from('student_guardians').select('guardian_id,is_primary').eq('student_id',st.id).eq('is_primary',true).maybeSingle();gid=(g.data&&g.data.guardian_id)||gid}catch(e){}}
    if(st&&!gid&&st.guardian_email)gid=((gAccounts().find(g=>String(g.email||'').toLowerCase()===String(st.guardian_email).toLowerCase()))||{}).id||'';
    const sec=new Set(((window.RC27&&window.RC27.memberships)||[]).filter(m=>st&&m.student_id===st.id&&m.status==='active'&&m.halaqa_id!==hid).map(m=>m.halaqa_id));
    S.ed={id:id,name:(st&&st.full_name)||'',nid:(st&&st.national_id)||'',phone:(st&&st.phone)||'',grade:(st&&st.school_grade)||'',dob:(st&&st.date_of_birth)||'',gender:(st&&st.gender)||'',hid,sec,orig:new Set(sec),cat:(st&&st.category_id)||'',track:st?(st.track_code==='sard'?'general_hifz':(st.track_code||'general_hifz')):'general_hifz',status:(st&&st.status)||'active',join:(st&&st.enrollment_date)||T(),program:(st&&st.program_name)||'',teacher:(st&&st.primary_teacher_id)||'',gphone:(st&&st.guardian_phone)||'',address:(st&&st.address)||'',notes:(st&&st.notes)||'',file:null,err:null,saving:false};
    const g0=gAccounts().find(x=>x.id===gid)||null;
    S.ga.ed={q:g0?(g0.full_name||''):'',sel:g0,onPick:g=>{if(g&&g.phone){S.ed.gphone=g.phone;const i=$id('nsEdGPhone');if(i)i.value=g.phone}}};
    paintEditor(true);
  };
  const edHalaqas=()=>masterHalaqas().filter(x=>x.active!==false||x.id===S.ed.hid);
  const edCats=()=>(state.categories||[]).filter(c=>c.active!==false&&(!S.ed.hid||c.halaqa_id===S.ed.hid));
  function edTeachers(){
    try{const s=document.createElement('select');fillTeachers(s,S.ed.hid);if(S.ed.teacher&&!s.querySelector(`option[value="${S.ed.teacher}"]`))s.insertAdjacentHTML('beforeend',`<option value="${S.ed.teacher}">المحفّظ الحالي</option>`);return [...s.options].map(o=>({value:o.value,label:o.textContent}))}catch(e){return [{value:'',label:'بدون تحديد'}]}
  }
  const edIn=(k,label,o={})=>NX.field(label,{cls:o.cls,html:`<input id="nsEd-${k}" type="${o.type||'text'}" value="${h(S.ed[k])}" ${o.inputmode?`inputmode="${o.inputmode}"`:''} ${o.ph?`placeholder="${h(o.ph)}"`:''} oninput="NSS.ed('${k}',this.value)" autocomplete="off">`});
  const edDate=(k,label)=>NX.field(label,{html:`<div class="ns-date"><input id="nsEd-${k}" type="date" value="${h(S.ed[k])}" onchange="NSS.ed('${k}',this.value)"><button type="button" class="nx-iconbtn" aria-label="${label}" onclick="const i=this.previousElementSibling;try{i.showPicker()}catch(e){i.focus()}">${ic('CalendarMonth',22)}</button></div>`});
  function paintEditor(first){
    const E=S.ed;if(!E)return;
    const act=edHalaqas(),secOpts=masterHalaqas().filter(x=>x.id!==E.hid&&x.active!==false&&x.allow_secondary_members!==false);
    const body=`${E.err?`<div id="nsEdErr">${NX.notice(h(E.err),'danger')}</div>`:'<div id="nsEdErr"></div>'}${online()?'':NX.notice('سيُحفظ التعديل على هذا الجهاز ويُرفع تلقائيًا عند عودة الإنترنت.','warning')}
      <div class="ns-ed-grid">
        ${edIn('name','الاسم الكامل',{cls:'wide'})}${edIn('nid','رقم الهوية',{inputmode:'numeric'})}${edIn('phone','هاتف الطالب',{inputmode:'tel'})}
        <div class="nx-field"><span>الجنس</span>${NX.chips([['male','ذكر'],['female','أنثى']].map(([k,l])=>({label:l,selected:E.gender===k,onclick:`NSS.edSet('gender','${k}')`})),{wrap:true})}</div>
        ${edDate('dob','تاريخ الميلاد')}${edIn('grade','المرحلة / الصف')}
        ${NX.select('الحلقة',act.map(x=>({value:x.id,label:x.name||'حلقة'})),{id:'nsEd-hid',value:E.hid,onchange:"NSS.edHalaqa(this.value)"})}
        <div class="nx-field wide"><span>الحلقات والبرامج الإضافية</span><small>يمكن للطالب البقاء في حلقته الأساسية والمشاركة في التجويد أو التلاوة أو الدورات الأخرى دون تكرار سجله.</small>${secOpts.length?NX.chips(secOpts.map(x=>({label:h((TYPE_LABEL[x.halaqa_type]||(x.halaqa_type==='regular'||!x.halaqa_type?'حلقة':'برنامج'))+' · '+(x.name||'برنامج')),selected:E.sec.has(x.id),onclick:`NSS.edSec('${x.id}')`})),{wrap:true}):'<small>لا توجد برامج إضافية متاحة</small>'}</div>
        ${NX.select('الفئة',[{value:'',label:'بدون الفئة'}].concat(edCats().map(c=>({value:c.id,label:c.name}))),{id:'nsEd-cat',value:E.cat,onchange:"NSS.ed('cat',this.value)"})}
        ${NX.select('المحفّظ الأساسي',edTeachers(),{id:'nsEd-teacher',value:E.teacher,onchange:"NSS.ed('teacher',this.value)"})}
        <div class="nx-field"><span>المسار</span>${NX.chips([['general_hifz','الحفظ العام'],['tathbit','التثبيت']].map(([k,l])=>({label:l,selected:E.track===k,check:false,onclick:`NSS.edSet('track','${k}')`})),{wrap:true})}</div>
        <div class="nx-field"><span>الحالة</span>${NX.chips([['active','نشط'],['inactive','غير نشط'],['suspended','موقوف'],['withdrawn','منسحب']].map(([k,l])=>({label:l,selected:E.status===k,check:false,onclick:`NSS.edSet('status','${k}')`})),{wrap:true})}</div>
        ${edDate('join','تاريخ الالتحاق')}${edIn('program','البرنامج')}
        <div class="wide">${gaHtml('ed')}</div>
        ${edIn('gphone','جوال ولي الأمر',{inputmode:'tel'}).replace('id="nsEd-gphone"','id="nsEdGPhone"')}${edIn('address','العنوان')}
        ${NX.field('ملاحظات',{cls:'wide',html:`<textarea id="nsEd-notes" rows="2" oninput="NSS.ed('notes',this.value)">${h(E.notes)}</textarea>`})}
        ${NX.field('صورة الطالب',{cls:'wide',html:`<input id="nsEd-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="NSS.edFile(this)">`,hint:E.file?h(E.file.name):''})}
      </div>`;
    const foot=`${NX.btn('إلغاء',{kind:'text',disabled:E.saving,onclick:"NX.closeDialog('nsEditor')"})}${NX.btn(E.saving?'جاري الحفظ…':online()?'حفظ':'حفظ محليًا',{id:'nsEdSave',disabled:E.saving||!edValid(),onclick:'NSS.edSave()'})}`;
    const title=E.id?'تعديل بيانات الطالب':'إضافة طالب';
    const d=$id('nsEditor');
    if(d&&d.open&&!first){const c=d.querySelector('.nx-dlg-content'),top=c.scrollTop;c.innerHTML=body;d.querySelector('.nx-dlg-foot').innerHTML=foot;c.scrollTop=top}
    else NX.dialog('nsEditor',title,body,{cls:'ns-editor',footer:foot});
  }
  const edValid=()=>S.ed&&S.ed.name.trim().length>=2&&!!S.ed.hid;
  NSS.ed=(k,v)=>{S.ed[k]=v;const b=$id('nsEdSave');if(b)b.disabled=S.ed.saving||!edValid()};
  NSS.edSet=(k,v)=>{S.ed[k]=v;paintEditor()};
  NSS.edSec=id=>{if(S.ed.sec.has(id))S.ed.sec.delete(id);else S.ed.sec.add(id);paintEditor()};
  NSS.edHalaqa=v=>{S.ed.hid=v;S.ed.sec.delete(v);if(S.ed.cat&&!edCats().some(c=>c.id===S.ed.cat))S.ed.cat='';paintEditor()};
  NSS.edFile=i=>{S.ed.file=i.files&&i.files[0]||null;const s=i.parentElement.querySelector('small');if(s)s.textContent=S.ed.file?S.ed.file.name:''};
  async function saveMemberships(sid,E){
    const same=E.sec.size===E.orig.size&&[...E.sec].every(x=>E.orig.has(x));
    if(same)return;
    if(!online()){toast('تغيير البرامج الإضافية يحتاج اتصالاً بالإنترنت');return}
    const today=T(),ex=await db.from('student_halaqa_memberships').select('*').eq('student_id',sid);
    const by=new Map((ex.data||[]).map(m=>[m.halaqa_id,m]));
    for(const hid of E.sec){if(hid===E.hid)continue;const r=await db.from('student_halaqa_memberships').upsert({student_id:sid,halaqa_id:hid,membership_type:'participant',status:'active',joined_at:(by.get(hid)&&by.get(hid).joined_at)||today,ended_at:null,updated_at:new Date().toISOString()},{onConflict:'student_id,halaqa_id'});if(r.error)throw r.error}
    for(const [hid,row] of by){if(!hid||E.sec.has(hid)||row.status!=='active')continue;const r=await db.from('student_halaqa_memberships').update({status:'withdrawn',ended_at:today,updated_at:new Date().toISOString()}).eq('student_id',sid).eq('halaqa_id',hid);if(r.error)throw r.error}
    const RC=window.RC27;if(RC){RC.memberships=(RC.memberships||[]).filter(m=>m.student_id!==sid).concat([...E.sec].filter(x=>x!==E.hid).map(hid=>({student_id:sid,halaqa_id:hid,status:'active'})))}
  }
  NSS.edSave=async()=>{
    const E=S.ed;if(!E||E.saving)return;
    const name=E.name.trim(),hid=E.hid,id=E.id,fail=m=>{E.err=m;paintEditor()};
    if(name.length<2)return fail('اسم الطالب مطلوب');if(!hid)return fail('اختر الحلقة');
    const dup=activeStudents().find(x=>x.id!==id&&x.halaqa_id===hid&&normalizeNameJs(x.full_name)===normalizeNameJs(name));if(dup)return fail(`الطالب مكرر: «${dup.full_name}» مسجل بالفعل في هذه الحلقة.`);
    const nid=E.nid.trim(),dupId=nid&&activeStudents().find(x=>x.id!==id&&x.halaqa_id===hid&&x.national_id===nid);if(dupId)return fail(`رقم الهوية مستخدم للطالب «${dupId.full_name}».`);
    E.saving=true;E.err=null;paintEditor();
    try{
      const old=id?findStudent(id):null,stableId=id||offlineUuid();let photoPath=(old&&old.photo_path)||null,photoDeferred=false;
      if(E.file){try{const pth=await uploadStudentPhotoOnline(stableId,E.file);if(pth)photoPath=pth;else photoDeferred=true}catch(err){photoDeferred=true}}
      const nz=v=>String(v||'').trim()||null;
      const obj={full_name:name,halaqa_id:hid,gender:E.gender||null,national_id:nid||null,phone:nz(E.phone),date_of_birth:E.dob||null,category_id:E.cat||null,track_code:E.track||null,status:E.status||'active',program_name:nz(E.program),school_grade:nz(E.grade),primary_teacher_id:E.teacher||((!state.networkVerified&&old&&old.primary_teacher_id)?old.primary_teacher_id:null),guardian_phone:nz(E.gphone),enrollment_date:E.join||T(),address:nz(E.address),notes:E.notes||null,photo_path:photoPath};
      if(E.status==='withdrawn'&&(!old||old.status!=='withdrawn')){obj.withdrawn_at=new Date().toISOString();obj.withdrawn_by=state.user&&state.user.id}
      if(E.status!=='withdrawn'&&old&&old.status==='withdrawn'){obj.withdrawn_at=null;obj.withdrawn_by=null}
      await saveMasterLocal('student',stableId,obj,{guardianProvided:true,guardianId:S.ga.ed.sel?S.ga.ed.sel.id:null});
      try{await saveMemberships(stableId,E)}catch(err){toast('تعذر حفظ البرامج الإضافية: '+(err.message||err))}
      NX.closeDialog('nsEditor');S.ed=null;
      toast(id?'تم حفظ تعديلات الطالب محلياً وستتم المزامنة تلقائياً':'تمت إضافة الطالب محلياً وستتم المزامنة تلقائياً');
      if(photoDeferred)toast('تم حفظ بيانات الطالب. صورة جديدة تحتاج اتصالاً مستقراً بالإنترنت لإرسالها.');
      render();if(S.det&&S.det.id===stableId)loadDetail(stableId);if(S.profileId===stableId)loadProfile(stableId);
    }catch(err){E.saving=false;E.err=err.message||'تعذر حفظ بيانات الطالب';paintEditor()}
  };

  // ====================================================================================================
  //  STUDENT PROFILE (StudentProfileScreen)
  // ====================================================================================================
  const legacyProfile=typeof studentProfile==='function'?studentProfile:null;
  studentProfile=function(id){
    if((state.profile&&state.profile.role)==='guardian'&&legacyProfile)return legacyProfile.apply(this,arguments);
    const st=findStudent(id);
    if(!st){toast('لم يتم العثور على الطالب');return}
    NX.closeDialog('nsDetail');
    S.profileId=id;S.profilePage=state.page;S.prof={id,loading:true,recs:[],att:[],week:[],comment:null,guardian:null,err:null};
    paintProfile();loadProfile(id);
  };
  function paintProfile(){
    const c=$id('content');if(!c||!S.profileId)return;
    c.innerHTML=profileHtml();c.scrollTop=0;try{window.scrollTo(0,0)}catch(e){}
    try{if(typeof rc27DetailEnter==='function')rc27DetailEnter()}catch(e){}
  }
  NSS.back=()=>{const p=S.profilePage||'students';S.profileId=null;S.prof=null;go(p)};
  NSS.refreshProfile=()=>{if(S.profileId)loadProfile(S.profileId,true)};
  async function loadProfile(id,force){
    const st=findStudent(id);if(!st)return;
    const old=S.prof&&S.prof.id===id?S.prof:null;
    S.prof={id,loading:!old||!old.loaded,refreshing:!!force,recs:old?old.recs:[],att:old?old.att:[],week:old?old.week:[],comment:old?old.comment:null,guardian:old?old.guardian:null,err:null,loaded:old?old.loaded:false,online:online()};
    if(S.profileId===id)paintProfile();
    const P0=S.prof;
    if(online()){
      try{
        const t=T(),ms=t.slice(0,8)+'01',ws=addD(t,-P(t).getDay()),hf=ms<addD(ws,-21)?ms:addD(ws,-21),we=addD(ws,6);
        try{if(window.RC27Phases&&RC27Phases.load)await RC27Phases.load(!!force)}catch(e){}
        const [rec,att,wk,cm,gu]=await Promise.all([
          db.from('recitation_entries').select('id,phase_id,activity_type,start_surah,start_ayah,end_surah,end_ayah,start_page,end_page,pages_count,evaluation,mistakes,prompts,safety_percentage,created_at,sessions!inner(session_date,session_type,title)').eq('student_id',id).gte('sessions.session_date',hf).lte('sessions.session_date',t).order('created_at',{ascending:false}).limit(1000),
          db.from('attendance_records').select('status,arrival_minutes_late,excuse_reason,recorded_at,sessions!inner(session_date)').eq('student_id',id).gte('sessions.session_date',hf).lte('sessions.session_date',t).order('recorded_at',{ascending:false}).limit(1000),
          st.halaqa_id?db.from('sessions').select('id,session_date,session_type,title,status').eq('halaqa_id',st.halaqa_id).gte('session_date',ws).lte('session_date',we).order('session_date',{ascending:true}).limit(100):Promise.resolve({data:[]}),
          db.from('monthly_comments').select('id,student_id,month_start,teacher_comment,supervisor_comment,overall_rating,updated_at').eq('student_id',id).eq('month_start',ms).limit(1),
          db.from('student_guardians').select('guardian_id,is_primary').eq('student_id',id).eq('is_primary',true).maybeSingle()]);
        if(rec.error&&att.error)throw rec.error;
        P0.recs=rec.data||[];P0.att=att.data||[];P0.week=wk.data||[];P0.comment=(cm.data||[])[0]||null;
        const gid=(gu.data&&gu.data.guardian_id)||st._guardian_id;P0.guardian=gAccounts().find(g=>g.id===gid)||null;
      }catch(e){P0.err=e.message||'تعذر تحميل ملف الطالب'}
    }
    P0.loading=false;P0.refreshing=false;P0.loaded=true;
    if(S.profileId===id&&S.prof===P0)paintProfile();
  }

  function insight(sn,recs,att){
    const t=T(),ms=t.slice(0,8)+'01';
    const mr=recs.filter(r=>((r.sessions&&r.sessions.session_date)||'')>=ms),q=mr.filter(r=>r.safety_percentage!=null);
    const avg=q.length?q.reduce((a,r)=>a+Number(r.safety_percentage),0)/q.length:null;
    const mistakes=mr.reduce((a,r)=>a+Number(r.mistakes||0),0),prompts=mr.reduce((a,r)=>a+Number(r.prompts||0),0);
    const c=s=>att.filter(a=>a.status===s).length,present=c('present'),late=c('late'),absent=c('absent'),excused=c('excused');
    const pr=sn&&sn.progress,req=pr?Number(pr.plannedByToday)||0:0,done=pr?Number(pr.completed)||0:0,missed=pr?Number(pr.consecutiveMissed)||0:0;
    const ratio=req<=.01?1:Math.max(0,done/req),quality=avg==null?100:avg;
    const level=ratio>=1&&quality>=90?'ممتاز':ratio>=.9&&quality>=82?'جيد جدًا':ratio>=.75&&quality>=72?'جيد':'يحتاج متابعة';
    const reasons=[],behind=Math.max(0,req-done);
    if(behind>=.5)reasons.push([behind>=7?100:70,`متأخر عن المطلوب حتى اليوم ${N(behind)} صفحة`]);
    if(avg!=null&&avg<78)reasons.push([80,`جودة التسميع ${N(avg)}% وتحتاج متابعة`]);
    if(absent+excused>=2)reasons.push([75,`لديه ${absent+excused} أيام غياب هذا الشهر`]);
    if(missed>=2)reasons.push([85,`لم ينجز نشاطه في ${missed} أيام مقررة`]);
    reasons.sort((a,b)=>b[0]-a[0]);
    return {level,reasons:reasons.map(r=>r[1]),avg,mistakes,prompts,present,late,absent,excused,mr};
  }
  function phaseData(sn,st){
    const PS=window.RC27Phases&&RC27Phases.S;if(!PS||!sn||!sn.plan)return {phases:[],states:new Map()};
    const phases=(PS.phases||[]).filter(p=>p.plan_id===sn.plan.id&&p.status!=='archived').sort((a,b)=>(a.phase_order||0)-(b.phase_order||0));
    const states=new Map((PS.states||[]).filter(x=>x.student_id===st.id).map(x=>[x.phase_id,x]));
    return {phases,states};
  }
  function monthPhasesCard(st,sn,recs){
    const {phases,states}=phaseData(sn,st);if(!phases.length)return '';
    const t=T(),targetOf=ph=>{const s=states.get(ph.id);if(s&&s.frozen_target_pages!=null)return Number(s.frozen_target_pages);let base=s&&s.target_pages_override!=null?Number(s.target_pages_override):(ph.target_pages!=null?Number(ph.target_pages):(ph.goal_mode==='juz'&&ph.target_units!=null?Number(ph.target_units)*20:null));return base==null?null:base+Number(s&&s.carry_shortfall_pages||0)};
    const pagesOf=ph=>{const a=String(ph.start_date).slice(0,10),b=String(ph.end_date).slice(0,10);return recs.filter(r=>{const d=(r.sessions&&r.sessions.session_date)||'',tag=r.phase_id,act=r.activity_type,tm=ph.phase_type==='sard'?act==='sard':['new_hifz','hifz'].includes(act);return tm&&(tag===ph.id||(!tag&&d>=a&&d<=b))}).reduce((x,r)=>x+Math.max(0,Number(r.pages_count||0)),0)};
    const doneOf=ph=>{const s=states.get(ph.id);if(s&&s.frozen_completed_pages!=null)return Number(s.frozen_completed_pages);return pagesOf(ph)};
    const statusOf=ph=>{const s=states.get(ph.id);if(s&&s.status==='completed')return 'مكتملة';if(s&&s.status==='active')return 'نشطة';if(s&&s.status==='skipped')return 'مستثناة';const a=String((s&&s.start_date_override)||ph.start_date).slice(0,10),b=String((s&&s.end_date_override)||ph.end_date).slice(0,10);if(t>=a&&t<=b)return 'نشطة';if(t>b)return 'منتهية';if(t<a)return 'مجدولة';return 'غير نشطة'};
    const hifz=phases.find(p=>p.phase_type==='hifz'),sard=phases.find(p=>p.phase_type==='sard');if(!hifz&&!sard)return '';
    const lineFor=(ph,icon,title,openTxt)=>{const tg=targetOf(ph),dn=doneOf(ph);return `<div class="ns-phase">${ic(icon,20)}<div class="nx-grow"><b>${title} · ${statusOf(ph)}</b><small>${tg!=null?`${N(dn)} / ${N(tg)} ص · ${N(dn/Math.max(tg,.001)*100)}%`:openTxt.replace('{n}',N(dn))}</small></div></div>`};
    let lastSard='';
    if(sard){const rows=recs.filter(r=>r.activity_type==='sard').sort((a,b)=>String((b.sessions||{}).session_date||'').localeCompare(String((a.sessions||{}).session_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));if(rows[0])lastSard=`<small class="nx-muted">آخر سرد: ${h(rangeLabel(rows[0]))}${(rows[0].sessions||{}).session_date?' · '+h(rows[0].sessions.session_date):''}</small>`}
    return NX.card(`<div class="nx-row ns-ctitle">${ic('Timeline',22)}<b class="nx-t-title-m">مراحل الشهر</b></div>${hifz?lineFor(hifz,'MenuBook','الحفظ','{n} ص'):''}${sard?lineFor(sard,'RecordVoiceOver','السرد','سرد مفتوح · {n} ص')+lastSard:''}`,{cls:'ns-ecard ns-stack'});
  }
  function progressCard(sn,st,eligible){
    let body=`<div class="nx-t-title-m ns-b">الخطة الشهرية</div>`;
    if(!sn||!sn.progress)return NX.card(body+`<p class="nx-muted ns-p">${eligible?'لا توجد خطة فعالة لهذا الطالب':'هذا الطالب في برنامج غير حلقي، ولا تُطبَّق عليه الخطط الذكية'}</p>`,{cls:'ns-ecard'});
    const pr=sn.progress,plan=sn.plan,target=Number(plan.target_pages||pr.plan&&pr.plan.target_pages||0),ahead=Number(pr.aheadBy)>.01;
    const vals=[['الهدف',target],['المطلوب',pr.plannedByToday],['المنجز',pr.completed],[ahead?'الزائد':'المتبقي',ahead?pr.aheadBy:pr.remaining]];
    const frac=target<=0?0:Math.max(0,Math.min(1,Number(pr.completed)/target))*100;
    const a=pr.assignment;
    return NX.card(body+`<div class="ns-minis four">${vals.map(([l,v])=>miniMetric(l,N(v)+' ص')).join('')}</div>${NX.progress(frac)}${a&&Number(a.pages)>0?`<p class="ns-cap">المقرر القادم: ${h(typeof smartPlanRangeText==='function'&&a.startPage!=null?smartPlanRangeText(a.startPage,a.endPage):(a.ayahLabel||'المقرر الذكي'))} · ${N(a.pages)} ص</p>`:''}`,{cls:'ns-ecard ns-stack'});
  }
  function weekCard(sn,st,P0){
    const t=T(),ws=addD(t,-P(t).getDay()),{phases,states}=phaseData(sn,st);
    const by=(rows,f)=>{const m=new Map();rows.forEach(r=>{const k=f(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)});return m};
    const rBy=by(P0.recs,r=>(r.sessions||{}).session_date||''),aBy=by(P0.att,r=>(r.sessions||{}).session_date||''),sBy=by(P0.week,r=>r.session_date);
    const eff=d=>phases.filter(p=>!(states.get(p.id)&&states.get(p.id).status==='skipped')).find(p=>{const s=states.get(p.id),a=String((s&&s.start_date_override)||p.start_date).slice(0,10),b=String((s&&s.end_date_override)||p.end_date).slice(0,10);return d>=a&&d<=b});
    const rows=[0,1,2,3,4,5,6].map(o=>{
      const d=addD(ws,o),ph=eff(d),sched=!!ph&&(ph.schedule_weekdays||[]).includes(P(d).getDay()),sr=sBy.get(d)||[],rr=rBy.get(d)||[],ar=aBy.get(d)||[],done=rr.reduce((x,r)=>x+Math.max(0,Number(r.pages_count||0)),0);
      const act=rr.length?actShort(rr[0].activity_type):(ph&&ph.phase_type==='sard'&&sched)?'سرد':(ph&&ph.phase_type==='hifz'&&sched)?'حفظ':sr.length?actShort(sr[0].session_type):'—';
      const as=ar[0]&&ar[0].status;
      const status=d>t&&(sched||sr.length)?'قادم':d>t?'غير مجدول':rr.length?'تم التسميع':as==='absent'?'غائب':as==='excused'?'بعذر':as==='late'?'حاضر متأخر ولم يسمّع':as==='present'?'حاضر لم يسمّع':sr.length?'لا يوجد سجل حضور/تسميع':sched?'لا توجد جلسة':P(d).getDay()===6?'إجازة':'لا توجد جلسة';
      const cls=status==='تم التسميع'?'ok':(status==='غائب'||status==='لا توجد جلسة')?'bad':'';
      return `<div class="ns-wk"><b>${DAYS[P(d).getDay()]}</b><span class="nx-muted">${act}</span><span>${done<=0?'—':N(done)+' ص'}</span><span class="ns-wk-s ${cls}">${status}</span></div>`;
    }).join('');
    return NX.card(`<div class="nx-t-title-m ns-b">هذا الأسبوع</div><p class="ns-cap">الإجازة لا تُستنتج من غياب التسميع. السبت إجازة ثابتة؛ وبقية الأيام بلا جلسة تظهر «لا توجد جلسة» بدل «إجازة».</p><div class="ns-week">${rows}</div>`,{cls:'ns-ecard ns-stack'});
  }
  function fourWeeks(sn,P0){
    if(!sn||!sn.progress)return '';
    const t=T(),cs=addD(t,-P(t).getDay());
    let target=0;try{target=Number(smartPlanWeekRequirement(sn.plan,sn.progress,t).amount)||0}catch(e){}
    if(!target)target=Number(sn.progress.weekly&&sn.progress.weekly.target)||0;
    const rows=[3,2,1,0].map(back=>{const a=addD(cs,-7*back),b=addD(a,6),done=P0.recs.filter(r=>{const d=(r.sessions||{}).session_date||'';return d>=a&&d<=b}).reduce((x,r)=>x+Number(r.pages_count||0),0);return `<div class="ns-4w"><span>${back===0?'الحالي':'قبل '+back}</span>${NX.progress(target<=0?0:Math.min(100,done/target*100))}<b>${N(done)} / ${N(target)}</b></div>`}).join('');
    return NX.card(`<div class="nx-t-title-m ns-b">آخر 4 أسابيع</div>${rows}`,{cls:'ns-ecard ns-stack'});
  }
  function profileHtml(){
    const id=S.profileId,st=findStudent(id);
    if(!st)return NX.empty('لم يتم العثور على الطالب',{icon:'SearchOff'});
    const P0=S.prof&&S.prof.id===id?S.prof:{loading:true,recs:[],att:[],week:[]},C=ctx();
    const pend=typeof readOfflineQueue==='function'?readOfflineQueue().length:0;
    const header=`<div class="ns-phead">${NX.iconBtn('ArrowBack',{title:'رجوع',onclick:'NSS.back()'})}<div class="nx-grow"><h2>${h(st.full_name)}</h2>${pend?`<small>${pend} عملية بانتظار المزامنة</small>`:''}</div>${NX.iconBtn('Refresh',{title:'تحديث',onclick:'NSS.refreshProfile()'})}</div>`;
    if(P0.loading&&!P0.loaded)return `<div class="ns-prof">${header}${NX.skeleton(6)}</div>`;
    return memo(()=>{
      S.snap.delete(st.id);const sn=snap(st),I=insight(sn,P0.recs,P0.att),hq=C.hq.get(st.halaqa_id),eligible=!isProgram(hq);
      let plan='لا توجد خطة';
      if(!sn||!sn.progress)plan=eligible?'لا توجد خطة':'برنامج بلا خطة ذكية';
      else{const pr=sn.progress;plan=Number(pr.percentage)>=100?'أتم الخطة':Number(pr.aheadBy)>.01?`متقدم +${N(pr.aheadBy)} ص`:Number(pr.behindBy)>.01?`متأخر ${N(pr.behindBy)} ص`:'على الخطة'}
      const heroC=NX.card(`<div class="nx-row">${state.photoUrls&&state.photoUrls[st.id]?avatar(st,42):personBadge(42)}<div class="nx-grow"><h3 class="ns-pname">${h(st.full_name)}</h3><small class="nx-muted">${trackName(st.track_code)} · ${stAr(st.status)}</small></div>${manage()?NX.kebab([{label:'تعديل البيانات',icon:'Edit',onclick:()=>openStudent(st.id)},{label:'ولي الأمر',icon:'SupervisorAccount',onclick:()=>NSS.guardianLink(st.id)}],{title:'خيارات الطالب'}):''}</div><div class="ns-badges"><span class="ns-badge">${ic('Star',16)}${h(I.level)}</span><span class="ns-badge">${ic('Timeline',16)}${h(plan)}</span></div>`,{cls:'ns-ecard ns-stack'});
      const g=P0.guardian,gd=[(g&&g.phone)||st.guardian_phone,(g&&g.email)||st.guardian_email].filter(Boolean).join(' · ');
      const guardianC=NX.card(`<div class="nx-row">${ic('SupervisorAccount',22,'ns-pri')}<div class="nx-grow"><b class="nx-t-title-s">ولي الأمر</b><div class="nx-t-body-m">${h(g?(g.full_name||g.email):'غير مرتبط بحساب ولي أمر')}</div>${gd?`<small class="nx-muted nx-ellipsis">${h(gd)}</small>`:''}</div>${manage()?NX.btn(g?'تعديل':'ربط',{kind:'text',small:true,onclick:`NSS.guardianLink('${st.id}')`}):''}</div>`,{cls:'ns-ecard'});
      const qa=NX.card(`<div class="ns-qa"><div>${ic('Verified',20,'ns-pri')}<b>جودة التسميع</b><span class="ns-big">${I.avg==null?'—':N(I.avg)+'%'}</span><small>${I.mistakes} خطأ · ${I.prompts} تلقين</small></div><div>${ic('EventAvailable',20,'ns-pri')}<b>الحضور</b><span class="ns-big">${I.present+I.late} حاضر</span><small>${I.absent} غائب · ${I.excused} بعذر · ${I.late} متأخر</small></div></div>`,{cls:'ns-ecard'});
      const follow=NX.card(`<div class="nx-t-title-m ns-b">لماذا يحتاج متابعة؟</div>${I.reasons.length?I.reasons.map(r=>`<div class="ns-reason">${ic('WarningAmber',18)}<span>${h(r)}</span></div>`).join(''):'<p class="ns-ok">لا توجد أسباب متابعة حرجة حاليًا</p>'}`,{cls:'ns-ecard ns-stack'});
      const cmt=(P0.comment&&P0.comment.teacher_comment)||'';
      const note=NX.card(`<div class="nx-row">${ic('StickyNote2',21,'ns-pri')}<div class="nx-grow"><b class="nx-t-title-s">ملاحظة متابعة الشهر</b><small class="nx-muted ns-clamp">${h(cmt||'لا توجد ملاحظة متابعة')}</small></div>${NX.btn(cmt?'تعديل':'إضافة',{kind:'text',small:true,onclick:'NSS.noteEdit()'})}</div>`,{cls:'ns-ecard'});
      const lr=((P0.recs[0]||{}).sessions||{}).session_date||'',la=((P0.att[0]||{}).sessions||{}).session_date||'';
      const last=NX.card(`<b class="nx-t-title-s">آخر نشاط فعلي</b><p class="ns-p">آخر تسميع: ${h(lr||'لا يوجد')}</p><p class="ns-p">آخر حضور: ${h(la||'لا يوجد')}</p>`,{cls:'ns-ecard ns-stack-s'});
      const issues=[];if(!g)issues.push('لا يوجد حساب ولي أمر مرتبط');if((!sn||!sn.progress)&&st.status==='active'&&eligible)issues.push('لا توجد خطة ذكية فعالة');if(!P0.att.length)issues.push('لا توجد بيانات حضور هذا الشهر');if(!P0.recs.length)issues.push('لا توجد تسميعات هذا الشهر');
      const health=issues.length?NX.card(`<b class="nx-t-title-s">صحة البيانات</b>${issues.map(i=>`<p class="ns-p nx-muted">• ${h(i)}</p>`).join('')}`,{cls:'ns-ecard ns-stack-s'}):'';
      const mems=((window.RC27&&window.RC27.memberships)||[]).filter(m=>m.student_id===st.id&&m.halaqa_id!==st.halaqa_id&&C.hq.has(m.halaqa_id));
      const progs=NX.card(`<div class="nx-t-title-m ns-b">الحلقة والبرامج</div><div class="ns-chips-row">${st.halaqa_id?`<span class="ns-badge">${ic('Groups',16)}${h(C.hname(st.halaqa_id))}</span>`:''}${mems.map(m=>`<span class="ns-badge">${h(C.hname(m.halaqa_id))} · ${m.status==='active'?'نشط':m.status==='completed'?'أتم البرنامج':h(m.status)}</span>`).join('')}</div>`,{cls:'ns-ecard ns-stack-s'});
      const recsC=`<div class="nx-t-title-m ns-h">آخر التسميعات</div>${P0.recs.length?`<div class="ns-recs">${P0.recs.slice(0,8).map(r=>recRow(r,false)).join('')}</div>`:NX.empty('لا توجد تسميعات مسجلة هذا الشهر',{icon:'MenuBook'})}`;
      const buttons=`<div class="ns-two">${manage()?NX.btn('إدارة البيانات',{kind:'outlined',icon:'Edit',full:true,onclick:`NSS.detail('${st.id}',true)`}):''}${NX.btn('الخطة الذكية',{icon:'AutoGraph',full:true,onclick:"go('plans')"})}</div>`;
      const main=heroC+monthPhasesCard(st,sn,P0.recs)+progressCard(sn,st,eligible)+weekCard(sn,st,P0)+fourWeeks(sn,P0);
      const side=qa+guardianC+follow+note+last+progs+health;
      const offline=P0.online===false||!online()?NX.notice('وضع الأوفلاين: يعرض الملف ما هو محفوظ على الجهاز، وتظهر التسميعات والحضور بعد المزامنة.','warning'):'';
      return `<div class="ns-prof ${P0.refreshing?'refreshing':''}">${header}${P0.err?NX.notice(h(P0.err),'warning'):''}${offline}<div class="ns-prof-grid"><div class="ns-prof-main">${main}</div><div class="ns-prof-side">${side}</div></div>${recsC}${buttons}</div>`;
    });
  }
  NSS.noteEdit=()=>{
    const P0=S.prof;if(!P0)return;const cur=(P0.comment&&P0.comment.teacher_comment)||'';
    NX.dialog('nsNote','ملاحظة متابعة',NX.field('ملاحظة المحفّظ لهذا الشهر',{html:`<textarea id="nsNoteTxt" rows="4">${h(cur)}</textarea>`}),{cls:'ns-note-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nsNote')"})}${NX.btn('حفظ',{onclick:'NSS.noteSave()'})}`});
  };
  NSS.noteSave=async()=>{
    const P0=S.prof;if(!P0)return;const v=($id('nsNoteTxt')||{}).value||'';
    if(!online())return toast('حفظ ملاحظة المتابعة يحتاج اتصالاً بالإنترنت');
    NX.closeDialog('nsNote');
    const ms=T().slice(0,8)+'01',id=(P0.comment&&P0.comment.id)||(typeof offlineUuid==='function'?offlineUuid():crypto.randomUUID());
    const row={id,student_id:P0.id,month_start:ms,teacher_comment:v.trim()};
    const r=await db.from('monthly_comments').upsert(row,{onConflict:'student_id,month_start'});
    if(r.error){P0.err=r.error.message||'تعذر حفظ ملاحظة المتابعة';paintProfile();return}
    P0.comment=row;P0.err=null;toast('تم حفظ الملاحظة');paintProfile();
  };

  // ====================================================================================================
  //  STUDENT FOLLOW-UP (StudentFollowUpScreen) — restyles the rc27 dashboard `follow_up` page
  // ====================================================================================================
  function followUp(){
    const c=$id('content');if(!c||state.page!=='follow_up')return;
    if(c.querySelector('.nh-follow')||c.querySelector('.ns-fu'))return; // already native (home agent restyled it)
    // read the rc27 dashboard output, then rebuild it with the NX kit
    const total=(c.querySelector(':scope > .muted')||{}).textContent||'';
    const q=((c.querySelector(':scope > input')||{}).value)||'';
    const tabs=[...c.querySelectorAll(':scope > .tabs .tab')].map(b=>({label:b.textContent.trim(),on:b.classList.contains('active')}));
    const loading=!!c.querySelector(':scope > .rc27-skel');
    const groups=[];let cur=null,emptyTxt='';
    [...c.children].forEach(n=>{
      if(n.classList.contains('section-head')&&n.querySelector('b')){cur={title:n.querySelector('h3').textContent.trim(),items:[]};groups.push(cur)}
      else if(n.classList.contains('card')&&cur){const m=/studentProfile\('([^']+)'\)/.exec(n.getAttribute('onclick')||'');cur.items.push({id:m&&m[1],name:(n.querySelector('b')||{}).textContent||'',reason:(n.querySelector('.muted')||{}).textContent||''})}
      else if(n.classList.contains('empty'))emptyTxt=n.textContent.trim();
    });
    const body=loading?NX.skeleton(5):emptyTxt?NX.empty(emptyTxt,{icon:'PersonSearch'}):groups.map(g=>`<div class="ns-fu-g"><div class="ns-fu-gh"><h3>${h(g.title)}</h3><b>${g.items.length}</b></div><div class="ns-fu-items">${g.items.map(it=>`<button type="button" class="ns-fu-item" onclick="studentProfile('${it.id}')">${ic('PersonSearch',19,'ns-pri')}<span class="nx-grow"><b>${h(it.name)}</b><small>${h(it.reason)}</small></span>${ic('ChevronLeft',20)}</button>`).join('')}</div></div>`).join('');
    c.innerHTML=`<div class="ns-fu"><div class="ns-phead">${NX.iconBtn('ArrowBack',{title:'رجوع',onclick:"go('home')"})}<div class="nx-grow"><h2>متابعة الطلاب</h2><small>${h(total)}</small></div>${NX.iconBtn('Refresh',{title:'تحديث',onclick:'rc27DashRefresh&&rc27DashRefresh()'})}</div>
      ${NX.search(q,'ابحث باسم الطالب أو سبب المتابعة',{id:'nsFuSearch',oninput:'NSS.fuSearch(this.value)'})}
      ${tabs.length?NX.chips(tabs.map(t=>({label:h(t.label),selected:t.on,onclick:`O_fsel(${JSON.stringify(t.label).replace(/"/g,'&quot;')})`}))):''}
      <div class="ns-fu-body">${body}</div></div>`;
    if(S.fuRefocus){S.fuRefocus=false;const i=$id('nsFuSearch');if(i){i.focus();const l=i.value.length;try{i.setSelectionRange(l,l)}catch(e){}}}
  }
  NSS.fuSearch=v=>{clearTimeout(S.fuT);S.fuT=setTimeout(()=>{S.fuRefocus=true;if(typeof O_fq==='function')O_fq(v)},300)};

  // ---------- wiring ----------
  if(typeof go==='function'){const baseGo=go;go=function(){S.profileId=null;S.prof=null;return baseGo.apply(this,arguments)}}
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const r=await baseRender.apply(this,arguments);
      try{
        if(S.profileId&&state.page!==S.profilePage){S.profileId=null;S.prof=null}
        else if(S.profileId&&state.page!=='students')paintProfile();
        if(state.page==='follow_up')followUp();
        if(state.page==='students'&&!S.profileId&&S.panelId&&isDk()&&S.det&&S.det.id===S.panelId)paintDetail();
        if(state.page==='students'&&!S.profileId&&isDk()&&S.panelId&&!S.det)loadDetail(S.panelId);
      }catch(e){console.warn('native students',e)}
      return r;
    };
  }
  document.addEventListener('keydown',e=>{
    if(!isDk()||state.page!=='students'||S.profileId)return;
    const row=e.target&&e.target.closest&&e.target.closest('.ns-row');
    if(e.key==='Escape'&&S.panelId&&!document.querySelector('dialog[open]')){NSS.closePanel();return}
    if(!row)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=e.key==='ArrowDown'?row.nextElementSibling:row.previousElementSibling;if(n&&n.classList.contains('ns-row')){n.focus();NSS.selectRow(n.dataset.sid)}}
    else if(e.key==='Enter'&&!e.target.closest('button,input')){e.preventDefault();studentProfile(row.dataset.sid)}
    else if(e.key===' '&&!e.target.closest('button,input')){e.preventDefault();NSS.selectRow(row.dataset.sid)}
  });
})();
