/* RC24 metadata-only archive, using the same contracts as the native application. */
(function () {
  'use strict';
  const text = v => String(v ?? '');
  const type = d => d.type === 'sard' ? 'sard' : ['hifz','khatam'].includes(d.type) ? 'hifz' : 'achievement';
  const series = d => ({sard:'sard',hifz:'khatm',khatam:'khatm',monthly:'monthly',ideal:'ideal',rank:'rank'}[d.type]||'general');
  function snapshot(d, s) {
    const style = {};
    for (const k of ['fontFamily','primary','secondary','accent','paper','ink','titleSize','studentSize','bodySize','logoSize','borderWidth','ornamentOpacity','showVerse','showDates','showSignatures','numberPosition']) {
      const v=d.style?.[k];if(['string','number','boolean'].includes(typeof v)&&!/^data:|https?:|blob:/i.test(String(v)))style[k]=v;
    }
    const nativeKeys={fontFamily:'font_family',primary:'primary_hex',secondary:'secondary_hex',accent:'accent_hex',paper:'paper_hex',ink:'ink_hex',titleSize:'title_size',studentSize:'student_size',bodySize:'body_size',logoSize:'logo_size',borderWidth:'border_width',showVerse:'show_verse',showDates:'show_date',showSignatures:'show_signatures'};
    const nativeStyle={template:d.template||'emerald',ornament_strength:Number(style.ornamentOpacity??82)/100,number_position:({'bottom-right':'footer_start','bottom-left':'footer_end','under-logo':'under_logo'}[style.numberPosition]||style.numberPosition||'under_logo'),show_number:d.style?.showNumber!==false,show_logos:d.style?.showLogos!==false,show_stamp:d.style?.showStamp!==false};
    for(const [k,v] of Object.entries(style))if(nativeKeys[k])nativeStyle[nativeKeys[k]]=v;
    return {schema:'halaqati_certificate_render_v2',student_id:d.studentId,student_name:d.studentName,
      center_name:s.centerName,halaqa_name:s.halaqaName,certificate_type:type(d),series_key:series(d),
      title:d.title,intro:text(d.intro),achievement:d.achievement,dua:text(d.dua),issue_date:d.date,
      official_number:d.serverRecord?.certificate_number || '',teacher_name:text(s.teacher),supervisor_name:text(s.supervisor),
      style:nativeStyle,asset_refs:{policy:'local_only'},source:{web_type:d.type,template:d.template||'emerald'},renderer_version:'rc24-web-1'};
  }
  function confirmed(r) {
    if(r.error)throw new Error(r.error.message || String(r.error));
    const row=Array.isArray(r.data)?r.data[0]:r.data;
    if(!row?.id)throw new Error('لم يرجع الخادم تأكيد الشهادة؛ تحقق من الصلاحيات وتحديث قاعدة البيانات');
    return row;
  }
  function validate(d,s) {
    if(!d.serverId||!d.studentId||!d.studentName?.trim()||!d.title?.trim()||!d.achievement?.trim()||!s.centerName?.trim()||!s.halaqaName?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(d.date))throw new Error('أكمل الطالب والمركز والحلقة ونص الشهادة وتاريخها');
  }
  async function issue(db,d,s,userId) {
    validate(d,s);
    if(d.serverRecord?.status==='issued')return d.serverRecord;
    const snap=snapshot(d,s);
    // DO NOTHING on retries: never reset an already issued record to draft.
    const r=await db.from('certificates').upsert({id:d.serverId,student_id:d.studentId,halaqa_id:d.halaqaId==='all'?null:d.halaqaId||null,
      certificate_type:type(d),title:d.title,status:'draft',issue_date:d.date,series_key:series(d),created_by:userId,
      snapshot:{schema:'halaqati_certificate_archive_lite_v2',student_name:d.studentName,storage_policy:'metadata_only_no_pdf_no_assets'}},
      {onConflict:'id',ignoreDuplicates:true});
    if(r.error)throw new Error(r.error.message || String(r.error));
    const row=confirmed(await db.rpc('rc24_issue_certificate',{p_certificate_id:d.serverId,p_series_key:series(d),p_issue_date:d.date,p_render_snapshot:snap}));
    if(!row.certificate_number)throw new Error('لم يرجع الخادم رقمًا رسميًا للشهادة');
    if(!row.render_snapshot){const history=await revisions(db,row.id);const rev=history.find(x=>x.id===row.current_revision_id)||history[0];if(!rev?.render_snapshot)throw new Error('تعذر تحميل النسخة الرسمية؛ حدّث الأرشيف قبل الطباعة');row.render_snapshot=rev.render_snapshot;}
    return row;
  }
  async function revise(db,record,d,s,note) {
    if(record.student_id!==d.studentId||record.series_key!==series(d)||String(record.issue_date).slice(0,4)!==d.date.slice(0,4))throw new Error('لا يمكن تغيير هوية الطالب أو سلسلة الشهادة أو سنة الإصدار في نسخة مصححة');
    validate(d,s);
    return confirmed(await db.rpc('rc24_create_certificate_revision',{p_certificate_id:record.id,p_render_snapshot:snapshot(d,s),p_note:note||null}));
  }
  async function voidCertificate(db,id,reason) {
    if(!reason?.trim())throw new Error('اكتب سبب إلغاء الشهادة');
    return confirmed(await db.rpc('rc24_void_certificate',{p_certificate_id:id,p_reason:reason.trim()}));
  }
  async function all(makeQuery,identity) {
    const user=identity?.(),rows=[];let from=0;
    for(;;){const r=await makeQuery().range(from,from+499);if(identity&&identity()!==user)throw new Error('تغير الحساب أثناء تحميل البيانات');if(r.error)throw new Error(r.error.message||String(r.error));const page=r.data||[];if(!page.length)return rows;rows.push(...page);from+=page.length;}
  }
  const list=db=>all(()=>db.from('certificates').select('*').order('created_at',{ascending:false}).order('id'));
  const revisions=(db,id)=>all(()=>db.from('certificate_revisions').select('*').eq('certificate_id',id).order('revision_no',{ascending:false}).order('id'));
  async function importLegacy(db,d,s,number) {
    validate(d,s);
    return confirmed(await db.rpc('rc24_import_legacy_certificate',{p_student_id:d.studentId,p_halaqa_id:d.halaqaId==='all'?null:d.halaqaId||null,
      p_certificate_type:type(d),p_series_key:series(d),p_issue_date:d.date,p_historical_number:number,p_render_snapshot:{...snapshot(d,s),official_number:number}}));
  }
  async function rankingData(db,ids,bounds,halaqaId,identity){
    const recs=[],bonus=[];
    for(let i=0;i<ids.length;i+=180){
      const selected=ids.slice(i,i+180);
      recs.push(...await all(()=>{let q=db.from('recitation_entries').select('id,student_id,pages_count,points,mistakes,prompts,activity_type,sessions!inner(session_date,halaqa_id,status)').in('student_id',selected).gte('sessions.session_date',bounds.from).lte('sessions.session_date',bounds.to).neq('sessions.status','cancelled').order('id');if(halaqaId!=='all')q=q.eq('sessions.halaqa_id',halaqaId);return q},identity));
      bonus.push(...await all(()=>db.from('student_points').select('id,student_id,points,awarded_at').in('student_id',selected).gte('awarded_at',bounds.from).lte('awarded_at',bounds.to+'T23:59:59.999').order('id'),identity));
    }
    return {recs,bonus};
  }
  function serializableDraft(d){const {_issuing,...safe}=d;return JSON.parse(JSON.stringify(safe))}
  function restore(snap,base,record){
    const ns=snap.style||{},style={...base.style},map={font_family:'fontFamily',primary_hex:'primary',secondary_hex:'secondary',accent_hex:'accent',paper_hex:'paper',ink_hex:'ink',title_size:'titleSize',student_size:'studentSize',body_size:'bodySize',logo_size:'logoSize',border_width:'borderWidth',show_verse:'showVerse',show_date:'showDates',show_signatures:'showSignatures',show_number:'showNumber',show_logos:'showLogos',show_stamp:'showStamp'};
    for(const [k,v] of Object.entries(ns)){const key=map[k]||k;if((key in style||map[k])&&v!==''&&v!=null)style[key]=v}
    if(ns.ornament_strength!=null)style.ornamentOpacity=Number(ns.ornament_strength)*100;
    style.numberPosition=({under_logo:'under-logo',footer_start:'bottom-right',footer_end:'bottom-left',header:'top'}[ns.number_position]||ns.number_position||style.numberPosition||'under-logo');
    const webType=snap.source?.web_type||(['monthly','ideal','rank'].includes(record.series_key)?record.series_key:({hifz:'khatam',sard:'sard'}[snap.certificate_type]||'monthly'));
    return {...base,style,type:webType,studentId:record.student_id,studentName:snap.student_name,halaqaId:record.halaqa_id,date:snap.issue_date,title:snap.title,intro:snap.intro,achievement:snap.achievement,dua:snap.dua,certificateNumber:record.certificate_number,template:ns.template||snap.source?.template||'emerald',manualTitle:true,manualIntro:true,manualAchievement:true,manualDua:true,serverId:record.id,serverRecord:record,snapshotSettings:{centerName:snap.center_name,halaqaName:snap.halaqa_name,teacher:snap.teacher_name,supervisor:snap.supervisor_name}};
  }
  const get=async(db,id)=>confirmed(await db.from('certificates').select('*').eq('id',id).single());
  window.HalaqatiCertificateServer={rankingData,get,restore,serializableDraft,snapshot,issue,revise,void:voidCertificate,list,revisions,importLegacy,series};
})();
