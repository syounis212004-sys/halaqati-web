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
  const greeting=()=>{const h=new Date().getHours();return h>=4&&h<=11?'صباح الخير':h<=16&&h>=12?'نهارك مبارك':h>=17&&h<=20?'مساء الخير':'ليلة مباركة'};
  R.welcome=(detail)=>{
    const list=PH[role()]||PH.teacher,day=Math.floor(Date.now()/86400000),p=list[day%list.length];
    return `<section class="s3-welcome"><small>${e(greeting())}</small><b>${e(p[0])}</b><span>${e(p[1])}</span>${detail?`<p>${e(detail)}</p>`:''}</section>`;
  };
  const baseHome=window.homePage;
  if(typeof baseHome==='function')window.homePage=function(){
    const r=baseHome.apply(this,arguments);
    if(typeof r!=='string'||role()==='supervisor')return r;
    return R.welcome()+r;
  };

  // ---------- data ----------
  const B={at:0,data:null};
  const ok=r=>{if(r&&r.error)throw r.error;return (r&&r.data)||[]};
  async function staffProfiles(){
    let r=await db.from('profiles').select('id,full_name,role,phone,avatar_path,frozen').in('role',['teacher','supervisor']).order('full_name').limit(500);
    if(r.error)r=await db.from('profiles').select('id,full_name,role,phone').in('role',['teacher','supervisor']).order('full_name').limit(500);
    return ok(r);
  }
  async function load(force){
    if(!force&&B.data&&Date.now()-B.at<20000)return B.data;
    if(typeof db==='undefined')throw new Error('لا يوجد اتصال بالخادم');
    const td=todayS(),ms=td.slice(0,8)+'01';
    const [hq,links,staff,sess,visits]=await Promise.all([
      db.from('halaqas').select('id,name,active,halaqa_type,supervisor_id').eq('active',true).order('name').limit(200).then(ok),
      db.from('halaqa_teachers').select('halaqa_id,teacher_id').limit(1000).then(ok),
      staffProfiles(),
      db.from('sessions').select('id,halaqa_id,session_date,status,created_by').gte('session_date',ms).neq('status','cancelled').order('session_date',{ascending:false}).limit(1500).then(ok),
      db.from('supervisor_visits').select('*').order('visit_date',{ascending:false}).limit(300).then(ok)]);
    const todayS_=sess.filter(s=>s.session_date===td),ids=todayS_.map(s=>s.id);
    const [att,rec]=ids.length?await Promise.all([
      db.from('attendance_records').select('session_id,student_id,status').in('session_id',ids).limit(3000).then(ok),
      db.from('recitation_entries').select('session_id,student_id').in('session_id',ids).limit(4000).then(ok)]):[[],[]];
    let ov=null;try{ov=await R.rpc('rc53_staff_overview',{p_from:ms,p_to:td})}catch(_e){ov=null}
    const by={};staff.forEach(p=>by[p.id]=p);
    const stu=(state.students||[]).filter(s=>s.status==='active');
    const sh={};todayS_.forEach(s=>sh[s.id]=s.halaqa_id);
    const halaqas=hq.filter(h=>{const t=val(h.halaqa_type);return !t||t==='regular'}).map(h=>{
      const tids=[...new Set(links.filter(l=>l.halaqa_id===h.id).map(l=>l.teacher_id))];
      const mine=todayS_.filter(s=>s.halaqa_id===h.id),sid=new Set(mine.map(s=>s.id));
      const state_=!mine.length?'none':mine.every(s=>s.status==='closed')?'closed':'open';
      const a=att.filter(x=>sid.has(x.session_id));
      const lastV=visits.find(v=>v.halaqa_id===h.id),sc=lastV?['organization_score','teaching_score','followup_score'].filter(k=>lastV[k]!=null).map(k=>+lastV[k]):[];
      return {id:h.id,name:h.name||'حلقة',tids,names:tids.map(i=>by[i]?.full_name||'محفّظ'),students:stu.filter(s=>s.halaqa_id===h.id).length,state:state_,
        present:a.filter(x=>x.status==='present'||x.status==='late').length,absent:a.filter(x=>x.status==='absent').length,excused:a.filter(x=>x.status==='excused').length,
        recited:new Set(rec.filter(x=>sh[x.session_id]===h.id).map(x=>x.student_id)).size,monthSessions:sess.filter(s=>s.halaqa_id===h.id).length,
        lastVisit:lastV?.visit_date||null,lastScore:sc.length?sc.reduce((x,y)=>x+y,0)/sc.length:null};
    });
    const mDays=new Set(sess.map(s=>s.session_date)).size,byC={};
    sess.forEach(s=>{const o=byC[s.created_by]=byC[s.created_by]||{n:0,d:new Set,c:0,last:''};o.n++;o.d.add(s.session_date);if(s.status==='closed')o.c++;if(s.session_date>o.last)o.last=s.session_date});
    B.data={halaqas,visits,staff,byC,mDays,ov:ov?Object.fromEntries(ov.map(x=>[x.id,x])):{},links};B.at=Date.now();return B.data;
  }
  const stLabel={none:'لم يبدأ الجلسة',open:'الجلسة جارية',closed:'أنهى الجلسة'},stCls={none:'bad',open:'warn',closed:'ok'};
  const tname=h=>h.names.join('، ')||'بلا محفّظ';
  const rate=(a,b)=>b<=0?0:Math.min(100,Math.round(a*100/b));

  // ---------- supervisor halaqa card ----------
  const hCard=(h,detailed)=>{
    const pct=rate(h.recited,h.students),vd=daysSince(h.lastVisit);
    return `<article class="s3-card ${stCls[h.state]}"><div class="s3-top"><div><b>${e(h.name)}</b><small>${e(tname(h))}</small></div><span class="s3-pill ${stCls[h.state]}">${stLabel[h.state]}</span></div>
      ${h.students?`<div class="s3-prog"><i style="width:${pct}%"></i></div>`:''}
      <small>سُمّع ${h.recited} من ${h.students} · حضور ${h.present} · غياب ${h.absent}${h.excused?` · بعذر ${h.excused}`:''}</small>
      ${detailed?`<small>جلسات الشهر ${h.monthSessions} · ${h.lastVisit?`آخر زيارة قبل ${vd==null?0:vd} يومًا${h.lastScore!=null?` (${num1(h.lastScore)}/5)`:''}`:'لم تُزر بعد'}</small>`:''}
      <div class="s3-acts"><button type="button" class="dn-btn tonal" ${h.tids.length?'':'disabled'} onclick="RC50.s3.alert('${e(h.tids[0]||'')}','${e(h.names[0]||'')}','${e(h.id)}','${h.state==='none'?'1':''}')">تنبيه المحفّظ</button><button type="button" class="dn-btn tonal" onclick="RC50.s3.visitNew('${e(h.id)}')">زيارة</button></div></article>`;
  };

  // ---------- supervisor home: operations room ----------
  const donorHome=R.pages.home;
  const supHome=async()=>{
    const d=await load(false),ns=d.halaqas.filter(h=>h.state==='none'),started=d.halaqas.length-ns.length;
    const stale=d.halaqas.filter(h=>(daysSince(h.lastVisit)??999)>14),open=d.visits.filter(v=>val(v.action_items)&&!v.action_done).length;
    const wk=d.visits.filter(v=>(daysSince(v.visit_date)??999)<=7).length;
    return `${R.welcome()}<h3 class="dn-h">${d.halaqas.length?`${started} من ${d.halaqas.length} حلقات بدأت اليوم${ns.length?` · ${ns.length} لم تبدأ`:' · الجميع بدأ'}`:'لا توجد حلقات مسندة إليك بعد'}</h3>
      <div class="dn-tiles">${R.tile('حلقات بدأت',`${started}/${d.halaqas.length}`)}${R.tile('زياراتي هذا الأسبوع',wk)}${R.tile('إجراءات مفتوحة',open)}</div>
      ${ns.length||stale.length?`<section class="s3-card bad"><b>يحتاج تدخلك</b>${ns.slice(0,5).map(h=>`<div class="s3-line"><span>• ${e(tname(h))} لم يبدأ جلسة ${e(h.name)}</span><button type="button" class="dn-btn text" ${h.tids.length?'':'disabled'} onclick="RC50.s3.alert('${e(h.tids[0]||'')}','${e(h.names[0]||'')}','${e(h.id)}','1')">تنبيه</button></div>`).join('')}${stale.slice(0,3).map(h=>`<small>• ${e(h.name)}: ${h.lastVisit?`لم تُزر منذ ${daysSince(h.lastVisit)} يومًا`:'لم تُزر بعد'}</small>`).join('')}</section>`:''}
      <h3 class="dn-h">حلقات اليوم</h3>${d.halaqas.map(h=>hCard(h,false)).join('')||R.card(R.empty('لا توجد حلقات لعرضها'))}
      <div class="dn-actions">${R.btn('متابعة المحفّظين',"go('supervision')",'tonal')}</div>`;
  };
  R.pages.home={title:'الرئيسية',roles:[...(donorHome?.roles||['observer']),'supervisor'],render:async()=>role()==='supervisor'?supHome():(R.welcome()+await donorHome.render()),after:donorHome?.after};

  // ---------- supervisor halaqat (read-only) ----------
  R.page('halaqas',{title:'الحلقات',roles:['supervisor'],render:async()=>{const d=await load(false);return d.halaqas.map(h=>hCard(h,true)).join('')||R.card(R.empty('لا توجد حلقات مسندة إليك'))}});

  // ---------- supervisor sessions (read-only) ----------
  R.page('sessions',{title:'الجلسات اليومية',roles:['supervisor'],render:async()=>{
    const since=new Date();since.setDate(since.getDate()-10);
    const hq=Object.fromEntries((state.halaqas||[]).map(h=>[h.id,h.name]));
    const d=await load(false),stf=Object.fromEntries(d.staff.map(p=>[p.id,p.full_name]));
    const ses=ok(await db.from('sessions').select('id,halaqa_id,session_date,status,created_by').gte('session_date',iso(since)).neq('status','cancelled').order('session_date',{ascending:false}).limit(120));
    const ids=ses.map(s=>s.id),[att,rec]=ids.length?await Promise.all([db.from('attendance_records').select('session_id,student_id,status').in('session_id',ids).limit(4000).then(ok),db.from('recitation_entries').select('session_id,student_id').in('session_id',ids).limit(5000).then(ok)]):[[],[]];
    return `<div class="dn-hello">عرض للمتابعة فقط · آخر 10 أيام</div>`+(ses.map(s=>{
      const a=att.filter(x=>x.session_id===s.id),r=new Set(rec.filter(x=>x.session_id===s.id).map(x=>x.student_id)).size,closed=s.status==='closed';
      return `<article class="s3-card ${closed?'ok':'warn'}"><div class="s3-top"><div><b>${e(hq[s.halaqa_id]||'حلقة')}</b><small>${e(stf[s.created_by]||'—')} · ${e(s.session_date)}</small></div><span class="s3-pill ${closed?'ok':'warn'}">${closed?'مُنهاة':'جارية'}</span></div>
        <small>حضور ${a.filter(x=>x.status==='present'||x.status==='late').length} · غياب ${a.filter(x=>x.status==='absent').length} · سُمّع ${r}</small></article>`}).join('')||R.card(R.empty('لا توجد جلسات في آخر عشرة أيام')));
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
    try{const r=await R.rpc('rc53_alert_staff',{p_recipient:AL.id,p_title:t,p_body:b,p_halaqa:AL.hid||null});
      if(r&&r.ok){R.closeSheet('s3Alert');R.toast('وصل التنبيه إلى '+AL.name)}else er.textContent=(r&&r.error)||'تعذر الإرسال'}
    catch(err){er.textContent=err.message||'تعذر الإرسال'}finally{S3.sendBusy=false}
  };

  // ---------- visits ----------
  const sel=(id,v)=>`<select id="${id}">${[1,2,3,4,5].map(n=>`<option ${n===v?'selected':''}>${n}</option>`).join('')}</select>`;
  S3.visitNew=hid=>{S3.visit={id:null,hid:hid||'',org:3,teach:3,follow:3,att:true,notes:'',actions:''};visitDlg()};
  S3.visitEdit=id=>{const v=(B.data?.visits||[]).find(x=>x.id===id);if(!v)return;S3.visit={id,hid:v.halaqa_id,org:v.organization_score??3,teach:v.teaching_score??3,follow:v.followup_score??3,att:v.teacher_attendance!==false,notes:val(v.notes),actions:val(v.action_items)};visitDlg()};
  function visitDlg(){
    const V=S3.visit,hs=(B.data?.halaqas||[]).map(h=>[h.id,h.name]);if(!V.hid&&hs[0])V.hid=hs[0][0];
    R.sheet('s3Visit',V.id?'تعديل الزيارة':'زيارة إشرافية',`<label class="dn-field"><span>الحلقة</span><select id="s3VH">${hs.map(([i,n])=>`<option value="${e(i)}" ${i===V.hid?'selected':''}>${e(n)}</option>`).join('')}</select></label>
      <label class="dn-field"><span><input type="checkbox" id="s3VA" ${V.att?'checked':''}> المحفّظ حاضر</span></label>
      <div class="dn-tiles"><label class="dn-field"><span>التنظيم</span>${sel('s3VO',V.org)}</label><label class="dn-field"><span>التدريس</span>${sel('s3VT',V.teach)}</label><label class="dn-field"><span>المتابعة</span>${sel('s3VF',V.follow)}</label></div>
      <label class="dn-field"><span>ملاحظات</span><textarea id="s3VN" rows="2">${e(V.notes)}</textarea></label><label class="dn-field"><span>المطلوب من المحفّظ</span><textarea id="s3VX" rows="2">${e(V.actions)}</textarea></label><div class="dn-muted" id="s3VE"></div>`,
      `${R.btn('إلغاء',"RC50.closeSheet('s3Visit')",'text')}${R.btn('حفظ','RC50.s3.visitSave()')}`);
  }
  S3.visitSave=async()=>{
    const V=S3.visit,er=document.getElementById('s3VE');
    const row={halaqa_id:document.getElementById('s3VH').value,teacher_attendance:document.getElementById('s3VA').checked,organization_score:+document.getElementById('s3VO').value,teaching_score:+document.getElementById('s3VT').value,followup_score:+document.getElementById('s3VF').value,notes:document.getElementById('s3VN').value.trim()||null,action_items:document.getElementById('s3VX').value.trim()||null};
    try{
      if(!navigator.onLine)throw new Error('تسجيل الزيارة في الويب يحتاج اتصالًا بالإنترنت (التطبيق يحفظها بدون إنترنت)');
      let r;if(V.id)r=await db.from('supervisor_visits').update(row).eq('id',V.id);else r=await db.from('supervisor_visits').insert({...row,supervisor_id:state.user.id,visit_date:todayS()});
      if(r.error)throw r.error;R.closeSheet('s3Visit');R.toast('تم حفظ الزيارة');B.at=0;render();
    }catch(err){er.textContent=err.message||'تعذر الحفظ'}
  };
  S3.visitDone=async id=>{try{const r=await db.from('supervisor_visits').update({action_done:true}).eq('id',id);if(r.error)throw r.error;B.at=0;render()}catch(err){R.toast(err.message||'تعذر التحديث')}};
  S3.visitDel=id=>{
    R.sheet('s3Del','حذف الزيارة',`<p>للتأكيد اكتب كلمة «حذف».</p><label class="dn-field"><input id="s3DT" oninput="document.getElementById('s3DB').disabled=this.value.trim()!=='حذف'" placeholder="حذف"></label>`,`${R.btn('إلغاء',"RC50.closeSheet('s3Del')",'text')}<button type="button" class="dn-btn" id="s3DB" disabled onclick="RC50.s3.visitDelGo('${e(id)}')">حذف الزيارة</button>`);
  };
  S3.visitDelGo=async id=>{try{const r=await db.from('supervisor_visits').delete().eq('id',id);if(r.error)throw r.error;R.closeSheet('s3Del');R.toast('تم حذف الزيارة');B.at=0;render()}catch(err){R.toast(err.message||'تعذر الحذف')}};
  const sc=(v,k)=>v[k]==null?'—':`${v[k]}/5`;
  R.page('visits',{title:'زيارات المشرف',roles:['admin','supervisor'],render:async()=>{
    const d=await load(true),hn=Object.fromEntries(d.halaqas.map(h=>[h.id,h.name]));
    return `${R.btn('تسجيل زيارة جديدة',"RC50.s3.visitNew('')")}`+(d.visits.map(v=>`<article class="s3-card"><div class="s3-top"><b>${e(hn[v.halaqa_id]||'حلقة')}</b><small>${e(v.visit_date)}</small></div>
      <small>التنظيم ${sc(v,'organization_score')} · التدريس ${sc(v,'teaching_score')} · المتابعة ${sc(v,'followup_score')}${v.teacher_attendance==null?'':v.teacher_attendance?' · المحفّظ حاضر':' · المحفّظ غائب'}</small>
      ${val(v.notes)?`<p>${e(val(v.notes))}</p>`:''}${val(v.action_items)?`<small>المطلوب: ${e(val(v.action_items))}${v.action_done?' ✓ نُفّذ':''}</small>`:''}
      <div class="s3-acts"><button type="button" class="dn-btn tonal" onclick="RC50.s3.visitEdit('${e(v.id)}')">تعديل</button>${val(v.action_items)&&!v.action_done?`<button type="button" class="dn-btn tonal" onclick="RC50.s3.visitDone('${e(v.id)}')">تم التنفيذ</button>`:''}<button type="button" class="dn-btn tonal s3-danger" onclick="RC50.s3.visitDel('${e(v.id)}')">حذف</button></div></article>`).join('')||R.card(R.empty('لا توجد زيارات مسجلة')));
  }});

  // ---------- staff monitor (supervision) ----------
  R.page('supervision',{title:'متابعة المحفظين',roles:['admin','supervisor'],render:async()=>{
    const d=await load(true),adm=role()==='admin';if(!adm&&S3.tabv==='supervisors')S3.tabv='teachers';
    const sups=d.staff.filter(p=>p.role==='supervisor'),tchs=d.staff.filter(p=>p.role==='teacher'),hn=Object.fromEntries(d.halaqas.map(h=>[h.id,h.name]));
    const rowsT=tchs.map(p=>{const o=d.byC[p.id]||{n:0,d:new Set,c:0,last:''},ov=d.ov[p.id]||{},hs=d.halaqas.filter(h=>h.tids.includes(p.id)),ids=new Set(hs.map(h=>h.id)),
      days=ov.session_days!=null?+ov.session_days:o.d.size,pct=d.mDays>0?rate(days,d.mDays):null,vr=d.visits.filter(v=>ids.has(v.halaqa_id)&&v.visit_date>=todayS().slice(0,8)+'01');
      const sc_=vr.map(v=>['organization_score','teaching_score','followup_score'].filter(k=>v[k]!=null).map(k=>+v[k])).filter(a=>a.length).map(a=>a.reduce((x,y)=>x+y,0)/a.length);
      return {p,hs,pct,sessions:ov.sessions!=null?+ov.sessions:o.n,days,closed:ov.closed_sessions!=null?+ov.closed_sessions:o.c,rec:ov.recitations,last:ov.last_session||o.last||'—',vr:vr.length,score:sc_.length?sc_.reduce((x,y)=>x+y,0)/sc_.length:null,
        open:d.visits.filter(v=>ids.has(v.halaqa_id)&&val(v.action_items)&&!v.action_done).length}});
    const rowsS=sups.map(p=>{const mine=(state.halaqas||[]).filter(h=>h.supervisor_id===p.id),made=d.visits.filter(v=>v.supervisor_id===p.id&&v.visit_date>=todayS().slice(0,8)+'01'),vis=new Set(made.map(v=>v.halaqa_id));
      return {p,total:mine.length,visited:mine.filter(h=>vis.has(h.id)).length,made:made.length,last:made[0]?.visit_date||'—'}});
    const lab=pct=>pct==null?['لا بيانات','']:pct>=80?['ممتاز','ok']:pct>=50?['جيد','warn']:['يحتاج متابعة','bad'];
    const av=p=>p.avatar_path&&String(p.avatar_path).startsWith('data:image/')?`<img class="s3-av" alt="" src="${p.avatar_path}">`:`<span class="s3-av ph">${e((p.full_name||'؟').trim()[0]||'؟')}</span>`;
    const tabs=[['teachers','المحفظون'],...(adm?[['supervisors','المشرفون']]:[]),['compare','المقارنة']];
    let body='';
    if(S3.tabv==='teachers')body=rowsT.map(r=>{const [l,c]=lab(r.pct),o=S3.open===r.p.id;return `<article class="s3-card ${c}"><button type="button" class="s3-row" onclick="RC50.s3.toggle('${e(r.p.id)}')">${av(r.p)}<div><b>${e(r.p.full_name)}</b><small>${e(r.hs.map(h=>h.name).join('، ')||'بلا حلقة')}</small></div><span class="s3-pill ${c}">${e(r.pct==null?l:`${l} · ${r.pct}%`)}</span></button>
      ${o?`<div class="s3-more"><small>جلسات الشهر: ${r.sessions} · أيام النشاط: ${r.days} من ${d.mDays} · جلسات مُنهاة: ${r.closed}</small><small>التسميعات: ${r.rec==null?'—':r.rec} · آخر جلسة: ${e(r.last)}</small><small>زيارات المشرف له هذا الشهر: ${r.vr}${r.score!=null?` · متوسط التقييم ${num1(r.score)}/5`:''}</small>${r.open?`<small class="s3-badtx">إجراءات مطلوبة منه لم تُنفّذ: ${r.open}</small>`:''}${val(r.p.phone)?`<small>الهاتف: ${e(r.p.phone)}</small>`:''}
        <div class="s3-acts"><button type="button" class="dn-btn tonal" onclick="RC50.s3.alert('${e(r.p.id)}','${e(r.p.full_name)}','${e(r.hs[0]?.id||'')}','')">إرسال تنبيه</button>${r.hs[0]?`<button type="button" class="dn-btn tonal" onclick="RC50.s3.visitNew('${e(r.hs[0].id)}')">تسجيل زيارة</button>`:''}</div></div>`:''}</article>`}).join('')||R.card(R.empty('لا يوجد محفظون'));
    else if(S3.tabv==='supervisors')body=rowsS.map(r=>{const pct=r.total?rate(r.visited,r.total):null,[l,c]=lab(pct),o=S3.open===r.p.id;return `<article class="s3-card ${c}"><button type="button" class="s3-row" onclick="RC50.s3.toggle('${e(r.p.id)}')">${av(r.p)}<div><b>${e(r.p.full_name)}</b><small>${r.total} حلقة تحت إشرافه</small></div><span class="s3-pill ${c}">${e(pct==null?l:`${l} · ${pct}%`)}</span></button>
      ${o?`<div class="s3-more"><small>حلقات زارها هذا الشهر: ${r.visited} من ${r.total} · عدد الزيارات: ${r.made} · آخر زيارة: ${e(r.last)}</small><div class="s3-acts"><button type="button" class="dn-btn tonal" onclick="RC50.s3.alert('${e(r.p.id)}','${e(r.p.full_name)}','','')">إرسال تنبيه</button></div></div>`:''}</article>`}).join('')||R.card(R.empty('لا يوجد مشرفون'));
    else{
      const M={commit:['التزام المحفظين',rowsT.map(r=>[r.p.full_name,r.pct||0,r.pct==null?'—':r.pct+'%'])],recited:['التسميع اليوم',d.halaqas.map(h=>[h.name,rate(h.recited,h.students),`${rate(h.recited,h.students)}% (${h.recited} من ${h.students})`])],sessions:['جلسات الشهر',d.halaqas.map(h=>[h.name,h.monthSessions,h.monthSessions+' جلسة'])],visit:['تقييم الزيارات',d.halaqas.filter(h=>h.lastScore!=null).map(h=>[h.name,h.lastScore*20,num1(h.lastScore)+' من 5'])]};
      const rk=(M[S3.metricv]||M.commit)[1].slice().sort((a,b)=>b[1]-a[1]),top=Math.max(1,...rk.map(x=>x[1]));
      body=R.pills(Object.entries(M).map(([k,v])=>[k,v[0]]),S3.metricv,'RC50.s3.metric')+(rk.map((x,i)=>`<article class="s3-card ${i===0?'ok':''}"><div class="s3-top"><b>${i+1}. ${e(x[0])}</b><small>${e(x[2])}</small></div><div class="s3-prog"><i style="width:${Math.round(x[1]/top*100)}%"></i></div></article>`).join('')||R.card(R.empty('لا توجد بيانات كافية للمقارنة بعد')));
    }
    const g=rowsT.filter(r=>(r.pct||0)>=80).length,lo=rowsT.filter(r=>r.pct!=null&&r.pct<50).length;
    return `<div class="dn-tiles">${R.tile('المحفظون',tchs.length)}${R.tile('ملتزمون',g)}${R.tile('يحتاجون متابعة',lo)}</div>${R.seg(tabs,S3.tabv,'RC50.s3.tab')}${body}`;
  }});
  S3.toggle=id=>{S3.open=S3.open===id?null:id;render()};S3.tab=v=>{S3.tabv=v;S3.open=null;render()};S3.metric=v=>{S3.metricv=v;render()};

  // ---------- navigation ----------
  const origSvg=window.navSvg;
  window.navSvg=function(p){return origSvg.call(this,p==='visits'?'supervision':p)};
  window.iconFor=window.navSvg;
  const prevNav=window.navItems;
  window.navItems=function(){
    const r=role(),items=prevNav.apply(this,arguments);
    if(r==='supervisor'){
      const nt=items.find(x=>x[0]==='notifications')||['notifications','الإشعارات'];
      return [['home','الرئيسية'],nt,['halaqas','الحلقات'],['supervision','متابعة المحفظين'],['visits','الزيارات'],['sessions','الجلسات اليومية'],['students','الطلاب'],['reports','التقارير'],['ranking','الترتيب والإحصائيات'],['community','الإعلانات والتواصل'],['approvals','طلبات المحفّظين'],['settings','الإعدادات']];
    }
    if(r==='admin'){
      const out=items.map(x=>x[0]==='supervision'?['supervision','متابعة المحفظين والمشرفين']:x),i=out.findIndex(x=>x[0]==='supervision');
      if(!out.some(x=>x[0]==='visits'))out.splice(i<0?out.length:i+1,0,['visits','زيارات المشرفين']);
      if(!out.some(x=>x[0]==='observer_requests')){const a=out.findIndex(x=>x[0]==='approvals');out.splice(a<0?out.length:a+1,0,['observer_requests','طلبات المراقبين'])}
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
  window.render=async function(){const r=await prevRender.apply(this,arguments);if(state?.page==='settings')setTimeout(fillSupport,0);return r};

  // ---------- admin: observer (donor) requests ----------
  const KIND={reward:'مكافأة',honor:'تكريم',follow_up:'متابعة',other:'أخرى'},STAT={approved:['تمت الموافقة','ok'],declined:['لم تتم الموافقة','bad']};
  R.page('observer_requests',{title:'طلبات المراقبين',roles:['admin'],render:async()=>{
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
})();
