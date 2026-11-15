/* Halaqati web 2.89.3 — native RC53–RC56 ported: supervisor interface (operations room, halaqat, read-only sessions, visits),
   staff monitor (teachers / supervisors / comparison), teacher alerts, role welcome card, support details, offline strip. */
(function(){
  'use strict';
  const R=window.RC50;if(!R)return;
  const e=R.e,S3=R.s3={open:null,tabv:'teachers',metricv:'commit',visit:null,sendBusy:false};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayS=()=>typeof today==='function'?today():iso(new Date());
  const role=()=>state?.profile?.role;
  const num1=v=>{const n=Number(v)||0;return Math.abs(n-Math.round(n))<1e-9?String(Math.round(n)):n.toFixed(1)};
  const daysSince=d=>{if(!d)return null;const a=new Date(String(d).slice(0,10)+'T00:00:00'),b=new Date(todayS()+'T00:00:00');return Math.round((b-a)/86400000)};
  const val=v=>v==null||v==='null'?'':String(v);

  // ---------- verses / hadith / kind words by role (same texts as the native app) ----------
  const PH={
    teacher:[['«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»','رواه البخاري'],['﴿وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ﴾','سورة القمر ١٧'],['«اقْرَؤُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ»','رواه مسلم'],['﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾','سورة المزمل ٤'],['«مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ بِهِ حَسَنَةٌ، وَالْحَسَنَةُ بِعَشْرِ أَمْثَالِهَا»','رواه الترمذي'],['«الْمَاهِرُ بِالْقُرْآنِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ»','متفق عليه'],['«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ»','رواه مسلم'],['﴿إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ﴾','سورة الإسراء ٩'],['بارك الله في جهدك، كل آية تُسمّعها أثرٌ يبقى في صدر طالب.','كلمة طيبة'],['الصبر على الطالب الصغير اليوم يصنع حافظًا كبيرًا غدًا.','كلمة طيبة']],
    supervisor:[['﴿وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ﴾','سورة التوبة ١٠٥'],['«كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْئُولٌ عَنْ رَعِيَّتِهِ»','متفق عليه'],['«الدِّينُ النَّصِيحَةُ»','رواه مسلم'],['﴿وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ﴾','سورة المائدة ٢'],['«إِنَّ اللَّهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلًا أَنْ يُتْقِنَهُ»','رواه البيهقي'],['«الْمُؤْمِنُ لِلْمُؤْمِنِ كَالْبُنْيَانِ يَشُدُّ بَعْضُهُ بَعْضًا»','متفق عليه'],['المتابعة الهادئة والكلمة الطيبة تصنعان محفّظًا مطمئنًا وحلقة ناجحة.','كلمة طيبة'],['زيارة قصيرة اليوم قد تحلّ مشكلة قبل أن تكبر.','كلمة طيبة']],
    admin:[['﴿إِنَّ اللَّهَ يَأْمُرُكُمْ أَن تُؤَدُّوا الْأَمَانَاتِ إِلَىٰ أَهْلِهَا﴾','سورة النساء ٥٨'],['﴿وَشَاوِرْهُمْ فِي الْأَمْرِ فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ﴾','سورة آل عمران ١٥٩'],['«إِنَّ اللَّهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلًا أَنْ يُتْقِنَهُ»','رواه البيهقي'],['«مَنْ لَا يَشْكُرِ النَّاسَ لَا يَشْكُرِ اللَّهَ»','رواه أبو داود والترمذي'],['«كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْئُولٌ عَنْ رَعِيَّتِهِ»','متفق عليه'],['«أَحَبُّ النَّاسِ إِلَى اللَّهِ أَنْفَعُهُمْ لِلنَّاسِ»','رواه الطبراني'],['إدارة الحلقات أمانة، وبالمتابعة والتنظيم يكبر الأثر.','كلمة طيبة'],['القرار الهادئ المبني على الأرقام يوفّر على الجميع وقتًا وجهدًا.','كلمة طيبة']],
    observer:[['﴿وَمَا أَنفَقْتُم مِّن شَيْءٍ فَهُوَ يُخْلِفُهُ ۖ وَهُوَ خَيْرُ الرَّازِقِينَ﴾','سورة سبأ ٣٩'],['«مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ»','رواه مسلم'],['«الدَّالُّ عَلَى الْخَيْرِ كَفَاعِلِهِ»','رواه الترمذي'],['«إِذَا مَاتَ ابْنُ آدَمَ انْقَطَعَ عَمَلُهُ إِلَّا مِنْ ثَلَاثٍ: صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ»','رواه مسلم'],['﴿مَّن ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا فَيُضَاعِفَهُ لَهُ أَضْعَافًا كَثِيرَةً﴾','سورة البقرة ٢٤٥'],['«أَحَبُّ النَّاسِ إِلَى اللَّهِ أَنْفَعُهُمْ لِلنَّاسِ»','رواه الطبراني'],['جزاك الله خيرًا؛ دعمك يصل إلى حلقة تُحفَّظ فيها آيات كتاب الله.','كلمة طيبة'],['ما تدعمه اليوم يبقى أثره في صدور الحفظة غدًا بإذن الله.','كلمة طيبة']],
    guardian:[['﴿وَالَّذِينَ يَقُولُونَ رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ﴾','سورة الفرقان ٧٤'],['«مَنْ قَرَأَ الْقُرْآنَ وَعَمِلَ بِمَا فِيهِ أُلْبِسَ وَالِدَاهُ تَاجًا يَوْمَ الْقِيَامَةِ»','رواه أبو داود'],['﴿وَأْمُرْ أَهْلَكَ بِالصَّلَاةِ وَاصْطَبِرْ عَلَيْهَا﴾','سورة طه ١٣٢'],['«خَيْرُكُمْ خَيْرُكُمْ لِأَهْلِهِ»','رواه الترمذي'],['«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»','رواه البخاري'],['﴿يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا﴾','سورة التحريم ٦'],['كلمة تشجيع منك الليلة تضيف إلى حفظ ابنك أكثر مما تتصور.','كلمة طيبة'],['المراجعة اليومية القصيرة أثبتُ من الحفظ الطويل المتقطع.','كلمة طيبة']]
  };
  R.PH=PH;
  const greeting=()=>{const h=new Date().getHours();return h>=4&&h<=11?'صباح الخير':h<=16&&h>=12?'نهارك مبارك':h>=17&&h<=20?'مساء الخير':'ليلة مباركة'};
  R.welcome=(detail)=>{
    const list=PH[role()]||PH.teacher,day=Math.floor(Date.now()/86400000),p=list[day%list.length];
    if(role()==='supervisor')return window.SupervisorUI.welcome({greeting:greeting(),name:state.profile?.full_name,avatar:R.avatar?R.avatar(R.myPhoto?.(),state.profile?.full_name,56):'',quote:p[0],source:p[1]},e);
    return `<section class="s3-welcome"><small>${e(greeting())}</small><b>${e(p[0])}</b><span>${e(p[1])}</span>${detail?`<p>${e(detail)}</p>`:''}</section>`;
  };
  const baseHome=window.homePage;
  if(typeof baseHome==='function')window.homePage=function(){
    const r=baseHome.apply(this,arguments);
    if(typeof r!=='string'||['supervisor','admin','teacher'].includes(role()))return r;/* RC86: greeting + verse live inside the day card */
    return R.welcome()+r;
  };

  // ---------- offline-first visits (browser queue; the native app keeps its own outbox) ----------
  const VQ='rc53_visit_queue';
  const vqGet=()=>{try{return JSON.parse(localStorage.getItem(VQ)||'[]')}catch(_e){return[]}};
  const vqSet=a=>{try{localStorage.setItem(VQ,JSON.stringify(a))}catch(_e){}};
  const uuid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});
  const isNet=err=>!navigator.onLine||/fetch|network|failed to|timeout|load failed/i.test(String(err&&(err.message||err)));
  async function vqFlush(){
    if(!navigator.onLine||typeof db==='undefined')return;
    const q=vqGet();if(!q.length)return;
    const rest=[];let blocked=false;
    for(const op of q){
      if(blocked){rest.push(op);continue}
      try{
        let r;
        if(op.t==='ins')r=await db.from('supervisor_visits').upsert(op.row,{onConflict:'id'});
        else if(op.t==='upd')r=await db.from('supervisor_visits').update(op.row).eq('id',op.id);
        else r=await db.from('supervisor_visits').delete().eq('id',op.id);
        if(r.error)throw r.error;
      }catch(err){if(isNet(err)){blocked=true;rest.push(op)}/* a permanent error drops the operation */}
    }
    vqSet(rest);if(rest.length!==q.length){B.at=0;try{if(['visits','supervision','home'].includes(state.page))render()}catch(_e){}}
  }
  window.addEventListener('online',()=>setTimeout(vqFlush,800));
  setInterval(()=>{if(['admin','supervisor'].includes(role()))vqFlush()},30000);
  function applyQ(list){
    const rows=new Map(list.map(v=>[v.id,{...v}])),pend=new Set();
    vqGet().forEach(op=>{
      if(op.t==='ins'){rows.set(op.row.id,{...(rows.get(op.row.id)||{}),...op.row});pend.add(op.row.id)}
      else if(op.t==='upd'&&rows.has(op.id)){Object.assign(rows.get(op.id),op.row);pend.add(op.id)}
      else if(op.t==='del'){rows.delete(op.id);pend.delete(op.id)}
    });
    pend.forEach(id=>{if(rows.has(id))rows.get(id)._pending=true});
    return [...rows.values()].sort((a,b)=>String(b.visit_date||'').localeCompare(String(a.visit_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
  }
  function enqueue(op){
    const q=vqGet();
    if(op.t==='upd'){const ins=q.find(x=>x.t==='ins'&&x.row.id===op.id);if(ins){Object.assign(ins.row,op.row);vqSet(q);return}}
    if(op.t==='del'){const k=q.findIndex(x=>x.t==='ins'&&x.row.id===op.id);if(k>=0){q.splice(k,1);vqSet(q.filter(x=>!(x.id===op.id)));return}}
    q.push(op);vqSet(q);
  }

  // ---------- data ----------
  const B={at:0,data:null};
  const ok=r=>{if(r&&r.error)throw r.error;return (r&&r.data)||[]};
  // A daily session is finished once its day has passed, even if nobody pressed «إنهاء الجلسة».
  const finished=s=>s.status==='open'&&String(s.session_date)<todayS()?{...s,status:'closed',autoClosed:true}:s;
  // PostgREST caps a response at 1000 rows, so fetch by small groups of sessions instead of one big request
  async function fetchBy(table,cols,col,ids,size=15){
    const out=[];for(let i=0;i<ids.length;i+=size){const r=await db.from(table).select(cols).in(col,ids.slice(i,i+size)).limit(1000);out.push(...ok(r))}
    return out;
  }
  async function staffProfiles(){
    let r=await db.from('profiles').select('id,full_name,role,phone,avatar_path,frozen').in('role',['teacher','supervisor']).order('full_name').limit(500);
    if(r.error)r=await db.from('profiles').select('id,full_name,role,phone').in('role',['teacher','supervisor']).order('full_name').limit(500);
    return ok(r);
  }
  async function load(force){
    if(!force&&B.data&&Date.now()-B.at<20000)return B.data;
    if(typeof db==='undefined')throw new Error('لا يوجد اتصال بالخادم');
    const td=todayS(),ms=td.slice(0,8)+'01';
    await vqFlush();
    const [hq0,links,staff,sess0,visits0,supLinks]=await Promise.all([
      db.from('halaqas').select('id,name,active,halaqa_type,supervisor_id,logo_path').eq('active',true).order('name').limit(200).then(ok),
      db.from('halaqa_teachers').select('halaqa_id,teacher_id').limit(1000).then(ok),
      staffProfiles(),
      db.from('sessions').select('id,halaqa_id,session_date,status,created_by').gte('session_date',ms).neq('status','cancelled').order('session_date',{ascending:false}).limit(1500).then(ok),
      db.from('supervisor_visits').select('*').order('visit_date',{ascending:false}).limit(300).then(ok),
      db.from('halaqa_supervisors').select('halaqa_id,supervisor_id').limit(2000).then(r=>r&&r.error?[]:ok(r))]);
    // Source of truth for «my halaqas»: halaqa_supervisors links plus halaqas.supervisor_id. The administrator sees all.
    const me=state.user?.id,mineIds=new Set([...supLinks.filter(l=>l.supervisor_id===me).map(l=>l.halaqa_id),...hq0.filter(h=>h.supervisor_id===me).map(h=>h.id)]);
    const hq=role()==='supervisor'?hq0.filter(h=>mineIds.has(h.id)):hq0,scopeIds=new Set(hq.map(h=>h.id));
    const sess=sess0.filter(s=>role()!=='supervisor'||scopeIds.has(s.halaqa_id)).map(finished);
    const visitsAll=applyQ(visits0),visits=role()==='supervisor'?visitsAll.filter(v=>scopeIds.has(v.halaqa_id)||v.supervisor_id===me):visitsAll;
    const todayS_=sess.filter(s=>s.session_date===td),ids=todayS_.map(s=>s.id);
    const [att,rec]=ids.length?await Promise.all([
      db.from('attendance_records').select('session_id,student_id,status').in('session_id',ids).limit(3000).then(ok),
      db.from('recitation_entries').select('session_id,student_id').in('session_id',ids).limit(4000).then(ok)]):[[],[]];
    let ov=null;try{ov=await R.rpc('rc53_staff_overview',{p_from:ms,p_to:td})}catch(_e){ov=null}
    const by={};staff.forEach(p=>by[p.id]=p);
    const stu=(state.students||[]).filter(s=>s.status==='active');
    const sh={};todayS_.forEach(s=>sh[s.id]=s.halaqa_id);
    const isProg=h=>{const t=val(h.halaqa_type);return !!t&&t!=='regular'};
    const progIds=hq.filter(isProg).map(h=>h.id),mem={};
    if(progIds.length){try{const r=await db.from('student_halaqa_memberships').select('halaqa_id,student_id,status').in('halaqa_id',progIds).eq('status','active');(r.data||[]).forEach(m=>{mem[m.halaqa_id]=(mem[m.halaqa_id]||0)+1})}catch(_e){}}
    const mkRow=h=>{
      const tids=[...new Set(links.filter(l=>l.halaqa_id===h.id).map(l=>l.teacher_id))];
      const mine=todayS_.filter(s=>s.halaqa_id===h.id),sid=new Set(mine.map(s=>s.id));
      const state_=!mine.length?'none':mine.every(s=>s.status==='closed')?'closed':'open';
      const a=att.filter(x=>sid.has(x.session_id));
      const lastV=visits.find(v=>v.halaqa_id===h.id),sc=lastV?['organization_score','teaching_score','followup_score'].filter(k=>lastV[k]!=null).map(k=>+lastV[k]):[];
      const prog=isProg(h),monthS=sess.filter(s=>s.halaqa_id===h.id);
      return {id:h.id,logo:h.logo_path||null,supervisor_id:h.supervisor_id||null,name:h.name||(prog?'برنامج':'حلقة'),prog,kind:prog?((window.RC27_TYPE_AR||{})[h.halaqa_type]||'برنامج'):'حلقة',starts:h.starts_on||null,ends:h.ends_on||null,last:monthS.map(s=>s.session_date).sort().pop()||null,tids,names:tids.map(i=>by[i]?.full_name||'محفّظ'),students:prog?(mem[h.id]||0):stu.filter(s=>s.halaqa_id===h.id).length,state:state_,
        present:a.filter(x=>x.status==='present'||x.status==='late').length,absent:a.filter(x=>x.status==='absent').length,excused:a.filter(x=>x.status==='excused').length,
        recited:new Set(rec.filter(x=>sh[x.session_id]===h.id).map(x=>x.student_id)).size,monthSessions:sess.filter(s=>s.halaqa_id===h.id).length,
        lastVisit:lastV?.visit_date||null,lastScore:sc.length?sc.reduce((x,y)=>x+y,0)/sc.length:null};
    };
    const allRows=hq.map(mkRow),halaqas=allRows.filter(h=>!h.prog),programs=allRows.filter(h=>h.prog);
    const mDays=new Set(sess.map(s=>s.session_date)).size,byC={};
    sess.forEach(s=>{const o=byC[s.created_by]=byC[s.created_by]||{n:0,d:new Set,c:0,last:''};o.n++;o.d.add(s.session_date);if(s.status==='closed')o.c++;if(s.session_date>o.last)o.last=s.session_date});
    // Nour: day off = no session today in my halaqat, none on earlier same weekdays this month, but sessions exist on other days.
    const myIds_=new Set(halaqas.map(h=>h.id)),mine_=sess.filter(x=>myIds_.has(x.halaqa_id)),wd_=d=>new Date(d+'T12:00:00').getDay(),
      hasEarlier_=(()=>{const t=new Date(td+'T12:00:00');t.setDate(t.getDate()-7);return t.toISOString().slice(0,10)>=ms})();
    const offDay=!mine_.some(x=>x.session_date===td)&&!mine_.some(x=>wd_(x.session_date)===wd_(td))&&hasEarlier_&&mine_.length>0;
    B.data={offDay,halaqas,programs,all:allRows,visits,myVisits:visits.filter(v=>v.supervisor_id===me),supLinks,staff,byC,mDays,sess:sess.map(x=>({halaqa_id:x.halaqa_id,session_date:x.session_date,status:x.status,created_by:x.created_by,id:x.id})),ov:ov?Object.fromEntries(ov.map(x=>[x.id,x])):{},links};B.at=Date.now();return B.data;
  }
  const stLabel={none:'لم تبدأ الجلسة',open:'الجلسة جارية',closed:'انتهت الجلسة'};
  const rate=(a,b)=>b<=0?0:Math.min(100,Math.round(a*100/b));

  // ---------- supervisor halaqa card ----------
  const hCard=(h,detailed)=>{
    const off=!!B.data?.offDay&&h.state==='none';return window.SupervisorUI.halaqaCard(off?Object.assign({},h,{state:'off'}):h,{detailed,daysSince,formatNumber:num1,escape:e,labels:Object.assign({off:'اليوم إجازة'},stLabel)});
  };

  // ---------- supervisor home: operations room ----------
  const donorHome=R.pages.home;
  const supHome=async()=>{
    const d=await load(false),ns=d.offDay?[]:d.halaqas.filter(h=>h.state==='none'),started=d.halaqas.length-d.halaqas.filter(h=>h.state==='none').length;
    const stale=d.halaqas.filter(h=>(daysSince(h.lastVisit)??999)>14),open=(d.myVisits||d.visits).filter(v=>val(v.action_items)&&!v.action_done).length;
    const wk=(d.myVisits||d.visits).filter(v=>(daysSince(v.visit_date)??999)<=7).length;
    return window.SupervisorUI.dashboard({programs:d.programs,halaqas:d.halaqas,pending:ns,stale,started,weekVisits:wk,openActions:open,welcome:R.welcome()},{escape:e,renderCircle:h=>hCard(h,false)});
  };
  R.pages.home={title:'الرئيسية',roles:[...(donorHome?.roles||['observer']),'supervisor'],render:async()=>role()==='supervisor'?supHome():(R.welcome()+await donorHome.render()),after:donorHome?.after};

  // ---------- supervisor halaqat (read-only) ----------
  R.page('halaqas',{title:'الحلقات',roles:['supervisor'],render:async()=>{const d=await load(false);return d.halaqas.map(h=>hCard(h,true)).join('')||R.card(R.empty('لا توجد حلقات مسندة إليك'))}});

  // ---------- supervisor sessions (read-only) ----------
  S3.sdays=10;S3.sf='all';
  S3.sesDays=n=>{S3.sdays=n;render()};S3.sesF=v=>{S3.sf=v;render()};
  R.page('sessions',{title:'الجلسات اليومية',roles:['supervisor'],render:async()=>{
    const since=new Date();since.setDate(since.getDate()-S3.sdays);
    const d=await load(false),hq=Object.fromEntries(d.all.map(h=>[h.id,h])),stf=Object.fromEntries(d.staff.map(p=>[p.id,p.full_name]));
    const mineIds=d.all.map(h=>h.id);
    const raw=mineIds.length?ok(await db.from('sessions').select('id,halaqa_id,session_date,status,session_type,created_by').in('halaqa_id',mineIds).gte('session_date',iso(since)).neq('status','cancelled').order('session_date',{ascending:false}).limit(600)):[];
    const ses=[...new Map(raw.map(x=>[x.id,finished(x)])).values()];
    const ids=ses.map(s=>s.id),[att,rec]=ids.length?await Promise.all([fetchBy('attendance_records','session_id,student_id,status','session_id',ids),fetchBy('recitation_entries','session_id,student_id','session_id',ids)]):[[],[]];
    const U=window.SupervisorUI,td=todayS(),wd=x=>new Date(x+'T12:00:00').getDay(),studyWd=new Set(ses.map(s=>wd(s.session_date)));
    const f=S3.sf,reg_=d.halaqas.filter(h=>f==='all'||h.id===f),shown=ses.filter(s=>reg_.some(h=>h.id===s.halaqa_id));
    const week=shown.filter(s=>(daysSince(s.session_date)??99)<=6).length,missToday=d.offDay?0:reg_.filter(h=>!shown.some(s=>s.halaqa_id===h.id&&s.session_date===td)).length;
    const lowRec=shown.filter(s=>{const a=att.filter(x=>x.session_id===s.id&&(x.status==='present'||x.status==='late')).length,r=new Set(rec.filter(x=>x.session_id===s.id).map(x=>x.student_id)).size;return a>=10&&r*100<a*30}).length;
    const stat=(l,v)=>`<div class="sv-stat" style="cursor:default"><strong><bdi>${e(v)}</bdi></strong><span>${l}</span></div>`;
    const head=`<div class="sv-stats">${stat('جلسات هذا الأسبوع',week)}${stat('لم تبدأ اليوم',d.offDay?'إجازة':missToday)}${stat('تسميع منخفض',lowRec)}</div>`;
    const chips=d.halaqas.length>1?`<div class="dn-pills-row"><div class="dn-pills"><button type="button" class="${f==='all'?'on':''}" onclick="RC50.s3.sesF('all')">الكل</button>${d.halaqas.map(h=>`<button type="button" class="${f===h.id?'on':''}" onclick="RC50.s3.sesF('${e(h.id)}')">${e(h.name)}</button>`).join('')}</div></div>`:'';
    const card=s=>{const a=att.filter(x=>x.session_id===s.id),h=hq[s.halaqa_id]||{};
      return U.sessionCard(s,{e,halaqa:h.name||'حلقة',logo:h.logo,teacher:(h.names||[]).join('، ')||stf[s.created_by]||'—',present:a.filter(x=>x.status==='present'||x.status==='late').length,absent:a.filter(x=>x.status==='absent').length,excused:a.filter(x=>x.status==='excused').length,recited:new Set(rec.filter(x=>x.session_id===s.id).map(x=>x.student_id)).size})};
    const days=[];for(let i=0;i<=S3.sdays;i++){const t=new Date(td+'T12:00:00');t.setDate(t.getDate()-i);days.push(t.toISOString().slice(0,10))}
    const body=days.map(day=>{const rows=shown.filter(s=>s.session_date===day);
      if(!(rows.length||(studyWd.has(wd(day))&&!(day===td&&d.offDay))))return '';
      const miss=reg_.filter(h=>!rows.some(s=>s.halaqa_id===h.id));
      return `<h3 class="sv-hint" style="font-weight:800;margin:10px 0 4px">${e(day)}${day===td?' · اليوم':''}</h3>`+rows.map(card).join('')+miss.map(h=>`<article class="sv-person sv-session" style="opacity:.75"><div class="sv-person-head sv-static"><span class="sv-person-id"><strong>${e(h.name)}</strong><small>${e((h.names||[]).join('، ')||'بلا محفّظ')}</small></span><span class="sv-pill">لم تُعقد جلسة</span></div></article>`).join('')}).join('');
    return `<div class="sv-dashboard sv-supervision">${head}${chips}<div class="sv-people">${body||`<div class="sv-empty">لا توجد جلسات في هذه الفترة</div>`}</div><div style="padding:12px 0"><button type="button" class="sv-button sv-button-tonal" onclick="RC50.s3.sesDays(${S3.sdays+10})">عرض أيام أقدم</button></div></div>`;
  }});

  // ---------- alerts to a teacher (rc53_alert_staff) ----------
  const TPL=[['لم تبدأ الجلسة','لم تُفتح جلسة اليوم في حلقتك حتى الآن. نرجو فتحها وتسجيل الحضور.'],['تأخر التسميع','لاحظنا تأخر التسميع في حلقتك. نرجو متابعة الطلاب وتسجيل الإنجاز.'],['تذكير بالتقارير','نرجو استكمال الخطط والتقارير المطلوبة هذا الأسبوع.'],['شكر وتقدير','بارك الله فيك على التزامك وجهدك مع الطلاب.']];
  let AL=null;
  S3.alert=(id,name,hid,preset)=>{
    if(!id)return;AL={id,name,hid,title:preset?TPL[0][0]:'',body:preset?TPL[0][1]:''};
    R.sheet('s3Alert','تنبيه '+(name||'محفّظ'),`<div class="dn-pills-row"><div class="dn-pills">${TPL.map((t,i)=>`<button type="button" onclick="RC50.s3.tpl(${i})">${e(t[0])}</button>`).join('')}</div></div>
      <label class="dn-field"><span>العنوان</span><input id="s3AT" maxlength="80" value="${e(AL.title)}"></label><label class="dn-field"><span>النص</span><textarea id="s3AB" rows="4" maxlength="500">${e(AL.body)}</textarea></label>
      <div class="dn-muted" id="s3AE"></div>`,`${R.btn('إلغاء',"RC50.closeSheet('s3Alert')",'text')}${R.btn('إرسال','RC50.s3.send()')}`);
  };
  S3.tpl=i=>{document.getElementById('s3AT').value=TPL[i][0];document.getElementById('s3AB').value=TPL[i][1]};
  S3.send=async()=>{
    if(!AL||S3.sendBusy)return;const t=document.getElementById('s3AT').value.trim(),b=document.getElementById('s3AB').value.trim(),er=document.getElementById('s3AE');
    if(!t||!b){er.textContent='اكتب العنوان والنص';return}
    S3.sendBusy=true;er.textContent='جارٍ الإرسال…';
    try{const rs=await Promise.all(AL.id.split(',').filter(Boolean).map(id=>R.rpc('rc53_alert_staff',{p_recipient:id,p_title:t,p_body:b,p_halaqa:AL.hid||null}))),r=rs.every(x=>x&&x.ok)?{ok:true}:rs.find(x=>!(x&&x.ok));
      if(r&&r.ok){R.closeSheet('s3Alert');R.toast('وصل التنبيه إلى '+AL.name)}else er.textContent=(r&&r.error)||'تعذر الإرسال'}
    catch(err){er.textContent=err.message||'تعذر الإرسال'}finally{S3.sendBusy=false}
  };

  // ---------- visits ----------
  const sel=(id,v)=>`<select id="${id}">${[1,2,3,4,5].map(n=>`<option ${n===v?'selected':''}>${n}</option>`).join('')}</select>`;
  S3.visitNew=hid=>{S3.visit={id:null,hid:hid||'',org:3,teach:3,follow:3,att:true,notes:'',actions:''};visitDlg()};
  S3.visitEdit=id=>{const v=(B.data?.visits||[]).find(x=>x.id===id);if(!v)return;S3.visit={id,hid:v.halaqa_id,org:v.organization_score??3,teach:v.teaching_score??3,follow:v.followup_score??3,att:v.teacher_attendance!==false,notes:val(v.notes),actions:val(v.action_items)};visitDlg()};
  function visitDlg(){
    const V=S3.visit,hs=(B.data?.all||B.data?.halaqas||[]).map(h=>[h.id,h.prog?h.name+' (برنامج)':h.name]);if(!V.hid&&hs[0])V.hid=hs[0][0];
    R.sheet('s3Visit',V.id?'تعديل الزيارة':'زيارة إشرافية',`<label class="dn-field"><span>الحلقة</span><select id="s3VH">${hs.map(([i,n])=>`<option value="${e(i)}" ${i===V.hid?'selected':''}>${e(n)}</option>`).join('')}</select></label>
      <label class="dn-field"><span><input type="checkbox" id="s3VA" ${V.att?'checked':''}> المحفّظ حاضر</span></label>
      <div class="dn-tiles"><label class="dn-field"><span>التنظيم</span>${sel('s3VO',V.org)}</label><label class="dn-field"><span>التدريس</span>${sel('s3VT',V.teach)}</label><label class="dn-field"><span>المتابعة</span>${sel('s3VF',V.follow)}</label></div>
      <label class="dn-field"><span>ملاحظات</span><textarea id="s3VN" rows="2">${e(V.notes)}</textarea></label><label class="dn-field"><span>المطلوب من المحفّظ</span><textarea id="s3VX" rows="2">${e(V.actions)}</textarea></label><div class="dn-muted" id="s3VE"></div>`,
      `${R.btn('إلغاء',"RC50.closeSheet('s3Visit')",'text')}${R.btn('حفظ','RC50.s3.visitSave()')}`);
  }
  S3.visitSave=async()=>{
    const V=S3.visit,er=document.getElementById('s3VE');
    const row={halaqa_id:document.getElementById('s3VH').value,teacher_attendance:document.getElementById('s3VA').checked,organization_score:+document.getElementById('s3VO').value,teaching_score:+document.getElementById('s3VT').value,followup_score:+document.getElementById('s3VF').value,notes:document.getElementById('s3VN').value.trim()||null,action_items:document.getElementById('s3VX').value.trim()||null};
    const id=V.id||uuid(),op=V.id?{t:'upd',id,row}:{t:'ins',row:{...row,id,supervisor_id:state.user.id,visit_date:todayS()}};
    let queued=false;
    try{
      if(!navigator.onLine)throw new Error('offline');
      const r=op.t==='ins'?await db.from('supervisor_visits').upsert(op.row,{onConflict:'id'}):await db.from('supervisor_visits').update(row).eq('id',id);
      if(r.error)throw r.error;
    }catch(err){if(isNet(err)){enqueue(op);queued=true}else{er.textContent=err.message||'تعذر الحفظ';return}}
    R.closeSheet('s3Visit');R.toast(queued?'حُفظت الزيارة على هذا الجهاز وستُرسل عند عودة الإنترنت':'تم حفظ الزيارة');B.at=0;render();
  };
  S3.visitDone=async id=>{
    const op={t:'upd',id,row:{action_done:true}};
    try{if(!navigator.onLine)throw new Error('offline');const r=await db.from('supervisor_visits').update(op.row).eq('id',id);if(r.error)throw r.error}
    catch(err){if(isNet(err))enqueue(op);else{R.toast(err.message||'تعذر التحديث');return}}
    B.at=0;render();
  };
  S3.visitDel=id=>{
    R.sheet('s3Del','حذف الزيارة',`<p>للتأكيد اكتب كلمة «حذف».</p><label class="dn-field"><input id="s3DT" oninput="document.getElementById('s3DB').disabled=this.value.trim()!=='حذف'" placeholder="حذف"></label>`,`${R.btn('إلغاء',"RC50.closeSheet('s3Del')",'text')}<button type="button" class="dn-btn" id="s3DB" disabled onclick="RC50.s3.visitDelGo('${e(id)}')">حذف الزيارة</button>`);
  };
  S3.visitDelGo=async id=>{
    let queued=false;
    try{if(!navigator.onLine)throw new Error('offline');const r=await db.from('supervisor_visits').delete().eq('id',id);if(r.error)throw r.error;enqueue({t:'ins-cancel',id});}
    catch(err){if(isNet(err)){enqueue({t:'del',id});queued=true}else{R.toast(err.message||'تعذر الحذف');return}}
    R.closeSheet('s3Del');R.toast(queued?'سيُحذف عند عودة الإنترنت':'تم حذف الزيارة');B.at=0;render();
  };
  const sc=(v,k)=>v[k]==null?'—':`${v[k]}/5`;
  R.page('visits',{title:'زيارات المشرف',roles:['admin','supervisor'],render:async()=>{
    const d=await load(true),hq=Object.fromEntries(d.all.map(h=>[h.id,h])),U=window.SupervisorUI;
    return U.visitsPage(d.visits.map(v=>U.visitCard(v,{e,halaqa:hq[v.halaqa_id]?.name||'حلقة',logo:hq[v.halaqa_id]?.logo,text:val})).join(''),"RC50.s3.visitNew('')",'لا توجد زيارات مسجلة بعد. سجّل أول زيارة من الزر أعلاه.');
  }});

  // month attendance + recitation coverage per halaqa, used for the teacher evaluation
  const M={at:0,key:'',data:null};
  async function loadMonth(d){
    const key=(d.sess||[]).length+':'+B.at;if(M.data&&M.key===key)return M.data;
    const sh={},att={},rec={};(d.sess||[]).forEach(x=>{sh[x.id]=x.halaqa_id});
    const ids=Object.keys(sh);
    try{
      const [a,r]=await Promise.all([fetchBy('attendance_records','session_id,status','session_id',ids),fetchBy('recitation_entries','session_id,student_id','session_id',ids)]);
      a.forEach(x=>{const o=att[sh[x.session_id]]=att[sh[x.session_id]]||{p:0,t:0};o.t++;if(x.status==='present'||x.status==='late')o.p++});
      r.forEach(x=>{(rec[sh[x.session_id]]=rec[sh[x.session_id]]||new Set()).add(x.student_id)});
    }catch(_e){}
    M.key=key;M.data={att,rec};return M.data;
  }
  // overall teacher rating: weighted, missing components are left out and the rest re-weighted
  const W=[['commit','الالتزام بالحضور','أيام نشاطه من أيام الشهر',30],['attend','حضور الطلاب','نسبة حضور طلاب حلقته',20],['recite','تغطية التسميع','طلاب سمّعوا هذا الشهر',25],['closed','إنهاء الجلسات','جلسات أُنهيت من الجلسات',10],['visit','تقييم الزيارات','متوسط تقييم المشرف',15]];
  function rate_(vals){
    const rows=W.map(([k,l,h,w])=>({k,label:l,hint:h,w,pct:vals[k]})),got=rows.filter(x=>x.pct!=null),tw=got.reduce((a,x)=>a+x.w,0);
    return {metrics:rows,score:tw?Math.round(got.reduce((a,x)=>a+x.pct*x.w,0)/tw):null};
  }

  // ---------- programs (training courses, tajweed/tilawah programs) ----------
  R.page('programs',{title:'البرامج',roles:['supervisor'],render:async()=>{
    const d=await load(false);return window.SupervisorUI.programsPage(d.programs,{e,daysSince,today:todayS()});
  }});
  S3.programs=()=>go('programs');

  // ---------- staff monitor (supervision) ----------
  R.page('supervision',{title:'متابعة المحفظين',roles:['admin','supervisor'],render:async()=>{
    const d=await load(true),adm=role()==='admin';if(!adm&&S3.tabv==='supervisors')S3.tabv='teachers';
    const U=window.SupervisorUI,month=todayS().slice(0,8)+'01',MD=await loadMonth(d);
    const myIds=new Set(d.halaqas.map(h=>h.id)),linked=new Set((d.links||[]).filter(l=>myIds.has(l.halaqa_id)).map(l=>l.teacher_id));
    // A supervisor follows only the teachers of his own halaqas; the administrator sees everyone.
    const sups=d.staff.filter(p=>p.role==='supervisor'),tchs=d.staff.filter(p=>p.role==='teacher'&&(adm||linked.has(p.id)));
    const scope=(d.sess||[]).filter(s=>adm||myIds.has(s.halaqa_id));
    const monthDays=new Set(scope.map(s=>s.session_date)).size||d.mDays||0;
    const photo=p=>p.avatar_path&&String(p.avatar_path).startsWith('data:image/')?p.avatar_path:null;
    const rowsT=tchs.map(p=>{
      const ov=d.ov[p.id]||{},hs=d.all.filter(h=>h.tids.includes(p.id)),ids=new Set(hs.map(h=>h.id));
      // credit a teacher for sessions of his own halaqas as well as the ones he created
      const mine=(d.sess||[]).filter(s=>s.created_by===p.id||ids.has(s.halaqa_id));
      const days=Math.max(ov.session_days!=null?+ov.session_days:0,new Set(mine.map(s=>s.session_date)).size);
      const sessions=Math.max(ov.sessions!=null?+ov.sessions:0,mine.length),closed=Math.max(ov.closed_sessions!=null?+ov.closed_sessions:0,mine.filter(s=>s.status==='closed').length);
      const denom=Math.max(monthDays,days),pct=hs.length&&denom>0?rate(days,denom):null;
      const hsIds=[...ids],stN=hs.reduce((n,h)=>n+(h.students||0),0),aT=hsIds.reduce((n,i)=>n+(MD.att[i]?.t||0),0),aP=hsIds.reduce((n,i)=>n+(MD.att[i]?.p||0),0),rS=new Set();hsIds.forEach(i=>(MD.rec[i]||[]).forEach(x=>rS.add(x)));
      const vr=d.visits.filter(v=>ids.has(v.halaqa_id)&&v.visit_date>=month);
      const sc_=vr.map(v=>['organization_score','teaching_score','followup_score'].filter(k=>v[k]!=null).map(k=>+v[k])).filter(a=>a.length).map(a=>a.reduce((x,y)=>x+y,0)/a.length);
      const states=hs.map(h=>h.state),today=!states.length?'none':states.includes('none')?(d.offDay?'off':'none'):states.includes('open')?'open':'closed';
      const lastS=mine.map(s=>s.session_date).sort().pop();
      const evalr=hs.length?rate_({commit:pct,attend:aT?rate(aP,aT):null,recite:stN?rate(rS.size,stN):null,closed:sessions?rate(closed,sessions):null,visit:sc_.length?Math.round(sc_.reduce((x,y)=>x+y,0)/sc_.length*20):null}):{metrics:[],score:null};
      return {id:p.id,name:p.full_name||'محفّظ',photo:photo(p),phone:val(p.phone),halaqat:hs,pct:evalr.score,metrics:evalr.metrics,commitPct:pct,sessions,days,monthDays:denom,closed,rec:ov.recitations,today,
        last:lastS||ov.last_session||'—',visits:vr.length,score:sc_.length?sc_.reduce((x,y)=>x+y,0)/sc_.length:null,
        openActions:d.visits.filter(v=>ids.has(v.halaqa_id)&&val(v.action_items)&&!v.action_done).length}});
    const rowsS=sups.map(p=>{const mine=(d.all||d.halaqas).filter(h=>h.supervisor_id===p.id||(d.supLinks||[]).some(l=>l.halaqa_id===h.id&&l.supervisor_id===p.id)),made=d.visits.filter(v=>v.supervisor_id===p.id&&v.visit_date>=month),vis=new Set(made.map(v=>v.halaqa_id));
      const visited=mine.filter(h=>vis.has(h.id)).length;
      return {id:p.id,name:p.full_name||'مشرف',photo:photo(p),total:mine.length,visited,pct:mine.length?rate(visited,mine.length):null,made:made.length,last:made[0]?.visit_date||'—'}});
    const tabs=[['teachers','المحفظون'],...(adm?[['supervisors','المشرفون']]:[]),['compare','المقارنة']];
    let body='';
    if(S3.tabv==='teachers')body=rowsT.map(r=>U.teacherCard(r,{e,num1,open:S3.open===r.id})).join('')||R.card(R.empty('لا يوجد محفظون في حلقاتك بعد'));
    else if(S3.tabv==='supervisors')body=rowsS.map(r=>U.supervisorCard(r,{e,open:S3.open===r.id})).join('')||R.card(R.empty('لا يوجد مشرفون'));
    else{
      const M={commit:['تقييم المحفظين',rowsT.filter(r=>r.pct!=null).map(r=>[r.name,r.pct,r.pct+'%'])],recited:['التسميع اليوم',d.halaqas.map(h=>[h.name,rate(h.recited,h.students),`${rate(h.recited,h.students)}% (${h.recited} من ${h.students})`])],sessions:['جلسات الشهر',d.halaqas.map(h=>[h.name,h.monthSessions,h.monthSessions+' جلسة'])],visit:['تقييم الزيارات',d.halaqas.filter(h=>h.lastScore!=null).map(h=>[h.name,h.lastScore*20,num1(h.lastScore)+' من 5'])]};
      const rk=(M[S3.metricv]||M.commit)[1].slice().sort((a,b)=>b[1]-a[1]),top=Math.max(1,...rk.map(x=>x[1]));
      body=R.pills(Object.entries(M).map(([k,v])=>[k,v[0]]),S3.metricv,'RC50.s3.metric')+(rk.map((x,i)=>U.rankRow(i,x[0],x[2],Math.round(x[1]/top*100),e)).join('')||R.card(R.empty('لا توجد بيانات كافية للمقارنة بعد')));
    }
    const assigned=rowsT.filter(r=>r.pct!=null),g=assigned.filter(r=>r.pct>=80).length,lo=assigned.filter(r=>r.pct<50).length;
    const kpis=U.stat(tchs.length,'المحفظون','',e)+U.stat(g,'أداء ممتاز','ok',e)+U.stat(lo,'يحتاجون متابعة',lo?'bad':'',e);
    return U.page({kpis,seg:R.seg(tabs,S3.tabv,'RC50.s3.tab'),body});
  }});
  S3.toggle=id=>{S3.open=S3.open===id?null:id;render()};S3.tab=v=>{S3.tabv=v;S3.open=null;render()};S3.metric=v=>{S3.metricv=v;render()};

  // ---------- navigation ----------
  const origSvg=window.navSvg;
  window.navSvg=function(p){return origSvg.call(this,p==='visits'?'supervision':p==='programs'?'halaqas':p)};
  window.iconFor=window.navSvg;
  const prevNav=window.navItems;
  window.navItems=function(){
    const r=role(),items=prevNav.apply(this,arguments);
    if(r==='supervisor'){
      const nt=items.find(x=>x[0]==='notifications')||['notifications','الإشعارات'];
      return [['home','الرئيسية'],nt,['halaqas','الحلقات'],['programs','البرامج'],['supervision','متابعة المحفظين'],['visits','الزيارات'],['sessions','الجلسات اليومية'],['students','الطلاب'],['reports','التقارير'],['ranking','الترتيب والإحصائيات'],['community','الإعلانات والتواصل'],['approvals','طلبات المحفّظين'],['settings','الإعدادات']];
    }
    if(r==='admin'){
      const out=items.map(x=>x[0]==='supervision'?['supervision','متابعة المحفظين والمشرفين']:x),i=out.findIndex(x=>x[0]==='supervision');
      if(!out.some(x=>x[0]==='visits'))out.splice(i<0?out.length:i+1,0,['visits','زيارات المشرفين']);
      if(!out.some(x=>x[0]==='chats')){const sp=out.findIndex(x=>x[0]==='support');out.splice(sp<0?out.length:sp+1,0,['chats','محادثات المانحين'])}
      if(!out.some(x=>x[0]==='observer_requests')){const a=out.findIndex(x=>x[0]==='chats');out.splice(a<0?out.length:a+1,0,['observer_requests','طلبات المانحين'])}
      return out;
    }
    return items;
  };
  const prevMobile=window.mobileNavItems;
  window.mobileNavItems=function(){
    if(role()==='supervisor')return [['home','الرئيسية'],['halaqas','الحلقات'],['add','تسجيل'],['supervision','المحفظون'],['more','المزيد']];
    return prevMobile.apply(this,arguments);
  };
  const prevQuick=R.quickAdd;
  R.quickAdd=function(){
    if(role()!=='supervisor')return prevQuick.apply(this,arguments);
    const rows=[['تسجيل زيارة','زيارة محفّظ أو حلقة',"RC50.s3.visitNew('')"],['تنبيه محفّظ','من لوحة المتابعة',"go('supervision')"],['إعلان جديد','ينشر لحلقاتك','openAnnouncement()']];
    R.sheet('dnQuick','إضافة سريعة',`<div class="dn-quick">${rows.map(([t,sub,f])=>`<button type="button" class="dn-quick-i" onclick="RC50.closeSheet('dnQuick');setTimeout(()=>{${f}},120)"><b>${e(t)}</b><small>${e(sub)}</small></button>`).join('')}</div>`);
  };
  const prevFab=window.setFab;
  window.setFab=function(){prevFab.apply(this,arguments);if(role()==='supervisor'){const f=document.getElementById('fab');f&&f.classList.add('hidden')}};

  // ---------- support details card in settings ----------
  async function fillSupport(){
    try{
      const box=document.getElementById('content');if(!box||document.getElementById('s3Support'))return;
      const r=await db.from('app_support_info').select('*').limit(1);if(r.error)return;
      const row=(r.data||[])[0]||{},adm=role()==='admin',phone=val(row.phone);
      if(!phone&&!adm)return;
      const tl={wallet:'محفظة إلكترونية',other:'جهة أخرى'}[row.entity_type]||'بنك';
      const d=document.createElement('section');d.id='s3Support';d.className='dn-card s3-support';
      d.innerHTML=`<h3>ادعم التطبيق</h3><p class="dn-muted">إن نفعك التطبيق وأحببت دعم استمراره وتطويره، يمكنك التحويل على البيانات التالية، جزاك الله خيرًا.</p>
        ${phone?`<b dir="ltr">${e(phone)}</b><small>نوع الجهة: ${e(tl)}${val(row.entity_name)?' · '+e(val(row.entity_name)):''}</small>${val(row.note)?`<small>${e(val(row.note))}</small>`:''}<button type="button" class="dn-btn tonal" onclick="navigator.clipboard&&navigator.clipboard.writeText('${e(phone)}').then(()=>RC50.toast('تم نسخ الرقم'))">نسخ الرقم</button>`:''}
        ${adm?`<details><summary>${phone?'تعديل بيانات الدعم':'إضافة بيانات الدعم'}</summary><label class="dn-field"><span>رقم الهاتف</span><input id="s3SP" value="${e(phone)}"></label>
        <label class="dn-field"><span>نوع الجهة</span><select id="s3ST"><option value="bank" ${row.entity_type!=='wallet'&&row.entity_type!=='other'?'selected':''}>بنك</option><option value="wallet" ${row.entity_type==='wallet'?'selected':''}>محفظة</option><option value="other" ${row.entity_type==='other'?'selected':''}>أخرى</option></select></label>
        <label class="dn-field"><span>اسم الجهة</span><input id="s3SN" value="${e(val(row.entity_name))}"></label><label class="dn-field"><span>ملاحظة</span><textarea id="s3SO" rows="2">${e(val(row.note))}</textarea></label>
        ${R.btn('حفظ','RC50.s3.saveSupport()')}</details>`:''}`;
      box.appendChild(d);
    }catch(_e){}
  }
  S3.saveSupport=async()=>{
    try{const r=await db.from('app_support_info').update({phone:document.getElementById('s3SP').value.trim(),entity_type:document.getElementById('s3ST').value,entity_name:document.getElementById('s3SN').value.trim(),note:document.getElementById('s3SO').value.trim(),updated_at:new Date().toISOString()}).eq('id',1);
      if(r.error)throw r.error;R.toast('تم حفظ بيانات الدعم');document.getElementById('s3Support')?.remove();fillSupport()}
    catch(err){R.toast(err.message||'تعذر الحفظ')}
  };
  const prevRender=window.render;
  window.render=async function(){const r=await prevRender.apply(this,arguments);document.body.classList.toggle('sv-role',role()==='supervisor');if(state?.page==='settings')setTimeout(fillSupport,0);return r};

  // ---------- admin: observer (donor) requests ----------
  const KIND={reward:'مكافأة',honor:'تكريم',follow_up:'متابعة',other:'أخرى'},STAT={approved:['تمت الموافقة','ok'],declined:['لم تتم الموافقة','bad']};
  R.page('observer_requests',{title:'طلبات المانحين',roles:['admin'],render:async()=>{
    let rows;try{rows=await R.rpc('rc32_observer_requests')||[]}catch(err){return R.card(R.empty(String(err.message||'').includes('rc32_')?'لم يُطبَّق تحديث قاعدة البيانات الخاص بالمراقب بعد.':(err.message||'تعذر تحميل الطلبات')))}
    return rows.map(r=>{const st=STAT[r.status]||['بانتظار المدير','warn'];
      return `<article class="s3-card ${st[1]}"><div class="s3-top"><div><b>${e(KIND[r.kind]||r.kind||'طلب')} · ${e(r.student_name||'طالب')}</b><small>${e(r.observer_name||'')} ${r.halaqa_name?'· '+e(r.halaqa_name):''}</small></div><span class="s3-pill ${st[1]}">${e(st[0])}</span></div>
        ${val(r.note)?`<p>${e(val(r.note))}</p>`:''}${val(r.admin_note)?`<small>ردّ المدير: ${e(val(r.admin_note))}</small>`:''}
        ${r.status==='pending'||!r.status?`<div class="s3-acts"><button type="button" class="dn-btn" onclick="RC50.s3.obsGo('${e(r.id)}',true)">موافقة</button><button type="button" class="dn-btn tonal s3-danger" onclick="RC50.s3.obsGo('${e(r.id)}',false)">رفض</button></div>`:''}</article>`}).join('')||R.card(R.empty('لا توجد طلبات من المراقبين'));
  }});
  S3.obsGo=(id,approve)=>{
    R.sheet('s3Obs',approve?'الموافقة على الطلب':'رفض الطلب',`<label class="dn-field"><span>ملاحظة للمراقب (اختياري)</span><textarea id="s3ON" rows="2"></textarea></label><div class="dn-muted" id="s3OE"></div>`,`${R.btn('إلغاء',"RC50.closeSheet('s3Obs')",'text')}${R.btn('تأكيد',`RC50.s3.obsSend('${id}',${approve})`)}`);
  };
  S3.obsSend=async(id,approve)=>{
    const note=document.getElementById('s3ON').value.trim(),er=document.getElementById('s3OE');
    try{const ok_=await R.rpc('rc32_observer_resolve',{p_id:id,p_status:approve?'approved':'declined',p_note:note||null});
      if(ok_!==true)throw new Error('الطلب غير موجود أو تم الرد عليه سابقًا');R.closeSheet('s3Obs');R.toast(approve?'تمت الموافقة وأُبلغ المراقب':'تم رفض الطلب وأُبلغ المراقب');render()}
    catch(err){er.textContent=err.message||'تعذر التنفيذ'}
  };

  // ---------- notification centre: donors / supervisors (administrator only, via SQL function) ----------
  const baseSend=window.sendManualNotification;
  if(typeof baseSend==='function')window.sendManualNotification=async function(){
    const a=document.getElementById('ntAudience')?.value;
    if(a!=='donors'&&a!=='supervisors')return baseSend.apply(this,arguments);
    const t=document.getElementById('ntTitle')?.value.trim(),b=document.getElementById('ntBody')?.value.trim();
    if(!t||!b)return R.toast('اكتب عنوان الإشعار ونصه');
    try{
      const label=a==='donors'?'المانحون':'المشرفون',key='bc:'+uuid();
      const prev=await R.rpc('rc53_broadcast_special',{p_audience:a,p_title:t,p_body:b,p_source_key:key,p_label:label,p_dry:true});
      if(prev&&prev.error)throw new Error(prev.error);
      if(!(prev&&prev.recipients>0))return R.toast('لا يوجد مستلمون لهذا الاختيار');
      if(!confirm(`سيصل الإشعار إلى ${prev.recipients} (${label}). لا يمكن التراجع. متابعة؟`))return;
      const r=await R.rpc('rc53_broadcast_special',{p_audience:a,p_title:t,p_body:b,p_source_key:key,p_label:label,p_dry:false});
      if(r&&r.error)throw new Error(r.error);
      R.toast(`تم إنشاء الإشعار لـ ${r.recipients||0} مستلم · داخل التطبيق`);
      document.getElementById('ntTitle').value='';document.getElementById('ntBody').value='';
      try{await refreshNotifications({silent:true})}catch(_e){}render();
    }catch(err){R.toast(err.message||'تعذر الإرسال')}
  };
})();
