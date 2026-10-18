/* Halaqati Web/Reports Hotfix — 2026-08-29 */
(function(){
  'use strict';
  window.__HALAQATI_REPORTS_RUNTIME__='2.40.4-authenticated-report-snapshot';
  const PDF_PNG_COMPRESSION='NONE'; // lossless HQ: do not use FAST image compression
  const HOTFIX_VERSION='2026.09.05.3-direct-vector-save-print-isolation';

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
    for(let from=0;;){
      const pending=makeQuery().range(from,from+pageSize-1);
      const r=typeof withTimeout==='function'?await withTimeout(pending,12000,'report query timeout'):await pending;
      if(r.error) throw r.error;
      if(!Array.isArray(r.data))throw new Error('استجابة بيانات التقرير غير صالحة');
      const rows=r.data;
      out.push(...rows);
      if(!rows.length) break;
      from+=rows.length;
      if(from>50000) throw new Error('حجم البيانات أكبر من الحد الآمن للتقرير');
    }
    return out;
  }

  async function bySessionIds(table,ids){
    const out=[];
    for(let i=0;i<ids.length;i+=70){
      const chunk=ids.slice(i,i+70);
      out.push(...await fetchPaged(()=>db.from(table).select('*').in('session_id',chunk).order('id')));
    }
    return out;
  }

  async function byStudentIds(table,ids,filterFn){
    const out=[];
    for(let i=0;i<ids.length;i+=70){
      const chunk=ids.slice(i,i+70);
      out.push(...await fetchPaged(()=>{
        let q=db.from(table).select('*').in('student_id',chunk).order('id');
        return filterFn?filterFn(q):q;
      }));
    }
    return out;
  }

  const originalOfflineReportFromCache=window.offlineReportFromCache;

  /* Always use the fresh student set captured for this report. */
  window.reportStudents=function(trackOverride=null){
    let rows=Array.isArray(state.reportData?.students)
      ? state.reportData.students
      : (typeof activeStudents==='function'?activeStudents():(state.students||[]));
    rows=(rows||[]).filter(s=>s&&s.status!=='withdrawn');
    if(state.reportHalaqa&&state.reportHalaqa!=='all') rows=rows.filter(s=>s.halaqa_id===state.reportHalaqa);
    const track=trackOverride??state.reportTrack??'all';
    if(track&&track!=='all') rows=rows.filter(s=>s.track_code===track);
    return rows.slice().sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
  };

  window.reportQueryIn=bySessionIds;

  /* Dedicated report loader: server first. Offline fallback only uses a complete report previously loaded from the server. */
  const REPORT_CACHE_PREFIX='halaqati_v2404_report_cache_';
  function reportCacheStorageKey(){return REPORT_CACHE_PREFIX+String(state.user?.id||'guest')}
  function saveSuccessfulReportCache(){
    try{
      const payload={version:1,key:reportKey(),savedAt:new Date().toISOString(),data:state.reportData};
      const raw=JSON.stringify(payload);
      if(raw.length>3_800_000)return;
      localStorage.setItem(reportCacheStorageKey(),raw)
    }catch(_e){}
  }
  function readSuccessfulReportCache(){
    try{
      const x=JSON.parse(localStorage.getItem(reportCacheStorageKey())||'null');
      if(!x||x.version!==1||x.key!==reportKey()||!x.data||!['students','sessions','attendance','recitations','notes','points','goals','monthlyComments'].every(k=>Array.isArray(x.data[k])))return null;
      return x
    }catch(_e){return null}
  }
  function networkLikeError(e){
    const m=String(e?.message||e||'').toLowerCase();
    return !navigator.onLine||m.includes('failed to fetch')||m.includes('network')||m.includes('load failed')||m.includes('timeout')||m.includes('abort')||m.includes('offline')
  }
  async function loadServerReportData(b,filters){
    const students=await fetchPaged(()=>{
      let q=db.from('students').select('*').neq('status','withdrawn').order('full_name').order('id');
      if(filters.halaqa!=='all') q=q.eq('halaqa_id',filters.halaqa);
      return q;
    });
    state.networkVerified=true;state.offline=false;try{updateSyncBadge()}catch(_e){}

    const sessions=await fetchPaged(()=>{
      let q=db.from('sessions').select('*')
        .neq('status','cancelled')
        .gte('session_date',b.from).lte('session_date',b.to)
        .order('session_date',{ascending:true}).order('id');
      if(filters.halaqa!=='all') q=q.eq('halaqa_id',filters.halaqa);
      if(filters.sessionType!=='all') q=q.eq('session_type',filters.sessionType);
      return q;
    });

    const sessionIds=sessions.map(x=>x.id);
    const studentIds=students.map(x=>x.id);
    let attendance=[],recitations=[],notes=[],points=[],goals=[],monthlyComments=[];

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
      [points,goals,monthlyComments]=await Promise.all([
        byStudentIds('student_points',studentIds,q=>q.gte('awarded_at',b.from).lte('awarded_at',b.to)),
        byStudentIds('student_goals',studentIds,q=>q.lte('period_start',b.to).gte('period_end',b.from)),
        byStudentIds('monthly_comments',studentIds,q=>q.gte('month_start',firstMonth).lte('month_start',lastMonth))
      ]);
    }
    return {students,sessions,attendance,recitations,notes,points,goals,monthlyComments};
  }

  function reportAuthError(e){
    return ['REPORT_AUTH','42501','PGRST301','PGRST302','PGRST303'].includes(String(e?.code))||/jwt|permission denied|not authenticated/i.test(String(e?.message||''));
  }
  async function verifyReportAccount(forceRefresh=false){
    if(typeof ensureServerAuthSession!=='function'||!(await ensureServerAuthSession({silent:true,forceRefresh}))){
      const error=new Error(state.authNeedsLogin?'جلسة الدخول تحتاج تجديدًا؛ اضغط حالة المزامنة وسجّل الدخول بالحساب نفسه ثم جهّز التقرير.':'تعذر التحقق من اتصال الحساب بالخادم. أعد المحاولة عند استقرار الاتصال.');
      error.code=state.authNeedsLogin?'REPORT_AUTH':'REPORT_NETWORK';throw error;
    }
  }
  window.loadSelectedReport=async function(){
    if(state.reportLoading) return;
    const b=reportBounds();
    if(!b.from||!b.to||b.from>b.to) return say('تأكد من تاريخ البداية والنهاية');
    state.reportHalaqa=state.reportHalaqa||'all';
    state.reportSessionType=state.reportSessionType||'all';
    const key=reportKey(),userId=state.user?.id;
    const filters={halaqa:state.reportHalaqa,sessionType:state.reportSessionType};
    const current=()=>state.user?.id===userId&&reportKey()===key;
    state.reportLoading=true;state.reportError='';state.reportLoadedKey='';state.reportData=null;
    state.reportSource='';state.reportUpdatedAt='';
    render();
    try{
      if(!navigator.onLine)throw new Error('offline');
      await verifyReportAccount();
      let data;
      try{data=await loadServerReportData(b,filters)}catch(e){
        if(reportAuthError(e))await verifyReportAccount(true);
        else if(networkLikeError(e))await new Promise(r=>setTimeout(r,650));
        else throw e;
        data=await loadServerReportData(b,filters);
      }
      if(!current())return;
      state.reportData=data;
      state.reportLoadedKey=key;
      state.reportSource='server';
      state.reportUpdatedAt=new Date().toISOString();
      const count=reportStudents().length;
      state.reportError=!count?'لا يوجد طلاب متاحون للحلقة والمسار المحددين. اختر «جميع الحلقات» و«جميع المسارات» أو تحقق من صلاحية الحساب.':!data.sessions.length?'لا توجد لقاءات خلال الفترة ونوع اللقاء المحددين؛ اختر فترة تحتوي على لقاءات مسجلة.':'';
      saveSuccessfulReportCache();
      try{cacheSnapshot();}catch(_e){}
      say(state.reportError||`تم تجهيز التقرير من الخادم: ${count} طالب · ${data.sessions.length} لقاء`);
    }catch(e){
      if(!current())return;
      console.error('Halaqati report load error',e);
      const isNetwork=!reportAuthError(e)&&(e?.code==='REPORT_NETWORK'||networkLikeError(e));
      const cached=isNetwork?readSuccessfulReportCache():null;
      if(cached){
        state.reportData=cached.data;
        state.reportLoadedKey=key;
        state.reportSource='cache';
        state.reportUpdatedAt=cached.savedAt||'';
        state.reportError='تعذر الوصول للخادم؛ هذه آخر نسخة كاملة محفوظة لهذا التقرير.';
        state.offline=true;try{updateSyncBadge()}catch(_e){}
        say(state.reportError);
      }else{
        state.reportData=null;state.reportLoadedKey='';state.reportSource='';state.reportUpdatedAt='';
        state.reportError=e?.code==='REPORT_AUTH'?e.message:reportAuthError(e)?'تعذر الوصول إلى بيانات التقرير بسبب جلسة الدخول أو صلاحيات الحساب. جدّد الدخول بالحساب الصحيح وتحقق من صلاحية الحلقة.':isNetwork?'تعذر تحميل التقرير من الخادم ولا توجد نسخة محلية كاملة لهذه الفترة. أعد المحاولة عند استقرار الاتصال.':'تعذر تحميل بيانات التقرير. التفاصيل: '+String(e?.message||e);
        say(state.reportError);
      }
    }finally{
      state.reportLoading=false;
      render();
    }
  };

  /* Keep ALL active students. Zero-activity students remain in the report with zeros. */
  window.reportStatsRows=function(trackOverride=null){
    const students=reportStudents(trackOverride);
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
  #reportPreviewDlg{width:min(1500px,98vw);max-width:none;height:96vh;max-height:96vh;border-radius:18px;overflow:hidden;padding:0;position:relative}
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
  #reportPreviewPaper .pro-report-page{box-shadow:none!important;margin:0 0 18px!important;border-radius:0!important;border:0!important;min-height:auto;background:#fff;box-sizing:border-box;overflow:visible!important}
  #reportPreviewPaper[data-orientation=landscape] .pro-report-page{width:1120px}
  #reportPreviewPaper[data-orientation=portrait] .pro-report-page{width:792px}
  #reportPreviewPaper .pro-table-wrap{width:100%!important;min-width:0!important;max-width:100%!important;overflow:visible!important}
  #reportPreviewPaper .pro-table{width:100%!important;min-width:0!important;max-width:100%!important;table-layout:fixed!important}
  #reportPreviewPaper .pro-table th,#reportPreviewPaper .pro-table td{box-sizing:border-box!important;word-break:normal!important;overflow-wrap:normal!important;letter-spacing:normal!important;text-align:center;hyphens:none!important;overflow:hidden!important;text-overflow:clip!important}
  #reportPreviewPaper .pro-table .name,#reportPreviewPaper .pro-table .hf-col-name{text-align:right!important;white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important}
  #reportPreviewPaper .pro-table .hf-col-compact{white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important}
  #reportPreviewPaper .pro-table .hf-col-flex,#reportPreviewPaper .pro-table .text-cell{white-space:normal!important;text-align:right!important;line-height:1.65!important;word-break:normal!important;overflow-wrap:anywhere!important}
  #reportPreviewPaper .pro-table .hf-col-auto{white-space:normal!important;line-height:1.55!important;word-break:normal!important;overflow-wrap:anywhere!important}
  #reportPreviewPaper[data-orientation=portrait] .pro-table th,#reportPreviewPaper[data-orientation=portrait] .pro-table td{padding-left:3px!important;padding-right:3px!important}
  #reportPreviewPaper[data-orientation=portrait] .pro-kpis{grid-template-columns:repeat(3,1fr)!important}
  #reportPreviewPaper[contenteditable=true]:focus{outline:2px dashed #2f8b69;outline-offset:3px}
  .hf-edit-note{font-size:10px;color:#6f7a75;padding:0 5px 5px;direction:rtl}
  .hf-pdf-continuation-label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:5px 0 8px;padding:6px 9px;border:1px solid #dfe6e2;border-radius:9px;background:#f8fbf9;color:#53615b;font-size:9px;direction:rtl}
  .hf-pdf-continuation-label b{color:#0d3b2f;font-size:10px}
  .hf-pdf-render-stage{position:fixed!important;left:0!important;top:0!important;margin:0!important;padding:0!important;background:#fff!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;z-index:2147483000!important;transform:none!important;overflow:visible!important;box-shadow:none!important}
  .hf-pdf-render-stage>.pro-report-page{margin:0!important;visibility:visible!important;opacity:1!important;display:block!important;background:#fff!important;transform:none!important}
  .hf-pdf-progress{position:fixed;inset:0;z-index:2147483600;background:rgba(247,247,242,.98);display:grid;place-items:center;direction:rtl;font-family:Cairo,Tahoma,Arial,sans-serif;color:#0d3b2f}
  .hf-pdf-progress>div{background:#fff;border:1px solid #dfe6e2;border-radius:18px;padding:18px 22px;box-shadow:0 16px 50px #0d3b2f22;text-align:center;min-width:220px}
  .hf-pdf-progress b{display:block;font-size:16px;margin-bottom:4px}.hf-pdf-progress span{font-size:11px;color:#6f7a75}
  @media(max-width:700px){.hf-preview-toolbar{max-height:42vh;overflow:auto}.hf-preview-viewport{padding:8px}}
  `;

  const PDF_FLEX_HEADERS=/تعليق|ملاحظة|العنوان|المقرر|الخطة|تفاصيل|وصف|السبب|الواجب|النطاق|بيانات إضافية/i;
  const PDF_NAME_HEADERS=/^(الطالب|اسم الطالب)$/i;
  const PDF_COMPACT_HEADERS=/^(#|م|الرقم|الجنس|الهوية|رقم الهوية|الجوال|الهاتف|الميلاد|تاريخ الميلاد|تاريخ الالتحاق|الحضور|الغياب|الحفظ|السرد|التثبيت|المراجعة|الأخطاء|النقرات|V6|النقاط|الترتيب|المستوى)$/i;
  function pdfColumnKind(label){
    if(PDF_NAME_HEADERS.test(label))return 'name';
    if(PDF_FLEX_HEADERS.test(label))return 'flex';
    if(PDF_COMPACT_HEADERS.test(label))return label==='#'||label==='م'||label==='الرقم'?'index':'compact';
    return 'auto';
  }
  function pdfColumnTextScore(table,index){
    let max=0;
    const cells=[...(table.tBodies||[])].flatMap(tb=>[...tb.rows].slice(0,60).map(r=>r.cells[index]).filter(Boolean));
    for(const cell of cells){
      const t=String(cell.textContent||'').replace(/\s+/g,' ').trim();
      if(!t)continue;
      // Arabic glyphs are relatively wide in Cairo, so use a conservative score.
      const score=[...t].reduce((n,ch)=>n+(/[\u0600-\u06ff]/.test(ch)?1.08:/[A-Z0-9]/.test(ch)?.82:.68),0);
      if(score>max)max=score;
    }
    return max;
  }
  function pdfColumnWeights(table,head,kinds){
    const weights=kinds.map((kind,i)=>{
      const label=String(head[i]?.textContent||'').replace(/\s+/g,' ').trim();
      const score=Math.max(pdfColumnTextScore(table,i),[...label].length);
      if(kind==='index')return 3.2;
      if(kind==='compact')return Math.min(6.2,Math.max(4.8,3.8+Math.min(score,10)*.18));
      if(kind==='name')return Math.min(29,Math.max(23,20+Math.min(score,34)*.24));
      if(kind==='flex')return Math.min(24,Math.max(14,10+Math.min(score,42)*.28));
      return Math.min(13,Math.max(7.2,6+Math.min(score,28)*.22));
    });
    let total=weights.reduce((a,b)=>a+b,0);
    if(total<100){
      let extra=100-total;
      const priority=kinds.map((k,i)=>({k,i})).filter(x=>x.k==='flex'||x.k==='name'||x.k==='auto');
      if(priority.length){
        const shares=priority.reduce((n,x)=>n+(x.k==='flex'?1.6:x.k==='name'?1.35:1),0);
        for(const x of priority)weights[x.i]+=extra*((x.k==='flex'?1.6:x.k==='name'?1.35:1)/shares);
      }else weights[weights.length-1]+=extra;
    }else if(total>100){
      // Compress descriptive columns first. Numeric columns keep enough room for headers/values.
      let overflow=total-100;
      const mins=kinds.map(k=>k==='index'?2.8:k==='compact'?4.2:k==='name'?19:k==='flex'?10:5.8);
      for(const group of [['auto','flex'],['name'],['compact','index']]){
        const ids=kinds.map((k,i)=>group.includes(k)?i:-1).filter(i=>i>=0);
        let capacity=ids.reduce((n,i)=>n+Math.max(0,weights[i]-mins[i]),0);
        if(!capacity)continue;
        const take=Math.min(overflow,capacity);
        for(const i of ids){
          const cap=Math.max(0,weights[i]-mins[i]);
          weights[i]-=take*(cap/capacity);
        }
        overflow-=take;
        if(overflow<=.01)break;
      }
      total=weights.reduce((a,b)=>a+b,0);
      if(total>100){const factor=100/total;for(let i=0;i<weights.length;i++)weights[i]*=factor}
    }
    const sum=weights.reduce((a,b)=>a+b,0)||1;
    return weights.map(w=>w*100/sum);
  }
  function shrinkPdfNameCells(table){
    const cells=[...table.querySelectorAll('th.hf-col-name,td.hf-col-name,.name')];
    for(const cell of cells){
      cell.style.whiteSpace='nowrap';
      cell.style.overflow='hidden';
      cell.style.textOverflow='clip';
      if(!cell.clientWidth)continue;
      const computed=parseFloat(getComputedStyle(cell).fontSize)||9.5;
      const requested=Number(cell.dataset.hfRequestedFont||computed);
      // When toolbar size changes, reset to its requested size before measuring again.
      if(Math.abs(computed-requested)>.05&&computed<requested)cell.style.fontSize=requested+'px';
      else cell.dataset.hfRequestedFont=String(computed);
      let size=parseFloat(getComputedStyle(cell).fontSize)||requested;
      let guard=0;
      while(cell.scrollWidth>cell.clientWidth+1&&size>7.2&&guard++<12){
        size=Math.max(7.2,size-.35);
        cell.style.fontSize=size.toFixed(2)+'px';
      }
    }
  }
  function applyAutoFitPdfTables(root){
    if(!root)return;
    root.querySelectorAll('.pro-table').forEach(table=>{
      const head=[...(table.tHead?.rows?.[0]?.cells||[])];
      if(!head.length)return;
      const kinds=head.map(th=>pdfColumnKind(String(th.textContent||'').replace(/\s+/g,' ').trim()));
      const widths=pdfColumnWeights(table,head,kinds);
      let colgroup=table.querySelector('colgroup[data-hf-autofit]');
      if(!colgroup){colgroup=document.createElement('colgroup');colgroup.dataset.hfAutofit='1';table.insertBefore(colgroup,table.firstChild)}
      colgroup.replaceChildren(...widths.map(w=>{const col=document.createElement('col');col.style.width=w.toFixed(3)+'%';return col}));
      head.forEach((th,i)=>{
        const kind=kinds[i];
        const klass=kind==='name'?'hf-col-name':kind==='flex'?'hf-col-flex':(kind==='compact'||kind==='index')?'hf-col-compact':'hf-col-auto';
        [th,...[...(table.tBodies||[])].flatMap(tb=>[...tb.rows].map(r=>r.cells[i]).filter(Boolean))].forEach(cell=>{
          cell.classList.remove('hf-col-name','hf-col-flex','hf-col-compact','hf-col-auto');cell.classList.add(klass)
        });
      });
      table.style.width='100%';
      table.style.maxWidth='100%';
      table.style.minWidth='0';
      table.style.tableLayout='fixed';
      table.dataset.hfAutoFit='2';
      shrinkPdfNameCells(table);
    })
  }
  window.applyAutoFitPdfTables=applyAutoFitPdfTables;

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
        <button class="hf-preview-btn primary" type="button" id="hfSavePdf">حفظ PDF</button>
        <button class="hf-preview-btn" type="button" id="hfPrintPdf">طباعة</button>
        <button class="hf-preview-btn closex" type="button" id="hfClosePreview">إغلاق</button>
      </div>
      <div class="hf-preview-viewport"><div><div class="hf-edit-note">لإنشاء ملف PDF على الهاتف استخدم «حفظ PDF»؛ زر «طباعة» للطابعات عبر نظام Android. ويمكنك تعديل النص والخط والحجم واللون والاتجاه قبل التنفيذ.</div><div id="reportPreviewPaper" data-orientation="landscape" contenteditable="true" spellcheck="false"></div></div></div>
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
      paper.style.color=textColor.value;
      paper.style.transform=`scale(${Number(zoom.value)/100})`;
      const factor=Number(fontSize.value)/11;
      const targets=paper.querySelectorAll('.pro-head-title h1,.pro-head-title p,.pro-meta,.pro-meta *, .pro-kpi b,.pro-kpi span,.pro-section-title,.pro-table th,.pro-table td,.student-info-grid div,.student-info-grid b,.pro-footer,.pro-footer *, .podium-rank,.podium-name,.podium-score,.student-report-card h2,.report-empty-pro');
      targets.forEach(el=>{
        if(!el.dataset.hfBaseFont) el.dataset.hfBaseFont=String(parseFloat(getComputedStyle(el).fontSize)||11);
        el.style.fontSize=(Number(el.dataset.hfBaseFont)*factor).toFixed(2)+'px';
      });
      dlg.querySelector('#hfFontSizeVal').textContent=fontSize.value+'px';
      dlg.querySelector('#hfZoomVal').textContent=zoom.value+'%';
      paper.querySelectorAll('.pro-head-title h1,.pro-section-title,.pro-kpi b,.student-report-card h2').forEach(el=>el.style.color=accent.value);
      paper.querySelectorAll('.pro-head-logo,.pro-table th').forEach(el=>el.style.background=accent.value);
      applyAutoFitPdfTables(paper);
    }
    [orientation,font,fontSize,textColor,accent,zoom].forEach(x=>x.addEventListener('input',apply));
    dlg.querySelector('#hfReset').onclick=()=>{
      orientation.value='landscape';font.value='Cairo';fontSize.value='11';textColor.value='#18231f';accent.value='#0d3b2f';zoom.value='100';apply();
    };
    dlg.querySelector('#hfClosePreview').onclick=()=>dlg.close();
    dlg.querySelector('#hfSavePdf').onclick=()=>window.downloadReportPdfFromPreview();
    dlg.querySelector('#hfPrintPdf').onclick=()=>window.printReportPdfFromPreview();
    apply();
  }

  let previewContext='report';
  function studentsDirectoryPdfHtml(){
    const rows=studentDirectoryRows(),pages=[],chunkSize=10;
    for(let i=0;i<rows.length;i+=chunkSize){
      const chunk=rows.slice(i,i+chunkSize);
      pages.push(`<section class="pro-report-page"><div class="pro-head"><div class="pro-head-logo">ح</div><div class="pro-head-title"><h1>حلقتي</h1><p>بيانات الطلاب الأساسية · ${i+1}-${Math.min(i+chunkSize,rows.length)} من ${rows.length}</p></div><div class="pro-head-logo">۞</div></div><div class="pro-meta"><span><b>تاريخ الإصدار:</b> ${today()}</span><span><b>عدد الطلاب:</b> ${rows.length}</span><span><b>النطاق:</b> الطلاب النشطون المتاحون للحساب</span></div><div class="pro-table-wrap"><table class="pro-table"><thead><tr><th>#</th><th>الطالب</th><th>الحلقة</th><th>الفئة</th><th>المسار</th><th>الجنس</th><th>الهوية</th><th>الجوال</th><th>الميلاد</th><th>المرحلة</th></tr></thead><tbody>${chunk.map(r=>`<tr><td>${r['#']}</td><td class="name">${esc(r['اسم الطالب'])}</td><td>${esc(r['الحلقة'])}</td><td>${esc(r['الفئة'])}</td><td>${esc(r['المسار'])}</td><td>${esc(r['الجنس'])}</td><td>${esc(r['رقم الهوية'])}</td><td>${esc(r['الجوال'])}</td><td>${esc(r['تاريخ الميلاد'])}</td><td>${esc(r['المرحلة الدراسية'])}</td></tr>`).join('')}</tbody></table></div><div class="pro-section-title">بيانات إضافية</div><div class="pro-table-wrap"><table class="pro-table"><thead><tr><th>الطالب</th><th>بريد ولي الأمر</th><th>جوال ولي الأمر</th><th>العنوان</th><th>تاريخ الالتحاق</th></tr></thead><tbody>${chunk.map(r=>`<tr><td class="name">${esc(r['اسم الطالب'])}</td><td>${esc(r['بريد ولي الأمر'])}</td><td>${esc(r['جوال ولي الأمر'])}</td><td>${esc(r['العنوان'])}</td><td>${esc(r['تاريخ الالتحاق'])}</td></tr>`).join('')}</tbody></table></div><div class="pro-footer"><span>حلقتي · بيانات إدارية أساسية</span><span>لا يتضمن بيانات الحفظ أو الإنجاز</span></div></section>`);
    }
    return `<div class="pro-report">${pages.join('')}</div>`;
  }
  window.openStudentsPdfPreview=function(){
    const rows=studentDirectoryRows();
    if(!rows.length) return say('لا يوجد طلاب للتصدير');
    ensurePreviewUi();previewContext='students';
    const paper=document.getElementById('reportPreviewPaper');
    paper.innerHTML=studentsDirectoryPdfHtml();paper.contentEditable='true';applyAutoFitPdfTables(paper);
    const orientation=document.getElementById('hfOrientation');orientation.value='landscape';orientation.dispatchEvent(new Event('input'));
    document.getElementById('reportPreviewDlg').showModal();
  };

  window.openReportPreview=function(){
    previewContext='report';
    if(state.reportLoadedKey!==reportKey()) return say('جهّز التقرير أولاً');
    ensurePreviewUi();
    const paper=document.getElementById('reportPreviewPaper');
    let html='';
    try{html=currentProfessionalReportHtml();}catch(e){return say('تعذر إنشاء المعاينة: '+(e?.message||e));}
    if(!html||!html.trim()) return say('لا توجد بيانات للمعاينة');
    paper.innerHTML=html;
    paper.contentEditable='true';applyAutoFitPdfTables(paper);
    document.getElementById('hfOrientation').dispatchEvent(new Event('input'));
    document.getElementById('reportPreviewDlg').showModal();
  };

  function normalizePdfClone(clone,sourcePage){
    clone.style.margin='0';
    clone.style.width=sourcePage.scrollWidth+'px';
    clone.style.maxWidth='none';
    clone.style.height='auto';
    clone.style.minHeight='0';
    clone.style.overflow='visible';
    clone.style.visibility='visible';
    clone.style.opacity='1';
    clone.style.display='block';
    clone.style.transform='none';
    return clone;
  }

  function buildRowSafePdfPages(sourcePage,maxPageHeight){
    const tables=[...sourcePage.querySelectorAll('.pro-table')];
    const table=tables.length===1?tables[0]:null;
    const tbody=table?.tBodies?.[0];

    // Always render a clone. Never move the live preview page into the render stage.
    if(!table||!tbody||!tbody.rows.length||sourcePage.scrollHeight<=maxPageHeight+2){
      return {pages:[normalizePdfClone(sourcePage.cloneNode(true),sourcePage)],cleanup:()=>{},applied:false};
    }

    const host=sourcePage.parentElement;
    const sandbox=document.createElement('div');
    sandbox.className='hf-pdf-pagination-sandbox';
    // Hidden only for MEASUREMENT. These nodes are moved out of this sandbox
    // into a visible render stage before html2canvas is called.
    sandbox.style.cssText=`position:absolute;left:-100000px;top:0;width:${sourcePage.scrollWidth}px;visibility:hidden;pointer-events:none;z-index:-1;`;
    host.appendChild(sandbox);

    const rows=[...tbody.rows].map(r=>r.cloneNode(true));
    const result=[];
    let cursor=0,first=true;

    function makeShell(isFirst){
      const clone=normalizePdfClone(sourcePage.cloneNode(true),sourcePage);
      const cloneTables=[...clone.querySelectorAll('.pro-table')];
      const cloneTable=cloneTables[0];
      const body=cloneTable.tBodies[0];
      body.innerHTML='';

      if(!isFirst){
        const wrap=cloneTable.closest('.pro-table-wrap');
        const head=clone.querySelector('.pro-head');
        const meta=clone.querySelector('.pro-meta');
        const footer=clone.querySelector('.pro-footer');
        [...clone.children].forEach(ch=>{
          if(ch===head||ch===meta||ch===wrap||ch===footer)return;
          ch.remove();
        });
        const marker=document.createElement('div');
        marker.className='hf-pdf-continuation-label';
        marker.innerHTML='<b>تابع التقرير</b><span class="hf-pdf-page-counter"></span>';
        clone.insertBefore(marker,wrap);
      }

      sandbox.appendChild(clone);
      return {clone,body};
    }

    while(cursor<rows.length){
      const shell=makeShell(first);
      let added=0;
      while(cursor<rows.length){
        const row=rows[cursor].cloneNode(true);
        shell.body.appendChild(row);
        const tooTall=shell.clone.scrollHeight>maxPageHeight;
        if(tooTall&&added>0){
          row.remove();
          break;
        }
        cursor++;
        added++;
        if(tooTall)break;
      }
      result.push(shell.clone);
      first=false;
    }

    result.forEach((page,i)=>{
      const counter=page.querySelector('.hf-pdf-page-counter');
      if(counter)counter.textContent=`صفحة ${i+1} من ${result.length}`;
    });
    return {pages:result,cleanup:()=>sandbox.remove(),applied:true};
  }

  function createPdfProgressOverlay(){
    const old=document.querySelector('.hf-pdf-progress');
    if(old)old.remove();
    const el=document.createElement('div');
    el.className='hf-pdf-progress';
    el.innerHTML='<div><b>جاري إنشاء ملف PDF</b><span>يتم ترتيب الصفوف والتحقق من جودة الصفحات…</span></div>';
    const root=document.getElementById('reportPreviewDlg')||document.body;
    root.appendChild(el);
    return el;
  }

  function createPdfRenderStage(paper,width){
    const old=paper.querySelector('.hf-pdf-render-stage');
    if(old)old.remove();
    const stage=document.createElement('div');
    stage.className='hf-pdf-render-stage';
    stage.style.width=Math.max(1,width)+'px';
    paper.appendChild(stage);
    return stage;
  }

  async function waitForPdfPaint(){
    try{if(document.fonts?.ready)await document.fonts.ready}catch(_e){}
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  }

  const PDF_TARGET_DPI=300;
  const PDF_CSS_DPI=96;
  const PDF_PRINT_SCALE=PDF_TARGET_DPI/PDF_CSS_DPI;
  const PDF_NATIVE_TILE_MAX_PIXELS=1_500_000;
  const PDF_WEB_TILE_MAX_PIXELS=3_000_000;

  function pdfIsNative(){
    try{return typeof isNativeHalaqati==='function'&&isNativeHalaqati()}catch(_e){return false}
  }

  function pdfTilePixelBudget(){
    const memory=Number(navigator.deviceMemory||0);
    if(pdfIsNative()){
      if(memory>0&&memory<=3)return 900_000;
      if(memory>0&&memory<=4)return 1_150_000;
      return PDF_NATIVE_TILE_MAX_PIXELS;
    }
    if(memory>0&&memory<=4)return 1_800_000;
    return PDF_WEB_TILE_MAX_PIXELS;
  }

  async function yieldPdfThread(){
    // Give Android WebView a chance to release the previous canvas/PNG buffers
    // before allocating the next 300-DPI tile.
    await new Promise(r=>setTimeout(r,0));
  }

  function bytesChunkToBase64(bytes){
    let binary='';
    const step=0x6000;
    for(let i=0;i<bytes.length;i+=step)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+step)));
    return btoa(binary);
  }

  async function canvasToPngBytes(canvas){
    const blob=await new Promise((resolve,reject)=>{
      try{canvas.toBlob(b=>b?resolve(b):reject(new Error('تعذر ترميز صفحة PDF بصيغة PNG')),'image/png')}
      catch(e){reject(e)}
    });
    const buffer=await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function savePdfNativeChunked(pdf,name,progress){
    if(!pdfIsNative())return false;
    const buffer=pdf.output('arraybuffer');
    if(!buffer||buffer.byteLength<2000)throw new Error('ملف PDF الناتج غير صالح');
    const bytes=new Uint8Array(buffer);
    const nativePdf=window.Capacitor?.Plugins?.HalaqatiPdf;
    if(nativePdf?.saveBase64Pdf){
      try{progress.querySelector('span').textContent='حفظ وضع التوافق مباشرة إلى Downloads/Halaqati…';}catch(_e){}
      let b64='';const chunkSize=192*1024;
      for(let i=0;i<bytes.length;i+=chunkSize){b64+=bytesChunkToBase64(bytes.subarray(i,Math.min(bytes.length,i+chunkSize)));await yieldPdfThread()}
      await nativePdf.saveBase64Pdf({filename:name,base64:b64});
      return true;
    }
    const fs=window.Capacitor?.Plugins?.Filesystem,share=window.Capacitor?.Plugins?.Share;
    if(!fs||!share)return false;
    const path='reports/'+name;
    const chunkSize=192*1024; // divisible by 3 so every base64 chunk decodes independently
    const append=typeof fs.appendFile==='function';
    if(!append){
      // Older bridge fallback. Still avoids FileReader/data-URL duplication.
      let b64='';
      for(let i=0;i<bytes.length;i+=chunkSize){b64+=bytesChunkToBase64(bytes.subarray(i,Math.min(bytes.length,i+chunkSize)));await yieldPdfThread()}
      await fs.writeFile({path,data:b64,directory:'CACHE',recursive:true});
    }else{
      for(let i=0,part=0;i<bytes.length;i+=chunkSize,part++){
        const data=bytesChunkToBase64(bytes.subarray(i,Math.min(bytes.length,i+chunkSize)));
        if(part===0)await fs.writeFile({path,data,directory:'CACHE',recursive:true});
        else await fs.appendFile({path,data,directory:'CACHE'});
        try{progress.querySelector('span').textContent=`حفظ ملف PDF · ${Math.min(100,Math.round((i+chunkSize)/bytes.length*100))}%`;}catch(_e){}
        await yieldPdfThread();
      }
    }
    const uri=await fs.getUri({path,directory:'CACHE'});
    await share.share({title:name,text:'تقرير من تطبيق حلقتي',url:uri.uri,dialogTitle:'حفظ أو مشاركة التقرير'});
    return true;
  }

  window.HalaqatiPdfMemory={
    version:'2.40.2',
    targetDpi:PDF_TARGET_DPI,
    canvasToPngBytes,
    savePdfNativeChunked,
    yield:yieldPdfThread
  };

  function collectSafeCssCuts(element){
    try{
      const root=element.getBoundingClientRect();
      const nodes=[...element.querySelectorAll('.pro-head,.pro-meta,.pro-kpis,.student-report-card,.pro-section-title,.pro-table tr,.pro-footer')];
      const cuts=nodes.map(n=>Math.round(n.getBoundingClientRect().bottom-root.top)).filter(y=>y>0&&y<element.scrollHeight);
      return [...new Set(cuts)].sort((a,b)=>a-b);
    }catch(_e){return []}
  }

  function pickSafeSegmentBottom(cuts,top,maxBottom,totalHeight){
    if(maxBottom>=totalHeight)return totalHeight;
    const minAdvance=top+Math.max(80,Math.floor((maxBottom-top)*.45));
    const candidates=cuts.filter(y=>y>minAdvance&&y<=maxBottom);
    return candidates.length?candidates[candidates.length-1]:maxBottom;
  }

  async function preparePdfElement(element,stage){
    stage.replaceChildren(element);
    element.style.visibility='visible';
    element.style.opacity='1';
    element.style.display='block';
    element.style.transform='none';
    applyAutoFitPdfTables(element);
    stage.style.width=Math.max(1,element.clientWidth||element.scrollWidth)+'px';
    await waitForPdfPaint();
    shrinkPdfNameCells(element);
    return {width:Math.max(1,element.clientWidth||element.scrollWidth),height:Math.max(1,element.scrollHeight)};
  }

  async function renderPdfTile(element,metrics,topCss,heightCss,scale){
    const opts={
      scale,useCORS:true,backgroundColor:'#ffffff',logging:false,
      windowWidth:Math.max(800,metrics.width),windowHeight:Math.max(600,metrics.height),
      width:metrics.width,height:Math.max(1,heightCss),x:0,y:Math.max(0,topCss),
      scrollX:0,scrollY:0,removeContainer:true
    };
    let canvas=null,error=null;
    try{canvas=await html2canvas(element,opts)}catch(e){error=e}
    if(!canvas||canvas.width<10||canvas.height<10){
      if(canvas){canvas.width=1;canvas.height=1}
      throw new Error('تعذر رسم جزء من التقرير: '+(error?.message||'فشل html2canvas'));
    }
    return canvas;
  }

  async function addPdfSegmentTiled(pdf,element,metrics,range,box,searchItems,aliasPrefix,progressLabel){
    const {top,bottom,pageX,pageY,pageW,pageH}=range;
    const sourceHeight=Math.max(1,bottom-top);
    const rasterWidth=Math.max(1,Math.ceil(metrics.width*PDF_PRINT_SCALE));
    const maxPixels=pdfTilePixelBudget();
    const maxRasterHeight=Math.max(96,Math.floor(maxPixels/rasterWidth));
    const tileCssHeight=Math.max(48,Math.floor(maxRasterHeight/PDF_PRINT_SCALE));
    const tileCount=Math.max(1,Math.ceil(sourceHeight/tileCssHeight));
    let tileTop=top,tileIndex=0;
    while(tileTop<bottom-0.1){
      const hCss=Math.min(tileCssHeight,bottom-tileTop);
      try{progressLabel?.(tileIndex+1,tileCount)}catch(_e){}
      const canvas=await renderPdfTile(element,metrics,tileTop,hCss,PDF_PRINT_SCALE);
      let pngBytes=null;
      try{
        pngBytes=await canvasToPngBytes(canvas);
        const rel=(tileTop-top)/sourceHeight;
        const relH=hCss/sourceHeight;
        const y=pageY+rel*pageH;
        const h=Math.min(pageH-(y-pageY)+0.02,relH*pageH+0.02);
        pdf.addImage(pngBytes,'PNG',pageX,y,pageW,h,`${aliasPrefix}-${tileIndex}`,PDF_PNG_COMPRESSION);
      }finally{
        pngBytes=null;
        canvas.width=1;canvas.height=1;
      }
      tileTop+=hCss;
      tileIndex++;
      await yieldPdfThread();
    }
    addSearchablePdfTextLayer(pdf,searchItems,{pageX,pageY,pageW,pageH,sourceWidth:metrics.width,sourceTop:top,sourceHeight});
  }

  async function addElementMemorySafePages(pdf,element,stage,orientation,boxW,boxH,margin,pageState,rowSafeApplied,progress,sectionIndex,sectionCount){
    const metrics=await preparePdfElement(element,stage);
    const searchItems=collectSearchablePdfTextItems(element);
    const cuts=collectSafeCssCuts(element);
    const maxCssPageHeight=Math.max(1,Math.floor(metrics.width*(boxH/boxW)));
    const ranges=[];
    if(rowSafeApplied){
      ranges.push({top:0,bottom:metrics.height,fit:true});
    }else{
      let top=0;
      while(top<metrics.height-0.1){
        const maxBottom=Math.min(metrics.height,top+maxCssPageHeight);
        const bottom=pickSafeSegmentBottom(cuts,top,maxBottom,metrics.height);
        ranges.push({top,bottom,fit:false});
        top=Math.max(bottom,top+1);
      }
    }
    for(let i=0;i<ranges.length;i++){
      const r=ranges[i],sourceH=Math.max(1,r.bottom-r.top),rawH=sourceH*boxW/metrics.width;
      const fit=r.fit?Math.min(1,boxH/rawH):1;
      const pageW=boxW*fit,pageH=Math.min(boxH,rawH*fit),pageX=margin+(boxW-pageW)/2,pageY=margin;
      if(pageState.count++)pdf.addPage('a4',orientation);
      await addPdfSegmentTiled(pdf,element,metrics,{top:r.top,bottom:r.bottom,pageX,pageY,pageW,pageH},{boxW,boxH},searchItems,`hf-${sectionIndex}-${pageState.count}`, (tile,tileCount)=>{
        try{progress.querySelector('span').textContent=`القسم ${sectionIndex+1} من ${sectionCount} · الصفحة ${i+1} من ${ranges.length} · الجزء ${tile} من ${tileCount} · 300 DPI`;}catch(_e){}
      });
    }
    stage.replaceChildren();
  }

  function canvasLooksBlank(canvas){
    if(!canvas||canvas.width<10||canvas.height<10)return true;
    // Probe a tiny downscaled copy instead of allocating a full-size ImageData
    // buffer. This keeps the blank-output safety check cheap on low-memory phones.
    try{
      const probe=document.createElement('canvas');probe.width=96;probe.height=96;
      const pctx=probe.getContext('2d',{alpha:false,willReadFrequently:true});
      pctx.fillStyle='#fff';pctx.fillRect(0,0,96,96);pctx.drawImage(canvas,0,0,96,96);
      const data=pctx.getImageData(0,0,96,96).data;
      let ink=0;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        if(a>20&&(r<242||g<242||b<242)){ink++;if(ink>=12)return false}
      }
      return true;
    }catch(_e){return false}
  }

  async function renderPdfElement(element,stage,scale){
    stage.replaceChildren(element);
    element.style.visibility='visible';
    element.style.opacity='1';
    element.style.display='block';
    element.style.transform='none';
    // Refit inside the final render stage. This is critical because cloned tables
    // can otherwise keep a stale max-content width and html2canvas clips the left columns in RTL.
    applyAutoFitPdfTables(element);
    stage.style.width=Math.max(1,element.clientWidth||element.scrollWidth)+'px';
    await waitForPdfPaint();
    shrinkPdfNameCells(element);
    const renderWidth=Math.max(1,element.clientWidth||element.scrollWidth);
    const opts={scale,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:Math.max(800,renderWidth),windowHeight:Math.max(600,element.scrollHeight),width:renderWidth,height:Math.max(1,element.scrollHeight),scrollX:0,scrollY:0};
    let canvas=null,firstError=null;
    try{canvas=await html2canvas(element,opts)}catch(e){firstError=e}
    if(!canvas||canvasLooksBlank(canvas)){
      if(canvas){canvas.width=1;canvas.height=1}
      await waitForPdfPaint();
      try{canvas=await html2canvas(element,{...opts,scale})}
      catch(e){throw new Error('تعذر رسم صفحة التقرير: '+(e?.message||firstError?.message||e))}
    }
    if(canvasLooksBlank(canvas)){
      canvas.width=1;canvas.height=1;
      throw new Error('فشل رسم محتوى التقرير. لم يتم حفظ ملف فارغ. حاول مرة أخرى.');
    }
    return canvas;
  }

  function collectSafeCanvasCuts(element,canvas){
    try{
      const root=element.getBoundingClientRect(),scaleY=canvas.height/Math.max(1,root.height);
      const nodes=[...element.querySelectorAll('.pro-head,.pro-meta,.pro-kpis,.student-report-card,.pro-section-title,.pro-table tr,.pro-footer')];
      const cuts=nodes.map(n=>Math.round((n.getBoundingClientRect().bottom-root.top)*scaleY)).filter(y=>y>0&&y<canvas.height);
      return [...new Set(cuts)].sort((a,b)=>a-b);
    }catch(_e){return []}
  }

  let searchablePdfFontPromise=null;
  function bytesToBase64(bytes){
    let binary='';
    const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));
    return btoa(binary);
  }

  async function ensureSearchablePdfFont(pdf){
    if(!searchablePdfFontPromise){
      searchablePdfFontPromise=(async()=>{
        const r=await fetch('./core/fonts/amiri-search.ttf',{cache:'force-cache'});
        if(!r.ok)throw new Error('تعذر تحميل خط طبقة البحث داخل PDF');
        const bytes=new Uint8Array(await r.arrayBuffer());
        if(bytes.length<50000)throw new Error('ملف خط البحث داخل PDF غير صالح');
        return bytesToBase64(bytes);
      })();
    }
    const b64=await searchablePdfFontPromise;
    const file='HalaqatiSearch-Amiri.ttf',family='HalaqatiSearch';
    try{pdf.addFileToVFS(file,b64)}catch(_e){}
    try{pdf.addFont(file,family,'normal')}catch(_e){}
    pdf.setFont(family,'normal');
    return family;
  }

  function normalizeSearchablePdfText(text){
    return String(text??'').replace(/[\u200e\u200f\ufeff]/g,'').replace(/\s+/g,' ').trim();
  }

  function collectSearchablePdfTextItems(element){
    try{
      const root=element.getBoundingClientRect();
      const items=[],seen=new Set();
      const add=(el,raw)=>{
        const text=normalizeSearchablePdfText(raw);
        if(!text)return;
        const style=getComputedStyle(el);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity||1)===0)return;
        const rect=el.getBoundingClientRect();
        if(rect.width<1||rect.height<1)return;
        const left=rect.left-root.left,top=rect.top-root.top;
        if(left+rect.width<0||top+rect.height<0||left>root.width||top>root.height)return;
        const key=[text,Math.round(left),Math.round(top),Math.round(rect.width),Math.round(rect.height)].join('|');
        if(seen.has(key))return;seen.add(key);
        const rtl=style.direction==='rtl'||/[\u0590-\u08ff]/.test(text);
        items.push({text,left,top,width:rect.width,height:rect.height,fontPx:Math.max(7,parseFloat(style.fontSize)||11),rtl});
      };
      // Table cells are deliberately captured as whole strings so a student's full
      // name stays one searchable PDF text object even when it wraps visually.
      const cells=[...element.querySelectorAll('th,td')];
      cells.forEach(el=>add(el,el.textContent));
      const leafSelector='.pro-head *,.pro-meta *,.pro-kpis *,.pro-section-title,.student-report-card *,.pro-footer *,.hf-pdf-continuation-label *';
      [...element.querySelectorAll(leafSelector)].forEach(el=>{
        if(el.closest('th,td'))return;
        if(el.children.length===0)add(el,el.textContent);
      });
      if(!items.length&&element.children.length===0)add(element,element.textContent);
      return items;
    }catch(_e){return []}
  }

  function addSearchablePdfTextLayer(pdf,items,map){
    if(!items?.length)return 0;
    const {pageX,pageY,pageW,pageH,sourceWidth,sourceTop=0,sourceHeight}=map;
    if(!(pageW>0&&pageH>0&&sourceWidth>0&&sourceHeight>0))return 0;
    const sourceBottom=sourceTop+sourceHeight;
    let count=0;
    pdf.setFont('HalaqatiSearch','normal');
    for(const item of items){
      const centerY=item.top+item.height/2;
      if(centerY<sourceTop||centerY>=sourceBottom)continue;
      const relTop=item.top-sourceTop;
      const mmPerPx=pageW/sourceWidth;
      const fontPt=Math.max(4,Math.min(30,item.fontPx*mmPerPx*(72/25.4)));
      const baselinePx=relTop+Math.min(item.height*.78,item.fontPx*1.05);
      const y=pageY+(baselinePx/sourceHeight)*pageH;
      let x,align;
      if(item.rtl){x=pageX+((item.left+item.width)/sourceWidth)*pageW;align='right'}
      else{x=pageX+(item.left/sourceWidth)*pageW;align='left'}
      try{
        pdf.setFontSize(fontPt);
        // Rendering mode 3 = invisible: the exact raster design remains untouched,
        // while the Unicode text stays searchable/selectable/copyable in the PDF.
        pdf.text(item.text,x,y,{align,renderingMode:'invisible',baseline:'alphabetic'});
        count++;
      }catch(e){console.warn('searchable PDF text item skipped',e)}
    }
    return count;
  }

  async function addCanvasSlicePages(pdf,canvas,orientation,boxW,boxH,margin,stateObj,safeCuts=[],searchItems=[],sourceMetrics=null){
    const sliceHeight=Math.max(1,Math.floor(canvas.width*(boxH/boxW)));
    const sourceWidth=Math.max(1,sourceMetrics?.width||canvas.width);
    const sourceHeight=Math.max(1,sourceMetrics?.height||canvas.height);
    const canvasToSourceY=sourceHeight/Math.max(1,canvas.height);
    let top=0;
    while(top<canvas.height){
      let bottom=Math.min(canvas.height,top+sliceHeight);
      if(bottom<canvas.height&&safeCuts.length){
        const minAdvance=top+Math.floor(sliceHeight*.45);
        const candidates=safeCuts.filter(y=>y>minAdvance&&y<=bottom);
        if(candidates.length)bottom=candidates[candidates.length-1];
      }
      if(bottom<=top)bottom=Math.min(canvas.height,top+sliceHeight);
      const h=bottom-top,crop=document.createElement('canvas');
      crop.width=canvas.width;crop.height=h;
      const ctx=crop.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,crop.width,crop.height);ctx.drawImage(canvas,0,top,canvas.width,h,0,0,canvas.width,h);
      if(stateObj.count++)pdf.addPage('a4',orientation);
      const img=crop.toDataURL('image/png'),outH=h*boxW/canvas.width;
      pdf.addImage(img,'PNG',margin,margin,boxW,outH,undefined,PDF_PNG_COMPRESSION);
      addSearchablePdfTextLayer(pdf,searchItems,{pageX:margin,pageY:margin,pageW:boxW,pageH:outH,sourceWidth,sourceTop:top*canvasToSourceY,sourceHeight:h*canvasToSourceY});
      crop.width=1;crop.height=1;
      top=bottom;
    }
  }

  window.downloadReportPdfFromPreview=async function(){
    const paper=document.getElementById('reportPreviewPaper');
    applyAutoFitPdfTables(paper);
    let oldTransform='',stage=null,progress=null;
    try{
      if(!window.jspdf?.jsPDF) throw new Error('مكتبة PDF غير متاحة');
      if(!window.html2canvas) throw new Error('مكتبة المعاينة غير متاحة');
      if(!paper||!paper.innerHTML.trim()) throw new Error('افتح المعاينة أولاً');
      const orientation=document.getElementById('hfOrientation')?.value||'landscape';
      const {jsPDF}=window.jspdf;
      // Keep the PDF visually lossless. Stream compression is disabled here because
      // it increases transient memory on Android without improving raster quality.
      const pdf=new jsPDF({orientation,unit:'mm',format:'a4',compress:false,putOnlyUsedFonts:true});
      await ensureSearchablePdfFont(pdf);
      const pw=orientation==='landscape'?297:210,ph=orientation==='landscape'?210:297,margin=7;
      const boxW=pw-margin*2,boxH=ph-margin*2;
      const sourcePages=[...paper.querySelectorAll('.pro-report-page')];
      if(!sourcePages.length)sourcePages.push(paper);
      const pageState={count:0};
      oldTransform=paper.style.transform;paper.style.transform='none';
      progress=createPdfProgressOverlay();
      stage=createPdfRenderStage(paper,sourcePages[0]?.scrollWidth||paper.scrollWidth);

      for(let sourceIndex=0;sourceIndex<sourcePages.length;sourceIndex++){
        const sourcePage=sourcePages[sourceIndex];
        try{progress.querySelector('span').textContent=`تجهيز القسم ${sourceIndex+1} من ${sourcePages.length} · 300 DPI · وضع آمن للذاكرة`;}catch(_e){}
        const maxPageHeight=Math.max(1,Math.floor(sourcePage.scrollWidth*(boxH/boxW)));
        const rowSafe=buildRowSafePdfPages(sourcePage,maxPageHeight);
        try{
          for(const renderPage of rowSafe.pages){
            await addElementMemorySafePages(pdf,renderPage,stage,orientation,boxW,boxH,margin,pageState,rowSafe.applied,progress,sourceIndex,sourcePages.length);
          }
        }finally{rowSafe.cleanup()}
      }

      if(pageState.count===0)throw new Error('لم يتم إنشاء أي صفحة PDF.');
      const stem=previewContext==='students'?'بيانات_طلاب_حلقتي':`تقرير_حلقتي_${reportFileStamp()}`;
      const name=`${stem}_${today()}.pdf`.replace(/__+/g,'_');
      try{progress.querySelector('span').textContent='إنهاء ملف PDF وحفظه…';}catch(_e){}
      const nativeSaved=await savePdfNativeChunked(pdf,name,progress);
      if(!nativeSaved)pdf.save(name);
      (window.HalaqatiPdfUiNotify||say)('تم إنشاء PDF عربي عالي الجودة في وضع التوافق · 300 DPI · قابل للبحث والتحديد والنسخ');
      return {saved:true,filename:name,engine:nativeSaved?'compatibility-300dpi-direct-native':'compatibility-300dpi-browser'};
    }catch(e){
      console.error('Halaqati preview PDF error',e);
      if(window.HalaqatiPdfUiNotify)window.HalaqatiPdfUiNotify('تعذر إنشاء PDF: '+(e?.message||e),'error');else say('تعذر إنشاء PDF: '+(e?.message||e));
      return {saved:false,error:String(e?.message||e)};
    }
    finally{
      try{stage?.replaceChildren()}catch(_e){}
      try{stage?.remove()}catch(_e){}
      try{progress?.remove()}catch(_e){}
      if(paper)paper.style.transform=oldTransform;
      await yieldPdfThread();
    }
  };

  /* Clicking PDF now opens the built-in preview, never the system print dialog. */
  window.exportCurrentReportPdf=window.openReportPreview;

  const originalReportsPage=window.reportsPage;
  if(typeof originalReportsPage==='function'){
    window.reportsPage=function(){
      let html=originalReportsPage();
      html=html.replace(/onclick="exportCurrentReportPdf\(\)"/g,'onclick="openReportPreview()"');
      html=html.replace(/🖨️ PDF/g,'👁️ معاينة PDF');
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
