/* Halaqati web RC114 — contests («المسابقات»), mirrors Android ContestsScreens.kt.
   Donor / teacher / supervisor create and see their own contests; the admin creates (approved at once) and decides requests;
   everyone attached to a halaqa reads the approved ones. Every call is an existing RPC (migrations 20261125 / 20261126).
   Lists and halaqa pickers are read from the server on every open (nothing is cached). Rules live in contests/rules.mjs. */
(function(){
  'use strict';
  const R=window.RC50,L=window.ContestRules;
  if(!R||!L||window.__rc114Contests)return;window.__rc114Contests=true;
  const e=R.e,role=()=>state?.profile?.role;
  const C=R.contests={tab:'mine',filter:null,adminFilter:'pending',items:[],halaqas:[],notice:null,busy:false,decide:null};
  const ROLES=['observer','teacher','supervisor','admin','guardian'];
  const STAFF_CREATORS=['teacher','supervisor'];
  const KIND={pending:'warning',approved:'success',rejected:'danger'};

  const contestError=(err,fallback)=>{
    const m=String(err&&err.message||err||'');
    if(/contest_|Could not find the function|PGRST202/i.test(m))return 'ميزة المسابقات لم تُفعَّل على الخادم بعد. حاول لاحقًا أو تواصل مع مدير النظام.';
    return m.trim()||fallback;
  };
  const offline=()=>typeof navigator!=='undefined'&&navigator.onLine===false;
  const list=async name=>{const d=await R.rpc(name);return Array.isArray(d)?d:[]};
  const norm=o=>({...o,status:L.statusOf(o.status)});
  const dateText=v=>{const p=L.parseDate(v);return p?L.formatDate(p.y,p.m,p.d):String(v||'')};
  const notice=()=>{const n=C.notice;C.notice=null;return n?`<div class="rc114-notice ${e(n.kind)}" role="status">${e(n.text)}</div>`:''};
  const flash=(text,kind)=>{C.notice={text,kind:kind||'success'}};

  // ---------- card ----------
  const card=(c,i,o)=>{
    const meta=[c.halaqa_name?'الحلقة: '+c.halaqa_name:(c.halaqa_id==null?'الحلقة: لم تُحدَّد بعد':null),o.showDonor&&c.donor_name?`${L.creatorLabel(c.creator_role)}: ${c.donor_name}`:null].filter(Boolean);
    const dates=[c.starts_on?'من '+dateText(c.starts_on):'',c.ends_on?'إلى '+dateText(c.ends_on):''].filter(Boolean).join(' ');
    return `<article class="dn-card rc114-card" aria-label="${e(c.name)}">
      <div class="rc114-head"><h3>${e(c.name)}</h3>${o.showStatus?`<span class="rc114-pill ${KIND[c.status]}">${e(L.STATUS_LABEL[c.status])}</span>`:''}</div>
      <p class="rc114-title">${e(c.title)}</p>
      ${meta.map(m=>`<small class="dn-muted">${e(m)}</small>`).join('')}
      <h4>الشروط</h4><p class="rc114-text">${e(c.conditions)}</p>
      <h4>المكافأة</h4><p class="rc114-text">${e(c.reward)}</p>
      ${dates?`<small class="dn-muted"><bdi dir="ltr">${e(dates)}</bdi></small>`:''}
      ${c.status==='rejected'&&c.reject_reason?`<div class="rc114-notice danger">سبب الرفض: ${e(c.reject_reason)}</div>`:''}
      ${o.actions?`<div class="dn-actions">${o.actions(c,i)}</div>`:''}</article>`;
  };
  const filterBar=(items,cur,fn)=>{
    const opts=[['all',`الكل (${items.length})`],...L.STATUSES.map(s=>[s,`${L.STATUS_LABEL[s]} (${items.filter(c=>c.status===s).length})`])];
    return R.pills(opts,cur||'all',fn);
  };
  const empty=t=>R.card(R.empty(t));

  // ---------- views ----------
  C.mineHtml=async()=>{
    const items=(await list('contest_my')).map(norm);C.items=items;
    const sel=C.filter||null,shown=L.filterByStatus(items,sel);
    const r=role();
    return `${notice()}<div class="dn-actions rc114-top">${R.btn('مسابقة جديدة','RC50.contests.openForm()')}</div>
      ${r==='observer'?'':`<p class="dn-muted">${r==='admin'?'تُعتمد مسابقتك فورًا':'تصل مسابقتك إلى مدير النظام للاعتماد'}، ثم تظهر لأصحاب الحلقة.</p>`}
      ${items.length?filterBar(items,sel,'RC50.contests.setFilter'):''}
      ${!items.length?empty('لم تضف أي مسابقة بعد. أضف مسابقتك الأولى وسترسل إلى مدير النظام للمراجعة.'):!shown.length?empty('لا توجد مسابقات بهذه الحالة'):shown.map((c,i)=>card(c,i,{showStatus:true})).join('')}`;
  };
  C.visibleHtml=async()=>{
    const items=(await list('contest_visible')).map(norm);
    return `${notice()}${items.length?items.map((c,i)=>card(c,i,{showDonor:true})).join(''):empty('لا توجد مسابقات معتمدة لحلقتك الآن')}`;
  };
  C.adminHtml=async()=>{
    const items=(await list('contest_admin_list')).map(norm);C.items=items;
    const sel=C.adminFilter==='all'?null:C.adminFilter,shown=L.filterByStatus(items,sel),pend=items.filter(c=>c.status==='pending').length;
    const actions=(c,i)=>c.status==='pending'?R.btn(c.halaqa_id==null?'تحديد الحلقة واعتماد':'اعتماد',`RC50.contests.openDecide(${i},true)`)+R.btn('رفض',`RC50.contests.openDecide(${i},false)`,'tonal'):'';
    const idx=new Map(items.map((c,i)=>[c.id,i]));
    return `${notice()}<div class="dn-actions rc114-top">${R.btn('مسابقة جديدة','RC50.contests.openForm()')}</div>
      ${items.length?`<div class="rc114-notice ${pend?'warning':'info'}" role="status">${pend?'بانتظار قرارك: '+pend:'لا توجد مسابقات بانتظار القرار'}</div>${filterBar(items,C.adminFilter,'RC50.contests.setAdminFilter')}`:''}
      ${!items.length?empty('لا توجد مسابقات بعد'):!shown.length?empty('لا توجد مسابقات بهذه الحالة'):shown.map(c=>card(c,idx.get(c.id),{showStatus:true,showDonor:true,actions})).join('')}`;
  };
  /** Embeddable body for a role (used by the contribute page). */
  C.bodyFor=async r=>{
    if(r==='admin')return C.adminHtml();
    if(r==='observer')return C.mineHtml();
    if(STAFF_CREATORS.includes(r))return R.seg([['mine','مسابقاتي'],['visible','مسابقات حلقاتي']],C.tab,'RC50.contests.setTab')+(C.tab==='visible'?await C.visibleHtml():await C.mineHtml());
    return C.visibleHtml();
  };
  /** One-line summary for the staff tab of the contribute page. */
  C.summary=async r=>{
    try{
      if(r==='admin'){const n=(await list('contest_admin_list')).map(norm).filter(c=>c.status==='pending').length;return n?`بانتظار قرارك: ${n}`:'لا توجد مسابقات بانتظار قرارك'}
      const mine=(await list('contest_my')).map(norm);
      return mine.length?`مسابقاتك: ${mine.filter(c=>c.status==='approved').length} معتمدة، ${mine.filter(c=>c.status==='pending').length} بانتظار المدير`:'لم تُنشئ مسابقة بعد';
    }catch(_err){return ''}
  };

  R.page('contests',{title:'المسابقات',roles:ROLES,render:async()=>{
    try{return await C.bodyFor(role())}catch(err){return R.card(R.empty(contestError(err,'تعذر تحميل المسابقات')))+R.btn('إعادة المحاولة','render()')}
  }});
  C.setTab=t=>{C.tab=t;C.filter=null;render()};
  C.setFilter=v=>{C.filter=v==='all'?null:v;render()};
  C.setAdminFilter=v=>{C.adminFilter=v;render()};

  // ---------- date field: typing works, the native picker only fills the text ----------
  const dateField=(id,label,hint)=>`<div class="dn-field rc114-fld"><label for="${id}">${e(label)}</label>
    <div class="rc114-date"><input id="${id}" type="text" inputmode="numeric" dir="ltr" autocomplete="off" placeholder="01-12-2026" aria-describedby="${id}H ${id}E" oninput="RC50.contests.dateInput('${id}')">
      <button type="button" class="dn-btn tonal rc114-cal" aria-label="اختيار ${e(label)} من التقويم" onclick="RC50.contests.pickDate('${id}')">تقويم</button>
      <input id="${id}P" class="rc114-nativedate" type="date" tabindex="-1" aria-hidden="true" onchange="RC50.contests.picked('${id}',this.value)"></div>
    <small id="${id}H" class="dn-muted">${e(hint)}</small><small id="${id}E" class="rc114-err" role="alert"></small></div>`;
  C.pickDate=id=>{
    const p=document.getElementById(id+'P');if(!p)return;
    const cur=L.parseDate(document.getElementById(id)?.value);
    if(cur)p.value=`${String(cur.y).padStart(4,'0')}-${String(cur.m).padStart(2,'0')}-${String(cur.d).padStart(2,'0')}`;
    if(id==='cfEnd'){const s=L.parseDate(document.getElementById('cfStart')?.value);p.min=s?`${s.y}-${String(s.m).padStart(2,'0')}-${String(s.d).padStart(2,'0')}`:''}
    try{p.showPicker?p.showPicker():(p.focus(),p.click())}catch(_err){p.focus()}
  };
  C.picked=(id,v)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');if(!m)return;const t=document.getElementById(id);t.value=L.formatDate(+m[1],+m[2],+m[3]);C.dateInput(id)};
  C.dateInput=id=>{const el=document.getElementById(id),er=document.getElementById(id+'E');if(el&&el.getAttribute('aria-invalid')){el.removeAttribute('aria-invalid');if(er)er.textContent=''}};

  // ---------- halaqa picker (always read from the server when a form opens) ----------
  const halaqaRadios=(name,hs,sel,dis)=>`<fieldset class="rc114-set"><legend>الحلقة المستهدفة</legend>${hs.map(h=>`<label class="dn-check"><input type="radio" name="${name}" value="${e(h.id)}" ${String(sel)===String(h.id)?'checked':''} ${dis?'disabled':''}><span>${e(h.name)}</span></label>`).join('')}</fieldset>`;
  const fetchHalaqas=async()=>{try{return await list('contest_donor_halaqas')}catch(err){return {error:err}}};
  const picked=name=>document.querySelector(`input[name="${name}"]:checked`)?.value||null;

  // ---------- create ----------
  C.openForm=async()=>{
    if(C.busy)return;C.busy=true;
    const hs=await fetchHalaqas();C.busy=false;
    const r=role(),failed=!Array.isArray(hs),arr=failed?[]:hs,state0=L.pickerState(arr.map(h=>h.id));
    C.halaqas=arr;
    let pick='';
    if(failed)pick=`<div class="rc114-notice danger" role="alert">${e(contestError(hs.error,'تعذر تحميل الحلقات'))}</div>`;
    else if(state0==='none')pick=`<div class="rc114-notice info">${e(L.noHalaqaMessage(r))}</div>`;
    else if(state0==='single')pick=`<fieldset class="rc114-set"><legend>الحلقة المستهدفة</legend><span class="rc114-pill neutral">${e(arr[0].name)}</span></fieldset>`;
    else pick=halaqaRadios('cfHalaqa',arr,'',false)+`<small id="cfHalaqaE" class="rc114-err" role="alert"></small>`;
    const blocked=r!=='observer'&&(failed||state0==='none');
    const f=(id,label,rows)=>`<div class="dn-field rc114-fld"><label for="${id}">${e(label)}</label>${rows?`<textarea id="${id}" rows="${rows}" aria-describedby="${id}E"></textarea>`:`<input id="${id}" type="text" aria-describedby="${id}E">`}<small id="${id}E" class="rc114-err" role="alert"></small></div>`;
    R.sheet('dnContest','مسابقة جديدة',`${f('cfName','اسم المسابقة')}${f('cfTitle','العنوان')}${f('cfCond','الشروط',3)}${f('cfReward','المكافأة',2)}
      ${dateField('cfStart','تاريخ البداية (اختياري)','اختر من التقويم أو اكتب 01-12-2026')}${dateField('cfEnd','تاريخ النهاية (اختياري)','اختر من التقويم أو اكتب 31-12-2026')}
      ${pick}<p class="dn-muted">${r==='admin'?'تُعتمد مسابقتك فورًا وتظهر لأصحاب الحلقة.':'تصل المسابقة إلى مدير النظام، وتظهر لأصحاب الحلقة بعد اعتمادها.'}</p><div id="cfServer" class="rc114-notice danger" role="alert" hidden></div>`,
      R.btn('إلغاء','RC50.closeSheet(\'dnContest\')','text')+`<button type="button" id="cfSend" class="dn-btn" ${blocked?'disabled aria-disabled="true"':''} onclick="RC50.contests.submit()">إرسال للمراجعة</button>`);
  };
  const showErrors=(errs,map)=>{
    Object.entries(map).forEach(([k,id])=>{const el=document.getElementById(id),er=document.getElementById(id+'E');
      if(errs[k]){el?.setAttribute('aria-invalid','true');if(er)er.textContent=errs[k]}else{el?.removeAttribute('aria-invalid');if(er)er.textContent=''}});
    const first=document.querySelector('#dnContest [aria-invalid="true"]');first?.focus();
  };
  C.submit=async()=>{
    if(C.busy)return;
    const g=id=>document.getElementById(id)?.value||'';
    const draft={name:g('cfName'),title:g('cfTitle'),conditions:g('cfCond'),reward:g('cfReward'),startsOn:g('cfStart'),endsOn:g('cfEnd')};
    const errs=L.validate(draft);
    const ids=C.halaqas.map(h=>h.id);let hid=ids.length===1?ids[0]:picked('cfHalaqa');
    const needs=L.pickerState(ids)==='choose'&&!hid;
    showErrors(errs,{name:'cfName',title:'cfTitle',conditions:'cfCond',reward:'cfReward',startsOn:'cfStart',endsOn:'cfEnd'});
    const he=document.getElementById('cfHalaqaE');if(he)he.textContent=needs?'اختر الحلقة التي تستهدفها المسابقة':'';
    if(Object.keys(errs).length||needs){if(needs&&!Object.keys(errs).length)document.querySelector('input[name="cfHalaqa"]')?.focus();return}
    if(offline())return serverMsg('cfServer','إرسال المسابقة يحتاج اتصالاً بالإنترنت');
    const btn=document.getElementById('cfSend');C.busy=true;R.busy(btn,true);btn.textContent='جارٍ الإرسال…';
    try{
      await R.rpc('contest_submit',L.buildSubmitArgs(draft,hid));
      R.closeSheet('dnContest');
      flash(role()==='admin'?'أُنشئت المسابقة واعتُمدت، وأُبلغ أصحاب الحلقة':'أُرسلت المسابقة إلى مدير النظام للمراجعة');
      C.busy=false;render();
    }catch(err){C.busy=false;R.busy(btn,false);btn.textContent='إرسال للمراجعة';serverMsg('cfServer',contestError(err,'تعذر إرسال المسابقة'))}
  };
  const serverMsg=(id,t)=>{const el=document.getElementById(id);if(el){el.textContent=t;el.hidden=false}};

  // ---------- admin decision ----------
  C.openDecide=async(i,approve)=>{
    const c=C.items[i];if(!c||c.status!=='pending'||C.busy)return;
    C.decide={c,approve};
    if(!approve){
      R.sheet('dnDecide','رفض المسابقة',`<p><b>${e(c.name)}</b></p><div class="dn-field rc114-fld"><label for="dcReason">سبب الرفض (يظهر لصاحب المسابقة)</label><textarea id="dcReason" rows="3" aria-describedby="dcReasonE"></textarea><small id="dcReasonE" class="rc114-err" role="alert"></small></div><div id="dcServer" class="rc114-notice danger" role="alert" hidden></div>`,
        R.btn('إلغاء','RC50.closeSheet(\'dnDecide\')','text')+`<button type="button" id="dcSend" class="dn-btn" onclick="RC50.contests.decideSend()">رفض</button>`);
      return;
    }
    C.busy=true;const hs=await fetchHalaqas();C.busy=false;
    const arr=Array.isArray(hs)?hs:[];C.halaqas=arr;
    const linkable=c.creator_role==='donor';
    R.sheet('dnDecide','اعتماد المسابقة',`<p><b>${e(c.name)}</b></p>
      ${Array.isArray(hs)?(arr.length?halaqaRadios('dcHalaqa',arr,c.halaqa_id||'',false):'<div class="rc114-notice warning">لا توجد حلقات لعرضها. تحقق من الاتصال ثم أعد المحاولة.</div>'):`<div class="rc114-notice danger" role="alert">${e(contestError(hs.error,'تعذر تحميل الحلقات'))}</div>`}
      <small id="dcHalaqaE" class="rc114-err" role="alert"></small>
      ${linkable?`<label class="dn-check" id="dcLinkRow"><input type="checkbox" id="dcLink" ${c.halaqa_id==null?'checked':''}><span>ربط المانح ${e(c.donor_name||'')} بهذه الحلقة</span></label>`:''}
      <p class="dn-muted">بعد الاعتماد تظهر المسابقة لمحفّظي الحلقة ومشرفيها وأولياء أمور طلابها وطلابها للقراءة فقط.</p><div id="dcServer" class="rc114-notice danger" role="alert" hidden></div>`,
      R.btn('إلغاء','RC50.closeSheet(\'dnDecide\')','text')+`<button type="button" id="dcSend" class="dn-btn" onclick="RC50.contests.decideSend()">اعتماد</button>`);
  };
  C.decideSend=async()=>{
    const d=C.decide;if(!d||C.busy)return;const {c,approve}=d;
    const reason=document.getElementById('dcReason')?.value||'',hid=approve?picked('dcHalaqa'):null;
    const err=L.decisionError(c.status,approve?'approved':'rejected',reason,hid);
    const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t||''};
    if(err==='reason'){set('dcReasonE','اكتب سبب الرفض (3 أحرف على الأقل)');document.getElementById('dcReason')?.focus();return}
    if(err==='halaqa'){set('dcHalaqaE','اختر الحلقة قبل الاعتماد');document.querySelector('input[name="dcHalaqa"]')?.focus();return}
    if(err)return serverMsg('dcServer','تم البت في المسابقة سابقًا');
    if(offline())return serverMsg('dcServer','القرار يحتاج اتصالاً بالإنترنت');
    const btn=document.getElementById('dcSend');C.busy=true;R.busy(btn,true);
    try{
      const link=!!document.getElementById('dcLink')?.checked&&(hid!==c.halaqa_id||c.halaqa_id==null);
      const ok=await R.rpc('contest_decide',L.buildDecideArgs(c.id,approve,reason,hid,link));
      R.closeSheet('dnDecide');
      if(ok===true)flash(approve?'اعتُمدت المسابقة وأُبلغ صاحبها وأصحاب الحلقة':'رُفضت المسابقة وأُبلغ المانح');else flash('تم البت في هذه المسابقة سابقًا','danger');
      C.busy=false;render();
    }catch(ex){C.busy=false;R.busy(btn,false);serverMsg('dcServer',contestError(ex,'تعذر تنفيذ القرار'))}
  };

  // ---------- navigation: the donor gets a «المسابقات» drawer entry (staff and guardian reach contests through «المساهمة») ----------
  const navBase=window.navItems;
  window.navItems=function(){
    const items=navBase.apply(this,arguments);
    if(role()==='observer'&&!items.some(x=>x[0]==='contests')){const i=items.findIndex(x=>x[0]==='donor_support');items.splice(i<0?items.length:i+1,0,['contests','المسابقات'])}
    return items;
  };
  const svgBase=window.navSvg;
  const TRO='<path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/>';
  window.navSvg=function(p){return p==='contests'?`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${TRO}</svg>`:svgBase(p)};
  window.iconFor=window.navSvg;
})();
