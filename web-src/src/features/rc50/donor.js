/* Halaqati web 2.86.0 — the donor ("المانح") role: summary home, honoured students, support, impact, statistics.
   Mirrors the native RC32/RC40/RC42/RC46/RC48–RC50 screens; every call is an existing server RPC. */
(function(){
  'use strict';
  const R=window.RC50,e=R.e,OBS=['observer'];
  const firstName=()=>String(state?.profile?.full_name||'').trim().split(/\s+/)[0]||'';
  const ym=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const lastMonth=()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return ym(d)};
  const iso=d=>d.toISOString().slice(0,10);
  const STATUS={pledged:'متعهَّد · بانتظار التحويل',received:'تم استلام الدعم',delivered:'وصل إلى مستحقيه'};
  const KINDS={teacher:'دعم المحفّظين',admin:'دعم مسؤول النظام',hospitality:'ضيافة للطلاب',award:'جوائز الطلاب',other:'أخرى'};
  const REC={once:'مرة واحدة',weekly:'أسبوعي',monthly:'شهري'};
  const head=(title)=>R.hero(`<small>السلام عليكم ورحمة الله</small><h2>${title}</h2>`,[]);
  const topLine=()=>`<div class="dn-hello">أهلًا بك، ${e(firstName())}</div>`;
  const safe=async(fn,fb)=>{try{return await fn()}catch(err){console.warn(err);return fb}};

  // ================= summary home =================
  // web 2.89.32 (native RC83): this month so far by default, with last month one tap away; trend arrows, attendance ring,
  // a 6-month hifz line, winners' photos (rc83_donor_award_photos honours the owner's "show photos" setting).
  const monthsBack=k=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-k);return ym(d)};
  R.repCache=R.repCache||{};
  const report=async m=>{const c=R.repCache[m],cur=monthsBack(0),last=monthsBack(1);if(c&&(m!==cur&&m!==last||Date.now()-c.at<30*60000))return c.v;const v=await safe(()=>R.rpc('rc49_donor_report',{p_month:m+'-01'}),null);if(v)R.repCache[m]={v,at:Date.now()};return v};
  R.photoCache=R.photoCache||{};
  R.awardPhotos=async m=>{if(!m)return {};if(R.photoCache[m])return R.photoCache[m];const v=await safe(()=>R.rpc('rc83_donor_award_photos',{p_month:m+'-01'}),{});R.photoCache[m]=v&&typeof v==='object'?v:{};return R.photoCache[m]};
  R.av=(w,cls,photos)=>{const p=photos&&photos[w.student_id];return p&&String(p).startsWith('data:image/')?`<img class="dn-av ${cls} rc85-ph" src="${p}" alt="">`:`<span class="dn-av ${cls}">${e((w.name||'؟')[0])}</span>`};
  const trend=(now,base,pr)=>{const b=(Number(base)||0)*pr;if(b<=.5)return '';const p=Math.round(((Number(now)||0)-b)/b*100);return `<small class="rc85-trend ${p>=0?'up':'down'}">${p>=0?'▲ '+p:'▼ '+(-p)}٪</small>`};
  const ttile=(l,v,t)=>`<div class="dn-tile"><b>${v}</b><span>${l}</span>${t||''}</div>`;
  const ring=p=>`<div class="dn-tile"><svg viewBox="0 0 44 44" width="52" height="52" style="display:block;margin:auto"><circle cx="22" cy="22" r="18" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="5"/><circle cx="22" cy="22" r="18" fill="none" stroke="var(--primary,#0B6E4F)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(Number(p)||0)*1.131} 200" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor">${p==null?'—':p+'٪'}</text></svg><span>حضور</span></div>`;
  const spark=vals=>{if(vals.length<2)return '';const W=300,H=56,top=Math.max(1,...vals),st=W/(vals.length-1);const pts=vals.map((v,i)=>[W-i*st,H-4-(v/top)*(H-8)]);
    return `<small class="dn-muted" style="font-weight:700">صفحات الحفظ · آخر ${vals.length} أشهر</small><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none"><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--primary,#0B6E4F)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--primary,#0B6E4F)"/>`).join('')}</svg>`};
  R.dView=R.dView||'cur';
  R.dSetView=v=>{R.dView=v;render()};
  R.page('home',{title:'الرئيسية',roles:OBS,render:async()=>{
    const cur=R.dView!=='prev',shown=monthsBack(cur?0:1),baseM=monthsBack(cur?1:2);
    const months=await safe(()=>R.rpc('rc46_award_months'),[]);
    const latest=months[0]?String(months[0].month).slice(0,7):null;
    const hist=[5,4,3,2,1,0].map(monthsBack);
    const [payload,reps,cards,mine,news,photos]=await Promise.all([
      latest?safe(()=>R.rpc('rc46_donor_awards',{p_month:latest+'-01',p_scope:'halaqa'}),null):null,
      Promise.all(hist.map(report)),
      safe(()=>R.rpc('rc49_support_cards'),[]),safe(()=>R.rpc('rc49_my_pledges'),[]),safe(()=>R.rpc('rc49_news_list'),[]),R.awardPhotos(latest)]);
    const byM=Object.fromEntries(hist.map((m,i)=>[m,reps[i]])),rep=byM[shown],base=byM[baseM];
    const now=new Date(),pr=cur?now.getDate()/new Date(now.getFullYear(),now.getMonth()+1,0).getDate():1;
    const groups=payload?.groups||[];
    const names=[...new Set(groups.map(g=>g.halaqa_name).filter(Boolean))];
    const stars=groups.map(g=>({w:(g.winners||[]).find(x=>x.rank===1),cat:g.category_name})).filter(x=>x.w);
    const needProof=mine.filter(p=>(p.status==='pledged'||p.status==='received')&&!p.transfer_submitted_at).length;
    const delivered=mine.filter(p=>p.status==='delivered'),ben=delivered.reduce((s,p)=>s+(Number(p.beneficiaries)||0),0);
    const sec=(t,act,go,inner)=>R.card(`<div class="dn-sec"><h3>${e(t)}</h3><button type="button" class="dn-link" onclick="go('${go}')">${e(act)} ‹</button></div>${inner}`);
    const P=(R.PH&&R.PH.observer)||[['«إِذَا مَاتَ ابْنُ آدَمَ انْقَطَعَ عَمَلُهُ إِلَّا مِنْ ثَلَاثٍ: صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ»','رواه مسلم']],ph=P[Math.floor(Date.now()/864e5)%P.length];
    const hero=`<section class="rc85-dhero"><div class="rc85-dhero-top"><div><small>السلام عليكم ورحمة الله</small><h2>شكرًا لدعمك</h2></div><span class="rc85-dhero-ic">♥</span></div>${names.length?`<span class="rc85-pill">حلقتك: ${e(names.join('، '))}</span>`:''}<blockquote><b>${e(ph[0])}</b><cite>— ${e(ph[1])}</cite></blockquote></section>`;
    const seg=`<div class="rc85-seg"><button type="button" class="${cur?'on':''}" onclick="RC50.dSetView('cur')">هذا الشهر</button><button type="button" class="${cur?'':'on'}" onclick="RC50.dSetView('prev')">الشهر الماضي</button></div>`;
    const summary=rep?`${seg}<div class="dn-tiles">${R.tile('طالبًا',rep.students)}${R.tile('جلسة',rep.sessions)}${R.tile('مكرَّمون',cur?'—':rep.winners)}</div><div class="dn-tiles">${ttile('صفحة حفظ',R.num(rep.hifz_pages),base?trend(rep.hifz_pages,base.hifz_pages,pr):'')}${ttile('صفحة مراجعة',R.num(rep.review_pages),base?trend(rep.review_pages,base.review_pages,pr):'')}${ring(rep.attendance_pct)}</div>${base?`<small class="dn-muted">${cur?'الأسهم: مقارنة بالفترة نفسها من الشهر الماضي (تقريبية)':'الأسهم: مقارنة بالشهر الذي قبله'}</small>`:''}${spark(hist.map(m=>byM[m]).filter(Boolean).map(r=>Number(r.hifz_pages)||0))}`:`${seg}<p class="dn-muted">لا توجد بيانات لهذا الشهر بعد.</p>`;
    return `${topLine()}${hero}
    ${sec('ملخص حلقتك · '+R.monthLabel(shown)+(cur?' (حتى اليوم)':''),'الإحصاءات','donor_stats',summary)}
    ${sec('نجوم الشهر','كل المكرَّمين','donor_awards',stars.length?`<small class="dn-muted">${e(R.monthLabel(latest))}</small>${stars.map(s=>`<div class="dn-row">${R.av(s.w,'gold',photos)}<div><b>${e(s.w.name)}</b><small>${e(s.cat)} · ${R.score(s.w.score)}</small></div></div>`).join('')}`:'<p class="dn-muted">لم يُعتمد تكريم بعد. سيصلك إشعار عند اعتماد المدير.</p>')}
    ${sec('الدعم','افتح الدعم','donor_support',`<p>${cards.length?cards.length+' بطاقة دعم مفتوحة تنتظر كفلاء.':'لا توجد بطاقات دعم مفتوحة الآن.'}</p>${needProof?`<div class="dn-alert">لديك ${needProof} كفالة تنتظر إرسال إثبات التحويل.</div>`:''}`)}
    ${sec('أثري','التفاصيل','donor_impact',`<div class="dn-tiles">${R.tile('كفالة',mine.length)}${R.tile('وصلت',delivered.length)}${R.tile('طالب استفاد',ben)}</div>`)}
    ${news.length?sec('آخر أخبار الحلقة','أثري','donor_impact',news.slice(0,2).map(n=>`<div class="dn-news"><b>${e(n.title)}</b>${n.body?`<p>${e(n.body)}</p>`:''}</div>`).join('')):''}`;
  }});

  // ================= honoured students =================
  const A=R.da={month:null,scope:'halaqa'};
  R.page('donor_awards',{title:'المكرَّمون',roles:OBS,render:async()=>{
    const months=await R.rpc('rc46_award_months');
    if(!months.length)return `${topLine()}${R.card(R.empty('لم يُعتمد تكريم أي شهر بعد. سيصلك إشعار عند اعتماد المدير.'))}`;
    const keys=months.map(m=>String(m.month).slice(0,7));
    if(!A.month||!keys.includes(A.month))A.month=keys[0];
    const [data,photos]=await Promise.all([R.rpc('rc46_donor_awards',{p_month:A.month+'-01',p_scope:A.scope}),R.awardPhotos(A.month)]);
    R.cache.winners=[];
    const pods=g=>{
      const by={};(g.winners||[]).forEach(w=>{by[w.rank]=w});
      return `<div class="dn-podium">${[2,1,3].map(r=>{const w=by[r];if(!w)return '<div class="dn-pod"></div>';const i=R.cache.winners.push(w)-1;
        return `<div class="dn-pod p${r}"><button type="button" class="dn-pod-btn" onclick="RC50.dWinner(${i})">${R.av(w,'m'+r,photos)}<b>${e(w.name)}</b><small>${R.score(w.score)}</small><small class="rc85-lvl m${r}">${['','ذهبي','فضي','برونزي'][r]}</small></button><div class="dn-plinth">${r}</div></div>`}).join('')}</div>`};
    const cards=(data.groups||[]).map(g=>{const title=[A.scope==='halaqa'?g.halaqa_name:null,g.category_name].filter(Boolean).join(' · ');
      return R.card(`<small class="dn-gold">نجوم الشهر</small><h3>${e(title)}</h3>${(g.winners||[]).length?pods(g):'<p class="dn-muted">لم يستوفِ أحد شروط التكريم في هذه المجموعة هذا الشهر.</p>'}`)}).join('')+(data.groups&&data.groups.length?R.card('<h3>كيف احتُسب التكريم؟</h3><p>تُجمع خمسة معايير في درجة من 100، ويعتمد المدير النتيجة بعد انتهاء الشهر.</p><div class="rc85-chips">'+['الحفظ','السرد','الحضور','السلوك','جودة التسميع'].map(c=>'<span>'+c+'</span>').join('')+'</div><small class="dn-muted">المستويات: ذهبي للمركز الأول، فضي للثاني، برونزي للثالث.</small>'):'');
    return `${topLine()}${R.monthPicker(keys,A.month,'RC50.dMonth')}${R.seg([['halaqa','حسب الحلقة'],['category','حسب الفئة']],A.scope,'RC50.dScope')}${cards||R.card(R.empty('لا توجد نتائج لهذا الشهر.'))}`;
  }});
  R.dMonth=m=>{A.month=m;render()};
  R.dScope=s=>{A.scope=s;render()};
  R.dWinner=i=>{
    const w=R.cache.winners[i];if(!w)return;R.cache.winner=w;
    const phone=w.phone&&String(w.phone).trim();
    const body=`<div class="dn-row"><span class="dn-av m${w.rank}">${e((w.name||'؟')[0])}</span><div><b>${e(w.name)}</b><small>${e(w.halaqa_name||'')} · ${R.score(w.score)} · ${R.num(w.pages)} صفحة</small></div></div>
      ${R.bar('الحفظ',w.hifz_pct,false)}${R.bar('السرد',w.sard_pct)}${R.bar('الحضور',w.attendance_pct)}${R.bar('السلوك',w.behavior)}${R.bar('جودة التسميع',w.quality)}
      <p class="dn-muted">للدعم أو المكافأة افتح تبويب «الدعم»، أو اطلب مكافأة هذا الطالب عبر المدير.</p>
      ${phone?`<div class="dn-actions"><a class="dn-btn tonal" href="tel:${e(phone)}">اتصال بولي الأمر</a><a class="dn-btn tonal" target="_blank" rel="noopener" href="https://wa.me/${e(phone.replace(/\D/g,''))}">واتساب</a></div>`:''}`;
    R.sheet('dnWinner',w.name,body,R.btn('كافئ هذا الطالب','RC50.dReward()','tonal'));
  };
  R.dReward=()=>{
    const w=R.cache.winner;if(!w)return;
    R.sheet('dnReward','مكافأة '+w.name,`<p class="dn-muted">يصل طلبك إلى المدير ليرتّب المكافأة ويخبرك.</p><label class="dn-field"><span>ما تودّ تقديمه</span><textarea id="dnRewardNote" rows="3"></textarea></label>`,R.btn('إرسال الطلب','RC50.dRewardSend()'));
  };
  R.dRewardSend=async()=>{
    const w=R.cache.winner,note=document.getElementById('dnRewardNote')?.value.trim();
    if(!note||note.length<3)return R.toast('اكتب ما تودّ تقديمه');
    try{await R.rpc('rc32_observer_submit_request',{p_student:w.student_id,p_kind:'reward',p_note:note});R.closeSheet('dnReward');R.closeSheet('dnWinner');R.toast('وصل طلبك إلى المدير، جزاك الله خيرًا')}catch(err){R.toast(err.message)}
  };

  // ================= support =================
  const stepOf=p=>p.status==='delivered'?4:p.status==='received'?3:p.transfer_submitted_at?2:1;
  const payCard=(pay,amount)=>{
    const acc=pay&&pay.account;
    if(!acc)return `<div class="dn-pay"><b>بيانات التحويل</b><p>لم يحدّد المدير بيانات الدفع بعد. تواصل معه لأخذ رقم الحساب.</p></div>`;
    const m={bank:'تحويل بنكي',wallet:'محفظة إلكترونية'}[pay.method]||'';
    return `<div class="dn-pay"><b>بيانات التحويل</b>${amount?`<p class="dn-amount">المبلغ: ${e(amount)}</p>`:''}<p>${e([m,pay.provider].filter(Boolean).join(' · '))}</p><div class="dn-copy"><code>${e(acc)}</code><button type="button" class="dn-link" onclick="RC50.copy('${e(String(acc).replace(/'/g,''))}')">نسخ</button></div>${pay.holder?`<small>باسم: ${e(pay.holder)}</small>`:''}${pay.note?`<small class="dn-muted">${e(pay.note)}</small>`:''}</div>`;
  };
  R.copy=async t=>{try{await navigator.clipboard.writeText(t);R.toast('نُسخ الرقم')}catch(_e){R.toast(t)}};
  R.page('donor_support',{title:'الدعم',roles:OBS,render:async()=>{
    const [cards,mine]=await Promise.all([R.rpc('rc49_support_cards'),R.rpc('rc49_my_pledges')]);
    R.cache.cards=cards;R.cache.mine=mine;
    const myHtml=mine.length?`<h3 class="dn-h">كفالاتي</h3>${mine.map((p,i)=>{const st=p.status,step=stepOf(p);
      return R.card(`<b>${e(p.title)}</b><small class="dn-muted">${e([p.period,R.amount(p.amount,p.currency)].filter(Boolean).join(' · '))}</small>
        <div class="dn-bar-t"><i style="width:${step*25}%"></i></div>
        <small class="dn-steps">${['تعهّدت','أرسلت الإثبات','استلمنا الدعم','وصل إلى مستحقيه'].map((t,k)=>(k+1<=step?'✓ ':'')+t).join('  ·  ')}</small>
        ${st!=='delivered'?payCard(p.pay,R.amount(p.amount,p.currency)):''}
        ${p.transfer_submitted_at?`<p class="dn-ok">إثبات التحويل: ${e(p.transfer_ref||'صورة مرفقة')}</p>`:''}
        ${st==='delivered'&&p.beneficiaries!=null?`<p>استفاد منها ${e(p.beneficiaries)} طالبًا</p>`:''}
        ${p.proof_text?`<p>${e(p.proof_text)}</p>`:''}${p.thanks_text?`<div class="dn-thanks">💌 ${e(p.thanks_text)}</div>`:''}
        <div class="dn-actions">${st==='pledged'||st==='received'?RC50.btn(p.transfer_submitted_at?'تحديث الإثبات':'أرسل إثبات التحويل',`RC50.dTransfer(${i})`):''}${p.has_image?RC50.btn('صورة التسليم',`RC50.dProof(${i})`,'tonal'):''}${RC50.btn('المحادثة',`RC50.thread('pledge','${p.id}','${e(String(p.title||'').replace(/'/g,''))}')`,'tonal')}${st==='delivered'?RC50.btn('كفّل مرة أخرى',`RC50.dPledgeAgain(${i})`,'tonal'):''}${st==='pledged'?RC50.btn('إلغاء الكفالة',`RC50.dCancel(${i})`,'text'):''}</div>`)}).join('')}`:'';
    const open=cards.map((c,i)=>{const per=c.periods||[],cov=per.filter(p=>p.taken>=c.slots).length,free=per.some(p=>p.taken<c.slots&&!p.mine);
      return R.card(`<small class="dn-gold">${e((KINDS[c.kind]||c.kind)+' · '+(REC[c.recurrence]||''))}</small><h3>${e(c.title)}</h3>${c.description?`<p>${e(c.description)}</p>`:''}
        <small class="dn-muted">${e([R.amount(c.amount,c.currency),c.amount_text,c.beneficiaries!=null?c.beneficiaries+' طالبًا مستفيدًا':'',c.halaqa_name].filter(Boolean).join(' · '))}</small>
        <div class="dn-chips">${per.map(p=>`<span class="dn-chip ${p.taken>=c.slots?'full':''}">${e(p.period)}${p.mine?' ✓ كفالتك':p.taken>=c.slots?' · مكتملة':''}</span>`).join('')}</div>
        ${per.length?`<div class="dn-bar-t"><i style="width:${Math.round(cov/per.length*100)}%"></i></div><small class="dn-muted">غُطّيت ${cov} من ${per.length} فترات</small>`:''}
        <div class="dn-actions">${RC50.btn(free?'أتكفّل':'اكتملت الكفالات',`RC50.dPledge(${i})`,free?'':'disabled')}</div>`)}).join('');
    return `${topLine()}${myHtml}<h3 class="dn-h">فرص الدعم</h3>${open||R.card(R.empty('لا توجد بطاقات دعم مفتوحة الآن. سيصلك إشعار عند نشر بطاقة جديدة.'))}`;
  }});
  R.dPledge=i=>{
    const c=R.cache.cards[i];if(!c)return;R.cache.card=c;
    const free=(c.periods||[]).filter(p=>p.taken<c.slots&&!p.mine);if(!free.length)return;
    R.sheet('dnPledge','التكفّل: '+c.title,`<p class="dn-muted">اختر الفترات التي تتكفّل بها. التحويل يتم خارج التطبيق وسيؤكد المدير الاستلام.</p>
      ${free.map((p,k)=>`<label class="dn-check"><input type="checkbox" class="dn-per" value="${e(p.period)}" ${free.length===1?'checked':''}><span>${e(p.period)}</span></label>`).join('')}
      <label class="dn-check"><input type="checkbox" id="dnAnon"><span>أتكفّل دون ذكر اسمي</span></label>`,R.btn('تأكيد التكفّل','RC50.dPledgeSend()'));
  };
  R.dPledgeAgain=i=>{const p=R.cache.mine[i];const idx=(R.cache.cards||[]).findIndex(c=>c.id===p.card_id);if(idx<0)return R.toast('البطاقة لم تعد مفتوحة');R.dPledge(idx)};
  R.dPledgeSend=async()=>{
    const per=[...document.querySelectorAll('#dnPledge .dn-per:checked')].map(x=>x.value);if(!per.length)return R.toast('اختر فترة واحدة على الأقل');
    try{const r=await R.rpc('rc48_support_pledge',{p_card:R.cache.card.id,p_periods:per,p_anonymous:!!document.getElementById('dnAnon')?.checked});R.closeSheet('dnPledge');
      R.toast(r&&r.created>0?'جزاك الله خيرًا، سُجّلت كفالتك. حوّل المبلغ ثم أرسل إثبات التحويل':'تعذّر التسجيل (قد تكون الفترة اكتملت)');render()}catch(err){R.toast(err.message)}
  };
  R.dCancel=i=>{const p=R.cache.mine[i];NX.confirm('إلغاء الكفالة','هل تريد إلغاء هذه الكفالة؟','إلغاء الكفالة',async()=>{try{await R.rpc('rc48_support_cancel',{p_pledge:p.id});R.toast('أُلغيت الكفالة');render()}catch(err){R.toast(err.message)}},{danger:true})};
  R.dTransfer=i=>{
    const p=R.cache.mine[i];R.cache.pledge=p;R.cache.img=null;
    R.sheet('dnTransfer','إثبات التحويل',`<p class="dn-muted">أرسل رقم الحوالة أو صورة الإشعار (يكفي أحدهما).</p><label class="dn-field"><span>رقم الحوالة</span><input id="dnRef" type="text"></label><label class="dn-field"><span>صورة الإشعار</span><input id="dnImg" type="file" accept="image/*" onchange="RC50.dPick(this)"></label><p id="dnImgOk" class="dn-ok"></p>`,R.btn('إرسال','RC50.dTransferSend()'));
  };
  R.dPick=async inp=>{const f=inp.files&&inp.files[0];if(!f)return;try{R.cache.img=await R.compressImage(f);document.getElementById('dnImgOk').textContent='أُرفقت صورة'}catch(err){R.toast(err.message)}};
  R.dTransferSend=async()=>{
    const ref=document.getElementById('dnRef').value.trim(),img=R.cache.img;if(ref.length<2&&!img)return R.toast('اكتب رقم الحوالة أو أرفق صورة');
    try{const ok=await R.rpc('rc49_support_submit_transfer',{p_pledge:R.cache.pledge.id,p_ref:ref,p_image:img||null});R.closeSheet('dnTransfer');R.toast(ok?'وصل إثبات التحويل إلى المدير، جزاك الله خيرًا':'تعذّر الإرسال');render()}catch(err){R.toast(err.message)}
  };
  R.dProof=async i=>{const p=R.cache.mine[i];try{const img=await R.rpc('rc49_support_proof',{p_pledge:p.id,p_kind:'delivery'});R.sheet('dnProof','صورة الإثبات',img?`<img class="dn-proof" src="${e(img)}" alt="صورة إثبات التسليم">`:'<p>تعذّر تحميل الصورة</p>')}catch(err){R.toast(err.message)}};

  // ================= impact =================
  const streakOf=months=>{const a=months.map(m=>m.split('-').map(Number)).map(([y,m])=>y*12+m).sort((x,y)=>x-y);if(!a.length)return 0;let best=1,run=1;for(let i=1;i<a.length;i++){if(a[i]===a[i-1]+1){run++;best=Math.max(best,run)}else run=1}return best};
  R.page('donor_impact',{title:'أثري',roles:OBS,render:async()=>{
    const rm=lastMonth();
    const [imp,mine,news,rep]=await Promise.all([safe(()=>R.rpc('rc49_donor_impact'),null),safe(()=>R.rpc('rc49_my_pledges'),[]),safe(()=>R.rpc('rc49_news_list'),[]),safe(()=>R.rpc('rc49_donor_report',{p_month:rm+'-01'}),null)]);
    const total=imp?.pledges||0,deliv=imp?.delivered||0,ben=imp?.beneficiaries||0,streak=streakOf(imp?.months||[]);
    const badges=[['🌱','أول كفالة',total>=1],['🔥','٣ أشهر متواصلة',streak>=3],['⭐','٥ كفالات',total>=5],['🏅','١٠٠ طالب استفادوا',ben>=100]];
    let line='';
    if(rep){line=`حلقتك في ${R.monthLabel(rm)}: ${rep.students} طالبًا، ${rep.sessions} جلسة، ${R.num(rep.hifz_pages)} صفحة حفظ جديد، ${R.num(rep.review_pages)} صفحة مراجعة`+(rep.attendance_pct!=null?`، حضور ${rep.attendance_pct}%`:'')+(rep.winners>0?`، و${rep.winners} مكرَّمين`:'')+'. تطبيق حلقتي.';R.cache.shareLine=line}
    return `${topLine()}${R.card(`<h3>أثر دعمك</h3><div class="dn-tiles">${R.tile('كفالة',total)}${R.tile('وصلت',deliv)}${R.tile('طالب استفاد',ben)}</div>${total===0?'<p class="dn-muted">حين تتكفّل بأول بطاقة دعم سيظهر هنا أثر عطائك.</p>':''}<div class="dn-badges">${badges.map(([i,l,on])=>`<span class="dn-badge ${on?'on':''}">${i} ${l}</span>`).join('')}</div>`)}
      ${rep?R.card(`<h3>تقرير ${e(R.monthLabel(rm))}</h3><div class="dn-tiles">${R.tile('طالبًا',rep.students)}${R.tile('جلسة',rep.sessions)}${R.tile('مكرَّمون',rep.winners)}</div><div class="dn-tiles">${R.tile('صفحة حفظ',R.num(rep.hifz_pages))}${R.tile('صفحة مراجعة',R.num(rep.review_pages))}${R.tile('حضور',rep.attendance_pct==null?'—':rep.attendance_pct+'%')}</div><div class="dn-actions">${R.btn('مشاركة الملخص','RC50.dShare()','tonal')}</div>`):''}
      <h3 class="dn-h">سجل عطائي</h3>${mine.length?mine.map(p=>R.card(`<div class="dn-row between"><div><b>${e(p.title)}</b><small>${e([p.period,R.amount(p.amount,p.currency)].filter(Boolean).join(' · '))}</small></div><span class="dn-ok">${e(STATUS[p.status]||p.status)}</span></div>`,'slim')).join(''):R.card(R.empty('لا توجد كفالات بعد. افتح تبويب «الدعم» لتبدأ.'))}
      ${news.length?`<h3 class="dn-h">أخبار الحلقة</h3>${news.map(n=>R.card(`<b>${e(n.title)}</b>${n.body?`<p>${e(n.body)}</p>`:''}<small class="dn-muted">${e(String(n.created_at||'').slice(0,10))}</small>`,'slim')).join('')}`:''}
      ${R.card(`<h3>صندوق الاقتراحات</h3><p class="dn-muted">فكرة أو حاجة تراها في الحلقة؟ تصل مباشرة إلى المدير.</p><label class="dn-field"><span>اقتراحك</span><textarea id="dnSuggest" rows="3"></textarea></label><div class="dn-actions">${R.btn('إرسال','RC50.dSuggest()')}</div>`)}`;
  }});
  R.dShare=async()=>{const t=R.cache.shareLine;if(!t)return;try{if(navigator.share)await navigator.share({text:t});else{await navigator.clipboard.writeText(t);R.toast('نُسخ الملخص')}}catch(_e){}};
  R.dSuggest=async()=>{const t=document.getElementById('dnSuggest').value.trim();if(t.length<3)return R.toast('اكتب اقتراحك');try{await R.rpc('rc49_donor_suggest',{p_text:t});document.getElementById('dnSuggest').value='';R.toast('وصل اقتراحك، جزاك الله خيرًا')}catch(err){R.toast(err.message)}};

  // ================= statistics =================
  const S=R.ds={days:30,q:'',halaqa:''};
  R.page('donor_stats',{title:'الإحصاءات',roles:OBS,render:async()=>{
    const to=new Date(),from=new Date();from.setDate(from.getDate()-(S.days-1));
    const args={p_from:iso(from),p_to:iso(to)};
    const [ov,bd,reqs]=await Promise.all([R.rpc('rc32_observer_overview',args),safe(()=>R.rpc('rc40_observer_breakdown',args),null),safe(()=>R.rpc('rc32_observer_requests'),[])]);
    R.cache.ov=ov;const hal=ov.halaqas||[],names={};hal.forEach(h=>names[h.halaqa_id]=h.name);
    const bs={};(bd?.students||[]).forEach(x=>bs[x.student_id]=x);
    const tot=k=>(bd?.halaqas||[]).reduce((s,h)=>s+(Number(h[k])||0),0);
    const students=(ov.students||[]).filter(s=>(!S.halaqa||s.halaqa_id===S.halaqa)&&(!S.q||String(s.name).includes(S.q)));
    R.cache.students=students;
    const totals=hal.reduce((a,h)=>({st:a.st+h.students,rc:a.rc+h.recitations,pg:a.pg+Number(h.pages||0)}),{st:0,rc:0,pg:0});
    const split=b=>b?`حفظ ${R.num(b.hifz)} · مراجعة ${R.num(b.review)} · سرد ${R.num(b.sard)}`+(b.tathbit>0?` · تثبيت ${R.num(b.tathbit)}`:'')+' صفحة':'';
    return `${topLine()}${R.seg([['7','آخر 7 أيام'],['30','آخر 30 يومًا'],['90','آخر 90 يومًا']],String(S.days),'RC50.sDays')}
      <div class="dn-tiles two">${R.tile('الطلاب',totals.st)}${R.tile('التسميعات',totals.rc)}</div>
      <div class="dn-tiles">${R.tile('الحفظ',R.num(tot('hifz')))}${R.tile('المراجعة',R.num(tot('review')))}${R.tile('السرد (نطاق)',R.num(tot('sard')))}</div>
      <h3 class="dn-h">الحلقات</h3>${hal.map(h=>{const b=(bd?.halaqas||[]).find(x=>x.halaqa_id===h.halaqa_id);return R.card(`<b>${e(h.name)}</b><small class="dn-muted">${h.students} طالب · ${h.recitations} تسميعة · سلامة التسميع ${h.safety==null?'—':R.num(h.safety)+'٪'}</small>${b?`<small>${e(split(b))}</small>`:''}`,'slim')}).join('')||R.card(R.empty('لا توجد حلقات.'))}
      <h3 class="dn-h">الطلاب</h3><label class="dn-field"><input id="dnQ" type="search" placeholder="بحث باسم الطالب" value="${e(S.q)}" oninput="RC50.sSearch(this.value)"></label>
      ${students.slice(0,150).map((s,i)=>R.card(`<div class="dn-row between"><div><b>${e(s.name)}</b><small>${e(names[s.halaqa_id]||'')} · ${s.recitations} تسميعة · ${R.num(s.pages)} صفحة</small>${bs[s.student_id]?`<small>${e(split(bs[s.student_id]))}</small>`:''}</div><button type="button" class="dn-link" onclick="RC50.sStudent(${i})">تفاصيل ‹</button></div>`,'slim')).join('')||R.card(R.empty('لا توجد نتائج.'))}
      ${reqs.length?`<h3 class="dn-h">طلباتي للمدير</h3>${reqs.map(r=>R.card(`<b>${e(({reward:'مكافأة',honor:'تكريم',follow_up:'متابعة',other:'أخرى'})[r.kind]||r.kind)} · ${e(r.student_name||'')}</b><small>${e(r.note||'')}</small><small class="dn-ok">${e(({approved:'تمت الموافقة',declined:'لم تتم الموافقة'})[r.status]||'بانتظار المدير')}</small>`,'slim')).join('')}`:''}`;
  }});
  R.sDays=d=>{S.days=Number(d);render()};
  R.sSearch=v=>{S.q=v.trim();clearTimeout(R._sq);R._sq=setTimeout(()=>render().then(()=>{const i=document.getElementById('dnQ');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}}),350)};
  R.sStudent=async i=>{
    const s=R.cache.students[i];if(!s)return;R.cache.stu=s;
    const to=new Date(),from=new Date();from.setDate(from.getDate()-(S.days-1));
    let d;try{d=await R.rpc('rc42_observer_student_detail',{p_student:s.student_id,p_from:iso(from),p_to:iso(to)})}catch(err){return R.toast(err.message)}
    const att=d.attendance||{},kinds={new_hifz:'حفظ',review_near:'مراجعة قريبة',review_far:'مراجعة بعيدة',sard:'سرد',tilawah:'تلاوة',test:'اختبار',tathbit:'تثبيت'};
    const rows=(d.recitations||[]).slice(0,40).map(r=>`<div class="dn-rec"><span>${e(r.date)}</span><b>${e(kinds[r.kind]||r.kind)}</b><span>${r.start_page!=null?`ص ${r.start_page}–${r.end_page}`:`${R.num(r.pages)} ص`}</span><span>${r.safety==null?'':R.num(r.safety)+'٪'}</span></div>`).join('');
    R.sheet('dnStu',s.name,`<div class="dn-tiles">${R.tile('حاضر',att.present||0)}${R.tile('متأخر',att.late||0)}${R.tile('غائب',att.absent||0)}${R.tile('بعذر',att.excused||0)}</div><h4>آخر التسميعات</h4>${rows||'<p class="dn-muted">لا توجد تسميعات في الفترة.</p>'}`,
      `${R.btn('طلب مكافأة','RC50.sRequest(\'reward\')','tonal')}${R.btn('طلب تكريم','RC50.sRequest(\'honor\')','tonal')}${R.btn('طلب متابعة','RC50.sRequest(\'follow_up\')','tonal')}`);
  };
  R.sRequest=kind=>{R.cache.reqKind=kind;R.sheet('dnReq','طلب إلى المدير',`<label class="dn-field"><span>السبب أو ما تودّ تقديمه</span><textarea id="dnReqNote" rows="3"></textarea></label>`,R.btn('إرسال','RC50.sRequestSend()'))};
  R.sRequestSend=async()=>{const n=document.getElementById('dnReqNote').value.trim();if(n.length<3)return R.toast('اكتب السبب');try{await R.rpc('rc32_observer_submit_request',{p_student:R.cache.stu.student_id,p_kind:R.cache.reqKind,p_note:n});R.closeSheet('dnReq');R.closeSheet('dnStu');R.toast('وصل طلبك إلى المدير');render()}catch(err){R.toast(err.message)}};
})();
