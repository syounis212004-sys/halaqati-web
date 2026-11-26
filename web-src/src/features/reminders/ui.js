/* Halaqati web RC114 — local reminder («تذكير من التطبيق»), mirrors Android ReminderPanel.kt.
   Preferences live in localStorage only (never in the database). A browser cannot schedule anything while it is closed, so the reminder is
   in-app: a banner when the app is opened after the time (and a one-minute timer while it stays open) plus a browser notification when the person
   allowed it. The UI says so plainly. Date maths and storage are in reminders/schedule.mjs. */
(function(){
  'use strict';
  const R=window.RC50,S=window.ReminderLogic;
  if(!R||!S||window.__rc114Reminder)return;window.__rc114Reminder=true;
  const e=R.e,role=()=>state?.profile?.role;
  const store=()=>{try{return window.localStorage}catch(_e){return null}};
  const Rm=R.reminder={};
  const prefs=()=>S.loadPrefs(store());
  const text=()=>S.textForRole(role());
  const perm=()=>typeof Notification==='undefined'?'unsupported':Notification.permission;
  Rm.eligible=()=>!!text();

  // ---------- panel ----------
  const nextLine=p=>{
    if(!p.days.length)return 'اختر يومًا واحدًا على الأقل.';
    const n=S.nextAt(new Date(),p);
    return n?`التذكير القادم: ${S.dayName(n.getDay()===0?7:n.getDay())} ${S.timeLabel(n.getHours(),n.getMinutes())}. يظهر عند فتح التطبيق بعد هذا الموعد.`:'';
  };
  const permBlock=p=>{
    if(!p.enabled)return '';
    const s=perm();
    if(s==='granted')return '<p class="rc114-ok" id="rcPerm">إشعارات المتصفح مسموحة: يصلك التذكير أثناء فتح التطبيق في تبويب.</p>';
    if(s==='denied')return '<div class="rc114-notice warning" id="rcPerm">الإشعارات مغلقة لهذا الموقع في المتصفح. فعّلها من إعدادات الموقع لتصلك إشعارات، وإلا ستظهر لافتة التذكير داخل التطبيق فقط.</div>';
    if(s==='unsupported')return '<div class="rc114-notice info" id="rcPerm">متصفحك لا يدعم الإشعارات، لذلك ستظهر لافتة التذكير داخل التطبيق فقط.</div>';
    return `<div class="rc114-notice info" id="rcPerm">اسمح بإشعارات المتصفح ليصلك التذكير في وقته أثناء فتح التطبيق.</div><div class="dn-actions">${R.btn('السماح بالإشعارات','RC50.reminder.askPerm()')}</div>`;
  };
  Rm.panelHtml=()=>{
    const p=prefs(),t=text();
    return `<section class="dn-card rc114-rem" id="rc114Rem" aria-labelledby="rcRemT">
      <div class="rc114-remhead"><div><h3 id="rcRemT">تذكير من التطبيق</h3><small class="dn-muted">${e(t?t.body:'لا يوجد تذكير لهذا الحساب')}</small></div>
        <label class="rc114-switch"><input type="checkbox" role="switch" ${p.enabled?'checked':''} ${t?'':'disabled'} aria-label="تفعيل التذكير" onchange="RC50.reminder.toggle(this.checked)"><span aria-hidden="true"></span></label></div>
      ${p.enabled?`${permBlock(p)}
        <fieldset class="rc114-set"><legend>أيام التذكير</legend><div class="rc114-days">${S.WEEK.map(([d,n])=>`<button type="button" class="rc114-day ${p.days.includes(d)?'on':''}" aria-pressed="${p.days.includes(d)}" onclick="RC50.reminder.day(${d})">${e(n)}</button>`).join('')}</div></fieldset>
        <div class="dn-field rc114-fld"><label for="rcTime">وقت التذكير</label><input id="rcTime" type="time" dir="ltr" value="${S.toTimeInput(p.hour,p.minute)}" onchange="RC50.reminder.time(this.value)"></div>
        <p class="dn-muted" id="rcNext">${e(nextLine(p))}</p>
        <div class="dn-actions">${R.btn('إرسال تذكير تجريبي الآن','RC50.reminder.test()','tonal')}</div>`
      :'<p class="dn-muted">التذكير مُطفأ. لن يظهر لك أي تنبيه منه.</p>'}
      <div class="rc114-limit"><b>حدود التذكير في الويب</b><p>يعمل التذكير داخل التطبيق فقط: تظهر لافتة عند فتح حلقاتي بعد الموعد، ويصلك إشعار المتصفح إن سمحت به والتطبيق مفتوح في تبويب. لا يمكن للمتصفح إرسال إشعار وهو مغلق؛ لذلك يُحفظ التفضيل على هذا الجهاز فقط.</p></div>
    </section>`;
  };
  const refresh=()=>{const el=document.getElementById('rc114Rem');if(el)el.outerHTML=Rm.panelHtml();const s=document.getElementById('rc114SetRem');if(s)s.outerHTML=settingsCard()};
  const save=p=>S.savePrefs(store(),p);
  Rm.toggle=async on=>{
    const p=prefs();p.enabled=!!on;save(p);
    if(on&&perm()==='default'){try{await Notification.requestPermission()}catch(_e){}}
    refresh();check();
  };
  Rm.day=d=>{const p=prefs();p.days=p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d];save(p);refresh();check()};
  Rm.time=v=>{const t=S.fromTimeInput(v);if(!t)return R.toast('وقت غير صالح');const p=prefs();p.hour=t.hour;p.minute=t.minute;save(p);const n=document.getElementById('rcNext');if(n)n.textContent=nextLine(p);check()};
  Rm.askPerm=async()=>{try{await Notification.requestPermission()}catch(_e){}refresh()};
  Rm.test=()=>{const t=text();if(!t)return;if(!notify(t.title,t.body))R.toast('إشعارات المتصفح غير مسموحة. سيظهر التذكير كلافتة داخل التطبيق.');showBanner(new Date(),true)};

  // ---------- settings card (switch + a way to the full panel) ----------
  const settingsCard=()=>{
    const p=prefs();
    return `<div class="card" id="rc114SetRem"><h3>تذكير المساهمة</h3><div class="settings-row"><div><b>تذكير من التطبيق</b><div class="muted">يظهر داخل التطبيق عند فتحه بعد الموعد، ويُحفظ على هذا الجهاز</div></div><input type="checkbox" role="switch" aria-label="تفعيل تذكير المساهمة" ${p.enabled?'checked':''} onchange="RC50.reminder.toggle(this.checked)"></div><div class="form-actions"><button type="button" class="btn btn-ghost" onclick="RC50.reminder.openPage()">ضبط الأيام والوقت</button></div></div>`;
  };
  Rm.openPage=()=>{if(R.contribute)R.contribute.tab='reminder';go('contribute')};
  const baseSettings=window.settingsPage;
  if(typeof baseSettings==='function')window.settingsPage=function(){const h=baseSettings.apply(this,arguments);return Rm.eligible()?h+settingsCard():h};

  // ---------- in-app banner + notification ----------
  function notify(title,body){
    try{
      if(perm()!=='granted')return false;
      const o={body,lang:'ar',dir:'rtl',tag:'halaqati-reminder',icon:(document.querySelector('link[rel="icon"]')||{}).href};
      if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration){navigator.serviceWorker.getRegistration().then(r=>{if(r&&r.showNotification)r.showNotification(title,o);else new Notification(title,o)}).catch(()=>{try{new Notification(title,o)}catch(_e){}});return true}
      new Notification(title,o);return true;
    }catch(_e){return false}
  }
  const hideBanner=()=>document.getElementById('rc114Banner')?.remove();
  function showBanner(at,preview){
    const t=text();if(!t)return;
    let b=document.getElementById('rc114Banner');
    if(!b){b=document.createElement('div');b.id='rc114Banner';b.className='rc114-banner';b.setAttribute('role','status');const c=document.getElementById('content');if(c&&c.parentNode)c.parentNode.insertBefore(b,c);else return}
    b.dataset.at=String(at.getTime());b.dataset.preview=preview?'1':'';
    b.innerHTML=`<div><b>${e(t.title)}</b><span>${e(t.body)}</span></div><div class="rc114-banner-act"><button type="button" class="dn-btn" onclick="RC50.reminder.bannerOpen()">افتح المساهمة</button><button type="button" class="dn-btn tonal" onclick="RC50.reminder.bannerLater()">لاحقًا</button><button type="button" class="dn-btn text" onclick="RC50.reminder.bannerOff()">إيقاف التذكير</button></div>`;
  }
  const ack=()=>{const b=document.getElementById('rc114Banner');const at=Number(b&&b.dataset.at)||0;if(at&&!b.dataset.preview)S.saveAck(store(),at);hideBanner()};
  Rm.bannerOpen=()=>{ack();if(R.contribute)R.contribute.tab=role()==='guardian'?'sponsor':'contests';go('contribute')};
  Rm.bannerLater=()=>ack();
  Rm.bannerOff=()=>{const p=prefs();p.enabled=false;save(p);ack();refresh();R.toast('أُطفئ التذكير. يمكنك تفعيله من الإعدادات أو من صفحة المساهمة.')};
  /** Opening the contribution page counts as having seen the reminder. */
  Rm.seen=()=>{const at=S.lastDueAt(new Date(),prefs());if(at&&at.getTime()>S.loadAck(store()))S.saveAck(store(),at.getTime());hideBanner()};

  let notified=0;
  function check(){
    try{
      if(!state?.profile||!text()||document.getElementById('app')?.classList.contains('hidden')){hideBanner();return}
      const due=S.dueOccurrence(new Date(),prefs(),S.loadAck(store()));
      const b=document.getElementById('rc114Banner');
      if(!due){if(b&&!b.dataset.preview)hideBanner();return}
      showBanner(due,false);
      if(notified!==due.getTime()){notified=due.getTime();const t=text();notify(t.title,t.body)}
    }catch(err){console.warn('reminder',err)}
  }
  Rm.check=check;
  setInterval(check,60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
  setTimeout(check,2500);
  window.addEventListener('halaqati:ready',()=>setTimeout(check,1500));
})();
