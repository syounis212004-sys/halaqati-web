/* Halaqati web 2.86.0 — admin pages: monthly honour awards (RC46) and support & donors (RC48/RC49). */
(function(){
  'use strict';
  const R=window.RC50,e=R.e,ADM=['admin'];
  const lastMonth=()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
  const KINDS=[['teacher','دعم المحفّظين'],['admin','دعم مسؤول النظام'],['hospitality','ضيافة للطلاب'],['award','جوائز الطلاب'],['other','أخرى']];
  const RECS=[['once','مرة واحدة'],['weekly','أسبوعي'],['monthly','شهري']];
  const CURS=[['ILS','شيكل ₪'],['USD','دولار أمريكي $'],['JOD','دينار أردني']];
  const kind=k=>(KINDS.find(x=>x[0]===k)||[])[1]||k,rec=k=>(RECS.find(x=>x[0]===k)||[])[1]||k;
  const opts=(arr,cur)=>arr.map(([v,l])=>`<option value="${e(v)}" ${v===cur?'selected':''}>${e(l)}</option>`).join('');
  const PSTATUS={pledged:'متعهَّد',received:'تم الاستلام',delivered:'سُلّم'};

  // ================= monthly honour awards =================
  const A=R.aw={month:null,scope:'halaqa'};
  R.page('awards',{title:'التكريم الشهري',roles:ADM,render:async()=>{
    const months=await R.rpc('rc46_award_months');
    const info=R.card(`<h3>الدرجة من ١٠٠</h3><p class="dn-muted">حفظ ٤٠ · سرد ٣٠ · حضور ١٠ · سلوك ١٠ · جودة التسميع ١٠. الشروط: حفظ أكثر من ٩٠٪ وسرد ١٠٠٪ وغياب بلا عذر لا يزيد على جلستين. عند التساوي: الصفحات ثم الجودة ثم السلوك ثم الحضور.</p>`);
    if(!months.length)return `${info}${R.card(R.empty('لم يُحسب أي شهر بعد. يُحسب تلقائيًا فجر اليوم الأول من كل شهر، أو اضغط «حساب الشهر الماضي».')+`<div class="dn-actions">${R.btn('حساب الشهر الماضي','RC50.awCompute(\''+lastMonth()+'\')')}</div>`)}`;
    const keys=months.map(m=>String(m.month).slice(0,7));
    if(!A.month||!keys.includes(A.month))A.month=keys[0];
    const status=(months.find(m=>String(m.month).slice(0,7)===A.month)||{}).status;
    const data=await R.rpc('rc46_admin_awards',{p_month:A.month+'-01',p_scope:A.scope});
    R.cache.awW=[];
    const draft=status==='draft',groups=data.groups||[];
    const groupHtml=groups.map(g=>{
      const title=[A.scope==='halaqa'?g.halaqa_name:null,g.category_name].filter(Boolean).join(' · '),ws=g.winners||[];
      const winners=ws.map(w=>{const i=R.cache.awW.push(w)-1;return `<div class="dn-win"><div class="dn-row"><span class="dn-av m${w.rank}">${R.medal(w.rank)}</span><div><b>${e(w.name)}</b><small>${R.score(w.score)} · ${R.num(w.pages)} صفحة</small></div></div>
        <small class="dn-muted">حفظ ${R.pct(w.hifz_pct,false)} · سرد ${R.pct(w.sard_pct)} · حضور ${R.pct(w.attendance_pct)} · سلوك ${R.pct(w.behavior)} · جودة ${R.pct(w.quality)}</small>
        <label class="dn-check"><input type="checkbox" ${w.contact_allowed?'checked':''} onchange="RC50.awContact(${i},this.checked)"><span>إظهار رقم ولي الأمر للمانح</span></label>
        <div class="dn-actions">${draft?R.btn('استبعاد',`RC50.awExclude(${i})`,'text'):''}${status==='approved'&&w.rank===1?R.btn('إصدار شهادة','RC50.awCert()','tonal'):''}</div></div>`}).join('');
      const miss=!ws.length&&g.best_miss?`<div class="dn-alert">لا شهادة لهذه المجموعة: لم يستوفِ أي طالب الشروط. أقرب طالب: ${e(g.best_miss.name)} (${R.num(g.best_miss.score)}) — ${e(g.best_miss.reason||'')}</div>`:(!ws.length?'<div class="dn-alert">لا شهادة لهذه المجموعة: لم يستوفِ أي طالب الشروط.</div>':'');
      return R.card(`<div class="dn-sec"><h3>${e(title)}</h3><small class="dn-muted">${g.students} طالبًا</small></div>${miss}${winners}`)}).join('');
    return `${info}<div class="dn-pills-row">${R.pills(keys.map(k=>{const m=months.find(x=>String(x.month).slice(0,7)===k);return [k,R.monthLabel(k)+' · '+(m.status==='approved'?'معتمد':'مسودة')]}),A.month,'RC50.awMonth')}</div>${R.seg([['halaqa','كل حلقة على حدة'],['category','الفئة عبر كل الحلقات']],A.scope,'RC50.awScope')}
      <div class="dn-actions">${draft?R.btn('إعادة الحساب','RC50.awCompute(\''+A.month+'\')','tonal')+R.btn('اعتماد الشهر','RC50.awApprove()'):'<span class="dn-badge on">معتمد · ظاهر للمانح</span>'}</div>${groupHtml||R.card(R.empty('لا توجد نتائج لهذا الشهر.'))}`;
  }});
  R.awMonth=m=>{A.month=m;render()};
  R.awScope=s=>{A.scope=s;render()};
  R.awCompute=async m=>{try{await R.rpc('rc46_compute_awards',{p_month:m+'-01'});A.month=m;R.toast('تم حساب شهر '+R.monthLabel(m));render()}catch(err){R.toast(err.message)}};
  R.awApprove=()=>NX.confirm('اعتماد تكريم '+R.monthLabel(A.month),'بعد الاعتماد يرى المانح الأسماء الكاملة وأفضل ٣ في كل فئة، ويصله إشعار. لا يمكن التراجع من التطبيق.','اعتماد',async()=>{try{const ok=await R.rpc('rc46_approve_awards',{p_month:A.month+'-01'});R.toast(ok?'تم اعتماد الشهر':'الشهر معتمد مسبقًا');render()}catch(err){R.toast(err.message)}});
  R.awContact=async(i,on)=>{const w=R.cache.awW[i];try{await R.rpc('rc46_set_donor_contact',{p_student:w.student_id,p_allowed:!!on})}catch(err){R.toast(err.message)}};
  R.awExclude=i=>{const w=R.cache.awW[i];R.cache.awX=w;R.sheet('dnExclude','استبعاد '+w.name,`<label class="dn-field"><span>سبب الاستبعاد (٣ أحرف فأكثر)</span><input id="dnXReason" type="text"></label>`,R.btn('استبعاد','RC50.awExcludeDo()'))};
  R.awExcludeDo=async()=>{const r=document.getElementById('dnXReason').value.trim();if(r.length<3)return R.toast('اكتب السبب');try{await R.rpc('rc46_exclude_award',{p_month:A.month+'-01',p_student:R.cache.awX.student_id,p_reason:r});R.closeSheet('dnExclude');R.toast('تم الاستبعاد وإعادة الترتيب');render()}catch(err){R.toast(err.message)}};
  R.awCert=()=>{R.toast('افتح صفحة الشهادات واختر نوع «ترتيب» والشهر والفئة');go('certificates')};

  // ================= support & donors =================
  const S=R.sp={tab:'cards'};
  const defaultPeriods=r=>r==='weekly'?'الأسبوع الأول\nالأسبوع الثاني\nالأسبوع الثالث\nالأسبوع الرابع':r==='monthly'?[0,1,2].map(k=>{const d=new Date();d.setMonth(d.getMonth()+k);return R.monthLabel(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}).join('\n'):'';
  R.page('support',{title:'الدعم والمانحون',roles:ADM,render:async()=>{
    const seg=R.seg([['cards','بطاقات الدعم'],['donors','المانحون'],['news','أخبار واقتراحات']],S.tab,'RC50.spTab');
    if(S.tab==='donors'){
      const donors=await R.rpc('rc48_donors');R.cache.donors=donors;const hs=state.halaqas||[];
      return `${seg}<p class="dn-muted">حدّد الحلقات التي يراها كل مانح. من لم تُحدَّد له حلقة يرى كل الحلقات.</p>${donors.map((d,i)=>{const names=hs.filter(h=>(d.halaqa_ids||[]).includes(h.id)).map(h=>h.name).join('، ');
        return R.card(`<b>${e(d.name)}</b><small class="dn-muted">${e(d.email||d.phone||'')}</small><p>${(d.halaqa_ids||[]).length?'يرى: '+e(names):'يرى: كل الحلقات'}</p><div class="dn-actions">${R.btn('تحديد الحلقات',`RC50.spAssign(${i})`,'tonal')}</div>`)}).join('')||R.card(R.empty('لا يوجد مانحون معتمدون بعد.'))}`;
    }
    if(S.tab==='news'){
      const [news,sug]=await Promise.all([R.rpc('rc49_news_list'),R.rpc('rc49_suggestions')]);R.cache.news=news;
      return `${seg}${R.card(`<h3>خبر جديد للمانحين</h3><label class="dn-field"><span>العنوان</span><input id="dnNTitle" type="text"></label><label class="dn-field"><span>النص</span><textarea id="dnNBody" rows="3"></textarea></label><div class="dn-actions">${R.btn('نشر','RC50.spNewsPublish()')}</div>`)}
        ${news.map((n,i)=>R.card(`<div class="dn-row between"><div><b>${e(n.title)}</b>${n.body?`<small>${e(n.body)}</small>`:''}</div>${R.btn(n.active?'إخفاء':'إظهار',`RC50.spNewsToggle(${i})`,'text')}</div>`,'slim')).join('')}
        <h3 class="dn-h">اقتراحات المانحين</h3>${sug.map(s=>R.card(`<small class="dn-gold">${e(s.donor_name)}</small><p>${e(s.body)}</p>`,'slim')).join('')||R.card(R.empty('لا توجد اقتراحات بعد.'))}`;
    }
    const [cards,defs]=await Promise.all([R.rpc('rc49_support_cards'),R.rpc('rc49_support_defaults').catch(()=>null)]);
    R.cache.spCards=cards;R.cache.spDefs=defs;R.cache.spP=[];
    const list=cards.map((c,ci)=>{const per=c.periods||[],pl=c.pledges||[];
      const pledges=pl.map(p=>{const pi=R.cache.spP.push({p,c})-1;
        return `<div class="dn-win"><b>${e(p.donor_name)}${p.anonymous?' (يظهر مجهولًا)':''}</b><small>${e(p.period)} · ${e(PSTATUS[p.status]||p.status)}</small>
          ${p.transfer_submitted_at?`<small class="dn-ok">إثبات التحويل: ${e(p.transfer_ref||'صورة مرفقة')}</small>`:p.status==='pledged'?'<small class="dn-muted">لم يرسل المانح إثبات التحويل بعد</small>':''}${p.proof_text?`<small>الإثبات: ${e(p.proof_text)}</small>`:''}
          <div class="dn-actions">${p.status==='pledged'?R.btn('تأكيد الاستلام',`RC50.spConfirm(${pi})`,'tonal'):''}${p.status==='pledged'||p.status==='received'?R.btn('إثبات التسليم',`RC50.spDeliver(${pi})`,'tonal'):''}${p.has_transfer_image?R.btn('صورة الحوالة',`RC50.spProof(${pi},'transfer')`,'text'):''}${p.has_image?R.btn('صورة التسليم',`RC50.spProof(${pi},'delivery')`,'text'):''}${p.status==='pledged'||p.status==='received'?R.btn('إلغاء',`RC50.spCancel(${pi})`,'text'):''}</div></div>`}).join('');
      return R.card(`<div class="dn-sec"><div><small class="dn-gold">${e(kind(c.kind)+' · '+rec(c.recurrence))}</small><h3>${e(c.title)}</h3></div><span class="dn-badge ${c.status==='open'?'on':''}">${c.status==='open'?'مفتوحة':'مغلقة'}</span></div>
        ${c.description?`<p>${e(c.description)}</p>`:''}<small class="dn-muted">${e([R.amount(c.amount,c.currency),c.amount_text,c.beneficiaries!=null?c.beneficiaries+' طالبًا مستفيدًا':'',c.halaqa_name].filter(Boolean).join(' · '))}</small>
        <div class="dn-chips">${per.map(p=>`<span class="dn-chip ${p.taken>=c.slots?'full':''}">${e(p.period)} · ${p.taken}/${c.slots}</span>`).join('')}</div>${pledges}
        <div class="dn-actions">${R.btn('تعديل',`RC50.spEdit(${ci})`,'tonal')}${R.btn(c.status==='open'?'إغلاق':'إعادة فتح',`RC50.spToggle(${ci})`,'text')}</div>`)}).join('');
    return `${seg}<div class="dn-actions">${R.btn('بطاقة دعم جديدة','RC50.spEdit(-1)')}${R.btn('حساب الدعم الافتراضي','RC50.spDefaults()','tonal')}</div>${list||R.card(R.empty('لا توجد بطاقات دعم بعد. أنشئ بطاقة (ضيافة، دعم المحفّظين...) ليتكفّل بها المانحون.'))}`;
  }});
  R.spTab=t=>{S.tab=t;render()};
  const payFields=(p,pre)=>`<label class="dn-field"><span>طريقة الدفع</span><select id="${pre}Method"><option value="bank" ${p.method==='bank'?'selected':''}>تحويل بنكي</option><option value="wallet" ${p.method==='wallet'?'selected':''}>محفظة إلكترونية</option></select></label>
    <label class="dn-field"><span>اسم البنك أو المحفظة</span><input id="${pre}Provider" value="${e(p.provider||'')}"></label><label class="dn-field"><span>رقم الحساب أو المحفظة</span><input id="${pre}Account" value="${e(p.account||'')}"></label>
    <label class="dn-field"><span>اسم صاحب الحساب</span><input id="${pre}Holder" value="${e(p.holder||'')}"></label><label class="dn-field"><span>ملاحظة للمانح</span><textarea id="${pre}Note" rows="2">${e(p.note||'')}</textarea></label>`;
  const readPay=pre=>({pay_method:document.getElementById(pre+'Method').value,pay_provider:document.getElementById(pre+'Provider').value,pay_account:document.getElementById(pre+'Account').value,pay_holder:document.getElementById(pre+'Holder').value,pay_note:document.getElementById(pre+'Note').value});
  R.spDefaults=()=>{const d=R.cache.spDefs||{};R.sheet('dnDefs','حساب الدعم الافتراضي',`<p class="dn-muted">يظهر للمانح في كل بطاقة لا تحدّد حسابًا خاصًا بها.</p><label class="dn-field"><span>العملة</span><select id="dnDCur">${opts(CURS,d.currency||'ILS')}</select></label>${payFields({method:d.pay_method,provider:d.pay_provider,account:d.pay_account,holder:d.pay_holder,note:d.pay_note},'dnD')}`,R.btn('حفظ','RC50.spDefaultsSave()'))};
  R.spDefaultsSave=async()=>{try{await R.rpc('rc49_support_set_defaults',{p:Object.assign({currency:document.getElementById('dnDCur').value},readPay('dnD'))});R.closeSheet('dnDefs');R.toast('حُفظ حساب الدعم الافتراضي');render()}catch(err){R.toast(err.message)}};
  R.spEdit=ci=>{
    const c=ci>=0?R.cache.spCards[ci]:null;R.cache.spEdit=c;const useDef=c?c.uses_default_payment!==false:true;
    const per=c?(c.periods||[]).map(p=>p.period).join('\n'):'';
    const hs=state.halaqas||[];
    R.sheet('dnCard',c?'تعديل البطاقة':'بطاقة دعم جديدة',`<label class="dn-field"><span>النوع</span><select id="dnCKind">${opts(KINDS,c?.kind||'hospitality')}</select></label>
      <label class="dn-field"><span>العنوان</span><input id="dnCTitle" value="${e(c?.title||'')}"></label><label class="dn-field"><span>الوصف (اختياري)</span><textarea id="dnCDesc" rows="2">${e(c?.description||'')}</textarea></label>
      <label class="dn-field"><span>وصف العطاء (مثال: بسكويت وعصير)</span><input id="dnCAmtText" value="${e(c?.amount_text||'')}"></label>
      <div class="dn-two"><label class="dn-field"><span>المبلغ لكل فترة</span><input id="dnCAmt" inputmode="decimal" value="${e(c?.amount==null?'':c.amount)}"></label><label class="dn-field"><span>العملة</span><select id="dnCCur">${opts(CURS,c?.currency||'ILS')}</select></label></div>
      <label class="dn-field"><span>التكرار</span><select id="dnCRec" onchange="RC50.spRecChange(this.value)">${opts(RECS,c?.recurrence||'once')}</select></label>
      <label class="dn-field" id="dnCPerWrap" ${(c?.recurrence||'once')==='once'?'hidden':''}><span>الفترات (كل فترة في سطر)</span><textarea id="dnCPer" rows="4">${e(per)}</textarea></label>
      <div class="dn-two"><label class="dn-field"><span>كفلاء لكل فترة</span><input id="dnCSlots" type="number" min="1" max="50" value="${e(c?.slots||1)}"></label><label class="dn-field"><span>عدد المستفيدين</span><input id="dnCBen" type="number" min="0" value="${e(c?.beneficiaries==null?'':c.beneficiaries)}"></label></div>
      <label class="dn-field"><span>الحلقة</span><select id="dnCHal"><option value="">كل الحلقات</option>${hs.map(h=>`<option value="${e(h.id)}" ${c?.halaqa_id===h.id?'selected':''}>${e(h.name)}</option>`).join('')}</select></label>
      <label class="dn-check"><input type="checkbox" id="dnCUseDef" ${useDef?'checked':''} onchange="document.getElementById('dnCPay').hidden=this.checked"><span>استخدام الحساب الافتراضي</span></label>
      <div id="dnCPay" ${useDef?'hidden':''}>${payFields(c&&!useDef?(c.pay||{}):{},'dnC')}</div>`,R.btn('حفظ','RC50.spSave()'));
  };
  R.spRecChange=v=>{const w=document.getElementById('dnCPerWrap'),t=document.getElementById('dnCPer');w.hidden=v==='once';if(v!=='once'&&!t.value.trim())t.value=defaultPeriods(v)};
  R.spSave=async()=>{
    const g=id=>document.getElementById(id).value,c=R.cache.spEdit,recur=g('dnCRec');
    const title=g('dnCTitle').trim();if(title.length<2)return R.toast('اكتب عنوان البطاقة');
    const p={kind:g('dnCKind'),title,description:g('dnCDesc').trim(),amount_text:g('dnCAmtText').trim(),amount:g('dnCAmt').trim(),currency:g('dnCCur'),recurrence:recur,
      periods:recur==='once'?[]:g('dnCPer').split('\n').map(x=>x.trim()).filter(Boolean),slots:Math.max(1,Math.min(50,parseInt(g('dnCSlots'),10)||1)),beneficiaries:g('dnCBen'),halaqa_id:g('dnCHal'),status:c?.status||'open'};
    if(c)p.id=c.id;if(!document.getElementById('dnCUseDef').checked)Object.assign(p,readPay('dnC'));
    try{await R.rpc('rc49_support_save_card',{p});R.closeSheet('dnCard');R.toast('تم حفظ البطاقة');render()}catch(err){R.toast(err.message)}
  };
  R.spToggle=async ci=>{const c=R.cache.spCards[ci];const p={id:c.id,kind:c.kind,title:c.title,description:c.description||'',amount_text:c.amount_text||'',amount:c.amount==null?'':String(c.amount),currency:c.currency||'ILS',recurrence:c.recurrence,periods:(c.periods||[]).map(x=>x.period),slots:c.slots,beneficiaries:c.beneficiaries==null?'':c.beneficiaries,halaqa_id:c.halaqa_id||'',status:c.status==='open'?'closed':'open'};
    if(c.uses_default_payment===false&&c.pay)Object.assign(p,{pay_method:c.pay.method||'',pay_provider:c.pay.provider||'',pay_account:c.pay.account||'',pay_holder:c.pay.holder||'',pay_note:c.pay.note||''});
    try{await R.rpc('rc49_support_save_card',{p});R.toast(p.status==='open'?'أُعيد فتح البطاقة':'أُغلقت البطاقة');render()}catch(err){R.toast(err.message)}};
  R.spConfirm=async i=>{const {p}=R.cache.spP[i];try{await R.rpc('rc48_support_confirm',{p_pledge:p.id});R.toast('تم تأكيد الاستلام وأُرسل شكر للمانح');render()}catch(err){R.toast(err.message)}};
  R.spCancel=i=>{const {p}=R.cache.spP[i];NX.confirm('إلغاء الكفالة','إلغاء كفالة '+p.donor_name+'؟','إلغاء',async()=>{try{await R.rpc('rc48_support_cancel',{p_pledge:p.id});R.toast('أُلغيت الكفالة');render()}catch(err){R.toast(err.message)}},{danger:true})};
  R.spProof=async(i,kd)=>{const {p}=R.cache.spP[i];try{const img=await R.rpc('rc49_support_proof',{p_pledge:p.id,p_kind:kd});R.sheet('dnProof',kd==='transfer'?'صورة الحوالة':'صورة التسليم',img?`<img class="dn-proof" src="${e(img)}" alt="">`:'<p>تعذّر تحميل الصورة</p>')}catch(err){R.toast(err.message)}};
  R.spDeliver=i=>{const {p}=R.cache.spP[i];R.cache.spDel=p;R.cache.img=null;
    R.sheet('dnDeliver','إثبات التسليم',`<p class="dn-muted">${e(p.donor_name)} · ${e(p.period)}</p><label class="dn-field"><span>إفادة مكتوبة (مثال: سُلّمت الضيافة للطلاب)</span><textarea id="dnDText" rows="2"></textarea></label><label class="dn-field"><span>صورة (اختياري)</span><input type="file" accept="image/*" onchange="RC50.spPick(this)"></label><p id="dnImgOk" class="dn-ok"></p><label class="dn-field"><span>رسالة شكر للمانح (اختياري)</span><textarea id="dnDThanks" rows="2"></textarea></label>`,R.btn('تسجيل التسليم','RC50.spDeliverSend()'))};
  R.spPick=async inp=>{const f=inp.files&&inp.files[0];if(!f)return;try{R.cache.img=await R.compressImage(f);document.getElementById('dnImgOk').textContent='أُرفقت صورة'}catch(err){R.toast(err.message)}};
  R.spDeliverSend=async()=>{const t=document.getElementById('dnDText').value.trim(),img=R.cache.img;if(t.length<3&&!img)return R.toast('اكتب إفادة أو أرفق صورة');
    try{await R.rpc('rc49_support_deliver',{p_pledge:R.cache.spDel.id,p_text:t,p_image:img||null,p_thanks:document.getElementById('dnDThanks').value.trim()||null});R.closeSheet('dnDeliver');R.toast('سُجّل التسليم وأُشعر المانح');render()}catch(err){R.toast(err.message)}};
  R.spAssign=i=>{const d=R.cache.donors[i];R.cache.spDonor=d;const hs=state.halaqas||[];
    R.sheet('dnAssign','حلقات '+d.name,`<p class="dn-muted">إن لم تحدّد شيئًا يرى المانح كل الحلقات.</p>${hs.map(h=>`<label class="dn-check"><input type="checkbox" class="dn-hal" value="${e(h.id)}" ${(d.halaqa_ids||[]).includes(h.id)?'checked':''}><span>${e(h.name)}</span></label>`).join('')}`,R.btn('حفظ','RC50.spAssignSave()'))};
  R.spAssignSave=async()=>{const ids=[...document.querySelectorAll('#dnAssign .dn-hal:checked')].map(x=>x.value);try{await R.rpc('rc48_set_donor_halaqas',{p_donor:R.cache.spDonor.donor_id,p_halaqas:ids});R.closeSheet('dnAssign');R.toast('تم تحديد حلقات المانح');render()}catch(err){R.toast(err.message)}};
  R.spNewsPublish=async()=>{const t=document.getElementById('dnNTitle').value.trim(),b=document.getElementById('dnNBody').value.trim();if(t.length<2)return R.toast('اكتب العنوان');try{await R.rpc('rc49_news_save',{p:{title:t,body:b,active:true}});R.toast('نُشر الخبر وأُشعر المانحون');render()}catch(err){R.toast(err.message)}};
  R.spNewsToggle=async i=>{const n=R.cache.news[i];try{await R.rpc('rc49_news_save',{p:{id:n.id,title:n.title,body:n.body||'',active:!n.active}});R.toast(n.active?'أُخفي الخبر':'أُظهر الخبر');render()}catch(err){R.toast(err.message)}};
})();
