/* Halaqati v2.63.38 (RC27.38) — org insight cards (inactive students, halaqa/category comparison, competition seasons)
   and guardian cards (praise, badges, seasons, share monthly report). Pure ports of OrgInsightRules / BadgeRules /
   GuardianPraise / GuardianReportText / SeasonsCard. Read-only on the database except competition_seasons (as the app). */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v);
  const T0=()=>typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);
  const fm=v=>{const r=Math.round(v*100)/100;return Number.isInteger(r)?String(r):String(r).replace(/0+$/,'').replace(/\.$/,'')};
  const online=()=>navigator.onLine&&state.networkVerified!==false&&!state.offline;
  const role=()=>state.profile?.role;
  const isProg=x=>typeof rc27IsProgram==='function'?rc27IsProgram(x):(x.halaqa_type&&x.halaqa_type!=='regular');
  const dayDiff=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/864e5);
  const addDays=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
  const addMonths=(d,n)=>{const x=new Date(d+'T00:00:00Z'),day=x.getUTCDate();x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+n);const last=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate();x.setUTCDate(Math.min(day,last));return x.toISOString().slice(0,10)};
  const POOR=['repeat','weak','إعادة','ضعيف'],REVIEW=['review_near','review_far','tathbit','sard'];
  const I={open:{},period:'month',cat:false,cmp:null,cmpAt:0,cmpKey:'',inactive:null,inactiveAt:0,seasons:null,seasonsAt:0,live:[],err:null,busy:false};
  let insightOwner=null;
  function ensureOwner(){const key=String(state.user?.id||'')+'|'+role();if(key===insightOwner)return;insightOwner=key;Object.assign(I,{cmp:null,cmpAt:0,cmpKey:'',inactive:null,inactiveAt:0,seasons:null,seasonsAt:0,live:[],err:null});for(const k of Object.keys(OV))delete OV[k]}
  window.addEventListener('halaqati:sessionchange',()=>{I.cmpAt=0;I.inactiveAt=0;I.seasonsAt=0});
  const PERIODS=[['week','هذا الأسبوع'],['month','هذا الشهر'],['prev','الشهر الماضي'],['quarter','آخر 3 أشهر'],['year','آخر سنة']];
  const DURATIONS=[[14,'أسبوعان'],[30,'شهر'],[91,'3 أشهر'],[182,'6 أشهر'],[365,'سنة']];

  // ---------- OrgInsightRules ----------
  function periodRange(kind,today){
    if(kind==='week'){const d=new Date(today+'T00:00:00Z'),back=(d.getUTCDay()+1)%7;return [addDays(today,-back),today]}
    if(kind==='prev'){const f=addMonths(today.slice(0,8)+'01',-1),e=new Date(Date.UTC(+f.slice(0,4),+f.slice(5,7),0)).toISOString().slice(0,10);return [f,e]}
    if(kind==='quarter')return [addMonths(today,-3),today];
    if(kind==='year')return [addMonths(today,-12),today];
    return [today.slice(0,8)+'01',today];
  }
  const rank=a=>a.slice().sort((x,y)=>((y.sessions>0)-(x.sessions>0))||((y.att??-1)-(x.att??-1))||((y.quality??-1)-(x.quality??-1))||(y.ppS-x.ppS));
  function compute(ids,studentsBy,sessions,att,rec){
    return ids.map(id=>{
      const a=att.filter(x=>x.g===id),pr=a.filter(x=>x.s==='present'||x.s==='late').length,ab=a.filter(x=>x.s==='absent').length,r=rec.filter(x=>x.g===id);
      const hifz=r.filter(x=>x.t==='new_hifz').reduce((s,x)=>s+x.p,0),rev=r.filter(x=>REVIEW.includes(x.t)).reduce((s,x)=>s+x.p,0),n=studentsBy[id]||0;
      return {id,students:n,sessions:sessions.filter(x=>x.g===id).length,att:pr+ab>0?Math.round(pr*100/(pr+ab)):null,hifz,rev,ppS:n>0?(hifz+rev)/n:0,quality:r.length?Math.round(r.filter(x=>!POOR.includes(String(x.e||'').toLowerCase())).length*100/r.length):null};
    }).sort((a,b)=>b.ppS-a.ppS);
  }
  async function compareGroups(from,to,byCat){
    ensureOwner();if(!online())return null;
    const hs=(window.RC27?.master?.halaqas||state.halaqas||[]).filter(x=>x.active!==false&&!isProg(x));
    if(hs.length<2)return null;
    const hname=Object.fromEntries(hs.map(x=>[x.id,x.name])),stu=(window.RC27?.master?.students||state.students||[]).filter(s=>s.status==='active'&&hname[s.halaqa_id]);
    const f=q=>q.gte('sessions.session_date',from).lte('sessions.session_date',to);
    const [at,rc,se]=await Promise.all([window.HalaqatiData.result(()=>f(db.from('attendance_records').select('student_id,status,sessions!inner(session_date,halaqa_id,status)')).order('session_id').order('student_id'),()=>state.user?.id),window.HalaqatiData.result(()=>f(db.from('recitation_entries').select('student_id,activity_type,pages_count,evaluation,sessions!inner(session_date,halaqa_id,status)')).order('id'),()=>state.user?.id),
      window.HalaqatiData.result(()=>db.from('sessions').select('id,halaqa_id,session_date,status').gte('session_date',from).lte('session_date',to).order('id'),()=>state.user?.id)]);
    if(at.error||rc.error||se.error)throw (at.error||rc.error||se.error);
    const live=o=>o.sessions&&o.sessions.status!=='cancelled';
    if(!byCat){
      const per={};stu.forEach(s=>{per[s.halaqa_id]=(per[s.halaqa_id]||0)+1});
      const stats=compute(hs.map(x=>x.id),per,(se.data||[]).filter(s=>s.status!=='cancelled').map(s=>({g:s.halaqa_id})),
        (at.data||[]).filter(live).map(o=>({g:o.sessions.halaqa_id,s:o.status})),(rc.data||[]).filter(live).map(o=>({g:o.sessions.halaqa_id,t:o.activity_type,p:Number(o.pages_count)||0,e:o.evaluation})));
      return {stats,names:hname};
    }
    const cr=await window.HalaqatiData.result(()=>db.from('student_categories').select('id,halaqa_id,name,active').order('name').order('id'),()=>state.user?.id);if(cr.error)throw cr.error;
    const cats=(cr.data||[]).filter(c=>c.active!==false&&hname[c.halaqa_id]),cname=Object.fromEntries(cats.map(c=>[c.id,c.name+' · '+hname[c.halaqa_id]]));
    const catOf={};stu.forEach(s=>{if(s.category_id&&cname[s.category_id])catOf[s.id]=s.category_id});
    const keys=new Set,attR=[],recR=[];
    (at.data||[]).filter(live).forEach(o=>{const c=catOf[o.student_id];if(!c)return;keys.add(c+'|'+o.sessions.halaqa_id+'|'+o.sessions.session_date);attR.push({g:c,s:o.status})});
    (rc.data||[]).filter(live).forEach(o=>{const c=catOf[o.student_id];if(!c)return;recR.push({g:c,t:o.activity_type,p:Number(o.pages_count)||0,e:o.evaluation})});
    const sessions=[...keys].map(k=>({g:k.split('|')[0]})),per={};Object.values(catOf).forEach(c=>{per[c]=(per[c]||0)+1});
    return {stats:compute(Object.keys(per),per,sessions,attR,recR),names:cname};
  }

  // ---------- shell / meters ----------
  const shell=(kind,icon,title,summary,count,extra,key,open)=>NX.insight(kind==='error'?'danger':kind,icon,h(title),h(summary||''),{count,expanded:open==null?undefined:open,onclick:key?`rc27InsOpen('${key}')`:null,body:extra||''});
  const fmtPct=v=>v==null?'—':v+'٪';
  const meter=(l,v)=>`<div class="nh-meter"><div><span>${l}</span><b>${fmtPct(v)}</b></div><i><u style="width:${v==null?0:v}%;background:${v==null?'var(--outline)':v>=75?'var(--green)':v>=50?'var(--gold)':'var(--danger)'}"></u></i></div>`;
  const chip=(on,fn,label)=>NX.chip(label,{selected:on,check:false,onclick:`event.stopPropagation();${fn}`});
  const repaint=()=>{if(role()==='guardian'){if(document.getElementById('rc27GOv'))paintGuardian();return}if(state.page==='home'&&!(window.nhRerender&&window.nhRerender()))render()};
  window.rc27InsOpen=k=>{I.open[k]=!(I.open[k]??(k==='cmp'||k==='badges'));repaint()};
  window.rc27InsSet=(k,v)=>{I[k]=v;if(k==='period'||k==='cat'){I.cmpAt=0;loadCmp(true)}repaint()};
  const rerender=()=>{if(state.page==='home'&&role()!=='guardian')repaint()};

  // ---------- inactive students (14+ days) ----------
  async function loadInactive(){
    ensureOwner();if(Date.now()-I.inactiveAt<300000)return;I.inactiveAt=Date.now();
    if(!online()){I.inactive=null;return}
    try{
      const today=T0(),from=addDays(today,-45),r=await window.HalaqatiData.result(()=>db.from('recitation_entries').select('student_id,sessions!inner(session_date,status)').gte('sessions.session_date',from).order('id'),()=>state.user?.id);
      if(r.error)throw r.error;
      const last={};(r.data||[]).forEach(o=>{if(!o.sessions||o.sessions.status==='cancelled')return;const d=o.sessions.session_date;if(o.student_id&&d>(last[o.student_id]||''))last[o.student_id]=d});
      if(!Object.keys(last).length){I.inactive=[];return}// an empty window means a failed read, not "nobody recited"
      const progIds=new Set((window.RC27?.master?.halaqas||state.halaqas||[]).filter(isProg).map(x=>x.id));
      const out=[];(window.RC27?.master?.students||state.students||[]).filter(s=>s.status==='active'&&!progIds.has(s.halaqa_id)).forEach(s=>{
        const en=String(s.enrollment_date||s.created_at||'').slice(0,10);if(en&&dayDiff(en,today)<14&&s.enrollment_date)return;
        const l=last[s.id],since=l?dayDiff(l,today):null;if(!l||since>=14)out.push({sid:s.id,name:s.full_name,days:since,phone:s.guardian_phone})});
      I.inactive=out.sort((a,b)=>(b.days??1e9)-(a.days??1e9));
      rerender();
    }catch(_e){I.inactive=null}
  }
  window.rc27InactiveMsg=function(sid){
    const x=(I.inactive||[]).find(v=>v.sid===sid);if(!x)return;
    const msg=`السلام عليكم ورحمة الله وبركاته، نودّ الاطمئنان على الطالب ${x.name}، ${x.days!=null?`فلم يُسمِّع منذ ${x.days} يومًا`:'فلم نسجّل له تسميعًا منذ مدة'}. نرجو التواصل معنا لنعينه على العودة لانتظامه. جزاكم الله خيرًا.`;
    sendText(msg,x.phone);
  };
  function sendText(msg,phone){
    const p=String(phone||'').replace(/[^\d+]/g,''),mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
    if(p)window.open(mobile?`sms:${p}?body=${encodeURIComponent(msg)}`:`https://wa.me/${p.replace(/^\+/,'')}?text=${encodeURIComponent(msg)}`,'_blank');
    else if(navigator.share)navigator.share({text:msg}).catch(()=>{});
    else window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
  }

  // ---------- comparison ----------
  async function loadCmp(force){
    ensureOwner();const key=state.user?.id+'|'+I.period+'|'+I.cat;
    if(!force&&I.cmpKey===key&&Date.now()-I.cmpAt<300000)return;
    I.cmpKey=key;I.cmpAt=Date.now();
    try{const [f,t]=periodRange(I.period,T0()),r=await compareGroups(f,t,I.cat);if(r){I.cmp=r}else if(!I.cmp)I.cmp=null;rerender()}catch(_e){}
  }
  function cmpCard(){
    if(!I.cmp)return '';
    const open=I.open.cmp??true,st=rank(I.cmp.stats),label=PERIODS.find(p=>p[0]===I.period)[1];
    const rows=st.map((x,i)=>{
      const has=x.sessions>0,o=!!I.open['cmp:'+x.id],name=h(I.cmp.names[x.id]||(I.cat?'فئة':'حلقة'));
      return `<div class="nh-cmp ${has?'has':''}" ${has?`onclick="event.stopPropagation();rc27InsOpen('cmp:${x.id}')"`:''}><div class="nh-cmp-h"><span class="nh-cmp-n ${has?'':'dim'}">${i+1}</span><div><b>${name}</b><small>${has?`${x.students} طالبًا · ${x.sessions} جلسات`:`${x.students} طالبًا · لا جلسات في هذه الفترة`}</small></div></div>${has?meter('الحضور',x.att)+meter('جودة التسميع',x.quality)+(o?`<small class="nh-cmp-d">صفحات/طالب ${x.ppS.toFixed(1)}</small><small class="nh-cmp-d">حفظ ${x.hifz.toFixed(0)} ص · مراجعة وتثبيت وسرد ${x.rev.toFixed(0)} ص</small>`:'<small class="nh-cmp-hint">اضغط لعرض الصفحات</small>'):''}</div>`;
    }).join('<hr class="nx-divider">');
    const filters=`<div class="nh-chiprow">${chip(!I.cat,"rc27InsSet('cat',false)",'الحلقات ككل')}${chip(I.cat,"rc27InsSet('cat',true)",'حسب الفئات')}</div><div class="nh-chiprow">${PERIODS.map(p=>chip(I.period===p[0],`rc27InsSet('period','${p[0]}')`,p[1])).join('')}</div>`;
    return shell('neutral','Leaderboard',I.cat?'مقارنة الفئات':'مقارنة الحلقات',`${label} · ${st.length}${I.cat?' فئات':' حلقات'}`,null,open?filters+(rows||'<small class="nh-cmp-d">لا بيانات في هذه الفترة</small>'):'','cmp',open);
  }

  // ---------- seasons ----------
  async function loadSeasons(force){
    ensureOwner();const user=state.user?.id;if(!force&&Date.now()-I.seasonsAt<300000)return;I.seasonsAt=Date.now();
    if(!online())return;
    try{
      const r=await db.from('competition_seasons').select('*').order('start_date',{ascending:false}).limit(30);
      if(user!==state.user?.id)return;
      if(r.error){I.seasons=null;return}// table missing / no access: card stays hidden
      I.seasons=r.data||[];
      const act=I.seasons.find(s=>s.status==='active');I.live=[];
      if(act&&canManageSeasons()){
        const from=String(act.start_date).slice(0,10),end=String(act.end_date).slice(0,10),to=end<T0()?end:T0();
        const c=await compareGroups(from,to,act.level==='category');
        if(c)I.live=rank(c.stats).map(x=>({name:c.names[x.id]||'',st:x}));
      }
      rerender();
    }catch(_e){}
  }
  const canManageSeasons=()=>role()==='admin'||role()==='supervisor';
  const lvlAr=l=>l==='category'?'مسابقة الفئات':'مسابقة الحلقات';
  function seasonsCard(manage){
    const list=I.seasons;if(!list)return '';
    const act=list.find(s=>s.status==='active'),closed=list.filter(s=>s.status==='closed').slice(0,5),open=!!I.open.seasons;
    const summary=act?`${act.name} · ${Math.max(0,dayDiff(T0(),String(act.end_date).slice(0,10)))} يومًا متبقية`:(manage?'لا موسم نشط — ابدأ موسمًا جديدًا':'لا موسم نشط');
    let body='';
    if(open){
      if(I.err)body+=`<small class="nh-err">${h(I.err)}</small>`;
      if(act){
        body+=`<span class="nh-s-meta">${lvlAr(act.level)} · من ${h(String(act.start_date).slice(0,10))} إلى ${h(String(act.end_date).slice(0,10))}</span>`;
        if(manage&&!I.live.length)body+='<small>لا بيانات بعد في هذا الموسم</small>';
        body+=I.live.slice(0,5).map((x,i)=>`<div class="nh-srow"><b class="nh-srow-n">${i+1}</b><b class="nh-srow-t">${h(x.name||'—')}</b><span>حضور ${fmtPct(x.st.att)} · جودة ${fmtPct(x.st.quality)}</span></div>`).join('');
        if(manage)body+=NX.btn('إنهاء الموسم وحفظ النتائج',{kind:'text',cls:'nh-tb nh-tb-start',disabled:I.busy,onclick:'event.stopPropagation();rc27SeasonEnd()'});
      }else if(manage)body+=NX.btn('موسم جديد',{kind:'filled',full:true,cls:'nh-act',onclick:'event.stopPropagation();rc27SeasonNew()'});
      if(closed.length){
        body+='<hr class="nx-divider"><b class="nh-s-sub">مواسم سابقة</b>';
        closed.forEach((c,i)=>{const w=Array.isArray(c.winners)?c.winners:[],nm=k=>w[k]?.name;
          body+=`<small class="nh-s-line">${h(c.name)}${nm(0)?` — الأول: ${h(nm(0))}`:''}${nm(1)?` · الثاني: ${h(nm(1))}`:''}${nm(2)?` · الثالث: ${h(nm(2))}`:''}</small>`;
          if(i===0&&nm(0))body+=NX.btn('مشاركة التهنئة',{kind:'text',cls:'nh-tb nh-tb-start',onclick:`event.stopPropagation();rc27SeasonShare('${c.id}')`})});
      }
    }
    return shell('info','EmojiEvents','المواسم والمسابقات',summary,null,body,'seasons',open);
  }
  // ---- dialogs (AlertDialogs of SeasonsCard) ----
  const SN={name:'',level:'halaqa',days:30};
  function seasonDialog(){
    const body=`${NX.field('اسم الموسم',{id:'rc27SeName',value:SN.name,oninput:"rc27SeSet('name',this.value,true)"})}<b class="nh-s-sub">المستوى</b>${NX.chips([{label:'الحلقات ككل',selected:SN.level==='halaqa',check:false,onclick:"rc27SeSet('level','halaqa')"},{label:'حسب الفئات',selected:SN.level==='category',check:false,onclick:"rc27SeSet('level','category')"}])}<b class="nh-s-sub">المدة</b>${NX.chips(DURATIONS.map(d=>({label:d[1],selected:SN.days===d[0],check:false,onclick:`rc27SeSet('days',${d[0]})`})))}`;
    NX.dialog('nhSeason','موسم جديد',body,{cls:'nx-small-dlg',footer:`${NX.btn('إلغاء',{kind:'text',disabled:I.busy,onclick:"NX.closeDialog('nhSeason')"})}${NX.btn('ابدأ الموسم',{kind:'filled',disabled:I.busy||SN.name.trim().length<2,id:'nhSeasonGo',onclick:'rc27SeasonCreate()'})}`});
  }
  window.rc27SeSet=(k,v,live)=>{SN[k]=v;if(live){const b=document.getElementById('nhSeasonGo');if(b)b.disabled=I.busy||SN.name.trim().length<2;return}seasonDialog();const el=document.getElementById('rc27SeName');if(el&&k==='name')el.focus()};
  window.rc27SeasonNew=function(){I.err=null;Object.assign(SN,{name:'',level:'halaqa',days:30});seasonDialog()};
  window.rc27SeasonCreate=async function(){
    const name=SN.name.trim(),days=SN.days,level=SN.level;
    if(name.length<2)return toast('اكتب اسم الموسم');
    if(!canManageSeasons()||I.busy)return;
    I.busy=true;
    try{
      const r=await db.from('competition_seasons').insert({name,level,start_date:T0(),end_date:addDays(T0(),days),status:'active'});
      if(r.error){I.err=r.error.message||'تعذر إنشاء الموسم';toast(I.err)}else I.err=null;
    }finally{I.busy=false}
    NX.closeDialog('nhSeason');await loadSeasons(true);repaint();
  };
  window.rc27SeasonEnd=function(){
    const act=(I.seasons||[]).find(s=>s.status==='active');if(!act)return;
    NX.confirm('إنهاء الموسم',`سيُحفظ الترتيب الحالي كنتيجة نهائية لموسم «${h(act.name)}» ويُغلق الموسم.`,'إنهاء وحفظ',()=>rc27SeasonClose(act.id));
  };
  window.rc27SeasonClose=async function(id){
    if(!canManageSeasons()||I.busy)return;
    const act=(I.seasons||[]).find(x=>x.id===id&&x.status==='active');if(!act)return;
    I.busy=true;
    try{
      let computed;try{computed=await compareGroups(String(act.start_date).slice(0,10),String(act.end_date).slice(0,10)<T0()?String(act.end_date).slice(0,10):T0(),act.level==='category')}catch(e){return toast('لم تُحفظ النتائج: '+e.message)}
      if(!computed)return toast('لا تتوفر بيانات مكتملة لحفظ نتائج الموسم');
      const winners=rank(computed.stats).map((x,i)=>({rank:i+1,name:computed.names[x.id]||'',group_id:x.id,attendance:x.att,quality:x.quality,pages_per_student:x.ppS}));
      const r=await db.from('competition_seasons').update({status:'closed',closed_at:new Date().toISOString(),winners}).eq('id',id);
      if(r.error){I.err=r.error.message||'تعذر إنهاء الموسم';toast(I.err)}else I.err=null;
    }finally{I.busy=false}
    await loadSeasons(true);repaint();
  };
  window.rc27SeasonShare=function(id){
    const c=(I.seasons||[]).find(s=>s.id===id);if(!c)return;const w=Array.isArray(c.winners)?c.winners:[],medals=['🥇','🥈','🥉'];
    let t=`🏆 *نتائج مسابقة ${c.name}*\n${lvlAr(c.level)}\nمن ${String(c.start_date).slice(0,10)} إلى ${String(c.end_date).slice(0,10)}\n\n`;
    w.slice(0,3).forEach((x,i)=>{t+=`${medals[i]} ${x.name}${x.attendance!=null?` — حضور ${x.attendance}٪`:''}${x.quality!=null?` · جودة ${x.quality}٪`:''}\n`});
    t+='\nمبارك للفائزين، وبارك الله في جهود الجميع.\n— حلقاتي';sendText(t,'');
  };

  // ---------- home cards (admin / supervisor / teacher) ----------
  function inactiveCard(){
    if(!(I.inactive&&I.inactive.length))return '';
    const open=!!I.open.inactive,rows=I.inactive.slice(0,15).map(x=>`<div class="nh-irow"><div class="nh-irow-t"><b>${h(x.name)}</b><small>${x.days!=null?`آخر تسميع قبل ${x.days} يومًا`:'لا تسميع خلال آخر 45 يومًا'}</small></div>${NX.btn('رسالة للولي',{kind:'text',cls:'nh-tb',onclick:`event.stopPropagation();rc27InactiveMsg('${x.sid}')`})}</div>`).join('');
    const nm=I.inactive.slice(0,4).map(x=>x.name).join('، ')+(I.inactive.length>4?' …':'');
    return shell('warning','HourglassEmpty','طلاب لم يسمّعوا منذ فترة',open?'لم يُسجَّل لهم تسميع منذ 14 يومًا فأكثر':nm,I.inactive.length,open?rows:'','inactive',open);
  }
  function cards(r){
    ensureOwner();
    const out=[inactiveCard()];
    if(r==='admin'||r==='supervisor'){out.push(cmpCard());out.push(seasonsCard(true))}else if(r==='teacher')out.push(seasonsCard(false));
    return out.join('');
  }
  window.RC27Insights={cards,load(){ensureOwner();loadInactive();loadSeasons(false);if(role()==='admin'||role()==='supervisor')loadCmp(false)},compareGroups,
    parts:{inactive:()=>{ensureOwner();return inactiveCard()},cmp:()=>{ensureOwner();return cmpCard()},seasons:m=>{ensureOwner();return seasonsCard(!!m)}}};

  // ---------- guardian: overview cards ----------
  const MONTHS=['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
  const actLabel=(raw,tath)=>tath&&raw!=='test'?'تثبيت':({new_hifz:'حفظ',hifz:'حفظ',review_near:'مراجعة',review_far:'مراجعة',review:'مراجعة',sard:'سرد',tilawah:'تلاوة',tathbit:'تثبيت',test:'اختبار'}[raw]||'تسميع');
  function rangeLabel(o){
    if(!o.start_surah)return '';
    const sn=n=>(typeof surahs!=='undefined'&&surahs[n-1])||String(n);
    const a=`${sn(o.start_surah)}${o.start_ayah?':'+o.start_ayah:''}`;
    if(!o.end_surah||(o.end_surah===o.start_surah&&o.end_ayah===o.start_ayah))return a;
    return `${a} ← ${o.end_surah===o.start_surah?'':sn(o.end_surah)}${o.end_ayah?(o.end_surah===o.start_surah?'':':')+o.end_ayah:''}`;
  }
  function parseOverview(j){
    const s=j?.student;if(!s)return null;
    const tath=s.track==='tathbit',m=j.month||{},plan=j.plan,t=j.today||{};
    let acts=[];
    if(plan){
      const arr=Array.isArray(plan.activities)?plan.activities:[];
      acts=arr.filter(r=>r&&r.key).map(r=>({key:r.key,label:r.label||actLabel(r.key,tath),target:Math.max(0,+r.target_pages||0),done:Math.max(0,+r.done_pages||0)}));
      if(!acts.length){
        if(tath)acts=[{key:'tathbit',label:'التثبيت',target:+plan.target_pages||0,done:+m.tathbit||0}];
        else{acts=[{key:'hifz',label:'الحفظ',target:+plan.target_pages||0,done:+m.hifz||0}];const st=+plan.sard_target_pages||0,sd=+m.sard||0;if(st>0.0001||sd>0.0001)acts.push({key:'sard',label:'السرد',target:st,done:sd})}
      }
    }
    acts.forEach(a=>{a.has=a.target>0.0001;a.pct=a.has?Math.min(100,a.done*100/a.target):0;a.remaining=a.has?Math.max(0,a.target-a.done):0;a.surplus=a.has?Math.max(0,a.done-a.target):0;a.complete=a.has&&a.done+0.0001>=a.target});
    const targeted=acts.filter(a=>a.has);
    return {name:s.full_name||'طالب',tath,track:tath?'التثبيت':'الحفظ العام',sub:[s.halaqa_name,s.category_name].filter(Boolean).join(' · '),
      todayRecited:!!t.recited,todayPages:+t.pages||0,todayAtt:t.attendance||null,todayExists:t.session_exists==null?null:!!t.session_exists,todayStarted:t.session_started==null?null:!!t.session_started,todayRange:[...new Set((Array.isArray(t.ranges)?t.ranges:[]).map(rangeLabel).filter(Boolean))].join(' · ')||null,updatedAt:j.updated_at||null,id:s.id||null,planTitle:plan?(tath?'خطة التثبيت لهذا الشهر':'خطة هذا الشهر'):null,acts,
      planComplete:targeted.length>0&&targeted.every(a=>a.complete),monthMain:tath?(+m.tathbit||0):(+m.hifz||0),mainLabel:tath?'التثبيت':'الحفظ',
      present:+m.present||0,sessions:+m.sessions||0,quality:m.quality!=null?+m.quality:null,
      latest:(j.latest||[]).map(r=>({date:r.date,label:actLabel(r.activity,tath),range:rangeLabel(r)||'—',pages:+r.pages||0,quality:r.quality==null||isNaN(+r.quality)?null:+r.quality}))};
  }
  function praise(o){
    const out=[];
    if(o.planComplete)out.push(`أتمّ ${o.name} خطة هذا الشهر 🎉`);
    if(o.quality!=null&&o.quality>=90&&o.monthMain>0)out.push(`جودة تسميع ممتازة (${Math.round(o.quality)}٪)`);
    if(o.sessions>=4&&o.present===o.sessions)out.push('حضور كامل هذا الشهر');
    if(o.todayRecited&&o.todayPages>0)out.push('سمّع اليوم');
    return out;
  }
  function reportText(o,month,year){
    let t=`*تقرير شهر ${MONTHS[month-1]} ${year} — ${o.name}*\n`;
    const head=[o.track,o.sub].filter(Boolean).join(' · ');if(head)t+=head+'\n';
    t+=`\n• الحضور: ${o.present} من ${o.sessions} جلسة\n• ${o.mainLabel}: ${fm(o.monthMain)} صفحة\n`;
    if(o.quality!=null)t+=`• جودة التسميع: ${fm(o.quality)}٪\n`;
    const targeted=o.acts.filter(a=>a.has);
    if(targeted.length){t+=`\n*خطة الشهر${o.planTitle?` (${o.planTitle})`:''}*\n`;targeted.forEach(a=>{t+=`• ${a.label}: ${fm(a.done)} / ${fm(a.target)} ص (${fm(a.pct)}٪)${a.complete?' — أُنجزت ✅':` — المتبقي ${fm(a.remaining)} ص`}\n`})}
    const pr=praise(o).filter(x=>x!=='سمّع اليوم');if(pr.length){t+='\n';pr.forEach(x=>{t+=`✨ ${x}\n`})}
    if(o.latest.length){t+='\n*آخر التسميعات*\n';o.latest.slice(0,3).forEach(l=>{t+=`• ${l.date} — ${l.label}${l.range?`: ${l.range}`:''} (${fm(l.pages)} ص)\n`})}
    return t+'\nجزاكم الله خيرًا على متابعتكم.\n— حلقاتي';
  }
  // BadgeRules
  function badges(att,rec,today){
    const earned=[];
    let streak=0;for(const r of att.filter(x=>!x.c).sort((a,b)=>b.d.localeCompare(a.d))){if(r.s==='present'||r.s==='late')streak++;else if(r.s==='excused')continue;else break}
    const lv=(v,steps)=>steps.filter(x=>v>=x).length;
    const sl=lv(streak,[3,7,15]);if(sl)earned.push({key:'streak',title:'انتظام',detail:`${streak} جلسات متتالية`,level:sl});
    let q=0;for(const r of rec.filter(x=>!x.c).sort((a,b)=>b.d.localeCompare(a.d))){if(POOR.includes(String(r.e||'').toLowerCase()))break;q++}
    const ql=lv(q,[3,5,10]);if(ql)earned.push({key:'quality',title:'إتقان',detail:`${q} تسميعات متتالية بجودة`,level:ql});
    const from=addDays(today,-30),pages=rec.filter(x=>!x.c&&x.d>=from).reduce((s,x)=>s+x.p,0),pl=lv(pages,[10,30,60]);
    if(pl)earned.push({key:'pages',title:'اجتهاد',detail:`${Math.round(pages)} صفحة خلال 30 يومًا`,level:pl});
    const ns=[3,7,15].find(x=>x>streak);
    return {earned:earned.sort((a,b)=>b.level-a.level),next:ns?{title:'شارة الانتظام',remaining:ns-streak,unit:'جلسات متتالية'}:null};
  }
  const medal=l=>l===3?'🥇':l===2?'🥈':'🥉';
  const G={sel:null,children:null,raw:{},ov:{},bd:{},loading:true,stale:false,msg:null,busy:false};
  const gKey=sid=>'halaqati_gov2_'+(state.user?.id||'')+'_'+sid;
  const gCacheGet=sid=>{try{return JSON.parse(localStorage.getItem(gKey(sid))||'null')}catch(_e){return null}};
  const gCachePut=(sid,j)=>{try{localStorage.setItem(gKey(sid),JSON.stringify(j))}catch(_e){}};
  async function loadBadges(sid){
    if(!online())return null;
    const from=addDays(T0(),-90);
    const [a,r]=await Promise.all([db.from('attendance_records').select('status,sessions!inner(session_date,status)').eq('student_id',sid).gte('sessions.session_date',from).limit(300),
      db.from('recitation_entries').select('pages_count,evaluation,sessions!inner(session_date,status)').eq('student_id',sid).gte('sessions.session_date',from).limit(600)]);
    if(a.error||r.error)return null;
    return badges((a.data||[]).filter(o=>o.sessions).map(o=>({d:o.sessions.session_date,s:o.status,c:o.sessions.status==='cancelled'})),(r.data||[]).filter(o=>o.sessions).map(o=>({d:o.sessions.session_date,p:Number(o.pages_count)||0,e:o.evaluation,c:o.sessions.status==='cancelled'})),T0());
  }
  function badgeCard(sid){
    const res=G.bd[sid];if(!res||(!res.earned.length&&!res.next))return '';
    const open=I.open.badges??true;
    const body=res.earned.map(b=>`<div class="nh-badge"><span class="nh-medal">${medal(b.level)}</span><div><b>${h(b.title)}</b><small>${h(b.detail)}</small></div></div>`).join('')+(res.next?`<span class="nh-next">الهدف القادم: ${h(res.next.title)} — باقي ${res.next.remaining} ${res.next.unit}</span>`:'');
    return shell('success','MilitaryTech','شارات الإنجاز',res.earned.length?res.earned.map(b=>medal(b.level)+' '+b.title).join(' · '):'ابدأ سلسلة الحضور لتحصل على أول شارة',res.earned.length||null,open?body:'','badges',open);
  }
  const OV={};
  window.rc27ShareReport=function(sid){
    const o=OV[sid];if(!o)return;const d=new Date();sendText(reportText(o,d.getMonth()+1,d.getFullYear()),'');
  };
  const num=v=>fm(+v||0);
  const shortTime=iso=>{try{const d=new Date(iso);return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}catch(_e){return ''}};
  function todayCard(o){
    const att={present:'حضر اليوم',late:'حضر اليوم (متأخر)',absent:'غائب اليوم',excused:'غائب بعذر اليوم'}[o.todayAtt]||(o.todayAtt?`الحضور: ${o.todayAtt}`:(o.todayExists===false?'لا توجد جلسة مسجلة اليوم':o.todayStarted===false?'جلسة اليوم لم تبدأ بعد':'لم يُسجَّل الحضور بعد'));
    const kind=o.tath?'التثبيت':'التسميع',kicker=[o.track,o.sub].filter(Boolean).join(' · ');
    return `<section class="nh-today"><div class="nh-today-t"><span class="nh-today-k">${h(kicker)}</span><h2>${h(o.name)}</h2><b>${h(o.todayRecited?`${att} · أتمّ ${kind}`:att)}</b>${o.todayRecited?`${o.todayRange?`<span class="nh-today-r">${h(o.todayRange)}</span>`:''}<span class="nh-today-p">${o.tath?'تثبيت':'تسميع'} اليوم: ${num(o.todayPages)} صفحة</span>`:`<small>${o.tath?'لم يُسجَّل تثبيت اليوم بعد':'لم يُسجَّل تسميع اليوم بعد'}</small>`}</div><span class="nh-today-art">${NX.icon('FamilyRestroom',34)}</span></section>`;
  }
  function planCard(o){
    const rows=o.acts.length?o.acts.map(a=>`<div class="nh-act-row"><div class="nh-act-h"><b>${h(a.label)}</b><span>${a.has?`${num(a.done)} / ${num(a.target)} ص`:`${num(a.done)} ص`}</span></div>${a.has?`${NX.progress(a.pct)}<div class="nh-act-f"><span>${num(a.pct)}٪</span>${a.surplus>0.0001?`<em class="up">${NX.icon('TrendingUp',16)}+${num(a.surplus)} ص فوق الهدف</em>`:a.complete?'<em class="ok">مكتمل</em>':`<em>المتبقي ${num(a.remaining)} ص</em>`}</div>`:'<small>إنجاز مسجل · لم يحدد للخطة هدف سرد مستقل على هذا الخادم</small>'}</div>`).join(''):'<p class="nh-muted">لا توجد تفاصيل تقدم متاحة للخطة</p>';
    return `<section class="nh-plan"><div class="nh-plan-h"><div><b>${h(o.planTitle)}</b><small>${o.acts.length>1?'الحفظ والسرد محسوبان كلٌّ على حدة':'التقدم بحسب هدف هذا الشهر'}</small></div>${o.planComplete?NX.icon('CheckCircle',24):''}</div>${rows}</section>`;
  }
  function guardianHtml(){
    const kids=G.children||[],o=G.sel&&G.ov[G.sel];
    let top='';
    if(kids.length>1)top+=`<div class="nh-switch">${NX.chips(kids.map(k=>({label:h(String(k.full_name||'').trim().split(/\s+/)[0]||k.full_name),selected:k.id===G.sel,onclick:`rc27GSel('${k.id}')`})))}</div>`;
    if(G.stale&&o)top+=NX.notice('تعرض آخر بيانات محفوظة'+(o.updatedAt?' · '+shortTime(o.updatedAt):''),'warning');
    if(G.msg)top+=NX.notice(h(G.msg),'danger');
    let main='',side='';
    if(!o&&G.loading)main=NX.skeleton(3);
    else if(!o&&!kids.length)main=NX.empty('لا توجد ملفات طلاب مرتبطة بهذا الحساب',{icon:'FamilyRestroom'});
    else if(o){
      const pr=praise(o);
      main+=todayCard(o);
      if(pr.length)main+=shell('success','EmojiEvents',pr[0],pr.slice(1).join(' · ')||'بارك الله فيه وزاده حرصًا',null,'',null,null);
      if(o.planTitle)main+=planCard(o);
      main+=NX.metrics([NX.metric(o.mainLabel,num(o.monthMain)+' ص',{}),NX.metric('الحضور',`${o.present}/${o.sessions}`,{}),NX.metric('الجودة',o.quality!=null?num(o.quality)+'٪':'—',{})],3).replace('class="nx-metrics"','class="nx-metrics nh-gmetrics"');
      if(o.latest.length)main+=`<h3 class="nh-title m">آخر التسميعات</h3>`+o.latest.map(l=>`<div class="nh-rec"><div class="nh-rec-h"><b>${h(l.label)} · ${h(l.date)}</b><span>${num(l.pages)} ص${l.quality!=null?` · ${num(l.quality)}٪`:''}</span></div><small>${h(l.range)}</small></div>`).join('');
      side+=badgeCard(G.sel);
      if(I.seasons)side+=seasonsCard(false);
      side+=NX.btn('مشاركة تقرير الشهر',{kind:'outlined',icon:'Share',full:true,cls:'nh-wide',onclick:`rc27ShareReport('${G.sel}')`});
      side+=`<div class="nh-short">${NX.btn('ملف الابن',{kind:'outlined',full:true,onclick:`studentProfile('${G.sel}')`})}${NX.btn('الإنجاز',{kind:'outlined',full:true,onclick:"go('ranking')"})}${NX.btn('المنافسة',{kind:'outlined',full:true,onclick:"go('competition')"})}</div>`;
    }
    return `<div class="nh nh-g">${top?`<div class="nh-gtop">${top}</div>`:''}<div class="nh-gmain">${main}</div><div class="nh-gside">${side}</div></div>`;
  }
  function paintGuardian(){const box=document.getElementById('rc27GOv');if(box)box.innerHTML=guardianHtml()}
  window.rc27GSel=sid=>{if(G.sel===sid)return;G.sel=sid;G.msg=null;G.stale=false;paintGuardian();loadChild(sid)};
  async function loadChild(sid){
    const user=state.user?.id;
    if(!G.ov[sid]){const c=gCacheGet(sid);if(c){const o=parseOverview(c);if(o){G.ov[sid]=o;OV[sid]=o;G.stale=true}}}
    G.loading=!G.ov[sid];paintGuardian();
    let fresh=null;
    if(online()){
      try{const r=await db.rpc('guardian_child_overview',{p_student_id:sid});if(!r.error&&r.data){const o=parseOverview(r.data);if(o){fresh=o;gCachePut(sid,r.data)}}}catch(_e){}
    }
    if(user!==state.user?.id||G.sel!==sid)return;
    if(fresh){G.ov[sid]=fresh;OV[sid]=fresh;G.stale=false;G.msg=null}
    else{G.stale=true;if(!G.ov[sid]&&online())G.msg='تعذر تحميل بيانات الطالب'}
    G.loading=false;paintGuardian();
    try{const b=await loadBadges(sid);if(b&&G.sel===sid){G.bd[sid]=b;paintGuardian()}}catch(_e){}
    try{await loadSeasons(false);if(G.sel===sid)paintGuardian()}catch(_e){}
  }
  async function fillGuardian(){
    ensureOwner();const box=document.getElementById('rc27GOv');if(!box)return;
    if(G.owner!==state.user?.id){Object.assign(G,{sel:null,children:null,raw:{},ov:{},bd:{},loading:true,stale:false,msg:null,owner:state.user?.id})}
    const kids=(state.students||[]).filter(s=>s.status==='active').slice().sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'ar'));
    G.children=kids;
    if(!G.sel||!kids.some(k=>k.id===G.sel))G.sel=kids[0]?.id||null;
    if(!G.sel){G.loading=false;paintGuardian();return}
    paintGuardian();
    await loadChild(G.sel);
  }
  window.rc27FillGuardian=fillGuardian;
  if(typeof guardianHomePage==='function'){
    const base=guardianHomePage;
    guardianHomePage=function(){const r=base.apply(this,arguments);setTimeout(fillGuardian,0);return '<div id="rc27GOv" class="nh-gwrap">'+NX.skeleton(3)+'</div>'+(String(r).includes('rc27GuardianPrograms')?'<div id="rc27GuardianPrograms"></div>':'')};
  }
  // the guardian home re-renders through render(): refill after render when the container is still a skeleton
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){const r=await baseRender.apply(this,arguments);try{if(state.page==='home'&&role()==='guardian'){const b=document.getElementById('rc27GOv');if(b&&b.querySelector('.nx-skel'))setTimeout(fillGuardian,0)}}catch(_e){}return r};
  }
})();
