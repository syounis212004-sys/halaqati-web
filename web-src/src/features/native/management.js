/* RC27.40 native screens: management — web twin of HalaqasManagementScreen (+ Members/Staff/Delete/Halaqa/Categories dialogs),
   SupervisionNativeScreen (+ SupervisorVisitDialog/ScorePicker) and UsersScreen (+ AccountStatusBadge, Role/Reject/Delete dialogs,
   GuardianLinkDialog) from ManagementScreens.kt / CoreScreens.kt. Replaces halaqasPage / supervisionPage / usersPage and reuses the
   legacy data layer (state, db, saveMasterLocal, deleteMasterLocal, loadAll, refreshAdminUsers). See docs/NATIVE_PORT_BRIEF.md. */
(function(){
'use strict';
const G=window.NGM={};
const h=s=>NX.h(s), ic=(n,s,c)=>NX.icon(n,s,c);
const $i=id=>document.getElementById(id);
const mst=()=>window.RC27&&RC27.master||null;
const allStudents=()=>(mst()&&mst().students)||state.students||[];
const stActive=s=>s&&s.status!=='withdrawn';
const isDesk=()=>document.documentElement.getAttribute('data-view')==='desktop';
const err=e=>String((e&&e.message)||e||'');
const todayStr=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
const monthStr=()=>typeof monthStart==='function'?monthStart():todayStr().slice(0,8)+'01';
const addMonthStr=()=>{const d=new Date();d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10)};
const online=()=>navigator.onLine!==false;
const hasDb=()=>typeof db!=='undefined'&&!!db;
const num=v=>{const n=Number(v);return Number.isFinite(n)?(Math.round(n*10)/10).toString():'0'};
function soft(page){if(state.page===page&&!document.querySelector('dialog[open]'))try{render()}catch(_e){}}
function setTitle(t){const e=$i('pageTitle');if(e)e.textContent=t}
async function chk(p){const r=await p;if(r&&r.error)throw r.error;return r}
const stop='event.stopPropagation();';

/* ================= shared small components ================= */
const smallStat=(label,value)=>`<div class="ngm-stat"><b>${h(value)}</b><span>${h(label)}</span></div>`;
const chipGrid=items=>`<div class="ngm-chipgrid">${items.map(i=>NX.chip(i.label,{...i,check:i.check===true})).join('')}</div>`;
const tile=(icon)=>`<span class="ngm-tile">${ic(icon,24)}</span>`;
const li=(inner,cls='')=>`<div class="ngm-li ${cls}">${inner}</div>`;
const closeDlg=id=>NX.closeDialog(id);

/* ============================================================
   1) HalaqasManagementScreen
   ============================================================ */
const HQ={arch:false,sel:null,mem:null,memAt:0,msg:null};
const typeCanon=t=>t==='tajweed'?'tilawah':(t==='other'?'course':(t||'regular'));
const TYPE_LABEL=t=>({tajweed:'التلاوة والتجويد',tilawah:'التلاوة والتجويد',training:'دورة تأهيلية',course:'دورة',other:'برنامج'}[t]||'حلقة أساسية');
const isArch=x=>!!x&&!!x.archived_at&&String(x.archived_at)!=='null';
const memRows=()=>HQ.mem||(window.RC27&&RC27.memberships)||[];

function loadMem(force){
  if(!hasDb()||!online())return;
  if(!force&&Date.now()-HQ.memAt<15000)return;
  HQ.memAt=Date.now();
  Promise.resolve(db.from('student_halaqa_memberships').select('student_id,halaqa_id,status,membership_type,joined_at').limit(10000)).then(r=>{
    if(r&&!r.error){HQ.mem=r.data||[];soft('halaqas')}
  }).catch(()=>{});
}
function hqData(x){
  const hid=x.id,sts=allStudents().filter(stActive);
  const addIds=new Set(memRows().filter(m=>m.halaqa_id===hid&&(m.status||'active')==='active').map(m=>m.student_id));
  const primary=sts.filter(s=>s.halaqa_id===hid);
  const list=[...primary,...sts.filter(s=>addIds.has(s.id)&&s.halaqa_id!==hid)];
  const cats=(state.categories||[]).filter(c=>c.halaqa_id===hid&&c.active!==false);
  const tIds=(state.halaqaTeachers||[]).filter(t=>t.halaqa_id===hid).map(t=>t.teacher_id);
  const sIds=typeof supervisorIdsForHalaqa==='function'?supervisorIdsForHalaqa(hid):(state.halaqaSupervisors||[]).filter(t=>t.halaqa_id===hid).map(t=>t.supervisor_id);
  const nm=(ids,role,fb)=>(state.users||[]).filter(u=>ids.includes(u.id)&&(!role||u.role===role||true)).map(u=>u.full_name||fb).join('، ');
  const tNames=nm(tIds,'teacher','محفّظ'),sNames=nm(sIds,'supervisor','مشرف');
  const tathbit=list.filter(s=>s.track_code==='tathbit').length;
  return {primary,list,addIds,cats,tIds,sIds,tNames,sNames,tathbit,general:list.length-tathbit};
}
function hqMeta(x){
  if((x.halaqa_type||'regular')==='regular')return '';
  const lab=(list,k)=>(list.find(e=>e[0]===k)||[0,k])[1];
  return [x.program_specialization&&lab(SPECS,x.program_specialization),x.program_level&&lab(LEVELS,x.program_level),x.assessment_type&&x.assessment_type!=='none'&&lab(ASSESS,x.assessment_type)].filter(v=>v&&v!=='null').join(' · ');
}
function hqKebab(x){
  const arc=isArch(x),act=x.active!==false;
  return NX.kebab([
    {label:'تعديل الحلقة',icon:'Edit',onclick:()=>G.hqEdit(x.id)},
    {label:'تعيين الطاقم',icon:'GroupAdd',onclick:()=>G.staff(x.id)},
    {label:act?'إيقاف الحلقة':'تفعيل الحلقة',icon:act?'PauseCircle':'PlayCircle',onclick:()=>G.toggleActive(x.id)},
    {label:arc?'استعادة الحلقة من الأرشيف':'أرشفة الحلقة',icon:arc?'Restore':'Archive',onclick:()=>G.archive(x.id)},
    {label:'خيارات متقدمة: حذف نهائي',icon:'DeleteForever',danger:true,onclick:()=>G.del(x.id)}
  ],{title:'إجراءات الحلقة'});
}
function hqStatus(x){return isArch(x)?NX.pill('مؤرشفة','neutral'):x.active!==false?NX.pill('نشطة','success'):NX.pill('موقوفة','neutral')}
function hqCard(x,sel){
  const d=hqData(x),admin=isOwner(),type=x.halaqa_type||'regular',meta=hqMeta(x);
  const place=[x.location,x.schedule_text].filter(Boolean).join(' · ')||'المكان والبرنامج غير محددين';
  const teacherFallback=state.profile?.role==='teacher'?'حسب الربط':'غير معيّنين';
  return `<div class="ngm-card ngm-hqcard ${sel?'sel':''}" data-id="${h(x.id)}" onclick="NGM.hqSel('${h(x.id)}')">
    <div class="ngm-hq-top">${tile('Groups')}
      <div class="ngm-grow"><div class="ngm-name">${h(x.name||'حلقة')}</div><div class="ngm-type">${h(TYPE_LABEL(type))}</div>${meta?`<div class="ngm-meta">${h(meta)}</div>`:''}<div class="ngm-sub">${h(place)}</div></div>
      ${hqStatus(x)}${admin?hqKebab(x):''}</div>
    <div class="ngm-full">
      <div class="ngm-sub2">المشرفون: ${h(d.sNames||'غير معيّنين')}</div>
      <div class="ngm-sub2">المحفّظون: ${h(d.tNames||teacherFallback)}</div>
      <div class="ngm-stats">${smallStat('الطلاب',d.list.length)}${smallStat('الفئات',d.cats.length)}${smallStat('المشرفون',d.sIds.length)}</div>
      ${d.addIds.size?`<div class="ngm-lab ngm-pri">الانتساب: أساسي ${d.primary.length} · إضافي ${d.addIds.size}</div>`:''}
      <div class="ngm-lab">المسارات: حفظ عام ${d.general} · تثبيت ${d.tathbit}</div>
      ${(type!=='regular'||x.allow_secondary_members!==false)?NX.btn(type==='regular'?'الطلاب المنتسبون':'إدارة المشاركين في البرنامج',{kind:'tonal',full:true,icon:'GroupAdd',onclick:stop+`NGM.members('${x.id}')`}):''}
      <div class="ngm-btnrow">${NX.btn('الفئات',{kind:'outlined',cls:'ngm-grow',onclick:stop+`NGM.cats('${x.id}')`})}${admin?NX.btn('تعديل',{kind:'tonal',icon:'Edit',cls:'ngm-grow',onclick:stop+`NGM.hqEdit('${x.id}')`}):''}</div>
    </div>
    <div class="ngm-brief">${d.list.length} طالب · ${d.cats.length} فئة</div>
  </div>`;
}
function hqDetail(x){
  if(!x)return `<div class="ngm-detail-empty">${NX.empty('اختر حلقة لعرض تفاصيلها',{icon:'Groups'})}</div>`;
  const d=hqData(x),admin=isOwner(),type=x.halaqa_type||'regular',meta=hqMeta(x);
  const tot=Math.max(1,d.list.length);
  const teacherFallback=state.profile?.role==='teacher'?'حسب الربط':'غير معيّنين';
  const dates=type!=='regular'&&(x.starts_on||x.ends_on)?`${h(String(x.starts_on||'—').slice(0,10))} ← ${h(String(x.ends_on||'—').slice(0,10))}`:'';
  const cats=d.cats.map(c=>{const n=allStudents().filter(s=>stActive(s)&&s.category_id===c.id).length;const ages=[c.min_age,c.max_age].filter(v=>v!=null&&v!=='').join('–');return `<div class="ngm-catrow"><b>${h(c.name||'فئة')}</b><span>${[ages?`العمر ${h(ages)} سنة`:'',`${n} طالب`].filter(Boolean).join(' · ')}</span></div>`}).join('');
  return `<div class="ngm-d">
    <div class="ngm-hq-top">${tile('Groups')}<div class="ngm-grow"><h3 class="ngm-d-name">${h(x.name||'حلقة')}</h3><div class="ngm-type">${h(TYPE_LABEL(type))}</div>${meta?`<div class="ngm-meta">${h(meta)}</div>`:''}</div>${hqStatus(x)}${admin?hqKebab(x):''}</div>
    ${NX.metrics([NX.metric('الطلاب',d.list.length,{icon:'School'}),NX.metric('الفئات',d.cats.length,{icon:'Groups'}),NX.metric('المشرفون',d.sIds.length,{icon:'Verified'}),NX.metric('المحفّظون',d.tIds.length,{icon:'Person'})],4)}
    <dl class="ngm-dl">
      <div><dt>المكان</dt><dd>${h(x.location||'غير محدد')}</dd></div>
      <div><dt>البرنامج</dt><dd>${h(x.schedule_text||'غير محدد')}</dd></div>
      ${dates?`<div><dt>مدة البرنامج</dt><dd>${dates}</dd></div>`:''}
      <div><dt>المشرفون</dt><dd>${h(d.sNames||'غير معيّنين')}</dd></div>
      <div><dt>المحفّظون</dt><dd>${h(d.tNames||teacherFallback)}</dd></div>
      ${x.description?`<div class="wide"><dt>الوصف</dt><dd>${h(x.description)}</dd></div>`:''}
    </dl>
    ${d.addIds.size?`<div class="ngm-lab ngm-pri">الانتساب: أساسي ${d.primary.length} · إضافي ${d.addIds.size}</div>`:''}
    <div class="ngm-tracks"><div><span>حفظ عام</span><b>${d.general}</b>${NX.progress(d.general/tot*100)}</div><div><span>تثبيت</span><b>${d.tathbit}</b>${NX.progress(d.tathbit/tot*100)}</div></div>
    <div class="ngm-d-sec"><h4>الفئات</h4>${cats||`<div class="ngm-sub">لا توجد فئات بعد</div>`}</div>
    <div class="ngm-d-actions">
      ${(type!=='regular'||x.allow_secondary_members!==false)?NX.btn(type==='regular'?'الطلاب المنتسبون':'إدارة المشاركين في البرنامج',{kind:'tonal',icon:'GroupAdd',onclick:`NGM.members('${x.id}')`}):''}
      ${NX.btn('الفئات',{kind:'outlined',onclick:`NGM.cats('${x.id}')`})}
      ${admin?NX.btn('تعديل',{kind:'tonal',icon:'Edit',onclick:`NGM.hqEdit('${x.id}')`}):''}
      ${admin?NX.btn('تعيين الطاقم',{kind:'outlined',icon:'GroupAdd',onclick:`NGM.staff('${x.id}')`}):''}
      ${NX.btn('طلاب الحلقة',{kind:'text',icon:'School',onclick:`typeof goToHalaqaStudents==='function'&&goToHalaqaStudents('${x.id}')`})}
    </div></div>`;
}

window.halaqasPage=function(){
  setTitle(isOwner()?'إدارة الحلقات والفئات':'الحلقات والفئات');
  if(!roleCanManage())return `<div class="ngm">${NX.empty('لا توجد حلقات متاحة.',{icon:'Groups'})}</div>`;
  loadMem(false);
  const admin=isOwner(),all=state.halaqas||[];
  const hasArch=admin&&all.some(isArch);
  if(!hasArch)HQ.arch=false;
  const vis=all.filter(x=>HQ.arch?isArch(x):!isArch(x));
  if(!vis.some(x=>x.id===HQ.sel))HQ.sel=vis[0]?.id||null;
  const chips=hasArch?chipGrid([{label:'الحلقات الحالية',selected:!HQ.arch,onclick:'NGM.arch(false)'},{label:'الأرشيف',selected:HQ.arch,onclick:'NGM.arch(true)'}]):'';
  const body=!vis.length?NX.empty(HQ.arch?'لا توجد حلقات مؤرشفة':'لا توجد حلقات بعد',{icon:'Groups'})
    :`<div class="ngm-split"><div class="ngm-grid" id="ngmHqGrid">${vis.map(x=>hqCard(x,x.id===HQ.sel)).join('')}</div><aside class="ngm-aside" id="ngmHqAside">${hqDetail(vis.find(x=>x.id===HQ.sel))}</aside></div>`;
  return `<div class="ngm ngm-hq">
    <div class="ngm-bar"><div class="ngm-bar-t"><b>${isOwner()?'إدارة الحلقات والفئات':'الحلقات والفئات'}</b><small>${vis.length} ${HQ.arch?'حلقة مؤرشفة':'حلقة'}</small></div>${admin?NX.btn('إضافة حلقة',{icon:'Add',onclick:'NGM.hqEdit()'}):''}</div>
    ${HQ.msg?NX.notice(h(HQ.msg),/^تعذر/.test(HQ.msg)?'error':'success'):''}
    ${chips}${body}</div>`;
};
G.arch=v=>{HQ.arch=!!v;HQ.sel=null;render()};
G.hqSel=id=>{
  HQ.sel=id;
  document.querySelectorAll('#ngmHqGrid .ngm-hqcard').forEach(c=>c.classList.toggle('sel',c.dataset.id===id));
  const a=$i('ngmHqAside');if(a)a.innerHTML=hqDetail((state.halaqas||[]).find(x=>x.id===id));
};
const hqFind=id=>(state.halaqas||[]).find(x=>x.id===id);
async function reloadAll(){try{if(typeof loadAll==='function')await loadAll(true)}catch(_e){}HQ.memAt=0;try{await render()}catch(_e){}}

G.toggleActive=async function(id){
  const x=hqFind(id);if(!x)return;
  try{await saveMasterLocal('halaqa',id,{active:x.active===false});HQ.msg=null;render()}
  catch(e){HQ.msg=err(e)||'تعذر تحديث حالة الحلقة';render()}
};
G.archive=async function(id){
  const x=hqFind(id);if(!x)return;const was=isArch(x);
  if(!online()||!hasDb()){HQ.msg='تعذر تحديث أرشيف الحلقة: يلزم اتصال بالإنترنت';return render()}
  try{
    await chk(db.from('halaqas').update({active:was,archived_at:was?null:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id));
    x.active=was;x.archived_at=was?null:new Date().toISOString();
    HQ.msg=was?'تمت استعادة الحلقة':'تمت أرشفة الحلقة دون حذف تاريخها';await reloadAll()
  }catch(e){HQ.msg=err(e)||'تعذر تحديث أرشيف الحلقة';render()}
};

/* ---------- HalaqaDialog ---------- */
let F=null;
const SPECS=[['hifz','حفظ'],['intensive_hifz','حفظ مكثف'],['tathbit','تثبيت'],['tilawah','تلاوة'],['tajweed_theory','تجويد نظري'],['tajweed_applied','تجويد تطبيقي'],['noorani','القاعدة النورانية'],['ijazah','إجازة'],['qiraat','قراءات'],['teacher_training','تأهيل محفظين'],['reading_support','علاج ضعف القراءة'],['selected_surahs','سور/أجزاء محددة'],['general','برنامج عام']];
const ASSESS=[['none','بدون تقييم'],['attendance','حضور والتزام'],['rubric','تقييم مهاري'],['exam','اختبار'],['ijazah','إجازة/سند']];
const LEVELS=[['beginner','مبتدئ'],['intermediate','متوسط'],['advanced','متقدم'],['mixed','مختلط']];
const defSpec=t=>t==='tajweed'?'tajweed_applied':t==='tilawah'?'tilawah':t==='training'?'teacher_training':'general';
const hqValid=()=>F&&F.name.trim().length>=2&&(F.type==='regular'||F.ends>=F.starts);
G.hqEdit=function(id){
  if(!isOwner())return toast('هذه الصفحة لمسؤول النظام فقط');
  const c=id?hqFind(id):null;
  F={id:c?.id||'',cur:c,name:c?.name||'',location:c?.location||'',schedule:c?.schedule_text||'',description:c?.description||'',
    type:typeCanon(c?.halaqa_type||'regular'),kind:c?.program_kind||'',spec:c?.program_specialization||'',level:c?.program_level||'mixed',assess:c?.assessment_type||'none',
    affects:!!c?.affects_primary_plan,starts:String(c?.starts_on||'').slice(0,10)||todayStr(),ends:String(c?.ends_on||'').slice(0,10)||addMonthStr(),saving:false,error:''};
  hqDlg();
};
function hqDlg(){
  const prog=F.type!=='regular';
  const types=[['regular','أساسية'],['tilawah','التلاوة والتجويد'],['training','تأهيلية'],['course','دورة']];
  const progBlock=prog?`
    ${NX.select('التخصص',SPECS.map(([value,label])=>({value,label})),{value:F.spec||defSpec(F.type),onchange:"NGM.hqSet('spec',this.value)"})}
    ${NX.field('طبيعة البرنامج / ملاحظة تعريفية',{value:F.kind,oninput:"NGM.hqSet('kind',this.value,1)"})}
    <div class="ngm-fl"><span>المستوى</span>${chipGrid(LEVELS.map(([k,l])=>({label:l,selected:F.level===k,onclick:`NGM.hqSet('level','${k}')`})))}</div>
    ${NX.select('نمط التقييم',ASSESS.map(([value,label])=>({value,label})),{value:F.assess,onchange:"NGM.hqSet('assess',this.value)"})}
    <label class="ngm-switch"><span><b>يؤثر على الخطة الأساسية</b><small>فعّله فقط إذا كان إنجاز هذا البرنامج يجب أن يدخل في تقدم خطة الطالب الأساسية.</small></span><input type="checkbox" class="nx-switch" ${F.affects?'checked':''} onchange="NGM.hqSet('affects',this.checked,1)"></label>
    <div class="ngm-two">${NX.field('بداية البرنامج',{type:'date',value:F.starts,onchange:"NGM.hqSet('starts',this.value)"})}${NX.field('نهاية البرنامج',{type:'date',value:F.ends,onchange:"NGM.hqSet('ends',this.value)"})}</div>`:'';
  const body=`<div class="ngm-form">
    ${NX.field('اسم الحلقة',{value:F.name,oninput:"NGM.hqSet('name',this.value,1)"})}
    <div class="ngm-fl"><span>نوع الحلقة / البرنامج</span>${chipGrid(types.map(([k,l])=>({label:l,selected:F.type===k,onclick:`NGM.hqSet('type','${k}')`})))}</div>
    ${progBlock}
    <div class="ngm-two">${NX.field('المكان',{value:F.location,oninput:"NGM.hqSet('location',this.value,1)"})}${NX.field('البرنامج',{value:F.schedule,oninput:"NGM.hqSet('schedule',this.value,1)"})}</div>
    ${NX.field('الوصف',{html:`<textarea rows="3" oninput="NGM.hqSet('description',this.value,1)">${h(F.description)}</textarea>`})}
    ${prog?NX.notice('طلاب هذه الدورة يمكن إضافتهم كعضوية إضافية دون نقلهم من حلقتهم الأساسية.','info'):''}
    <div class="ngm-err" id="ngmHqErr">${h(F.error)}</div></div>`;
  NX.dialog('ngmHq',F.cur?'تعديل الحلقة':'إضافة حلقة',body,{cls:'ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',id:'ngmHqCancel',disabled:F.saving,onclick:"NX.closeDialog('ngmHq')"})}${NX.btn(F.saving?'جاري الحفظ':'حفظ',{id:'ngmHqSave',disabled:F.saving||!hqValid(),onclick:'NGM.hqSave()'})}`});
}
G.hqSet=function(k,v,quiet){
  if(!F)return;F[k]=v;
  if(k==='starts'&&F.ends<v)F.ends=v;
  if(quiet){const b=$i('ngmHqSave');if(b)b.disabled=F.saving||!hqValid();return}
  hqDlg();
};
G.hqSave=async function(){
  if(!F||F.saving||!hqValid())return;
  F.saving=true;F.error='';hqDlg();
  const prog=F.type!=='regular',old=F.cur,t=s=>String(s||'').trim()||null;
  const obj={name:F.name.trim(),location:t(F.location),schedule_text:t(F.schedule),description:t(F.description),halaqa_type:F.type,
    program_kind:prog?t(F.kind):null,program_specialization:prog?(F.spec||defSpec(F.type)):null,program_level:prog?F.level:null,assessment_type:prog?F.assess:null,
    affects_primary_plan:prog&&F.affects,starts_on:prog?F.starts:null,ends_on:prog?F.ends:null,allow_secondary_members:true,active:old?old.active!==false:true};
  try{
    await saveMasterLocal('halaqa',F.id,obj);
    NX.closeDialog('ngmHq');HQ.msg=null;toast(F.id?'تم حفظ تعديل الحلقة':'تم إنشاء الحلقة');F=null;render()
  }catch(e){F.saving=false;F.error=err(e)||'تعذر حفظ الحلقة';hqDlg()}
};

/* ---------- HalaqaStaffDialog ---------- */
let ST=null;
G.staff=function(id){
  if(!isOwner())return toast('تعيين الطاقم لمسؤول النظام فقط');
  const x=hqFind(id);if(!x)return;
  const d=hqData(x);
  ST={id,name:x.name||'الحلقة',t:new Set(d.tIds),s:new Set(d.sIds),saving:false,error:''};staffDlg();
};
function staffDlg(){
  const users=(state.users||[]).filter(u=>u.approval_status==='approved'&&u.active!==false);
  const T=users.filter(u=>u.role==='teacher'),S=users.filter(u=>u.role==='supervisor');
  const row=(u,kind,set,fb)=>`<label class="ngm-li ngm-check"><input type="checkbox" class="ngm-cb" ${set.has(u.id)?'checked':''} onchange="NGM.stSet('${kind}','${u.id}',this.checked)"><span class="ngm-grow"><b>${h(u.full_name||fb)}</b><small>${h(u.email||'')}</small></span></label>`;
  const body=`<div class="ngm-form">
    <h4 class="ngm-h4">المحفّظون</h4>${T.length?T.map(u=>row(u,'t',ST.t,'محفّظ')).join(''):'<p class="ngm-sub">لا توجد حسابات محفّظين معتمدة.</p>'}
    ${NX.divider()}
    <h4 class="ngm-h4">المشرفون</h4>${S.length?S.map(u=>row(u,'s',ST.s,'مشرف')).join(''):'<p class="ngm-sub">لا توجد حسابات مشرفين معتمدة.</p>'}
    <p class="ngm-sub">أول مشرف محدد يُحفظ أيضًا كمشرف رئيسي للحلقة للتوافق مع البيانات القديمة.</p>
    ${ST.error?`<div class="ngm-err">${h(ST.error)}</div>`:''}</div>`;
  NX.dialog('ngmStaff','طاقم '+ST.name,body,{cls:'ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ngmStaff')"})}${NX.btn(ST.saving?'جاري الحفظ…':'حفظ التعيينات',{disabled:ST.saving,onclick:'NGM.stSave()'})}`});
}
G.stSet=(k,id,on)=>{const s=ST[k];on?s.add(id):s.delete(id)};
G.stSave=async function(){
  if(!ST||ST.saving)return;
  if(!online()||!hasDb()){ST.error='تعذر تحديث طاقم الحلقة: يلزم اتصال بالإنترنت';return staffDlg()}
  ST.saving=true;ST.error='';staffDlg();
  const hid=ST.id,wT=[...ST.t],wS=[...ST.s];
  const oT=new Set((state.halaqaTeachers||[]).filter(x=>x.halaqa_id===hid).map(x=>x.teacher_id));
  const oS=new Set((state.halaqaSupervisors||[]).filter(x=>x.halaqa_id===hid).map(x=>x.supervisor_id));
  try{
    for(const t of [...oT].filter(i=>!wT.includes(i)))await chk(db.from('halaqa_teachers').delete().eq('halaqa_id',hid).eq('teacher_id',t));
    const addT=wT.filter(i=>!oT.has(i));
    if(addT.length)await chk(db.from('halaqa_teachers').upsert(addT.map((teacher_id,i)=>({halaqa_id:hid,teacher_id,is_primary:i===0&&oT.size===0})),{onConflict:'halaqa_id,teacher_id'}));
    for(const s of [...oS].filter(i=>!wS.includes(i)))await chk(db.from('halaqa_supervisors').delete().eq('halaqa_id',hid).eq('supervisor_id',s));
    const addS=wS.filter(i=>!oS.has(i));
    if(addS.length)await chk(db.from('halaqa_supervisors').upsert(addS.map(supervisor_id=>({halaqa_id:hid,supervisor_id,created_by:state.user?.id})),{onConflict:'halaqa_id,supervisor_id'}));
    await chk(db.from('halaqas').update({supervisor_id:wS[0]||null,updated_at:new Date().toISOString()}).eq('id',hid));
    NX.closeDialog('ngmStaff');toast('تم تحديث طاقم الحلقة');ST=null;await reloadAll()
  }catch(e){ST.saving=false;ST.error=err(e)||'تعذر تحديث طاقم الحلقة';staffDlg()}
};

