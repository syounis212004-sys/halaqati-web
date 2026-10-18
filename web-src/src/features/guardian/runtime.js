/* Halaqati v2.42.0 — Guardian dashboard, cohort-safe ranks and compact smart summary. */
(function(){
  'use strict';
  if(typeof state==='undefined')return;
  state.guardianDashboards=state.guardianDashboards||{};
  state.guardianTrendDays=Number(state.guardianTrendDays||7);

  const isoDaysAgo=(n)=>{let d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-Number(n||0));return d.toISOString().slice(0,10)};
  const currentMonthBounds=()=>({from:monthStart(),to:monthEnd(today().slice(0,7))});

  window.loadGuardianDashboardData=async function({silent=true}={}){
    if(state.profile?.role!=='guardian'||!state.networkVerified||!navigator.onLine)return state.guardianDashboards;
    const children=typeof activeStudents==='function'?activeStudents():[];
    const mb=currentMonthBounds(),trendFrom=isoDaysAgo(29),next={...state.guardianDashboards};
    await Promise.all(children.map(async st=>{
      try{
        const [month,trend]=await Promise.all([
          db.rpc('guardian_student_dashboard_range',{p_student_id:st.id,p_from:mb.from,p_to:mb.to}),
          db.rpc('guardian_student_dashboard_range',{p_student_id:st.id,p_from:trendFrom,p_to:today()})
        ]);
        if(month.error)throw month.error;if(trend.error)throw trend.error;
        next[st.id]={month:month.data||{},trend:trend.data||{},loadedAt:new Date().toISOString()};
      }catch(e){
        console.warn('guardian dashboard v2.42 load skipped',e);
        if(!silent&&typeof toast==='function')toast('تعذر تحديث ملخص ولي الأمر: '+(e?.message||e));
      }
    }));
    state.guardianDashboards=next;try{cacheSnapshot()}catch(_e){};return next
  };

  function gDash(st){return state.guardianDashboards?.[st.id]||{month:{},trend:{}}}
  function rankMetric(st,metric='hifz'){return gDash(st).month?.ranks?.[metric]||null}
  function validRank(r,scope){let rank=Number(r?.[scope+'_rank']||0),total=Number(r?.[scope+'_total']||0),pages=Number(r?.pages||0);return pages>0&&rank>0&&total>0?{rank,total}:null}
  function rankText(st,scope='halaqa',metric='hifz'){let x=validRank(rankMetric(st,metric),scope);return x?`${x.rank} / ${x.total}`:'—'}
  function planInfo(st){
    if(typeof effectiveSmartPlans!=='function'||typeof smartPlanProgress!=='function')return null;
    let plan=effectiveSmartPlans(st,today()).find(p=>p.plan_type==='hifz')||effectiveSmartPlans(st,today())[0];if(!plan)return null;
    let p=smartPlanProgress(plan,st.id,today()),next=typeof smartPlanNextDuty==='function'?smartPlanNextDuty(plan,st,today()):null;
    return {plan,progress:p,next};
  }
  function latestTrendSafety(st){let a=(gDash(st).trend?.daily||[]).filter(x=>Number.isFinite(Number(x.safety)));return a.length?Number(a.at(-1).safety):null}
  function guardianSummary(st,m,info){
    let rank=validRank(rankMetric(st,'hifz'),'category'),parts=[];
    parts.push(`أنجز ${fmt(Number(m.hifz_pages||0))} صفحة حفظ هذا الشهر`);
    if(rank)parts.push(`وترتيبه ${rank.rank} من ${rank.total} في ${categoryName(st)}`);
    let p=info?.progress;if(p){if(Number(p.deficit||0)>0)parts.push(`عليه ${fmt(p.deficit)} ص تعويض موزعة على الأيام القادمة`);else if(Number(p.aheadBy||0)>0)parts.push(`ومتقدم عن الخطة بـ ${fmt(p.aheadBy)} ص`);}
    let next=info?.next?.progress?.assignment;if(next&&Number(next.pages||0)>0)parts.push(`المقرر القادم ${fmt(next.pages)} ص`);
    return parts.slice(0,3).join('، ')+'.';
  }
  function chartData(st,days){let from=isoDaysAgo(days-1),rows=(gDash(st).trend?.daily||[]).filter(x=>String(x.date)>=from&&String(x.date)<=today());let map=new Map(rows.map(x=>[String(x.date),x])),out=[];for(let i=days-1;i>=0;i--){let d=isoDaysAgo(i),r=map.get(d)||{};out.push({date:d,hifz:Number(r.hifz||0),review:Number(r.review||0),sard:Number(r.sard||0)})}return out}
  function guardianMiniChart(st){
    let days=[7,14,30].includes(Number(state.guardianTrendDays))?Number(state.guardianTrendDays):7,rows=chartData(st,days),total=rows.reduce((n,x)=>n+x.hifz,0),max=Math.max(1,...rows.map(x=>x.hifz)),top=Math.ceil(max*2)/2;
    let width=600,height=230,left=42,bottom=190,plot=width-left-12,step=plot/rows.length,bar=Math.min(36,step*.62);
    let grid=[0,.5,1].map(t=>{let y=bottom-t*154;return `<line x1="${left}" x2="590" y1="${y}" y2="${y}" stroke="#dce5e0" stroke-dasharray="4 4"/><text x="32" y="${y+4}" text-anchor="end" fill="#52675e" font-size="12">${fmt(top*t)}</text>`}).join('');
    let bars=rows.map((x,i)=>{let h=x.hifz/top*154,cx=left+step*(i+.5);return `<g><title>${x.date}: ${fmt(x.hifz)} صفحة</title><rect x="${cx-bar/2}" y="${bottom-h}" width="${bar}" height="${h}" rx="3" fill="#147a78"/>${days===7&&x.hifz>0?`<text x="${cx}" y="${bottom-h-7}" text-anchor="middle" fill="#124e47" font-size="12">${fmt(x.hifz)}</text>`:''}${days===7||i%Math.ceil(days/7)===0||i===days-1?`<text x="${cx}" y="213" text-anchor="middle" fill="#52675e" font-size="12">${x.date.slice(8)}</text>`:''}</g>`}).join('');
    let loaded=Array.isArray(gDash(st).trend?.daily),caption=loaded?'لا توجد صفحات حفظ مسجلة في هذه الفترة.':'لم تتوفر بيانات الرسم بعد. اتصل بالإنترنت لتحديثها.';
    return `<section class="guardian-trend-card"><div class="guardian-trend-head"><div><b>تطور الحفظ</b><small>صفحات التسميع يومًا بيوم</small></div><div class="guardian-trend-tabs" aria-label="فترة الرسم">${[7,14,30].map(n=>`<button aria-pressed="${days===n}" class="${days===n?'active':''}" onclick="setGuardianTrendDays(${n})">${n} أيام</button>`).join('')}</div></div><div class="guardian-chart-summary"><span>إجمالي الفترة <b>${loaded?fmt(total):'—'} ص</b></span><span>أيام الحفظ <b>${loaded?rows.filter(x=>x.hifz>0).length:'—'}</b></span></div>${total>0?`<svg class="guardian-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="صفحات الحفظ خلال ${days} يومًا، الإجمالي ${fmt(total)} صفحة" xmlns="http://www.w3.org/2000/svg">${grid}${bars}</svg>`:`<div class="guardian-chart-empty">${caption}</div>`}<details class="guardian-chart-data"><summary>عرض التفاصيل اليومية</summary><div class="guardian-chart-table"><table><thead><tr><th>التاريخ</th><th>الحفظ بالصفحات</th></tr></thead><tbody>${loaded?rows.map(x=>`<tr><td><bdi>${x.date}</bdi></td><td>${fmt(x.hifz)}</td></tr>`).join(''):`<tr><td colspan="2">${caption}</td></tr>`}</tbody></table></div></details></section>`;
  }
  window.setGuardianTrendDays=function(n){state.guardianTrendDays=[7,14,30].includes(Number(n))?Number(n):7;try{cacheSnapshot()}catch(_e){};render()};

  window.guardianRankTiles=function(st,period='month'){
    if(period!=='month')return `<div class="guardian-rank-grid">${['hifz','review','sard'].map(t=>{let x=rankRowFor(st.id,t,period),has=x&&Number(x.pages)>0;return `<div class="guardian-rank"><span>${trackAr[t]}</span><b>${has?`${x.rank_no}/${x.total_students}`:'—'}</b><span>${has?`${fmt(x.points)} نقطة · ${fmt(x.pages)} ص`:'لا توجد نتيجة'}</span></div>`}).join('')}</div>`;
    return `<div class="guardian-rank-grid compact"><div class="guardian-rank"><span>ترتيب الفئة</span><b>${rankText(st,'category','hifz')}</b><small>${esc(categoryName(st))}</small></div><div class="guardian-rank"><span>ترتيب الحلقة</span><b>${rankText(st,'halaqa','hifz')}</b><small>${esc(studentTrackAr[st.track_code]||'المسار')}</small></div></div>`
  };

  window.guardianHomePage=function(){
    if(!state.students.length)return `${offlineNotice()}<div class="guardian-hero-lite"><h2>متابعة أبنائي</h2><p>لم يُربط أي طالب بهذا الحساب بعد.</p></div>`;
    let cards=activeStudents().map(st=>{let m=state.monthly.find(x=>x.student_id===st.id)||{},d=state.dailySummary.find(x=>x.student_id===st.id),gd=gDash(st),att=gd.month?.attendance||{},info=planInfo(st),p=info?.progress,safe=latestTrendSafety(st),planProgressText=p?`${fmt(p.completed)} / ${fmt(p.plan.target_pages)} ص`:'—';return `<section class="guardian-child-v242 card"><div class="guardian-child-head">${avatarHtml(st)}<div class="grow"><h2>${esc(st.full_name)}</h2><div class="muted">${esc(studentTrackAr[st.track_code]||'بدون مسار')} · ${esc(categoryName(st))}</div></div><button class="mini" onclick="studentProfile('${st.id}')">ملف ابني</button></div><div class="guardian-kpi-grid"><div><span>حفظ الشهر</span><b>${fmt(m.hifz_pages||0)} ص</b></div><div><span>الحضور</span><b>${Number(att.present??m.present_days??0)}</b></div><div><span>ترتيب الفئة</span><b>${rankText(st,'category')}</b></div><div><span>ترتيب الحلقة</span><b>${rankText(st,'halaqa')}</b></div><div><span>جودة آخر تسميع</span><b>${safe==null?'—':fmt(safe)+'%'}</b></div><div><span>إنجاز الخطة</span><b>${planProgressText}</b></div></div><div class="guardian-smart-summary"><span class="guardian-summary-icon">✦</span><div><b>ملخص المتابعة</b><p>${esc(guardianSummary(st,m,info))}</p></div></div>${guardianMiniChart(st)}${typeof smartPlanGuardianCompactPanel==='function'?smartPlanGuardianCompactPanel(st,today()):''}${d?`<div class="guardian-today-strip"><b>اليوم</b><span>${attAr[d.attendance_status]||'لم يسجل'} · حفظ ${fmt(d.hifz_pages)} ص${d.behavior?` · ${behAr[d.behavior]||d.behavior}`:''}</span></div>`:''}</section>`}).join('');
    return `${offlineNotice()}<div class="guardian-hero-lite"><div><small>لوحة ولي الأمر</small><h2>متابعة أبنائي</h2></div><span class="badge good">بيانات مختصرة وواضحة</span></div>${cards}<div class="guardian-shortcuts"><button onclick="go('reports')">▤ <span>التقارير</span></button><button onclick="go('competition')">⌁ <span>الإحصائيات</span></button><button onclick="go('ranking')">♜ <span>الترتيب</span></button></div>${typeof guardianNotificationStrip==='function'?guardianNotificationStrip():''}`
  };

  const oldLeaders=window.leadersReportSection;
  if(typeof oldLeaders==='function')window.leadersReportSection=function(rows,track=''){
    if(state.profile?.role!=='guardian')return oldLeaders(rows,track);
    let metric=track==='review'?'review':track==='sard'?'sard':'hifz';
    return `<section class="pro-report-page">${reportHeader('ترتيب ابني','',track)}<div class="pro-table-wrap"><table class="pro-table"><thead><tr><th>الطالب</th><th>ترتيب الفئة</th><th>ترتيب الحلقة</th><th>النقاط</th><th>الصفحات</th></tr></thead><tbody>${rows.map(x=>{let r=rankMetric(x.student,metric),cr=validRank(r,'category'),hr=validRank(r,'halaqa');return `<tr><td class="name">${esc(x.student.full_name)}</td><td>${cr?`${cr.rank} / ${cr.total}`:'—'}</td><td>${hr?`${hr.rank} / ${hr.total}`:'—'}</td><td>${fmt(r?.points??x.points)}</td><td>${fmt(r?.pages??x.totalPages)}</td></tr>`}).join('')}</tbody></table></div>${proFooter()}</section>`
  };

  window.guardianDashboardRankMetric=rankMetric;
})();
