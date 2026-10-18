/* Halaqati v2.63.22 — web parity layer with the native app (RC27): home insight cards, display preferences,
   deleted-session restore and full JSON backup. Loaded after the classic runtimes; wraps their globals. */
(function(){
  const PREF_KEY='halaqati_display_v1';
  const html=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readPrefs(){try{return Object.assign({density:'comfortable',reduceMotion:false},JSON.parse(localStorage.getItem(PREF_KEY)||'{}'))}catch(_e){return {density:'comfortable',reduceMotion:false}}}
  function applyPrefs(){const p=readPrefs(),r=document.documentElement;r.classList.toggle('rc27-compact',p.density==='compact');r.classList.toggle('rc27-reduce-motion',!!p.reduceMotion)}
  window.rc27SetPref=function(k,v){const p=readPrefs();p[k]=v;try{localStorage.setItem(PREF_KEY,JSON.stringify(p))}catch(_e){}applyPrefs();if(typeof render==='function')render()};
  applyPrefs();

  // ---------- Home insight cards ----------
  const cache={at:0,att:null,guardians:null};
  function canSeeOrg(){return typeof isOwner==='function'&&(isOwner()||(typeof isSupervisor==='function'&&isSupervisor()))}
  function sinceDate(days){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
  async function loadAttendance(){
    if(cache.att&&Date.now()-cache.at<300000)return cache.att;
    const {data,error}=await db.from('attendance_records').select('student_id,status,sessions!inner(session_date,status)').gte('sessions.session_date',sinceDate(60)).order('recorded_at',{ascending:false}).limit(5000);
    if(error)throw error;cache.att=data||[];cache.at=Date.now();return cache.att;
  }
  async function loadGuardianLinks(){
    if(cache.guardians&&Date.now()-cache.at<300000)return cache.guardians;
    const {data,error}=await db.from('student_guardians').select('student_id').limit(10000);
    if(error)throw error;cache.guardians=new Set((data||[]).map(x=>x.student_id));return cache.guardians;
  }
  function absenceStreaks(rows){
    const by=new Map;
    rows.forEach(r=>{if(!r.sessions||r.sessions.status==='cancelled')return;(by.get(r.student_id)||by.set(r.student_id,[]).get(r.student_id)).push(r)});
    const out=[];
    by.forEach((list,sid)=>{list.sort((a,b)=>String(b.sessions.session_date).localeCompare(a.sessions.session_date));let n=0;for(const r of list){if(r.status==='absent')n++;else if(r.status==='excused')continue;else break}if(n>=3)out.push({sid,n})});
    return out.sort((a,b)=>b.n-a.n);
  }
  function nameOf(sid){return state.students.find(s=>s.id===sid)?.full_name||'طالب'}
  function listCard(title,tone,items,more){
    if(!items.length)return '';
    const shown=items.slice(0,8).map(x=>`<span class="rc27-chip" ${x.sid?`onclick="rc27OpenStudent('${x.sid}')"`:''}>${html(x.label)}</span>`).join('');
    return `<div class="rc27-card rc27-${tone}"><div class="rc27-head"><b>${html(title)}</b><span>${items.length}</span></div><div class="rc27-chips">${shown}${items.length>8?`<span class="rc27-chip rc27-more">+${items.length-8}</span>`:''}</div>${more||''}</div>`;
  }
  window.rc27OpenStudent=function(id){try{if(typeof openStudentProfile==='function')return openStudentProfile(id);if(typeof go==='function'){state.profileStudentId=id;go('students')}}catch(_e){}};
  function halaqaComparison(){
    const hs=state.halaqas||[];if(hs.length<2)return '';
    const rows=hs.map(h=>{const ids=new Set(activeStudents().filter(s=>s.halaqa_id===h.id).map(s=>s.id));let hifz=0,review=0,sard=0;(state.monthly||[]).forEach(m=>{if(ids.has(m.student_id)){hifz+=Number(m.hifz_pages||0);review+=Number(m.review_pages||0);sard+=Number(m.sard_pages||0)}});return {name:h.name,total:hifz+review+sard,students:ids.size}}).filter(r=>r.students).sort((a,b)=>b.total-a.total);
    if(rows.length<2)return '';
    const max=Math.max(1,...rows.map(r=>r.total));
    return `<div class="rc27-card rc27-info"><div class="rc27-head"><b>مقارنة الحلقات هذا الشهر</b><span>${rows.length}</span></div>${rows.map((r,i)=>`<div class="rc27-bar"><div class="rc27-bar-l"><span>${i+1}. ${html(r.name)}</span><b>${typeof fmt==='function'?fmt(r.total):r.total} ص</b></div><div class="rc27-bar-t"><i style="width:${Math.round(r.total/max*100)}%"></i></div></div>`).join('')}</div>`;
  }
  async function fillInsights(){
    const box=document.getElementById('rc27Insights');if(!box)return;
    const slots=[];
    const paint=()=>{if(!box.isConnected)return;const out=slots.filter(Boolean).join('');box.innerHTML=out?`<div class="section-head"><h3>تنبيهات المتابعة</h3></div>${out}`:''};
    const add=(i,v)=>{slots[i]=v;paint()};
    let active=[];
    try{
      active=activeStudents();
      if(canSeeOrg())slots[1]=halaqaComparison();
      const goalIds=new Set((state.goals||[]).map(g=>g.student_id));
      if(Array.isArray(state.goals)&&state.goals.length)slots[2]=listCard('طلاب بلا خطة هذا الشهر','warn',active.filter(s=>!goalIds.has(s.id)).map(s=>({sid:s.id,label:s.full_name})));
      paint();
    }catch(e){console.warn('rc27 insights',e)}
    loadAttendance().then(att=>{const streaks=absenceStreaks(att).filter(x=>active.some(s=>s.id===x.sid));add(0,listCard('غياب متكرر (3 جلسات متتالية فأكثر)','danger',streaks.map(x=>({sid:x.sid,label:`${nameOf(x.sid)} · ${x.n}`}))))}).catch(()=>{});
    if(canSeeOrg())loadGuardianLinks().then(linked=>add(3,listCard('طلاب بلا ولي أمر مرتبط','info',active.filter(s=>!linked.has(s.id)).map(s=>({sid:s.id,label:s.full_name}))))).catch(()=>{});
  }
  if(typeof homePage==='function'){
    const baseHome=homePage;
    homePage=function(){
      const h=baseHome.apply(this,arguments);
      if(state.profile?.role==='guardian')return h;
      setTimeout(fillInsights,0);
      return h+'<div id="rc27Insights"></div>';
    };
  }

  // ---------- Settings: display preferences + admin maintenance ----------
  const DIAG={loadMs:null,loadedAt:null,loads:0};
  if(typeof loadAll==='function'){
    const baseLoad=loadAll;
    loadAll=async function(){const t0=performance.now();try{return await baseLoad.apply(this,arguments)}finally{DIAG.loadMs=Math.round(performance.now()-t0);DIAG.loadedAt=new Date();DIAG.loads++}};
  }
  function diagCard(){
    const q=typeof readOfflineQueue==='function'?readOfflineQueue().length:0;
    return `<div class="card"><h3>التشخيص</h3><div class="muted">${DIAG.loadMs==null?'لم يُحمَّل شيء بعد':`آخر تحميل للبيانات: ${DIAG.loadMs} م.ث (${DIAG.loadedAt.toLocaleTimeString('ar-EG-u-nu-latn')})`}</div><div class="muted">الاتصال: ${state.networkVerified&&!state.offline?'متصل':'دون اتصال'} · عمليات معلقة: ${q} · طلاب: ${(state.students||[]).length} · جلسات: ${(state.sessions||[]).length}</div></div>`;
  }
  function displayCard(){
    const p=readPrefs();
    return `<div class="card"><h3>العرض</h3><div class="settings-row"><div><b>الكثافة المختصرة</b><div class="muted">تصغير المسافات والبطاقات لعرض معلومات أكثر</div></div><input type="checkbox" ${p.density==='compact'?'checked':''} onchange="rc27SetPref('density',this.checked?'compact':'comfortable')"></div><div class="settings-row"><div><b>تخفيف الحركة</b><div class="muted">تعطيل الحركات الاختيارية</div></div><input type="checkbox" ${p.reduceMotion?'checked':''} onchange="rc27SetPref('reduceMotion',this.checked)"></div><div class="settings-row"><div><b>زيتوني الشعار</b><div class="muted">لون التطبيق من هوية حلقاتي الجديدة</div></div><button class="theme-preset" type="button" style="background:#42502D" onclick="setPreset('#42502D','#7C8F4E');saveThemeSettings()"></button></div></div>${diagCard()}`;
  }
  function maintenanceCard(){
    if(!(typeof isOwner==='function'&&isOwner()))return '';
    return `<div class="card"><h3>صيانة البيانات (للمدير)</h3><div class="settings-row"><div><b>الجلسات المحذوفة</b><div class="muted">استرجاع جلسة حُذفت من الخادم مع تسميعها وحضورها</div></div><button class="mini" type="button" onclick="rc27OpenDeletedSessions()">فتح</button></div><div class="settings-row"><div><b>نسخة احتياطية كاملة</b><div class="muted">تنزيل كل البيانات في ملف JSON واحد</div></div><button class="mini" type="button" onclick="rc27Backup(this)">تنزيل</button></div></div>`;
  }
  if(typeof settingsPage==='function'){
    const baseSettings=settingsPage;
    settingsPage=function(){
      const h=baseSettings.apply(this,arguments),k='<div class="card"><b>Designed by';
      const i=h.lastIndexOf(k),extra=displayCard()+maintenanceCard();
      return i>=0?h.slice(0,i)+extra+h.slice(i):h+extra;
    };
  }

  // ---------- Deleted sessions restore ----------
  function dlg(){let d=document.getElementById('rc27Dlg');if(!d){d=document.createElement('dialog');d.id='rc27Dlg';d.className='rc27-dlg';document.body.appendChild(d)}return d}
  window.rc27CloseDlg=function(){const d=document.getElementById('rc27Dlg');if(d?.open)d.close()};
  window.rc27OpenDeletedSessions=async function(){
    const d=dlg();d.innerHTML='<div class="card"><h3>الجلسات المحذوفة</h3><div class="muted">جارٍ التحميل…</div></div>';if(!d.open)d.showModal();
    const {data,error}=await db.from('deleted_session_snapshots').select('id,session_id,deleted_at,restored_at,session_row,recitation_entries,attendance_records,student_daily_notes').order('deleted_at',{ascending:false}).limit(100);
    if(error){d.innerHTML=`<div class="card"><h3>الجلسات المحذوفة</h3><div class="notice">تعذر التحميل: ${html(error.message||error)}</div><div class="form-actions"><button class="btn btn-ghost" onclick="rc27CloseDlg()">إغلاق</button></div></div>`;return}
    const len=a=>Array.isArray(a)?a.length:0;
    const rows=(data||[]).map(r=>{const s=r.session_row||{},h=state.halaqas.find(x=>x.id===s.halaqa_id)?.name||'حلقة';
      return `<div class="card"><b>${html(h)} · ${html(s.session_date||'')}</b><div class="muted">حُذفت ${html(String(r.deleted_at||'').slice(0,16).replace('T',' '))} — تسميع ${len(r.recitation_entries)} · حضور ${len(r.attendance_records)} · ملاحظات ${len(r.student_daily_notes)}</div>${r.restored_at?'<div class="muted">تم استرجاعها سابقًا</div>':`<button class="mini" type="button" onclick="rc27RestoreSession('${r.id}',this)">استرجاع</button>`}</div>`}).join('');
    d.innerHTML=`<div class="card"><h3>الجلسات المحذوفة</h3></div>${rows||'<div class="empty">لا توجد جلسات محذوفة قابلة للاسترجاع.</div>'}<div class="form-actions"><button class="btn btn-ghost" onclick="rc27CloseDlg()">إغلاق</button></div>`;
  };
  window.rc27RestoreSession=async function(id,btn){
    if(!confirm('استرجاع هذه الجلسة؟'))return;btn.disabled=true;
    const {error}=await db.rpc('rc25_restore_deleted_session',{p_snapshot_id:id});
    if(error){btn.disabled=false;return toast('تعذر الاسترجاع: '+(error.message||error))}
    toast('تم استرجاع الجلسة');try{if(typeof loadAll==='function')await loadAll()}catch(_e){}
    rc27OpenDeletedSessions();
  };

  // ---------- Full JSON backup ----------
  window.rc27Backup=async function(btn){
    const tables=['halaqas','student_categories','students','student_guardians','halaqa_teachers','halaqa_supervisors','sessions','attendance_records','recitation_entries','student_daily_notes','smart_plans','smart_plan_events','student_goals','announcements','forum_posts','forum_comments','app_settings'];
    btn.disabled=true;const out={app:'Halaqati',version:'2.63.22',exported_at:new Date().toISOString(),tables:{},errors:{}};
    for(const t of tables){
      const rows=[];let from=0;
      for(;;){
        const {data,error}=await db.from(t).select('*').range(from,from+999);
        if(error){out.errors[t]=error.message||String(error);break}
        rows.push(...(data||[]));if(!data||data.length<1000)break;from+=1000;
      }
      out.tables[t]=rows;toast(`نسخ ${t}…`);
    }
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));a.download=`halaqati-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
    btn.disabled=false;toast(Object.keys(out.errors).length?'تم التنزيل مع تعذر بعض الجداول':'تم تنزيل النسخة الاحتياطية');
  };
})();
