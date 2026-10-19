/* RC27.40 native screens: reports — web twin of ReportsAndTools.kt (ReportsScreen / RankingsScreen / QuranCalculatorScreen)
   + ReportStudioControls.kt. Only the screen/controls/preview chrome is rebuilt with NX; report generation, the A4 document HTML
   (currentProfessionalReportHtml) and the PDF / print / Excel / Word / PNG engines are the existing ones. */
(function(){
  'use strict';
  if(typeof window.NX==='undefined'||typeof state==='undefined')return;
  const h=NX.h,ic=NX.icon;
  const NR=window.NR={};
  const tdy=()=>{try{return today()}catch(_e){return new Date().toISOString().slice(0,10)}};
  const isGuardian=()=>state.profile?.role==='guardian';
  const isProg=()=>!isGuardian()&&typeof rc27Scope==='function'&&(rc27Scope()||{}).kind==='program';
  const online=()=>navigator.onLine&&!state.offline;
  const say=m=>{try{toast(m)}catch(_e){console.log(m)}};
  const num=v=>{try{return fmt(v)}catch(_e){return String(v)}};
  const PRINT_ICON='<svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>';
  const btn=(label,o)=>NX.btn(label,o);
  const rawBtn=(iconSvg,label,o={})=>`<button type="button" class="nx-btn nx-${o.kind||'outlined'} ${o.cls||''}" ${o.onclick?`onclick="${h(o.onclick)}"`:''} ${o.disabled?'disabled':''}>${iconSvg}<span>${label}</span></button>`;

  /* ------------------------------------------------------------------ studio style (NativeReportStyle) */
  const REPORT_TYPES=[['halaqa','التقرير الشامل','Assessment'],['leaders','الأوائل','EmojiEvents'],['points','النقاط','Leaderboard'],['attendance','الحضور','FactCheck'],['recitations','التسميعات','MenuBook'],['students','كل طالب','Person']];
  const PROG_TYPES=[['attendance','تقرير الحضور','FactCheck'],['evaluation','نتائج التقييم','MenuBook'],['course','تقرير الدورة','Assessment']];
  const COLS={
    leaders:[['rank','#'],['student','الطالب'],['category','الفئة'],['pages','الصفحات'],['attendance','الحضور'],['points','النقاط']],
    points:[['rank','#'],['student','الطالب'],['points','النقاط'],['quality','الجودة'],['attendance','الحضور']],
    attendance:[['rank','#'],['student','الطالب'],['present','حاضر'],['late','متأخر'],['absent','غائب'],['excused','بعذر'],['sessions','التسجيلات']],
    recitations:[['date','التاريخ'],['student','الطالب'],['activity','النوع'],['range','النطاق'],['pages','الصفحات'],['mistakes','الأخطاء'],['prompts','النقرات'],['evaluation','التقييم'],['points','النقاط']],
    students:[['date','التاريخ'],['activity','النوع'],['range','النطاق'],['pages','الصفحات'],['mistakes','الأخطاء'],['points','النقاط']],
    halaqa:[['rank','#'],['student','الطالب'],['category','الفئة'],['hifz','الحفظ'],['tathbit','التثبيت'],['review','المراجعة'],['sard','السرد'],['attendance','الحضور'],['absence','الغياب'],['points','النقاط']]
  };
  /* header texts of the existing pro-table for each Kotlin column key */
  const HEAD={rank:['#','الترتيب'],student:['الطالب'],category:['الفئة'],hifz:['الحفظ','حفظ'],tathbit:['التثبيت','تثبيت'],review:['المراجعة','مراجعة'],sard:['السرد','سرد'],attendance:['الحضور','حضور'],absence:['الغياب','غياب','غائب'],absent:['غائب','الغياب','غياب'],points:['النقاط','نقاط'],pages:['الصفحات','صفحات'],quality:['الجودة','تقييم'],present:['حاضر'],late:['متأخر'],excused:['بعذر'],sessions:['إجمالي التسجيلات','التسجيلات'],date:['التاريخ'],activity:['النوع'],range:['النطاق'],mistakes:['الأخطاء','أخطاء'],prompts:['النقرات','نقرات'],evaluation:['التقييم','تقييم']};
  const PALETTES=[['#0d3b2f','#1c302a','الأخضر'],['#12345b','#1d2c40','الأزرق'],['#5a3825','#35251d','البني'],['#342b5f','#29233e','البنفسجي']];
  const S=NR.S={title:'',footer:'',orientation:'landscape',font:'Cairo',scale:1,primary:'#0d3b2f',text:'#1c302a',logo:'both',zoom:100,cols:{}};
  const visibleCols=t=>{if(!S.cols[t])S.cols[t]=new Set((COLS[t]||COLS.halaqa).map(x=>x[0]));return S.cols[t]};
  const typeTitle=t=>{try{return reportTypeTitle(t)}catch(_e){return 'تقرير حلقتي'}};

  /** Applies the NativeReportStyle (title, footer, logos, columns, font, colours) to a rendered report document. */
  function applyStyle(root){
    if(!root)return;
    root.querySelectorAll('.pro-head-title p').forEach(p=>{
      if(p.dataset.nrOrig==null)p.dataset.nrOrig=p.textContent;
      const o=p.dataset.nrOrig,i=o.indexOf(' · ');
      p.textContent=S.title?S.title+(i>=0?o.slice(i):''):o;
    });
    root.querySelectorAll('.pro-footer').forEach(f=>{
      const s=f.querySelector('span');if(!s)return;
      if(s.dataset.nrOrig==null)s.dataset.nrOrig=s.textContent;
      s.textContent=S.footer||s.dataset.nrOrig;
    });
    root.querySelectorAll('.pro-head').forEach(hd=>{
      const logos=hd.querySelectorAll('.pro-head-logo');
      if(logos[0])logos[0].style.visibility=(S.logo==='both'||S.logo==='center')?'':'hidden';
      if(logos[1])logos[1].style.visibility=(S.logo==='both'||S.logo==='halaqa')?'':'hidden';
    });
    const type=state.reportType||'halaqa',vis=visibleCols(type),hide=new Set();
    (COLS[type]||[]).forEach(([k])=>{if(!vis.has(k))(HEAD[k]||[]).forEach(t=>hide.add(t))});
    root.querySelectorAll('.pro-table').forEach(tb=>{
      const ths=[...tb.querySelectorAll('thead th')];
      ths.forEach((th,i)=>{
        const off=hide.has(th.textContent.trim());
        const rows=[...tb.rows];
        rows.forEach(r=>{const c=r.cells[i];if(c&&r.cells.length===ths.length)c.style.display=off?'none':''});
      });
    });
    root.style.fontFamily=S.font+', Cairo, sans-serif';
    root.style.color=S.text;
    const factor=S.scale;
    root.querySelectorAll('.pro-head-title h1,.pro-head-title p,.pro-meta,.pro-meta *,.pro-kpi b,.pro-kpi span,.pro-section-title,.pro-table th,.pro-table td,.student-info-grid div,.student-info-grid b,.pro-footer,.pro-footer *,.podium-rank,.podium-name,.podium-score,.student-report-card h2,.report-empty-pro').forEach(el=>{
      if(!el.dataset.nrBase)el.dataset.nrBase=String(parseFloat(getComputedStyle(el).fontSize)||11);
      el.style.fontSize=(Number(el.dataset.nrBase)*factor).toFixed(2)+'px';
    });
    root.querySelectorAll('.pro-head-title h1,.pro-section-title,.pro-kpi b,.student-report-card h2').forEach(el=>el.style.color=S.primary);
    root.querySelectorAll('.pro-head-logo,.pro-table th').forEach(el=>el.style.background=S.primary);
    try{if(typeof applyAutoFitPdfTables==='function')applyAutoFitPdfTables(root)}catch(_e){}
  }

  /** Scale a fixed-size A4 sheet to the width of its viewport (phone = fit-to-width, zoom slider on top). */
  function fit(vp,zoom){
    const sheet=vp.querySelector('.nr-sheet'),sc=vp.querySelector('.nr-scaler');if(!sheet||!sc)return;
    const land=(sheet.dataset.orientation||S.orientation)!=='portrait',pw=land?1120:792;
    const avail=Math.max(160,vp.clientWidth-(parseFloat(getComputedStyle(vp).paddingLeft)||0)*2);
    const s=Math.min(1,avail/pw)*((zoom||100)/100);
    sheet.style.width=pw+'px';
    sheet.style.transform='scale('+s+')';
    sc.style.width=(pw*s)+'px';
    sc.style.height=(sheet.offsetHeight*s)+'px';
  }
  NR.fitAll=function(){document.querySelectorAll('.nr-viewport[data-fit]').forEach(vp=>fit(vp,Number(vp.dataset.zoom||S.zoom)))};
  let RO=null;
  function watch(){
    if(typeof ResizeObserver==='undefined')return;
    if(!RO)RO=new ResizeObserver(()=>NR.fitAll());
    document.querySelectorAll('.nr-viewport[data-fit]').forEach(vp=>RO.observe(vp));
  }

  /* ------------------------------------------------------------------ state setters used by inline handlers */
  NR.set=function(prop,val){
    state[prop]=val;state.reportLoadedKey='';
    if(prop==='reportTrack'&&val!=='all')state.opsProgramTrack=val;
    render();
  };
  NR.type=function(t){state.reportType=t;S.title='';render()};
  NR.flag=function(prop,val){state[prop]=val;render()};
  NR.style=function(k,v,rerender){
    S[k]=v;
    if(rerender)return render();
    NR.live();
  };
  NR.live=function(){
    const sheet=document.getElementById('reportExportArea');
    if(sheet){sheet.dataset.orientation=S.orientation;applyStyle(sheet)}
    NR.fitAll();
  };
  NR.palette=function(i){const p=PALETTES[i];if(!p)return;S.primary=p[0];S.text=p[1];render()};
  NR.col=function(k){
    const t=state.reportType||'halaqa',v=visibleCols(t);
    v.has(k)?v.delete(k):v.add(k);render();
  };
  NR.zoom=function(v){
    S.zoom=Number(v)||100;
    document.querySelectorAll('.nr-zoomval').forEach(e=>{if(!e.closest('#nrZoomDlg'))e.textContent=S.zoom+'%'});
    document.querySelectorAll('.nr-viewport[data-fit]').forEach(vp=>{if(!vp.closest('#nrZoomDlg'))vp.dataset.zoom=String(S.zoom)});
    NR.fitAll();
  };
  NR.zoomDlg=function(v){
    const vp=document.querySelector('#nrZoomDlg .nr-viewport');if(!vp)return;
    vp.dataset.zoom=String(v);const l=document.querySelector('#nrZoomDlg .nr-zoomval');if(l)l.textContent=v+'%';fit(vp,Number(v));
  };
  const ready=()=>state.reportLoadedKey===reportKey();
  NR.expand=function(){
    const src=document.getElementById('reportExportArea');
    if(!ready()||!src)return say('جهّز التقرير أولاً');
    const clone=src.cloneNode(true);clone.removeAttribute('id');clone.style.transform='';
    const body=`<div class="nr-zoomrow"><span class="nr-zoomval">100%</span><input type="range" min="60" max="160" step="5" value="100" oninput="NR.zoomDlg(this.value)" aria-label="التكبير"></div><div class="nr-viewport nr-viewport-big" data-fit data-zoom="100"><div class="nr-scaler"></div></div>`;
    NX.dialog('nrZoomDlg','معاينة التقرير',body,{cls:'nr-wide-dlg'});
    const vp=document.querySelector('#nrZoomDlg .nr-viewport');vp.querySelector('.nr-scaler').appendChild(clone);
    clone.classList.add('nr-sheet');
    requestAnimationFrame(()=>{fit(vp,100);watch()});
  };
  NR.pdf=function(){
    if(!ready())return say('جهّز التقرير أولاً');
    if(typeof openReportPreview==='function')openReportPreview();
  };
  NR.print=function(){
    NR.pdf();
    setTimeout(()=>{const b=document.getElementById('hfPrintPdf');if(b&&document.getElementById('reportPreviewDlg')?.open)b.click()},380);
  };

  /* the existing PDF/print preview dialog gets the same style the studio shows */
  (function wrapOpenPreview(){
    const prev=window.openReportPreview;
    if(typeof prev!=='function'||prev.__nrWrapped)return;
    const wrapped=function(){
      const r=prev.apply(this,arguments);
      try{
        const dlg=document.getElementById('reportPreviewDlg'),paper=document.getElementById('reportPreviewPaper');
        if(dlg&&paper&&dlg.open){
          const g=id=>dlg.querySelector('#'+id);
          paper.querySelectorAll('.pro-head-title p').forEach(p=>{if(p.dataset.nrOrig==null)p.dataset.nrOrig=p.textContent;const o=p.dataset.nrOrig,i=o.indexOf(' · ');p.textContent=S.title?S.title+(i>=0?o.slice(i):''):o});
          paper.querySelectorAll('.pro-footer span:first-child').forEach(s=>{if(S.footer)s.textContent=S.footer});
          paper.querySelectorAll('.pro-head').forEach(hd=>{const l=hd.querySelectorAll('.pro-head-logo');if(l[0])l[0].style.visibility=(S.logo==='both'||S.logo==='center')?'':'hidden';if(l[1])l[1].style.visibility=(S.logo==='both'||S.logo==='halaqa')?'':'hidden'});
          const type=state.reportType||'halaqa',vis=visibleCols(type),hide=new Set();
          (COLS[type]||[]).forEach(([k])=>{if(!vis.has(k))(HEAD[k]||[]).forEach(t=>hide.add(t))});
          paper.querySelectorAll('.pro-table').forEach(tb=>{const ths=[...tb.querySelectorAll('thead th')];ths.forEach((th,i)=>{const off=hide.has(th.textContent.trim());[...tb.rows].forEach(rw=>{const c=rw.cells[i];if(c&&rw.cells.length===ths.length)c.style.display=off?'none':''})})});
          const font=g('hfFont');
          if(font){if(S.font==='monospace'&&![...font.options].some(o=>o.value==='monospace'))font.add(new Option('Mono','monospace'));font.value=S.font==='sans-serif'?'Arial':S.font}
          if(g('hfFontSize'))g('hfFontSize').value=String(Math.max(8,Math.min(18,Math.round(11*S.scale))));
          if(g('hfTextColor'))g('hfTextColor').value=S.text;
          if(g('hfAccentColor'))g('hfAccentColor').value=S.primary;
          if(g('hfOrientation')){g('hfOrientation').value=S.orientation;g('hfOrientation').dispatchEvent(new Event('input'))}
        }
      }catch(e){console.warn('NR preview style',e)}
      return r;
    };
    wrapped.__nrWrapped=true;window.openReportPreview=wrapped;
  })();

  /* PNG export captures #reportExportArea: temporarily remove the fit-to-width scaling */
  (function wrapImage(){
    const prev=window.exportCurrentReportImage;
    if(typeof prev!=='function'||prev.__nrWrapped)return;
    const w=async function(){
      const root=document.querySelector('.nr-studio');
      root?.classList.add('nr-unscaled');
      try{return await prev.apply(this,arguments)}finally{root?.classList.remove('nr-unscaled');NR.fitAll()}
    };
    w.__nrWrapped=true;window.exportCurrentReportImage=w;
  })();

  /* ------------------------------------------------------------------ reports screen */
  const SESSION_TYPES=[['all','كل الأنواع'],['tasmee','تسميع'],['sard','سرد'],['review','مراجعة'],['test','اختبار'],['tajweed','التلاوة والتجويد'],['lesson','درس'],['other','أخرى']];
  const PROG_SESSION=[['all','كل الأنواع'],['tajweed','التلاوة والتجويد'],['test','اختبار'],['lesson','درس']];
  const MODES=[['day','يوم محدد'],['month','شهر محدد'],['range','فترة']];
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthLabel=ym=>{const [y,m]=String(ym||'').split('-');return MONTHS[(+m||1)-1]+' '+y};
  const chipRow=(items,cur,fn,wrap=true)=>NX.chips(items.map(([v,l,i])=>({label:l,selected:cur===v,check:false,icon:i,onclick:fn(v)})),{wrap});
  const labelSm=t=>`<div class="nr-lbl">${t}</div>`;

  function comparisonCard(){
    if(state.reportMode!=='month'||typeof opsAggregateCompare!=='function'||!ready())return '';
    let rows;try{rows=opsAggregateCompare()}catch(_e){return ''}
    const body=rows.map(([l,cur,prev,inverse,suf],i)=>{
      const d=Number(cur||0)-Number(prev||0),fav=inverse?d<=0:d>=0,sign=d>=0?'+':'';
      return `${i?NX.divider():''}<div class="nr-cmp"><span class="nr-cmp-l">${l}</span><b dir="ltr">${num(prev)}${suf} ← ${num(cur)}${suf}</b><em class="${fav?'good':'bad'}" dir="ltr">${sign}${num(Math.round(d*100)/100)}${suf} ${d>=0?'↑':'↓'}</em></div>`;
    }).join('');
    return NX.card(`<div class="nx-t-title-l">هذا الشهر مقابل الشهر الماضي</div><div class="nr-cmps">${body}</div>`,{cls:'nx-emph nr-compare'});
  }

  function typeCard(){
    const types=isProg()?PROG_TYPES:REPORT_TYPES;
    return `<section class="nr-sec"><div class="nx-t-title-m nr-h">نوع التقرير</div>${chipRow(types,state.reportType||'halaqa',v=>`NR.type('${v}')`)}</section>`;
  }

  function periodCard(){
    const prog=isProg(),mode=state.reportMode||'month';
    const dates=mode==='day'?NX.field('اليوم',{type:'date',value:state.reportDay||tdy(),onchange:"state.reportDay=this.value;state.reportLoadedKey='';render()"})
      :mode==='month'?NX.field('الشهر',{type:'month',value:state.reportMonth||tdy().slice(0,7),onchange:"state.reportMonth=this.value;state.reportLoadedKey='';render()"})
      :`<div class="nr-two">${NX.field('من',{type:'date',value:state.reportFrom,onchange:"state.reportFrom=this.value;state.reportLoadedKey='';render()"})}${NX.field('إلى',{type:'date',value:state.reportTo,onchange:"state.reportTo=this.value;state.reportLoadedKey='';render()"})}</div>`;
    const b=reportBounds();
    const summary=mode==='day'?`اليوم المختار: ${h(b.from)}`:mode==='month'?`الشهر المختار: ${h(monthLabel(String(b.from).slice(0,7)))}`:`الفترة: ${h(b.from)} ← ${h(b.to)}`;
    const halaqas=(state.halaqas||[]).filter(x=>x.active!==false);
    const hal=NX.select('الحلقة',[{value:'all',label:prog?'جميع البرامج':'جميع الحلقات'},...halaqas.map(x=>({value:x.id,label:x.name||'حلقة'}))],{value:state.reportHalaqa||'all',onchange:"state.reportHalaqa=this.value;state.reportLoadedKey='';render()"});
    const msg=state.reportError?NX.notice(h(state.reportError),/^تعذر/.test(state.reportError)&&!ready()?'error':'warning')
      :ready()?NX.notice(`تم تجهيز البيانات: ${statsRows().length} طالب · ${(state.reportData?.sessions||[]).length} لقاء`,'success'):'';
    return NX.card(`
      <div class="nx-t-title-m nr-h">الفترة ونطاق البيانات</div>
      ${chipRow(MODES,mode,v=>`setReportMode('${v}')`)}
      <div class="nr-datebox">${ic('DateRange',20)}<span class="nx-grow">${summary}</span>${ic('EditCalendar',20)}</div>
      ${dates}
      ${prog?'':labelSm('المسار')+chipRow([['all','جميع المسارات'],['general_hifz','الحفظ العام'],['tathbit','التثبيت']],state.reportTrack||'all',v=>`NR.set('reportTrack','${v}')`)}
      ${hal}
      ${labelSm('نوع اللقاء')}${chipRow(prog?PROG_SESSION:SESSION_TYPES,state.reportSessionType||'all',v=>`NR.set('reportSessionType','${v}')`)}
      ${btn(state.reportLoading?'جاري تجهيز التقرير…':'تجهيز التقرير',{icon:'Refresh',full:true,onclick:'loadSelectedReport()',disabled:state.reportLoading,cls:'nr-prepare'})}
      ${state.reportLoading?NX.progress(60,{cls:'nr-indet'}):''}
      ${msg}`,{cls:'nx-emph nr-period nx-stack'});
  }

  function controlsCard(){
    const type=state.reportType||'halaqa',cols=COLS[type]||COLS.halaqa,vis=visibleCols(type);
    const pct=Math.round(S.scale*100);
    const stu=type==='students'?`${labelSm('محتوى تقرير الطالب')}${NX.chips([
      {label:'تاريخ الميلاد',selected:!!state.reportIncludeBirthDate,check:false,onclick:`NR.flag('reportIncludeBirthDate',${!state.reportIncludeBirthDate})`},
      {label:'اسم المحفظ',selected:!!state.reportIncludeTeacher,check:false,onclick:`NR.flag('reportIncludeTeacher',${!state.reportIncludeTeacher})`},
      {label:'صورة الطالب',selected:!!state.reportIncludePhotos,check:false,onclick:`NR.flag('reportIncludePhotos',${!state.reportIncludePhotos})`}],{wrap:true})}`:'';
    return NX.card(`
      <div class="nr-ctl-head">${ic('Tune',22)}<span class="nx-t-title-m">تخصيص استوديو التقارير</span></div>
      <p class="nx-muted nx-t-body-s nr-note">المعاينة والـPDF يستخدمان نفس قالب HTML/CSS المتجهي.</p>
      ${NX.field('عنوان التقرير',{html:`<input type="text" maxlength="120" value="${h(S.title)}" placeholder="${h(typeTitle(type))}" oninput="NR.style('title',this.value)">`})}
      ${NX.field('تذييل التقرير',{html:`<input type="text" maxlength="180" value="${h(S.footer)}" placeholder="حلقتي · النظام الرسمي لإدارة ومتابعة حلقات القرآن الكريم" oninput="NR.style('footer',this.value)">`})}
      ${labelSm('اتجاه A4')}${chipRow([['landscape','أفقي A4'],['portrait','رأسي A4']],S.orientation,v=>`NR.style('orientation','${v}',true)`)}
      ${labelSm('الخط')}${chipRow([['Cairo','Cairo'],['sans-serif','Sans'],['serif','Serif'],['monospace','Mono']],S.font,v=>`NR.style('font','${v}',true)`)}
      ${labelSm(`حجم الخط <span class="nr-fsval">${pct}%</span>`)}
      <input type="range" class="nr-range" min="75" max="145" step="5" value="${pct}" aria-label="حجم الخط" oninput="this.previousElementSibling.querySelector('.nr-fsval').textContent=this.value+'%';NR.style('scale',this.value/100)">
      ${labelSm('الهوية اللونية')}${NX.chips(PALETTES.map((p,i)=>({label:`<i class="nr-dot" style="background:${p[0]}"></i>${p[2]}`,selected:S.primary===p[0],check:false,onclick:`NR.palette(${i})`})),{wrap:true})}
      ${labelSm('الشعارات')}${chipRow([['both','الشعاران'],['center','المركز'],['halaqa','الحلقة'],['none','بدون']],S.logo,v=>`NR.style('logo','${v}',true)`)}
      ${stu}
      ${labelSm('الأعمدة الظاهرة')}${NX.chips(cols.map(([k,l])=>({label:l,selected:vis.has(k),check:false,onclick:`NR.col('${k}')`})),{wrap:true})}
    `,{cls:'nx-emph nr-controls nx-stack'});
  }

  const statsRows=()=>{try{return reportStatsRows()||[]}catch(_e){return []}};
  const activityAr={new_hifz:'حفظ',review_near:'مراجعة قريبة',review_far:'مراجعة بعيدة',sard:'سرد',tilawah:'تلاوة',test:'اختبار'};
  const evalAr={excellent:'ممتاز',very_good:'جيد جدًا',good:'جيد',repeat:'إعادة',not_rated:'غير مقيم'};
  const n2=v=>{v=Number(v||0);return v%1===0?String(v):v.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')};

  function previewCard(){
    const rd=ready(),docHtml=(()=>{if(!rd)return '';try{return currentProfessionalReportHtml()}catch(e){return `<div class="report-empty-pro">تعذر إنشاء المعاينة: ${h(e?.message||e)}</div>`}})();
    const body=rd&&docHtml.trim()
      ?`<div class="nr-viewport ${S.orientation==='portrait'?'portrait':'landscape'}" data-fit data-zoom="${S.zoom}"><div class="nr-scaler"><div class="nr-sheet" id="reportExportArea" data-orientation="${S.orientation}">${docHtml}</div></div></div>`
      :`<div class="nr-viewport nr-vp-empty">${state.reportLoading?NX.skeleton(2):`<div class="nr-ph">${ic('Visibility',28)}<p>بعد تجهيز التقرير ستظهر هنا عينة من البيانات قبل الحفظ.</p></div>`}</div>`;
    return NX.card(`
      <div class="nx-row nr-prev-head"><div class="nx-grow"><div class="nx-t-title-m">معاينة A4 الحقيقية</div><div class="nx-t-body-s nx-muted">نفس HTML/CSS المستخدم في PDF النهائي.</div></div>${btn('تكبير',{kind:'outlined',icon:'OpenInFull',small:true,onclick:'NR.expand()',disabled:!rd})}</div>
      <div class="nr-zoomrow"><span class="nr-zoomval">${S.zoom}%</span><input type="range" min="75" max="120" step="5" value="${S.zoom}" oninput="NR.zoom(this.value)" aria-label="تكبير المعاينة"></div>
      ${body}`,{cls:'nx-emph nr-preview nx-stack-s'});
  }

  function exportBar(has){
    const dis=!has;
    return `<div class="nr-export">
      ${btn(`PDF A4`,{icon:'PictureAsPdf',full:true,onclick:'NR.pdf()',disabled:dis,cls:'nr-pdf'})}
      <div class="nr-export-grid">
        ${btn('Excel',{kind:'outlined',icon:'TableView',onclick:'exportReportsExcel()',disabled:dis})}
        ${btn('Word',{kind:'outlined',icon:'Description',onclick:'exportCurrentReportWord()',disabled:dis})}
        ${btn('صورة',{kind:'outlined',icon:'Image',onclick:'exportCurrentReportImage()',disabled:dis})}
        ${btn('مشاركة',{kind:'outlined',icon:'Share',onclick:'shareReportText()',disabled:dis})}
        ${rawBtn(PRINT_ICON,'طباعة',{kind:'outlined',onclick:'NR.print()',disabled:dis})}
      </div></div>`;
  }

  function resultsBlock(has){
    if(state.reportLoading&&!has)return NX.skeleton(4);
    if(!state.reportLoading&&!has)return NX.empty(state.reportType==='recitations'?'لا توجد تسميعات في الفترة المحددة':'لا توجد بيانات للتقرير المحدد',{icon:'SearchOff'});
    const rows=statsRows();
    const totalPages=rows.reduce((a,x)=>a+Number(x.totalPages||0),0),pres=rows.reduce((a,x)=>a+Number(x.present||0)+Number(x.late||0),0),abs=rows.reduce((a,x)=>a+Number(x.absent||0),0);
    let list='';
    if(state.reportType==='recitations'){
      const d=state.reportData||{},names=new Map((state.students||[]).map(s=>[String(s.id),s.full_name])),dates=new Map((d.sessions||[]).map(s=>[String(s.id),s.session_date]));
      list=(d.recitations||[]).slice(0,300).map(r=>NX.card(`<div class="nr-li"><div class="nx-grow"><b class="nx-ellipsis">${h(names.get(String(r.student_id))||'طالب')}</b><small class="nx-muted">${h(dates.get(String(r.session_id))||'')} · ${h(activityAr[r.activity_type]||r.activity_type||'')} · ${n2(r.pages_count)} صفحة · ${h(evalAr[r.evaluation]||r.evaluation||'')}</small></div></div>`,{cls:'nx-emph'})).join('');
    }else{
      list=NX.metrics([NX.metric('الطلاب',rows.length,{subtitle:'ضمن الفلاتر'}),NX.metric('الصفحات',n2(totalPages),{subtitle:'جميع الأنشطة'}),NX.metric('الحضور',pres,{subtitle:'حاضر + متأخر'}),NX.metric('الغياب',abs,{subtitle:'بدون المعذور'})],4)
        +rows.slice(0,300).map((x,i)=>{
          let cat='بدون فئة';try{cat=categoryName(x.student)||cat}catch(_e){}
          return NX.card(`<div class="nr-li"><div class="nx-grow"><b class="nx-ellipsis">${i+1}. ${h(x.student?.full_name||'طالب')}</b><small class="nx-muted">${h(cat)} · حفظ ${n2(x.hifzPages)} · تثبيت ${n2(x.tathbitPages)} · سرد ${n2(x.sardPages)} · ${n2(x.points)} نقطة</small></div></div>`,{cls:'nx-emph'});
        }).join('');
    }
    return `<div class="nr-results nx-stack-s">${list}</div>`;
  }

  function studio(){
    const has=ready()&&!state.reportLoading&&(state.reportType==='recitations'?((state.reportData?.recitations||[]).length>0||statsRows().length>0):statsRows().length>0);
    return `<div class="nr-root nr-studio">
      ${NX.hero('استوديو التقارير','محرك 2.44 المستعاد: ستة أنواع تقارير، معاينة حقيقية، وPDF متجهي A4 من نفس القالب.',{icon:'Assessment',badge:'Chromium Vector'})}
      ${comparisonCard()}
      <div class="nr-cols">
        <div class="nr-side nx-stack">${typeCard()}${periodCard()}${controlsCard()}</div>
        <div class="nr-main nx-stack">${previewCard()}${exportBar(has)}${resultsBlock(has)}</div>
      </div>
    </div>`;
  }

  /* programs (rc27): attendance / evaluation results / course report — engine + document stay rc27's */
  function programStudio(prevHtml){
    const tab=(/class="active"[^>]*rc27SetProgReport\('tab','(\w+)'\)/.exec(prevHtml)||[])[1]||'attendance';
    const dates=[...String(prevHtml).matchAll(/type="date" value="([^"]*)"/g)].map(m=>m[1]);
    return `<div class="nr-root nr-studio nr-prog">
      ${NX.hero('تقارير البرنامج','الحضور ونتائج التقييم وتقرير الدورة.',{icon:'Assessment',badge:'Chromium Vector'})}
      <div class="nr-cols">
        <div class="nr-side nx-stack">
          <section class="nr-sec"><div class="nx-t-title-m nr-h">نوع التقرير</div>${chipRow(PROG_TYPES,tab,v=>`rc27SetProgReport('tab','${v}')`)}</section>
          ${NX.card(`<div class="nx-t-title-m nr-h">الفترة ونطاق البيانات</div><div class="nr-two">${NX.field('من',{type:'date',value:dates[0]||'',onchange:"rc27SetProgReport('from',this.value)"})}${NX.field('إلى',{type:'date',value:dates[1]||'',onchange:"rc27SetProgReport('to',this.value)"})}</div>`,{cls:'nx-emph nx-stack'})}
        </div>
        <div class="nr-main nx-stack">
          ${NX.card(`<div class="nx-row nr-prev-head"><div class="nx-grow"><div class="nx-t-title-m">معاينة A4 الحقيقية</div><div class="nx-t-body-s nx-muted">نفس HTML/CSS المستخدم في PDF النهائي.</div></div></div><div class="nr-prog-doc"><div id="rc27ProgReport"><div class="nx-muted">جارٍ التحميل…</div></div></div>`,{cls:'nx-emph nr-preview nx-stack-s'})}
          <div class="nr-export">${btn('طباعة / حفظ PDF',{icon:'PictureAsPdf',full:true,onclick:'rc27PrintProgReport()',cls:'nr-pdf'})}</div>
        </div>
      </div>
    </div>`;
  }

  let AUTO='';
  function afterReports(){
    const sheet=document.getElementById('reportExportArea');
    if(sheet)applyStyle(sheet);
    NR.fitAll();watch();
    requestAnimationFrame(NR.fitAll);
    const key=reportKey();
    if(!ready()&&!state.reportLoading&&!state.reportError&&AUTO!==key&&state.user&&online()&&typeof loadSelectedReport==='function'){AUTO=key;loadSelectedReport()}
  }

  const basePage=window.reportsPage;
  window.reportsPage=function(){
    if(isGuardian())return typeof basePage==='function'?basePage.apply(this,arguments):'';
    if(isProg()){
      let prevHtml='';try{prevHtml=typeof basePage==='function'?basePage.apply(this,arguments):''}catch(_e){}
      return programStudio(prevHtml);
    }
    setTimeout(afterReports,0);
    return studio();
  };

  /* ------------------------------------------------------------------ rankings screen */
  const RK=NR.rk={day:'',month:'',cache:{},loading:false,err:''};
  const trackAr={hifz:'الحفظ',review:'المراجعة',sard:'السرد'};
  const baseRanking=window.rankingPage;
  const curMonth=()=>tdy().slice(0,7);
  function monthOptions(){const t=new Date(),out=[];for(let i=0;i<36;i++){const d=new Date(t.getFullYear(),t.getMonth()-i,1),v=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');out.push({value:v,label:monthLabel(v)})}return out}
  const nextMonth=ym=>{const [y,m]=ym.split('-').map(Number);const d=new Date(y,m,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
  const rkIds=()=>{try{return new Set((typeof opsTrackStudents==='function'?opsTrackStudents():activeStudents()).map(s=>String(s.id)))}catch(_e){return new Set((state.students||[]).map(s=>String(s.id)))}};
  const progTrack=()=>state.opsProgramTrack==='tathbit'?'tathbit':'general_hifz';
  const effTrack=()=>progTrack()==='tathbit'?'review':(state.rankTrack||'hifz');
  const rkPeriod=()=>state.rankPeriod==='day'?'day':'month';

  NR.rkSet=function(k,v){
    if(k==='program'){if(typeof opsSetProgramTrack==='function')opsSetProgramTrack(v);else{state.opsProgramTrack=v;render()}if(v==='tathbit')state.rankTrack='review';return}
    if(k==='track'){state.rankTrack=v;return render()}
    if(k==='period'){state.rankPeriod=v;return render()}
    if(k==='day'){RK.day=v;return render()}
    if(k==='month'){RK.month=v;return render()}
    if(k==='refresh'){RK.cache={};return render()}
  };
  /** rows for the selected period: today / current month come from the loaded leaderboards, other periods are fetched from the same views */
  function rkRows(){
    const period=rkPeriod(),day=RK.day||tdy(),month=RK.month||curMonth();
    const current=period==='day'?day===tdy():month===curMonth();
    const src=current?(period==='day'?state.leaderDaily:state.leaderMonthly):null;
    if(src)return {rows:src,loading:false};
    const key=period+':'+(period==='day'?day:month);
    const hit=RK.cache[key];
    if(hit&&hit.rows)return {rows:hit.rows,loading:false};
    if(!hit){
      RK.cache[key]={loading:true};
      (async()=>{
        try{
          let q;
          if(period==='day')q=db.from('leaderboard_daily').select('*').eq('period_date',day);
          else q=db.from('leaderboard_monthly').select('*').gte('month_start',month+'-01').lt('month_start',nextMonth(month)+'-01');
          const r=await q;if(r.error)throw r.error;
          RK.cache[key]={rows:r.data||[]};RK.err='';
        }catch(e){RK.cache[key]={rows:[],err:true};RK.err='تعذر تحديث البيانات من الخادم. ستبقى آخر بيانات محلية متاحة ظاهرة.'}
        if(state.page==='ranking')render();
      })();
    }
    return {rows:[],loading:!hit||hit.loading};
  }
  function sortRows(rows){
    const ids=rkIds(),t=effTrack();
    return rows.filter(x=>x.track===t&&ids.has(String(x.student_id))).sort((a,b)=>Number(b.points||0)-Number(a.points||0)||Number(b.pages||0)-Number(a.pages||0)||Number(a.penalty_per_page??999)-Number(b.penalty_per_page??999));
  }

  function rkFilters(prog){
    const period=rkPeriod();
    const parts=[`<div class="nr-ctl-head">${ic('Tune',22)}<span class="nx-t-title-s">فلترة النتائج</span></div>`];
    if(prog)parts.push('<p class="nx-muted nx-t-body-s nr-note">ترتيب البرنامج: متوسط درجة التلاوة والتجويد، ثم الحضور، ثم عدد التسميعات، ثم النقاط</p>');
    else{
      parts.push(labelSm('المسار')+chipRow([['general_hifz','الحفظ العام'],['tathbit','التثبيت']],progTrack(),v=>`NR.rkSet('program','${v}')`));
      parts.push(labelSm('النشاط')+(progTrack()==='tathbit'?chipRow([['review','التثبيت']],'review',()=>'void 0'):chipRow([['hifz','الحفظ'],['review','المراجعة'],['sard','السرد']],effTrack(),v=>`NR.rkSet('track','${v}')`)));
    }
    parts.push(labelSm('الفترة')+chipRow(prog?[['day','اليوم'],['month','الشهر']]:[['day','يوم محدد'],['month','شهر محدد']],period,v=>`NR.rkSet('period','${v}')`));
    if(!prog){
      parts.push(period==='day'
        ?NX.field('اليوم',{type:'date',value:RK.day||tdy(),max:tdy(),onchange:"NR.rkSet('day',this.value||'')"})
        :NX.select('الشهر',monthOptions(),{value:RK.month||curMonth(),onchange:"NR.rkSet('month',this.value)"}));
    }
    return NX.card(parts.join(''),{cls:'nx-emph nr-rk-filters nx-stack-s'});
  }

  /** common renderer: items = [{name,sub,value,valueLabel,cells:[…]}], cols = table headers after name */
  function rkList(items,cols,emptyText){
    if(!items.length)return NX.empty(emptyText,{icon:'EmojiEvents'});
    const medal=['gold','silver','bronze'];
    const phone=items.map((x,i)=>`<div class="nx-card nx-emph nr-rk-row"><span class="nr-rk-n">${i+1}</span><div class="nx-grow"><b class="nx-ellipsis nx-t-title-m">${h(x.name)}</b><small class="nx-muted nx-t-body-s">${h(x.sub)}</small></div><div class="nr-rk-v"><b>${h(x.value)}</b>${x.valueLabel?`<small>${h(x.valueLabel)}</small>`:''}</div></div>`).join('');
    const top=items.slice(0,3);
    const order=top.length===3?[1,0,2]:top.map((_,i)=>i);
    const podium=`<div class="nr-podium">${order.map(i=>{const x=top[i];return `<div class="nr-pod ${medal[i]}"><span class="nr-pod-ic">${ic(i===0?'EmojiEvents':'MilitaryTech',i===0?34:28)}</span>${NX.avatar(x.name,{size:52})}<b class="nx-ellipsis">${h(x.name)}</b><span class="nr-pod-v">${h(x.value)}${x.valueLabel?` <small>${h(x.valueLabel)}</small>`:''}</span><span class="nr-pod-step"><i>${i+1}</i></span></div>`}).join('')}</div>`;
    const table=`<div class="nx-card nx-flat nr-tablewrap"><table class="nr-table"><thead><tr><th class="c">#</th><th>الطالب</th>${cols.map(c=>`<th class="c">${c}</th>`).join('')}</tr></thead><tbody>${items.map((x,i)=>`<tr><td class="c"><span class="nr-rk-n sm ${medal[i]||''}">${i+1}</span></td><td><div class="nr-name">${NX.avatar(x.name,{size:32})}<b>${h(x.name)}</b></div></td>${x.cells.map((c,j)=>`<td class="c ${j===x.cells.length-1?'strong':''}">${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `<div class="nr-rk-phone nx-stack-s">${phone}</div><div class="nr-rk-desk">${podium}${table}</div>`;
  }

  function rankingPageRegular(){
    const {rows,loading}=rkRows(),sorted=sortRows(rows);
    const items=sorted.map(x=>({name:x.full_name||'طالب',sub:`${n2(x.pages)} ص · ${x.mistakes||0} أخطاء · ${x.prompts||0} نقرات`,value:n2(x.points),valueLabel:'نقطة',cells:[n2(x.pages),String(x.mistakes||0),String(x.prompts||0),x.penalty_per_page==null?'—':n2(x.penalty_per_page),n2(x.points)]}));
    const notices=(!online()?NX.notice('وضع دون اتصال: يتم عرض البيانات المحلية المحفوظة ويمكن تغيير الفلاتر دون الحاجة للاتصال.','warning'):'')+(RK.err?NX.notice(h(RK.err),'warning'):'');
    const body=loading?NX.skeleton(4):rkList(items,['الصفحات','الأخطاء','النقرات','خصم/صفحة','النقاط'],online()?'لا توجد بيانات لهذا المسار والفترة':'لا توجد بيانات محلية محفوظة لهذه الفترة بعد');
    return `<div class="nr-root nr-ranking"><div class="nr-rk-cols"><div class="nr-rk-side nx-stack-s">${rkFilters(false)}</div><div class="nr-rk-main nx-stack-s">${notices}${loading?NX.progress(60,{cls:'nr-indet'}):''}${body}</div></div></div>`;
  }
  function rankingPageProgram(){
    try{if(typeof baseRanking==='function')baseRanking.apply(this,arguments)}catch(_e){}   /* schedules rc27's fillRanking into #rc27ProgRank */
    return `<div class="nr-root nr-ranking nr-prog-rank"><div class="nr-rk-cols"><div class="nr-rk-side nx-stack-s">${rkFilters(true)}</div><div class="nr-rk-main nx-stack-s">${!online()?NX.notice('وضع دون اتصال: يتم عرض البيانات المحلية المحفوظة ويمكن تغيير الفلاتر دون الحاجة للاتصال.','warning'):''}<div id="rc27ProgRank">${NX.skeleton(3)}</div></div></div></div>`;
  }
  /* rc27 fills #rc27ProgRank with legacy cards: rebuild them as NX rows */
  function reformatProgramRank(box){
    if(!box||box.dataset.nrDone==='1')return;
    const cards=[...box.querySelectorAll('.rank-row')];
    if(!cards.length){
      if(box.querySelector('.empty'))box.innerHTML=NX.empty('لا طلاب أو تقييمات تلاوة في هذا البرنامج خلال الفترة المختارة',{icon:'EmojiEvents'});
      else if(box.querySelector('.notice'))box.innerHTML=NX.notice(box.textContent.trim(),'warning');
      return;
    }
    const items=cards.map(c=>{
      const name=c.querySelector('.grow b')?.textContent||'طالب',d=c.querySelector('.muted')?.textContent||'';
      const sc=/درجة التلاوة والتجويد:\s*([^\s·]+)/.exec(d)?.[1]||'—',pr=/حضور\s*(\S+)/.exec(d)?.[1]||'0',rc=/تسميعات\s*(\S+)/.exec(d)?.[1]||'0',pt=/نقاط\s*(\S+)/.exec(d)?.[1]||'0';
      return {name,sub:`حضور ${pr} · تسميعات ${rc} · نقاط ${pt}`,value:sc,valueLabel:'درجة التلاوة',cells:[pr,rc,pt,sc]};
    });
    box.dataset.nrDone='1';
    box.innerHTML=rkList(items,['الحضور','التسميعات','النقاط','درجة التلاوة'],'');
  }
  const mo=typeof MutationObserver!=='undefined'?new MutationObserver(()=>{const b=document.getElementById('rc27ProgRank');if(b&&b.dataset.nrDone!=='1'&&!b.querySelector('.nx-skel'))reformatProgramRank(b)}):null;
  if(mo)mo.observe(document.body,{childList:true,subtree:true});

  window.rankingPage=function(){
    if(isGuardian())return typeof baseRanking==='function'?baseRanking.apply(this,arguments):'';
    return isProg()?rankingPageProgram.apply(this,arguments):rankingPageRegular();
  };

  /* ------------------------------------------------------------------ Quran calculator */
  const baseQuran=window.quranPage;
  const QTABS=[['ayahs','آية','MenuBook'],['pages','صفحات','Description'],['surahs','سور','FormatListNumbered'],['juz','أجزاء','Apps']];
  NR.qtab=function(t){
    ['Ayahs','Pages','Surahs','Juz'].forEach(x=>document.getElementById('q'+x)?.classList.add('hidden'));
    document.getElementById('q'+t[0].toUpperCase()+t.slice(1))?.classList.remove('hidden');
    document.querySelectorAll('.nr-qtabs .nx-chip').forEach(b=>{const on=b.dataset.t===t;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false')});
  };
  NR.surahFilter=function(v){
    const q=String(v||'').trim().toLowerCase();
    document.querySelectorAll('#qcSurahGrid button').forEach(b=>{b.style.display=!q||b.textContent.toLowerCase().includes(q)?'':'none'});
  };
  NR.quick=function(){
    const a=document.getElementById('nrQ1'),b=document.getElementById('nrQ2'),out=document.getElementById('nrQOut');if(!a||!b||!out)return;
    const dg=s=>{try{return toAsciiDigits(s)}catch(_e){return s}};
    a.value=dg(a.value).replace(/\D/g,'').slice(0,3);b.value=dg(b.value).replace(/\D/g,'').slice(0,3);
    const p1=parseInt(a.value,10),p2=parseInt(b.value,10),ok=p1>=1&&p1<=604&&p2>=1&&p2<=604;
    const pages=ok?Math.abs(p2-p1)+1:null;
    out.innerHTML=NX.metric('عدد الصفحات',pages==null?'—':num(pages),{subtitle:'يحافظ على اتجاه البداية والنهاية'})
      +(ok?NX.card(`<div class="nx-t-title-s">من صفحة ${p1} إلى صفحة ${p2}${p2<p1?' (اتجاه عكسي)':''}</div><div class="nx-t-body-m">المقدار ${num(pages)} صفحة</div>`,{cls:'nx-emph nx-stack-s'}):'');
  };
  function quranScreen(){
    let ayah='',pages='',surahs='',juz='';
    try{ayah=qAyahPanel('qc');pages=qPagesPanel('qc');surahs=qSurahsPanel('qc');juz=qJuzPanel('qc')}catch(e){console.warn(e)}
    surahs=surahs.replace('<div id="qcSurahGrid"',NX.search('','بحث عن سورة',{oninput:'NR.surahFilter(this.value)',cls:'nr-surah-search'})+'<div id="qcSurahGrid"');
    return `<div class="nr-root nr-quran">
      <div class="nx-t-title-m nr-qhead">مصحف المدينة — حفص · 604 صفحة · 30 جزءًا · 240 ربع حزب</div>
      <div class="nr-qcols">
        <div class="nr-qpick nx-stack">
          ${NX.card(`
            <div class="nx-t-title-m nr-h">اختيار المقرر من المصحف</div>
            <div class="nr-qtabs nx-chips wrap" role="group">${QTABS.map(([k,l,i],ix)=>`<button type="button" class="nx-chip ${ix===0?'on':''}" data-t="${k}" aria-pressed="${ix===0}" onclick="NR.qtab('${k}')">${ic(i,18)}<span>${l}</span></button>`).join('')}</div>
            <div id="qAyahs" class="mode-panel">${ayah}</div>
            <div id="qPages" class="mode-panel hidden">${pages}</div>
            <div id="qSurahs" class="mode-panel hidden">${surahs}</div>
            <div id="qJuz" class="mode-panel hidden">${juz}</div>`,{cls:'nx-emph nx-stack'})}
        </div>
        <div class="nr-qside nx-stack">
          <div id="qResult" class="qcalc-result"><span class="muted">المقدار المحسوب</span><div><strong>0</strong> صفحة</div></div>
          ${NX.card(`
            <div class="nx-t-title-s">الحاسبة السريعة بالصفحات</div>
            <div class="nr-two">
              ${NX.field('الصفحة الأولى',{html:'<input id="nrQ1" type="text" inputmode="numeric" maxlength="3" dir="ltr" oninput="NR.quick()" autocomplete="off">'})}
              ${NX.field('الصفحة الثانية',{html:'<input id="nrQ2" type="text" inputmode="numeric" maxlength="3" dir="ltr" oninput="NR.quick()" autocomplete="off">'})}
            </div>
            <div id="nrQOut" class="nx-stack-s">${NX.metric('عدد الصفحات','—',{subtitle:'يحافظ على اتجاه البداية والنهاية'})}</div>
            <p class="nx-muted nx-t-body-s nr-note">RC8 يحافظ على اتجاه الإدخال؛ لا يتم قلب البداية والنهاية تلقائيًا.</p>`,{cls:'nx-emph nx-stack-s'})}
          ${NX.notice('<b>حساب محلي دون إنترنت:</b> نطاقات الآيات والسور والأجزاء تُحسب وفق مواضع الآيات على سطور مصحف المدينة QCF4 (15 سطراً للصفحة)، وليس بنسبة عدد الآيات. اختيار صفحات كاملة يبقى عدّاً مباشراً.','info')}
        </div>
      </div>
    </div>`;
  }
  if(typeof baseQuran==='function')window.quranPage=quranScreen;

  window.addEventListener('resize',()=>NR.fitAll());
})();
