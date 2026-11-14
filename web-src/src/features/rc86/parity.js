/* Halaqati web 2.89.32-web.2 — RC86: the web follows the native app as its base.
   - menus: same pages, same order, same labels per role as RoleNavigationPolicy.drawerItems (pages the app does not have are gone);
   - «المتابعة والمقارنة» page (InsightsScreen): tabs «المتابعة» (FollowUpBoard tiles + PlansNeedAttention + full list) and «المقارنة»;
   - home pieces used by rc27/dashboard.js: OrgSummaryCard, HomeShortcuts («الوصول السريع»), ApprovalsInboxCard. */
(function(){
  'use strict';
  const R=window.RC50;if(!R||window.__rc86)return;window.__rc86=true;
  const e=R.e||(v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const IC=(n,s)=>typeof mi==='function'?mi(n,s):'';
  const role=()=>state?.profile?.role;
  const online=()=>navigator.onLine&&state.networkVerified!==false&&!state.offline&&typeof db!=='undefined';
  const isProg=x=>typeof rc27IsProgram==='function'?rc27IsProgram(x):!!(x&&x.halaqa_type&&x.halaqa_type!=='regular');
  const master=k=>((window.RC27&&RC27.master&&RC27.master[k])||state[k]||[]);
  const countAr=(n,sing,one,two,plural)=>n<=0?'بدون '+plural:n===1?one:n===2?two:n<=10?`${n} ${plural}`:`${n} ${sing}`;
  const T0=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
  const dayDiff=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/864e5);
  const showPlans=()=>{try{return !(typeof rc27Scope==='function'&&rc27Scope().kind==='program')}catch(_e){return true}};
  const RC86=window.RC86={};

  // ================= menus (RoleNavigationPolicy.drawerItems) =================
  const DRAWER={
    admin:[['home','الرئيسية'],['notifications','الإشعارات'],['halaqas','إدارة الحلقات والفئات'],['community','الإعلانات ومنتدى الحلقة'],['sessions','الجلسات اليومية'],['students','الطلاب'],['plans','الخطط الذكية'],['certificates','الشهادات'],['exams','الاختبارات'],['awards','التكريم الشهري'],['support','الدعم والمانحون'],['chats','محادثات المانحين'],['observer_requests','طلبات المانحين'],['reports','التقارير'],['quran','حاسبة القرآن'],['ranking','الترتيب والإحصائيات'],['insights','المتابعة والمقارنة'],['data','الاستيراد والتصدير'],['supervision','متابعة المحفظين والمشرفين'],['visits','زيارات المشرفين'],['approvals','طلبات الاعتماد'],['org','الهيكل الإداري'],['team','فريق الجمعية'],['users','الحسابات والصلاحيات'],['settings','الإعدادات']],
    supervisor:[['home','الرئيسية'],['notifications','الإشعارات'],['halaqas','الحلقات'],['supervision','متابعة المحفظين'],['visits','الزيارات'],['sessions','الجلسات اليومية'],['students','الطلاب'],['exams','الاختبارات'],['reports','التقارير'],['ranking','الترتيب والإحصائيات'],['insights','المتابعة والمقارنة'],['community','الإعلانات والتواصل'],['approvals','طلبات المحفّظين'],['org','الهيكل الإداري'],['team','فريق الجمعية'],['settings','الإعدادات']],
    teacher:[['home','الرئيسية'],['notifications','الإشعارات'],['community','الإعلانات ومنتدى الحلقة'],['halaqas','حلقتي والفئات'],['sessions','الجلسات اليومية'],['students','طلابي'],['plans','الخطط الذكية'],['certificates','الشهادات'],['exams','الاختبارات'],['reports','التقارير'],['quran','حاسبة القرآن'],['ranking','الترتيب والإحصائيات'],['insights','المتابعة والمقارنة'],['data','تصدير البيانات'],['approvals','طلبات أولياء الأمور'],['settings','الإعدادات']],
    guardian:[['home','الرئيسية'],['notifications','الإشعارات'],['community','الإعلانات ومنتدى الحلقة'],['plans','خطط أبنائي الذكية'],['exams','اختبارات أبنائي'],['reports','تقارير أبنائي'],['competition','إحصائيات ومنافسة'],['ranking','الإنجازات'],['profile','ملف الطالب'],['settings','الإعدادات']],
    observer:[['home','الرئيسية'],['donor_awards','المكرَّمون'],['donor_support','الدعم'],['donor_impact','أثري'],['donor_stats','الإحصاءات'],['notifications','الإشعارات'],['settings','الإعدادات']]
  };
  const ADDED=new Set(['insights']);
  const prevNav=window.navItems;
  window.navItems=function(){
    const prev=prevNav.apply(this,arguments)||[],r=role(),list=DRAWER[r];
    if(!list)return prev;
    const have=new Map(prev.map(x=>[x[0],x]));
    // the app hides smart plans in program work mode; the earlier filter already removed them from prev
    return list.filter(([id])=>have.has(id)||ADDED.has(id)).map(([id,label])=>{
      const p=have.get(id);if(id==='notifications'&&p&&/\(\d+\)/.test(p[1]))return [id,label+' '+p[1].match(/\(\d+\)/)[0]];
      return [id,label];
    });
  };
  // bottom bar: guardian = Home · أبنائي · الإنجازات · الإعلانات · المزيد (RoleNavigationPolicy.bottom)
  const prevMobile=window.mobileNavItems;
  window.mobileNavItems=function(){
    const r=prevMobile.apply(this,arguments)||[];
    if(role()==='guardian'&&!r.some(x=>x[0]==='community')){const i=r.findIndex(x=>x[0]==='more');r.splice(i<0?r.length:i,0,['community','الإعلانات'])}
    return r;
  };
  if(window.RC27_ICONS&&!window.RC27_ICONS.insights)window.RC27_ICONS.insights=IC('Insights',24);
  const prevSvg=window.navSvg;
  if(typeof prevSvg==='function'){window.navSvg=function(p){if(p==='insights')return IC('Insights',24)||prevSvg('ranking');return prevSvg.apply(this,arguments)};window.iconFor=window.navSvg}

  // ================= drawer (GoldenDrawerContent: search, «مفضلتي», collapsible groups with counts) =================
  const DG_TITLES=['إدارة الحلقة','التقارير والإنجاز','التواصل والأدوات','إدارة النظام','الحساب والإعدادات'];
  const DG_OF={home:0,sessions:0,students:0,plans:0,halaqas:0,ranking:1,insights:1,competition:1,certificates:1,awards:1,support:1,donor_awards:1,donor_support:1,donor_impact:1,donor_stats:1,reports:1,supervision:1,visits:1,profile:1,community:2,quran:2,data:2,notifications:4,settings:4};
  const DQ={q:'',col:new Set()};
  const favKey=()=>'rc86_drawer_fav_'+(state.user?.id||'x');
  const favs=()=>{try{return new Set(JSON.parse(localStorage.getItem(favKey())||'[]'))}catch(_e){return new Set()}};
  const ICON_FIX={exams:'Quiz',chats:'Forum',observer_requests:'PersonAdd',org:'AccountTree',team:'Groups',visits:'EventAvailable',approvals:'PersonAdd',insights:'Insights'};
  const svgPrev=window.navSvg;
  if(typeof svgPrev==='function'){
    const fallback=String(svgPrev('__rc86_none__')||'');
    window.navSvg=function(p){const v=svgPrev.apply(this,arguments);if(ICON_FIX[p]&&(!v||String(v)===fallback))return IC(ICON_FIX[p],24);return v};window.iconFor=window.navSvg;
  }
  const navIcon=p=>typeof window.navSvg==='function'?window.navSvg(p):'';
  function dRow(p,l,F){
    const act=state.page===p,unread=p==='notifications'?Number(state.notificationUnread||0):0,bt=unread>99?'99+':unread,fav=F.has(p);
    return `<div class="d86-row ${act?'active':''}"><button type="button" class="dtile ${act?'active':''}" ${act?'aria-current="page"':''} title="${e(l)}" onclick="go('${p}')"><span class="dt-ico">${navIcon(p)}${unread?`<i class="dt-badge">${bt}</i>`:''}</span><span class="dt-label">${e(l)}</span></button><button type="button" class="d86-fav ${fav?'on':''}" aria-label="${fav?'إزالة من المفضلة':'إضافة إلى المفضلة'}" onclick="RC86.dFav('${p}')">${IC('Star',20)}</button></div>`;
  }
  function drawerBody(){
    const items=(window.navItems()||[]).map(x=>[x[0],String(x[1]).replace(/\s*\(\d+\)$/,'')]),F=favs(),q=DQ.q.trim();
    let html=`<div class="d86-search">${IC('Search',20)}<input type="search" id="d86Q" placeholder="ابحث عن صفحة" value="${e(DQ.q)}" oninput="RC86.dSearch(this.value)" aria-label="ابحث عن صفحة"></div><div id="d86List">`;
    if(q){const hits=items.filter(([,l])=>l.includes(q));html+=hits.length?`<div class="dgrid">${hits.map(([p,l])=>dRow(p,l,F)).join('')}</div>`:'<p class="d86-none">لا توجد صفحة بهذا الاسم</p>'}
    else{
      const fe=items.filter(([p])=>F.has(p));
      if(fe.length)html+=`<div class="nav-section d86-favt">مفضلتي</div><div class="dgrid">${fe.map(([p,l])=>dRow(p,l,F)).join('')}</div>`;
      const groups=new Map();items.forEach(([p,l])=>{const g=DG_OF[p]==null?3:DG_OF[p];if(!groups.has(g))groups.set(g,[]);groups.get(g).push([p,l])});
      [...groups.keys()].sort((a,b)=>a-b).forEach(g=>{const list=groups.get(g),closed=DQ.col.has(g)&&!list.some(([p])=>p===state.page);
        html+=`<button type="button" class="nav-section d86-gh" aria-expanded="${!closed}" onclick="RC86.dCol(${g})"><span>${DG_TITLES[g]} (${list.length})</span>${IC(closed?'KeyboardArrowDown':'KeyboardArrowUp',22)}</button>${closed?'':`<div class="dgrid">${list.map(([p,l])=>dRow(p,l,F)).join('')}</div>`}`});
    }
    return html+'</div>';
  }
  RC86.dSearch=v=>{DQ.q=v;const n=document.getElementById('nav');if(!n)return;const tmp=document.createElement('div');tmp.innerHTML=drawerBody();const nl=tmp.querySelector('#d86List'),ol=document.getElementById('d86List');if(nl&&ol)ol.replaceWith(nl)};
  RC86.dCol=g=>{DQ.col.has(g)?DQ.col.delete(g):DQ.col.add(g);paintDrawer(true)};
  RC86.dFav=p=>{const F=favs();F.has(p)?F.delete(p):F.add(p);try{localStorage.setItem(favKey(),JSON.stringify([...F]))}catch(_e){}paintDrawer(true)};
  function drawerAvatar(){
    const art=document.getElementById('rc27DrawerArt');if(!art||typeof R.avatar!=='function')return;
    let av=document.getElementById('d86Av');if(!av){av=document.createElement('span');av.id='d86Av';av.className='d86-av';art.parentNode.insertBefore(av,art)}
    art.style.display='none';const ph=typeof R.myPhoto==='function'?R.myPhoto():null,k=(ph?ph.length:0)+'|'+(state.profile?.full_name||'');
    if(av.dataset.k!==k){av.dataset.k=k;av.innerHTML=R.avatar(ph,state.profile?.full_name,60)}
  }
  function paintDrawer(force){
    try{drawerAvatar()}catch(_e){}
    const n=document.getElementById('nav');if(!n)return;const html=drawerBody();
    if(force||n.dataset.html86!==html){const had=document.activeElement&&document.activeElement.id==='d86Q';n.dataset.html86=html;n.innerHTML=html;if(had){const i=document.getElementById('d86Q');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}}}
  }
  const prevBuild=window.buildNav;
  if(typeof prevBuild==='function'){
    window.buildNav=function(){const r=prevBuild.apply(this,arguments);try{if(role()&&document.activeElement?.id!=='d86Q')paintDrawer(false)}catch(err){console.warn('rc86 drawer',err)}return r};
    try{buildNav=window.buildNav}catch(_e){}
  }

  // ================= home: OrgSummaryCard =================
  const OS={at:0,assoc:0,halaqat:0,staff:0,name:'',busy:false};
  RC86.orgCard=function(){
    const owner=!!window.__rc85Owner;
    const sub=owner?`${countAr(OS.assoc,'جمعية','جمعية واحدة','جمعيتان','جمعيات')} · ${countAr(OS.halaqat,'حلقة','حلقة واحدة','حلقتان','حلقات')}`
      :`${countAr(OS.halaqat,'حلقة','حلقة واحدة','حلقتان','حلقات')} · ${countAr(OS.staff,'عضو','عضو واحد','عضوان','أعضاء')}`;
    if(!OS.at)setTimeout(()=>RC86.refreshOrg(),0);
    return `<button type="button" class="h86-org" onclick="go('org')"><span class="h86-gold">${IC(owner?'Public':'AccountTree',28)}</span><span class="h86-orgt"><b>${e(owner?'إدارة الجمعيات':(OS.name||'الجمعية'))}</b><small>${e(sub)}</small></span>${IC('ChevronLeft',24)}</button>`;
  };
  RC86.refreshOrg=async function(){
    if(OS.busy||!online())return;OS.busy=true;
    try{
      const [a,hq,st,sub]=await Promise.all([
        db.from('associations').select('id').limit(200),
        db.from('halaqas').select('id,active').limit(400),
        db.from('profiles').select('id').in('role',['teacher','supervisor']).limit(500),
        db.rpc('rc66_my_subscription').then(r=>r,()=>({data:null}))]);
      OS.assoc=(a.data||[]).length;OS.halaqat=(hq.data||[]).filter(x=>x.active!==false).length;OS.staff=(st.data||[]).length;OS.name=(sub&&sub.data&&sub.data.name)||'';OS.at=Date.now();
      const box=document.getElementById('h86Org');if(box)box.innerHTML=RC86.orgCard();
    }catch(_e){}finally{OS.busy=false}
  };

  // ================= home: HomeShortcuts («الوصول السريع») =================
  const canOpen=id=>{try{return (window.navItems()||[]).some(x=>x[0]===id)}catch(_e){return false}};
  RC86.shortcuts=function(plans){
    const r=role(),items=[['students','الطلاب','People']];
    if(plans)items.push(['plans','الخطط','Assignment']);
    items.push(['sessions','الجلسات','CalendarMonth']);
    if(canOpen('exams'))items.push(['exams','الاختبارات','Quiz']);
    if(canOpen('certificates'))items.push(['certificates','الشهادات','WorkspacePremium']);
    items.push(['reports','التقارير','Assessment']);
    if(canOpen('insights'))items.push(['insights','المتابعة','Insights']);
    items.push(['ranking','الترتيب','EmojiEvents'],['quran','المصحف','MenuBook']);
    if(canOpen('org'))items.push(['org','الهيكل','AccountTree']);
    if(canOpen('team'))items.push(['team','الفريق','Groups']);
    if(r==='admin')items.push(['awards','التكريم','Star'],['support','الدعم','Favorite']);
    const cols=items.length%4===0?4:3;
    return `<section class="h86-short"><h3>الوصول السريع</h3><div class="h86-sg" style="--cols:${cols}">${items.map(([p,l,i])=>`<button type="button" onclick="go('${p}')"><span>${IC(i,28)}</span><b>${e(l)}</b></button>`).join('')}</div></section>`;
  };

  // ================= home: ApprovalsInboxCard =================
  const AP={n:0,at:0};
  RC86.apprCard=function(){
    if(Date.now()-AP.at>60000&&online()){AP.at=Date.now();db.rpc('rc_pending_requests').then(r=>{AP.n=Array.isArray(r.data)?r.data.length:0;const b=document.getElementById('h86Appr');if(b)b.innerHTML=RC86.apprCard()},()=>{})}
    return AP.n>0?`<button type="button" class="h86-entry" onclick="go('approvals')">${IC('PersonAdd',24)}<span><b>طلبات اعتماد بانتظارك</b><small>${AP.n} طلب بحاجة إلى مراجعتك</small></span>${IC('ChevronLeft',22)}</button>`:'';
  };

  // ================= «المتابعة والمقارنة» (InsightsScreen + FollowUpBoard) =================
  const FU={data:{},at:0,loading:false,tab:0,open:null,owner:''};
  const fuOwner=()=>String(state.user?.id||'')+'|'+role();
  function guardianMsgAbs(name,count,hq){return `السلام عليكم ورحمة الله، نود إعلامكم بأن الطالب ${name} تغيّب ${count} جلسات متتالية${hq?' في '+hq:''}. نرجو التواصل معنا للاطمئنان عليه. جزاكم الله خيرًا.`}
  function guardianMsgInactive(name,days){return `السلام عليكم ورحمة الله، نود إعلامكم بأن الطالب ${name} ${days!=null?`لم يسمّع منذ ${days} يومًا`:'لم يسمّع خلال الفترة الماضية'}. نرجو متابعته وتشجيعه. جزاكم الله خيرًا.`}
  async function fuAbsence(){
    if(!online())return null;
    const from=addDays(T0(),-60);
    const r=await db.from('attendance_records').select('student_id,status,sessions!inner(session_date,status)').gte('sessions.session_date',from).limit(5000);
    if(r.error)return null;
    const stu=new Map(master('students').filter(s=>s.status==='active').map(s=>[s.id,s])),hn=Object.fromEntries(master('halaqas').map(x=>[x.id,x.name]));
    const by=new Map;(r.data||[]).forEach(o=>{if(!o.sessions||o.sessions.status==='cancelled')return;(by.get(o.student_id)||by.set(o.student_id,[]).get(o.student_id)).push({d:o.sessions.session_date,s:o.status})});
    const out=[];by.forEach((rows,sid)=>{const s=stu.get(sid);if(!s)return;let c=0;for(const x of rows.sort((a,b)=>String(b.d).localeCompare(String(a.d)))){if(x.s==='absent')c++;else if(x.s==='excused')continue;else break}
      if(c>=3)out.push({title:s.full_name,detail:`غاب ${c} جلسات متتالية`,sub:hn[s.halaqa_id]||'',phone:s.guardian_phone,message:guardianMsgAbs(s.full_name,c,hn[s.halaqa_id]),n:c})});
    return out.sort((a,b)=>b.n-a.n);
  }
  async function fuInactive(){
    if(!online())return null;
    const td=T0(),from=addDays(td,-45);
    const r=await db.from('recitation_entries').select('student_id,sessions!inner(session_date,status)').gte('sessions.session_date',from).limit(5000);
    if(r.error)return null;
    const last={};(r.data||[]).forEach(o=>{if(!o.sessions||o.sessions.status==='cancelled')return;const d=o.sessions.session_date;if(o.student_id&&d>(last[o.student_id]||''))last[o.student_id]=d});
    if(!Object.keys(last).length)return null;// an empty window is a failed read, never a false all-clear
    const prog=new Set(master('halaqas').filter(isProg).map(x=>x.id)),out=[];
    master('students').filter(s=>s.status==='active'&&!prog.has(s.halaqa_id)).forEach(s=>{
      const en=String(s.enrollment_date||'').slice(0,10);if(en&&dayDiff(en,td)<14)return;
      const l=last[s.id],since=l?dayDiff(l,td):null;
      if(!l||since>=14)out.push({title:s.full_name,detail:since!=null?`آخر تسميع قبل ${since} يومًا`:'لا تسميع خلال آخر 45 يومًا',phone:s.guardian_phone,message:guardianMsgInactive(s.full_name,since),n:since==null?1e9:since});
    });
    return out.sort((a,b)=>b.n-a.n);
  }
  async function fuGuardian(){
    if(!online())return null;
    const r=await db.from('student_guardians').select('student_id').limit(5000);
    if(r.error)return null;const linked=new Set((r.data||[]).map(x=>x.student_id));if(!linked.size)return null;
    return master('students').filter(s=>s.status==='active'&&!linked.has(s.id)).map(s=>({title:s.full_name}));
  }
  function fuSessions(){
    const td=T0(),done=new Set(master('sessions').filter(s=>String(s.session_date).startsWith(td)&&s.status!=='cancelled').map(s=>s.halaqa_id));
    return master('halaqas').filter(x=>x.active!==false&&!x.archived_at&&!isProg(x)&&!done.has(x.id)).map(x=>({title:x.name,detail:'لم تُسجَّل جلسة اليوم'}));
  }
  async function fuTeacher(){
    let links=state.halaqaTeachers||[];
    if(online()){const r=await db.from('halaqa_teachers').select('halaqa_id,teacher_id').limit(1000);if(!r.error)links=r.data||[]}
    const hs=master('halaqas').filter(x=>x.active!==false&&!x.archived_at&&!isProg(x));
    if(hs.length&&!links.length&&!online())return null;
    const staffed=new Set(links.map(x=>x.halaqa_id));
    return hs.filter(x=>!staffed.has(x.id)).map(x=>({title:x.name,detail:'لا محفّظ مرتبط بهذه الحلقة'}));
  }
  async function fuNoPlan(){
    if(typeof window.rc27OrgLoad!=='function')return null;
    const O=await window.rc27OrgLoad(false);return (O.noPlan||[]).map(n=>({title:n}));
  }
  const TILES=()=>{const admin=['admin','supervisor'].includes(role()),t=[
    ['absence','غياب متكرر','PersonOff','danger',null,null],
    ['inactive','طلاب لم يسمّعوا منذ فترة','HourglassEmpty','warning',null,null],
    ['guardian','طلاب بلا ولي أمر','FamilyRestroom','info','فتح الطلاب','students']];
    if(admin)t.push(['session','حلقات لم تسجّل جلسة اليوم','EventBusy','warning','فتح الجلسات','sessions']);
    t.push(['teacher','حلقات بلا محفّظ','SupervisorAccount','danger','إدارة الحلقات','halaqas']);
    if(showPlans())t.push(['noplan','طلاب بلا خطة هذا الشهر','AssignmentLate','info','فتح الخطط','plans']);
    return t};
  async function loadFU(force){
    if(FU.owner!==fuOwner()){FU.owner=fuOwner();FU.data={};FU.at=0}
    if(FU.loading)return;if(!force&&FU.at&&Date.now()-FU.at<300000)return;
    FU.loading=true;paintFU();
    const admin=['admin','supervisor'].includes(role());
    const jobs=[['absence',fuAbsence],['inactive',fuInactive],['guardian',fuGuardian],['teacher',fuTeacher]];
    if(admin)jobs.push(['session',async()=>fuSessions()]);
    if(showPlans())jobs.push(['noplan',fuNoPlan]);
    await Promise.all(jobs.map(async([k,f])=>{try{const r=await f();if(r!=null){FU.data[k]=r;paintFU()}}catch(_e){}}));
    FU.at=Date.now();FU.loading=false;paintFU();
  }
  function tileHtml([key,title,icon,kind]){
    const items=FU.data[key],count=items?items.length:null,clear=count===0;
    const tone=count==null?'none':clear?'ok':kind;
    const note=count==null?(FU.loading?'جارٍ التحديث…':'غير متاح الآن'):clear?'كل شيء سليم':'اضغط للتفاصيل';
    return `<button type="button" class="fu86 fu86-${tone}" onclick="RC86.fuOpen('${key}')"><span class="fu86-h"><i>${IC(clear?'CheckCircle':icon,24)}</i><b>${count==null?'–':count}</b></span><strong>${e(title)}</strong><small>${note}</small></button>`;
  }
  const gazaClock=ms=>{try{return new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Gaza',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(ms)).replace('AM','ص').replace('PM','م')}catch(_e){return ''}};
  function fuBoard(){
    const stamp=FU.loading?'جارٍ التحديث…':FU.at?`آخر تحديث ${gazaClock(FU.at)}`:'';
    return `<div class="fu86-grid">${TILES().map(tileHtml).join('')}</div><small class="fu86-stamp">${e(stamp)}</small>`;
  }
  function paintFU(){const b=document.getElementById('fu86Board');if(b)b.innerHTML=fuBoard()}
  RC86.fuOpen=function(key){
    const t=TILES().find(x=>x[0]===key);if(!t)return;const rows=FU.data[key]||[];
    const body=`<p class="fu86-sum">${rows.length?rows.length+' حالة':'كل شيء سليم هنا'}</p><div class="fu86-list">${rows.slice(0,60).map((r,i)=>`<div class="fu86-row"><div><b>${e(r.title)}</b>${r.detail?`<small>${e(r.detail)}</small>`:''}${r.sub?`<em>${e(r.sub)}</em>`:''}</div>${r.message?`<button type="button" class="nx-btn nx-text" onclick="RC86.fuMsg('${key}',${i})">رسالة للولي</button>`:''}</div>`).join('')}</div>${t[4]?`<button type="button" class="nx-btn nx-filled nx-full" onclick="NX.closeDialog('fu86Dlg');go('${t[5]}')">${e(t[4])}</button>`:''}`;
    NX.dialog('fu86Dlg',e(t[1]),body,{cls:'fu86-dlg'});
  };
  RC86.fuMsg=function(key,i){
    const r=(FU.data[key]||[])[i];if(!r)return;const phone=String(r.phone||'').replace(/[^\d+]/g,''),msg=r.message,mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
    if(phone)window.open(mobile?`sms:${phone}?body=${encodeURIComponent(msg)}`:`https://wa.me/${phone.replace(/^\+/,'')}?text=${encodeURIComponent(msg)}`,'_blank');
    else if(navigator.share)navigator.share({text:msg}).catch(()=>{});else{navigator.clipboard?.writeText(msg);toast('تم نسخ رسالة ولي الأمر')}
  };
  const RD={names:null,at:0};
  async function loadRouteDone(){
    if(RD.at&&Date.now()-RD.at<300000)return;RD.at=Date.now();
    try{if(online()&&showPlans()&&typeof rc27RebasePreviews==='function'){if(typeof rc27HealRanges==='function')await rc27HealRanges();RD.names=(await rc27RebasePreviews()).filter(p=>p.status==='ROUTE_COMPLETE').map(p=>p.studentName);RC86.paintInsights()}}catch(_e){}
  }
  function insightsBody(){
    const admin=['admin','supervisor'].includes(role()),X=(window.RC27Insights&&RC27Insights.parts)||{};
    if(FU.tab===0){
      const rd=RD.names&&RD.names.length?NX.insight('warning','EmojiEvents','أتمّوا مسار الحفظ',e(RD.names.slice(0,3).join('، ')+(RD.names.length>3?` … +${RD.names.length-3}`:'')+' — أنشئ لهم خطة مراجعة أو تثبيت.'),{count:RD.names.length,onclick:"go('plans')"}):'';
      return `<div id="fu86Board">${fuBoard()}</div>${showPlans()?rd:''}<button type="button" class="nx-btn nx-outlined nx-full" onclick="go('follow_up')">قائمة المتابعة الكاملة للطلاب</button>`;
    }
    return `${admin&&X.cmp?X.cmp():''}${X.seasons?X.seasons(admin):''}`;
  }
  RC86.paintInsights=function(){const b=document.getElementById('ins86Body');if(b&&state.page==='insights')b.innerHTML=insightsBody()};
  RC86.insTab=function(t){FU.tab=t;document.querySelectorAll('.ins86-tabs button').forEach((b,i)=>{b.classList.toggle('on',i===t);b.setAttribute('aria-selected',i===t?'true':'false')});const b=document.getElementById('ins86Body');if(b){b.classList.remove('ins86-in');void b.offsetWidth;b.classList.add('ins86-in')}RC86.paintInsights();if(t===1&&window.RC27Insights)RC27Insights.load()};
  RC86.insRefresh=function(){FU.at=0;RD.at=0;loadFU(true);loadRouteDone();if(window.RC27Insights)RC27Insights.load()};
  R.page('insights',{title:'المتابعة والمقارنة',roles:['admin','supervisor','teacher'],render:async()=>{
    setTimeout(()=>{loadFU(false);loadRouteDone();if(window.RC27Insights)RC27Insights.load()},0);
    return `<div class="ins86"><div class="ins86-tabs" role="tablist"><button type="button" role="tab" class="${FU.tab===0?'on':''}" aria-selected="${FU.tab===0}" onclick="RC86.insTab(0)">المتابعة</button><button type="button" role="tab" class="${FU.tab===1?'on':''}" aria-selected="${FU.tab===1}" onclick="RC86.insTab(1)">المقارنة</button></div><div id="ins86Body" class="ins86-in">${insightsBody()}</div></div>`;
  }});
  window.addEventListener('halaqati:sessionchange',()=>{FU.at=0;RD.at=0;OS.at=0;AP.at=0});
})();
