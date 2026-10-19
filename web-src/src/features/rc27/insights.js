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
  const SHELL={danger:['--st-bad-bg','--st-bad-fg'],warning:['--st-warn-bg','--st-warn-fg'],info:['--st-info-bg','--st-info-fg'],success:['--st-ok-bg','--st-ok-fg'],neutral:['--mint2','--muted']};
  function shell(kind,icon,title,summary,count,extra,key,open){
    const [bg,fg]=SHELL[kind]||SHELL.info;
    return `<div class="rc27-ins" style="background:var(${bg});color:var(${fg})" ${key?`onclick="rc27InsOpen('${key}')"`:''}><div class="rc27-ins-head"><span class="rc27-ins-ico">${icon}</span><div class="rc27-ins-t"><b>${h(title)}</b>${summary?`<small>${h(summary)}</small>`:''}</div>${count!=null?`<span class="rc27-ins-n">${count}</span>`:''}${open!=null?`<span class="rc27-ins-chev ${open?'up':''}">⌄</span>`:''}</div>${extra||''}</div>`;
  }
  const meter=(l,v)=>`<div class="rc27-meter"><div><span>${l}</span><b>${v==null?'—':v+'٪'}</b></div><i><u style="width:${v==null?0:v}%;background:${v==null?'var(--outline)':v>=75?'var(--green)':v>=50?'var(--gold)':'var(--danger)'}"></u></i></div>`;
  const chip=(on,fn,label)=>`<button type="button" class="rc27-chip ${on?'on':''}" onclick="event.stopPropagation();${fn}">${label}</button>`;
  window.rc27InsOpen=k=>{I.open[k]=!(I.open[k]??(k==='cmp'));if(role()==='guardian'){const b=document.getElementById('rc27GOv');if(b){fillGuardian();return}}render()};
  window.rc27InsSet=(k,v)=>{I[k]=v;if(k==='period'||k==='cat'){I.cmpAt=0;loadCmp(true)}render()};
  const rerender=()=>{if(state.page==='home'&&role()!=='guardian')render()};

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
    const rows=st.map((x,i)=>`<div class="rc27-cmp"><div class="rc27-cmp-h"><span class="rc27-cmp-n">${i+1}</span><div><b>${h(I.cmp.names[x.id]||(I.cat?'فئة':'حلقة'))}</b><small>${x.sessions>0?`${x.students} طالبًا · ${x.sessions} جلسات`:`${x.students} طالبًا · لا جلسات في هذه الفترة`}</small></div></div>${x.sessions>0?meter('الحضور',x.att)+meter('جودة التسميع',x.quality)+`<small>صفحات/طالب ${x.ppS.toFixed(1)} · حفظ ${x.hifz.toFixed(0)} ص · مراجعة وتثبيت وسرد ${x.rev.toFixed(0)} ص</small>`:''}</div>`).join('');
    const filters=`<div class="rc27-chips" style="margin-top:10px">${chip(!I.cat,"rc27InsSet('cat',false)",'الحلقات ككل')}${chip(I.cat,"rc27InsSet('cat',true)",'حسب الفئات')}</div><div class="rc27-chips" style="margin-top:6px">${PERIODS.map(p=>chip(I.period===p[0],`rc27InsSet('period','${p[0]}')`,p[1])).join('')}</div>`;
    return shell('neutral','🏅',I.cat?'مقارنة الفئات':'مقارنة الحلقات',`${label} · ${st.length}${I.cat?' فئات':' حلقات'}`,null,open?filters+(rows||'<div class="muted" style="margin-top:8px">لا بيانات في هذه الفترة</div>'):'','cmp',open);
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
      if(I.err)body+=`<div class="notice">${h(I.err)}</div>`;
      if(act){
        body+=`<div class="muted" style="margin-top:8px">${lvlAr(act.level)} · من ${h(String(act.start_date).slice(0,10))} إلى ${h(String(act.end_date).slice(0,10))}</div>`;
        if(manage&&!I.live.length)body+='<small>لا بيانات بعد في هذا الموسم</small>';
        body+=I.live.slice(0,5).map((x,i)=>`<div class="rc27-ins-row"><b>${i+1}</b><div><b>${h(x.name||'—')}</b></div><small>حضور ${x.st.att!=null?x.st.att+'٪':'—'} · جودة ${x.st.quality!=null?x.st.quality+'٪':'—'}</small></div>`).join('');
        if(manage)body+=`<button class="mini" onclick="event.stopPropagation();rc27SeasonEnd()">إنهاء الموسم وحفظ النتائج</button>`;
      }else if(manage)body+=`<button class="btn btn-primary" style="margin-top:10px" onclick="event.stopPropagation();rc27SeasonNew()">موسم جديد</button>`;
      if(closed.length){
        body+='<div class="rc27-grp" style="margin-top:10px">مواسم سابقة</div>';
        closed.forEach((c,i)=>{const w=Array.isArray(c.winners)?c.winners:[],nm=k=>w[k]?.name;
          body+=`<small style="display:block">${h(c.name)}${nm(0)?` — الأول: ${h(nm(0))}`:''}${nm(1)?` · الثاني: ${h(nm(1))}`:''}${nm(2)?` · الثالث: ${h(nm(2))}`:''}</small>`;
          if(i===0&&nm(0))body+=`<button class="mini" onclick="event.stopPropagation();rc27SeasonShare('${c.id}')">مشاركة التهنئة</button>`});
      }
    }
    return shell('info','🏆','المواسم والمسابقات',summary,null,body,'seasons',open);
  }
  function dlg(html){const d=document.getElementById('rc27Dlg')||(()=>{const x=document.createElement('dialog');x.id='rc27Dlg';x.className='rc27-dlg';document.body.appendChild(x);return x})();d.innerHTML=html;if(!d.open)d.showModal();return d}
  window.rc27SeasonNew=function(){
    dlg(`<div class="card"><h3>موسم جديد</h3><label class="field"><span>اسم الموسم</span><input id="rc27SeName" class="input"></label><div class="rc27-grp">المستوى</div><div class="rc27-chips"><label><input type="radio" name="rc27SeLvl" value="halaqa" checked> الحلقات ككل</label><label><input type="radio" name="rc27SeLvl" value="category"> حسب الفئات</label></div><label class="field"><span>المدة</span><select id="rc27SeDays" class="input">${DURATIONS.map(d=>`<option value="${d[0]}" ${d[0]===30?'selected':''}>${d[1]}</option>`).join('')}</select></label><div class="actions"><button class="btn btn-primary" onclick="rc27SeasonCreate()">ابدأ الموسم</button><button class="btn btn-ghost" onclick="rc27CloseDlg()">إلغاء</button></div></div>`);
  };
  window.rc27SeasonCreate=async function(){
    const name=(document.getElementById('rc27SeName').value||'').trim(),days=+document.getElementById('rc27SeDays').value,level=document.querySelector('input[name=rc27SeLvl]:checked')?.value||'halaqa';
    if(name.length<2)return toast('اكتب اسم الموسم');
    if(!canManageSeasons())return;
    const r=await db.from('competition_seasons').insert({name,level,start_date:T0(),end_date:addDays(T0(),days),status:'active'});
    if(r.error){I.err=r.error.message||'تعذر إنشاء الموسم';toast(I.err)}else I.err=null;
    rc27CloseDlg();await loadSeasons(true);render();
  };
  window.rc27SeasonEnd=function(){
    const act=(I.seasons||[]).find(s=>s.status==='active');if(!act)return;
    dlg(`<div class="card"><h3>إنهاء الموسم</h3><p>سيُحفظ الترتيب الحالي كنتيجة نهائية لموسم «${h(act.name)}» ويُغلق الموسم.</p><div class="actions"><button class="btn btn-primary" onclick="rc27SeasonClose('${act.id}')">إنهاء وحفظ</button><button class="btn btn-ghost" onclick="rc27CloseDlg()">إلغاء</button></div></div>`);
  };
  window.rc27SeasonClose=async function(id){
    if(!canManageSeasons())return;
    const act=(I.seasons||[]).find(x=>x.id===id&&x.status==='active');if(!act)return;
    let computed;try{computed=await compareGroups(String(act.start_date).slice(0,10),String(act.end_date).slice(0,10)<T0()?String(act.end_date).slice(0,10):T0(),act.level==='category')}catch(e){return toast('لم تُحفظ النتائج: '+e.message)}
    if(!computed)return toast('لا تتوفر بيانات مكتملة لحفظ نتائج الموسم');
    const winners=rank(computed.stats).map((x,i)=>({rank:i+1,name:computed.names[x.id]||'',group_id:x.id,attendance:x.att,quality:x.quality,pages_per_student:x.ppS}));
    const r=await db.from('competition_seasons').update({status:'closed',closed_at:new Date().toISOString(),winners}).eq('id',id);
    if(r.error){I.err=r.error.message||'تعذر إنهاء الموسم';toast(I.err)}else I.err=null;
    rc27CloseDlg();await loadSeasons(true);render();
  };
  window.rc27SeasonShare=function(id){
    const c=(I.seasons||[]).find(s=>s.id===id);if(!c)return;const w=Array.isArray(c.winners)?c.winners:[],medals=['🥇','🥈','🥉'];
    let t=`🏆 *نتائج مسابقة ${c.name}*\n${lvlAr(c.level)}\nمن ${String(c.start_date).slice(0,10)} إلى ${String(c.end_date).slice(0,10)}\n\n`;
    w.slice(0,3).forEach((x,i)=>{t+=`${medals[i]} ${x.name}${x.attendance!=null?` — حضور ${x.attendance}٪`:''}${x.quality!=null?` · جودة ${x.quality}٪`:''}\n`});
    t+='\nمبارك للفائزين، وبارك الله في جهود الجميع.\n— حلقاتي';sendText(t,'');
  };

  // ---------- home cards (admin / supervisor / teacher) ----------
  function cards(r){
    const out=[];
    if(I.inactive&&I.inactive.length){
      const open=!!I.open.inactive,rows=I.inactive.slice(0,15).map(x=>`<div class="rc27-ins-row"><div><b>${h(x.name)}</b><small>${x.days!=null?`آخر تسميع قبل ${x.days} يومًا`:'لا تسميع خلال آخر 45 يومًا'}</small></div><button class="mini" onclick="event.stopPropagation();rc27InactiveMsg('${x.sid}')">رسالة للولي</button></div>`).join('');
      const names=I.inactive.slice(0,4).map(x=>x.name).join('، ')+(I.inactive.length>4?' …':'');
      out.push(shell('warning','⏳','طلاب لم يسمّعوا منذ فترة',open?'لم يُسجَّل لهم تسميع منذ 14 يومًا فأكثر':names,I.inactive.length,open?rows:'','inactive',open));
    }
    ensureOwner();if(r==='admin'||r==='supervisor'){out.push(cmpCard());out.push(seasonsCard(true))}else if(r==='teacher')out.push(seasonsCard(false));
    return out.join('');
  }
  window.RC27Insights={cards,load(){ensureOwner();loadInactive();loadSeasons(false);if(role()==='admin'||role()==='supervisor')loadCmp(false)},compareGroups};

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
    acts.forEach(a=>{a.has=a.target>0.0001;a.pct=a.has?Math.min(100,a.done*100/a.target):0;a.remaining=a.has?Math.max(0,a.target-a.done):0;a.complete=a.has&&a.done+0.0001>=a.target});
    const targeted=acts.filter(a=>a.has);
    return {name:s.full_name||'طالب',tath,track:tath?'التثبيت':'الحفظ العام',sub:[s.halaqa_name,s.category_name].filter(Boolean).join(' · '),
      todayRecited:!!t.recited,todayPages:+t.pages||0,planTitle:plan?(tath?'خطة التثبيت لهذا الشهر':'خطة هذا الشهر'):null,acts,
      planComplete:targeted.length>0&&targeted.every(a=>a.complete),monthMain:tath?(+m.tathbit||0):(+m.hifz||0),mainLabel:tath?'التثبيت':'الحفظ',
      present:+m.present||0,sessions:+m.sessions||0,quality:m.quality!=null?+m.quality:null,
      latest:(j.latest||[]).map(r=>({date:r.date,label:actLabel(r.activity,tath),range:rangeLabel(r),pages:+r.pages||0}))};
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
  async function badgeCard(sid){
    if(!online())return '';
    const from=addDays(T0(),-90);
    const [a,r]=await Promise.all([db.from('attendance_records').select('status,sessions!inner(session_date,status)').eq('student_id',sid).gte('sessions.session_date',from).limit(300),
      db.from('recitation_entries').select('pages_count,evaluation,sessions!inner(session_date,status)').eq('student_id',sid).gte('sessions.session_date',from).limit(600)]);
    if(a.error||r.error)return '';
    const res=badges((a.data||[]).filter(o=>o.sessions).map(o=>({d:o.sessions.session_date,s:o.status,c:o.sessions.status==='cancelled'})),(r.data||[]).filter(o=>o.sessions).map(o=>({d:o.sessions.session_date,p:Number(o.pages_count)||0,e:o.evaluation,c:o.sessions.status==='cancelled'})),T0());
    if(!res.earned.length&&!res.next)return '';
    const body=res.earned.map(b=>`<div class="rc27-ins-row"><span style="font-size:22px">${medal(b.level)}</span><div><b>${h(b.title)}</b><small>${h(b.detail)}</small></div></div>`).join('')+(res.next?`<small style="display:block;margin-top:8px">الهدف القادم: ${h(res.next.title)} — باقي ${res.next.remaining} ${res.next.unit}</small>`:'');
    return shell('success','🎖','شارات الإنجاز',res.earned.length?res.earned.map(b=>medal(b.level)+' '+b.title).join(' · '):'ابدأ سلسلة الحضور لتحصل على أول شارة',res.earned.length||null,body,null,null);
  }
  const OV={};
  window.rc27ShareReport=function(sid){
    const o=OV[sid];if(!o)return;const d=new Date();sendText(reportText(o,d.getMonth()+1,d.getFullYear()),'');
  };
  async function fillGuardian(){
    ensureOwner();const user=state.user?.id;
    const box=document.getElementById('rc27GOv');if(!box)return;
    try{
      let html='';
      for(const st of (state.students||[]).filter(s=>s.status!=='withdrawn')){
        if(!online())break;
        const r=await db.rpc('guardian_child_overview',{p_student_id:st.id});if(r.error||!r.data)continue;
        const o=parseOverview(r.data);if(!o)continue;OV[st.id]=o;
        const pr=praise(o);
        html+=`<div class="section-head"><h3>${h(o.name)}</h3></div>`;
        if(pr.length)html+=shell('success','🏆',pr[0],pr.slice(1).join(' · ')||'بارك الله فيه وزاده حرصًا',null,'',null,null);
        if(o.acts.some(a=>a.has))html+=`<div class="card"><b>${h(o.planTitle||'خطة هذا الشهر')}</b>${o.acts.filter(a=>a.has).map(a=>`<div class="plan-bar"><div class="plan-label"><span>${h(a.label)}: ${fm(a.done)} / ${fm(a.target)} ص${a.complete?' ✅':` · المتبقي ${fm(a.remaining)}`}</span><b>${Math.round(a.pct)}%</b></div><div class="progress"><i style="width:${a.pct}%"></i></div></div>`).join('')}</div>`;
        html+=await badgeCard(st.id);
        html+=`<button class="btn btn-ghost rc27-wide" onclick="rc27ShareReport('${st.id}')">مشاركة تقرير الشهر</button>`;
      }
      await loadSeasons(true);
      if(I.seasons)html+=seasonsCard(false);
      if(user===state.user?.id&&box.isConnected)box.innerHTML=html;
    }catch(e){console.warn('rc27 guardian insights',e)}
  }
  window.rc27FillGuardian=fillGuardian;
  if(typeof guardianHomePage==='function'){
    const base=guardianHomePage;
    guardianHomePage=function(){const r=base.apply(this,arguments);setTimeout(fillGuardian,0);return '<div id="rc27GOv"></div>'+r};
  }
  // guardian seasons card toggles through render(): refill after render
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){const r=await baseRender.apply(this,arguments);try{if(state.page==='home'&&role()==='guardian'&&document.getElementById('rc27GOv')&&!document.getElementById('rc27GOv').innerHTML)setTimeout(fillGuardian,0)}catch(_e){}return r};
  }
})();
