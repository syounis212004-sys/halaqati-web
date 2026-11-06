/* Halaqati web 2.88.0 — parity with native RC52:
   student reward flow (cash / in-kind, admin catalog), tracking bar, per-request message threads (donor ↔ admin only),
   reward policy, month picker, sliding segmented control. Every call is a server RPC (rc52_*). */
(function(){
  'use strict';
  const R=window.RC50;if(!R)return;
  const e=R.e,OBS=['observer'];
  const rs=v=>v==null||v==='null'?'':String(v);
  const CURS=[['ILS','شيكل ₪'],['USD','دولار أمريكي $'],['JOD','دينار أردني']];
  const date5=d=>{const s=rs(d);return s.length>=10?s.slice(5,10).replace('-','/'):''};

  // ================= sliding segmented control =================
  R.seg=(items,cur,fn)=>{
    const idx=Math.max(0,items.findIndex(([v])=>v===cur));
    return `<div class="dn-seg dn-seg2" role="tablist" style="--n:${items.length};--i:${idx}"><i class="dn-seg-ind" aria-hidden="true"></i>${items.map(([v,l])=>`<button type="button" role="tab" aria-selected="${v===cur}" class="${v===cur?'on':''}" onclick="RC50.segGo(this,'${fn}','${e(v)}')">${e(l)}</button>`).join('')}</div>`;
  };
  R.segGo=(btn,fn,v)=>{
    const seg=btn.closest('.dn-seg'),btns=[...seg.querySelectorAll('button')];
    seg.style.setProperty('--i',String(btns.indexOf(btn)));
    btns.forEach(b=>{b.classList.toggle('on',b===btn);b.setAttribute('aria-selected',String(b===btn))});
    const box=document.getElementById('content');if(box)box.classList.add('dn-leaving');
    const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(()=>{if(box)box.classList.remove('dn-leaving');const f=fn.split('.').reduce((o,k)=>o&&o[k],window);if(typeof f==='function')f(v)},reduce?0:170);
  };

  // ================= month picker =================
  const MN=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  R.monthPicker=(keys,cur,fn)=>{
    const i=keys.indexOf(cur);
    R._mp={keys,cur,fn};
    return `<div class="dn-mp"><button type="button" class="dn-mp-arrow" ${i>=0&&i<keys.length-1?'':'disabled'} onclick="RC50.mpStep(1)" aria-label="الشهر السابق">›</button>
      <button type="button" class="dn-mp-mid" onclick="RC50.mpOpen()"><b>${e(R.monthLabel(cur))}</b><span aria-hidden="true">▾</span></button>
      <button type="button" class="dn-mp-arrow" ${i>0?'':'disabled'} onclick="RC50.mpStep(-1)" aria-label="الشهر التالي">‹</button></div>`;
  };
  R.mpStep=d=>{const m=R._mp;if(!m)return;const i=m.keys.indexOf(m.cur)+d;if(i<0||i>=m.keys.length)return;const f=m.fn.split('.').reduce((o,k)=>o&&o[k],window);f(m.keys[i])};
  R.mpOpen=()=>{
    const m=R._mp;if(!m)return;const sorted=[...m.keys].sort();
    const y1=+sorted[sorted.length-1].slice(0,4),y0=+sorted[0].slice(0,4);let body='<p class="dn-muted">الأشهر المعتمدة فقط قابلة للاختيار.</p>';
    for(let y=y1;y>=y0;y--){
      body+=`<h4 class="dn-mp-year">${y}</h4><div class="dn-mp-grid">${MN.map((n,k)=>{const key=`${y}-${String(k+1).padStart(2,'0')}`,ok=m.keys.includes(key);
        return `<button type="button" class="${key===m.cur?'on':''}" ${ok?'':'disabled'} onclick="RC50.mpPick('${key}')">${n}</button>`}).join('')}</div>`;
    }
    R.sheet('dnMonthSheet','اختر الشهر',body,'');
  };
  R.mpPick=k=>{R.closeSheet('dnMonthSheet');const f=R._mp.fn.split('.').reduce((o,x)=>o&&o[x],window);f(k)};

  // ================= tracking bar =================
  R.tracker=r=>{
    const st=rs(r.status),transferred=!!r.transfer_submitted_at,cash=r.kind==='cash';
    const reached=st==='requested'?0:st==='approved'?(transferred?2:1):st==='received'?3:st==='delivered'?4:-1;
    const steps=[['الطلب',r.created_at],['موافقة المدير',r.approved_at],[cash?'تحويل وإثبات':'تسليم الهدية',r.transfer_submitted_at],['استلام',r.received_at],['تسليم للطالب',r.delivered_at]];
    return `<div class="dn-track"><div class="dn-track-bar"><i style="width:${reached<0?0:(reached+1)*20}%"></i></div><div class="dn-track-steps">${steps.map(([l,d],i)=>`<div class="${reached>=i?'on':''}"><span class="dn-dot">${reached>=i?'✓':i+1}</span><b>${e(l)}</b><small>${reached>=i?e(date5(d)):'&nbsp;'}</small></div>`).join('')}</div></div>`;
  };
  const statusText=r=>({requested:'بانتظار موافقة المدير',approved:r.transfer_submitted_at?'بانتظار تأكيد الاستلام':r.kind==='cash'?'بانتظار تحويلك':'بانتظار تسليم الهدية',received:'تم الاستلام · بانتظار التسليم للطالب',delivered:'سُلّمت للطالب',rejected:'اعتذر المدير',cancelled:'أُلغي الطلب'})[r.status]||rs(r.status);

  // ================= message thread (donor ↔ admin only) =================
  R.thread=async(kind,ref,title)=>{
    R._th={kind,ref,last:''};
    R.sheet('dnThreadSheet',title,`<p class="dn-muted">محادثة خاصة بهذا الطلب بينك وبين المدير فقط.</p><div id="dnThread" class="dn-thread"><div class="dn-skel"><i></i><i></i></div></div>
      <div class="dn-thread-in"><textarea id="dnThIn" rows="2" placeholder="اكتب رسالة…"></textarea></div>`,R.btn('إرسال','RC50.thSend()'));
    const poll=async()=>{
      const box=document.getElementById('dnThread');if(!box||!R._th||R._th.ref!==ref)return;
      try{
        const d=await R.rpc('rc52_thread_get',{p_kind:kind,p_ref:ref});const ms=d.messages||[];
        const sig=ms.map(m=>m.id).join(',');
        if(sig!==R._th.last){R._th.last=sig;
          box.innerHTML=ms.length?ms.map(m=>m.role==='system'?`<div class="dn-msg sys"><span>${e(m.body)}</span></div>`:`<div class="dn-msg ${m.mine?'mine':''}"><div>${e(m.body)}</div><small>${e(rs(m.created_at).slice(0,16).replace('T',' '))}</small></div>`).join(''):'<p class="dn-muted">لا توجد رسائل بعد.</p>';
          box.scrollTop=box.scrollHeight;}
      }catch(err){if(!R._th.last)box.innerHTML=`<p class="dn-muted">${e(err.message)}</p>`}
      setTimeout(poll,8000);
    };
    poll();
  };
  R.thSend=async()=>{
    const t=document.getElementById('dnThIn'),v=t?.value.trim();if(!v||!R._th)return;
    try{await R.rpc('rc52_thread_post',{p_kind:R._th.kind,p_ref:R._th.ref,p_body:v});t.value='';R._th.last='';
      const d=await R.rpc('rc52_thread_get',{p_kind:R._th.kind,p_ref:R._th.ref}),box=document.getElementById('dnThread');
      if(box){R._th.last=(d.messages||[]).map(m=>m.id).join(',');box.innerHTML=(d.messages||[]).map(m=>m.role==='system'?`<div class="dn-msg sys"><span>${e(m.body)}</span></div>`:`<div class="dn-msg ${m.mine?'mine':''}"><div>${e(m.body)}</div><small>${e(rs(m.created_at).slice(0,16).replace('T',' '))}</small></div>`).join('');box.scrollTop=box.scrollHeight}
    }catch(err){R.toast(err.message)}
  };

  // ================= donor: request a reward =================
  R.dReward=async()=>{
    const w=R.cache.winner;if(!w)return;
    R._rq={w,kind:'cash',sel:null,options:[],cfg:{allow_other_cash:true,allow_other_inkind:true}};
    try{const [o,c]=await Promise.all([R.rpc('rc52_reward_options'),R.rpc('rc52_settings')]);R._rq.options=o||[];R._rq.cfg=c||R._rq.cfg}catch(err){R.toast(err.message)}
    R.rqDraw();
  };
  R.rqDraw=()=>{
    const q=R._rq,w=q.w,shown=q.options.filter(o=>o.kind===q.kind),other=q.kind==='cash'?q.cfg.allow_other_cash:q.cfg.allow_other_inkind;
    const row=(id,t,sub,right)=>`<label class="dn-opt ${q.sel===id?'on':''}"><input type="radio" name="dnOpt" ${q.sel===id?'checked':''} onchange="RC50.rqSel('${e(id)}')"><div><b>${e(t)}</b>${sub?`<small>${e(sub)}</small>`:''}</div>${right?`<span class="dn-amount">${e(right)}</span>`:''}</label>`;
    const body=`<p class="dn-muted">اختر نوع المكافأة. يراجع المدير الطلب ثم تتابع الخطوات من «الدعم» ← «طلبات المكافآت».</p>
      ${R.seg([['cash','مبلغ مالي'],['inkind','هدية عينية']],q.kind,'RC50.rqKind')}
      ${shown.map(o=>row(o.id,o.title,o.description,o.kind==='cash'?R.amount(o.amount,o.currency):'')).join('')}
      ${!shown.length&&!other?'<p class="dn-muted">لم يحدّد المدير خيارات لهذا النوع بعد.</p>':''}
      ${other?row('other',q.kind==='cash'?'مبلغ آخر أحدده':'هدية أخرى أصفها','',''):''}
      ${q.sel==='other'&&q.kind==='cash'?`<div class="dn-two"><label class="dn-field"><span>المبلغ</span><input id="dnRqAmt" inputmode="decimal"></label><label class="dn-field"><span>العملة</span><select id="dnRqCur">${CURS.map(([v,l])=>`<option value="${v}">${e(l)}</option>`).join('')}</select></label></div>`:''}
      <label class="dn-field"><span>${q.sel==='other'&&q.kind==='inkind'?'صف الهدية':'ملاحظة للمدير (اختياري)'}</span><textarea id="dnRqNote" rows="2"></textarea></label>
      <label class="dn-check"><input type="checkbox" id="dnRqAnon"><span>مجهول الاسم عند الطالب</span></label><p id="dnRqErr" class="dn-err"></p>`;
    R.sheet('dnReward','مكافأة '+w.name,body,R.btn('إرسال الطلب','RC50.rqSend()'));
  };
  R.rqKind=k=>{R._rq.kind=k;R._rq.sel=null;R.rqDraw()};
  R.rqSel=id=>{const keep=document.getElementById('dnRqNote')?.value||'';R._rq.sel=id;R.rqDraw();const n=document.getElementById('dnRqNote');if(n)n.value=keep};
  R.rqSend=async()=>{
    const q=R._rq,err=m=>{const x=document.getElementById('dnRqErr');if(x)x.textContent=m};
    if(!q.sel)return err('اختر خيارًا');
    const note=document.getElementById('dnRqNote').value.trim(),other=q.sel==='other';
    const amt=other&&q.kind==='cash'?parseFloat(String(document.getElementById('dnRqAmt').value).replace(',','.')):null;
    if(other&&q.kind==='cash'&&!(amt>0))return err('اكتب مبلغًا صحيحًا');
    if(other&&q.kind==='inkind'&&note.length<3)return err('صف الهدية');
    try{
      const r=await R.rpc('rc52_reward_request',{p_student:q.w.student_id,p_month:(R.da.month||'')+'-01',p_kind:q.kind,p_option:other?null:q.sel,p_amount:amt,p_currency:other&&q.kind==='cash'?document.getElementById('dnRqCur').value:null,p_note:note,p_anonymous:!!document.getElementById('dnRqAnon').checked});
      if(r&&r.ok){R.closeSheet('dnReward');R.closeSheet('dnWinner');R.toast(r.message||'وصل طلبك إلى المدير')}else err((r&&r.message)||'تعذّر إرسال الطلب');
    }catch(ex){err(ex.message)}
  };

  // ================= donor: reward requests list =================
  R.rwDonorHtml=async()=>{
    const list=await R.rpc('rc52_my_rewards');R.cache.rw=list;
    if(!list.length)return R.card(R.empty('لا توجد طلبات مكافآت بعد. من «المكرَّمون» افتح الطالب ثم «كافئ هذا الطالب».'));
    return list.map((r,i)=>{
      const st=r.status,cash=r.kind==='cash',tr=!!r.transfer_submitted_at,pay=r.pay||{};
      const payCard=st==='approved'&&cash&&!tr?R.payCard({method:pay.pay_method,provider:pay.pay_provider,account:pay.pay_account,holder:pay.pay_holder,note:pay.pay_note},R.amount(r.amount,r.currency)):'';
      return R.card(`<div class="dn-row between"><div><b>${e(r.student_name)} · ${e(R.monthLabel(r.month))}</b><small class="dn-muted">${e([r.title,R.amount(r.amount,r.currency)].filter(Boolean).join(' · '))}</small></div><span class="dn-status">${e(statusText(r))}</span></div>
        ${R.tracker(r)}${r.admin_note?`<p class="dn-muted">ملاحظة المدير: ${e(r.admin_note)}</p>`:''}${payCard}
        ${st==='delivered'?`${r.delivery_text?`<p>إفادة التسليم: ${e(r.delivery_text)}</p>`:''}${r.thanks_text?`<div class="dn-thanks">💌 ${e(r.thanks_text)}</div>`:''}`:''}
        <div class="dn-actions">${st==='approved'&&cash&&!tr?R.btn('رفع إثبات التحويل',`RC50.rwTransfer(${i})`):''}${r.has_delivery_image?R.btn('صورة التسليم',`RC50.rwProof(${i},'delivery')`,'tonal'):''}${R.btn(r.unread>0?`المحادثة (${r.unread})`:'المحادثة',`RC50.thread('reward','${r.id}','مكافأة ${e(String(r.student_name||'').replace(/'/g,''))}')`,'tonal')}${st==='requested'||(st==='approved'&&!tr)?R.btn('إلغاء الطلب',`RC50.rwCancel(${i})`,'text'):''}</div>`);
    }).join('');
  };
  R.rwTransfer=i=>{
    const r=R.cache.rw[i];R.cache.rwSel=r;R.cache.img=null;
    R.sheet('dnRwTr','إثبات التحويل',`<p class="dn-muted">أرسل رقم الحوالة أو صورة الإشعار (يكفي أحدهما).</p><label class="dn-field"><span>رقم الحوالة</span><input id="dnRwRef"></label><label class="dn-field"><span>صورة الإشعار</span><input type="file" accept="image/*" onchange="RC50.dPick(this)"></label><p id="dnImgOk" class="dn-ok"></p>`,R.btn('إرسال','RC50.rwTransferSend()'));
  };
  R.rwTransferSend=async()=>{
    const ref=document.getElementById('dnRwRef').value.trim(),img=R.cache.img;if(ref.length<2&&!img)return R.toast('اكتب رقم الحوالة أو أرفق صورة');
    try{const ok=await R.rpc('rc52_reward_submit_transfer',{p_id:R.cache.rwSel.id,p_ref:ref,p_image:img||null});R.closeSheet('dnRwTr');R.toast(ok?'وصل إثبات التحويل إلى المدير':'تعذّر الإرسال');render()}catch(err){R.toast(err.message)}
  };
  R.rwCancel=i=>{const r=R.cache.rw[i];NX.confirm('إلغاء الطلب','هل تريد إلغاء طلب المكافأة؟','إلغاء الطلب',async()=>{try{const ok=await R.rpc('rc52_reward_cancel',{p_id:r.id});R.toast(ok?'أُلغي الطلب':'لا يمكن إلغاء الطلب في هذه المرحلة');render()}catch(err){R.toast(err.message)}},{danger:true})};
  R.rwProof=async(i,kind,list)=>{const r=(list||R.cache.rw)[i];try{const img=await R.rpc('rc52_reward_proof',{p_id:r.id,p_kind:kind});R.sheet('dnProof',kind==='transfer'?'صورة الحوالة':'صورة التسليم',img?`<img class="dn-proof" src="${e(img)}" alt="">`:'<p>تعذّر تحميل الصورة</p>')}catch(err){R.toast(err.message)}};
  R.payCard=(pay,amount)=>{
    const acc=pay&&pay.account;if(!acc)return `<div class="dn-pay"><b>بيانات التحويل</b><p>لم يحدّد المدير بيانات الدفع بعد. تواصل معه عبر المحادثة.</p></div>`;
    const m={bank:'تحويل بنكي',wallet:'محفظة إلكترونية'}[pay.method]||'';
    return `<div class="dn-pay"><b>بيانات التحويل</b>${amount?`<p class="dn-amount">المبلغ: ${e(amount)}</p>`:''}<p>${e([m,pay.provider].filter(Boolean).join(' · '))}</p><div class="dn-copy"><code>${e(acc)}</code><button type="button" class="dn-link" onclick="RC50.copy('${e(String(acc).replace(/'/g,''))}')">نسخ</button></div>${pay.holder?`<small>باسم: ${e(pay.holder)}</small>`:''}${pay.note?`<small class="dn-muted">${e(pay.note)}</small>`:''}</div>`;
  };

  // support page: two sections (pledges | reward requests)
  const origSupport=R.pages.donor_support;
  const D=R.ds2={sec:'pledges'};
  R.page('donor_support',{title:'الدعم',roles:OBS,render:async()=>{
    const seg=R.seg([['pledges','الكفالات والدعم'],['rewards','طلبات المكافآت']],D.sec,'RC50.dSec');
    const html=D.sec==='rewards'?await R.rwDonorHtml():await origSupport.render();
    return D.sec==='rewards'?`<div class="dn-hello">أهلًا بك، ${e(String(state?.profile?.full_name||'').trim().split(/\s+/)[0]||'')}</div>${seg}${html}`:html.replace('</div>','</div>'+seg.replace(/\$/g,'$$$$'));
  }});
  R.dSec=s=>{D.sec=s;render()};

  // ================= admin: rewards tab =================
  const POL=[['one_per_month','مكافأة واحدة للطالب شهريًا'],['group','قبول عدة طلبات وتجميعها عندي'],['co_fund','تمويل مشترك من عدة مانحين']];
  R.rwAdminHtml=async()=>{
    const [reqs,opts,cfg]=await Promise.all([R.rpc('rc52_admin_rewards'),R.rpc('rc52_reward_options'),R.rpc('rc52_settings')]);
    R.cache.rwA=reqs;R.cache.rwO=opts;R.cache.rwCfg=cfg;
    const settings=R.card(`<h3>سياسة مكافأة الطالب</h3><p class="dn-muted">ماذا يحدث إن أراد أكثر من مانح مكافأة الطالب نفسه في الشهر نفسه؟</p>
      ${POL.map(([v,l])=>`<label class="dn-check"><input type="radio" name="dnPol" ${cfg.dedupe_policy===v?'checked':''} onchange="RC50.rwCfg('dedupe_policy','${v}')"><span>${e(l)}</span></label>`).join('')}
      <label class="dn-check"><input type="checkbox" ${cfg.allow_other_cash?'checked':''} onchange="RC50.rwCfg('allow_other_cash',this.checked)"><span>السماح بمبلغ آخر يحدده المانح</span></label>
      <label class="dn-check"><input type="checkbox" ${cfg.allow_other_inkind?'checked':''} onchange="RC50.rwCfg('allow_other_inkind',this.checked)"><span>السماح بهدية أخرى يصفها المانح</span></label>`);
    const catalog=`<div class="dn-sec"><h3>خيارات المكافأة</h3>${R.btn('خيار جديد','RC50.rwOpt(-1)','tonal')}</div>${opts.map((o,i)=>R.card(`<div class="dn-row between"><div><b>${e(o.title)}${o.active?'':' (مخفي)'}</b><small class="dn-muted">${e([o.kind==='cash'?'مبلغ مالي':'هدية عينية',o.kind==='cash'?R.amount(o.amount,o.currency):''].filter(Boolean).join(' · '))}</small></div><div class="dn-actions">${R.btn('تعديل',`RC50.rwOpt(${i})`,'text')}${R.btn('حذف',`RC50.rwOptDel(${i})`,'text')}</div></div>`,'slim')).join('')||R.card(R.empty('لم تُضف خيارات بعد (مثال: 20 دولار، شنطة مدرسية). يختار المانح منها.'))}`;
    const list=reqs.map((r,i)=>{const st=r.status,cash=r.kind==='cash',tr=!!r.transfer_submitted_at;
      return R.card(`<div class="dn-row between"><div><b>${e(r.student_name)} · ${e(R.monthLabel(r.month))}</b><small class="dn-muted">من: ${e(r.donor_name||'')}${r.anonymous?' (يظهر مجهولًا للطالب)':''}</small><small>${e([r.title,R.amount(r.amount,r.currency)].filter(Boolean).join(' · '))}</small></div><span class="dn-status">${e(statusText(r))}</span></div>
        ${r.same_student_count>1&&(st==='requested'||st==='approved')?`<div class="dn-alert">${r.same_student_count} طلبات لهذا الطالب في هذا الشهر. راجعها معًا قبل الموافقة.</div>`:''}
        ${r.note?`<p class="dn-muted">ملاحظة المانح: ${e(r.note)}</p>`:''}${R.tracker(r)}
        ${tr&&r.transfer_ref?`<small class="dn-ok">رقم الحوالة: ${e(r.transfer_ref)}</small>`:''}
        <div class="dn-actions">${st==='requested'?R.btn('موافقة',`RC50.rwDecide(${i},true)`)+R.btn('اعتذار',`RC50.rwDecide(${i},false)`,'text'):''}${st==='approved'?(r.has_transfer_image?R.btn('صورة الحوالة',`RC50.rwProof(${i},'transfer',RC50.cache.rwA)`,'tonal'):'')+R.btn('تأكيد الاستلام',`RC50.rwConfirm(${i})`):''}${st==='received'?R.btn('تسليم للطالب',`RC50.rwDeliver(${i})`):''}${r.has_delivery_image?R.btn('صورة التسليم',`RC50.rwProof(${i},'delivery',RC50.cache.rwA)`,'tonal'):''}${R.btn(r.unread>0?`المحادثة (${r.unread})`:'المحادثة',`RC50.thread('reward','${r.id}','${e(String(r.student_name||'').replace(/'/g,''))} · ${e(String(r.donor_name||'').replace(/'/g,''))}')`,'tonal')}</div>`);
    }).join('')||R.card(R.empty('لا توجد طلبات مكافآت بعد.'));
    return `${settings}${catalog}<h3 class="dn-h">طلبات المكافآت</h3>${list}`;
  };
  R.rwCfg=async(k,v)=>{try{await R.rpc('rc52_set_settings',{p:{[k]:v}});R.toast('حُفظت الإعدادات')}catch(err){R.toast(err.message)}};
  R.rwOpt=i=>{
    const o=i>=0?R.cache.rwO[i]:null;R.cache.rwOe=o;
    R.sheet('dnRwOpt',o?'تعديل الخيار':'خيار مكافأة جديد',`<label class="dn-field"><span>النوع</span><select id="dnOKind"><option value="cash" ${o?.kind!=='inkind'?'selected':''}>مبلغ مالي</option><option value="inkind" ${o?.kind==='inkind'?'selected':''}>هدية عينية</option></select></label>
      <label class="dn-field"><span>الاسم</span><input id="dnOTitle" value="${e(o?.title||'')}"></label>
      <div class="dn-two"><label class="dn-field"><span>المبلغ (للنقدي)</span><input id="dnOAmt" inputmode="decimal" value="${e(o?.amount==null?'':o.amount)}"></label><label class="dn-field"><span>العملة</span><select id="dnOCur">${CURS.map(([v,l])=>`<option value="${v}" ${o?.currency===v?'selected':''}>${e(l)}</option>`).join('')}</select></label></div>
      <label class="dn-field"><span>وصف (اختياري)</span><textarea id="dnODesc" rows="2">${e(o?.description||'')}</textarea></label>
      <label class="dn-check"><input type="checkbox" id="dnOActive" ${o?.active===false?'':'checked'}><span>ظاهر للمانحين</span></label>`,R.btn('حفظ','RC50.rwOptSave()'));
  };
  R.rwOptSave=async()=>{
    const g=id=>document.getElementById(id).value,kind=g('dnOKind'),title=g('dnOTitle').trim(),amt=g('dnOAmt').trim().replace(',','.');
    if(title.length<2)return R.toast('اكتب اسم الخيار');if(kind==='cash'&&!(parseFloat(amt)>0))return R.toast('اكتب المبلغ');
    const p={kind,title,amount:kind==='cash'?amt:'',currency:g('dnOCur'),description:g('dnODesc').trim(),active:document.getElementById('dnOActive').checked};
    if(R.cache.rwOe)p.id=R.cache.rwOe.id;
    try{await R.rpc('rc52_reward_option_save',{p});R.closeSheet('dnRwOpt');R.toast('حُفظ الخيار');render()}catch(err){R.toast(err.message)}
  };
  R.rwOptDel=i=>{const o=R.cache.rwO[i];NX.confirm('حذف الخيار','حذف «'+o.title+'»؟','حذف',async()=>{try{await R.rpc('rc52_reward_option_delete',{p_id:o.id});R.toast('حُذف الخيار');render()}catch(err){R.toast(err.message)}},{danger:true})};
  R.rwDecide=(i,ok)=>{
    const r=R.cache.rwA[i];R.cache.rwSelA={r,ok};
    R.sheet('dnRwDec',ok?'الموافقة على الطلب':'الاعتذار عن الطلب',`<label class="dn-field"><span>${ok?'ملاحظة للمانح (اختياري)':'سبب الاعتذار (اختياري)'}</span><textarea id="dnRwNote" rows="2"></textarea></label>`,R.btn(ok?'موافقة':'اعتذار','RC50.rwDecideSend()'));
  };
  R.rwDecideSend=async()=>{const {r,ok}=R.cache.rwSelA;try{await R.rpc('rc52_reward_decide',{p_id:r.id,p_approve:ok,p_note:document.getElementById('dnRwNote').value.trim()||null});R.closeSheet('dnRwDec');R.toast(ok?'تمت الموافقة وأُشعر المانح':'تم الاعتذار وأُشعر المانح');render()}catch(err){R.toast(err.message)}};
  R.rwConfirm=async i=>{const r=R.cache.rwA[i];try{await R.rpc('rc52_reward_confirm',{p_id:r.id});R.toast('تم تأكيد الاستلام');render()}catch(err){R.toast(err.message)}};
  R.rwDeliver=i=>{
    const r=R.cache.rwA[i];R.cache.rwSelA={r};R.cache.img=null;
    R.sheet('dnRwDel','إثبات التسليم',`<p class="dn-muted">${e(r.student_name)} · ${e(r.donor_name||'')}</p><label class="dn-field"><span>إفادة مكتوبة</span><textarea id="dnRwDText" rows="2"></textarea></label><label class="dn-field"><span>صورة (اختياري)</span><input type="file" accept="image/*" onchange="RC50.dPick(this)"></label><p id="dnImgOk" class="dn-ok"></p><label class="dn-field"><span>رسالة شكر للمانح (اختياري)</span><textarea id="dnRwDThanks" rows="2"></textarea></label>`,R.btn('تسجيل التسليم','RC50.rwDeliverSend()'));
  };
  R.rwDeliverSend=async()=>{const t=document.getElementById('dnRwDText').value.trim(),img=R.cache.img;if(t.length<2&&!img)return R.toast('اكتب إفادة أو أرفق صورة');
    try{await R.rpc('rc52_reward_deliver',{p_id:R.cache.rwSelA.r.id,p_text:t,p_image:img||null,p_thanks:document.getElementById('dnRwDThanks').value.trim()||null});R.closeSheet('dnRwDel');R.toast('سُجّل التسليم وأُشعر المانح');render()}catch(err){R.toast(err.message)}};
})();
