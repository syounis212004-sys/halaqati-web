/* Halaqati RC27.40 — native-parity session roster (web twin of SessionRosterScreen / RecitationDialog in CoreScreens.kt).
   Replaces sessionRosterPage + the recitation entry sheet. Data behaviour is the legacy one: attendance / behaviour / reports
   go through the same offline queue (localAttendanceSave, enqueueOffline('behavior'), saveReportOffline) so sync, live-sync
   and permissions keep working. Markup is built from the NX kit (nx.js); classes prefixed .nr- (native-roster.css). */
(function(){
  'use strict';
  const NX=window.NX;
  if(!NX)return;
  const h=NX.h,ic=NX.icon;
  const NOT_RECITED='halaqati:not_recited';
  const MARKER_OFF=['', 'normal', null, undefined];
  const NS=window.NS_ROSTER=window.NS_ROSTER||{};
  window.NSR=NS;

  // ---------------------------------------------------------------- helpers
  const plain=n=>{n=Math.round((Number(n)||0)*100)/100;return String(n)};
  const arr=v=>Array.isArray(v)?v:[];
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[ً-ٰٟ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const sid_=v=>String(v==null?'':v);
  const canManage=()=>typeof roleCanManage==='function'&&roleCanManage();
  const uid=()=>state.user?.id||null;
  const sessionOf=id=>(state.sessions||[]).find(x=>sid_(x.id)===sid_(id));
  const studentOf=id=>(state.students||[]).find(x=>sid_(x.id)===sid_(id));
  const halaqaOf=se=>(state.halaqas||[]).find(x=>x.id===se?.halaqa_id);
  const isProgramSession=se=>{const hq=halaqaOf(se);return (typeof rc27IsProgram==='function'&&rc27IsProgram(hq))||['tajweed','tilawah'].includes(se?.session_type)};
  const isLesson=se=>se?.session_type==='lesson';
  const sesName=t=>(typeof sesAr!=='undefined'&&sesAr[t])||t||'';
  const isTathbit=st=>st?.track_code==='tathbit';
  const syncSoon=()=>{if(navigator.onLine&&typeof syncOfflineQueue==='function')setTimeout(()=>syncOfflineQueue({refreshAfter:false}),25)};
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const timeout=(p,ms)=>Promise.race([Promise.resolve(p),wait(ms)]);
  const surahName=s=>(typeof surahs!=='undefined'&&surahs[s-1])||`سورة ${s}`;
  const maxAyah=s=>(typeof ayahCounts!=='undefined'&&ayahCounts[s-1])||1;

  const BEH=[['excellent','ممتاز'],['good','جيد'],['normal','طبيعي'],['needs_attention','يحتاج انتباه'],['warning','تنبيه']];
  const behLabel=v=>({excellent:'ممتاز',good:'جيد',needs_attention:'يحتاج انتباه',warning:'تنبيه'})[v]||'طبيعي';
  const actLabel=t=>({tathbit:'تثبيت',new_hifz:'حفظ',review_near:'مراجعة قريبة',review_far:'تثبيت',sard:'سرد',tilawah:'تلاوة',test:'اختبار'})[t]||t||'';
  const evalLabel=v=>({excellent:'ممتاز',very_good:'جيد جدًا',good:'جيد',repeat:'يحتاج إعادة'})[v]||'غير مقيّم';
  const canonType=t=>t==='tathbit'?'review_far':t;

  // ---------------------------------------------------------------- module state
  const R=NS.R={sid:null,expanded:null,filter:'all',track:'all',sort:'priority',rank:null,rankKey:'',rosterFor:null,loading:false,refreshing:false,message:null,msgKind:'warning',msgTimer:0,planCache:new Map(),planWait:new Set(),rec:null,pick:null,att:null,note:null,act:null,epoch:0};

  // ---------------------------------------------------------------- Quran layout helpers (page <-> ayah <-> QCF lines)
  const layout=()=>{try{return typeof loadQuranLayoutCache==='function'?loadQuranLayoutCache():null}catch(_e){return null}};
  let pgIdx=null,pgIdxFor=null;
  function pageMap(L){
    if(pgIdx&&pgIdxFor===L)return pgIdx;
    const m=new Map();
    for(let g=1;g<L.page.length;g++){const p=L.page[g];if(!p)continue;const r=m.get(p);if(!r)m.set(p,[g,g]);else r[1]=g}
    pgIdx=m;pgIdxFor=L;return m;
  }
  const locOfG=g=>{const x=surahAyahFromGlobal(g);return {s:x[0],a:x[1]}};
  function pageStartLoc(p){const L=layout();if(!L||!p)return null;const r=pageMap(L).get(+p);return r?locOfG(r[0]):null}
  function pageEndLoc(p){const L=layout();if(!L||!p)return null;const r=pageMap(L).get(+p);return r?locOfG(r[1]):null}
  function pageAyahs(p){const L=layout();if(!L)return [];const r=pageMap(L).get(+p);if(!r)return [];const out=[];for(let g=r[0];g<=r[1];g++)out.push(locOfG(g));return out}
  function endpointOfLine(key,preferLast){
    const L=layout(),m=/^(\d+):(\d+)$/.exec(String(key||''));if(!L||!m)return null;
    const r=pageMap(L).get(+m[1]);if(!r)return null;const line=+m[2],c=[];
    for(let g=r[0];g<=r[1];g++){const f=Number(L.first?.[g]||0),l=Number(L.last?.[g]||f);if(line>=f&&line<=l)c.push(g)}
    const g=preferLast?c.at(-1):c[0];return g?locOfG(g):null;
  }
  const linesForRange=(L,ss,sa,es,ea)=>{const gs=globalAyah(ss,sa),ge=globalAyah(es,ea),out=[];for(let g=gs;g<=ge;g++){const p=Number(L.page?.[g]||0),a=Number(L.first?.[g]||0),b=Number(L.last?.[g]||a);if(!p||!a)continue;for(let l=a;l<=b;l++)out.push(`${p}:${l}`)}return out};

  /** RecitationParityRules.quranRangeLabel */
  function rangeLabel(sS,sA,eS,eA,sP,eP){
    let from=sS&&sA?{s:+sS,a:+sA}:pageStartLoc(sP),to=eS&&eA?{s:+eS,a:+eA}:(pageEndLoc(eP||sP)||from);
    if(from&&to){
      return from.s===to.s?`سورة ${surahName(from.s)} · من الآية ${from.a} إلى الآية ${to.a}`:`من سورة ${surahName(from.s)} آية ${from.a} إلى سورة ${surahName(to.s)} آية ${to.a}`;
    }
    if(sP||eP){const a=sP||eP,b=eP||sP;return a===b?`صفحة ${a}`:`صفحات ${a}–${b}`}
    return 'نطاق قرآني محفوظ';
  }
  const recRangeText=r=>{
    const sd=r.selection_data||{};
    if(!r.start_surah&&!r.end_surah&&!r.start_page&&!r.end_page){
      if(arr(r.selected_surahs).length)return arr(r.selected_surahs).map(surahName).join('، ');
      if(arr(sd.selected_juz).length)return `الأجزاء ${sd.selected_juz.join('، ')}`;
      if(Number(r.pages_count)>0)return `${plain(r.pages_count)} صفحة`;
    }
    return rangeLabel(r.start_surah,r.start_ayah,r.end_surah,r.end_ayah,r.start_page,r.end_page);
  };

  // ---------------------------------------------------------------- SessionWorkflowRules
  const rosterOk=id=>R.rosterFor===sid_(id);
  const attOf=sid=>rosterOk(R.sid)?rosterAttendance(sid):null;
  const noteOf=sid=>rosterOk(R.sid)?rosterNote(sid):null;
  const recsOf=sid=>rosterOk(R.sid)?rosterRecitations(sid):[];
  const hasActivity=n=>!!n&&(Number(n.activity_max_score||0)>0||['good','excellent'].includes(n.participation));
  function studentState(se,st){
    const a=attOf(st.id)?.status||'',n=noteOf(st.id),part=n?.participation,has=isLesson(se)?hasActivity(n):recsOf(st.id).length>0;
    if(!a||a==='unmarked')return part===NOT_RECITED?'NOT_RECITED':'UNMARKED';
    if(a==='absent')return 'ABSENT';
    if(a==='excused')return 'EXCUSED';
    if(a==='late'||a==='present'){if(has)return 'RECITED';if(part===NOT_RECITED)return 'NOT_RECITED';return a==='late'?'LATE':'PRESENT'}
    return has?'RECITED':'UNMARKED';
  }
  const summaryOf=states=>({total:states.length,unmarked:states.filter(x=>x==='UNMARKED').length,notRecited:states.filter(x=>x==='NOT_RECITED').length,recited:states.filter(x=>x==='RECITED').length,present:states.filter(x=>['PRESENT','LATE','NOT_RECITED','RECITED'].includes(x)).length,absent:states.filter(x=>x==='ABSENT'||x==='EXCUSED').length});
  const matchesFilter=(s,f)=>f==='unmarked'?s==='UNMARKED':f==='not_recited'?s==='NOT_RECITED':f==='recited'?s==='RECITED':f==='present_pending'?(s==='PRESENT'||s==='LATE'):f==='absent'?(s==='ABSENT'||s==='EXCUSED'):true;
  const priority=s=>({UNMARKED:0,PRESENT:1,LATE:1,NOT_RECITED:2,RECITED:3,EXCUSED:4,ABSENT:5})[s];

  function studentsOf(se){
    const rows=(typeof activeStudents==='function'?activeStudents():state.students||[]).filter(x=>x.halaqa_id===se.halaqa_id);
    return rows;
  }
  function queueInfo(se){
    const out={queued:new Set(),blocked:new Set(),total:0};
    try{
      const q=typeof readOfflineQueue==='function'?readOfflineQueue():[];out.total=q.length;
      const map=typeof readSessionMap==='function'?readSessionMap():{};
      const ids=new Set([sid_(se.id),sid_(map[se.id]||se.id)]);
      for(const op of q){
        const osid=sid_(typeof sessionIdForOfflineOp==='function'?sessionIdForOfflineOp(op):'');
        if(!ids.has(osid))continue;
        const s=sid_(op.payload?.student_id||op.payload?.studentId||'');if(!s)continue;
        (op.status==='failed'?out.blocked:out.queued).add(s);
      }
    }catch(_e){}
    return out;
  }

  // ---------------------------------------------------------------- smart plan (RC27 phases engine twin of PlanSnapshot)
  function planSnapshots(sid,date){
    const key=sid_(sid)+'|'+date,hit=R.planCache.get(key);if(hit)return hit;
    const P=window.RC27Phases,A=window.RC27PhaseActivities;let out=[];
    if(P&&A&&P.S){
      const plans=arr(P.S.plans).filter(p=>p.scope_type==='student'&&sid_(p.student_id)===sid_(sid)&&p.status==='active'&&String(p.start_date).slice(0,10)<=date&&String(p.end_date).slice(0,10)>=date);
      for(const plan of plans){try{const sn=P.snapshot(plan,date,sid);const acts=A(plan,sn,date);if(acts?.length)out.push({plan,acts})}catch(e){console.warn('roster plan snapshot',e)}}
    }
    R.planCache.set(key,out);return out;
  }
  async function ensurePlans(ids){
    const P=window.RC27Phases;if(!P)return;
    try{await timeout(P.load(false),4000)}catch(_e){}
    try{await timeout(P.loadRecs(ids),5000)}catch(_e){}
    R.planCache.clear();
  }
  window.addEventListener('halaqati:reportchange',()=>R.planCache.clear());
  window.addEventListener('halaqati:sessionchange',()=>R.planCache.clear());

  const KIND_AR={hifz:'حفظ',review:'مراجعة',sard:'سرد',tathbit:'إعادة / تثبيت'};
  function assignmentText(a){
    const kind=KIND_AR[a.kind]||'مقرر';
    let range=null;
    if(a.lineKeys?.length){
      const e=endpointOfLine(a.lineKeys.at(-1),true),s=a.start?{s:a.start.s,a:a.start.a}:endpointOfLine(a.lineKeys[0],false);
      if(s&&e)range=rangeLabel(s.s,s.a,e.s,e.a);
    }
    if(!range){
      if(a.startPage||a.endPage)range=rangeLabel(null,null,null,null,a.startPage,a.endPage);
      else range='لا يوجد مقدار اليوم';
    }
    return `${kind}: ${range}`;
  }
  const actKeyForType=(t,st)=>{
    if(t==='tilawah')return null;
    if(t==='sard')return 'sard';
    if(t==='tathbit'||(t==='review_far'&&isTathbit(st)))return 'tathbit';
    if(['review_near','review_far','review'].includes(t))return 'review';
    return 'hifz';
  };
  /** Android snapshotForActivity + activity pick */
  function snapshotFor(sid,type,date,planId){
    const st=studentOf(sid),key=actKeyForType(type,st);if(!key)return null;
    const list=planSnapshots(sid,date);
    if(planId){const p=list.find(x=>sid_(x.plan.id)===sid_(planId));if(p)return {plan:p.plan,act:p.acts.find(a=>a.key===key)||null,key}}
    const pick=list.find(x=>x.acts.some(a=>a.key===key&&a.scheduledToday))||list.find(x=>x.acts.some(a=>a.key===key))||list[0];
    return pick?{plan:pick.plan,act:pick.acts.find(a=>a.key===key)||null,key}:null;
  }
  function rangeFromAssignment(a){
    if(!a)return null;
    if(a.lineKeys?.length){
      const e=endpointOfLine(a.lineKeys.at(-1),true),s=a.start?{s:a.start.s,a:a.start.a}:endpointOfLine(a.lineKeys[0],false);
      if(s&&e){
        const gs=globalAyah(s.s,s.a),ge=globalAyah(e.s,e.a);
        return {mode:'ayahs',startSurah:s.s,startAyah:s.a,endSurah:e.s,endAyah:e.a,lineKeys:a.lineKeys.slice(),pages:a.lineKeys.length/15,startPage:a.startPage||null,endPage:a.endPage||null,ayahs:ge>=gs?ge-gs+1:0,surahs:Math.abs(e.s-s.s)+1,selectedSurahs:[],selectedJuz:[]};
      }
    }
    if(a.startPage&&a.endPage){
      return {mode:'pages',startSurah:null,startAyah:null,endSurah:null,endAyah:null,lineKeys:[],pages:Number(a.pages)||(a.endPage-a.startPage+1),startPage:a.startPage,endPage:a.endPage,ayahs:0,surahs:0,selectedSurahs:[],selectedJuz:[]};
    }
    return null;
  }

  // ---------------------------------------------------------------- snackbar / message
  function snack(text,o={}){
    let el=document.getElementById('nrSnack');
    if(!el){el=document.createElement('div');el.id='nrSnack';el.className='nr-snack';el.setAttribute('role','status');document.body.appendChild(el)}
    clearTimeout(snack.t);
    window.__nrSnackAct=()=>{el.classList.remove('show');try{o.onAction&&o.onAction()}catch(e){console.error(e)}};
    el.innerHTML=`<span>${h(text)}</span>${o.action?`<button type="button" onclick="__nrSnackAct()">${h(o.action)}</button>`:''}`;
    el.classList.add('show');
    snack.t=setTimeout(()=>el.classList.remove('show'),o.action?7000:3200);
  }
  function setMessage(text,kind){
    R.message=text;R.msgKind=kind||(String(text||'').startsWith('تم')?'success':'warning');
    clearTimeout(R.msgTimer);if(text)R.msgTimer=setTimeout(()=>{R.message=null;setHtml('nrTop',topHtml(curSession()))},6000);
    setHtml('nrTop',topHtml(curSession()));
  }

  // ---------------------------------------------------------------- region rendering
  const $id=id=>document.getElementById(id);
  const curSession=()=>sessionOf(R.sid);
  function setHtml(id,html){const el=$id(id);if(el&&html!=null)el.innerHTML=html}
  function rootEl(){return $id('nrRoster')}
  function refreshAll(){
    const se=curSession();if(!rootEl()||!se)return false;
    setHtml('nrTop',topHtml(se));setHtml('nrSummary',summaryHtml(se));setHtml('nrDesk',deskFiltersHtml(se));setHtml('nrList',listHtml(se));
    const f=$id('nrFooter');if(f)f.innerHTML=footerHtml(se);
    return true;
  }
  function refreshCard(sid){
    const se=curSession(),st=studentOf(sid),el=$id('roster_'+sid);
    if(!se||!st)return;
    if(!el){setHtml('nrList',listHtml(se))}else{const tmp=document.createElement('div');tmp.innerHTML=cardHtml(se,st,queueInfo(se));const n=tmp.firstElementChild;if(n)el.replaceWith(n)}
    setHtml('nrSummary',summaryHtml(se));setHtml('nrDesk',deskFiltersHtml(se));
  }
  NS.refresh=()=>{if(!refreshAll()&&state.sessionView&&typeof render==='function')render()};

  // ---------------------------------------------------------------- UI pieces
  const strip=(sm,lesson)=>{
    const items=lesson?[['غير مرصود',sm.unmarked,'PendingActions'],['شارك',sm.recited,'EmojiEvents'],['حاضر',sm.present,'CheckCircle'],['غائب',sm.absent,'Cancel']]:
      [['غير مرصود',sm.unmarked,'PendingActions'],['لم يُسمّع',sm.notRecited,'VoiceOverOff'],['سمّع',sm.recited,'Mic'],['حاضر',sm.present,'CheckCircle'],['غائب',sm.absent,'Cancel']];
    return `<div class="nr-strip">${items.map(([l,v,i])=>`<div class="nr-chipm"><span class="nr-chipm-i">${ic(i,17)}</span><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
  };

  function offlineBlock(){
    let out='';
    try{
      const verified=state.networkVerified,off=state.offline,pend=state.pendingSync;
      if(!verified||off||pend){
        const st=typeof syncQueueStats==='function'?syncQueueStats():{failed:0};
        out+=NX.notice(`<b>${verified?'بيانات محلية بانتظار المزامنة':'وضع العمل دون إنترنت'}</b><br>${pend?`${pend} عملية محفوظة بأمان في قاعدة الجهاز${st.failed?` · ${st.failed} تحتاج إعادة محاولة`:''}. ستتم المزامنة تلقائياً عند عودة الاتصال.`:'الحلقات والفئات والطلاب والجلسات والحضور والسلوك والتسميع متاحة من النسخة المحلية.'}`,'warning');
      }
    }catch(_e){}
    return out;
  }
  function topHtml(se){
    if(!se)return '';
    const mg=canManage(),pend=Number(state.pendingSync||0),q=queueInfo(se),lesson=isLesson(se);
    const status=se.status==='closed'?NX.pill('مرفوعة','success',{icon:'CloudDone'}):se._offline?NX.pill('محفوظة محلياً','warning',{icon:'CloudUpload'}):se.status==='cancelled'?NX.pill('ملغاة','danger'):'';
    const items=[];
    if(mg){
      if(se.status==='closed')items.push({label:'تعديل الجلسة',icon:'Edit',onclick:()=>NS.reopen()});
      else items.push({label:'رفع الجلسة',icon:'CloudUpload',onclick:()=>NS.upload()});
      items.push({label:'تعديل بيانات الجلسة',icon:'EditNote',onclick:()=>editSessionData(se.id)});
      if(lesson&&['weekly','biweekly'].includes(sessionActivityData(se).recurrence)&&typeof duplicateActivitySession==='function')items.push({label:'نسخ للموعد القادم',icon:'ContentCopy',onclick:()=>duplicateActivitySession(se.id)});
      items.push({label:'حذف الجلسة نهائياً',icon:'DeleteForever',danger:true,onclick:()=>NS.remove()});
    }
    const syncNote=q.blocked.size?NX.notice(`${q.blocked.size} طالب لديهم عملية مزامنة تحتاج مراجعة`,'error'):(pend>0||q.queued.size)?NX.notice(`${Math.max(q.queued.size,pend)} عملية محفوظة محليًا بانتظار الرفع`,'warning'):'';
    return `${offlineBlock()}
      <header class="nr-head">
        ${NX.iconBtn('ArrowBack',{title:'رجوع',onclick:'closeSessionRoster()',cls:'nr-back'})}
        <div class="nr-head-t"><h2>${h(se.title||sesName(se.session_type))}</h2><p>${h(se.session_date||'')} · ${h(sesName(se.session_type))}${status?'':''}</p></div>
        <div class="nr-head-x">${status}${pend>0?NX.pill(`${pend} معلّق`,'warning'):''}</div>
        ${NX.iconBtn('Refresh',{title:'تحديث الجلسة',onclick:'NSR.reload()',cls:'nr-refresh'})}
        ${mg?NX.iconBtn('Edit',{title:'تعديل بيانات الجلسة',onclick:`editSessionData('${h(se.id)}')`}):''}
        ${items.length?NX.kebab(items,{title:'خيارات الجلسة'}):''}
      </header>
      ${R.refreshing?'<div class="nr-loading"><i></i></div>':''}
      ${se.status==='closed'?`<div class="nr-closed">${ic('CloudDone',20)}<span>الجلسة مرفوعة — التسميع والملاحظات للقراءة فقط.</span>${mg?NX.btn('تعديل الجلسة',{kind:'tonal',small:true,onclick:'NSR.reopen()'}):''}</div>`:''}
      ${syncNote}
      ${R.message?NX.notice(h(R.message),R.msgKind):''}`;
  }

  function statusLabel(s,n){return ({UNMARKED:'لم يُرصد بعد',NOT_RECITED:'لم يُسمّع',RECITED:`تم التسميع ${n}`,ABSENT:'غائب',EXCUSED:'غائب بعذر',LATE:'متأخر',PRESENT:'حاضر'})[s]}

  function listCtx(se){
    const all=studentsOf(se),lesson=isLesson(se),q=norm(state.sessionSearch);
    const base=all.filter(st=>(R.track==='all'||st.track_code===R.track)&&(!q||norm(st.full_name).includes(q)||sid_(st.id).includes(q)));
    const states=new Map(all.map(st=>[st.id,studentState(se,st)]));
    const key=[se.id,R.sort,all.length,R.epoch,rosterOk(se.id)].join('|');
    if(R.rankKey!==key){R.rankKey=key;R.rank=new Map(all.map(st=>[st.id,priority(states.get(st.id))]))}
    let list=base.filter(st=>matchesFilter(states.get(st.id),R.filter));
    const byName=(a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar');
    list=R.sort==='alpha'?list.sort(byName):list.sort((a,b)=>((R.rank.get(a.id)??priority(states.get(a.id)))-(R.rank.get(b.id)??priority(states.get(b.id))))||byName(a,b));
    return {all,base,list,states,lesson,summary:summaryOf(base.map(st=>states.get(st.id)))};
  }
  function summaryHtml(se){
    const c=listCtx(se),sm=c.summary;
    const l1=c.lesson?`شارك ${sm.recited} · غائب ${sm.absent}`:`سمّع ${sm.recited} · لم يُسمّع ${sm.notRecited} · غائب ${sm.absent}`;
    return `<div class="nr-summary"><div class="nr-summary-t"><b>${l1}</b><span>غير مرصود ${sm.unmarked} · حاضر ${sm.present}</span></div>
      <div class="nr-summary-strip">${strip(sm,c.lesson)}</div>
      ${NX.btn('خيارات الجلسة',{kind:'tonal',icon:'Tune',onclick:'NSR.openFilters()',cls:'nr-filter-btn'})}</div>
      <div class="nr-count">المعروض: ${c.list.length} من ${c.all.length}</div>`;
  }
  const STATUS_FILTERS=[['all','الكل'],['unmarked','لم يُرصد'],['not_recited','لم يُسمّع'],['present_pending','حاضر بلا تسميع'],['recited','تم التسميع'],['absent','الغياب']];
  function deskFiltersHtml(se){
    const c=listCtx(se),lesson=c.lesson;
    const cnt=f=>c.base.filter(st=>matchesFilter(c.states.get(st.id),f)).length;
    const filters=lesson?STATUS_FILTERS.filter(([k])=>k!=='not_recited'&&k!=='present_pending').map(([k,l])=>k==='recited'?[k,'شارك']:[k,l]):STATUS_FILTERS;
    return `${NX.chips(filters.map(([k,l])=>({label:`${l} <b>${cnt(k)}</b>`,selected:R.filter===k,check:false,onclick:`NSR.setFilter('${k}')`})))}
      <div class="nr-desk-sort">${NX.chips([['priority','الأولوية'],['alpha','أبجدي']].map(([k,l])=>({label:l,selected:R.sort===k,check:false,icon:k==='priority'?'SwapVert':'FormatListNumbered',onclick:`NSR.setSort('${k}')`})))}</div>`;
  }
  function listHtml(se){
    if(!rosterOk(se.id))return NX.skeleton(3);
    const c=listCtx(se);
    if(!c.list.length)return NX.empty('لا يوجد طلاب يطابقون البحث أو الفلتر',{icon:'SearchOff'});
    const q=queueInfo(se);
    return c.list.map(st=>cardHtml(se,st,q)).join('');
  }
  function footerHtml(se){
    return NX.btn('إغلاق صفحة الجلسة',{kind:'outlined',icon:'DoneAll',full:true,onclick:'NSR.closeConfirm()',cls:'nr-close-btn'});
  }

  // student card (GoldenStudentCard-style row of SessionRosterScreen)
  function cardHtml(se,st,q){
    const sid=st.id,lesson=isLesson(se),stt=studentState(se,st),recs=recsOf(sid),note=noteOf(sid),status=attOf(sid)?.status||'';
    const blocked=q.blocked.has(sid_(sid)),queued=q.queued.has(sid_(sid)),syncLabel=blocked?'خطأ مزامنة':queued?'بانتظار المزامنة':'';
    const open=R.expanded===sid,closed=se.status==='closed';
    const latest=recs.at(-1);
    const sub=[lesson&&stt==='RECITED'?'تم تسجيل المشاركة':statusLabel(stt,recs.length),behLabel(note?.behavior||'normal'),syncLabel].filter(Boolean).join(' · ');
    const quick=closed?'':`<div class="nr-quick" onclick="event.stopPropagation()">
        <button type="button" class="nr-qb ${status==='present'||status==='late'?'on-ok':''}" title="حاضر" aria-label="حاضر" onclick="NSR.setAtt('${h(sid)}','present')">${ic('CheckCircle',22)}</button>
        <button type="button" class="nr-qb ${status==='absent'?'on-bad':''}" title="غائب" aria-label="غائب" onclick="NSR.setAtt('${h(sid)}','absent')">${ic('Cancel',22)}</button>
        ${lesson?'':`<button type="button" class="nr-qb" title="تسميع" aria-label="تسميع" onclick="NSR.recite('${h(sid)}')">${ic('Mic',22)}</button>`}
      </div>`;
    return `<article class="nr-card nr-st-${stt.toLowerCase()} ${open?'open':''} ${blocked?'is-blocked':''}" id="roster_${h(sid)}" data-roster-name="${h(norm(st.full_name))}">
      <div class="nr-card-main" role="button" tabindex="0" aria-expanded="${open}" onclick="NSR.toggle('${h(sid)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();NSR.toggle('${h(sid)}')}">
        <span class="nr-av">${h((String(st.full_name||'').trim()[0])||'ط')}</span>
        <div class="nr-id"><b class="nr-name">${h(st.full_name)}</b><span class="nr-sub ${blocked?'bad':''}">${h(sub)}</span></div>
        ${syncLabel?`<span class="nr-sync ${blocked?'bad':''}" title="${h(syncLabel)}">${ic(blocked?'ErrorOutline':'CloudUpload',22)}</span>`:''}
        ${quick}
        <span class="nr-chev" aria-label="${open?'طي تفاصيل الطالب':'فتح تفاصيل الطالب'}">${ic(open?'ExpandLess':'ExpandMore',24)}</span>
      </div>
      ${!lesson&&latest?`<div class="nr-latest">${ic('AutoStories',16)}<span>${h(actLabel(latest.activity_type))} · ${h(recRangeText(latest))} · ${plain(latest.pages_count)} ص</span></div>`:''}
      ${open?detailHtml(se,st):''}
    </article>`;
  }

  function choiceBtn(kind,sid,label,value,icon){
    return `<button type="button" class="nr-choice" onclick="event.stopPropagation();NSR.menu(this,'${kind}','${h(sid)}')">${ic(icon,18)}<span class="nr-choice-t"><small>${label}</small><b>${h(value)}</b></span>${ic('ArrowDropDown',24)}</button>`;
  }
  function detailHtml(se,st){
    const sid=st.id,lesson=isLesson(se),prog=isProgramSession(se),closed=se.status==='closed';
    const status=attOf(sid)?.status||'',note=noteOf(sid),beh=note?.behavior||'normal',stt=studentState(se,st);
    const attLabel=({present:'حاضر',absent:'غائب',excused:'غائب بعذر',late:'متأخر'})[status]||'لم يُرصد';
    const attIcon=status==='absent'?'Cancel':status==='late'?'Schedule':status==='excused'?'Info':'CheckCircle';
    const menus=`<div class="nr-menus">${choiceBtn('att',sid,'الحضور',attLabel,attIcon)}${choiceBtn('beh',sid,'السلوك',behLabel(beh),'EmojiEmotions')}</div>`;

    let plan='';
    if(!lesson){
      const snaps=planSnapshots(sid,se.session_date);
      plan=prog?NX.notice(`جلسة ${h(sesName(se.session_type))} مستقلة عن تقدم خطة الحفظ الأساسية.`,'info'):(snaps.length?planCardHtml(sid,se,snaps):'');
    }

    let recRows='';
    if(!lesson){
      recRows=recsOf(sid).map(r=>{
        const ta=r.selection_data?.tilawah_assessment;
        const safety=r.safety_percentage!=null?r.safety_percentage:(typeof computeRecitationV6==='function'?computeRecitationV6(r).safety_percentage:0);
        const meta=r.activity_type==='tilawah'&&ta?`${plain(r.pages_count)} ص · ${evalLabel(r.evaluation)} · لحن جلي ${ta.lahn_jali||0} · لحن خفي ${ta.lahn_khafi||0} · نتيجة ${plain(ta.overall_score!=null?ta.overall_score:safety)}%`:
          `${plain(r.pages_count)} ص · ${evalLabel(r.evaluation)} · ${r.mistakes||0} خطأ · ${r.prompts||0} تلقين · سلامة ${plain(safety)}%`;
        return `<div class="nr-rec">${ic('MenuBook',19)}<div class="nr-rec-t"><b>${h(actLabel(r.activity_type))} · ${h(recRangeText(r))}</b><span>${h(meta)}</span></div>
          ${closed?'':`<button type="button" class="nx-iconbtn" title="تعديل التسميع" aria-label="تعديل التسميع" onclick="NSR.recite('${h(sid)}','${h(r.activity_type)}',null,'${h(r.id)}')">${ic('Edit',22)}</button>
          <button type="button" class="nx-iconbtn nr-del" title="حذف التسميع" aria-label="حذف التسميع" onclick="NSR.delRec('${h(sid)}','${h(r.id)}')">${ic('DeleteOutline',22)}</button>`}
        </div>`;
      }).join('');
    }else{
      recRows=note&&(Number(note.activity_max_score||0)>0||note.participation)?`<div class="nr-rec">${ic('EmojiEvents',19)}<div class="nr-rec-t"><b>مشاركة اللقاء</b><span>${Number(note.activity_max_score||0)>0?`${plain(note.activity_score||0)} / ${plain(note.activity_max_score)} نقطة`:'بدون درجة رقمية'} · التفاعل: ${note.participation==='excellent'?'مميز':note.participation==='good'?'جيد':'عادي'}</span></div></div>`:`<div class="nr-hint">لم تُسجل مشاركة الطالب في اللقاء بعد.</div>`;
    }

    let quickActs='';
    if(!lesson){
      const keys=new Set(planSnapshots(sid,se.session_date).flatMap(s=>s.acts.map(a=>a.key)));
      const acts=prog?[['tilawah','تلاوة'],['test','اختبار']]:isTathbit(st)?[['tathbit','تثبيت']]:[['new_hifz','حفظ'],['review_near','مراجعة'],...((!keys.size||keys.has('sard'))?[['sard','سرد']]:[])];
      quickActs=`<div class="nr-acts" style="--n:${Math.min(4,acts.length)}">${acts.map(([k,l])=>`<button type="button" class="nx-btn nx-outlined nr-act" ${closed?'disabled':''} onclick="NSR.recite('${h(sid)}','${k}')"><span>${l}</span></button>`).join('')}</div>`;
    }
    const bottom=`<div class="nr-actions2">
        ${lesson?NX.btn(note&&hasActivity(note)?'تعديل المشاركة':'تسجيل المشاركة',{kind:'outlined',icon:'EmojiEvents',disabled:closed,onclick:`NSR.openActivity('${h(sid)}')`}):NX.btn('لم يُسمّع',{kind:'outlined',icon:'VoiceOverOff',disabled:closed||['absent','excused'].includes(status)||stt==='RECITED',onclick:`NSR.notRecited('${h(sid)}')`})}
        ${NX.btn('ملاحظة',{kind:'tonal',icon:'EditNote',disabled:closed,onclick:`NSR.openNote('${h(sid)}')`})}
      </div>`;
    return `<div class="nr-detail"><div class="nr-col-a">${menus}${plan}</div><div class="nr-col-b">${recRows}${quickActs}${bottom}</div></div>`;
  }

  // SessionSmartPlanCard + SmartActivityDutyRow
  function dutyRow(title,text,icon,action,sid,type,planId){
    return `<div class="nr-duty"><div class="nr-duty-h">${ic(icon,19)}<div><small>${title}</small><b>${h(text)}</b></div></div>
      <button type="button" class="nr-sugg" onclick="NSR.recite('${h(sid)}','${type}','${h(planId)}')">${ic('Mic',17)}<span>${action}</span></button></div>`;
  }
  function planCardHtml(sid,se,snaps){
    const all=snaps.flatMap(s=>s.acts.map(a=>({plan:s.plan,a})));
    const pick=(k)=>all.find(x=>x.a.key===k&&x.a.scheduledToday);
    const hifz=pick('hifz'),sard=pick('sard'),review=pick('review'),tath=pick('tathbit'),hasTathPlan=all.some(x=>x.a.key==='tathbit');
    const anyScheduled=[hifz,tath,sard,review].filter(Boolean);
    let body='';
    if(tath){
      const t=tath.a;
      body+=dutyRow('مقرر التثبيت اليوم',t.assignment?assignmentText(t.assignment):t.needsStart?'التثبيت مقرر اليوم ويحتاج تحديد نقطة البداية أول مرة.':'التثبيت مقرر اليوم؛ اختر النطاق المطلوب.','MenuBook',t.needsStart?'تحديد بداية التثبيت':'تسميع التثبيت',sid,'tathbit',tath.plan.id);
    }
    if(!hifz&&!tath){
      const nextA=all.find(x=>x.a.key===(hasTathPlan?'tathbit':'hifz'))?.a.nextDuty;
      body+=`<div class="nr-duty nr-duty-none"><div class="nr-duty-h">${ic('EventBusy',20)}<div><b>${hasTathPlan?'لا يوجد تثبيت مقرر اليوم':'لا يوجد حفظ مقرر اليوم'}</b><small class="nr-wrap2">${h(nextA?`غدًا/القادم ${String(nextA.date).slice(0,10)}: ${assignmentText(nextA.assignment)}`:'سيظهر الحفظ في يومه المعتمد ضمن الخطة الذكية.')}</small></div></div></div>`;
    }else if(hifz){
      const a=hifz.a;
      if(a.assignment)body+=dutyRow('مقرر الحفظ اليوم',assignmentText(a.assignment),'MenuBook','تسميع الحفظ',sid,'new_hifz',hifz.plan.id);
      else{
        const le=a.lastRecitation,termS=a.route==='reverse_surahs_forward_ayahs'?2:114;
        let msg;
        if(!le||!le.end_surah)msg='لا يوجد تسميع حفظ سابق لتحديد نقطة البداية. سجّل أول تسميع للطالب ليظهر المقرر.';
        else if(Number(le.end_surah)===termS&&Number(le.end_ayah)>=(a.route==='reverse_surahs_forward_ayahs'?maxAyah(2):maxAyah(114)))msg='أتمّ الطالب مسار الحفظ كاملًا ووصل إلى نهايته. أنشئ له خطة مراجعة أو تثبيت أو غيّر مساره.';
        else msg='لم يُحسب مقدار الحفظ لهذا اليوم. راجع هدف الخطة وأيام الدوام.';
        body+=dutyRow('الحفظ اليوم',msg,'MenuBook','تسميع حفظ',sid,'new_hifz',hifz.plan.id);
      }
    }
    if(sard){
      const a=sard.a;
      body+=dutyRow('مقرر السرد اليوم',a.assignment?assignmentText(a.assignment):a.needsStart?'السرد مقرر اليوم ويحتاج تحديد نقطة البداية أول مرة.':'السرد مقرر اليوم؛ اختر النطاق المطلوب.','RecordVoiceOver',a.needsStart?`تحديد بداية ${a.label||'السرد'}`:'تسميع السرد',sid,'sard',sard.plan.id);
    }
    if(review){
      const a=review.a;
      body+=dutyRow('مقرر المراجعة اليوم',a.assignment?assignmentText(a.assignment):'المراجعة مقررة اليوم؛ اختر النطاق.','Replay','تسجيل المراجعة',sid,'review_near',review.plan.id);
    }
    for(const k of ['hifz','tathbit','sard','review']){
      const x=all.find(y=>y.a.key===k&&!y.a.scheduledToday&&y.a.extraAssignment);
      if(x)body+=dutyRow(`ورد إضافي اليوم — ${h(x.a.label||'')}`,assignmentText(x.a.extraAssignment),'Add','سمّع الآن',sid,k==='hifz'?'new_hifz':k==='review'?'review_near':k,x.plan.id);
    }
    if(!anyScheduled.length&&!hifz)body+=`<p class="nr-hint">لا توجد أنشطة أخرى مجدولة لهذا اليوم.</p>`;
    return `<section class="nr-plan"><header>${ic('AutoAwesome',20)}<div><small>المقرر الذكي اليوم</small><span>${h(se.session_date)}</span></div></header>${body}</section>`;
  }

  // ---------------------------------------------------------------- page entry point
  const BASE_PAGE=typeof sessionRosterPage==='function'?sessionRosterPage:null;
  sessionRosterPage=function(id){
    const se=sessionOf(id);
    if(!se)return NX.empty('الجلسة غير موجودة.',{icon:'EventBusy'});
    if(R.sid!==sid_(id)){Object.assign(R,{sid:sid_(id),expanded:null,filter:'all',track:'all',sort:'priority',rank:null,rankKey:'',message:null,epoch:R.epoch+1});state.sessionSearch=''}
    if(R.rosterFor!==sid_(id)&&!R.loading)NS.load(id);
    const q=state.sessionSearch||'';
    return `<div class="nr-roster" id="nrRoster" data-sid="${h(id)}">
      <div id="nrTop">${topHtml(se)}</div>
      <div class="nr-tools">${NX.search(q,'ابحث عن طالب للوصول السريع',{oninput:'NSR.search(this.value)',cls:`nr-search ${q?'has-q':''}`,id:'nrSearch',trailing:`<button type="button" class="nx-iconbtn nr-clear" onclick="NSR.clearSearch()" aria-label="مسح البحث">${ic('Clear',20)}</button>`})}</div>
      <div id="nrSummary">${summaryHtml(se)}</div>
      <div id="nrDesk" class="nr-desk">${deskFiltersHtml(se)}</div>
      ${isLesson(se)?lessonOverview(se):''}
      <div id="nrList" class="nr-list">${listHtml(se)}</div>
      <div id="nrFooter" class="nr-foot">${footerHtml(se)}</div>
    </div>`;
  };

  function lessonOverview(se){
    const d=sessionActivityData(se),qs=arr(d.questions);
    const notes=arr(state.sessionRoster?.notes).filter(n=>Number(n.activity_max_score||0)>0||n.participation);
    const w={excellent:3,good:2,normal:1},byId=new Map(studentsOf(se).map(s=>[sid_(s.id),s]));
    const rank=notes.map(n=>{const st=byId.get(sid_(n.student_id)),max=Number(n.activity_max_score||0),sc=Number(n.activity_score||0);return {st,pct:max>0?sc/max*100:0,sc,max,w:w[n.participation]||1}}).filter(x=>x.st&&(x.max>0)).sort((a,b)=>b.pct-a.pct||b.w-a.w||b.sc-a.sc).slice(0,3);
    if(!d.summary&&!d.weekly_value&&!qs.length&&!rank.length)return '';
    return `<details class="nr-lesson"><summary>${ic('Lightbulb',20)}<b>تفاصيل اللقاء</b>${ic('ExpandMore',20)}</summary>
      ${d.weekly_value?`<p><b>قيمة الأسبوع:</b> ${h(d.weekly_value)}</p>`:''}${d.summary?`<p>${h(d.summary)}</p>`:''}
      ${qs.length?`<ol>${qs.map(q=>`<li><b>${h(q.question)}</b>${q.answer?`<small>الجواب: ${h(q.answer)}</small>`:''}<em>${plain(q.points||1)} نقطة</em></li>`).join('')}</ol>`:''}
      ${rank.length?`<div class="nr-rank">${rank.map((x,i)=>NX.pill(`${i+1}. ${h(x.st.full_name)} · ${plain(x.sc)}/${plain(x.max)}`,i?'info':'success',{icon:'EmojiEvents'})).join('')}</div>`:''}
    </details>`;
  }

  // ---------------------------------------------------------------- loading / reload
  const loadBase=typeof loadSessionRosterData==='function'?loadSessionRosterData:null;
  if(loadBase){
    loadSessionRosterData=async function(id){const r=await loadBase.apply(this,arguments);R.rosterFor=sid_(id);return r};
  }
  const closeBase=typeof closeSessionRoster==='function'?closeSessionRoster:null;
  if(closeBase){closeSessionRoster=function(){R.rosterFor=null;R.sid=null;R.expanded=null;return closeBase.apply(this,arguments)}}

  NS.load=async function(id){
    if(!loadBase||R.loading)return;
    R.loading=true;
    try{await loadSessionRosterData(id)}catch(e){console.warn('roster load',e)}
    R.loading=false;R.epoch++;
    if(R.sid===sid_(id))refreshAll();
  };
  NS.reload=async function(){
    const id=R.sid;if(!id)return;
    R.refreshing=true;setHtml('nrTop',topHtml(curSession()));
    try{await loadSessionRosterData(id);await ensurePlans(studentsOf(curSession()).map(s=>s.id))}catch(e){setMessage('تعذر تحديث بعض تفاصيل الجلسة الآن؛ البيانات المحلية ما زالت متاحة','warning')}
    R.refreshing=false;R.epoch++;refreshAll();
  };

  // ---------------------------------------------------------------- interactions
  NS.search=v=>{state.sessionSearch=v;const l=document.querySelector('.nr-search');if(l)l.classList.toggle('has-q',!!String(v||'').trim());const se=curSession();if(!se)return;setHtml('nrSummary',summaryHtml(se));setHtml('nrDesk',deskFiltersHtml(se));setHtml('nrList',listHtml(se))};
  NS.clearSearch=()=>{const i=$id('nrSearch');if(i){i.value='';i.focus()}NS.search('')};
  NS.setFilter=k=>{R.filter=k;if($id('nrFilterDlg')?.open)NS.openFilters();refreshAll()};
  NS.setTrack=k=>{R.track=k;if($id('nrFilterDlg')?.open)NS.openFilters();refreshAll()};
  NS.setSort=k=>{R.sort=k;R.rankKey='';if($id('nrFilterDlg')?.open)NS.openFilters();refreshAll()};
  NS.toggle=sid=>{
    const prev=R.expanded;R.expanded=prev===sid?null:sid;
    if(prev&&prev!==sid)refreshCard(prev);
    refreshCard(sid);
    if(R.expanded===sid){
      const se=curSession();
      const had=planSnapshots(sid,se.session_date).length;
      ensurePlans([sid]).then(()=>{if(R.expanded===sid&&planSnapshots(sid,se.session_date).length!==had)refreshCard(sid)});
      requestAnimationFrame(()=>{const el=$id('roster_'+sid);if(el&&el.getBoundingClientRect().bottom>innerHeight-20)el.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
    }
  };
  NS.openFilters=function(){
    const se=curSession();if(!se)return;const c=listCtx(se),lesson=c.lesson;
    const grid=(items,sel,fn)=>`<div class="nr-chipgrid">${items.map(([k,l])=>NX.chip(l,{selected:sel(k),check:false,onclick:`NSR.${fn}('${k}')`})).join('')}</div>`;
    const statusItems=lesson?STATUS_FILTERS.filter(([k])=>!['not_recited','present_pending'].includes(k)).map(([k,l])=>k==='recited'?[k,'شارك']:[k,l]):STATUS_FILTERS;
    const body=`${strip(c.summary,lesson)}
      <b class="nr-lab">حالة الطالب</b>${grid(statusItems,k=>R.filter===k,'setFilter')}
      <b class="nr-lab">المسار والترتيب</b>
      <div class="nr-chipgrid">${[['all','كل المسارات'],['general_hifz','الحفظ العام'],['tathbit','التثبيت']].map(([k,l])=>NX.chip(l,{selected:R.track===k,check:false,onclick:`NSR.setTrack('${k}')`})).join('')}${[['priority','الأولوية'],['alpha','أبجدي']].map(([k,l])=>NX.chip(l,{selected:R.sort===k,check:false,onclick:`NSR.setSort('${k}')`})).join('')}</div>`;
    redraw('nrFilterDlg',()=>NX.dialog('nrFilterDlg','حالة الجلسة والفلترة',body,{cls:'nr-sheet',footer:NX.btn('تطبيق وعرض الطلاب',{full:true,onclick:"NX.closeDialog('nrFilterDlg')"})}));
  };
  function redraw(id,fn){
    const sc=$id(id)?.querySelector('.nx-dlg-content'),top=sc?sc.scrollTop:0;fn();
    const sc2=$id(id)?.querySelector('.nx-dlg-content');if(sc2)sc2.scrollTop=top;
  }

  // ---- attendance
  NS.menu=function(btn,kind,sid){
    let items;
    if(kind==='att'){
      const cur=attOf(sid)?.status||'';
      items=[['present','حاضر','CheckCircle'],['absent','غائب','Cancel'],['excused','غائب بعذر','Info'],['late','متأخر','Schedule']].map(([k,l,i])=>({label:k===cur?`<b>${l}</b>`:l,icon:i,onclick:()=>NS.setAtt(sid,k)}));
    }else{
      const cur=noteOf(sid)?.behavior||'normal';
      items=BEH.map(([k,l])=>({label:k===cur?`<b>${l}</b>`:l,icon:k==='warning'?'Cancel':k==='needs_attention'?'Info':'CheckCircle',danger:k==='warning',onclick:()=>NS.setBeh(sid,k)}));
    }
    const m=/openMenu\(this,'(m\d+)'\)/.exec(NX.kebab(items));
    if(m)NX.openMenu(btn,m[1]);
  };
  NS.setAtt=function(sid,status,reason,minutes){
    const se=curSession();if(!se)return;
    if(status==='late'||status==='excused'){if(reason===undefined&&minutes===undefined)return NS.openAttendance(sid,status)}
    const extra=status==='excused'?{excuse_reason:reason||null,arrival_minutes_late:0}:status==='late'?{excuse_reason:null,arrival_minutes_late:Math.max(0,Number(minutes)||0)}:{excuse_reason:null,arrival_minutes_late:0};
    try{localAttendanceSave(sid,se.id,status,extra)}catch(e){return setMessage(e.message||'تعذر حفظ الحضور','warning')}
    refreshCard(sid);flash(sid);syncSoon();
  };
  function flash(sid){requestAnimationFrame(()=>{const c=$id('roster_'+sid);if(c){c.classList.remove('saved-flash');void c.offsetWidth;c.classList.add('saved-flash')}})}
  NS.openAttendance=function(sid,status){
    const st=studentOf(sid),ex=attOf(sid);R.att={sid,status};
    const body=status==='late'
      ?NX.field('دقائق التأخر',{id:'nrAttMin',type:'number',inputmode:'numeric',min:0,value:ex?.arrival_minutes_late||5})
      :NX.field('سبب العذر',{html:`<textarea id="nrAttReason" rows="3">${h(ex?.excuse_reason||'')}</textarea>`});
    NX.dialog('nrAttDlg',status==='late'?`تأخر ${h(st?.full_name)}`:`غياب بعذر · ${h(st?.full_name)}`,body,{cls:'nx-small-dlg nr-small',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nrAttDlg')"})}${NX.btn('حفظ',{onclick:'NSR.saveAttendance()'})}`});
  };
  NS.saveAttendance=function(){
    const a=R.att;if(!a)return;
    const reason=($id('nrAttReason')?.value||'').trim(),min=parseInt($id('nrAttMin')?.value||'0',10)||0;
    NX.closeDialog('nrAttDlg');
    NS.setAtt(a.sid,a.status,reason,min);
  };

  // ---- behaviour / note (student_daily_notes via the same offline 'behavior' op, full payload so nothing is overwritten)
  function saveNoteLocal(sid,seId,patch){
    prepareSessionForOfflineWork(seId);
    const ex=rosterNote(sid),keep={};
    for(const k of ['behavior','behavior_score','teacher_comment','homework','parent_visible','participation','activity_score','activity_max_score'])if(ex&&ex[k]!==undefined)keep[k]=ex[k];
    const payload=Object.assign({session_id:seId,student_id:sid,behavior:'normal'},keep,patch,{created_by:uid()});
    if(payload.behavior_score==null)payload.behavior_score=behaviorScoreFor(payload.behavior);
    if(payload.parent_visible==null)payload.parent_visible=true;
    const data=Object.assign({id:ex?.id||offlineUuid()},payload,{_offline:true});
    if(ex)Object.assign(ex,data);else state.sessionRoster.notes.push(data);
    enqueueOffline({type:'behavior',key:`beh:${seId}:${sid}`,dedupeKey:`beh:${seId}:${sid}`,payload});
    rememberRoster(seId);
  }
  NS.setBeh=function(sid,b){
    const se=curSession();if(!se)return;
    try{saveNoteLocal(sid,se.id,{behavior:b,behavior_score:behaviorScoreFor(b)})}catch(e){return setMessage(e.message||'تعذر حفظ السلوك','warning')}
    refreshCard(sid);flash(sid);syncSoon();
  };
  NS.notRecited=function(sid){
    const se=curSession(),st=studentOf(sid);if(!se||!st)return;
    try{
      if(!attOf(sid))localAttendanceSave(sid,se.id,'present',{excuse_reason:null,arrival_minutes_late:0});
      saveNoteLocal(sid,se.id,{participation:NOT_RECITED});
    }catch(e){return setMessage(e.message||'تعذر تسجيل حالة لم يُسمّع','warning')}
    refreshCard(sid);flash(sid);syncSoon();setMessage(`تم تسجيل ${st.full_name}: لم يُسمّع`,'success');
  };
  NS.openNote=function(sid){
    const st=studentOf(sid),n=noteOf(sid);
    R.note={sid,behavior:n?.behavior||'normal',visible:n?.parent_visible!==false};
    NS.drawNote(n);
    void st;
  };
  NS.drawNote=function(n){
    const nt=R.note,st=studentOf(nt.sid);n=n||noteOf(nt.sid);
    const body=`<div class="nr-chipgrid">${[['excellent','ممتاز'],['good','جيد'],['normal','طبيعي'],['needs_attention','يحتاج متابعة'],['warning','تنبيه']].map(([k,l])=>NX.chip(l,{selected:nt.behavior===k,check:false,onclick:`NSR.noteBeh('${k}')`})).join('')}</div>
      ${NX.field('درجة السلوك 1–5 (اختياري)',{id:'nrNoteScore',inputmode:'numeric',value:nt.score!==undefined?nt.score:(n?.behavior_score||'')})}
      ${NX.field('ملاحظة المحفظ',{html:`<textarea id="nrNoteComment" rows="3">${h(nt.comment!==undefined?nt.comment:(n?.teacher_comment||''))}</textarea>`})}
      ${NX.field('الواجب',{html:`<textarea id="nrNoteHw" rows="2">${h(nt.hw!==undefined?nt.hw:(n?.homework||''))}</textarea>`})}
      ${NX.switchRow('تظهر الملاحظة لولي الأمر',nt.visible,'NSR.noteVis(this.checked)')}`;
    NX.dialog('nrNoteDlg',`ملاحظة ${h(st?.full_name)}`,body,{cls:'nr-dlg-mid',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nrNoteDlg')"})}${NX.btn('حفظ',{icon:'Save',onclick:'NSR.saveNote()'})}`});
  };
  const grabNote=()=>{const nt=R.note;nt.score=$id('nrNoteScore')?.value;nt.comment=$id('nrNoteComment')?.value;nt.hw=$id('nrNoteHw')?.value};
  NS.noteBeh=k=>{grabNote();R.note.behavior=k;redraw('nrNoteDlg',()=>NS.drawNote())};
  NS.noteVis=v=>{R.note.visible=!!v};
  NS.saveNote=function(){
    grabNote();const nt=R.note,se=curSession();if(!se||!nt)return;
    const sc=parseInt(String(nt.score||'').replace(/\D/g,'').slice(0,1),10),score=sc>=1&&sc<=5?sc:null;
    try{saveNoteLocal(nt.sid,se.id,{behavior:nt.behavior,behavior_score:score||behaviorScoreFor(nt.behavior),teacher_comment:(nt.comment||'').trim()||null,homework:(nt.hw||'').trim()||null,parent_visible:nt.visible})}
    catch(e){return setMessage(e.message||'تعذر حفظ الملاحظة','warning')}
    NX.closeDialog('nrNoteDlg');refreshCard(nt.sid);flash(nt.sid);syncSoon();snack('تم حفظ الملاحظة');
  };

  // ---- report payload (same shape the legacy #reportForm submit builds -> saveReportOffline)
  function recData(seId,sid,d){
    const sd=d.selection_data||{};
    return {session_id:seId,student_id:sid,activity_type:d.activity_type,input_method:d.input_method||'ayahs',start_surah:d.start_surah||null,start_ayah:d.start_ayah||null,end_surah:d.end_surah||null,end_ayah:d.end_ayah||null,start_page:d.start_page||null,end_page:d.end_page||null,pages_count:Number(d.pages_count)||0,ayahs_count:Number(d.ayahs_count)||0,surahs_count:Number(d.surahs_count)||0,mistakes:Number(d.mistakes)||0,prompts:Number(d.prompts)||0,teacher_note:d.teacher_note||null,selected_surahs:arr(d.selected_surahs),selection_data:Object.assign({mode:d.input_method||'ayahs',selected_juz:[],start_global:null,end_global:null,qcf_line_keys:[]},sd),created_by:d.created_by||uid()};
  }
  /** mirrors the row->data mapping + decorations of the legacy submit handler */
  function finishRow(se,sid,data,dbId){
    const sd=data.selection_data||{};
    const fake={dataset:{dbId:dbId||'',tilawah:JSON.stringify(sd.tilawah_assessment||null)}};
    if(!sd.smart_plan_id&&typeof window.halaqatiResolveSmartPlanForRecitation==='function'){
      try{const p=window.halaqatiResolveSmartPlanForRecitation({studentId:sid,sessionId:se.id,activityType:data.activity_type,startPage:data.start_page,endPage:data.end_page});if(p){sd.smart_plan_id=p.id;sd.smart_plan_type=p.plan_type}}catch(_e){}
    }
    if(sd.smart_plan_id&&!sd.smart_plan_date)sd.smart_plan_date=se.session_date||null;
    data.selection_data=sd;
    if(typeof rc27TilawahApply==='function')rc27TilawahApply(fake,data);
    return {dbId:dbId||null,data:typeof rc27AfterDecorate==='function'?rc27AfterDecorate(decorateRecForOffline(data)):decorateRecForOffline(data)};
  }
  function buildPayload(se,sid,rows,over={}){
    const ex=attOf(sid),n=noteOf(sid);
    const attendance=Object.assign({session_id:se.id,student_id:sid,status:ex?.status||'present',excuse_reason:ex?.excuse_reason||null,recorded_by:uid()},ex?.arrival_minutes_late!=null?{arrival_minutes_late:ex.arrival_minutes_late}:{});
    let part=n?.participation;if(part===NOT_RECITED||!part)part='normal';
    const note=Object.assign({session_id:se.id,student_id:sid,behavior:n?.behavior||'normal',behavior_score:n?.behavior_score||behaviorScoreFor(n?.behavior||'normal'),teacher_comment:n?.teacher_comment||null,homework:n?.homework||null,activity_score:Number(n?.activity_score||0),activity_max_score:Number(n?.activity_max_score||0),participation:part,parent_visible:n?.parent_visible!==false,created_by:uid()},over.note||{});
    return {sessionId:se.id,studentId:sid,attendance,note,rows,existingRecIds:recsOf(sid).map(r=>r.id)};
  }
  function otherRows(se,sid,exceptId){
    return recsOf(sid).filter(r=>sid_(r.id)!==sid_(exceptId)).map(r=>finishRow(se,sid,recData(se.id,sid,r),r.id));
  }
  function commitReport(se,payload){
    if(state.demo){toast('تم حفظ التقرير التجريبي');return false}
    saveReportOffline(payload);syncSoon();return true;
  }

  // ---- delete recitation
  NS.delRec=function(sid,rid){
    const st=studentOf(sid);
    NX.confirm('حذف التسميع',`سيُحذف تسميع ${h(st?.full_name)} فورًا وتُعاد حسبة الخطة.`,'حذف',()=>{
      const se=curSession();if(!se)return;
      try{commitReport(se,buildPayload(se,sid,otherRows(se,sid,rid)))}catch(e){return setMessage(e.message||'تعذر حذف التسميع؛ تمت استعادته','warning')}
      refreshCard(sid);setMessage('تم حذف التسميع وإعادة حساب الخطة','success');
    },{danger:true});
  };

  // ---- activity (lesson) participation
  NS.openActivity=function(sid){
    const se=curSession(),n=noteOf(sid);if(!se)return;
    R.act={sid,score:n?.activity_score||0,max:n?.activity_max_score||sessionActivityData(se).quiz_max||10,part:['good','excellent'].includes(n?.participation)?n.participation:'normal'};
    NS.drawActivity();
  };
  NS.drawActivity=function(){
    const a=R.act,st=studentOf(a.sid);
    const body=`${NX.field('درجة المسابقة',{id:'nrActScore',type:'number',inputmode:'decimal',min:0,value:a.score})}
      ${NX.field('من',{id:'nrActMax',type:'number',inputmode:'decimal',min:0,value:a.max})}
      <b class="nr-lab">التفاعل</b><div class="nr-chipgrid">${[['normal','عادي'],['good','جيد'],['excellent','مميز']].map(([k,l])=>NX.chip(l,{selected:a.part===k,check:false,onclick:`NSR.actPart('${k}')`})).join('')}</div>
      ${NX.notice('نقاط النشاط منفصلة عن نقاط الحفظ والترتيب القرآني.','info')}`;
    NX.dialog('nrActDlg',`مشاركة ${h(st?.full_name)}`,body,{cls:'nr-dlg-mid',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nrActDlg')"})}${NX.btn('حفظ',{icon:'Save',onclick:'NSR.saveActivity()'})}`});
  };
  const grabAct=()=>{R.act.score=$id('nrActScore')?.value;R.act.max=$id('nrActMax')?.value};
  NS.actPart=k=>{grabAct();R.act.part=k;redraw('nrActDlg',()=>NS.drawActivity())};
  NS.saveActivity=function(){
    grabAct();const a=R.act,se=curSession();if(!se||!a)return;
    const payload=buildPayload(se,a.sid,[],{note:{activity_score:+a.score||0,activity_max_score:+a.max||0,participation:a.part}});
    payload.existingRecIds=[];
    commitReport(se,payload);NX.closeDialog('nrActDlg');refreshCard(a.sid);snack('تم حفظ المشاركة');
  };

  // ---- session actions (legacy handlers, native confirmations)
  function withConfirmed(fn){const old=window.confirm;window.confirm=()=>true;try{return fn()}finally{window.confirm=old}}
  NS.upload=()=>{const se=curSession();if(!se)return;NX.confirm('رفع الجلسة وإنهاؤها؟','ستبقى محفوظة ويمكن تعديلها لاحقاً.','رفع الجلسة',()=>withConfirmed(()=>uploadSession(se.id)))};
  NS.reopen=()=>{const se=curSession();if(!se)return;NX.confirm('فتح الجلسة للتعديل',se.status==='open'?'الجلسة مفتوحة بالفعل.':'فتح الجلسة للتعديل مرة أخرى؟','فتح',()=>withConfirmed(async()=>{await reopenSession(se.id);R.rosterFor=null;R.sid=null;if(typeof render==='function')render()}))};
  NS.remove=()=>{
    const se=curSession();if(!se)return;const name=se.title||sesName(se.session_type)||'الجلسة';
    NX.confirm('حذف الجلسة نهائياً',`حذف جلسة «${h(name)}» نهائياً؟ سيتم حذف الجلسة وكل الحضور والتسميع والسلوك المرتبط بها.`,'متابعة',()=>{
      NX.confirm('تأكيد أخير','لا يمكن استرجاع هذه الجلسة بعد الحذف. متابعة؟','حذف نهائي',()=>withConfirmed(()=>cancelSession(se.id)),{danger:true});
    },{danger:true});
  };
  NS.closeConfirm=function(){
    const se=curSession();if(!se)return;const c=listCtx(se),sm=c.summary;
    const text=sm.unmarked>0?`يوجد طلاب لم يُرصدوا: ${sm.unmarked}. راجع الملخص قبل الإغلاق.`:'اكتمل رصد جميع الطلاب. راجع الملخص ثم أغلق الجلسة عندما تكون جاهزًا.';
    const up=canManage()&&se.status==='open'?NX.btn('رفع الجلسة',{kind:'tonal',icon:'CloudUpload',onclick:"NX.closeDialog('nrSumDlg');NSR.upload()"}):'';
    NX.dialog('nrSumDlg','ملخص الجلسة قبل الإغلاق',`<p class="nx-confirm-text">${h(text)}</p>${strip(sm,c.lesson)}`,{cls:'nr-dlg-mid',footer:`${NX.btn(sm.unmarked>0?'العودة للرصد':'متابعة الجلسة',{kind:'text',onclick:"NX.closeDialog('nrSumDlg')"})}${up}${NX.btn(sm.unmarked>0?'إغلاق على أي حال':'إغلاق الجلسة',{onclick:`NSR.finish(${sm.unmarked===0})`})}`});
  };
  NS.finish=function(celebrate){
    NX.closeDialog('nrSumDlg');
    if(celebrate){try{window.RC27Motion?.celebrate()}catch(_e){}}
    closeSessionRoster();
  };

  // ---------------------------------------------------------------- Recitation sheet (RecitationDialog)
  const TILAWAH_ISSUES=[['madd','المدود'],['ghunnah','الغنة'],['ikhfa_idgham','الإخفاء والإدغام'],['qalqalah','القلقلة'],['makharij','المخارج'],['waqf','الوقف والابتداء']];
  const RIWAYAH=[['hafs','حفص عن عاصم'],['warsh','ورش عن نافع'],['qalun','قالون عن نافع']];
  const RATINGS=[['makharij','المخارج والصفات'],['tajweed','أحكام التجويد'],['waqf_ibtida','الوقف والابتداء'],['fluency','الطلاقة والترتيل']];

  function defaultType(se,st){
    if(isTathbit(st))return 'review_far';
    return ({sard:'sard',review:'review_near',test:'test',tajweed:'tilawah',tilawah:'tilawah'})[se.session_type]||'new_hifz';
  }
  function rangeFromRecord(r){
    const sd=r.selection_data||{},keys=arr(sd.qcf_line_keys);
    const pages=keys.length?new Set(keys).size/15:Number(r.pages_count)||0;
    return {mode:sd.mode||r.input_method||'ayahs',startSurah:r.start_surah||null,startAyah:r.start_ayah||null,endSurah:r.end_surah||null,endAyah:r.end_ayah||null,lineKeys:keys.slice(),pages,startPage:r.start_page||null,endPage:r.end_page||null,ayahs:Number(r.ayahs_count)||0,surahs:Number(r.surahs_count)||0,selectedSurahs:arr(r.selected_surahs),selectedJuz:arr(sd.selected_juz)};
  }
  /** opens RecitationDialog: sid, activity type, optional plan, optional existing recitation id */
  NS.recite=async function(sid,type,planId,existingId){
    const se=curSession()||sessionOf(state.sessionView);if(!se)return;
    if(!openRecitationGuard(se))return;
    await openRecitation(sid,se.id,type,planId,existingId);
  };
  function openRecitationGuard(se){
    if(se.status==='closed'){toast('الجلسة مرفوعة. استخدم «تعديل الجلسة» أولاً.');return false}
    return true;
  }
  async function openRecitation(sid,seId,type,planId,existingId){
    const se=sessionOf(seId),st=studentOf(sid);if(!se||!st)return;
    if(!rosterOk(seId)){try{await loadSessionRosterData(seId)}catch(_e){}}
    await ensurePlans([sid]);
    const existing=existingId?recsOf(sid).find(r=>sid_(r.id)===sid_(existingId)):null;
    let t=canonType(existing?.activity_type||type||defaultType(se,st));
    const snap=existing?null:snapshotFor(sid,t,se.session_date,planId);
    const exSnap=existing?snapshotFor(sid,t,se.session_date,existing.selection_data?.smart_plan_id):null;
    const useSnap=snap||exSnap;
    const assign=existing?null:(useSnap?.act?(useSnap.act.scheduledToday?useSnap.act.assignment:null)||useSnap.act.assignment||useSnap.act.extraAssignment:null);
    const ta=existing?.selection_data?.tilawah_assessment||{};
    R.rec={sid,seId,existing,type:t,range:existing?rangeFromRecord(existing):rangeFromAssignment(assign),mistakes:existing?.mistakes&&t!=='tilawah'?existing.mistakes:0,prompts:existing?.prompts||0,note:existing?.teacher_note||'',saving:false,error:null,
      planId:existing?.selection_data?.smart_plan_id||(t==='tilawah'?null:useSnap?.plan?.id)||null,planType:existing?.selection_data?.smart_plan_type||(t==='tilawah'?null:useSnap?.plan?.plan_type)||null,planDate:existing?.selection_data?.smart_plan_date||se.session_date,
      tl:{riwayah:ta.riwayah||'hafs',lahn_jali:Math.max(0,+ta.lahn_jali||0),lahn_khafi:Math.max(0,+ta.lahn_khafi||0),makharij:clamp(ta.makharij,5),tajweed:clamp(ta.tajweed,5),waqf_ibtida:clamp(ta.waqf_ibtida,5),fluency:clamp(ta.fluency,5),issues:new Set(arr(ta.issue_keys))}};
    if(existing&&t==='tilawah')R.rec.mistakes=0;
    drawRec();
  }
  const clamp=(v,d)=>{v=Number(v);return v>=1&&v<=5?Math.round(v):d};
  const tlScore=a=>Math.round(Math.max(0,Math.min(100,((a.makharij+a.tajweed+a.waqf_ibtida+a.fluency)/20)*100-a.lahn_jali*8-a.lahn_khafi*3))*10)/10;
  const tlEval=s=>s>=90?'excellent':s>=80?'very_good':s>=70?'good':'repeat';
  function recDerived(){
    const D=R.rec,pages=D.range?.pages||0;
    if(D.type==='tilawah'){const s=tlScore(D.tl);return {pages,safety:s,ev:tlEval(s),tilawah:true}}
    let v;try{v=computeRecitationV6({pages_count:pages,mistakes:D.mistakes,prompts:D.prompts,selection_data:{qcf_line_keys:D.range?.lineKeys||[]}})}catch(_e){v={safety_percentage:0,evaluation:'not_rated'}}
    return {pages,safety:v.safety_percentage,ev:pages>0?v.evaluation:'not_rated',tilawah:false};
  }
  const counter=(label,val,dec,inc)=>`<div class="nr-cnt"><b>${label}</b><div><button type="button" class="nr-cbtn" aria-label="إنقاص" ${val<=0?'disabled':''} onclick="NSR.${dec}">${ic('Remove',20)}</button><output>${val}</output><button type="button" class="nr-cbtn" aria-label="زيادة" onclick="NSR.${inc}">${ic('Add',20)}</button></div></div>`;
  function evalCard(d){
    const bad=d.ev==='repeat';
    return `<div class="nr-eval ${bad?'bad':''}" id="nrEval"><div class="nr-eval-l">${ic(bad?'WarningAmber':'Verified',24)}<div><small>${d.tilawah?'التقييم العام للتلاوة':'تقييم V6 تلقائي'}</small><b>${evalLabel(d.ev)}</b></div></div><div class="nr-eval-r"><small>${d.tilawah?'النتيجة':'السلامة'}</small><b>${plain(d.safety)}%</b></div></div>`;
  }
  function recBody(){
    const D=R.rec,st=studentOf(D.sid),se=sessionOf(D.seId),d=recDerived();
    const types=isTathbit(st)?[['review_far','تثبيت','Replay'],['tilawah','تلاوة','AutoStories']]:[['new_hifz','حفظ','MenuBook'],['review_near','مراجعة','Replay'],['sard','سرد','RecordVoiceOver'],['tilawah','تلاوة','AutoStories'],...(D.type==='test'||isProgramSession(se)?[['test','اختبار','Verified']]:[])];
    const rg=D.range,label=rg?(rg.mode==='surahs'&&rg.selectedSurahs.length?rg.selectedSurahs.map(surahName).join('، '):rg.mode==='juz'&&rg.selectedJuz.length?`الأجزاء ${rg.selectedJuz.join('، ')}`:rangeLabel(rg.startSurah,rg.startAyah,rg.endSurah,rg.endAyah,rg.startPage,rg.endPage)):null;
    const rangeCard=`<section class="nr-range"><div class="nr-range-h"><span class="nr-range-i">${ic('MenuBook',24)}</span><div><small>المقرر القرآني</small><b>${h(label||'لم يتم اختيار نطاق بعد')}</b></div></div>
      ${d.pages>0.0001?`<div class="nr-pills">${NX.pill(`${plain(d.pages)} صفحة`,'info')}${rg?.ayahs?NX.pill(`${rg.ayahs} آية`,'info'):''}</div>`:''}
      ${NX.btn(label?'تعديل المقرر':'اختيار المقرر من المصحف',{icon:'AutoStories',full:true,onclick:'NSR.openPicker()'})}</section>`;
    let mid;
    if(d.tilawah){
      const a=D.tl;
      mid=`<section class="nr-tilawah"><h4>تقييم التلاوة</h4><p class="nr-hint">تقييم يدوي من المحفّظ؛ لا يعتمد على كشف آلي لأحكام التجويد.</p>
        <b class="nr-lab">الرواية / القراءة</b><div class="nr-chipgrid">${RIWAYAH.map(([k,l])=>NX.chip(l,{selected:a.riwayah===k,check:false,onclick:`NSR.tl('riwayah','${k}')`})).join('')}</div>
        <div class="nr-cnt-row">${counter('لحن جلي',a.lahn_jali,"tlCnt('lahn_jali',-1)","tlCnt('lahn_jali',1)")}${counter('لحن خفي',a.lahn_khafi,"tlCnt('lahn_khafi',-1)","tlCnt('lahn_khafi',1)")}</div>
        ${RATINGS.map(([k,l])=>`<div class="nr-rate"><label for="nrR_${k}"><span>${l}</span><b id="nrRv_${k}">${a[k]}/5</b></label><input id="nrR_${k}" type="range" min="1" max="5" step="1" value="${a[k]}" oninput="NSR.tl('${k}',+this.value,true)"></div>`).join('')}
        <b class="nr-lab">مواضع تحتاج متابعة</b><div class="nr-chipgrid">${TILAWAH_ISSUES.map(([k,l])=>NX.chip(l,{selected:a.issues.has(k),check:false,onclick:`NSR.tlIssue('${k}')`})).join('')}</div></section>`;
    }else{
      mid=`<div class="nr-cnt-row">${counter('الأخطاء',D.mistakes,"cnt('mistakes',-1)","cnt('mistakes',1)")}${counter('التلقين',D.prompts,"cnt('prompts',-1)","cnt('prompts',1)")}</div>`;
    }
    return `<p class="nr-dlg-sub">${h(se.session_date)} · ${h(sesName(se.session_type))}</p>
      ${D.error?NX.notice(h(D.error),'error'):''}
      <b class="nr-lab">نوع التسميع</b>
      <div class="nr-chipgrid nr-types">${types.map(([k,l,i])=>NX.chip(l,{selected:D.type===k,check:false,icon:i,onclick:`NSR.setType('${k}')`})).join('')}</div>
      ${rangeCard}${mid}${evalCard(d)}
      ${NX.field('ملاحظة المحفظ (اختياري)',{html:`<textarea id="nrRecNote" rows="2" oninput="NSR.R.rec.note=this.value">${h(D.note)}</textarea>`})}`;
  }
  function recFooter(){
    const D=R.rec,d=recDerived();
    return `${D.existing?`<button type="button" class="nx-btn nx-text nr-del-btn" ${D.saving?'disabled':''} onclick="NSR.delFromDlg()">${ic('DeleteOutline',18)}<span>حذف</span></button>`:''}
      ${NX.btn('إلغاء',{kind:'outlined',disabled:D.saving,onclick:"NX.closeDialog('nrRecDlg')",cls:'nr-f-cancel'})}
      <button type="button" id="nrRecSave" class="nx-btn nx-filled nr-f-save" ${(D.saving||!(d.pages>0))?'disabled':''} onclick="NSR.saveRec()">${ic('Save',18)}<span>${D.saving?'جارٍ الحفظ…':D.existing?'حفظ التعديل':'حفظ التسميع'}</span></button>`;
  }
  function drawRec(){
    const D=R.rec,st=studentOf(D.sid);
    redraw('nrRecDlg',()=>NX.dialog('nrRecDlg',D.existing?`تعديل تسميع ${h(st?.full_name)}`:`تسميع ${h(st?.full_name)}`,recBody(),{cls:'nr-rec-dlg',footer:recFooter(),onClose:()=>{if(!R.pick?.open)R.rec=R.rec&&R.rec.saving?R.rec:null}}));
  }
  function partialRec(){
    const D=R.rec;if(!D)return;const d=recDerived();
    const ev=$id('nrEval');if(ev)ev.outerHTML=evalCard(d);
    const btn=$id('nrRecSave');if(btn)btn.disabled=D.saving||!(d.pages>0);
  }
  NS.setType=function(k){
    const D=R.rec;D.note=$id('nrRecNote')?.value??D.note;D.type=k;
    // switching the activity discards the picked range (Android: selectedQuranRange=null, pages=0) unless it came from the plan; re-apply the plan duty when one exists
    D.range=null;D.planId=null;D.planType=null;
    if(!D.existing&&k!=='tilawah'){
      const se=sessionOf(D.seId),sn=snapshotFor(D.sid,k,se.session_date);
      if(sn){D.planId=sn.plan.id;D.planType=sn.plan.plan_type;const a=sn.act?(sn.act.scheduledToday?sn.act.assignment:null)||sn.act.assignment||sn.act.extraAssignment:null;D.range=rangeFromAssignment(a)}
    }
    drawRec();
  };
  NS.cnt=function(key,delta){const D=R.rec;D[key]=Math.max(0,(D[key]||0)+delta);drawRec()};
  NS.tl=function(key,val,live){
    const D=R.rec;D.tl[key]=val;
    if(live){const o=$id('nrRv_'+key);if(o)o.textContent=val+'/5';partialRec();return}
    drawRec();
  };
  NS.tlCnt=function(key,delta){const a=R.rec.tl;a[key]=Math.max(0,a[key]+delta);drawRec()};
  NS.tlIssue=function(k){const s=R.rec.tl.issues;s.has(k)?s.delete(k):s.add(k);drawRec()};
  NS.delFromDlg=function(){const D=R.rec;if(!D?.existing)return;NX.closeDialog('nrRecDlg');NS.delRec(D.sid,D.existing.id)};

  NS.saveRec=function(){
    const D=R.rec;if(!D||D.saving)return;
    D.note=$id('nrRecNote')?.value??D.note;
    const se=sessionOf(D.seId),st=studentOf(D.sid),d=recDerived(),rg=D.range;
    if(!(d.pages>0))return;
    D.error=null;
    try{
      const tl=D.type==='tilawah';
      const dbId=D.existing?.id||offlineUuid();
      const sd={mode:rg.mode||'ayahs',selected_juz:rg.selectedJuz||[],start_global:null,end_global:null,qcf_line_keys:rg.lineKeys||[],smart_plan_id:D.planId||null,smart_plan_type:D.planType||null,smart_plan_date:D.planId?(D.planDate||se.session_date):null};
      if(tl){const a=D.tl;sd.tilawah_assessment={version:1,riwayah:a.riwayah,lahn_jali:a.lahn_jali,lahn_khafi:a.lahn_khafi,makharij:a.makharij,tajweed:a.tajweed,waqf_ibtida:a.waqf_ibtida,fluency:a.fluency,issue_keys:[...a.issues].sort(),overall_score:tlScore(a),manual_teacher_assessment:true}}
      const data={session_id:se.id,student_id:D.sid,activity_type:D.type,input_method:rg.mode||'ayahs',start_surah:rg.startSurah||null,start_ayah:rg.startAyah||null,end_surah:rg.endSurah||null,end_ayah:rg.endAyah||null,start_page:rg.startPage||null,end_page:rg.endPage||null,pages_count:d.pages,ayahs_count:rg.ayahs||0,surahs_count:rg.surahs||0,mistakes:tl?D.tl.lahn_jali+D.tl.lahn_khafi:D.mistakes,prompts:tl?0:D.prompts,teacher_note:(D.note||'').trim()||null,selected_surahs:rg.selectedSurahs||[],selection_data:sd,created_by:uid()};
      const wasEdit=!!D.existing;
      const rows=[];
      const others=recsOf(D.sid);
      const prevIds=others.map(r=>r.id);
      for(const r of others){
        if(sid_(r.id)===sid_(D.existing?.id)){rows.push(finishRow(se,D.sid,data,dbId))}
        else rows.push(finishRow(se,D.sid,recData(se.id,D.sid,r),r.id));
      }
      if(!wasEdit)rows.push(finishRow(se,D.sid,data,dbId));
      const payload=buildPayload(se,D.sid,rows);
      D.saving=true;partialRec();
      const ok=commitReport(se,payload);
      D.saving=false;
      NX.closeDialog('nrRecDlg');R.rec=null;
      refreshCard(D.sid);if(ok===false)return;
      if(wasEdit)snack('تم تعديل التسميع وإعادة حساب الخطة');
      else snack('تم حفظ التسميع',{action:'تراجع',onAction:()=>undoNew(se.id,D.sid,dbId,prevIds)});
      void st;
    }catch(e){
      console.error(e);D.saving=false;D.error=e.message||'تعذر حفظ التسميع';drawRec();
    }
  };
  function undoNew(seId,sid,newId,prevIds){
    const se=sessionOf(seId);if(!se)return;
    const rows=recsOf(sid).filter(r=>sid_(r.id)!==sid_(newId)).map(r=>finishRow(se,sid,recData(se.id,sid,r),r.id));
    const payload=buildPayload(se,sid,rows);payload.existingRecIds=Array.from(new Set([...payload.existingRecIds,newId,...prevIds]));
    commitReport(se,payload);if(R.sid===sid_(seId))refreshCard(sid);snack('تم التراجع عن التسميع');
  }

  // ---------------------------------------------------------------- Quran range picker (QuranRangePickerDialog)
  const TRAV=[['reverse','من الناس إلى البقرة'],['forward','من البقرة إلى الناس']];
  function surahsForJuz(j){const a=globalAyah(...juzStarts[j-1]),b=j<30?globalAyah(...juzStarts[j])-1:6236,out=[];for(let s=1;s<=114;s++){const x=globalAyah(s,1),y=globalAyah(s,ayahCounts[s-1]);if(x<=b&&y>=a)out.push(s)}return out}
  function juzRange(j){const st=juzStarts[j-1];let en;if(j<30){const ng=globalAyah(...juzStarts[j]);en=surahAyahFromGlobal(ng-1)}else en=[114,ayahCounts[113]];return [st[0],st[1],en[0],en[1]]}
  NS.openPicker=function(){
    const D=R.rec,rg=D.range;
    const hifzLike=['new_hifz','review_near','review_far','tathbit'].includes(D.type);
    const P=R.pick={open:true,mode:rg&&['ayahs','pages','surahs','juz'].includes(rg.mode)?rg.mode:'ayahs',dir:'reverse',hifzLike,
      ss:rg?.startSurah||78,sa:rg?.startAyah||1,es:rg?.endSurah||rg?.startSurah||78,ea:rg?.endAyah||maxAyah(rg?.endSurah||78),
      juzF:rg?.startSurah?quranJuzForAyah(rg.startSurah,rg.startAyah||1):30,
      sp:rg?.startPage||'',ep:rg?.endPage||'',spl:null,epl:null,surahSet:new Set(rg?.mode==='surahs'?rg.selectedSurahs:[]),juzSet:new Set(rg?.mode==='juz'?rg.selectedJuz:[]),q:''};
    if(!rg||!rg.startSurah){P.ss=P.es=78;P.sa=1;P.ea=maxAyah(78)}
    drawPicker();
    if(!layout()&&typeof ensureQuranLayout==='function')ensureQuranLayout(false).then(()=>{if(R.pick?.open)drawPicker()});
  };
  function pickCalc(){
    const P=R.pick,L=layout();
    try{
      if(!L)throw new Error('جارٍ تجهيز بيانات المصحف… اتصل بالإنترنت لتنزيلها أول مرة');
      let ranges,startS,startA,endS,endA,sp=null,ep=null,surahCount=0,selS=[],selJ=[];
      const fwd=(a,b,c,d)=>{if(globalAyah(c,d)<globalAyah(a,b))throw new Error('نهاية النطاق قبل بدايته');return [[a,b,c,d]]};
      if(P.mode==='ayahs'||P.mode==='pages'){
        let ss,sa,es,ea;
        if(P.mode==='pages'){
          const a=parseInt(P.sp,10),b=parseInt(P.ep,10);
          if(!(a>=1&&a<=604)||!(b>=1&&b<=604))throw new Error('اختر صفحتي البداية والنهاية بين 1 و604');
          if(b<a)throw new Error('نهاية النطاق قبل بدايته');
          const so=pageAyahs(a),eo=pageAyahs(b);
          const s0=P.spl&&so.find(x=>x.s===P.spl.s&&x.a===P.spl.a)||so[0],e0=P.epl&&eo.find(x=>x.s===P.epl.s&&x.a===P.epl.a)||eo.at(-1);
          if(!s0||!e0)throw new Error('تعذر تحديد آيات الصفحات');
          ss=s0.s;sa=s0.a;es=e0.s;ea=e0.a;sp=a;ep=b;
        }else{ss=P.ss;sa=P.sa;es=P.es;ea=P.ea}
        if(sa>maxAyah(ss)||ea>maxAyah(es))throw new Error('رقم الآية يتجاوز عدد آيات السورة');
        const reverse=P.mode==='ayahs'&&P.hifzLike&&P.dir==='reverse'&&ss>es;
        if(reverse){ranges=[[ss,sa,ss,maxAyah(ss)]];for(let s=ss-1;s>es;s--)ranges.push([s,1,s,maxAyah(s)]);ranges.push([es,1,es,ea])}
        else ranges=fwd(ss,sa,es,ea);
        startS=ss;startA=sa;endS=es;endA=ea;surahCount=Math.abs(es-ss)+1;
      }else if(P.mode==='surahs'){
        selS=[...P.surahSet].sort((a,b)=>a-b);if(!selS.length)throw new Error('اختر سورة واحدة على الأقل');
        ranges=selS.map(n=>[n,1,n,maxAyah(n)]);startS=selS[0];startA=1;endS=selS.at(-1);endA=maxAyah(endS);surahCount=selS.length;
      }else{
        selJ=[...P.juzSet].sort((a,b)=>a-b);if(!selJ.length)throw new Error('اختر جزءاً واحداً على الأقل');
        ranges=selJ.map(juzRange);startS=ranges[0][0];startA=ranges[0][1];endS=ranges.at(-1)[2];endA=ranges.at(-1)[3];
      }
      const keys=new Set();let ayahs=0,minP=0,maxP=0;
      for(const [a,b,c,d] of ranges){
        ayahs+=globalAyah(c,d)-globalAyah(a,b)+1;
        for(const k of linesForRange(L,a,b,c,d)){keys.add(k);const p=+k.split(':')[0];if(!minP||p<minP)minP=p;if(p>maxP)maxP=p}
      }
      const lineKeys=[...keys],lm=Number(L.lineModel||15);
      if(!lineKeys.length)throw new Error('تعذر حساب سطور النطاق');
      return {ok:true,res:{mode:P.mode,startSurah:startS,startAyah:startA,endSurah:endS,endAyah:endA,lineKeys,pages:lineKeys.length/lm,startPage:sp||minP,endPage:ep||maxP,ayahs,surahs:P.mode==='ayahs'||P.mode==='pages'?surahCount:(P.mode==='surahs'?surahCount:0),selectedSurahs:selS,selectedJuz:selJ}};
    }catch(e){return {ok:false,error:e.message||String(e)}}
  }
  function pickResultHtml(r){
    if(!r.ok)return `<p class="nr-pick-err">${h(r.error||'اختر نطاقًا صالحًا لحساب المقدار')}</p>`;
    const x=r.res;
    return `<div class="nr-pick-res"><div><b>${plain(x.pages)}</b> صفحة</div><div><b>${x.ayahs}</b> آية</div><div><b>${Math.max(1,x.mode==='juz'?new Set(x.lineKeys.map(()=>0)).size&&x.selectedJuz.length:x.surahs)}</b> ${x.mode==='juz'?'جزء':'سورة'}</div></div><small>QCF4 · مصحف المدينة · 604 صفحة · 15 سطرًا</small>`;
  }
  function pickBody(){
    const P=R.pick;let content='';
    const sopts=(list,sel)=>list.map(s=>`<option value="${s}" ${s===sel?'selected':''}>${s}. ${h(surahName(s))}</option>`).join('');
    const aopts=(n,sel)=>Array.from({length:maxAyah(n)},(_,i)=>`<option value="${i+1}" ${i+1===sel?'selected':''}>${i+1}</option>`).join('');
    const sel=(label,id,opts,fn)=>NX.field(label,{html:`<select id="${id}" onchange="${fn}">${opts}</select>`});
    if(P.mode==='pages'){
      const so=pageAyahs(+P.sp),eo=pageAyahs(+P.ep);
      const o=(list,cur)=>list.map((x,i)=>`<option value="${x.s}:${x.a}" ${cur&&cur.s===x.s&&cur.a===x.a?'selected':''}>${h(surahName(x.s))} · آية ${x.a}</option>`).join('');
      content=`<p class="nr-hint">اختر الصفحة، ثم اختر الآية الدقيقة داخلها. لن تُحسب الصفحة كاملة إلا إذا اخترت أول آية وآخر آية فيها.</p>
        <div class="nr-two">${NX.field('صفحة البداية',{id:'nrPSp',type:'text',inputmode:'numeric',value:P.sp,onchange:"NSR.pk('sp',this.value)"})}${NX.field('صفحة النهاية',{id:'nrPEp',type:'text',inputmode:'numeric',value:P.ep,onchange:"NSR.pk('ep',this.value)"})}</div>
        ${so.length?sel('آية البداية في الصفحة','nrPSpl',o(so,P.spl||so[0]),"NSR.pk('spl',this.value)"):''}
        ${eo.length?sel('آية النهاية في الصفحة','nrPEpl',o(eo,P.epl||eo.at(-1)),"NSR.pk('epl',this.value)"):''}`;
    }else if(P.mode==='surahs'){
      const q=norm(P.q),vis=Array.from({length:114},(_,i)=>i+1).filter(s=>!q||String(s).includes(q)||norm(surahName(s)).includes(q));
      content=`<p class="nr-hint">يمكن اختيار سور غير متجاورة؛ اضغط السورة لإضافتها أو إزالتها.</p>
        <label class="nx-search"><input type="search" id="nrPQ" placeholder="بحث عن سورة" value="${h(P.q)}" oninput="NSR.pq(this.value)" autocomplete="off"></label>
        <div class="nr-surahs" id="nrSurahs">${vis.map(s=>`<button type="button" class="nr-sur ${P.surahSet.has(s)?'on':''}" onclick="NSR.pkSet('surah',${s})"><i>${s}</i><span>${h(surahName(s))}</span>${P.surahSet.has(s)?ic('Check',16):''}</button>`).join('')}</div>
        <p class="nr-hint" id="nrPSum">${P.surahSet.size?`المحدد: ${[...P.surahSet].sort((a,b)=>a-b).map(surahName).join('، ')}`:'لم يتم اختيار سور'}</p>`;
    }else if(P.mode==='juz'){
      content=`<p class="nr-hint">يمكن اختيار جزء أو أكثر، حتى لو كانت الأجزاء غير متجاورة.</p>
        <div class="nr-juz">${Array.from({length:30},(_,i)=>i+1).map(j=>NX.chip(String(j),{selected:P.juzSet.has(j),check:false,onclick:`NSR.pkSet('juz',${j})`})).join('')}</div>
        <p class="nr-hint">${P.juzSet.size?`الأجزاء المحددة: ${[...P.juzSet].sort((a,b)=>a-b).join('، ')}`:'لم يتم اختيار أجزاء'}</p>`;
    }else{
      const list=surahsForJuz(P.juzF);
      const inList=s=>list.includes(s)?s:list[0];
      content=`<b class="nr-lab">فلترة السور حسب الجزء</b>
        <div class="nx-chips nr-juzstrip">${Array.from({length:30},(_,i)=>i+1).map(j=>NX.chip(String(j),{selected:P.juzF===j,check:false,onclick:`NSR.pkJuz(${j})`})).join('')}</div>
        <div class="nr-two">${sel('سورة البداية','nrPSs',sopts(list,inList(P.ss)),"NSR.pk('ss',+this.value)")}${sel('سورة النهاية','nrPEs',sopts(list,inList(P.es)),"NSR.pk('es',+this.value)")}</div>
        <div class="nr-two">${sel('من آية','nrPSa',aopts(P.ss,P.sa),"NSR.pk('sa',+this.value)")}${sel('إلى آية','nrPEa',aopts(P.es,P.ea),"NSR.pk('ea',+this.value)")}</div>
        ${P.ss===P.es?`<div class="nr-sliders"><input type="range" min="1" max="${maxAyah(P.ss)}" value="${P.sa}" aria-label="من آية" oninput="NSR.pkSlide('sa',+this.value)"><input type="range" min="1" max="${maxAyah(P.es)}" value="${P.ea}" aria-label="إلى آية" oninput="NSR.pkSlide('ea',+this.value)"></div>`:''}`;
    }
    const tabs=[['ayahs','آية','MenuBook'],['pages','صفحات','Description'],['surahs','سور','FormatListNumbered'],['juz','أجزاء','Apps']];
    return `<div class="nr-modes" role="tablist">${tabs.map(([k,l,i])=>`<button type="button" role="tab" class="nr-mode ${P.mode===k?'on':''}" aria-selected="${P.mode===k}" onclick="NSR.pkMode('${k}')">${ic(i,20)}<span>${l}</span></button>`).join('')}</div>
      ${P.hifzLike?`<b class="nr-lab">اتجاه الحفظ / التقدم</b><div class="nr-chipgrid">${TRAV.map(([k,l])=>NX.chip(l,{selected:P.dir===k,onclick:`NSR.pkDir('${k}')`})).join('')}</div><p class="nr-hint">${P.dir==='reverse'?'بعد نهاية السورة ننتقل إلى السورة السابقة رقمًا، مع بقاء الآيات داخل السورة تصاعدية.':'نتقدم حسب ترتيب المصحف من السورة الأقل رقمًا إلى الأعلى، والآيات داخل السورة تصاعدية.'}</p>`:''}
      ${content}<hr class="nx-divider"><div id="nrPickRes">${pickResultHtml(pickCalc())}</div>`;
  }
  function pickFooter(){
    const r=pickCalc();
    return `${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nrPickDlg')"})}<button type="button" id="nrPickOk" class="nx-btn nx-filled" ${r.ok?'':'disabled'} onclick="NSR.pickOk()"><span>اعتماد الاختيار</span></button>`;
  }
  function drawPicker(){
    redraw('nrPickDlg',()=>NX.dialog('nrPickDlg','اختيار المقرر من المصحف',pickBody(),{cls:'nr-pick-dlg',footer:pickFooter(),onClose:()=>{if(R.pick)R.pick.open=false}}));
  }
  function pickPartial(){const r=pickCalc();setHtml('nrPickRes',pickResultHtml(r));const b=$id('nrPickOk');if(b)b.disabled=!r.ok}
  NS.pkMode=m=>{R.pick.mode=m;drawPicker()};
  NS.pkDir=d=>{R.pick.dir=d;drawPicker()};
  NS.pkJuz=j=>{const P=R.pick;P.juzF=j;const l=surahsForJuz(j);P.ss=l[0];P.sa=1;if(!l.includes(P.es)){P.es=l[0];P.ea=maxAyah(l[0])}drawPicker()};
  NS.pk=(k,v)=>{
    const P=R.pick;
    if(k==='ss'){P.ss=v;P.sa=1;if(P.es<v&&!(P.hifzLike&&P.dir==='reverse')){P.es=v;P.ea=maxAyah(v)}}
    else if(k==='es'){P.es=v;P.ea=maxAyah(v)}
    else if(k==='sa')P.sa=v;else if(k==='ea')P.ea=v;
    else if(k==='sp'){P.sp=String(v).replace(/\D/g,'').slice(0,3);P.spl=null;if(!P.ep)P.ep=P.sp}
    else if(k==='ep'){P.ep=String(v).replace(/\D/g,'').slice(0,3);P.epl=null}
    else if(k==='spl'||k==='epl'){const [s,a]=String(v).split(':').map(Number);P[k]={s,a}}
    drawPicker();
  };
  NS.pkSlide=(k,v)=>{
    const P=R.pick;P[k]=v;if(P.sa>P.ea){if(k==='sa')P.ea=v;else P.sa=v}
    const sa=$id('nrPSa'),ea=$id('nrPEa');if(sa)sa.value=P.sa;if(ea)ea.value=P.ea;pickPartial();
  };
  NS.pkSet=(kind,n)=>{const P=R.pick,s=kind==='surah'?P.surahSet:P.juzSet;s.has(n)?s.delete(n):s.add(n);drawPicker()};
  NS.pq=v=>{const P=R.pick;P.q=v;const box=$id('nrSurahs');if(!box)return;const q=norm(v);
    box.innerHTML=Array.from({length:114},(_,i)=>i+1).filter(s=>!q||String(s).includes(q)||norm(surahName(s)).includes(q)).map(s=>`<button type="button" class="nr-sur ${P.surahSet.has(s)?'on':''}" onclick="NSR.pkSet('surah',${s})"><i>${s}</i><span>${h(surahName(s))}</span>${P.surahSet.has(s)?ic('Check',16):''}</button>`).join('')};
  NS.pickOk=function(){
    const r=pickCalc();if(!r.ok)return;
    R.rec.range=r.res;R.pick.open=false;NX.closeDialog('nrPickDlg');
    // an explicitly picked range is no longer the plan's prefill, but the plan link stays so progress is credited
    drawRec();
  };

  // ---------------------------------------------------------------- legacy entry points (kept, re-implemented on the native UI)
  const prevOpenDaily=typeof openDailyForStudent==='function'?openDailyForStudent:null;
  openDailyForStudent=async function(sid,seId=null){
    const st=studentOf(sid),se=seId?sessionOf(seId):(typeof latestSession==='function'?latestSession():null);
    if(!se)return typeof openSession==='function'?openSession():undefined;
    if(!st)return;
    if(se.status==='closed'){toast('الجلسة مرفوعة. استخدم «تعديل الجلسة» أولاً.');return}
    if(isLesson(se)){
      if(!rosterOk(se.id)){try{await loadSessionRosterData(se.id)}catch(_e){}}
      R.sid=R.sid||sid_(se.id);return NS.openActivity(sid);
    }
    await openRecitation(sid,se.id,null);
  };
  quickOpenRecitation=async function(sid,seId,type){
    const se=sessionOf(seId);
    if(se&&se.status==='closed'){toast('الجلسة مرفوعة. استخدم «تعديل الجلسة» أولاً.');return}
    if(se&&isLesson(se))return openDailyForStudent(sid,seId);
    await openRecitation(sid,seId,type);
  };
  quickAttendance=async function(sid,seId,status,el=null){
    if(!status){if(el)el.value=attOf(sid)?.status||'';return}
    if(R.sid!==sid_(seId)){R.sid=sid_(seId)}
    NS.setAtt(sid,status);
  };
  quickPresenceToggle=async function(sid,seId,on){return quickAttendance(sid,seId,on?'present':'absent')};
  quickBehavior=async function(sid,seId,behavior){if(R.sid!==sid_(seId))R.sid=sid_(seId);NS.setBeh(sid,behavior)};
  filterSessionRosterDom=function(v=''){NS.search(v)};
  setSessionSort=function(v){state.sessionSort=v;NS.setSort(v==='alpha'?'alpha':'priority')};
  void BASE_PAGE;void prevOpenDaily;

  // keyboard: "/" focuses the search field while a roster is on screen (desktop friendliness)
  document.addEventListener('keydown',e=>{
    if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey)return;
    const t=e.target,tag=(t?.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select'||t?.isContentEditable)return;
    if(document.querySelector('dialog[open]'))return;
    const i=$id('nrSearch');if(i){e.preventDefault();i.focus();i.select()}
  });
})();