/* ---------- HalaqaMembersDialog ---------- */
let MB=null;
G.members=function(id){
  const x=hqFind(id);if(!x)return;
  MB={id,name:x.name||'الحلقة',q:'',busy:null,error:'',ids:new Set(memRows().filter(m=>m.halaqa_id===id&&(m.status||'active')==='active').map(m=>m.student_id).filter(Boolean))};
  const body=`<div class="ngm-form"><p class="ngm-sub">الطالب الأساسي يبقى في حلقته الأصلية، ويمكن إضافته هنا كعضو إضافي دون تكرار سجله أو نقل خطته.</p>
    ${NX.search('','بحث عن طالب',{oninput:'NGM.mbQ(this.value)'})}<div id="ngmMbErr"></div><div class="ngm-mblist" id="ngmMbList"></div></div>`;
  NX.dialog('ngmMembers','مشاركو '+MB.name,body,{cls:'ngm-dlg',onClose:()=>{MB=null},footer:NX.btn('إغلاق',{kind:'text',onclick:"NX.closeDialog('ngmMembers')"})});
  mbRender();
};
function mbRender(){
  if(!MB)return;
  const canEdit=roleCanManage(),norm=typeof normalizeNameJs==='function'?normalizeNameJs:v=>String(v||'').toLowerCase(),q=norm(MB.q);
  const rows=allStudents().filter(s=>stActive(s)&&(!q||norm(s.full_name).includes(q))).sort((a,b)=>(a.halaqa_id!==MB.id)-(b.halaqa_id!==MB.id)||String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
  const list=$i('ngmMbList');
  if(list)list.innerHTML=rows.length?rows.map(s=>{
    const primary=s.halaqa_id===MB.id,on=primary||MB.ids.has(s.id);
    const state_=primary?'طالب أساسي في هذه الحلقة':MB.ids.has(s.id)?'مشارك إضافي':'غير مشارك';
    const ctl=primary?NX.pill('أساسي','success'):canEdit?`<input type="checkbox" class="nx-switch" ${MB.ids.has(s.id)?'checked':''} ${MB.busy?'disabled':''} onchange="NGM.mbToggle('${s.id}',this.checked)">`:NX.pill(on?'مشارك':'—','info');
    return `<div class="ngm-li ngm-mem ${on?'on':''}"><div class="ngm-grow"><b>${h(s.full_name||'')}</b><small>${state_}</small></div>${ctl}</div>`}).join(''):NX.empty('لا يوجد طلاب مطابقون',{icon:'SearchOff'});
  const e=$i('ngmMbErr');if(e)e.innerHTML=MB.error?NX.notice(h(MB.error),'error'):'';
}
G.mbQ=v=>{if(MB){MB.q=v;mbRender()}};
G.mbToggle=async function(sid,wanted){
  if(!MB||MB.busy)return;const before=new Set(MB.ids);
  wanted?MB.ids.add(sid):MB.ids.delete(sid);MB.busy=sid;MB.error='';mbRender();
  try{
    if(!online()||!hasDb())throw new Error('تعذر تعديل انتساب الطالب: يلزم اتصال بالإنترنت');
    const now=new Date().toISOString(),day=todayStr();
    if(wanted)await chk(db.from('student_halaqa_memberships').upsert({student_id:sid,halaqa_id:MB.id,membership_type:'participant',status:'active',joined_at:day,ended_at:null,updated_at:now},{onConflict:'student_id,halaqa_id'}));
    else await chk(db.from('student_halaqa_memberships').update({status:'withdrawn',ended_at:day,updated_at:now}).eq('student_id',sid).eq('halaqa_id',MB.id));
    const rows=memRows().filter(m=>!(m.student_id===sid&&m.halaqa_id===MB.id));rows.push({student_id:sid,halaqa_id:MB.id,status:wanted?'active':'withdrawn',membership_type:'participant'});HQ.mem=rows;
    MB.busy=null;mbRender();soft2()
  }catch(e){MB.ids=before;MB.busy=null;MB.error=err(e)||'تعذر تعديل انتساب الطالب';mbRender()}
};
function soft2(){const a=$i('ngmHqAside'),g=$i('ngmHqGrid');if(!g)return;const sel=HQ.sel;const vis=(state.halaqas||[]).filter(x=>HQ.arch?isArch(x):!isArch(x));g.innerHTML=vis.map(x=>hqCard(x,x.id===sel)).join('');if(a)a.innerHTML=hqDetail(vis.find(x=>x.id===sel))}

/* ---------- DeleteHalaqaDialog ---------- */
let DL=null;
G.del=function(id){
  if(!isOwner())return toast('حذف الحلقات لمسؤول النظام فقط');
  const x=hqFind(id);if(!x)return;DL={id,name:x.name||'',typed:''};
  const body=`<div class="ngm-form">${NX.notice('الأفضل استخدام «أرشفة الحلقة» للحفاظ على الطلاب والتسميعات والتقارير التاريخية. استخدم الحذف النهائي فقط إذا كنت متأكدًا أن تاريخ الحلقة لم يعد مطلوبًا.','warning')}
    <p class="ngm-p">الحذف النهائي قد يزيل البيانات المرتبطة بهذه الحلقة ولا يمكن التراجع عنه بعد مزامنته مع الخادم.</p>
    <p class="ngm-p"><b>اكتب اسم الحلقة للتأكيد: ${h(DL.name)}</b></p>
    ${NX.field('اسم الحلقة',{oninput:'NGM.delTyped(this.value)'})}
    ${online()?'':`<p class="ngm-offline">أنت دون اتصال: سيُحفظ طلب الحذف محليًا ويُرسل إلى الخادم عند عودة الاتصال.</p>`}</div>`;
  NX.dialog('ngmDel','حذف الحلقة نهائيًا',body,{cls:'nx-small-dlg ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ngmDel')"})}${NX.btn('حذف نهائي',{kind:'danger',id:'ngmDelOk',disabled:true,icon:'DeleteForever',onclick:'NGM.delGo()'})}`});
};
G.delTyped=v=>{if(!DL)return;DL.typed=v;const b=$i('ngmDelOk');if(b)b.disabled=!(v.trim()===DL.name.trim()&&DL.name.trim())};
G.delGo=async function(){
  if(!DL||DL.typed.trim()!==DL.name.trim())return;const id=DL.id,name=DL.name;
  try{await deleteMasterLocal('halaqa',id,{cascade:true});NX.closeDialog('ngmDel');DL=null;HQ.msg=null;toast(`تم تسجيل حذف الحلقة «${name}» وسيتم تطبيقه تلقائياً عند المزامنة`);render()}
  catch(e){HQ.msg=err(e)||'تعذر حذف الحلقة';NX.closeDialog('ngmDel');render()}
};

/* ---------- CategoriesDialog ---------- */
let CT=null;
G.cats=function(id){
  const x=hqFind(id);if(!x)return;
  CT={id,name:x.name||'الحلقة',edit:null,fn:'',min:'',max:'',error:''};catDlg();
};
function catDlg(){
  const canEdit=roleCanManage();
  const rows=(state.categories||[]).filter(c=>c.halaqa_id===CT.id&&c.active!==false);
  const list=rows.map(c=>{
    const n=allStudents().filter(s=>stActive(s)&&s.category_id===c.id).length;
    const ages=[c.min_age,c.max_age].filter(v=>v!=null&&v!=='').join('–');
    return `<div class="ngm-card ngm-catcard"><div class="ngm-grow"><b>${h(c.name||'فئة')}</b><small>${[ages?`العمر ${h(ages)} سنة`:'',`${n} طالب`].filter(Boolean).join(' · ')}</small></div>
      ${canEdit?`${NX.iconBtn('Edit',{title:'تعديل الفئة',onclick:`NGM.catEdit('${c.id}')`})}${NX.iconBtn('DeleteOutline',{title:'حذف الفئة',cls:'ngm-danger-ic',onclick:`NGM.catDel('${c.id}')`})}`:''}</div>`}).join('');
  const form=canEdit?`${NX.divider()}<h4 class="ngm-h4">${CT.edit?'تعديل الفئة':'إضافة فئة'}</h4>
    ${NX.field('اسم الفئة',{value:CT.fn,oninput:"NGM.catSet('fn',this.value)"})}
    <div class="ngm-two">${NX.field('من عمر',{value:CT.min,inputmode:'numeric',oninput:"NGM.catSet('min',this.value.replace(/\\D/g,'').slice(0,3))"})}${NX.field('إلى عمر',{value:CT.max,inputmode:'numeric',oninput:"NGM.catSet('max',this.value.replace(/\\D/g,'').slice(0,3))"})}</div>
    ${CT.edit?NX.btn('إلغاء التعديل',{kind:'text',onclick:'NGM.catReset()'}):''}
    <div class="ngm-err">${h(CT.error)}</div>`:'';
  NX.dialog('ngmCat','فئات '+CT.name,`<div class="ngm-form">${list||NX.empty('لا توجد فئات بعد. أضف الفئة الأولى.',{icon:'Groups'})}${form}</div>`,{cls:'ngm-dlg',footer:`${NX.btn('إغلاق',{kind:'text',onclick:"NX.closeDialog('ngmCat')"})}${canEdit?NX.btn(CT.edit?'حفظ التعديل':'إضافة',{id:'ngmCatOk',disabled:CT.fn.trim().length<2,onclick:'NGM.catSave()'}):''}`});
}
G.catSet=(k,v)=>{CT[k]=v;if(k==='fn'){const b=$i('ngmCatOk');if(b)b.disabled=v.trim().length<2}};
G.catReset=()=>{CT.edit=null;CT.fn='';CT.min='';CT.max='';CT.error='';catDlg()};
G.catEdit=cid=>{const c=(state.categories||[]).find(x=>x.id===cid);if(!c)return;CT.edit=cid;CT.fn=c.name||'';CT.min=c.min_age==null?'':String(c.min_age);CT.max=c.max_age==null?'':String(c.max_age);CT.error='';catDlg()};
G.catSave=async function(){
  const name=CT.fn.trim();if(name.length<2)return;
  const cl=v=>v===''?null:Math.max(0,Math.min(100,parseInt(v,10)||0)),min=cl(CT.min),max=cl(CT.max);
  if(min!=null&&max!=null&&max<min){CT.error='أعلى عمر يجب أن يكون أكبر من أو يساوي أقل عمر';return catDlg()}
  const norm=typeof normalizeNameJs==='function'?normalizeNameJs:v=>String(v||'').toLowerCase();
  if((state.categories||[]).some(c=>c.halaqa_id===CT.id&&c.active!==false&&c.id!==CT.edit&&norm(c.name)===norm(name))){CT.error='هذه الفئة موجودة بالفعل';return catDlg()}
  try{
    const obj={halaqa_id:CT.id,name,min_age:min,max_age:max,active:true};
    if(!CT.edit)obj.created_by=state.user?.id;
    await saveMasterLocal('category',CT.edit||'',obj);
    toast(CT.edit?'تم حفظ تعديل الفئة':'تمت إضافة الفئة');CT.edit=null;CT.fn='';CT.min='';CT.max='';CT.error='';catDlg();soft2();soft('halaqas')
  }catch(e){CT.error=err(e)||'تعذر إضافة الفئة';catDlg()}
};
G.catDel=function(cid){
  const c=(state.categories||[]).find(x=>x.id===cid);if(!c)return;
  NX.confirm('حذف الفئة',`سيتم إزالة الفئة «${h(c.name||'الفئة')}» وفك ربط الطلاب بها. سجلات التسميع والحضور للطلاب لن تُحذف.`,'حذف',async()=>{
    try{await deleteMasterLocal('category',cid);if(CT&&CT.edit===cid){CT.edit=null;CT.fn='';CT.min='';CT.max=''}if(CT)catDlg();soft2()}
    catch(e){if(CT){CT.error=err(e)||'تعذر حذف الفئة';catDlg()}}
  },{danger:true});
};

/* ============================================================
   2) SupervisionNativeScreen
   ============================================================ */
const SV={sel:'all',visits:null,att:null,at:0,err:'',loading:false};
function svSessions(){return (mst()&&mst().sessions)||state.sessions||[]}
function planCovers(p,s,td){
  if(p.status==='archived')return false;
  if(p.start_date&&p.start_date>td)return false;
  if(p.end_date&&p.end_date<td)return false;
  if(p.halaqa_id!==s.halaqa_id)return false;
  const sc=p.scope_type||'student';
  const inScope=sc==='halaqa'?true:sc==='category'?!!p.category_id&&p.category_id===s.category_id:p.student_id===s.id;
  if(!inScope)return false;
  if(p.plan_type!=='hifz'||sc==='student')return true;
  return !!(p.settings&&p.settings.student_ranges&&p.settings.student_ranges[s.id]);
}
const eligible=hid=>{const x=hqFind(hid);return !(x&&typeof rc27IsProgram==='function'&&rc27IsProgram(x))};
function loadSv(force){
  if(!hasDb()||!online()){return}
  if(!force&&Date.now()-SV.at<20000)return;
  SV.at=Date.now();SV.loading=SV.visits==null;
  const td=todayStr(),ids=svSessions().filter(s=>s.session_date===td&&s.status!=='cancelled').map(s=>s.id).filter(Boolean);
  const jobs=[Promise.resolve(db.from('supervisor_visits').select('*').order('visit_date',{ascending:false}).limit(300)),
    ids.length?Promise.resolve(db.from('attendance_records').select('student_id,status').in('session_id',ids).limit(3000)):Promise.resolve({data:[]})];
  Promise.all(jobs).then(([v,a])=>{
    if(v.error)SV.err=err(v.error)||'تعذر تحميل المتابعة';else{SV.visits=v.data||[];SV.err=''}
    if(!a.error)SV.att=a.data||[];
    SV.loading=false;soft('supervision')
  }).catch(e=>{SV.err=err(e)||'تعذر تحميل المتابعة';SV.loading=false;soft('supervision')});
}
function svCompute(){
  const td=todayStr(),ms=monthStr(),sel=SV.sel;
  const sess=svSessions().filter(s=>sel==='all'||s.halaqa_id===sel);
  const monthSess=sess.filter(s=>s.session_date>=ms&&s.session_date<=td&&s.status!=='cancelled');
  const students=allStudents().filter(s=>stActive(s)&&(sel==='all'||s.halaqa_id===sel));
  const plans=state.smartPlans||[];
  const has=new Map(students.map(s=>[s.id,plans.some(p=>planCovers(p,s,td))]));
  const without=students.filter(s=>!has.get(s.id)&&eligible(s.halaqa_id)).length;
  const cnt={};monthSess.forEach(s=>{cnt[s.halaqa_id]=(cnt[s.halaqa_id]||0)+1});
  const monthly=new Map(((mst()&&mst().monthly)||state.monthly||[]).map(m=>[m.student_id,m]));
  const goals=(mst()&&mst().goals)||state.goals||[];
  const ids=new Set(students.map(s=>s.id));
  const absent=new Set([...(SV.att||[]).filter(a=>a.status==='absent'&&ids.has(a.student_id)).map(a=>a.student_id),...(((mst()&&mst().dailySummary)||state.dailySummary||[]).filter(r=>r.attendance_status==='absent'&&ids.has(r.student_id)).map(r=>r.student_id))]);
  const rows=students.map(s=>{
    const reasons=[];let score=0;
    if(absent.has(s.id)){reasons.push('غائب اليوم');score+=50}
    if(!has.get(s.id)&&eligible(s.halaqa_id)){reasons.push('لا توجد خطة ذكية فعالة');score+=30}
    const g=goals.find(x=>x.student_id===s.id&&String(x.period_start||'').slice(0,7)===ms.slice(0,7))||goals.find(x=>x.student_id===s.id&&(!x.period_start||x.period_start<=td)&&(!x.period_end||x.period_end>=td));
    const target=Number(g?.target_hifz_pages||0);
    if(target>0){const held=cnt[s.halaqa_id]||0,days=Math.max(1,Number(g.expected_session_days||20)),exp=target*Math.min(1,held/days),act=Number(monthly.get(s.id)?.hifz_pages||0),gap=Math.max(0,exp-act);
      if(gap>=.5){reasons.push(`متأخر ${num(gap)} ص عن وتيرة الشهر`);score+=Math.min(20,Math.ceil(gap*4))}}
    return reasons.length?{s,reasons,score}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.s.full_name||'').localeCompare(String(b.s.full_name||''),'ar')).slice(0,10);
  const visits=(SV.visits||[]).filter(v=>sel==='all'||v.halaqa_id===sel);
  return {monthSess:monthSess.length,without,rows,visits};
}
const scoreText=(v,k)=>v[k]==null||v[k]===''?'—':`${v[k]}/5`;
const SHORTCUTS=[['الجلسات اليومية','الحضور والتسميع','sessions'],['الخطط الذكية','المقرر والتأخر والتعويض','plans'],['التقارير','تقارير الحلقة والمسارات','reports'],['الترتيب','النقاط والإنجازات','ranking'],['الطلاب','ملفات الطلاب','students'],['الإعلانات','التواصل مع أولياء الأمور','community']];

window.supervisionPage=function(){
  setTitle('متابعة المحفّظ');
  if(!roleCanManage())return `<div class="ngm">${NX.empty('هذه الصفحة للمشرفين والمحفّظين.',{icon:'Groups'})}</div>`;
  loadSv(false);
  const c=svCompute(),halaqas=(state.halaqas||[]).filter(x=>x.active!==false&&!isArch(x));
  if(SV.sel!=='all'&&!halaqas.some(x=>x.id===SV.sel))SV.sel='all';
  const hn=id=>(state.halaqas||[]).find(x=>x.id===id)?.name||'حلقة';
  const sel=halaqas.length?`<div class="ngm-svsel">${NX.select('الحلقة',[{value:'all',label:'كل الحلقات'},...halaqas.map(x=>({value:x.id,label:x.name||'حلقة'}))],{value:SV.sel,onchange:'NGM.svSel(this.value)'})}</div>`:'';
  const follow=c.rows.length?c.rows.map(r=>`<div class="ngm-follow">
      <div class="ngm-row"><span class="ngm-grow ngm-name1">${h(r.s.full_name||'')}</span>${NX.pill('درجة '+r.score,'warning')}</div>
      <div class="ngm-reasons">${r.reasons.map(x=>NX.pill(h(x),'warning')).join('')}</div>
      <div class="ngm-row">${NX.btn('فتح ملف الطالب',{kind:'text',onclick:`studentProfile('${r.s.id}')`})}${NX.btn('الخطة',{kind:'text',onclick:"go('plans')"})}</div></div>`).join('')
    :`<div class="ngm-allgood">${ic('CheckCircle',20)}<span>لا توجد حالات عاجلة في البيانات الحالية.</span></div>`;
  const visits=c.visits.map(v=>`<div class="ngm-card ngm-visit"><div class="ngm-row"><b class="ngm-grow">${h(hn(v.halaqa_id))}</b><small>${h(String(v.visit_date||'').slice(0,10))}</small></div>
      <div class="ngm-sub2">التنظيم ${scoreText(v,'organization_score')} · التدريس ${scoreText(v,'teaching_score')} · المتابعة ${scoreText(v,'followup_score')}</div>
      ${v.notes?`<p class="ngm-p">${h(v.notes)}</p>`:''}${v.action_items?`<div class="ngm-sub">المتابعة: ${h(v.action_items)}</div>`:''}</div>`).join('');
  return `<div class="ngm ngm-sv">
    ${SV.err?NX.notice(h(SV.err),'error'):''}${!online()?NX.notice('أنت دون اتصال: الزيارات والغياب اليومي يحتاجان اتصالاً بالإنترنت.','warning'):''}
    ${SV.loading&&!state.students?.length?NX.skeleton(3):''}${sel}
    <div class="ngm-svgrid">
      <div class="ngm-sv-stats ngm-stats">${smallStat('جلسات الشهر',c.monthSess)}${smallStat('بلا خطة',c.without)}${smallStat('الزيارات',c.visits.length)}</div>
      <section class="ngm-card ngm-sv-follow"><div class="ngm-row"><div class="ngm-grow"><div class="ngm-ct">يحتاج متابعة الآن</div><div class="ngm-sub">مرتبة حسب الأولوية التشغيلية</div></div><span class="ngm-count ${c.rows.length?'warn':''}">${c.rows.length}</span></div>${follow}</section>
      <section class="ngm-card ngm-sv-short"><div class="ngm-ct">اختصارات العمل</div>${SHORTCUTS.map(([t,s,r])=>`<button type="button" class="ngm-short" onclick="go('${r}')"><span class="ngm-grow"><b>${t}</b><small>${s}</small></span>${ic('ChevronLeft',22)}</button>`).join('')}</section>
      <section class="ngm-sv-visits"><div class="ngm-row ngm-vh"><div class="ngm-ct ngm-grow">زيارات المشرف</div>${roleCanAdmin()?NX.btn('إضافة زيارة',{icon:'Add',onclick:'NGM.visit()'}):''}</div>
        ${!c.visits.length&&!SV.loading?NX.empty('لا توجد زيارات مسجلة للحلقة المختارة',{icon:'Fact'}):`<div class="ngm-visitgrid">${visits}</div>`}</section>
    </div></div>`;
};
G.svSel=v=>{SV.sel=v;render()};

/* ---------- SupervisorVisitDialog ---------- */
let VD=null;
G.visit=function(){
  if(!roleCanAdmin())return;
  const hs=(state.halaqas||[]).filter(x=>x.active!==false&&!isArch(x));
  VD={halaqa:SV.sel!=='all'?SV.sel:(hs[0]?.id||''),org:3,teach:3,follow:3,notes:'',actions:'',saving:false,error:'',hs};visitDlg();
};
function scorePicker(label,key){return `<div class="ngm-fl"><span>${label}: ${VD[key]}/5</span><div class="ngm-scores">${[1,2,3,4,5].map(n=>NX.chip(String(n),{selected:VD[key]===n,check:false,onclick:`NGM.vSet('${key}',${n})`})).join('')}</div></div>`}
function visitDlg(){
  const body=`<div class="ngm-form">${NX.select('الحلقة',VD.hs.map(x=>({value:x.id,label:x.name||'حلقة'})),{value:VD.halaqa,onchange:"NGM.vSet('halaqa',this.value,1)"})}
    ${scorePicker('التنظيم','org')}${scorePicker('التدريس','teach')}${scorePicker('المتابعة','follow')}
    ${NX.field('ملاحظات',{html:`<textarea rows="2" oninput="NGM.vSet('notes',this.value,1)">${h(VD.notes)}</textarea>`})}
    ${NX.field('بنود المتابعة',{html:`<textarea rows="2" oninput="NGM.vSet('actions',this.value,1)">${h(VD.actions)}</textarea>`})}
    <div class="ngm-err">${h(VD.error)}</div></div>`;
  NX.dialog('ngmVisit','زيارة إشرافية',body,{cls:'ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ngmVisit')"})}${NX.btn(VD.saving?'جاري الحفظ…':'حفظ',{disabled:VD.saving||!VD.halaqa,onclick:'NGM.vSave()'})}`});
}
G.vSet=(k,v,quiet)=>{VD[k]=v;if(!quiet)visitDlg()};
G.vSave=async function(){
  if(!VD||VD.saving||!VD.halaqa)return;VD.saving=true;VD.error='';visitDlg();
  try{
    if(!online()||!hasDb())throw new Error('تسجيل الزيارة يحتاج اتصالاً بالإنترنت');
    if(!state.user?.id)throw new Error('الجلسة غير صالحة');
    const t=s=>String(s||'').trim()||null;
    await chk(db.from('supervisor_visits').insert({halaqa_id:VD.halaqa,supervisor_id:state.user.id,visit_date:todayStr(),organization_score:VD.org,teaching_score:VD.teach,followup_score:VD.follow,notes:t(VD.notes),action_items:t(VD.actions)}));
    NX.closeDialog('ngmVisit');VD=null;toast('تم حفظ الزيارة');loadSv(true)
  }catch(e){VD.saving=false;VD.error=err(e)||'تعذر حفظ الزيارة';visitDlg()}
};

/* ============================================================
   3) UsersScreen
   ============================================================ */
const U={status:'pending',q:'',busy:null,msg:null};
const roleAr=v=>({admin:'مسؤول النظام',supervisor:'مشرف الحلقات',teacher:'محفّظ الحلقة',guardian:'ولي أمر',student:'طالب'}[v]||'غير محدد');
const uActive=u=>u.active!==false;
function uBadge(u){
  if(u.role==='admin')return NX.pill('مسؤول','info',{cls:'ngm-badge'});
  if(u.approval_status==='pending')return NX.pill('بانتظار الاعتماد','warning',{cls:'ngm-badge'});
  if(u.approval_status==='rejected')return NX.pill('مرفوض','danger',{cls:'ngm-badge'});
  if(!uActive(u))return NX.pill('موقوف','danger',{cls:'ngm-badge'});
  return NX.pill('نشط','success',{cls:'ngm-badge'});
}
const uActs=u=>u.approval_status==='pending'?['approve','reject','delete']:u.approval_status==='rejected'?['approve_again','delete']:['toggle','role','delete'];
const ACT={approve:['اعتماد','Check','tonal'],reject:['رفض','Cancel','outlined'],approve_again:['اعتماد من جديد','Check','tonal'],toggle:null,role:['تغيير الصلاحية','ManageAccounts','outlined'],delete:['حذف نهائي','DeleteForever','outlined']};
function uBtn(k,u,small){
  let [label,icon,kind]=k==='toggle'?[uActive(u)?'إيقاف':'تفعيل',uActive(u)?'PauseCircle':'PlayCircle','outlined']:ACT[k];
  if(k==='approve'&&U.busy===u.id)label='جاري…';
  return NX.btn(label,{kind,icon:k==='delete'||small?icon:undefined,small,cls:k==='delete'?'ngm-del':'',disabled:!!U.busy||adminUsersReadOnly(),onclick:`NGM.uAct('${k}','${u.id}')`});
}
const uFiltered=()=>{
  const q=U.q.trim().toLowerCase();
  return (state.users||[]).filter(u=>(U.status==='all'||u.approval_status===U.status)&&(!q||String(u.full_name||'').toLowerCase().includes(q)||String(u.email||'').toLowerCase().includes(q)));
};
function uList(){
  const rows=uFiltered();
  if(!rows.length)return NX.empty('لا توجد حسابات في هذا التصنيف',{icon:'AccountCircle'});
  const reqOf=u=>u.requested_role||u.role||'guardian';
  const cards=rows.map(u=>{
    const admin=u.role==='admin';
    return `<div class="ngm-card ngm-ucard"><div class="ngm-row"><span class="ngm-uic">${ic('AccountCircle',26)}</span><div class="ngm-grow"><div class="ngm-name">${h(u.full_name||'مستخدم')}</div><div class="ngm-sub">${h(u.email||'—')}</div></div>${uBadge(u)}</div>
      <div class="ngm-lab">${admin?'مسؤول النظام':`الصلاحية: ${roleAr(u.role)} · الطلب: ${roleAr(reqOf(u))}`}</div>
      ${u.rejection_reason?`<div class="ngm-reject">سبب الرفض: ${h(u.rejection_reason)}</div>`:''}
      ${admin?'':`<div class="ngm-uacts">${uActs(u).map(k=>uBtn(k,u,false)).join('')}</div>`}</div>`}).join('');
  const trs=rows.map(u=>{
    const admin=u.role==='admin';
    return `<tr><td><div class="ngm-ucell">${NX.avatar(u.full_name||'م')}<div><b>${h(u.full_name||'مستخدم')}</b><small>${h(u.phone||'')}</small></div></div></td>
      <td class="ngm-mail">${h(u.email||'—')}</td>
      <td>${admin?'مسؤول النظام':`<div>${roleAr(u.role)}</div><small>الطلب: ${roleAr(reqOf(u))}</small>`}${u.rejection_reason?`<small class="ngm-reject">سبب الرفض: ${h(u.rejection_reason)}</small>`:''}</td>
      <td>${uBadge(u)}</td><td><div class="ngm-racts">${admin?'—':uActs(u).map(k=>uBtn(k,u,true)).join('')}</div></td></tr>`}).join('');
  return `<div class="ngm-phone">${cards}</div><div class="ngm-desk ngm-tablewrap"><table class="ngm-table"><thead><tr><th>المستخدم</th><th>البريد</th><th>الصلاحية</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>${trs}</tbody></table></div>`;
}
window.usersPage=async function(){
  setTitle('الحسابات والصلاحيات');
  if(!canManageUsers())return `<div class="ngm">${NX.empty('إدارة الحسابات والصلاحيات متاحة لمسؤول النظام فقط.',{icon:'AccountCircle'})}</div>`;
  try{await refreshAdminUsers({force:false,silent:true})}catch(_e){}
  const users=state.users||[],cnt=k=>users.filter(u=>u.approval_status===k).length;
  const ro=adminUsersReadOnly();
  const retry=NX.btn('إعادة المحاولة',{kind:'text',small:true,onclick:'NGM.uRetry()'});
  const roNote=ro?NX.notice(users.length?`<b>عرض محفوظ للقراءة فقط:</b> تعذر تحديث الحسابات من الخادم. آخر تحديث: ${h(state.adminUsersUpdatedAt||'غير معروف')}. ${retry}`:`<b>تعذر تحميل الحسابات من الخادم.</b> لا توجد نسخة محلية محفوظة. ${retry}`,'warning'):'';
  const msg=U.msg?NX.notice(h(U.msg),/^تعذر/.test(U.msg)||U.msg.includes('غير صالح')?'error':'success'):'';
  const chips=chipGrid([['pending','بانتظار الاعتماد'],['approved','معتمدة'],['rejected','مرفوضة'],['all','الكل']].map(([k,l])=>({label:l,selected:U.status===k,onclick:`NGM.uStatus('${k}')`})));
  return `<div class="ngm ngm-users">
    <div class="ngm-desk ngm-umetrics">${NX.metrics([NX.metric('بانتظار الاعتماد',cnt('pending'),{icon:'Schedule',onclick:"NGM.uStatus('pending')"}),NX.metric('معتمدة',cnt('approved'),{icon:'Verified',onclick:"NGM.uStatus('approved')"}),NX.metric('مرفوضة',cnt('rejected'),{icon:'Cancel',onclick:"NGM.uStatus('rejected')"}),NX.metric('الكل',users.length,{icon:'Groups',onclick:"NGM.uStatus('all')"})],4)}</div>
    <div class="ngm-utools">${NX.search(U.q,'بحث بالاسم أو البريد',{oninput:'NGM.uQ(this.value)',cls:'ngm-usearch'})}<div class="ngm-uchips">${chips}</div>${NX.btn('ربط ولي الأمر بالطالب',{kind:'outlined',icon:'FamilyRestroom',cls:'ngm-ulink',onclick:'NGM.gl()'})}</div>
    ${roNote}${msg}<div id="ngmUList">${uList()}</div></div>`;
};
G.uStatus=k=>{U.status=k;render()};
G.uQ=v=>{U.q=v;const e=$i('ngmUList');if(e)e.innerHTML=uList()};
G.uRetry=async()=>{try{await refreshAdminUsers({force:true,silent:false})}catch(_e){}render()};
async function uRun(id,fn,success){
  if(adminUsersReadOnly())return toast('تعديل الحسابات يحتاج اتصالاً مباشراً بالخادم');
  U.busy=id;render();
  try{await fn();U.msg=success;toast(success);try{await refreshAdminUsers({force:true,silent:true})}catch(_e){}}
  catch(e){U.msg=err(e)||'تعذر تنفيذ العملية'}
  finally{U.busy=null;render()}
}
const uFind=id=>(state.users||[]).find(u=>u.id===id);
G.uAct=function(k,id){
  const u=uFind(id);if(!u||U.busy)return;
  const req=['guardian','teacher','supervisor'].includes(u.requested_role)?u.requested_role:'guardian';
  const approve=()=>chk(db.from('profiles').update({role:req,requested_role:req,approval_status:'approved',active:true,approved_at:new Date().toISOString(),approved_by:state.user?.id,rejection_reason:null}).eq('id',id));
  if(k==='approve')uRun(id,approve,'تم اعتماد الحساب');
  else if(k==='approve_again')uRun(id,approve,'تم اعتماد الحساب من جديد');
  else if(k==='toggle')uRun(id,()=>chk(db.from('profiles').update({active:!uActive(u)}).eq('id',id)),uActive(u)?'تم إيقاف الحساب':'تم تفعيل الحساب');
  else if(k==='reject')uReject(u);else if(k==='role')uRole(u);else if(k==='delete')uDelete(u);
};
function uReject(u){
  NX.dialog('ngmRej','رفض حساب '+(u.full_name||''),NX.field('سبب الرفض (اختياري)',{html:'<textarea id="ngmRejReason" rows="3"></textarea>'}),{cls:'nx-small-dlg ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ngmRej')"})}${NX.btn('رفض الحساب',{kind:'danger',onclick:`NGM.uRejectGo('${u.id}')`})}`});
}
G.uRejectGo=function(id){
  const reason=($i('ngmRejReason')?.value||'').trim();NX.closeDialog('ngmRej');
  uRun(id,()=>chk(db.from('profiles').update({approval_status:'rejected',active:false,rejection_reason:reason||null}).eq('id',id)),'تم رفض طلب الحساب');
};
let RL=null;
function uRole(u){RL={id:u.id,name:u.full_name||'',role:['guardian','teacher','supervisor'].includes(u.role)?u.role:'guardian'};roleDlg()}
function roleDlg(){
  NX.dialog('ngmRole','صلاحية '+RL.name,`<div class="ngm-rolelist">${['guardian','teacher','supervisor'].map(v=>NX.chip(roleAr(v),{selected:RL.role===v,onclick:`NGM.rSet('${v}')`})).join('')}</div>`,{cls:'nx-small-dlg ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ngmRole')"})}${NX.btn('حفظ',{onclick:'NGM.rGo()'})}`});
}
G.rSet=v=>{RL.role=v;roleDlg()};
G.rGo=function(){
  const {id,role}=RL;NX.closeDialog('ngmRole');
  uRun(id,()=>chk(db.from('profiles').update({role,requested_role:role}).eq('id',id).neq('role','admin')),'تم تغيير الصلاحية');
};
let UD=null;
function uDelete(u){
  UD={id:u.id,typed:''};
  NX.dialog('ngmUDel','حذف الحساب نهائيًا',`<div class="ngm-form"><p class="ngm-p ngm-offline-red">سيتم حذف حساب «${h(u.full_name||'')}» نهائيًا. اكتب حذف للتأكيد.</p>${NX.field('اكتب: حذف',{oninput:'NGM.udTyped(this.value)'})}</div>`,{cls:'nx-small-dlg ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ngmUDel')"})}${NX.btn('حذف نهائي',{kind:'danger',id:'ngmUDelOk',disabled:true,onclick:'NGM.udGo()'})}`});
}
G.udTyped=v=>{UD.typed=v;const b=$i('ngmUDelOk');if(b)b.disabled=v.trim()!=='حذف'};
G.udGo=function(){
  if(!UD||UD.typed.trim()!=='حذف')return;const id=UD.id;NX.closeDialog('ngmUDel');
  uRun(id,async()=>{
    const u=uFind(id);if(!u||u.role==='admin'||id===state.user?.id)throw new Error('لا يمكن حذف حساب مسؤول النظام');
    const r=await db.rpc('admin_delete_account',{target_user:id});
    if(r.error)throw new Error(String(r.error.message||'').includes('admin_delete_account')?'شغّل ترحيل v2.17 في Supabase أولاً':r.error.message);
    if(r.data===false)throw new Error('تعذر حذف الحساب نهائياً');
    state.users=(state.users||[]).filter(x=>x.id!==id);try{await loadAll()}catch(_e){}
  },'تم حذف الحساب نهائيًا');
};

/* ---------- GuardianLinkDialog ---------- */
let GL=null;
G.gl=async function(){
  const sts=allStudents().filter(stActive).sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
  GL={sid:sts[0]?.id||'',gid:null,q:'',guardians:(state.guardianAccounts||[]).slice(),sts,loading:true,saving:false,error:''};glDlg();
  try{
    if(!GL.guardians.length&&hasDb()&&online()){const r=await db.rpc('list_guardian_accounts');if(r.error)throw r.error;GL.guardians=r.data||[]}
    await glCurrent();
  }catch(e){GL.error=err(e)||'تعذر تحميل بيانات الربط'}
  GL.loading=false;glDlg();
};
async function glCurrent(){
  GL.gid=null;GL.q='';if(!GL.sid||!hasDb()||!online())return;
  const r=await db.from('student_guardians').select('guardian_id,is_primary').eq('student_id',GL.sid).eq('is_primary',true).limit(1);
  const g=r.data&&r.data[0]?.guardian_id;if(g){GL.gid=g;GL.q=GL.guardians.find(x=>x.id===g)?.full_name||''}
}
function glMatches(){
  const norm=typeof normalizeNameJs==='function'?normalizeNameJs:v=>String(v||'').toLowerCase(),q=norm(GL.q);
  return GL.guardians.filter(g=>!q||norm(g.full_name).includes(q)||String(g.email||'').toLowerCase().includes(String(GL.q).toLowerCase())||String(g.phone||'').includes(GL.q)).slice(0,8);
}
function glResults(){
  const sel=GL.guardians.find(g=>g.id===GL.gid);
  return (GL.gid?`<div class="ngm-glsel">${ic('FamilyRestroom',20)}<span>${h(sel?.full_name||'ولي الأمر المرتبط')}</span>${NX.btn('بدون ربط',{kind:'text',small:true,onclick:'NGM.glClear()'})}</div>`:'')
    +glMatches().map(g=>`<button type="button" class="ngm-li ngm-glrow ${g.id===GL.gid?'on':''}" onclick="NGM.glPick('${g.id}')"><span class="ngm-grow"><b>${h(g.full_name||g.email||'ولي أمر')}</b><small>${h([g.email,g.phone].filter(Boolean).join(' · '))}</small></span>${g.id===GL.gid?ic('Check',20):''}</button>`).join('');
}
function glDlg(){
  const body=`<div class="ngm-form">${GL.loading?NX.skeleton(2):''}${GL.error?NX.notice(h(GL.error),'error'):''}
    ${NX.select('الطالب',GL.sts.map(s=>({value:s.id,label:s.full_name||''})),{value:GL.sid,onchange:'NGM.glStudent(this.value)'})}
    ${NX.search(GL.q,'ابحث عن ولي الأمر بالاسم أو البريد',{oninput:'NGM.glQ(this.value)'})}<div class="ngm-glres" id="ngmGlRes">${glResults()}</div></div>`;
  NX.dialog('ngmGl','ربط ولي الأمر بالطالب',body,{cls:'ngm-dlg',footer:`${NX.btn('إلغاء',{kind:'text',disabled:GL.saving,onclick:"NX.closeDialog('ngmGl')"})}${NX.btn(GL.saving?'جاري الحفظ…':'حفظ الربط',{disabled:GL.loading||GL.saving||!GL.sid,onclick:'NGM.glSave()'})}`});
}
G.glStudent=async function(id){GL.sid=id;GL.loading=true;glDlg();try{await glCurrent()}catch(e){GL.error=err(e)}GL.loading=false;glDlg()};
G.glQ=v=>{GL.q=v;if(GL.gid&&GL.guardians.find(g=>g.id===GL.gid)?.full_name!==v)GL.gid=null;const e=$i('ngmGlRes');if(e)e.innerHTML=glResults()};
G.glPick=id=>{const g=GL.guardians.find(x=>x.id===id);GL.gid=id;GL.q=g?.full_name||'';glDlg()};
G.glClear=()=>{GL.gid=null;GL.q='';glDlg()};
G.glSave=async function(){
  if(!GL||GL.saving||!GL.sid)return;GL.saving=true;GL.error='';glDlg();
  try{
    if(!online()||!hasDb())throw new Error('ربط ولي الأمر يحتاج اتصالاً بالإنترنت');
    await chk(db.rpc('set_student_primary_guardian',{p_student_id:GL.sid,p_guardian_id:GL.gid||null}));
    const s=(state.students||[]).find(x=>x.id===GL.sid);if(s)s._guardian_id=GL.gid||null;
    NX.closeDialog('ngmGl');GL=null;U.msg='تم تحديث ربط ولي الأمر';toast(U.msg);render()
  }catch(e){GL.saving=false;GL.error=err(e)||'تعذر ربط ولي الأمر';glDlg()}
};
})();
