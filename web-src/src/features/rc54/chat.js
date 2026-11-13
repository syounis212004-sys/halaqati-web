/* Halaqati web 2.89.12 — donor chats.
   Admin: "محادثات المانحين" list (every conversation, unread badges, start a new one with any donor).
   Donor: "محادثة مع المدير" on the support page.
   Tapping a chat notification (in the list or from a push) opens that conversation directly. */
(function(){
  const R=window.RC50;if(!R||window.__rc54Chat)return;window.__rc54Chat=true;
  const e=v=>typeof window.esc==='function'?window.esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>state?.profile?.role;
  const KIND={direct:'محادثة عامة',reward:'طلب مكافأة',pledge:'كفالة / دعم'};
  const NEED_SQL='لم يُطبَّق تحديث قاعدة البيانات الخاص بالمحادثات (RC54) بعد.';
  const miss=err=>/rc54_|function .* does not exist|PGRST202/i.test(String(err&&err.message||err));
  const when=t=>{try{return window.gazaFmt?gazaFmt.short(t):''}catch(_e){return ''}};
  const C=R.chat={cur:null};

  // ---------- push (best effort; the edge function only exists once it has been deployed) ----------
  async function pushNow(){try{if(navigator.onLine&&typeof db!=='undefined'&&db.functions)await db.functions.invoke('halaqati-chat-push',{body:{}})}catch(_e){}}

  // ---------- conversation view ----------
  const msgHtml=ms=>ms.length?ms.map(m=>m.role==='system'?`<div class="dn-msg sys"><span>${e(m.body)}</span></div>`:`<div class="dn-msg ${m.mine?'mine':''}"><div>${e(m.body)}</div><small>${e(when(m.created_at))}</small></div>`).join(''):'<p class="dn-muted">لا توجد رسائل بعد. ابدأ المحادثة.</p>';
  async function load(first){
    const cur=C.cur,box=document.getElementById('dnChatBox');if(!cur||!box)return;
    try{
      const d=await R.rpc('rc54_thread_get_by_id',{p_tid:cur.tid});
      if(C.cur!==cur||!document.getElementById('dnChatBox'))return;
      const ms=d.messages||[],sig=ms.map(m=>m.id).join(',');
      if(d.donor_name&&role()==='admin'){const t=document.querySelector('#dnChat .nx-dlg-head h3');if(t&&!cur.titled){cur.titled=1;t.textContent=`${d.donor_name} · ${KIND[d.kind]||''}`}}
      if(sig!==cur.last){
        const near=box.scrollHeight-box.scrollTop-box.clientHeight<80;
        cur.last=sig;box.innerHTML=msgHtml(ms);
        if(first||near)box.scrollTop=box.scrollHeight;
      }
    }catch(err){if(!cur.last)box.innerHTML=`<p class="dn-muted">${e(miss(err)?NEED_SQL:err.message||'تعذر تحميل المحادثة')}</p>`}
  }
  function loop(cur){setTimeout(async()=>{if(C.cur!==cur||!document.getElementById('dnChatBox'))return;await load(false);loop(cur)},6000)}
  C.open=function(tid,title){
    const cur=C.cur={tid,last:'',titled:0};
    R.sheet('dnChat',title||'محادثة',`<div id="dnChatBox" class="dn-thread dn-chat"><div class="dn-skel"><i></i><i></i></div></div>
      <div class="dn-thread-in"><textarea id="dnChatIn" rows="2" maxlength="2000" placeholder="اكتب رسالة…" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter')RC50.chat.send()"></textarea></div>`,R.btn('إرسال','RC50.chat.send()'));
    load(true).then(()=>loop(cur));
  };
  C.send=async function(){
    const t=document.getElementById('dnChatIn'),v=t?.value.trim(),cur=C.cur;if(!v||!cur)return;
    t.disabled=true;
    try{
      const ok=await R.rpc('rc54_thread_post_by_id',{p_tid:cur.tid,p_body:v});
      if(ok===false)throw new Error('تعذر إرسال الرسالة');
      t.value='';cur.last='';await load(true);pushNow();
    }catch(err){R.toast(miss(err)?NEED_SQL:(err.message||'تعذر الإرسال'))}
    t.disabled=false;t.focus();
  };

  // ---------- admin: conversations list ----------
  R.page('chats',{title:'محادثات المانحين',roles:['admin'],render:async()=>{
    let d;try{d=await R.rpc('rc54_chat_overview')}catch(err){return R.card(R.empty(miss(err)?NEED_SQL:(err.message||'تعذر تحميل المحادثات')))}
    const threads=(d&&d.threads)||[],donors=(d&&d.donors)||[];
    const unread=threads.reduce((s,t)=>s+Number(t.unread||0),0);
    const head=`<div class="ch-head"><div><b>المحادثات</b><small>${unread?`${unread} رسالة غير مقروءة`:'لا رسائل جديدة'}</small></div>${R.btn('محادثة جديدة','RC50.chat.newPick()')}</div>`;
    R.cache.chatDonors=donors;
    const rows=threads.map(t=>`<button type="button" class="ch-row ${Number(t.unread)?'unread':''}" onclick="RC50.chat.open('${e(t.id)}','${e(String(t.donor_name||'').replace(/'/g,'’'))} · ${e(KIND[t.kind]||'')}')">
        <span class="ch-av" aria-hidden="true">${e(String(t.donor_name||'؟').trim().charAt(0)||'؟')}</span>
        <span class="ch-main"><b>${e(t.donor_name||'مانح')}</b><small class="ch-kind">${e(KIND[t.kind]||'')}</small><span class="ch-last">${t.last_role==='admin'?'أنت: ':''}${e(t.last_body||'')}</span></span>
        <span class="ch-meta"><small>${e(when(t.last_message_at))}</small>${Number(t.unread)?`<i class="ch-badge">${Number(t.unread)}</i>`:''}</span></button>`).join('');
    return head+(rows?`<div class="ch-list">${rows}</div>`:R.card(R.empty('لا توجد محادثات بعد. اضغط «محادثة جديدة» لمراسلة أحد المانحين.')));
  }});
  C.newPick=function(){
    const donors=R.cache.chatDonors||[];
    if(!donors.length)return R.toast('لا يوجد مانحون مسجَّلون بعد');
    R.sheet('dnChatNew','محادثة جديدة مع مانح',`<p class="dn-muted">اختر المانح الذي تريد مراسلته.</p><div class="ch-list">${donors.map(x=>`<button type="button" class="ch-row" onclick="RC50.chat.newGo('${e(x.id)}','${e(String(x.name||'').replace(/'/g,'’'))}')"><span class="ch-av" aria-hidden="true">${e(String(x.name||'؟').trim().charAt(0)||'؟')}</span><span class="ch-main"><b>${e(x.name||'مانح')}</b></span></button>`).join('')}</div>`,'');
  };
  C.newGo=async function(donor,name){
    try{const tid=await R.rpc('rc54_thread_open',{p_donor:donor});R.closeSheet('dnChatNew');C.open(tid,`${name} · ${KIND.direct}`)}
    catch(err){R.toast(miss(err)?NEED_SQL:(err.message||'تعذر فتح المحادثة'))}
  };

  // ---------- donor: chat with the administrator ----------
  C.donorOpen=async function(){
    try{const tid=await R.rpc('rc54_thread_open',{p_donor:state.user.id});C.open(tid,'محادثة مع المدير')}
    catch(err){R.toast(miss(err)?NEED_SQL:(err.message||'تعذر فتح المحادثة'))}
  };
  const sup=R.pages&&R.pages.donor_support;
  if(sup&&typeof sup.render==='function'){
    const baseRender=sup.render;
    sup.render=async function(){
      const html=await baseRender.apply(this,arguments);
      return `<div class="ch-donorbar">${R.btn('محادثة مع المدير','RC50.chat.donorOpen()','tonal')}</div>`+html;
    };
  }

  // ---------- notifications open the conversation ----------
  const baseDeep=window.openNotificationDeepLink;
  if(typeof baseDeep==='function'){
    window.openNotificationDeepLink=function(link,n){
      try{
        const v=String(link||''),sk=String((n&&(n.source_key||n.notification_id))||'');
        let tid=null;
        if(v.startsWith('chat:'))tid=v.slice(5);
        else if(n&&(n.kind==='support_thread'||sk.startsWith('msg:'))){const m=/^msg:([0-9a-f-]{36})/i.exec(sk);if(m)tid=m[1]}
        if(tid&&/^[0-9a-f-]{36}$/i.test(tid)&&['admin','observer'].includes(role()))return C.open(tid,role()==='admin'?'محادثة مع مانح':'محادثة مع المدير');
      }catch(_e){}
      return baseDeep.apply(this,arguments);
    };
  }
})();
