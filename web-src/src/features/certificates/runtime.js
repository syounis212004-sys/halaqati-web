/* Halaqati v2.41.2 — Certificate date/number layout + refined Islamic geometry */
(function(){
  'use strict';
  const VERSION='2.63.39-web.1-rc24-archive';
  const STORAGE_VERSION=3;
  const CERT_KEY_PREFIX='halaqati_v241_certificates_';
  const DEFAULT_CENTER='مركز إبراهيم خليل الرحمن لتحفيظ القرآن الكريم';
  const DEFAULT_HALAQA='حلقة معاوية بن أبي سفيان';
  const DEFAULT_TEACHER='د. محمد سمير أبو يونس';
  const DEFAULT_SUPERVISOR='الشيخ المحفظ محمد حلمي أبو عنزة';
  const DEFAULT_LOGO_CENTER='./assets/certificates/center-logo.jpg';
  const DEFAULT_LOGO_HALAQA='./assets/certificates/halaqa-logo.jpg';
  const TYPES={
    sard:{label:'إتمام سرد جزء / أجزاء',title:'إتمام سرد أجزاء من القرآن الكريم'},
    khatam:{label:'ختم القرآن الكريم',title:'ختم القرآن الكريم'},
    monthly:{label:'التميز الشهري',title:'شهادة التميز الشهري'},
    ideal:{label:'الطالب المثالي',title:'شهادة الطالب المثالي'},
    rank:{label:'المراكز الأولى',title:'شهادة تفوق وتميز'},
    tajweed:{label:'شهادة تجويد',title:'شهادة إتمام برنامج التجويد'},
    excellence:{label:'شهادة تميز',title:'شهادة تميز في البرنامج'}
  };
  const TEMPLATES={
    emerald:{label:'الرسمي الفيروزي',primary:'#0b5f5b',secondary:'#8a4d22',accent:'#b9954a',paper:'#fbf7eb',ink:'#18211e',ornament:1},
    royal:{label:'الملكي الأخضر',primary:'#174936',secondary:'#6f4523',accent:'#c5a350',paper:'#fffaf0',ink:'#17231e',ornament:1.18},
    gold:{label:'الذهبي الفاخر',primary:'#53421d',secondary:'#7b4a22',accent:'#c89d3d',paper:'#fffaf2',ink:'#241f17',ornament:1.12},
    blue:{label:'الأزرق الرسمي',primary:'#164f63',secondary:'#6b4928',accent:'#b99654',paper:'#f7f6ef',ink:'#172027',ornament:.95},
    minimal:{label:'الكلاسيكي الهادئ',primary:'#263b36',secondary:'#66482f',accent:'#a88a56',paper:'#fffdf8',ink:'#1f2724',ornament:.58}
  };
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const AR_NUM=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون','الخامس والعشرون','السادس والعشرون','السابع والعشرون','الثامن والعشرون','التاسع والعشرون','الثلاثون'];
  const stateLocal={tab:'issue',draft:null,archiveSearch:'',ranking:null,batch:new Set(),busy:false,previewZoom:92};

  function scopeKey(suffix){return CERT_KEY_PREFIX+String(state.user?.id||'guest')+'_'+suffix}
  function read(key,fallback){try{const v=localStorage.getItem(scopeKey(key));return v?JSON.parse(v):fallback}catch(_e){return fallback}}
  function write(key,value){try{localStorage.setItem(scopeKey(key),JSON.stringify(value));return true}catch(e){console.warn('certificate local storage failed',e);return false}}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function digits(v){return String(v??'').replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])}
  function ymNow(){return today().slice(0,7)}
  function currentSettings(){
    const base={version:STORAGE_VERSION,teacher:DEFAULT_TEACHER,supervisor:DEFAULT_SUPERVISOR,centerName:DEFAULT_CENTER,halaqaName:DEFAULT_HALAQA,centerLogo:DEFAULT_LOGO_CENTER,halaqaLogo:DEFAULT_LOGO_HALAQA,teacherSignature:'',supervisorSignature:'',stampImage:'',defaultTemplate:'emerald',fontFamily:'Cairo',customFont:'',primary:'#0b5f5b',secondary:'#8a4d22',accent:'#b9954a',paper:'#fbf7eb',ink:'#18211e',titleSize:44,studentSize:38,bodySize:20,logoSize:168,borderWidth:3,ornamentOpacity:82,showVerse:true,verse:'﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾',showDates:true,showSignatures:true,numberPosition:'under-logo'};
    const saved=read('settings',{})||{};
    // v2.41.2 migration: move legacy number placements away from the central seal/date zone.
    if(Number(saved.version||1)<3&&['under-dates','bottom-left'].includes(saved.numberPosition))saved.numberPosition='under-logo';
    saved.version=STORAGE_VERSION;
    return {...base,...saved};
  }
  function saveSettings(patch){const s={...currentSettings(),...patch,version:STORAGE_VERSION};write('settings',s);return s}
  function archive(){const rows=read('archive',[]);return Array.isArray(rows)?rows:[]}
  function saveArchive(rows){write('archive',rows.slice(0,2500))}
  function numberState(){return read('sequence',{year:new Date().getFullYear(),seq:0})}
  function nextCertificateNumber(peek=false){let s=numberState(),y=new Date().getFullYear();if(Number(s.year)!==y)s={year:y,seq:0};const n=Number(s.seq||0)+1;if(!peek)write('sequence',{year:y,seq:n});return `HAL-CERT-${y}-${String(n).padStart(4,'0')}`}
  function currentDraft(){
    ensureAccount();
    if(stateLocal.draft)return stateLocal.draft;
    const pending=read('pending-official-draft',null);if(pending&&state.students?.some(x=>x.id===pending.studentId)){delete pending._issuing;stateLocal.draft=pending;return pending;}
    const s=currentSettings(),student=activeStudents?.()[0]||state.students?.[0]||null,ym=ymNow();
    stateLocal.draft={type:(typeof window.rc27Scope==='function'&&window.rc27Scope().kind==='program')?'tajweed':'sard',studentId:student?.id||'',studentName:student?.full_name||'اسم الطالب',template:s.defaultTemplate||'emerald',title:TYPES.sard.title,intro:`تتشرف ${s.halaqaName} التابعة لـ${s.centerName} بمنح هذه الشهادة للطالب`,achievement:'',dua:'سائلين الله تعالى أن يثبت القرآن في صدره، وأن يجعله له نورًا وهدًى ورفعةً في الدنيا والآخرة.',fromJuz:28,toJuz:30,month:ym,reason:'',rank:1,track:'general_hifz',categoryId:'all',halaqaId:student?.halaqa_id||state.halaqas?.[0]?.id||'all',periodMode:'month',periodMonth:ym,periodFromMonth:ym,periodToMonth:ym,periodFrom:monthStart(ym),periodTo:monthEnd(ym),manualTitle:false,manualIntro:false,manualAchievement:false,manualDua:false,ethics:100,discipline:100,attendance:100,memorization:100,certificateNumber:'مسودة — الرقم بعد الإصدار',date:today(),customText:'',style:{fontFamily:s.fontFamily||'Cairo',customFont:s.customFont||'',primary:s.primary,secondary:s.secondary,accent:s.accent,paper:s.paper,ink:s.ink,titleSize:s.titleSize,studentSize:s.studentSize,bodySize:s.bodySize,logoSize:s.logoSize,borderWidth:s.borderWidth,ornamentOpacity:s.ornamentOpacity,showVerse:s.showVerse,showDates:s.showDates,showSignatures:s.showSignatures,showNumber:true,showLogos:true,showStamp:true,numberPosition:s.numberPosition}};
    updateDraftText();return stateLocal.draft;
  }
  function studentById(id){return (state.students||[]).find(x=>String(x.id)===String(id))||null}
  function activeStudentRows(){return (typeof activeStudents==='function'?activeStudents():(state.students||[])).filter(x=>x.status!=='withdrawn')}
  function categoryLabel(id){const c=(state.categories||[]).find(x=>String(x.id)===String(id));return c?.name||'جميع الفئات'}
  function trackLabel(t){return t==='tathbit'?'مسار التثبيت':'مسار الحفظ العام'}
  function arabicJuz(n){return AR_NUM[Math.max(1,Math.min(30,Number(n)||1))-1]||String(n)}
  function countWords(n){const words={1:'جزء واحد',2:'جزأين',3:'ثلاثة أجزاء',4:'أربعة أجزاء',5:'خمسة أجزاء',6:'ستة أجزاء',7:'سبعة أجزاء',8:'ثمانية أجزاء',9:'تسعة أجزاء',10:'عشرة أجزاء'};return words[n]||`${n} أجزاء`}
  function idealScore(d){return Math.round(((Number(d.ethics)||0)*.35+(Number(d.discipline)||0)*.30+(Number(d.attendance)||0)*.20+(Number(d.memorization)||0)*.15)*10)/10}
  function dateArabic(date){try{return digits(new Intl.DateTimeFormat('ar-EG-u-nu-latn',{year:'numeric',month:'long',day:'numeric'}).format(new Date(date+'T12:00:00')))+'م'}catch(_e){return date}}
  function hijriArabic(date){try{return digits(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{year:'numeric',month:'long',day:'numeric'}).format(new Date(date+'T12:00:00')))+'هـ'}catch(_e){try{return digits(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-nu-latn',{year:'numeric',month:'long',day:'numeric'}).format(new Date(date+'T12:00:00')))+'هـ'}catch(_e2){return '—'}}}
  function monthLabel(ym){const [y,m]=String(ym||'').split('-').map(Number);return y&&m?`${MONTHS[m-1]} ${y}`:String(ym||'')}
  function updateDraftText(){
    const d=currentDraft(),s=currentSettings(),st=studentById(d.studentId);if(st&&!d.serverRecord)d.studentName=st.full_name;
    if(!d.manualTitle)d.title=TYPES[d.type]?.title||'شهادة تقدير وإنجاز';
    if(!d.manualIntro)d.intro=`تتشرف ${s.halaqaName} التابعة لـ${s.centerName} بمنح هذه الشهادة للطالب`;
    let autoAchievement='';
    if(d.type==='sard'){
      const a=Math.min(Number(d.fromJuz)||1,Number(d.toJuz)||1),b=Math.max(Number(d.fromJuz)||1,Number(d.toJuz)||1),cnt=b-a+1;
      autoAchievement=cnt===1?`تقديرًا لإتمامه بحمد الله سرد الجزء ${arabicJuz(a)} من كتاب الله تعالى`:`تقديرًا لإتمامه بحمد الله سرد ${countWords(cnt)} متتابعة من الجزء ${arabicJuz(a)} إلى الجزء ${arabicJuz(b)} من كتاب الله تعالى`;
    }else if(d.type==='tajweed'){
      autoAchievement=`تقديرًا لإتمامه بحمد الله برنامج التجويد${d.reason?` (${d.reason})`:''}، سائلين الله أن ينفعه بما تعلم ويزيده إتقانًا لتلاوة كتابه.`;
    }else if(d.type==='khatam'){
      autoAchievement='تقديرًا لإتمامه بحمد الله ختم القرآن الكريم كاملًا، سائلين الله أن يجعله من أهل القرآن وخاصته.';
    }else if(d.type==='excellence'){
      autoAchievement=`تقديرًا لتميزه في البرنامج${d.reason?`، وذلك لـ${d.reason}`:''}، سائلين الله له مزيدًا من التوفيق والسداد.`;
    }else if(d.type==='monthly'){
      autoAchievement=`تقديرًا لتميزه خلال شهر ${monthLabel(d.month)}${d.reason?`، وذلك لـ${d.reason}`:''}.`;
    }else if(d.type==='ideal'){
      autoAchievement=`تقديرًا لاختياره الطالب المثالي، بما جمعه من حسن الأخلاق والالتزام والمواظبة والجدية في حفظ كتاب الله. الدرجة التقديرية: ${digits(idealScore(d))}/100.`;
    }else if(d.type==='rank'){
      const periodText=d.periodMode==='month'?`شهر ${monthLabel(d.periodMonth)}`:d.periodMode==='months'?`الفترة من ${monthLabel(d.periodFromMonth)} إلى ${monthLabel(d.periodToMonth)}`:`الفترة من ${d.periodFrom} إلى ${d.periodTo}`;
      autoAchievement=`تقديرًا لحصوله على المركز ${['الأول','الثاني','الثالث'][Math.max(1,Math.min(3,Number(d.rank)||1))-1]} في ${trackLabel(d.track)} · فئة ${categoryLabel(d.categoryId)} خلال ${periodText}.`;
    }
    if(!d.manualAchievement)d.achievement=autoAchievement;
    if(!d.manualDua&&!d.dua)d.dua='سائلين الله تعالى أن يثبت القرآن في صدره، وأن يجعله له نورًا وهدًى ورفعةً في الدنيا والآخرة.';
    return d;
  }
  function setDraft(k,v){
    const d=currentDraft();
    if(k.startsWith('style.'))d.style[k.slice(6)]=v;else d[k]=v;
    if(k==='title')d.manualTitle=true;
    if(k==='intro')d.manualIntro=true;
    if(k==='achievement')d.manualAchievement=true;
    if(k==='dua')d.manualDua=true;
    if(k==='studentId'){const st=studentById(v);if(st){d.studentName=st.full_name;d.halaqaId=st.halaqa_id||d.halaqaId}}
    updateDraftText();keepPending(currentDraft());renderCertificatePreview();
  }
  function resetTextField(field){const d=currentDraft();if(field==='title')d.manualTitle=false;if(field==='intro')d.manualIntro=false;if(field==='achievement')d.manualAchievement=false;if(field==='dua'){d.manualDua=false;d.dua='';}updateDraftText();render()}
  function resetDraft(type='sard'){write('pending-official-draft',null);stateLocal.draft=null;const d=currentDraft();d.type=type;updateDraftText();render()}
  function colorField(id,label,value,key){return `<label class="cert-field cert-color"><span>${label}</span><input id="${id}" type="color" value="${esc(value)}" oninput="certSet('${key}',this.value)"><code>${esc(value)}</code></label>`}
  function optionRows(rows,value,labelFn=x=>x.full_name){return rows.map(x=>`<option value="${esc(x.id)}" ${String(value)===String(x.id)?'selected':''}>${esc(labelFn(x))}</option>`).join('')}
  function juzOptions(v){return Array.from({length:30},(_,i)=>`<option value="${i+1}" ${Number(v)===i+1?'selected':''}>الجزء ${arabicJuz(i+1)} (${i+1})</option>`).join('')}
  function certTypeVisible(k){const kind=(typeof window.rc27Scope==='function'?window.rc27Scope().kind:'regular');const prog=['tajweed','excellence'];return kind==='program'?(prog.includes(k)||k==='rank'||k==='ideal'):!prog.includes(k)}
  function typeFields(d){
    if(d.type==='tajweed'||d.type==='excellence')return `<div class="cert-grid two"><label class="cert-field"><span>${d.type==='tajweed'?'المستوى أو المقرر (اختياري)':'سبب التميز (اختياري)'}</span><input value="${esc(d.reason||'')}" oninput="certSet('reason',this.value)" placeholder="${d.type==='tajweed'?'مثال: المستوى الأول — أحكام النون الساكنة':'مثال: الإتقان وحسن الأداء'}"></label></div>`;
    if(d.type==='sard')return `<div class="cert-grid two"><label class="cert-field"><span>من الجزء</span><select onchange="certSet('fromJuz',Number(this.value))">${juzOptions(d.fromJuz)}</select></label><label class="cert-field"><span>إلى الجزء</span><select onchange="certSet('toJuz',Number(this.value))">${juzOptions(d.toJuz)}</select></label></div>`;
    if(d.type==='monthly')return `<div class="cert-grid two"><label class="cert-field"><span>الشهر والسنة</span><input type="month" value="${esc(d.month)}" onchange="certSet('month',this.value)"></label><label class="cert-field"><span>سبب التميز (اختياري)</span><input value="${esc(d.reason||'')}" oninput="certSet('reason',this.value)" placeholder="مثال: المواظبة وحسن الأداء"></label></div>`;
    if(d.type==='ideal')return `<div class="cert-score-grid">${[['ethics','الأخلاق',35],['discipline','الالتزام',30],['attendance','الحضور',20],['memorization','الحفظ والجدية',15]].map(([k,l,w])=>`<label><span>${l} · وزن ${w}%</span><input type="range" min="0" max="100" value="${Number(d[k])||0}" oninput="this.nextElementSibling.textContent=this.value+'/100';certSet('${k}',Number(this.value))"><b>${Number(d[k])||0}/100</b></label>`).join('')}<div class="cert-score-total">النتيجة الموزونة <strong>${idealScore(d)}/100</strong></div></div>`;
    if(d.type==='rank')return `<div class="cert-grid two"><label class="cert-field"><span>المركز</span><select onchange="certSet('rank',Number(this.value))"><option value="1" ${d.rank==1?'selected':''}>الأول</option><option value="2" ${d.rank==2?'selected':''}>الثاني</option><option value="3" ${d.rank==3?'selected':''}>الثالث</option></select></label><label class="cert-field"><span>المسار</span><select onchange="certSet('track',this.value)"><option value="general_hifz" ${d.track==='general_hifz'?'selected':''}>مسار الحفظ العام</option><option value="tathbit" ${d.track==='tathbit'?'selected':''}>مسار التثبيت</option></select></label><label class="cert-field"><span>الفئة</span><select onchange="certSet('categoryId',this.value)"><option value="all">جميع الفئات</option>${optionRows((state.categories||[]).filter(x=>x.active!==false),d.categoryId,x=>x.name)}</select></label><label class="cert-field"><span>الحلقة</span><select onchange="certSet('halaqaId',this.value)"><option value="all">جميع الحلقات</option>${optionRows(state.halaqas||[],d.halaqaId,x=>x.name)}</select></label><label class="cert-field"><span>الفترة</span><select onchange="certSet('periodMode',this.value);render()"><option value="month" ${d.periodMode==='month'?'selected':''}>شهر واحد</option><option value="months" ${d.periodMode==='months'?'selected':''}>عدة شهور</option><option value="custom" ${d.periodMode==='custom'?'selected':''}>فترة مخصصة بالتاريخ</option></select></label>${d.periodMode==='month'?`<label class="cert-field"><span>الشهر</span><input type="month" value="${esc(d.periodMonth)}" onchange="certSet('periodMonth',this.value)"></label>`:d.periodMode==='months'?`<label class="cert-field"><span>من شهر</span><input type="month" value="${esc(d.periodFromMonth)}" onchange="certSet('periodFromMonth',this.value)"></label><label class="cert-field"><span>إلى شهر</span><input type="month" value="${esc(d.periodToMonth)}" onchange="certSet('periodToMonth',this.value)"></label>`:`<label class="cert-field"><span>من</span><input type="date" value="${esc(d.periodFrom)}" onchange="certSet('periodFrom',this.value)"></label><label class="cert-field"><span>إلى</span><input type="date" value="${esc(d.periodTo)}" onchange="certSet('periodTo',this.value)"></label>`}</div><button class="btn btn-soft" type="button" onclick="certCalculateRanking()">حساب أول 3 حسب النقاط</button>${rankingResultHtml()}`;
    return '';
  }
  function rankingResultHtml(){const r=stateLocal.ranking;if(!r)return '';if(r.loading)return '<div class="notice">جاري حساب المراكز من النقاط…</div>';if(r.error)return `<div class="notice error">${esc(r.error)}</div>`;return `<div class="cert-ranking-result"><b>النتيجة حسب النقاط</b>${(r.rows||[]).slice(0,3).map((x,i)=>`<button type="button" onclick="certUseRank(${i})"><span>${i+1}</span><strong>${esc(x.student.full_name)}</strong><em>${fmt(x.points)} نقطة · ${fmt(x.pages)} ص</em></button>`).join('')||'<div class="muted">لا توجد بيانات كافية.</div>'}</div>`}
  function periodBounds(d){if(d.periodMode==='month')return {from:monthStart(d.periodMonth),to:monthEnd(d.periodMonth)};if(d.periodMode==='months')return {from:monthStart(d.periodFromMonth),to:monthEnd(d.periodToMonth)};return {from:d.periodFrom,to:d.periodTo}}
  async function calculateRanking(){
    const d=currentDraft(),b=periodBounds(d);if(!b.from||!b.to||b.from>b.to){stateLocal.ranking={error:'الفترة غير صحيحة'};return render()}
    stateLocal.ranking={loading:true};render();
    try{
      let students=activeStudentRows().filter(s=>(d.track==='tathbit'?s.track_code==='tathbit':s.track_code!=='tathbit'));
      if(d.categoryId!=='all')students=students.filter(s=>String(s.category_id||'')===String(d.categoryId));
      if(d.halaqaId!=='all')students=students.filter(s=>String(s.halaqa_id||'')===String(d.halaqaId));
      const ids=students.map(x=>x.id);if(!ids.length)throw new Error('لا يوجد طلاب ضمن المسار والفئة المختارين.');
      const {recs,bonus}=await window.HalaqatiCertificateServer.rankingData(db,ids,b,d.halaqaId,()=>state.user?.id);
      const map=new Map(students.map(s=>[String(s.id),{student:s,points:0,pages:0,penalty:0}]));
      for(const r of recs){const x=map.get(String(r.student_id));if(!x)continue;const p=Number(r.pages_count||0),pt=r.points!=null?Number(r.points||0):(typeof recPoints==='function'?Number(recPoints(r)||0):p);x.points+=pt;x.pages+=p;x.penalty+=Number(r.mistakes||0)+Number(r.prompts||0)*.5}
      for(const p of bonus){const x=map.get(String(p.student_id));if(x)x.points+=Number(p.points||0)}
      const rows=[...map.values()].sort((a,b)=>b.points-a.points||b.pages-a.pages||(a.pages?a.penalty/a.pages:999)-(b.pages?b.penalty/b.pages:999)||String(a.student.full_name).localeCompare(String(b.student.full_name),'ar'));
      stateLocal.ranking={rows,from:b.from,to:b.to};render();
    }catch(e){stateLocal.ranking={error:e?.message||String(e)};render()}
  }
  function useRank(i){const x=stateLocal.ranking?.rows?.[i];if(!x)return;const d=currentDraft();d.rank=i+1;d.studentId=x.student.id;d.studentName=x.student.full_name;updateDraftText();render()}
  function templateCards(d){return `<div class="cert-template-list">${Object.entries(TEMPLATES).map(([k,t])=>`<button type="button" class="cert-template ${d.template===k?'active':''}" onclick="certApplyTemplate('${k}')"><i style="--a:${t.primary};--b:${t.accent};--p:${t.paper}"></i><span>${t.label}</span></button>`).join('')}</div>`}
  function applyTemplate(k){const t=TEMPLATES[k];if(!t)return;const d=currentDraft();d.template=k;Object.assign(d.style,{primary:t.primary,secondary:t.secondary,accent:t.accent,paper:t.paper,ink:t.ink,ornamentOpacity:Math.round(t.ornament*100)});render()}
  function issueEditorHtml(){const d=currentDraft(),s=currentSettings(),students=activeStudentRows();return `<div class="cert-layout"><section class="card cert-editor"><div class="section-head"><div><h3>إصدار شهادة</h3><div class="muted">ترقيم رسمي وأرشيف مشترك · PDF</div></div><button class="mini" onclick="certReset('${d.type}')">إعادة ضبط</button></div><label class="cert-field"><span>نوع الشهادة</span><select onchange="certReset(this.value)">${Object.entries(TYPES).filter(([k])=>certTypeVisible(k)).map(([k,x])=>`<option value="${k}" ${d.type===k?'selected':''}>${x.label}</option>`).join('')}</select></label><label class="cert-field"><span>الطالب</span><select onchange="certSet('studentId',this.value)">${optionRows(students,d.studentId)}</select></label><label class="cert-field"><span>رقم الشهادة</span><input dir="ltr" value="${esc(d.certificateNumber)}" readonly aria-label="الرقم الرسمي يصدر من الخادم" placeholder="HAL-CERT-2026-0001"></label>${typeFields(d)}<div class="cert-divider">النص</div><label class="cert-field"><span>عنوان الشهادة <button type="button" class="cert-inline-reset" onclick="certResetText('title')">الافتراضي</button></span><input value="${esc(d.title)}" oninput="certSet('title',this.value)"></label><label class="cert-field"><span>النص الرئيسي <button type="button" class="cert-inline-reset" onclick="certResetText('intro')">الافتراضي</button></span><textarea rows="2" oninput="certSet('intro',this.value)">${esc(d.intro)}</textarea></label><label class="cert-field"><span>نص الإنجاز <button type="button" class="cert-inline-reset" onclick="certResetText('achievement')">الافتراضي</button></span><textarea rows="3" oninput="certSet('achievement',this.value)">${esc(d.achievement)}</textarea></label><label class="cert-field"><span>الدعاء / الخاتمة <button type="button" class="cert-inline-reset" onclick="certResetText('dua')">الافتراضي</button></span><textarea rows="2" oninput="certSet('dua',this.value)">${esc(d.dua)}</textarea></label><div class="cert-divider">التصميم</div>${templateCards(d)}<div class="cert-grid two"><label class="cert-field"><span>الخط</span><select onchange="certSet('style.fontFamily',this.value)"><option value="Cairo" ${d.style.fontFamily==='Cairo'?'selected':''}>Cairo</option><option value="Tahoma" ${d.style.fontFamily==='Tahoma'?'selected':''}>Tahoma</option><option value="Arial" ${d.style.fontFamily==='Arial'?'selected':''}>Arial</option><option value="serif" ${d.style.fontFamily==='serif'?'selected':''}>Serif</option><option value="custom" ${d.style.fontFamily==='custom'?'selected':''}>خط مثبت على الجهاز</option></select></label><label class="cert-field"><span>اسم الخط المخصص</span><input value="${esc(d.style.customFont||'')}" oninput="certSet('style.customFont',this.value)" placeholder="مثال: Noto Naskh Arabic"></label><label class="cert-field"><span>حجم العنوان</span><input type="range" min="30" max="64" value="${d.style.titleSize}" oninput="this.nextElementSibling.textContent=this.value+'px';certSet('style.titleSize',Number(this.value))"><b>${d.style.titleSize}px</b></label><label class="cert-field"><span>حجم اسم الطالب</span><input type="range" min="28" max="58" value="${d.style.studentSize}" oninput="this.nextElementSibling.textContent=this.value+'px';certSet('style.studentSize',Number(this.value))"><b>${d.style.studentSize}px</b></label><label class="cert-field"><span>حجم النص</span><input type="range" min="15" max="28" value="${d.style.bodySize}" oninput="this.nextElementSibling.textContent=this.value+'px';certSet('style.bodySize',Number(this.value))"><b>${d.style.bodySize}px</b></label><label class="cert-field"><span>حجم الشعارين</span><input type="range" min="100" max="230" value="${d.style.logoSize}" oninput="this.nextElementSibling.textContent=this.value+'px';certSet('style.logoSize',Number(this.value))"><b>${d.style.logoSize}px</b></label></div><div class="cert-grid colors">${colorField('certPrimary','الرئيسي',d.style.primary,'style.primary')}${colorField('certAccent','الذهبي',d.style.accent,'style.accent')}${colorField('certSecondary','الثانوي',d.style.secondary,'style.secondary')}${colorField('certPaper','الخلفية',d.style.paper,'style.paper')}${colorField('certInk','النص',d.style.ink,'style.ink')}</div><div class="cert-grid two"><label class="cert-field"><span>قوة الزخرفة</span><input type="range" min="0" max="100" value="${d.style.ornamentOpacity}" oninput="this.nextElementSibling.textContent=this.value+'%';certSet('style.ornamentOpacity',Number(this.value))"><b>${d.style.ornamentOpacity}%</b></label><label class="cert-field"><span>سمك الإطار</span><input type="range" min="1" max="6" value="${d.style.borderWidth}" oninput="this.nextElementSibling.textContent=this.value+'px';certSet('style.borderWidth',Number(this.value))"><b>${d.style.borderWidth}px</b></label></div><div class="cert-toggle-row"><label><input type="checkbox" ${d.style.showDates?'checked':''} onchange="certSet('style.showDates',this.checked)"> التاريخان</label><label><input type="checkbox" ${d.style.showSignatures?'checked':''} onchange="certSet('style.showSignatures',this.checked)"> التوقيعات</label><label><input type="checkbox" ${d.style.showVerse?'checked':''} onchange="certSet('style.showVerse',this.checked)"> الآية</label></div><div class="cert-toggle-row">${[['showNumber','رقم الشهادة'],['showLogos','الشعارات'],['showStamp','الختم']].map(([k,label])=>`<label><input type="checkbox" ${d.style[k]!==false?'checked':''} onchange="certSet('style.${k}',this.checked)"> ${label}</label>`).join('')}</div><label class="cert-field"><span>موضع رقم الشهادة</span><select onchange="certSet('style.numberPosition',this.value)"><option value="under-logo" ${d.style.numberPosition==='under-logo'?'selected':''}>أسفل شعار المركز - موصى به</option><option value="top" ${d.style.numberPosition==='top'?'selected':''}>أعلى الوسط</option><option value="bottom-left" ${d.style.numberPosition==='bottom-left'?'selected':''}>أسفل يسار</option><option value="bottom-right" ${d.style.numberPosition==='bottom-right'?'selected':''}>أسفل يمين</option></select></label><div class="cert-actions"><button class="btn btn-primary" onclick="certSavePdf()" ${stateLocal.busy?'disabled':''}>${stateLocal.busy?'جاري إنشاء PDF…':'إصدار وحفظ PDF'}</button><button class="btn btn-soft" onclick="certPrint()">طباعة</button><button class="btn btn-soft" onclick="certIssueToArchive(false)">إصدار رسمي وحفظ في الأرشيف</button></div></section><section class="cert-preview-column"><div class="cert-preview-toolbar"><b>المعاينة المباشرة</b><span>معاينة مصغرة مطابقة لـ A4 · لا تؤثر على PDF</span><label class="cert-preview-zoom"><span>تكبير المعاينة</span><input type="range" min="70" max="120" value="${stateLocal.previewZoom}" oninput="certPreviewZoom(Number(this.value));this.nextElementSibling.textContent=this.value+'%'"><b>${stateLocal.previewZoom}%</b></label></div><div class="cert-preview-shell"><div class="cert-preview-stage"><div id="certificatePreviewPaper">${certificateInnerHtml(d,s)}</div></div></div></section></div>`}

  function certFont(d){return d.style.fontFamily==='custom'?(d.style.customFont||'Cairo'):d.style.fontFamily||'Cairo'}
  function imageOrPlaceholder(src,label,kind){return src?`<img class="cert-logo cert-logo-${kind}" src="${esc(src)}" alt="">`:`<div class="cert-logo cert-logo-placeholder">${esc(label)}</div>`}
  function signatureBlock(img,role,name){return `<div class="cert-sign"><div class="cert-sign-line">${img?`<img src="${esc(img)}" alt="">`:''}</div><span>${esc(role)}</span><b>${esc(name)}</b></div>`}
  function islamicPatternSvg(){return `<svg class="cert-geo-bg" viewBox="0 0 1122 794" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="certGirihPattern" width="96" height="96" patternUnits="userSpaceOnUse"><g fill="none" stroke="currentColor" stroke-width="1"><path d="M48 4 64 20 87 20 87 43 92 48 87 53 87 76 64 76 48 92 32 76 9 76 9 53 4 48 9 43 9 20 32 20Z"/><path d="M48 14 58 28 76 30 68 48 76 66 58 68 48 82 38 68 20 66 28 48 20 30 38 28Z"/><path d="M0 48h96M48 0v96M14 14l68 68M82 14 14 82" opacity=".65"/><circle cx="48" cy="48" r="10"/></g></pattern></defs><rect width="1122" height="794" fill="url(#certGirihPattern)"/></svg>`}
  function islamicCornerSvg(cls){return `<svg class="cert-corner ${cls}" viewBox="0 0 180 180" aria-hidden="true"><g fill="none" stroke-linejoin="round" stroke-linecap="round"><path class="cert-corner-line primary" d="M8 8H172M8 8V172M22 22H148M22 22V148"/><path class="cert-corner-line accent" d="M12 36H126M36 12V126"/><g transform="translate(22 22)"><polygon class="cert-corner-line accent cert-star-fill" points="58,4 68,35 96,20 81,48 112,58 81,68 96,96 68,81 58,112 48,81 20,96 35,68 4,58 35,48 20,20 48,35"/><polygon class="cert-corner-line primary" points="58,14 86,30 102,58 86,86 58,102 30,86 14,58 30,30"/><rect class="cert-corner-line accent" x="30" y="30" width="56" height="56" transform="rotate(45 58 58)"/><circle class="cert-corner-line primary" cx="58" cy="58" r="18"/><path class="cert-corner-line accent" d="M58 14V102M14 58H102M27 27l62 62M89 27 27 89"/></g><path class="cert-corner-line primary" d="M116 22h32v32M22 116v32h32"/><path class="cert-corner-line accent" d="M124 30h16v16M30 124v16h16"/></g></svg>`}
  function islamicSideRosetteSvg(cls){return `<svg class="cert-side-rosette ${cls}" viewBox="0 0 72 72" aria-hidden="true"><g fill="none" stroke-linejoin="round"><polygon class="primary" points="36,3 44,24 65,15 48,32 69,36 48,40 65,57 44,48 36,69 28,48 7,57 24,40 3,36 24,32 7,15 28,24"/><polygon class="accent" points="36,12 53,19 60,36 53,53 36,60 19,53 12,36 19,19"/><rect class="accent" x="21" y="21" width="30" height="30" transform="rotate(45 36 36)"/><circle class="primary" cx="36" cy="36" r="8"/></g></svg>`}
  function certificateInnerHtml(d,s){
    s={...s,...d.snapshotSettings};
    const style=`--cert-primary:${esc(d.style.primary)};--cert-secondary:${esc(d.style.secondary)};--cert-accent:${esc(d.style.accent)};--cert-paper:${esc(d.style.paper)};--cert-ink:${esc(d.style.ink)};--cert-title-size:${Number(d.style.titleSize)}px;--cert-student-size:${Number(d.style.studentSize)}px;--cert-body-size:${Number(d.style.bodySize)}px;--cert-logo-size:${Number(d.style.logoSize)}px;--cert-border-width:${Number(d.style.borderWidth)}px;--cert-ornament-opacity:${Math.max(0,Number(d.style.ornamentOpacity)||0)/100};--cert-font:${JSON.stringify(certFont(d))}`;
    const numberCode=esc(d.certificateNumber||nextCertificateNumber(true));
    const number=d.style.showNumber===false?'':`<span class="cert-number-label">رقم الشهادة:</span><span class="cert-number-code" dir="ltr">${numberCode}</span>`;
    const centerNumber=d.style.numberPosition==='under-logo'?`<div class="cert-number cert-number-logo">${number}</div>`:'';
    return `<article class="halaqati-certificate cert-template-${esc(d.template)}" dir="rtl" style='${style}'>${islamicPatternSvg()}<div class="cert-frame"></div>${islamicCornerSvg('c1')}${islamicCornerSvg('c2')}${islamicCornerSvg('c3')}${islamicCornerSvg('c4')}${islamicSideRosetteSvg('r1')}${islamicSideRosetteSvg('l1')}${d.style.numberPosition==='top'?`<div class="cert-number cert-number-top">${number}</div>`:''}<header class="cert-head"><div class="cert-logo-slot">${d.style.showLogos===false?'':imageOrPlaceholder(s.halaqaLogo,'شعار الحلقة','halaqa')}</div><div class="cert-org"><h3>${esc(s.centerName)}</h3><h4>${esc(s.halaqaName)}</h4><div class="cert-orn-line"><span></span></div></div><div class="cert-logo-slot cert-logo-slot-center">${d.style.showLogos===false?'':imageOrPlaceholder(s.centerLogo,'شعار المركز','center')}${centerNumber}</div></header><div class="cert-kicker">شهادة تقدير وإنجاز</div><h1 class="cert-main-title">${esc(d.title)}</h1><p class="cert-intro">${esc(d.intro)}</p><div class="cert-name-box"><strong>${esc(d.studentName||'اسم الطالب')}</strong></div><p class="cert-achievement">${esc(d.achievement)}</p><p class="cert-dua">${esc(d.dua)}</p>${d.style.showDates?`<div class="cert-dates"><span class="cert-date-hijri">${esc(hijriArabic(d.date))}</span><span class="cert-date-gregorian">${esc(dateArabic(d.date))}</span></div>`:''}${d.style.showSignatures?`<div class="cert-signatures">${signatureBlock(s.teacherSignature,'المعلّم',s.teacher)}<div class="cert-stamp">${d.style.showStamp===false?'':s.stampImage?`<img src="${esc(s.stampImage)}" alt="">`:'<span>الختم الرسمي</span>'}</div>${signatureBlock(s.supervisorSignature,'المشرف',s.supervisor)}</div>`:''}<footer class="cert-footer">${d.style.numberPosition==='bottom-left'?`<div class="cert-number cert-number-footer">${number}</div>`:'<div></div>'}${d.style.showVerse?`<div class="cert-verse">${esc(s.verse||'﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾')}</div>`:'<div></div>'}${d.style.numberPosition==='bottom-right'?`<div class="cert-number cert-number-right cert-number-footer">${number}</div>`:'<div></div>'}</footer></article>`
  }
  function fitCertificatePreview(){const paper=document.getElementById('certificatePreviewPaper'),stage=paper?.closest('.cert-preview-stage'),shell=paper?.closest('.cert-preview-shell');if(!paper||!stage||!shell)return;const baseW=1122,baseH=794,available=Math.max(240,shell.clientWidth-16),zoom=Math.max(.7,Math.min(1.2,Number(stateLocal.previewZoom||92)/100)),scale=Math.min(1,available/baseW)*zoom;paper.style.width=baseW+'px';paper.style.height=baseH+'px';paper.style.transformOrigin='top left';paper.style.transform=`scale(${scale})`;stage.style.height=Math.ceil(baseH*scale)+'px';stage.style.width='100%';paper.style.left=Math.max(0,Math.round((stage.clientWidth-baseW*scale)/2))+'px';paper.style.top='0px'}
  function renderCertificatePreview(){const box=document.getElementById('certificatePreviewPaper');if(box){const d=updateDraftText();box.style.fontFamily=certFont(d);box.innerHTML=certificateInnerHtml(d,currentSettings());requestAnimationFrame(fitCertificatePreview)}}
  function setPreviewZoom(v){stateLocal.previewZoom=Math.max(70,Math.min(120,Number(v)||92));fitCertificatePreview()}

  function tabs(){return `<div class="cert-tabs">${[['issue','إصدار شهادة'],['batch','إصدار جماعي'],['archive','الأرشيف'],['templates','القوالب'],['settings','الإعدادات']].map(([k,l])=>`<button class="${stateLocal.tab===k?'active':''}" onclick="certTab('${k}')">${l}</button>`).join('')}</div>`}
  function certificatesPage(){ensureAccount();if(!roleCanManage())return '<div class="notice">هذه الصفحة متاحة للمحفظ والمشرف ومسؤول النظام فقط.</div>';let body='';if(stateLocal.tab==='issue')body=issueEditorHtml();if(stateLocal.tab==='batch')body=batchPageHtml();if(stateLocal.tab==='archive')body=centralArchiveHtml()+archivePageHtml();if(stateLocal.tab==='templates')body=templatesPageHtml();if(stateLocal.tab==='settings')body=settingsPageHtml();return `<div class="hero cert-hero"><div><h2>مركز الشهادات</h2><p>ترقيم رسمي · أرشيف مشترك · أرشيف محلي سابق · PDF</p></div><span class="badge blue">RC27.39</span></div>${tabs()}${body}`}
  function setTab(t){stateLocal.tab=t;render()}
  function archivePageHtml(){let rows=archive(),q=String(stateLocal.archiveSearch||'').trim().toLowerCase();if(q)rows=rows.filter(x=>`${x.studentName} ${x.number} ${x.typeLabel}`.toLowerCase().includes(q));return `<div class="card"><div class="section-head"><h3>أرشيف الشهادات المحلي</h3><div class="actions"><button class="mini" onclick="certExportArchive()">تصدير JSON</button><button class="mini" onclick="certImportArchivePicker()">استيراد</button></div></div><label class="cert-field"><span>بحث</span><input value="${esc(stateLocal.archiveSearch)}" oninput="stateCertArchiveSearch(this.value)" placeholder="اسم الطالب أو رقم الشهادة"></label><div class="cert-archive-list">${rows.map(x=>`<div class="cert-archive-row"><div><b>${esc(x.studentName)}</b><span>${esc(x.typeLabel)} · ${esc(x.number)}</span><small>${esc(x.issuedAt)}${x.filename?` · ${esc(x.filename)}`:''}</small></div><div class="actions">${x.uri?`<button class="mini" onclick="certShareArchive('${esc(x.id)}')">مشاركة</button>`:''}<button class="mini" onclick="certReissue('${esc(x.id)}')">إعادة إنشاء</button><button class="mini" onclick="certImportLocalCentral('${esc(x.id)}')">نقل للمشترك</button><button class="mini danger" onclick="certDeleteArchive('${esc(x.id)}')">حذف</button></div></div>`).join('')||'<div class="empty">لا توجد شهادات مؤرشفة بعد.</div>'}</div></div>`}
  function templatesPageHtml(){const d=currentDraft();return `<div class="card"><h3>قوالب الشهادات</h3><p class="muted">خمسة قوالب جاهزة، وكل قالب قابل لتغيير ألوانه وخطه وأحجامه قبل الإصدار.</p>${templateCards(d)}<div class="notice">اختيار القالب هنا يضبط ألوان القالب الحالي فقط. ويمكن حفظ القالب المفضّل كافتراضي من الإعدادات.</div></div>`}
  function settingsPageHtml(){const s=currentSettings();return `<div class="cert-settings-grid"><div class="card"><h3>الهوية والتوقيعات</h3><label class="cert-field"><span>اسم المركز</span><input id="certSetCenter" value="${esc(s.centerName)}"></label><label class="cert-field"><span>اسم الحلقة</span><input id="certSetHalaqa" value="${esc(s.halaqaName)}"></label><label class="cert-field"><span>اسم المعلم</span><input id="certSetTeacher" value="${esc(s.teacher)}"></label><label class="cert-field"><span>اسم المشرف</span><input id="certSetSupervisor" value="${esc(s.supervisor)}"></label><div class="cert-upload-grid"><label class="cert-upload">شعار الحلقة<input type="file" accept="image/*" onchange="certUploadSetting('halaqaLogo',this.files[0])"></label><label class="cert-upload">شعار المركز<input type="file" accept="image/*" onchange="certUploadSetting('centerLogo',this.files[0])"></label><label class="cert-upload">توقيع المعلم<input type="file" accept="image/*" onchange="certUploadSetting('teacherSignature',this.files[0])"></label><label class="cert-upload">توقيع المشرف<input type="file" accept="image/*" onchange="certUploadSetting('supervisorSignature',this.files[0])"></label><label class="cert-upload">ختم المركز<input type="file" accept="image/*" onchange="certUploadSetting('stampImage',this.files[0])"></label></div><button class="btn btn-primary" onclick="certSaveSettingsForm()">حفظ الإعدادات</button></div><div class="card"><h3>الإعدادات الافتراضية</h3><label class="cert-field"><span>القالب الافتراضي</span><select id="certDefaultTemplate">${Object.entries(TEMPLATES).map(([k,t])=>`<option value="${k}" ${s.defaultTemplate===k?'selected':''}>${t.label}</option>`).join('')}</select></label><label class="cert-field"><span>الآية السفلية</span><input id="certVerse" value="${esc(s.verse)}"></label><div class="notice">ملفات الصور والتوقيعات تحفظ محليًا على هذا الجهاز ولا ترفع إلى Supabase.</div><button class="btn btn-soft" onclick="certResetSettings()">استعادة الإعدادات الافتراضية</button></div></div>`}
  function batchPageHtml(){const d=currentDraft(),students=activeStudentRows();return `<div class="card"><div class="section-head"><div><h3>إصدار جماعي</h3><div class="muted">كل طالب يحصل على PDF ورقم شهادة مستقلين.</div></div><b>${stateLocal.batch.size} محدد</b></div><label class="cert-field"><span>نوع الشهادة الجماعية</span><select onchange="certReset(this.value);stateLocal.tab='batch';render()">${Object.entries(TYPES).filter(([k])=>k!=='rank'&&certTypeVisible(k)).map(([k,x])=>`<option value="${k}" ${d.type===k?'selected':''}>${x.label}</option>`).join('')}</select></label>${typeFields(d)}<div class="cert-batch-list">${students.map(st=>`<label><input type="checkbox" ${stateLocal.batch.has(String(st.id))?'checked':''} onchange="certBatchToggle('${st.id}',this.checked)"><span>${esc(st.full_name)}</span><small>${esc(studentTrackAr[st.track_code]||'')} · ${esc(typeof categoryName==='function'?categoryName(st):categoryLabel(st.category_id))}</small></label>`).join('')}</div><button class="btn btn-primary" onclick="certBatchIssue()" ${!stateLocal.batch.size||stateLocal.busy?'disabled':''}>إصدار ${stateLocal.batch.size||''} شهادة PDF</button></div>`}
  function batchToggle(id,on){if(on)stateLocal.batch.add(String(id));else stateLocal.batch.delete(String(id));render()}
  async function batchIssue(){
    if(!stateLocal.batch.size||stateLocal.busy)return;
    const ids=[...stateLocal.batch],base=clone(currentDraft()),jobs=read('batch-drafts',{}),key=JSON.stringify({type:base.type,date:base.date,title:base.title,style:base.style,from:base.fromJuz,to:base.toJuz,reason:base.reason}),job=jobs[key]||{};
    jobs[key]=job;stateLocal.busy=true;render();let ok=0;const failed=[];
    try{for(const id of ids){
      if(job[id]?.completed){ok++;continue}
      stateLocal.draft=job[id]?.draft||{...clone(base),serverId:offlineUuid(),serverRecord:null,officialSignature:null,historical:false,studentId:id,studentName:studentById(id)?.full_name||'طالب'};
      updateDraftText();job[id]={draft:window.HalaqatiCertificateServer.serializableDraft(stateLocal.draft)};write('batch-drafts',jobs);
      try{await savePdf(true);ok++;job[id].completed=true;stateLocal.batch.delete(id)}catch(e){failed.push(`${stateLocal.draft.studentName}: ${e.message}`)}
      job[id].draft=window.HalaqatiCertificateServer.serializableDraft(stateLocal.draft);write('batch-drafts',jobs);
    }}finally{stateLocal.draft=base;stateLocal.busy=false;keepPending(base)}
    stateLocal.tab='archive';toast(failed.length?`حُفظ ${ok} PDF، وتعذر ${failed.length}. الإعادة تستخدم نفس أرقام الشهادات. ${failed[0]}`:`تم إصدار وحفظ ${ok} شهادة`);render();
  }
  function payloadFromDraft(d,meta={}){return {id:offlineUuid(),number:d.certificateNumber,studentId:d.studentId,studentName:d.studentName,type:d.type,typeLabel:TYPES[d.type]?.label||d.type,issuedAt:new Date().toISOString(),date:d.date,template:d.template,details:{fromJuz:d.fromJuz,toJuz:d.toJuz,month:d.month,rank:d.rank,track:d.track,categoryId:d.categoryId,periodMode:d.periodMode,periodMonth:d.periodMonth,periodFromMonth:d.periodFromMonth,periodToMonth:d.periodToMonth,periodFrom:d.periodFrom,periodTo:d.periodTo,achievement:d.achievement,title:d.title},style:clone(d.style),...meta}}
  async function issueToArchive(withPdf=true,meta={}){const d=currentDraft();if(!withPdf)await ensureOfficial();const row={...payloadFromDraft(d,meta),id:d.serverId,central:true};const rows=archive().filter(x=>x.id!==row.id);rows.unshift(row);saveArchive(rows);return row}
  async function buildCertificateVectorHtml(paper){
    let html=await window.HalaqatiVectorPdf.buildHtml(paper,'landscape');
    const d=currentDraft(),font=certFont(d).replace(/[\\"']/g,'');
    const css=`<style>@page{size:A4 landscape;margin:0!important}html,body{width:297mm!important;height:210mm!important;margin:0!important;padding:0!important;overflow:hidden!important;background:${d.style.paper}!important}#hf-vector-print-root{width:297mm!important;height:210mm!important;margin:0!important;padding:0!important;position:static!important;left:auto!important;top:auto!important;transform:none!important;transform-origin:top left!important;font-family:'${font}',Cairo,Tahoma,Arial,sans-serif!important}.halaqati-certificate{width:297mm!important;height:210mm!important;margin:0!important;max-width:none!important;max-height:none!important;position:relative!important}</style>`;
    return html.replace('</head>',css+'</head>');
  }
  function exportSurface(d){
    const host=document.createElement('div');host.className='cert-export-surface';host.style.cssText='position:fixed;left:-20000px;top:0;width:1122px;height:794px;pointer-events:none';
    const paper=document.createElement('div');paper.style.cssText='width:1122px;height:794px';paper.innerHTML=certificateInnerHtml(d,currentSettings());host.appendChild(paper);document.body.appendChild(host);return {host,paper};
  }
  async function savePdf(silent=false){const d=currentDraft();if(!d.studentId)throw new Error('اختر الطالب أولاً');stateLocal.busy=true;if(!silent)render();try{
      if(d.historical)throw new Error('هذه نسخة تاريخية للعرض فقط؛ افتح النسخة الحالية للتصدير');
      await ensureOfficial();
      updateDraftText();const surface=exportSurface(d),paper=surface.paper;
      try{
      const safeName=`شهادة_${String(d.studentName||'طالب').replace(/\s+/g,'_')}_${d.certificateNumber}.pdf`;
      let res=null;if(window.Capacitor?.Plugins?.HalaqatiPdf?.saveHtmlPdf&&window.HalaqatiVectorPdf?.buildHtml){const html=await buildCertificateVectorHtml(paper);res=await window.Capacitor.Plugins.HalaqatiPdf.saveHtmlPdf({html,filename:safeName,orientation:'landscape',subdirectory:'Certificates'});}else if(window.HalaqatiCertificatePdf?.saveElement){res=await window.HalaqatiCertificatePdf.saveElement(paper,safeName);}else throw new Error('محرك PDF المتجهي غير متاح');
      const row=await issueToArchive(true,{filename:res?.filename||safeName,uri:res?.uri||'',bytes:Number(res?.bytes||0),directory:res?.directory||'Downloads/Halaqati/Certificates',engine:res?.engine||'chromium-vector'});if(!silent){toast(`تم حفظ الشهادة وأرشفتها: ${row.number}`);render()}return row;
      }finally{surface.host.remove()}
    }finally{stateLocal.busy=false;if(!silent)render()}}
  async function printCertificate(){const d=currentDraft();if(d.historical)throw new Error('افتح النسخة الحالية للطباعة');await ensureOfficial();updateDraftText();renderCertificatePreview();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const paper=document.getElementById('certificatePreviewPaper');if(!paper)throw new Error('تعذر تجهيز الشهادة للطباعة');if(!window.HalaqatiVectorPdf?.printElement)throw new Error('محرك الطباعة غير متاح');return await window.HalaqatiVectorPdf.printElement(paper,`شهادة_${String(d.studentName||'طالب').replace(/\s+/g,'_')}_${d.certificateNumber}.pdf`,'landscape')}
  function deleteArchive(id){const x=archive().find(r=>r.id===id);if(!x)return;if(!confirm(`حذف ${x.number} من الأرشيف المحلي؟\nلن يُحذف ملف PDF من مدير الملفات.`))return;saveArchive(archive().filter(r=>r.id!==id));render()}
  function reissue(id){const x=archive().find(r=>r.id===id);if(!x)return;resetDraft(x.type);const d=currentDraft();Object.assign(d,{type:x.type,studentId:x.studentId,studentName:x.studentName,template:x.template,certificateNumber:x.number,...x.details,style:{...d.style,...x.style}});updateDraftText();stateLocal.tab='issue';render()}
  async function shareArchive(id){const x=archive().find(r=>r.id===id);if(!x?.uri)return toast('مسار الملف غير محفوظ. افتح الملف من Downloads/Halaqati/Certificates');try{const Share=window.Capacitor?.Plugins?.Share;if(Share?.share)await Share.share({title:x.number,text:`شهادة ${x.studentName}`,url:x.uri,dialogTitle:'مشاركة الشهادة'});else toast('استخدم مدير الملفات لمشاركة الشهادة')}catch(e){toast('تعذرت المشاركة: '+(e?.message||e))}}
  function exportArchive(){const data={version:STORAGE_VERSION,exportedAt:new Date().toISOString(),settings:currentSettings(),sequence:numberState(),archive:archive()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`halaqati-certificates-archive-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function importArchivePicker(){const i=document.createElement('input');i.type='file';i.accept='application/json,.json';i.onchange=()=>{const f=i.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(String(r.result||''));if(!Array.isArray(x.archive))throw new Error('ملف غير صالح');saveArchive(x.archive);if(x.settings)write('settings',x.settings);if(x.sequence)write('sequence',x.sequence);toast('تم استيراد أرشيف الشهادات');render()}catch(e){toast('تعذر استيراد الأرشيف: '+e.message)}};r.readAsText(f)};i.click()}
  function archiveSearch(v){stateLocal.archiveSearch=v;render()}
  function saveSettingsForm(){const patch={centerName:$('#certSetCenter')?.value||DEFAULT_CENTER,halaqaName:$('#certSetHalaqa')?.value||DEFAULT_HALAQA,teacher:$('#certSetTeacher')?.value||DEFAULT_TEACHER,supervisor:$('#certSetSupervisor')?.value||DEFAULT_SUPERVISOR,defaultTemplate:$('#certDefaultTemplate')?.value||'emerald',verse:$('#certVerse')?.value||'﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾'};saveSettings(patch);toast('تم حفظ إعدادات الشهادات محليًا');render()}
  function resetSettings(){if(!confirm('استعادة إعدادات الشهادات الافتراضية؟'))return;localStorage.removeItem(scopeKey('settings'));stateLocal.draft=null;render()}
  async function compactLocalImage(file){
    if(!file)throw new Error('لا توجد صورة');
    if(file.size>8_000_000)throw new Error('حجم الصورة أكبر من 8 MB');
    const raw=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('تعذر قراءة الصورة'));r.readAsDataURL(file)});
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('صيغة الصورة غير مدعومة'));i.src=raw});
    const max=1000,scale=Math.min(1,max/Math.max(img.naturalWidth||1,img.naturalHeight||1));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round((img.naturalWidth||1)*scale));c.height=Math.max(1,Math.round((img.naturalHeight||1)*scale));
    const g=c.getContext('2d',{alpha:true});g.clearRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
    let data='';try{data=c.toDataURL('image/webp',.88)}catch(_e){data=c.toDataURL('image/png')}
    if(!data||data.length>900_000)throw new Error('تعذر ضغط الصورة للحفظ المحلي؛ استخدم PNG/WebP أصغر');
    return data;
  }
  async function uploadSetting(key,file){try{if(!file)return;const data=await compactLocalImage(file);saveSettings({[key]:data});toast('تم ضغط الصورة وحفظها محليًا');render()}catch(e){toast(e?.message||String(e))}}
  function formatBytes(n){n=Number(n)||0;return n>1024*1024?(n/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'}

  // RC24 central metadata. Account-bound state never survives switching users.
  let account=null,central={rows:[],loaded:false,loading:false,error:'',token:0};
  function ensureAccount(){const id=state.user?.id||'guest';if(account===id)return;account=id;central={rows:[],loaded:false,loading:false,error:'',token:central.token+1};stateLocal.draft=null;stateLocal.ranking=null;stateLocal.batch.clear()}
  const live=()=>navigator.onLine&&!state.offline&&state.networkVerified!==false;
  async function loadCentral(force=false){
    ensureAccount();if(central.loading||central.loaded&&!force)return;
    const user=account,token=++central.token;central.loading=true;central.error='';
    try{const rows=await window.HalaqatiCertificateServer.list(db);if(user!==state.user?.id||token!==central.token)return;central.rows=rows;central.loaded=true}
    catch(e){if(user===state.user?.id)central.error=e.message||String(e)}
    finally{if(user===state.user?.id&&token===central.token){central.loading=false;if(state.page==='certificates'&&stateLocal.tab==='archive')render()}}
  }
  function centralArchiveHtml(){
    ensureAccount();if(!central.loaded&&!central.loading&&!central.error&&live())setTimeout(()=>loadCentral(),0);
    const q=String(stateLocal.archiveSearch||'').toLowerCase(),rows=central.rows.filter(x=>`${x.snapshot?.student_name||''} ${x.certificate_number||''} ${x.title||''}`.toLowerCase().includes(q));
    return `<section class="card"><div class="section-head"><div><h3>أرشيف الشهادات المشترك</h3><p class="muted">نفس أرشيف التطبيق على كل أجهزتك. الصور والتواقيع تبقى على جهازها.</p></div><button class="mini" onclick="certRefreshCentral()" ${central.loading?'disabled':''}>تحديث</button></div>${central.error?`<div class="notice" role="alert">تعذر تحميل الأرشيف: ${esc(central.error)}</div>`:''}${!live()?'<div class="notice">الأرشيف المشترك يحتاج اتصالًا. الأرشيف المحلي السابق متاح أسفل الصفحة.</div>':''}${central.loading?'<p role="status">جارٍ تحميل الشهادات…</p>':''}<div class="cert-archive-list">${rows.map(x=>`<div class="cert-archive-row"><div><b>${esc(x.snapshot?.student_name||studentById(x.student_id)?.full_name||'طالب')}</b><span dir="auto">${esc(x.certificate_number||'مسودة')} · ${esc(x.title)}</span><small>${esc(x.issue_date||'')} · ${x.status==='voided'?'ملغاة':x.status==='issued'?'صادرة':'مسودة'} · نسخ ${Number(x.revision_count)||0}</small>${x.void_reason?`<small>${esc(x.void_reason)}</small>`:''}</div><div class="actions"><button class="mini" onclick="certOpenCentral('${esc(x.id)}')">عرض النسخ</button>${x.status==='issued'?`<button class="mini red" onclick="certVoidCentral('${esc(x.id)}')">إلغاء الشهادة</button>`:''}</div></div>`).join('')||(!central.loading&&!central.error?'<p class="muted">لا شهادات مطابقة.</p>':'')}</div></section>`;
  }
  function keepPending(d){write('pending-official-draft',window.HalaqatiCertificateServer.serializableDraft(d))}
  async function ensureOfficial(){
    ensureAccount();const d=currentDraft();if(d._issuing)return d._issuing;
    if(d.serverRecord?.status==='voided')throw new Error('الشهادة ملغاة ولا يمكن إصدارها');
    const s={...currentSettings(),...d.snapshotSettings},snapshot=window.HalaqatiCertificateServer.snapshot(d,s),signature=JSON.stringify(snapshot);
    if(d.serverRecord?.status==='issued'){
      if(!live())throw new Error('التحقق من صلاحية الشهادة قبل الطباعة يحتاج اتصالًا');
      const latest=await window.HalaqatiCertificateServer.get(db,d.serverRecord.id);
      if(latest.status!=='issued'){d.serverRecord=latest;keepPending(d);throw new Error('الشهادة ملغاة أو لم تعد صالحة للإصدار')}
      if(latest.current_revision_id!==d.serverRecord.current_revision_id)throw new Error('تغيرت الشهادة على جهاز آخر؛ افتح النسخة الحالية من الأرشيف أولًا');
      if(d.officialSignature===signature)return d.serverRecord;
    }
    if(!live())throw new Error('الإصدار والتصحيح الرسمي يحتاجان اتصالًا بالخادم');
    d.serverId=d.serverId||offlineUuid();keepPending(d);const user=account;
    d._issuing=(async()=>{
      let row;
      if(d.serverRecord?.status==='issued'){
        const revision=await window.HalaqatiCertificateServer.revise(db,d.serverRecord,d,s,'نسخة مصححة من الويب');
        row={...d.serverRecord,render_snapshot:revision.render_snapshot,current_revision_id:revision.id,revision_count:revision.revision_no};
      }else row=await window.HalaqatiCertificateServer.issue(db,d,s,state.user.id);
      if(user!==state.user?.id)throw new Error('تغير الحساب أثناء الإصدار؛ حدّث الأرشيف في الحساب الأصلي');
      if(row.render_snapshot)Object.assign(d,window.HalaqatiCertificateServer.restore(row.render_snapshot,d,row));
      d.serverRecord=row;d.certificateNumber=row.certificate_number;d.officialSignature=JSON.stringify(window.HalaqatiCertificateServer.snapshot(d,s));
      central.loaded=false;keepPending({...d,_issuing:undefined});return row;
    })();
    try{return await d._issuing}finally{delete d._issuing}
  }
  function draftFromSnapshot(record,snap){
    resetDraft(snap.source?.web_type||({hifz:'khatam',sard:'sard'}[snap.certificate_type]||'monthly'));
    const d=currentDraft();Object.assign(d,window.HalaqatiCertificateServer.restore(snap,d,record));
    d.officialSignature=JSON.stringify(window.HalaqatiCertificateServer.snapshot(d,{...currentSettings(),...d.snapshotSettings}));
    stateLocal.tab='issue';render();
  }
  window.certRefreshCentral=()=>loadCentral(true);
  window.certOpenCentral=async function(id){
    const record=central.rows.find(x=>x.id===id),user=state.user?.id;if(!record)return;
    try{const rows=await window.HalaqatiCertificateServer.revisions(db,id);if(user!==state.user?.id)return;
      if(!rows.length)return toast('لا توجد لقطة قابلة لإعادة الإنشاء لهذه الشهادة');
      let dlg=document.getElementById('certRevisionsDlg');if(!dlg){dlg=document.createElement('dialog');dlg.id='certRevisionsDlg';document.body.appendChild(dlg)}
      dlg.innerHTML=`<div class="modal"><div class="modal-head"><h3>نسخ ${esc(record.certificate_number||'الشهادة')}</h3><button class="close" aria-label="إغلاق" onclick="document.getElementById('certRevisionsDlg').close()">✕</button></div><div class="notice">ملفات الصور والتواقيع لا تنتقل بين الأجهزة؛ راجعها قبل الطباعة. النسخ السابقة للعرض فقط.</div><div id="certRevisionRows"></div></div>`;
      rows.forEach(rev=>{const b=document.createElement('button');b.className='btn btn-soft';b.textContent=`نسخة ${rev.revision_no} · ${rev.note||String(rev.created_at||'').slice(0,10)}`;b.onclick=()=>{if(user!==state.user?.id)return;dlg.close();draftFromSnapshot(record,rev.render_snapshot);const d=currentDraft();d.historical=rev.id!==record.current_revision_id};dlg.querySelector('#certRevisionRows').appendChild(b)});dlg.showModal();
    }catch(e){toast('تعذر تحميل النسخ: '+e.message)}
  };
  window.certVoidCentral=async function(id){const reason=prompt('سبب إلغاء الشهادة (يبقى محفوظًا في الأرشيف):');if(!reason?.trim())return;try{const voided=await window.HalaqatiCertificateServer.void(db,id,reason);if(stateLocal.draft?.serverId===id){stateLocal.draft.serverRecord=voided;keepPending(stateLocal.draft)}await loadCentral(true);toast('أُلغيت الشهادة وبقي سجلها محفوظًا')}catch(e){toast('تعذر الإلغاء: '+e.message)}};
  window.certImportLocalCentral=async function(id){
    const row=archive().find(x=>x.id===id);if(!row||!confirm(`استيراد الشهادة القديمة ${row.number} إلى الأرشيف المشترك برقمها التاريخي؟ سيبقى الأصل المحلي محفوظًا.`))return;
    try{if(!live())throw new Error('الاستيراد يحتاج اتصالًا');const d={...row.details,type:row.type,studentId:row.studentId,studentName:row.studentName,halaqaId:row.halaqaId||studentById(row.studentId)?.halaqa_id,date:row.date||String(row.issuedAt).slice(0,10),style:row.style,serverId:offlineUuid(),title:row.details?.title||row.typeLabel,achievement:row.details?.achievement||row.typeLabel};await window.HalaqatiCertificateServer.importLegacy(db,d,currentSettings(),row.number);await loadCentral(true);toast('تم الاستيراد؛ الأصل المحلي محفوظ')}catch(e){toast('تعذر الاستيراد: '+e.message)}
  };

  window.certificatesPage=certificatesPage;window.certTab=setTab;window.certSet=setDraft;window.certReset=resetDraft;window.certResetText=resetTextField;window.certApplyTemplate=applyTemplate;window.certCalculateRanking=calculateRanking;window.certUseRank=useRank;window.certPrint=()=>printCertificate().catch(e=>{console.error(e);toast('تعذر فتح الطباعة: '+(e?.message||e))});window.certSavePdf=()=>savePdf(false).catch(e=>{console.error(e);toast('تعذر حفظ الشهادة: '+(e?.message||e))});window.certIssueToArchive=()=>issueToArchive(false).then(()=>{toast('تم إصدار الشهادة رسميًا وأرشفتها');render()}).catch(e=>toast('تعذر الإصدار: '+e.message));window.certDeleteArchive=deleteArchive;window.certReissue=reissue;window.certShareArchive=shareArchive;window.certExportArchive=exportArchive;window.certImportArchivePicker=importArchivePicker;window.stateCertArchiveSearch=archiveSearch;window.certSaveSettingsForm=saveSettingsForm;window.certResetSettings=resetSettings;window.certUploadSetting=uploadSetting;window.certBatchToggle=batchToggle;window.certBatchIssue=()=>batchIssue().catch(e=>{stateLocal.busy=false;toast('تعذر الإصدار الجماعي: '+(e?.message||e));render()});window.certPreviewZoom=setPreviewZoom;if(window.addEventListener)window.addEventListener('resize',()=>{if(state.page==='certificates'&&typeof requestAnimationFrame==='function')requestAnimationFrame(fitCertificatePreview)});window.HalaqatiCertificates={version:VERSION,settings:currentSettings,archive,nextCertificateNumber,certificateInnerHtml,idealScore,calculateRanking,fitCertificatePreview};
  console.info('Halaqati Certificates loaded',VERSION);
})();
