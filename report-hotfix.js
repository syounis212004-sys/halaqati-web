/* Halaqati Web/Reports Hotfix — 2026-08-29 */
(function(){
  'use strict';
  const HOTFIX_VERSION='2026.08.29.2';

  function say(msg){
    try{ if(typeof toast==='function') return toast(msg); }catch(_e){}
    console.log('[Halaqati]',msg);
  }
  if(typeof state==='undefined'||typeof db==='undefined'){
    console.error('Halaqati hotfix: app globals are unavailable');
    return;
  }

  async function fetchPaged(makeQuery,pageSize=900){
    const out=[];
    for(let from=0;;from+=pageSize){
      const r=await makeQuery().range(from,from+pageSize-1);
      if(r.error) throw r.error;
      const rows=r.data||[];
      out.push(...rows);
      if(rows.length<pageSize) break;
      if(from>50000) throw new Error('حجم البيانات أكبر من الحد الآمن للتقرير');
    }
    return out;
  }

  async function bySessionIds(table,ids){
    const out=[];
    for(let i=0;i<ids.length;i+=70){
      const chunk=ids.slice(i,i+70);
      out.push(...await fetchPaged(()=>db.from(table).select('*').in('session_id',chunk)));
    }
    return out;
  }

  async function byStudentIds(table,ids,filterFn){
    const out=[];
    for(let i=0;i<ids.length;i+=70){
      const chunk=ids.slice(i,i+70);
      out.push(...await fetchPaged(()=>{
        let q=db.from(table).select('*').in('student_id',chunk);
        return filterFn?filterFn(q):q;
      }));
    }
    return out;
  }

  const originalOfflineReportFromCache=window.offlineReportFromCache;

  /* Always use the fresh student set captured for this report. */
  window.reportStudents=function(){
    let rows=Array.isArray(state.reportData?.students)
      ? state.reportData.students
      : (typeof activeStudents==='function'?activeStudents():(state.students||[]));
    rows=(rows||[]).filter(s=>s&&s.status!=='withdrawn');
    if(state.reportHalaqa&&state.reportHalaqa!=='all') rows=rows.filter(s=>s.halaqa_id===state.reportHalaqa);
    return rows.slice().sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
  };

  window.reportQueryIn=bySessionIds;

  /* Dedicated report loader: reads fresh students + sessions + all report-related records. */
  window.loadSelectedReport=async function(){
    if(state.reportLoading) return;
    const b=reportBounds();
    if(!b.from||!b.to||b.from>b.to) return say('تأكد من تاريخ البداية والنهاية');

    if(!(await internetReachable())){
      const cached=typeof originalOfflineReportFromCache==='function'
        ? originalOfflineReportFromCache()
        : {sessions:[],attendance:[],notes:[],recitations:[]};
      cached.students=(typeof activeStudents==='function'?activeStudents():(state.students||[]))
        .filter(s=>state.reportHalaqa==='all'||s.halaqa_id===state.reportHalaqa);
      cached.points=[];cached.goals=[];cached.monthlyComments=[];cached.monthlyStats=[];cached.dailySummary=[];
      state.reportData=cached;
      state.reportLoadedKey=reportKey();
      render();
      return say('تم تجهيز التقرير من البيانات المخزنة على الجهاز');
    }

    state.reportLoading=true;
    render();
    try{
      const students=await fetchPaged(()=>{
        let q=db.from('students').select('*').neq('status','withdrawn').order('full_name');
        if(state.reportHalaqa!=='all') q=q.eq('halaqa_id',state.reportHalaqa);
        return q;
      });

      const sessions=await fetchPaged(()=>{
        let q=db.from('sessions').select('*')
          .neq('status','cancelled')
          .gte('session_date',b.from).lte('session_date',b.to)
          .order('session_date',{ascending:true});
        if(state.reportHalaqa!=='all') q=q.eq('halaqa_id',state.reportHalaqa);
        if(state.reportSessionType!=='all') q=q.eq('session_type',state.reportSessionType);
        return q;
      });

      const sessionIds=sessions.map(x=>x.id);
      const studentIds=students.map(x=>x.id);
      let attendance=[],recitations=[],notes=[],points=[],goals=[],monthlyComments=[],monthlyStats=[],dailySummary=[];

      if(sessionIds.length){
        [attendance,recitations,notes]=await Promise.all([
          bySessionIds('attendance_records',sessionIds),
          bySessionIds('recitation_entries',sessionIds),
          bySessionIds('student_daily_notes',sessionIds)
        ]);
      }

      if(studentIds.length){
        const firstMonth=b.from.slice(0,7)+'-01';
        const lastMonth=b.to.slice(0,7)+'-01';
        [points,goals,monthlyComments,monthlyStats,dailySummary]=await Promise.all([
          byStudentIds('student_points',studentIds,q=>q.gte('awarded_at',b.from).lte('awarded_at',b.to)),
          byStudentIds('student_goals',studentIds,q=>q.lte('period_start',b.to).gte('period_end',b.from)),
          byStudentIds('monthly_comments',studentIds,q=>q.gte('month_start',firstMonth).lte('month_start',lastMonth)),
          byStudentIds('monthly_student_stats',studentIds,q=>q.gte('month_start',firstMonth).lte('month_start',lastMonth)),
          byStudentIds('daily_student_summary',studentIds,q=>q.gte('session_date',b.from).lte('session_date',b.to))
        ]);
      }

      state.reportData={students,sessions,attendance,recitations,notes,points,goals,monthlyComments,monthlyStats,dailySummary};
      state.reportLoadedKey=reportKey();
      try{cacheSnapshot();}catch(_e){}
      say(`تم تجهيز التقرير: ${students.length} طالب · ${sessions.length} لقاء`);
    }catch(e){
      console.error('Halaqati report load error',e);
      say('تعذر تجهيز التقرير: '+(e?.message||e));
    }finally{
      state.reportLoading=false;
      render();
    }
  };

  /* Keep ALL active students. Zero-activity students remain in the report with zeros. */
  window.reportStatsRows=function(){
    const students=reportStudents();
    const sidSet=new Set(students.map(x=>x.id));
    const sessions=reportSessions();
    const seSet=new Set(sessions.map(x=>x.id));
    const at=reportAttendance().filter(x=>sidSet.has(x.student_id)&&seSet.has(x.session_id));
    const recs=reportRecitations().filter(x=>sidSet.has(x.student_id)&&seSet.has(x.session_id));
    const notes=reportNotes().filter(x=>sidSet.has(x.student_id)&&seSet.has(x.session_id));
    const extraPoints=(state.reportData?.points||[]).filter(x=>sidSet.has(x.student_id));
    const goals=(state.reportData?.goals||[]).filter(x=>sidSet.has(x.student_id));
    const comments=(state.reportData?.monthlyComments||[]).filter(x=>sidSet.has(x.student_id));

    return students.map(st=>{
      const a=at.filter(x=>x.student_id===st.id);
      const rr=recs.filter(x=>x.student_id===st.id);
      const nn=notes.filter(x=>x.student_id===st.id);
      const pp=extraPoints.filter(x=>x.student_id===st.id);
      const gg=goals.filter(x=>x.student_id===st.id);
      const cc=comments.filter(x=>x.student_id===st.id);
      const out={student:st,hifzPages:0,tathbitPages:0,reviewPages:0,sardPages:0,tilawahPages:0,mistakes:0,prompts:0,points:0,recitationPoints:0,bonusPoints:0,present:0,absent:0,excused:0,late:0,notes:nn,goals:gg,monthlyComments:cc};

      for(const x of a){
        if(x.status==='present') out.present++;
        else if(x.status==='absent') out.absent++;
        else if(x.status==='excused') out.excused++;
        else if(x.status==='late') out.late++;
      }
      for(const r of rr){
        const g=recGroup(r,st),p=Number(r.pages_count||0);
        if(g==='hifz') out.hifzPages+=p;
        else if(g==='tathbit') out.tathbitPages+=p;
        else if(g==='review') out.reviewPages+=p;
        else if(g==='sard') out.sardPages+=p;
        else out.tilawahPages+=p;
        out.mistakes+=Number(r.mistakes||0);
        out.prompts+=Number(r.prompts||0);
        out.recitationPoints+=Number(recPoints(r)||0);
      }
      out.bonusPoints=pp.reduce((sum,x)=>sum+Number(x.points||0),0);
      out.points=out.recitationPoints+out.bonusPoints;
      out.totalPages=out.hifzPages+out.tathbitPages+out.reviewPages+out.sardPages+out.tilawahPages;
      out.sessions=a.length;
      return out;
    }).sort((a,b)=>b.points-a.points||b.totalPages-a.totalPages||String(a.student.full_name||'').localeCompare(String(b.student.full_name||''),'ar'));
  };

  /* -------- Built-in PDF preview/editor -------- */
  const previewCss=`
  #reportPreviewDlg{width:min(1500px,98vw);max-width:none;height:96vh;max-height:96vh;border-radius:18px;overflow:hidden;padding:0}
  #reportPreviewDlg::backdrop{background:#061b16cc}
  .hf-preview-shell{height:96vh;display:grid;grid-template-rows:auto 1fr;background:#eef2f0;direction:rtl}
  .hf-preview-toolbar{background:#fff;border-bottom:1px solid #dfe6e2;padding:10px 12px;display:flex;gap:9px;align-items:end;flex-wrap:wrap;z-index:2}
  .hf-preview-toolbar label{display:grid;gap:4px;font-size:10px;color:#68736e;min-width:105px}
  .hf-preview-toolbar select{border:1px solid #dfe6e2;border-radius:9px;padding:7px;background:#fff;min-height:37px}
  .hf-preview-toolbar input[type=range]{width:135px}
  .hf-preview-toolbar input[type=color]{width:50px;height:37px;border:1px solid #dfe6e2;border-radius:9px;background:#fff;padding:3px}
  .hf-preview-spacer{flex:1}
  .hf-preview-btn{border:0;border-radius:11px;padding:9px 13px;font-weight:800;background:#e9f3ee;color:#0d3b2f;min-height:39px}
  .hf-preview-btn.primary{background:#0d3b2f;color:#fff}
  .hf-preview-btn.closex{background:#fff0f0;color:#a43a3a}
  .hf-preview-viewport{overflow:auto;padding:18px;direction:ltr}
  #reportPreviewPaper{margin:auto;direction:rtl;background:#fff;box-shadow:0 14px 50px #0d3b2f26;transform-origin:top center;transition:width .15s ease;outline:none;color:#18231f}
  #reportPreviewPaper[data-orientation=landscape]{width:1120px;min-height:792px}
  #reportPreviewPaper[data-orientation=portrait]{width:792px;min-height:1120px}
  #reportPreviewPaper .pro-report-page{box-shadow:none!important;margin:0 0 18px!important;border-radius:0!important;border:0!important;min-height:auto;background:#fff}
  #reportPreviewPaper[contenteditable=true]:focus{outline:2px dashed #2f8b69;outline-offset:3px}
  .hf-edit-note{font-size:10px;color:#6f7a75;padding:0 5px 5px;direction:rtl}
  @media(max-width:700px){.hf-preview-toolbar{max-height:42vh;overflow:auto}.hf-preview-viewport{padding:8px}}
  `;

  function ensurePreviewUi(){
    if(!document.getElementById('halaqatiReportHotfixStyle')){
      const style=document.createElement('style');
      style.id='halaqatiReportHotfixStyle';
      style.textContent=previewCss;
      document.head.appendChild(style);
    }
    if(document.getElementById('reportPreviewDlg')) return;
    const dlg=document.createElement('dialog');
    dlg.id='reportPreviewDlg';
    dlg.innerHTML=`<div class="hf-preview-shell">
      <div class="hf-preview-toolbar">
        <label>اتجاه الصفحة<select id="hfOrientation"><option value="landscape">أفقي A4</option><option value="portrait">رأسي A4</option></select></label>
        <label>نوع الخط<select id="hfFont"><option value="Cairo">Cairo</option><option value="Tahoma">Tahoma</option><option value="Arial">Arial</option><option value="serif">Serif</option></select></label>
        <label>حجم الخط <span id="hfFontSizeVal">11px</span><input id="hfFontSize" type="range" min="8" max="18" step="1" value="11"></label>
        <label>لون النص<input id="hfTextColor" type="color" value="#18231f"></label>
        <label>لون العناوين<input id="hfAccentColor" type="color" value="#0d3b2f"></label>
        <label>التكبير <span id="hfZoomVal">100%</span><input id="hfZoom" type="range" min="60" max="130" step="5" value="100"></label>
        <div class="hf-preview-spacer"></div>
        <button class="hf-preview-btn" type="button" id="hfReset">إعادة الضبط</button>
        <button class="hf-preview-btn primary" type="button" id="hfSavePdf">تنزيل PDF</button>
        <button class="hf-preview-btn closex" type="button" id="hfClosePreview">إغلاق</button>
      </div>
      <div class="hf-preview-viewport"><div><div class="hf-edit-note">يمكنك الضغط داخل المعاينة وتعديل النص مباشرة قبل تنزيل PDF.</div><div id="reportPreviewPaper" data-orientation="landscape" contenteditable="true" spellcheck="false"></div></div></div>
    </div>`;
    document.body.appendChild(dlg);

    const paper=dlg.querySelector('#reportPreviewPaper');
    const orientation=dlg.querySelector('#hfOrientation');
    const font=dlg.querySelector('#hfFont');
    const fontSize=dlg.querySelector('#hfFontSize');
    const textColor=dlg.querySelector('#hfTextColor');
    const accent=dlg.querySelector('#hfAccentColor');
    const zoom=dlg.querySelector('#hfZoom');

    function apply(){
      paper.dataset.orientation=orientation.value;
      paper.style.fontFamily=font.value+', sans-serif';
      paper.style.fontSize=fontSize.value+'px';
      paper.style.color=textColor.value;
      paper.style.transform=`scale(${Number(zoom.value)/100})`;
      dlg.querySelector('#hfFontSizeVal').textContent=fontSize.value+'px';
      dlg.querySelector('#hfZoomVal').textContent=zoom.value+'%';
      paper.querySelectorAll('.pro-head-title h1,.pro-section-title,.pro-kpi b,.student-report-card h2').forEach(el=>el.style.color=accent.value);
      paper.querySelectorAll('.pro-head-logo,.pro-table th').forEach(el=>el.style.background=accent.value);
    }
    [orientation,font,fontSize,textColor,accent,zoom].forEach(x=>x.addEventListener('input',apply));
    dlg.querySelector('#hfReset').onclick=()=>{
      orientation.value='landscape';font.value='Cairo';fontSize.value='11';textColor.value='#18231f';accent.value='#0d3b2f';zoom.value='100';apply();
    };
    dlg.querySelector('#hfClosePreview').onclick=()=>dlg.close();
    dlg.querySelector('#hfSavePdf').onclick=()=>window.downloadReportPdfFromPreview();
    apply();
  }

  window.openReportPreview=function(){
    if(state.reportLoadedKey!==reportKey()) return say('جهّز التقرير أولاً');
    ensurePreviewUi();
    const paper=document.getElementById('reportPreviewPaper');
    let html='';
    try{html=currentProfessionalReportHtml();}catch(e){return say('تعذر إنشاء المعاينة: '+(e?.message||e));}
    if(!html||!html.trim()) return say('لا توجد بيانات للمعاينة');
    paper.innerHTML=html;
    paper.contentEditable='true';
    document.getElementById('hfOrientation').dispatchEvent(new Event('input'));
    document.getElementById('reportPreviewDlg').showModal();
  };

  window.downloadReportPdfFromPreview=async function(){
    try{
      if(!window.jspdf?.jsPDF) throw new Error('مكتبة PDF غير متاحة');
      if(!window.html2canvas) throw new Error('مكتبة المعاينة غير متاحة');
      const paper=document.getElementById('reportPreviewPaper');
      if(!paper||!paper.innerHTML.trim()) throw new Error('افتح المعاينة أولاً');
      const orientation=document.getElementById('hfOrientation')?.value||'landscape';
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation,unit:'mm',format:'a4'});
      const pw=orientation==='landscape'?297:210;
      const ph=orientation==='landscape'?210:297;
      const margin=7;
      let pages=[...paper.querySelectorAll('.pro-report-page')];
      if(!pages.length) pages=[paper];

      for(let i=0;i<pages.length;i++){
        if(i) pdf.addPage('a4',orientation);
        const canvas=await html2canvas(pages[i],{
          scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,
          windowWidth:Math.max(pages[i].scrollWidth,orientation==='landscape'?1100:780)
        });
        const img=canvas.toDataURL('image/jpeg',.95);
        const boxW=pw-margin*2,boxH=ph-margin*2;
        const ratio=Math.min(boxW/canvas.width,boxH/canvas.height);
        const w=canvas.width*ratio,h=canvas.height*ratio;
        pdf.addImage(img,'JPEG',(pw-w)/2,margin,w,h,'FAST');
      }

      const name=`تقرير_حلقتي_${reportFileStamp()}.pdf`;
      if(typeof isNativeHalaqati==='function'&&isNativeHalaqati()){
        const blob=pdf.output('blob');
        await saveOrShareBase64(await blobToBase64(blob),name,'application/pdf');
      }else{
        pdf.save(name);
      }
      say('تم إنشاء ملف PDF');
    }catch(e){
      console.error('Halaqati preview PDF error',e);
      say('تعذر إنشاء PDF: '+(e?.message||e));
    }
  };

  /* Clicking PDF now opens the built-in preview, never the system print dialog. */
  window.exportCurrentReportPdf=window.openReportPreview;

  const originalReportsPage=window.reportsPage;
  if(typeof originalReportsPage==='function'){
    window.reportsPage=function(){
      let html=originalReportsPage();
      html=html.replace('onclick="exportCurrentReportPdf()"','onclick="openReportPreview()"');
      html=html.replace('🖨️ PDF','👁️ معاينة PDF');
      return html;
    };
  }

  /* Extra browser OAuth recovery after Google redirects/back navigation. */
  async function recoverWebSession(){
    try{
      if(typeof isNativeHalaqati==='function'&&isNativeHalaqati()) return;
      const r=await db.auth.getSession();
      const user=r?.data?.session?.user;
      if(user&&!state.user&&typeof boot==='function') await boot(user);
    }catch(e){ console.warn('Halaqati OAuth session recovery',e); }
  }
  window.addEventListener('pageshow',()=>setTimeout(recoverWebSession,30));
  window.addEventListener('hashchange',()=>setTimeout(recoverWebSession,30));

  ensurePreviewUi();
  console.info('Halaqati report hotfix loaded',HOTFIX_VERSION);
})();
