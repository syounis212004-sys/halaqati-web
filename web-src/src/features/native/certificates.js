/* RC27.40 native screens: certificates — web twin of CertificatesScreen (ReportsAndTools.kt) built with the NX kit.
   The legacy module (src/features/certificates/*) keeps owning the draft, numbering, PDF/print engines, the preview HTML and
   the RC24 server archive. This file only replaces the page chrome: it reads the draft out of the legacy page markup (parsed
   off-DOM) and renders NX controls that call the very same global handlers (certSet, certReset, certTab, certSavePdf …). */
(function(){'use strict';
  const NX=window.NX,legacy=window.certificatesPage,CS=window.HalaqatiCertificates,S=window.HalaqatiCertificateServer;
  if(!NX||typeof legacy!=='function'||!CS||!S)return;
  const h=NX.h,ic=(n,s,c)=>NX.icon(n,s,c);
  const live=()=>navigator.onLine&&!state.offline&&state.networkVerified!==false;
  const uid=()=>(state.user&&state.user.id)||'guest';
  const todayStr=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  // ---------- local UI state (Compose `remember`) ----------
  const ui={dsub:'templates',filter:'all',sort:'newest',q:'',limit:12,open:new Set(),tools:false,localOpen:false,bq:'',bcat:'all',cat:'all',uid:null,hidden:new Set()};
  const cen={rows:[],loaded:false,loading:false,error:''};
  let ro=null,autoPick=false;

  const TPL={
    emerald:{label:'الرسمي الفيروزي',primary:'#0b5f5b',secondary:'#8a4d22',accent:'#b9954a',paper:'#fbf7eb',ink:'#18211e'},
    royal:{label:'الملكي الأخضر',primary:'#174936',secondary:'#6f4523',accent:'#c5a350',paper:'#fffaf0',ink:'#17231e'},
    gold:{label:'الذهبي الفاخر',primary:'#53421d',secondary:'#7b4a22',accent:'#c89d3d',paper:'#fffaf2',ink:'#241f17'},
    blue:{label:'الأزرق الرسمي',primary:'#164f63',secondary:'#6b4928',accent:'#b99654',paper:'#f7f6ef',ink:'#172027'},
    minimal:{label:'الكلاسيكي الهادئ',primary:'#263b36',secondary:'#66482f',accent:'#a88a56',paper:'#fffdf8',ink:'#1f2724'}
  };
  const PRESETS=['#0B5F5B','#174936','#164F63','#6F2632','#C5A350','#8A4D22'];
  const DEF_LOGO={centerLogo:'./assets/certificates/center-logo.jpg',halaqaLogo:'./assets/certificates/halaqa-logo.jpg'};

  // ---------- small helpers ----------
  const hiddenKey=()=>'nx_cert_hidden_'+uid();
  function loadHidden(){try{ui.hidden=new Set(JSON.parse(localStorage.getItem(hiddenKey())||'[]'))}catch(_e){ui.hidden=new Set()}}
  function saveHidden(){try{localStorage.setItem(hiddenKey(),JSON.stringify([...ui.hidden]))}catch(_e){}}
  function syncUser(){if(ui.uid===uid())return;ui.uid=uid();cen.rows=[];cen.loaded=false;cen.loading=false;cen.error='';ui.open.clear();loadHidden()}
  function pendingDraft(){try{return JSON.parse(localStorage.getItem('halaqati_v241_certificates_'+uid()+'_pending-official-draft')||'null')}catch(_e){return null}}
  function silent(fn){const r=window.render;window.render=function(){};try{return fn()}finally{window.render=r}}
  const parse=html=>new DOMParser().parseFromString(html,'text/html');
  function detect(html){
    if(html.includes('cert-editor'))return 'issue';
    if(html.includes('cert-batch-list'))return 'batch';
    if(html.includes('cert-settings-grid'))return 'settings';
    if(html.includes('cert-template-list'))return 'templates';
    return 'archive';
  }
  function withConfirm(fn){const c=window.confirm;window.confirm=()=>true;try{return fn()}finally{window.confirm=c}}
  const re=()=>{if(state.page==='certificates')render()};
  const isProgram=()=>typeof window.rc27Scope==='function'&&window.rc27Scope().kind==='program';

  // ---------- read the legacy draft off-DOM ----------
  function readD(doc){
    const D={vals:{},opts:{},type:'',num:'',tpl:'',busy:false,zoom:92,paper:'',rank:null,rankNote:''};
    doc.querySelectorAll('[oninput],[onchange]').forEach(el=>{
      const code=(el.getAttribute('oninput')||'')+' '+(el.getAttribute('onchange')||'');
      const m=code.match(/certSet\('([^']+)'/);
      if(m){
        const k=m[1];D.vals[k]=el.type==='checkbox'?el.checked:el.value;
        if(el.tagName==='SELECT')D.opts[k]=[...el.options].map(o=>({value:o.value,label:o.textContent}));
        return;
      }
      if(el.tagName==='SELECT'&&/certReset\(this\.value\)/.test(code)){D.type=el.value;D.opts.type=[...el.options].map(o=>({value:o.value,label:o.textContent}))}
    });
    D.num=doc.querySelector('input[readonly][dir="ltr"]')?.value||'';
    const act=doc.querySelector('.cert-template.active');const am=act&&(act.getAttribute('onclick')||'').match(/'(\w+)'/);D.tpl=am?am[1]:'emerald';
    D.busy=!!doc.querySelector('button[onclick="certSavePdf()"][disabled]');
    D.zoom=Number(doc.querySelector('.cert-preview-zoom input')?.value)||92;
    D.paper=doc.getElementById('certificatePreviewPaper')?.innerHTML||'';
    const rr=doc.querySelector('.cert-ranking-result');
    if(rr)D.rank=[...rr.querySelectorAll('button')].map(b=>({i:(b.getAttribute('onclick')||'').match(/\((\d+)\)/)?.[1],name:b.querySelector('strong')?.textContent||'',meta:b.querySelector('em')?.textContent||''}));
    D.rankNote=doc.querySelector('.cert-editor .notice')?.textContent||'';
    return D;
  }
  function readBatch(doc){
    const rows=[...doc.querySelectorAll('.cert-batch-list label')].map(l=>{
      const inp=l.querySelector('input'),m=(inp?.getAttribute('onchange')||'').match(/certBatchToggle\('([^']+)'/);
      return {id:m?m[1]:'',checked:!!inp?.checked,name:l.querySelector('span')?.textContent||'',meta:l.querySelector('small')?.textContent||''};
    }).filter(x=>x.id);
    return {rows,busy:!!doc.querySelector('button[onclick="certBatchIssue()"][disabled]')};
  }
  const studentOf=id=>(state.students||[]).find(s=>String(s.id)===String(id))||null;
  const catName=id=>{const c=(state.categories||[]).find(x=>String(x.id)===String(id));return c?c.name:'غير مصنف'};
  const catOfStudent=id=>{const s=studentOf(id);return s&&s.category_id?catName(s.category_id):'غير مصنف'};

  // ---------- components ----------
  const sel=(label,opts,value,onchange,o={})=>NX.select(label,opts,{value,onchange,id:o.id,cls:o.cls});
  const slider=(label,key,min,max,val,unit)=>`<div class="nc-slider"><div class="nc-slider-h"><span>${label}</span><b>${h(val)}${unit||''}</b></div><input type="range" min="${min}" max="${max}" value="${h(val)}" oninput="this.previousElementSibling.querySelector('b').textContent=this.value+'${unit||''}';certSet('${key}',Number(this.value))"></div>`;
  const toggle=(label,key,val)=>`<div class="nc-toggle">${NX.switchRow(h(label),!!val,`certSet('style.${key}',this.checked)`)}</div>`;
  function chipGrid(items,cols){return `<div class="nc-chipgrid c${cols||2}">${items.map(i=>NX.chip(i.label,{selected:i.selected,check:false,onclick:i.onclick})).join('')}</div>`}
  function menuBtn(items,label,icon){
    const k=((NX.kebab(items).match(/NX\.openMenu\(this,'(m\d+)'\)/))||[])[1];
    return `<button type="button" class="nx-btn nx-text nx-small" aria-haspopup="menu" onclick="event.stopPropagation();NX.openMenu(this,'${k}')">${ic(icon||'Tune',18)}<span>${label}</span></button>`;
  }
  function templateCard(key,selected){
    const t=TPL[key];
    return `<button type="button" class="nc-tpl ${selected?'on':''}" onclick="certApplyTemplate('${key}')" aria-pressed="${selected}">
      <span class="nc-tpl-art" style="background:${t.paper};border-color:${t.primary}"><span class="nc-tpl-in" style="border-color:${t.accent}"><b style="color:${t.primary}">شهادة</b><hr style="border-color:${t.accent}"><em style="color:${t.secondary}">الطالب</em></span>${selected?`<i class="nc-tpl-ck">${ic('Check',14)}</i>`:''}</span>
      <span class="nc-tpl-l">${t.label}</span></button>`;
  }
  function colorField(key,label,fallback,val,tplKey){
    const k='style.'+key,v=val||fallback;
    return `<div class="nc-color" data-k="${key}"><label class="nx-field"><span>${label}</span>
      <div class="nc-color-in"><i class="nc-sw" style="background:${h(v)}"></i><input class="nc-hex" dir="ltr" maxlength="7" value="${h(v)}" placeholder="${fallback}" oninput="NC.color('${k}',this.value,this)"><input type="color" class="nc-pick" value="${h(/^#[0-9a-f]{6}$/i.test(v)?v:fallback)}" oninput="NC.color('${k}',this.value,this)" aria-label="${label}"><button type="button" class="nx-iconbtn" title="لون القالب" aria-label="لون القالب" onclick="NC.color('${k}','${h(TPL[tplKey]?TPL[tplKey][key]:fallback)}',this)">${ic('Restore',20)}</button></div></label>
      <div class="nc-presets">${PRESETS.map(p=>`<button type="button" class="nc-preset ${v.toLowerCase()===p.toLowerCase()?'on':''}" data-hex="${p.toLowerCase()}" style="background:${p}" aria-label="${p}" onclick="NC.color('${k}','${p.toLowerCase()}',this)"></button>`).join('')}</div></div>`;
  }
  const textField=(label,key,val,rows)=>`<div class="nc-text"><div class="nc-text-h"><b>${label}</b>${NX.btn('الافتراضي',{kind:'text',small:true,icon:'Restore',onclick:`certResetText('${key}')`})}</div><label class="nx-field">${rows>1?`<textarea rows="${rows}" oninput="certSet('${key}',this.value)">${h(val)}</textarea>`:`<input value="${h(val)}" oninput="certSet('${key}',this.value)">`}</label></div>`;
  function assetRow(key,label,icon,custom){
    return `<div class="nc-asset"><span class="nc-asset-ic ${custom?'on':''}">${ic(icon,22)}</span><div class="nx-grow"><b>${label}</b><small class="${custom?'ok':''}">${custom?'مخصص ومحفوظ محليًا':'يُستخدم الافتراضي عند توفره'}</small></div>${NX.btn(custom?'استبدال':'اختيار',{kind:'text',onclick:`NC.pick('${key}')`})}${custom?NX.iconBtn('DeleteOutline',{title:'إزالة '+label,onclick:`NC.dropAsset('${key}')`}):''}</div>`;
  }
  function assetsHtml(){
    const s=CS.settings();
    const has=k=>!!s[k]&&s[k]!==DEF_LOGO[k];
    return `<p class="nc-h">الصور محلية فقط</p><p class="nc-sub">لا يتم رفع الشعار أو التوقيع أو الختم أو ملف PDF إلى Supabase.</p><div class="nx-stack-s">${[['centerLogo','شعار المركز','AccountBalance'],['halaqaLogo','شعار الحلقة','AutoStories'],['teacherSignature','توقيع المحفظ','Draw'],['supervisorSignature','توقيع المشرف','Draw'],['stampImage','الختم الرسمي','Verified']].map(([k,l,i])=>assetRow(k,l,i,has(k))).join('')}</div>`;
  }

  // ---------- issue / batch studio ----------
  function typeChips(D,batch){
    return `<p class="nc-h">نوع الشهادة</p>${chipGrid((D.opts.type||[]).filter(o=>!(batch&&o.value==='rank')).map(o=>({label:h(o.label),selected:D.type===o.value,onclick:`certReset('${o.value}')`})),2)}`;
  }
  function bulkCard(batch){
    return NX.card(`<div class="nx-row"><span class="nc-ic">${ic('Groups',24)}</span><div class="nx-grow"><b class="nc-t">الإصدار الجماعي</b><small class="nc-sub">الطلاب مرتّبون حسب الفئة؛ لكل طالب رقم رسمي وملف PDF مستقل محليًا</small></div><input type="checkbox" class="nx-switch" ${batch?'checked':''} aria-label="الإصدار الجماعي" onchange="NC.bulk(this.checked)"></div>`,{cls:'nx-emph'});
  }
  function categoryOptions(){return [{value:'all',label:'جميع الفئات'}].concat((state.categories||[]).filter(c=>c.active!==false).map(c=>({value:c.id,label:c.name||'فئة'})))}
  function sortedStudents(opts){
    return opts.map(o=>({...o,cat:catOfStudent(o.value)})).sort((a,b)=>a.cat.localeCompare(b.cat,'ar')||a.label.localeCompare(b.label,'ar'));
  }
  function singleStudent(D){
    const all=D.opts.studentId||[];
    if(!all.length)return NX.notice('لا يوجد طلاب نشطون لإصدار شهادة','warning');
    const cur=D.vals.studentId;
    const list=sortedStudents(all).filter(o=>ui.cat==='all'||String(studentOf(o.value)?.category_id)===String(ui.cat)||o.value===cur);
    return `<div class="nc-two">${sel('الفئة',categoryOptions(),ui.cat,'NC.cat(this.value)')}${sel('الطالب · مرتب حسب الفئة ثم الاسم',list.map(o=>({value:o.value,label:`${o.cat} · ${o.label}`})),cur,"certSet('studentId',this.value)")}</div>`;
  }
  function batchStudents(B){
    const q=ui.bq.trim().toLowerCase();
    const rows=sortedStudents(B.rows.map(r=>({value:r.id,label:r.name,r}))).filter(o=>(ui.bcat==='all'||String(studentOf(o.value)?.category_id)===String(ui.bcat))&&(!q||o.label.toLowerCase().includes(q)));
    const n=B.rows.filter(r=>r.checked).length;
    return `${NX.search(ui.bq,'بحث باسم الطالب',{oninput:"NC.bq(this.value)"})}
      ${sel('الفئة',categoryOptions(),ui.bcat,'NC.bcat(this.value)')}
      <div class="nx-row nc-btnrow">${NX.btn('تحديد الكل',{kind:'outlined',cls:'nx-grow',onclick:'NC.bsel(true)'})}${NX.btn('إلغاء التحديد',{kind:'outlined',cls:'nx-grow',disabled:!n,onclick:'NC.bsel(false)'})}</div>
      <p class="nc-count">تم تحديد ${n} طالب</p>
      <div class="nc-blist" data-nc="blist">${batchRows(rows)}</div>`;
  }
  function batchRows(rows){
    if(!rows.length)return NX.empty('لا يوجد طلاب مطابقون',{icon:'SearchOff'});
    return rows.map(o=>{const r=o.r,st=studentOf(r.id),trk=st&&st.track_code==='tathbit'?'التثبيت':'الحفظ العام';
      return `<label class="nx-card nc-brow ${r.checked?'on':''}"><input type="checkbox" class="nc-chk" ${r.checked?'checked':''} onchange="certBatchToggle('${h(r.id)}',this.checked)"><span class="nx-grow"><b>${h(r.name)}</b><small>${h(o.cat)}</small></span><em>${trk}</em></label>`}).join('');
  }
  function numberDate(D,batch){
    const pd=pendingDraft(),date=(pd&&/^\d{4}-\d{2}-\d{2}$/.test(pd.date||'')&&pd.date)||todayStr();
    const dateF=NX.field(batch?'تاريخ الشهادات':'تاريخ الشهادة',{type:'date',value:date,onchange:'NC.date(this.value)'});
    if(batch)return dateF;
    const n=!D.num||/^مسودة/.test(D.num)?'سيُخصص عند الإصدار':D.num;
    return `<div class="nc-two">${NX.field('رقم الشهادة',{value:n,cls:'nc-ro',html:`<input dir="auto" value="${h(n)}" readonly aria-label="الرقم الرسمي يصدر من الخادم">`})}${dateF}</div>`;
  }
  function typeFields(D){
    const v=D.vals,t=D.type;
    if(t==='sard')return `<div class="nc-two">${sel('من الجزء',D.opts.fromJuz||[],v.fromJuz,"certSet('fromJuz',Number(this.value))")}${sel('إلى الجزء',D.opts.toJuz||[],v.toJuz,"certSet('toJuz',Number(this.value))")}</div>`;
    if(t==='tajweed'||t==='excellence')return NX.field(t==='tajweed'?'المستوى أو المقرر (اختياري)':'سبب التميز',{value:v.reason||'',placeholder:t==='tajweed'?'مثال: المستوى الأول — أحكام النون الساكنة':'مثال: الإتقان وحسن الأداء',oninput:"certSet('reason',this.value)"});
    if(t==='monthly')return `<div class="nc-two">${NX.field('الشهر والسنة',{type:'month',value:v.month,onchange:"certSet('month',this.value)"})}${NX.field('سبب التميز',{value:v.reason||'',placeholder:'مثال: المواظبة وحسن الأداء',oninput:"certSet('reason',this.value)"})}</div>`;
    if(t==='ideal'){
      const f=[['ethics','الأخلاق'],['discipline','الالتزام'],['attendance','الحضور'],['memorization','الحفظ والجدية']];
      const sc=NC.score(v);
      return `<div class="nc-ideal"><p class="nc-h">معايير الطالب المثالي</p><div class="nc-two">${f.map(([k,l])=>NX.field(l,{type:'number',min:0,max:100,inputmode:'numeric',value:v[k]==null?100:v[k],oninput:`NC.ideal(this,'${k}')`})).join('')}</div><p class="nc-score">الدرجة التقديرية: <b>${sc}</b>/100</p></div>`;
    }
    if(t==='rank'){
      const per=v.periodMode;
      return `<div class="nc-rank"><div class="nc-two">${sel('المركز',D.opts.rank||[],v.rank,"certSet('rank',Number(this.value))")}${sel('الفئة',D.opts.categoryId||[],v.categoryId,"certSet('categoryId',this.value)")}</div>
        ${isProgram()?'':`<div class="nc-chips-row">${NX.chip('الحفظ العام',{selected:v.track!=='tathbit',check:false,onclick:"certSet('track','general_hifz');render()"})}${NX.chip('التثبيت',{selected:v.track==='tathbit',check:false,onclick:"certSet('track','tathbit');render()"})}</div>`}
        <div class="nc-two">${sel('الحلقة',D.opts.halaqaId||[],v.halaqaId,"certSet('halaqaId',this.value)")}${sel('الفترة',D.opts.periodMode||[],per,"certSet('periodMode',this.value);render()")}</div>
        <div class="nc-two">${per==='month'?NX.field('الشهر',{type:'month',value:v.periodMonth,onchange:"certSet('periodMonth',this.value)"}):per==='months'?NX.field('من شهر',{type:'month',value:v.periodFromMonth,onchange:"certSet('periodFromMonth',this.value)"})+NX.field('إلى شهر',{type:'month',value:v.periodToMonth,onchange:"certSet('periodToMonth',this.value)"}):NX.field('من',{type:'date',value:v.periodFrom,onchange:"certSet('periodFrom',this.value)"})+NX.field('إلى',{type:'date',value:v.periodTo,onchange:"certSet('periodTo',this.value)"})}</div>
        ${NX.btn('حساب أول 3 حسب النقاط',{kind:'tonal',full:true,icon:'EmojiEvents',onclick:'certCalculateRanking()'})}${rankResult(D)}</div>`;
    }
    return '';
  }
  function rankResult(D){
    if(D.rank)return `<div class="nc-rankres"><b>النتيجة حسب النقاط</b>${D.rank.length?D.rank.slice(0,3).map(r=>`<button type="button" onclick="certUseRank(${r.i})"><span class="nc-rn">${Number(r.i)+1}</span><strong>${h(r.name)}</strong><em>${h(r.meta)}</em></button>`).join(''):'<p class="nc-sub">لا توجد بيانات كافية.</p>'}</div>`;
    if(D.rankNote)return NX.notice(h(D.rankNote),/جاري/.test(D.rankNote)?'info':'danger');
    return '';
  }
  function textsCard(D){
    const v=D.vals,s=CS.settings();
    return NX.card(`<div class="nx-row nc-cardhead"><span class="nc-ic">${ic('Description',24)}</span><div class="nx-grow"><b class="nc-t">نصوص وهوية الشهادة</b><small class="nc-sub">كل حقل قابل للتعديل مع استعادة الافتراضي.</small></div></div>
      ${textField('عنوان الشهادة','title',v.title||'',1)}${textField('المقدمة','intro',v.intro||'',2)}${textField('نص الإنجاز','achievement',v.achievement||'',3)}${textField('الدعاء / الخاتمة','dua',v.dua||'',2)}
      <div class="nc-ident"><span>${ic('AccountBalance',18)}${h(s.centerName)}</span><span>${ic('AutoStories',18)}${h(s.halaqaName)}</span>${NX.btn('تعديل الهوية والتوقيعات',{kind:'text',small:true,onclick:"certTab('settings')"})}</div>`,{cls:'nx-emph nc-pad'});
  }
  function designTemplates(D){
    const v=D.vals;
    return `<p class="nc-h">اختر قالبًا بصريًا</p><p class="nc-sub">النصوص لا تتغير عند تبديل القالب؛ الذي يتغير هو الإطار والزخرفة ولوحة الألوان فقط.</p>
      <div class="nc-tplgrid">${Object.keys(TPL).map(k=>templateCard(k,D.tpl===k)).join('')}</div>
      ${slider('سماكة الإطار','style.borderWidth',1,6,v['style.borderWidth']??3,'px')}${slider('قوة الزخارف','style.ornamentOpacity',0,100,v['style.ornamentOpacity']??82,'%')}`;
  }
  function designTypography(D){
    const v=D.vals,fam=v['style.fontFamily']||'Cairo';
    return `<p class="nc-h">الخط</p>${chipGrid([['Cairo','Cairo'],['Tahoma','Tahoma'],['Arial','Arial'],['serif','Serif'],['custom','خط الجهاز']].map(([k,l])=>({label:l,selected:fam===k,onclick:`certSet('style.fontFamily','${k}');render()`})),3)}
      ${fam==='custom'?NX.field('اسم الخط المثبت على الجهاز',{value:v['style.customFont']||'',placeholder:'مثال: Noto Naskh Arabic',oninput:"certSet('style.customFont',this.value)"}):''}
      ${slider('حجم العنوان','style.titleSize',30,64,v['style.titleSize']??44,'px')}${slider('حجم اسم الطالب','style.studentSize',28,58,v['style.studentSize']??38,'px')}${slider('حجم نص الإنجاز','style.bodySize',15,28,v['style.bodySize']??20,'px')}${slider('حجم الشعارات','style.logoSize',100,230,v['style.logoSize']??168,'px')}
      ${NX.divider()}<p class="nc-h">ألوان الشهادة</p><p class="nc-sub">اضغط اللون الجاهز أو اكتب HEX. زر الاستعادة يعيد لون القالب.</p>
      <div class="nc-colors">${colorField('primary','الرئيسي','#0b5f5b',v['style.primary'],D.tpl)}${colorField('accent','الذهبي','#c5a350',v['style.accent'],D.tpl)}${colorField('secondary','الثانوي','#8a4d22',v['style.secondary'],D.tpl)}${colorField('paper','الخلفية','#fbf7eb',v['style.paper'],D.tpl)}${colorField('ink','النص','#18211e',v['style.ink'],D.tpl)}</div>`;
  }
  function designElements(D){
    const v=D.vals,pos=v['style.numberPosition']||'under-logo';
    return `<p class="nc-h">عناصر الشهادة</p><div class="nx-stack-s">${toggle('الآية في التذييل','showVerse',v['style.showVerse'])}${toggle('الشعارات','showLogos',v['style.showLogos'])}${toggle('التوقيعات','showSignatures',v['style.showSignatures'])}${toggle('الختم','showStamp',v['style.showStamp'])}${toggle('التاريخ الميلادي والهجري','showDates',v['style.showDates'])}${toggle('رقم الشهادة','showNumber',v['style.showNumber'])}</div>
      <p class="nc-h">موضع رقم الشهادة</p>${chipGrid([['under-logo','أسفل شعار المركز'],['top','أعلى الوسط'],['bottom-right','أسفل يمين'],['bottom-left','أسفل يسار']].map(([k,l])=>({label:l,selected:pos===k,onclick:`certSet('style.numberPosition','${k}');render()`})),2)}`;
  }
  function designAssets(){return assetsHtml()+NX.btn('استعادة تصميم v2.44 الافتراضي',{kind:'outlined',full:true,icon:'RestartAlt',onclick:'NC.resetAll()'})}
  function designCard(D){
    const subs=[['templates','القوالب'],['typography','الخط والألوان'],['elements','العناصر'],['assets','الشعارات والصور']];
    const body=ui.dsub==='typography'?designTypography(D):ui.dsub==='elements'?designElements(D):ui.dsub==='assets'?designAssets():designTemplates(D);
    return NX.card(`<div class="nx-row nc-cardhead"><span class="nc-ic">${ic('Palette',24)}</span><div class="nx-grow"><b class="nc-t">استوديو تصميم الشهادة</b><small class="nc-sub">كل التخصيصات مباشرة، والملفات والصور تبقى محلية على الجهاز.</small></div></div>
      ${chipGrid(subs.map(([k,l])=>({label:l,selected:ui.dsub===k,onclick:`NC.sub('${k}')`})),2)}<div class="nc-dbody">${body}</div>`,{cls:'nx-emph nc-pad'});
  }
  function previewCard(D){
    return `<div class="nc-prev"><div class="nc-prev-h"><b>المعاينة A4</b><input type="range" min="70" max="120" value="${D.zoom}" aria-label="تكبير المعاينة" oninput="certPreviewZoom(Number(this.value));this.nextElementSibling.textContent=this.value+'%'"><b class="nc-pct">${D.zoom}%</b></div><div class="cert-preview-shell"><div class="cert-preview-stage"><div id="certificatePreviewPaper">${D.paper}</div></div></div></div>`;
  }
  function actions(D,batch,B){
    if(batch){
      const n=B.rows.filter(r=>r.checked).length;
      return `<div class="nc-actions">${NX.btn(B.busy&&n?'جاري إنشاء الشهادات…':`إصدار ${n||''} شهادة PDF`,{icon:'Groups',full:true,cls:'nc-primary',disabled:!n||B.busy,onclick:'certBatchIssue()'})}</div>`;
    }
    const editing=D.num&&!/^مسودة/.test(D.num);
    return `<div class="nc-actions">${NX.btn(D.busy?'جاري إنشاء الشهادة…':editing?'إنشاء النسخة المصححة بنفس الرقم':'إصدار وحفظ PDF',{icon:'WorkspacePremium',full:true,cls:'nc-primary',disabled:D.busy,onclick:'certSavePdf()'})}
      <div class="nx-row nc-btnrow">${NX.btn('طباعة',{kind:'tonal',icon:'Description',cls:'nx-grow',onclick:'certPrint()'})}${NX.btn('إصدار رسمي وحفظ في الأرشيف',{kind:'outlined',icon:'Archive',cls:'nx-grow',onclick:'certIssueToArchive(false)'})}</div>
      ${NX.btn('إعادة ضبط',{kind:'text',icon:'RestartAlt',full:true,onclick:`certReset('${D.type}')`})}</div>`;
  }

  // ---------- tabs ----------
  function tabsHtml(cur){
    return NX.chips([['issue','إصدار شهادة'],['batch','إصدار جماعي'],['archive','الأرشيف'],['templates','القوالب'],['settings','الإعدادات']].map(([k,l])=>({label:l,selected:cur===k,check:false,onclick:`certTab('${k}')`})),{});
  }
  function headerHtml(){
    return `<div class="nc-head"><span class="nc-head-ic">${ic('WorkspacePremium',22)}</span><div class="nx-grow"><b>مركز الشهادات</b><small>تحرير · معاينة A4 · إصدار وأرشفة</small></div><span class="nc-ver">RC27.40</span></div>`;
  }

  // ---------- settings / templates tabs ----------
  function settingsHtml(){
    const s=CS.settings();
    const identity=NX.card(`<div class="nx-row nc-cardhead"><span class="nc-ic">${ic('AccountBalance',24)}</span><div class="nx-grow"><b class="nc-t">الهوية والتوقيعات</b><small class="nc-sub">تظهر في ترويسة الشهادة وتوقيعاتها.</small></div></div>
      ${NX.field('اسم المركز',{id:'certSetCenter',value:s.centerName})}${NX.field('اسم الحلقة',{id:'certSetHalaqa',value:s.halaqaName})}${NX.field('المحفظ',{id:'certSetTeacher',value:s.teacher})}${NX.field('المشرف',{id:'certSetSupervisor',value:s.supervisor})}
      ${NX.btn('حفظ الإعدادات',{full:true,icon:'Save',onclick:'certSaveSettingsForm()'})}`,{cls:'nx-emph nc-pad'});
    const assets=NX.card(`<div class="nx-row nc-cardhead"><span class="nc-ic">${ic('Image',24)}</span><div class="nx-grow"><b class="nc-t">الشعارات والتوقيعات</b><small class="nc-sub">صور محلية تُضغط وتُحفظ على هذا الجهاز.</small></div></div>${assetsHtml()}`,{cls:'nx-emph nc-pad'});
    const defaults=NX.card(`<div class="nx-row nc-cardhead"><span class="nc-ic">${ic('Tune',24)}</span><div class="nx-grow"><b class="nc-t">الإعدادات الافتراضية</b></div></div>
      ${NX.select('القالب الافتراضي',Object.keys(TPL).map(k=>({value:k,label:TPL[k].label})),{id:'certDefaultTemplate',value:s.defaultTemplate})}${NX.field('الآية السفلية',{id:'certVerse',value:s.verse})}
      ${NX.notice('ملفات الصور والتوقيعات تحفظ محليًا على هذا الجهاز ولا ترفع إلى Supabase.','info')}
      <div class="nx-row nc-btnrow">${NX.btn('حفظ الإعدادات',{cls:'nx-grow',icon:'Save',onclick:'certSaveSettingsForm()'})}${NX.btn('استعادة الافتراضي',{kind:'outlined',cls:'nx-grow',icon:'RestartAlt',onclick:'NC.resetAll()'})}</div>`,{cls:'nx-emph nc-pad'});
    return `<div class="nx-stack">${identity}${assets}${defaults}</div>`;
  }
  function templatesHtml(D){
    return `<div class="nx-stack">${NX.card(`<div class="nx-row nc-cardhead"><span class="nc-ic">${ic('Palette',24)}</span><div class="nx-grow"><b class="nc-t">قوالب الشهادات</b><small class="nc-sub">خمسة قوالب جاهزة، وكل قالب قابل لتغيير ألوانه وخطه وأحجامه قبل الإصدار.</small></div></div>${designTemplates(D)}`,{cls:'nx-emph nc-pad'})}${NX.notice('اختيار القالب هنا يضبط ألوان القالب الحالي فقط. ويمكن حفظ القالب المفضّل كافتراضي من الإعدادات.','info')}${NX.btn('الخط والألوان والعناصر',{kind:'tonal',full:true,icon:'Palette',onclick:"NC.sub('typography');certTab('issue')"})}</div>`;
  }

  // ---------- archive ----------
  const nameOf=c=>(c.snapshot&&c.snapshot.student_name)||(studentOf(c.student_id)&&studentOf(c.student_id).full_name)||'طالب';
  const official=()=>cen.rows.filter(c=>c.certificate_number);
  function visible(){
    const q=ui.q.trim().toLowerCase(),H=ui.hidden;
    let r=official().filter(c=>ui.filter==='hidden'?H.has(c.id):!H.has(c.id)&&(ui.filter==='issued'?c.status==='issued':ui.filter==='voided'?c.status==='voided':ui.filter==='legacy'?!!c.legacy_partial:true));
    if(q)r=r.filter(c=>String(c.certificate_number).toLowerCase().includes(q)||nameOf(c).toLowerCase().includes(q));
    const cmp={oldest:(a,b)=>String(a.issue_date||'').localeCompare(b.issue_date||'')||String(a.certificate_number).localeCompare(b.certificate_number),
      name:(a,b)=>nameOf(a).localeCompare(nameOf(b),'ar')||String(a.certificate_number).localeCompare(b.certificate_number),
      number:(a,b)=>String(a.certificate_number).localeCompare(b.certificate_number),
      newest:(a,b)=>String(b.issue_date||'').localeCompare(a.issue_date||'')||String(b.certificate_number).localeCompare(a.certificate_number)}[ui.sort]||null;
    return r.sort(cmp);
  }
  const statusOf=c=>ui.hidden.has(c.id)?['مخفية','info']:c.status==='voided'?['ملغاة','danger']:c.status==='issued'?['سارية','success']:['مسودة','info'];
  function offRow(c,compact){
    const [stT,stK]=statusOf(c),open=!compact&&ui.open.has(c.id),id=h(c.id);
    const meta=`${c.certificate_number} · ${c.series_key||c.certificate_type||''} · ${c.issue_date||''} · v${Math.max(1,Number(c.revision_count)||1)}`;
    const det=open?`<div class="nc-arow-d">${c.status==='voided'&&c.void_reason?`<p class="nc-sub">سبب الإلغاء: ${h(c.void_reason)}</p>`:''}${c.legacy_partial?`<p class="nc-sub">شهادة قديمة: بيانات التصميم الأصلية غير مكتملة؛ لن نخترع نصًا أو أصلًا بصريًا مفقودًا.</p>`:''}
      <div class="nx-row nc-btnrow">${NX.btn('إنشاء نسخة مصححة',{kind:'outlined',cls:'nx-grow',disabled:!(c.status==='issued'&&!c.legacy_partial),onclick:`event.stopPropagation();NC.edit('${id}')`})}${NX.btn('المزيد…',{kind:'outlined',cls:'nx-grow',onclick:`event.stopPropagation();NC.manage('${id}')`})}</div></div>`:'';
    return `<div class="nx-card nx-click nc-arow ${open?'open':''} ${compact?'compact':''}" tabindex="0" role="button" onclick="${compact?`NC.manage('${id}')`:`NC.toggle('${id}')`}" onkeydown="if(event.key==='Enter')this.click()">
      <div class="nc-arow-h"><div class="nx-grow"><b class="nx-ellipsis">${h(nameOf(c))}</b><small class="nx-ellipsis" dir="auto">${h(meta)}</small></div>${NX.pill(stT,stK)}${c.legacy_partial?NX.pill('قديمة','warning'):''}
      ${!compact&&isOwner()?NX.iconBtn('DeleteOutline',{title:'حذف نهائي',cls:'nc-del',onclick:`event.stopPropagation();NC.del('${id}')`}):''}${compact?'':NX.iconBtn('MoreVert',{title:'إجراءات',onclick:`event.stopPropagation();NC.manage('${id}')`})}</div>${det}</div>`;
  }
  function archHead(){
    const o=official(),H=ui.hidden;
    return `<div class="nx-row nc-archhead"><div class="nx-grow"><b class="nc-t">الأرشيف الرسمي للشهادات</b><small class="nc-sub">${o.filter(c=>c.status==='issued').length} سارية · ${o.filter(c=>c.status==='voided').length} ملغاة · ${o.filter(c=>H.has(c.id)).length} مخفية</small></div>
      ${menuBtn([['newest','الأحدث'],['oldest','الأقدم'],['name','حسب الاسم'],['number','حسب الرقم']].map(([k,l])=>({label:l,icon:ui.sort===k?'Check':'',onclick:()=>{ui.sort=k;ui.limit=12;paint()}})),({oldest:'الأقدم',name:'الاسم',number:'الرقم'}[ui.sort])||'الأحدث','Tune')}
      ${NX.iconBtn('Refresh',{title:'تحديث',disabled:cen.loading,onclick:'NC.refresh()'})}</div>`;
  }
  function archList(compact){
    const o=official(),H=ui.hidden,rows=visible();
    const cnt=f=>o.filter(c=>f==='hidden'?H.has(c.id):!H.has(c.id)&&(f==='issued'?c.status==='issued':f==='voided'?c.status==='voided':f==='legacy'?!!c.legacy_partial:true)).length;
    let out='';
    if(cen.error)out+=NX.notice('تعذر تحميل الأرشيف: '+h(cen.error)+' '+NX.btn('إعادة المحاولة',{kind:'text',small:true,onclick:'NC.refresh()'}),'danger');
    if(!live())out+=NX.notice('الأرشيف المشترك يحتاج اتصالًا. الأرشيف المحلي السابق متاح أسفل الصفحة.','warning');
    if(!compact)out+=NX.chips([['all','الكل'],['issued','سارية'],['voided','ملغاة'],['legacy','قديمة'],['hidden','مخفية']].map(([k,l])=>({label:`${l} (${cnt(k)})`,selected:ui.filter===k,check:false,onclick:`NC.filter('${k}')`})),{});
    if(cen.loading&&!cen.loaded)out+=NX.skeleton(2);
    else if(!rows.length&&!cen.error)out+=NX.empty('لا توجد نتائج في هذا العرض',{icon:'Inventory2'});
    const lim=compact?6:ui.limit;
    out+=`<div class="nc-alist">${rows.slice(0,lim).map(c=>offRow(c,compact)).join('')}</div>`;
    if(rows.length>lim)out+=compact?NX.btn(`عرض الكل (${rows.length})`,{kind:'outlined',full:true,onclick:"certTab('archive')"}):NX.btn(`عرض المزيد (${rows.length-lim})`,{kind:'outlined',full:true,onclick:'NC.more()'});
    return out;
  }
  function localRows(){
    const q=ui.q.trim().toLowerCase();let r=CS.archive();
    if(q)r=r.filter(x=>`${x.studentName} ${x.number} ${x.typeLabel}`.toLowerCase().includes(q));
    return r;
  }
  function archSide(){
    const loc=CS.archive(),rows=localRows();
    const tools=`<button type="button" class="nc-fold" aria-expanded="${ui.tools}" onclick="NC.tools()">${ic('Settings',20)}<span class="nx-grow">أدوات الأرشيف</span>${ic(ui.tools?'ExpandLess':'ExpandMore',22)}</button>
      ${ui.tools?`<div class="nc-foldbody"><div class="nx-row nc-btnrow">${NX.btn('تصدير JSON',{kind:'outlined',icon:'Download',cls:'nx-grow',onclick:'certExportArchive()'})}${NX.btn('استيراد JSON',{kind:'outlined',icon:'Archive',cls:'nx-grow',onclick:'certImportArchivePicker()'})}</div><p class="nc-sub">Supabase يحتفظ بالرقم الرسمي والنص/إعدادات كل إصدار فقط. ملفات PDF والصور والتواقيع تبقى على الجهاز.</p></div>`:''}`;
    const local=`<button type="button" class="nc-fold" aria-expanded="${ui.localOpen}" onclick="NC.localToggle()">${ic('Inventory2',20)}<span class="nx-grow">نسخ هذا الجهاز (${loc.length})</span>${ic(ui.localOpen?'ExpandLess':'ExpandMore',22)}</button>
      ${ui.localOpen?(rows.length?`<div class="nc-alist">${rows.map(x=>`<div class="nx-card nc-lrow"><div class="nx-grow"><b class="nx-ellipsis">${h(x.studentName)}</b><small class="nx-ellipsis" dir="auto">${h(x.number)} · ${h(x.typeLabel||'')} · ${h(x.date||'')}</small></div>
        ${NX.iconBtn('ContentCopy',{title:'إعادة إنشاء كنسخة جديدة',onclick:`NC.reuse('${h(x.id)}')`})}${x.uri?NX.iconBtn('Share',{title:'مشاركة',onclick:`certShareArchive('${h(x.id)}')`}):''}${NX.iconBtn('Inventory2',{title:'نقل للأرشيف المشترك',onclick:`NC.toCentral('${h(x.id)}')`})}${NX.iconBtn('DeleteOutline',{title:'حذف من هذا الجهاز',cls:'nc-del',onclick:`NC.delLocal('${h(x.id)}')`})}</div>`).join('')}</div>`:NX.empty('لا توجد شهادات مؤرشفة على هذا الجهاز',{icon:'Inventory2'})):''}`;
    return `<div class="nx-stack-s">${tools}${local}</div>`;
  }
  function archSearch(){return NX.search(ui.q,'بحث بالطالب أو رقم الشهادة',{oninput:'NC.q(this.value)'})}
  function archFull(){return `<section class="nc-arch"><div data-nc-arch="head">${archHead()}</div>${archSearch()}<div class="nx-stack-s" data-nc-arch="list">${archList(false)}</div></section>`}
  function archAside(){return `<section class="nc-arch nc-compact"><div class="nx-row nc-archhead"><div class="nx-grow"><b class="nc-t">الأرشيف الرسمي</b></div>${NX.iconBtn('Refresh',{title:'تحديث',disabled:cen.loading,onclick:'NC.refresh()'})}</div>${archSearch()}<div class="nx-stack-s" data-nc-arch="alist">${archList(true)}</div></section>`}
  function paint(){
    const map={head:archHead,list:()=>archList(false),side:archSide,alist:()=>archList(true)};
    document.querySelectorAll('[data-nc-arch]').forEach(el=>{const f=map[el.dataset.ncArch];if(f)el.innerHTML=f()});
  }

  // ---------- page ----------
  function afterMount(){
    try{
      const shell=document.querySelector('.nc-root .cert-preview-shell');
      if(ro){ro.disconnect();ro=null}
      if(shell){CS.fitCertificatePreview();if(typeof ResizeObserver==='function'){ro=new ResizeObserver(()=>CS.fitCertificatePreview());ro.observe(shell)}}
    }catch(_e){}
  }
  function page(){
    if(typeof roleCanManage==='function'&&!roleCanManage())return legacy();
    syncUser();
    let html0;
    try{html0=legacy()}catch(e){console.error(e);return NX.notice('تعذر تحميل مركز الشهادات: '+h(e.message||e),'danger')}
    const cur=detect(html0);
    // central archive: trigger the legacy loader (its RC24 logic stays the single source) — rows are captured below.
    if(!cen.loaded&&!cen.loading&&!cen.error&&live())setTimeout(()=>{try{window.certRefreshCentral()}catch(_e){}},0);
    let D=null,B=null;
    if(cur!=='archive'){
      const issueHtml=cur==='issue'?html0:silent(()=>{window.certTab('issue');const x=legacy();window.certTab(cur);return x});
      D=readD(parse(issueHtml));
    }
    if(cur==='batch'){
      if(D.type==='rank'){const f=(D.opts.type||[]).find(o=>o.value!=='rank');if(f){silent(()=>window.certReset(f.value));return page()}}
      B=readBatch(parse(html0));
    }
    let controls='',preview='',aside='';
    const batch=cur==='batch',studio=cur==='issue'||batch;
    if(studio){
      controls=`<div class="nx-stack">${typeChips(D,batch)}${bulkCard(batch)}${batch?batchStudents(B):singleStudent(D)}${numberDate(D,batch)}${typeFields(D)}${textsCard(D)}${designCard(D)}</div>`;
    }else if(cur==='templates')controls=templatesHtml(D);
    else if(cur==='settings')controls=settingsHtml();
    else controls=archFull();
    if(cur==='archive'){
      aside=`<aside class="nc-aside"><div data-nc-arch="side">${archSide()}</div></aside>`;
    }else{
      preview=`<div class="nc-preview">${previewCard(D)}${studio?actions(D,batch,B):''}</div>`;
      aside=`<aside class="nc-aside">${archAside()}</aside>`;
    }
    setTimeout(afterMount,40);setTimeout(afterMount,320);
    return `<div class="nc-root" data-nc-tab="${cur}">${headerHtml()}${tabsHtml(cur)}${live()?'':NX.notice('أنت غير متصل: الإصدار الرسمي والأرشيف المشترك يحتاجان اتصالًا بالخادم.','warning')}<div class="nc-grid nc-t-${cur}"><div class="nc-controls">${controls}</div>${preview}${aside}</div></div>`;
  }

  // ---------- capture of the legacy central archive (single fetch, structured rows) ----------
  const origList=S.list;
  S.list=async function(){
    const user=uid();cen.loading=true;cen.error='';
    try{const rows=await origList.apply(S,arguments);if(user===uid()){cen.rows=rows;cen.loaded=true}return rows}
    catch(e){if(user===uid())cen.error=(e&&e.message)||String(e);throw e}
    finally{cen.loading=false;if(user===uid()&&state.page==='certificates')paint()}
  };
  // refresh the shared archive after anything that changes it
  ['certSavePdf','certIssueToArchive','certBatchIssue'].forEach(n=>{
    const o=window[n];if(typeof o!=='function')return;
    window[n]=function(){const p=o.apply(this,arguments);Promise.resolve(p).then(()=>setTimeout(()=>{try{window.certRefreshCentral()}catch(_e){}},350),()=>{});return p};
  });

  // ---------- revisions dialog (legacy builds it; we restyle it with the NX sheet) ----------
  const nativeShow=HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal=function(){
    if(this.id==='certRevisionsDlg'){
      if(autoPick){autoPick=false;const b=this.querySelector('#certRevisionRows button');if(b){b.click();return}}
      try{
        const dlg=this,title=dlg.querySelector('h3')?.textContent||'النسخ',note=dlg.querySelector('.notice')?.textContent||'';
        const btns=[...dlg.querySelectorAll('#certRevisionRows button')];
        dlg.className='nx-dlg';
        dlg.innerHTML=`<div class="nx-dlg-body"><div class="nx-dlg-grab"></div><header class="nx-dlg-head"><h3>${h(title)}</h3><button type="button" class="nx-iconbtn" aria-label="إغلاق" onclick="document.getElementById('certRevisionsDlg').close()">${ic('Close',22)}</button></header><div class="nx-dlg-content">${note?NX.notice(h(note),'info'):''}<div class="nc-revs" id="certRevisionRows"></div></div></div>`;
        const host=dlg.querySelector('#certRevisionRows');
        btns.forEach(b=>{const t=b.textContent;b.className='nc-rev';b.innerHTML=`${ic('History',22)}<span class="nx-grow">${h(t)}</span>${ic('Edit',18)}`;host.appendChild(b)});
        dlg.onclick=e=>{if(e.target===dlg)dlg.close()};
      }catch(e){console.error(e)}
    }
    return nativeShow.call(this);
  };

  // ---------- handlers used by the markup ----------
  const NC=window.NC={
    score(v){const n=k=>Math.max(0,Math.min(100,Number(v[k]==null?100:v[k])||0));return Math.round((n('ethics')*.35+n('discipline')*.30+n('attendance')*.20+n('memorization')*.15)*10)/10},
    ideal(el,k){
      const val=Math.max(0,Math.min(100,Number(el.value)||0));window.certSet(k,val);
      const root=el.closest('.nc-ideal'),vals={};
      root.querySelectorAll('input[type=number]').forEach((i,ix)=>{vals[['ethics','discipline','attendance','memorization'][ix]]=i.value});
      root.querySelector('.nc-score b').textContent=NC.score(vals);
    },
    date(v){if(/^\d{4}-\d{2}-\d{2}$/.test(v))window.certSet('date',v)},
    sub(k){ui.dsub=k;re()},
    cat(v){
      ui.cat=v;
      if(v!=='all'){const first=(state.students||[]).find(s=>String(s.category_id)===String(v)&&s.status!=='withdrawn');if(first)window.certSet('studentId',first.id)}
      re();
    },
    bcat(v){ui.bcat=v;re()},
    bq(v){ui.bq=v;const box=document.querySelector('[data-nc="blist"]');if(box){/* rebuild the list from DOM rows */
      const q=v.trim().toLowerCase();box.querySelectorAll('.nc-brow').forEach(r=>{r.hidden=!!q&&!r.textContent.toLowerCase().includes(q)})}},
    bsel(on){
      const q=ui.bq.trim().toLowerCase(),ids=[...document.querySelectorAll('.nc-brow')].filter(r=>!r.hidden).map(r=>r.querySelector('input').getAttribute('onchange').match(/'([^']+)'/)[1])
        .filter(id=>ui.bcat==='all'||String(studentOf(id)?.category_id)===String(ui.bcat));
      silent(()=>{if(on)ids.forEach(id=>window.certBatchToggle(id,true));else document.querySelectorAll('.nc-brow.on').forEach(r=>window.certBatchToggle(r.querySelector('input').getAttribute('onchange').match(/'([^']+)'/)[1],false))});
      re();
    },
    bulk(on){window.certTab(on?'batch':'issue')},
    color(key,val,el){
      let v=String(val||'').trim();if(v&&v[0]!=='#')v='#'+v;
      const root=el&&el.closest('.nc-color');
      if(/^#[0-9a-f]{6}$/i.test(v)){
        window.certSet(key,v.toLowerCase());
        if(root){root.querySelector('.nc-sw').style.background=v;const hex=root.querySelector('.nc-hex'),pk=root.querySelector('.nc-pick');if(el!==hex)hex.value=v;if(el!==pk)pk.value=v;root.querySelectorAll('.nc-preset').forEach(p=>p.classList.toggle('on',p.dataset.hex===v.toLowerCase()))}
      }
    },
    pick(key){const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=()=>{if(i.files&&i.files[0])window.certUploadSetting(key,i.files[0])};i.click()},
    dropAsset(key){
      NX.confirm('إزالة الصورة المخصصة؟','سيُستخدم الافتراضي عند توفره.','إزالة',()=>{
        try{const k='halaqati_v241_certificates_'+uid()+'_settings',s=JSON.parse(localStorage.getItem(k)||'{}');delete s[key];localStorage.setItem(k,JSON.stringify(s));toast('تمت إزالة الصورة المخصصة')}catch(e){toast('تعذرت الإزالة: '+(e.message||e))}
        re();
      },{danger:true});
    },
    resetAll(){NX.confirm('استعادة الإعدادات الافتراضية؟','ستعود ألوان القالب والخط والعناصر والهوية إلى الإعدادات الأصلية، وتُزال الصور المخصصة.','استعادة',()=>{withConfirm(()=>window.certResetSettings())},{danger:true})},
    // archive
    q(v){ui.q=v;ui.limit=12;paint()},
    filter(k){ui.filter=k;ui.limit=12;paint()},
    more(){ui.limit+=12;paint()},
    toggle(id){ui.open.has(id)?ui.open.delete(id):ui.open.add(id);paint()},
    tools(){ui.tools=!ui.tools;paint()},
    localToggle(){ui.localOpen=!ui.localOpen;paint()},
    refresh(){cen.error='';try{window.certRefreshCentral()}catch(_e){}paint()},
    rev(id){NX.closeDialog('ncManage');window.certOpenCentral(id)},
    edit(id){NX.closeDialog('ncManage');autoPick=true;Promise.resolve(window.certOpenCentral(id)).finally(()=>{autoPick=false})},
    manage(id){
      const c=cen.rows.find(x=>x.id===id);if(!c)return;
      const hid=ui.hidden.has(id),issued=c.status==='issued',[stT]=statusOf(c);
      const b=(label,o)=>NX.btn(label,{kind:'outlined',full:true,cls:'nc-act '+(o.danger?'nc-destructive':''),disabled:o.disabled,onclick:o.on});
      NX.dialog('ncManage',h(nameOf(c)),`<p class="nx-confirm-text" dir="auto">${h(c.certificate_number)} · ${stT}</p><div class="nx-stack-s">
        ${b('إنشاء نسخة مصححة بنفس الرقم',{disabled:!(issued&&!c.legacy_partial),on:`NC.edit('${h(id)}')`})}
        ${b('عرض النسخ',{on:`NC.rev('${h(id)}')`})}
        ${b('إلغاء رسمي (يبقى الرقم محفوظًا)',{disabled:!issued,on:`NC.voidAsk('${h(id)}')`})}
        ${b(hid?'إظهار في القائمة':'إخفاء من القائمة',{on:`NC.hide('${h(id)}')`})}
        ${isOwner()?b('حذف نهائي من السجل…',{danger:true,on:`NC.del('${h(id)}')`}):''}</div>`,{cls:'nx-small-dlg',footer:NX.btn('إغلاق',{kind:'text',onclick:"NX.closeDialog('ncManage')"})});
    },
    hide(id){
      NX.closeDialog('ncManage');const c=cen.rows.find(x=>x.id===id),was=ui.hidden.has(id);
      was?ui.hidden.delete(id):ui.hidden.add(id);saveHidden();paint();
      toast(was?`تم إظهار ${c?c.certificate_number:''} في القائمة`:`تم إخفاء ${c?c.certificate_number:''} من القائمة؛ السجل الرسمي كما هو`);
    },
    voidAsk(id){
      NX.closeDialog('ncManage');const c=cen.rows.find(x=>x.id===id);if(!c)return;
      NX.dialog('ncVoid','إلغاء رسمي',`<p class="nx-confirm-text">سيبقى الرقم ${h(c.certificate_number)} والسجل محفوظين، وتتحول الحالة إلى «ملغاة».</p>${NX.field('سبب الإلغاء',{id:'ncVoidReason',value:'إلغاء إداري'})}`,{cls:'nx-small-dlg',footer:`${NX.btn('تراجع',{kind:'text',onclick:"NX.closeDialog('ncVoid')"})}${NX.btn('إلغاء الشهادة',{kind:'danger',onclick:`NC.voidDo('${h(id)}')`})}`});
    },
    voidDo(id){
      const reason=(document.getElementById('ncVoidReason')?.value||'').trim();
      if(!reason){toast('اكتب سبب إلغاء الشهادة');return}
      NX.closeDialog('ncVoid');
      const p=window.prompt;window.prompt=()=>reason;
      try{Promise.resolve(window.certVoidCentral(id)).finally(()=>{})}finally{window.prompt=p}
    },
    del(id){
      NX.closeDialog('ncManage');const c=cen.rows.find(x=>x.id===id);if(!c)return;
      NX.confirm('حذف نهائي؟',`سيُحذف سجل ${h(c.certificate_number)} (${h(nameOf(c))}) بكل نسخه من Supabase ولا يمكن التراجع. الرقم لن يُعاد استخدامه، وملفات PDF المحفوظة على الأجهزة لا تُحذف.<br><br>إن أردت إيقاف الشهادة فقط فاستخدم «إلغاء رسمي»، أو «إخفاء» لإزالتها من القائمة.`,'حذف نهائي',async()=>{
        try{
          if(!live())throw new Error('الحذف يحتاج اتصالًا');
          const r=await db.from('certificates').delete().eq('id',id).select('id');
          if(r.error)throw new Error(r.error.message||String(r.error));
          if(!(r.data||[]).length)throw new Error('لم يُحذف أي سجل؛ الشهادة غير موجودة أو لا تملك صلاحية حذفها');
          ui.hidden.delete(id);saveHidden();toast(`تم حذف ${c.certificate_number} نهائيًا من السجل`);window.certRefreshCentral();
        }catch(e){toast('تعذر حذف الشهادة: '+(e.message||e))}
      },{danger:true});
    },
    reuse(id){window.certReissue(id)},
    toCentral(id){const x=CS.archive().find(r=>r.id===id);if(!x)return;NX.confirm('نقل إلى الأرشيف المشترك؟',`استيراد الشهادة القديمة ${h(x.number)} إلى الأرشيف المشترك برقمها التاريخي؟ سيبقى الأصل المحلي محفوظًا.`,'نقل',()=>{withConfirm(()=>window.certImportLocalCentral(id))})},
    delLocal(id){const x=CS.archive().find(r=>r.id===id);if(!x)return;NX.confirm('حذف من هذا الجهاز؟',`سيُزال ${h(x.studentName)} (${h(x.number)}) من فهرس هذا الجهاز فقط. السجل الرسمي في Supabase وملف PDF المحفوظ في Downloads لا يتأثران.`,'حذف',()=>{withConfirm(()=>window.certDeleteArchive(id));toast('تم حذف النسخة من فهرس هذا الجهاز')},{danger:true})}
  };

  window.certificatesPage=page;
})();
