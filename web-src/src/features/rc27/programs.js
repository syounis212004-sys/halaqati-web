/* Halaqati v2.63.22 — program mode: tilawah assessment, program-only surfaces, ranking and reports.
   Follows the native WorkModeRules: programs are measured by tilawah/tajweed performance, never by hifz amounts. */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kind=()=>(typeof window.rc27Scope==='function'?window.rc27Scope().kind:'regular');
  const isProgramMode=()=>kind()==='program';
  const today0=()=>new Date().toISOString().slice(0,10);
  const monthStart0=()=>today0().slice(0,8)+'01';

  // ---------- Tilawah assessment (native: lahn jali/khafi + four 1..5 ratings) ----------
  const RATINGS=[['makharij','المخارج والصفات'],['tajweed','أحكام التجويد'],['waqf_ibtida','الوقف والابتداء'],['fluency','الطلاقة']];
  function readAssess(row){try{return JSON.parse(row.dataset.tilawah||'null')}catch(_e){return null}}
  function blank(){return {version:1,riwayah:'hafs',lahn_jali:0,lahn_khafi:0,makharij:5,tajweed:5,waqf_ibtida:5,fluency:5,manual_teacher_assessment:true}}
  function score(a){const base=((a.makharij+a.tajweed+a.waqf_ibtida+a.fluency)/20)*100;return Math.round(Math.max(0,Math.min(100,base-a.lahn_jali*8-a.lahn_khafi*3))*10)/10}
  function evalOf(s){return s>=90?'excellent':s>=80?'very_good':s>=70?'good':'repeat'}
  function panelHtml(a){
    const s=score(a);
    return `<div class="rc27-tilawah"><b>تقييم التلاوة</b><div class="form-grid"><label class="field"><span>الرواية</span><select data-k="riwayah"><option value="hafs" ${a.riwayah==='hafs'?'selected':''}>حفص عن عاصم</option><option value="warsh" ${a.riwayah==='warsh'?'selected':''}>ورش عن نافع</option><option value="other" ${a.riwayah==='other'?'selected':''}>أخرى</option></select></label><label class="field"><span>لحن جلي</span><input class="input" type="number" min="0" data-k="lahn_jali" value="${a.lahn_jali}"></label><label class="field"><span>لحن خفي</span><input class="input" type="number" min="0" data-k="lahn_khafi" value="${a.lahn_khafi}"></label>${RATINGS.map(([k,l])=>`<label class="field"><span>${l} (1–5)</span><select data-k="${k}">${[1,2,3,4,5].map(n=>`<option ${a[k]===n?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}</div><div class="rc27-tscore">النتيجة: <strong>${s}%</strong> · ${typeof evalAr!=='undefined'?evalAr[evalOf(s)]:evalOf(s)}</div></div>`;
  }
  function mount(row){
    let box=row.querySelector('.rc27-tilawah-box');
    const type=row.querySelector('.rType')?.value;
    if(type!=='tilawah'){box?.remove();return}
    const a=Object.assign(blank(),readAssess(row)||{});
    row.dataset.tilawah=JSON.stringify(a);
    if(!box){box=document.createElement('div');box.className='rc27-tilawah-box';const body=row.querySelector('.rec-body');(body||row).appendChild(box);
      box.addEventListener('change',e=>{const k=e.target.dataset?.k;if(!k)return;const cur=Object.assign(blank(),readAssess(row)||{});cur[k]=k==='riwayah'?e.target.value:Math.max(0,Number(e.target.value)||0);row.dataset.tilawah=JSON.stringify(cur);box.innerHTML=panelHtml(cur)});
    }
    box.innerHTML=panelHtml(a);
  }
  window.rc27SyncTilawah=mount;
  window.rc27TilawahApply=function(row,data){
    if(typeof rc27TagPhase==='function')rc27TagPhase(data);
    if(!row.dataset.dbId&&data.activity_type==='new_hifz'&&typeof rc27GapCheck==='function')rc27GapCheck(data);
    if(data.activity_type!=='tilawah')return;
    const a=Object.assign(blank(),readAssess(row)||{}),s=score(a);
    a.overall_score=s;data.selection_data=Object.assign({},data.selection_data,{tilawah_assessment:a});
    data.mistakes=a.lahn_jali+a.lahn_khafi;data.prompts=0;data.evaluation=evalOf(s);
  };
  // native saveRecitation: tilawah rows carry the assessment score as safety, TILAWAH_V1 scoring and its own evaluation
  window.rc27AfterDecorate=function(d){
    const a=d.activity_type==='tilawah'&&d.selection_data?.tilawah_assessment;
    if(a&&a.overall_score!=null){d.safety_percentage=Number(a.overall_score);d.evaluation=evalOf(Number(a.overall_score));d.scoring_version='TILAWAH_V1'}
    return d;
  };
  // rows are created by addRecitationRow / edit loaders; mount the panel (and limit program tabs) when they appear
  function currentSessionIsProgram(){
    try{const se=state.sessions.find(x=>String(x.id)===String(state.sessionView));const hq=state.halaqas.find(x=>x.id===se?.halaqa_id);return rc27IsProgram(hq)}catch(_e){return false}
  }
  new MutationObserver(muts=>{
    for(const m of muts)for(const n of m.addedNodes){
      if(n.nodeType!==1)continue;
      const rows=n.matches?.('.rec-row')?[n]:[...(n.querySelectorAll?.('.rec-row')||[])];
      rows.forEach(row=>{
        if(currentSessionIsProgram()){
          row.querySelectorAll('.rec-body > .tabs .tab').forEach(b=>{const t=b.textContent.trim();if(t!=='تلاوة'&&t!=='اختبار')b.style.display='none'});
          if(!row.dataset.dbId&&row.querySelector('.rType')&&row.querySelector('.rType').value!=='tilawah'){const t=[...row.querySelectorAll('.rec-body > .tabs .tab')].find(b=>b.textContent.trim()==='تلاوة');t?.click()}
        }
        setTimeout(()=>mount(row),0);
      });
    }
  }).observe(document.documentElement,{childList:true,subtree:true});

  // ---------- Program-only surfaces ----------
  if(typeof navItems==='function'){
    const baseNav=navItems;
    navItems=function(){const r=baseNav.apply(this,arguments);return isProgramMode()?r.filter(x=>x[0]!=='plans'):r};
  }
  if(typeof mobileNavItems==='function'){
    const baseM=mobileNavItems;
    mobileNavItems=function(){const r=baseM.apply(this,arguments);return isProgramMode()?r.filter(x=>x[0]!=='plans'):r};
  }
  if(typeof plansPage==='function'){
    const basePlans=plansPage;
    plansPage=function(){
      if(state.profile?.role!=='guardian'&&isProgramMode())return `<div class="hero"><h2>الخطط الذكية</h2><p>الخطط الذكية خاصة بطلاب الحلقات، ولا تُستخدم في البرامج والدورات.</p></div><div class="empty">اختر حلقة عادية من شريط النطاق لعرض الخطط.</div>`;
      return basePlans.apply(this,arguments);
    };
  }

  // ---------- Program data (recitations + attendance) ----------
  const cache=new Map;
  window.addEventListener('halaqati:sessionchange',()=>cache.clear());
  async function programData(from,to){
    const ids=new Set(((window.RC27&&RC27.master&&RC27.master.halaqas)||state.halaqas).filter(rc27IsProgram).map(x=>x.id));
    const sc=rc27Scope();const hids=sc.selectedId?new Set([sc.selectedId]):ids;
    const key=state.user?.id+'|'+from+'|'+to+'|'+[...hids].sort().join(',');const hit=cache.get(key);if(hit&&Date.now()-hit.at<120000)return hit.v;
    const f=q=>q.gte('sessions.session_date',from).lte('sessions.session_date',to).neq('sessions.status','cancelled');
    const [rec,att]=await Promise.all([
      window.HalaqatiData.result(()=>f(db.from('recitation_entries').select('student_id,activity_type,points,selection_data,evaluation,sessions!inner(session_date,halaqa_id,status)')).order('id'),()=>state.user?.id),
      window.HalaqatiData.result(()=>f(db.from('attendance_records').select('student_id,status,sessions!inner(session_date,halaqa_id,status)')).order('session_id').order('student_id'),()=>state.user?.id)]);
    if(rec.error)throw rec.error;if(att.error)throw att.error;
    const v={rec:(rec.data||[]).filter(r=>hids.has(r.sessions?.halaqa_id)),att:(att.data||[]).filter(r=>hids.has(r.sessions?.halaqa_id)),hids};
    cache.set(key,{at:Date.now(),v});return v;
  }
  function aggregate(data){
    const by=new Map(state.students.filter(s=>s.status!=='withdrawn').map(s=>[s.id,{id:s.id,name:s.full_name,scores:[],present:0,absent:0,excused:0,late:0,recs:0,points:0,jali:0,khafi:0}]));
    const get=id=>by.get(id)||(by.set(id,{id,name:state.students.find(s=>s.id===id)?.full_name||'طالب',scores:[],present:0,absent:0,excused:0,late:0,recs:0,points:0,jali:0,khafi:0}).get(id));
    data.rec.forEach(r=>{const a=get(r.student_id);a.recs++;a.points+=Number(r.points||0);const t=r.selection_data?.tilawah_assessment;if(t){if(t.overall_score!=null&&t.overall_score>=0&&t.overall_score<=100)a.scores.push(Number(t.overall_score));a.jali+=Number(t.lahn_jali||0);a.khafi+=Number(t.lahn_khafi||0)}});
    data.att.forEach(r=>{const a=get(r.student_id);if(r.status in a)a[r.status]++});
    return [...by.values()].map(a=>({...a,avg:a.scores.length?Math.round(a.scores.reduce((x,y)=>x+y,0)/a.scores.length*10)/10:null,presentDays:a.present+a.late}));
  }
  const rankSort=rows=>rows.slice().sort((a,b)=>(b.avg??-1)-(a.avg??-1)||b.presentDays-a.presentDays||b.recs-a.recs||b.points-a.points);
  const range=()=>state.rankPeriod==='day'?[today0(),today0()]:[monthStart0(),today0()];
  async function fillRanking(){
    const box=document.getElementById('rc27ProgRank');if(!box)return;
    try{
      const [from,to]=range(),rows=rankSort(aggregate(await programData(from,to)));
      if(!box.isConnected)return;
      box.innerHTML=rows.length?rows.map((x,i)=>`<div class="card rank-row"><div class="rank">${i+1}</div><div class="grow"><b>${h(x.name)}</b><div class="muted">درجة التلاوة والتجويد: ${x.avg==null?'—':x.avg+'%'} · حضور ${x.presentDays} · تسميعات ${x.recs} · نقاط ${typeof fmt==='function'?fmt(x.points):x.points}</div></div></div>`).join(''):'<div class="empty">لا يوجد مشاركون.</div>';
    }catch(e){if(box.isConnected)box.innerHTML=`<div class="notice">تعذر تحميل الترتيب: ${h(e.message||e)}</div>`}
  }
  if(typeof rankingPage==='function'){
    const baseRank=rankingPage;
    rankingPage=function(){
      if(state.profile?.role==='guardian'||!isProgramMode())return baseRank.apply(this,arguments);
      setTimeout(fillRanking,0);
      return `<div class="hero"><h2>ترتيب البرنامج</h2><p>يُرتَّب المشاركون بمتوسط درجة التلاوة والتجويد ثم الحضور ثم عدد التسميعات ثم النقاط.</p></div><div class="seg" style="margin-top:13px"><button class="${state.rankPeriod==='day'?'active':''}" onclick="setRankPeriod('day')">اليوم</button><button class="${state.rankPeriod!=='day'?'active':''}" onclick="setRankPeriod('month')">الشهر</button></div><div id="rc27ProgRank" style="margin-top:12px"><div class="muted">جارٍ التحميل…</div></div>`;
    };
  }

  // ---------- Program reports ----------
  const rep={tab:'attendance',from:null,to:null};
  window.rc27SetProgReport=function(k,v){rep[k]=v;if(k==='tab'||k==='from'||k==='to')render()};
  function reportPaper(title,inner){
    const org=state.settings?.organization_name||'حلقتي';
    return `<div class="report-paper" id="rc27ReportPaper"><div class="report-head"><h2>${h(title)}</h2><div class="muted">${h(org)} · ${h(rep.from)} → ${h(rep.to)}</div></div>${inner}<div class="report-footer"><span>تقرير صادر من نظام حلقتي</span></div></div>`;
  }
  async function fillProgReport(){
    const box=document.getElementById('rc27ProgReport');if(!box)return;
    try{
      const data=await programData(rep.from,rep.to),rows=aggregate(data);
      if(!box.isConnected)return;
      let html='';
      if(rep.tab==='attendance'){
        html=reportPaper('تقرير الحضور',`<table class="table"><thead><tr><th>الطالب</th><th>حاضر</th><th>متأخر</th><th>بعذر</th><th>غائب</th><th>نسبة الحضور</th></tr></thead><tbody>${rows.map(x=>{const tot=x.present+x.late+x.excused+x.absent;return `<tr><td>${h(x.name)}</td><td>${x.present}</td><td>${x.late}</td><td>${x.excused}</td><td>${x.absent}</td><td>${tot?Math.round((x.present+x.late)/tot*100)+'%':'—'}</td></tr>`}).join('')}</tbody></table>`);
      }else if(rep.tab==='evaluation'){
        html=reportPaper('نتائج التقييم',`<table class="table"><thead><tr><th>#</th><th>الطالب</th><th>التسميعات</th><th>متوسط الدرجة</th><th>لحن جلي</th><th>لحن خفي</th></tr></thead><tbody>${rankSort(rows).map((x,i)=>`<tr><td>${i+1}</td><td>${h(x.name)}</td><td>${x.recs}</td><td>${x.avg==null?'—':x.avg+'%'}</td><td>${x.jali}</td><td>${x.khafi}</td></tr>`).join('')}</tbody></table>`);
      }else{
        const hs=state.halaqas.filter(x=>data.hids.has(x.id)),sess=state.sessions.filter(s=>data.hids.has(s.halaqa_id)&&s.session_date>=rep.from&&s.session_date<=rep.to&&s.status!=='cancelled');
        const scored=rows.filter(x=>x.avg!=null),avg=scored.length?Math.round(scored.reduce((a,x)=>a+x.avg,0)/scored.length*10)/10:null;
        const pr=rows.reduce((a,x)=>a+x.presentDays,0),tot=rows.reduce((a,x)=>a+x.present+x.late+x.excused+x.absent,0);
        html=reportPaper('تقرير الدورة',`<div class="grid stats">${stat('البرامج',hs.map(x=>h(x.name)).join('، ')||'—')}${stat('المشاركون',rows.length)}${stat('الجلسات',sess.length)}${stat('نسبة الحضور',tot?Math.round(pr/tot*100)+'%':'—')}</div><div class="grid stats">${stat('متوسط الدرجة',avg==null?'—':avg+'%')}${stat('إجمالي التسميعات',rows.reduce((a,x)=>a+x.recs,0))}</div><h3>المراكز الأولى</h3>${rankSort(rows).slice(0,3).map((x,i)=>`<div class="card"><b>${i+1}. ${h(x.name)}</b> <span class="muted">${x.avg==null?'—':x.avg+'%'}</span></div>`).join('')||'<div class="empty">لا بيانات.</div>'}`);
      }
      box.innerHTML=html;
    }catch(e){if(box.isConnected)box.innerHTML=`<div class="notice">تعذر تحميل التقرير: ${h(e.message||e)}</div>`}
  }
  window.rc27PrintProgReport=function(){
    const p=document.getElementById('rc27ReportPaper');if(!p)return toast('لا يوجد تقرير للطباعة');
    const w=window.open('','_blank');if(!w)return toast('اسمح بالنوافذ المنبثقة للطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير</title><style>body{font-family:Cairo,Tahoma,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:right}.stat{display:inline-block;border:1px solid #ddd;border-radius:10px;padding:8px 14px;margin:4px}.stat span{display:block;font-size:12px;color:#666}</style></head><body>${p.innerHTML}</body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),300);
  };
  if(typeof reportsPage==='function'){
    const baseReports=reportsPage;
    reportsPage=function(){
      if(state.profile?.role==='guardian'||!isProgramMode())return baseReports.apply(this,arguments);
      if(!rep.from){rep.from=monthStart0();rep.to=today0()}
      setTimeout(fillProgReport,0);
      const tab=(k,l)=>`<button class="${rep.tab===k?'active':''}" onclick="rc27SetProgReport('tab','${k}')">${l}</button>`;
      return `<div class="hero"><h2>تقارير البرنامج</h2><p>الحضور ونتائج التقييم وتقرير الدورة.</p></div><div class="seg" style="margin-top:12px">${tab('attendance','الحضور')}${tab('evaluation','نتائج التقييم')}${tab('course','تقرير الدورة')}</div><div class="form-grid" style="margin-top:10px"><label class="field"><span>من</span><input class="input" type="date" value="${h(rep.from)}" onchange="rc27SetProgReport('from',this.value)"></label><label class="field"><span>إلى</span><input class="input" type="date" value="${h(rep.to)}" onchange="rc27SetProgReport('to',this.value)"></label></div><div class="actions" style="margin:8px 0"><button class="btn btn-soft" onclick="rc27PrintProgReport()">طباعة / حفظ PDF</button></div><div id="rc27ProgReport"><div class="muted">جارٍ التحميل…</div></div>`;
    };
  }

  // ---------- Program home ----------
  if(typeof homePage==='function'){
    const baseHome=homePage;
    homePage=function(){
      if(state.profile?.role==='guardian'||!isProgramMode())return baseHome.apply(this,arguments);
      setTimeout(async()=>{
        const box=document.getElementById('rc27ProgStats');if(!box)return;
        try{const rows=aggregate(await programData(monthStart0(),today0())),tot=rows.reduce((a,x)=>a+x.present+x.late+x.excused+x.absent,0),pr=rows.reduce((a,x)=>a+x.presentDays,0),sc=rows.filter(x=>x.avg!=null),avg=sc.length?Math.round(sc.reduce((a,x)=>a+x.avg,0)/sc.length*10)/10:null;
          if(box.isConnected)box.innerHTML=`<div class="grid stats">${stat('نسبة الحضور',tot?Math.round(pr/tot*100)+'%':'—')}${stat('متوسط الدرجة',avg==null?'—':avg+'%')}${stat('التسميعات',rows.reduce((a,x)=>a+x.recs,0))}${stat('الغياب',rows.reduce((a,x)=>a+x.absent,0))}</div>`}catch(_e){}
      },0);
      const m=today0().slice(0,7);
      return `<div class="hero"><h2>السلام عليكم، ${h(state.profile.full_name)}</h2><p>متابعة البرامج والدورات: الحضور والتلاوة والتقييم.</p></div><div class="grid stats">${stat('المشاركون',activeStudents().length)}${stat('جلسات الشهر',state.sessions.filter(s=>String(s.session_date||'').startsWith(m)&&s.status!=='cancelled').length)}</div><div id="rc27ProgStats"></div><div class="section-head"><h3>جلسة اليوم</h3><button class="mini" onclick="go('sessions')">الجلسات</button></div>${sessionCards(state.sessions.filter(s=>s.session_date===today0()).slice(0,2))}<div class="section-head"><h3>إعلانات مهمة</h3><button class="mini" onclick="go('community')">عرض الكل</button></div>${announcementCards(state.announcements.filter(a=>a.pinned).slice(0,2))}`;
    };
  }
})();
