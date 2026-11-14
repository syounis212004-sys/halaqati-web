/* Halaqati web 2.89.32 — ports the native RC67–RC85 work to the web:
   one welcome+day card with the account photo, guardian card with the child's photo, administrative structure
   (associations → admin → supervisors → centers → teachers → students) with add / remove, compact association team,
   avatar shape + "show winners' photos to donors" settings, platform-owner detection. */
(function(){
  'use strict';
  const R=window.RC50;if(!R||window.__rc85Portal)return;window.__rc85Portal=true;
  const e=R.e||(v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const role=()=>state?.profile?.role;
  const me=()=>state?.user?.id||state?.profile?.id;
  const isImg=v=>typeof v==='string'&&v.startsWith('data:image/');
  const K=R.k85={assoc:null,orgAt:0,org:null,open:{}};

  // ---------------- avatar shape (same three shapes as the app) ----------------
  const SHAPE_KEY='rc85_avatar_shape';
  const shape=()=>{try{return localStorage.getItem(SHAPE_KEY)||'ring'}catch(_e){return 'ring'}};
  const applyShape=()=>{document.documentElement.setAttribute('data-avatar-shape',shape())};
  applyShape();
  R.avatar=(photo,name,size)=>{
    const s=size||44;
    return isImg(photo)?`<img class="rc85-ph" src="${photo}" alt="" style="width:${s}px;height:${s}px">`
      :`<span class="rc85-ph rc85-ini" style="width:${s}px;height:${s}px;font-size:${Math.round(s*.42)}px">${e(String(name||'؟').trim().charAt(0)||'؟')}</span>`;
  };

  // ---------------- owner + my photo ----------------
  async function loadMe(){
    try{
      if(!me()||typeof db==='undefined')return;
      const {data}=await db.from('profiles').select('id,avatar_path,is_platform_owner').eq('id',me()).limit(1);
      const row=(data||[])[0]||{};
      window.__rc85Owner=!!row.is_platform_owner;const had=K.myPhoto;
      K.myPhoto=isImg(row.avatar_path)?row.avatar_path:null;
      try{if(K.myPhoto)localStorage.setItem('rc85_me_photo_'+me(),K.myPhoto)}catch(_e){}
      decorate();if(!had&&K.myPhoto&&state.page==='home'&&window.nhRerender)window.nhRerender();if(window.RC86&&RC86.refreshOrg)RC86.refreshOrg();
    }catch(_e){}
  }
  const myPhoto=()=>{if(K.myPhoto)return K.myPhoto;try{return localStorage.getItem('rc85_me_photo_'+me())}catch(_e){return null}};
  R.myPhoto=myPhoto;
  setTimeout(loadMe,1500);
  window.addEventListener('online',()=>setTimeout(loadMe,1200));

  // ---------------- guardian: the child's photo (small RPC; stored on this device) ----------------
  async function childPhoto(sid){
    if(!sid)return null;
    const key='rc85_child_photo_'+sid;
    const local=state.photoUrls&&state.photoUrls[sid];if(isImg(local))return local;
    try{const c=localStorage.getItem(key);if(c)return c==='-'?null:c}catch(_e){}
    try{
      const {data,error}=await db.rpc('guardian_child_photo',{p_student_id:sid});
      if(error)return null;
      const v=isImg(data)?data:null;try{localStorage.setItem(key,v||'-')}catch(_e){}
      return v;
    }catch(_e){return null}
  }

  // ---------------- one card: welcome + day card ----------------
  function decorate(){
    const box=document.getElementById('content');if(!box)return;
    const w=box.querySelector('.s3-welcome');
    const hero=box.querySelector('.nh-hero');
    const today=box.querySelector('.nh-today');
    if(w&&!w.dataset.rc85){
      w.dataset.rc85='1';
      if(role()!=='guardian'){
        const ph=document.createElement('span');ph.className='rc85-wph';
        ph.innerHTML=R.avatar(myPhoto(),state.profile?.full_name,56);w.appendChild(ph);
      }
    }
    if(w&&hero&&!hero.dataset.rc85){hero.dataset.rc85='1';hero.classList.add('rc85-merged');w.classList.add('rc85-in');hero.prepend(w)}
    if(w&&today&&!today.dataset.rc85){today.dataset.rc85='1';today.classList.add('rc85-merged');w.classList.add('rc85-in');today.prepend(w)}
    const art=box.querySelector('.rc85-child');
    if(art&&!art.dataset.done){
      art.dataset.done='1';const sid=art.getAttribute('data-sid');
      childPhoto(sid).then(p=>{if(p&&art.isConnected)art.innerHTML=R.avatar(p,'',88)});
    }
  }
  const prevRender=window.render;
  window.render=async function(){const r=await prevRender.apply(this,arguments);try{decorate();settingsCards()}catch(err){console.warn('rc85',err)}return r};
  new MutationObserver(()=>{try{decorate()}catch(_e){}}).observe(document.documentElement,{childList:true,subtree:true});

  // ---------------- settings: avatar shape + donor photos (owner/admin) ----------------
  function settingsCards(){
    if(state?.page!=='settings')return;
    const box=document.getElementById('content');if(!box||box.querySelector('.rc85-set'))return;
    const s=shape(),opt=(k,l)=>`<button type="button" class="rc85-chip ${s===k?'on':''}" onclick="RC50.k85.setShape('${k}')">${l}</button>`;
    let html=`<div class="card rc85-set"><h3>الصور</h3><div class="muted">شكل صور الطلاب والفريق على هذا الجهاز.</div><div class="rc85-chips2">${opt('ring','حلقة')}${opt('circle','دائرة')}${opt('rounded','مربع مدوّر')}</div>`;
    if(role()==='admin')html+=`<div class="settings-row" style="margin-top:10px"><div><b>إظهار صور المكرَّمين للمانحين</b><div class="muted">يرى المانحون صور الطلاب المكرَّمين فقط؛ أطفئه لإخفائها</div></div><input id="rc85DonorPh" type="checkbox" onchange="RC50.k85.setDonorPhotos(this)"></div>`;
    html+='</div>';
    const div=document.createElement('div');div.innerHTML=html;box.insertBefore(div.firstElementChild,box.children[1]||null);
    if(role()==='admin')db.from('app_settings').select('donor_show_photos').limit(1).then(({data})=>{const c=document.getElementById('rc85DonorPh');if(c)c.checked=!(data&&data[0]&&data[0].donor_show_photos===false)});
  }
  K.setShape=k=>{try{localStorage.setItem(SHAPE_KEY,k)}catch(_e){}applyShape();const b=document.querySelector('.rc85-set');b&&b.remove();settingsCards()};
  K.setDonorPhotos=async el=>{const on=!!el.checked;el.disabled=true;const {error}=await db.from('app_settings').update({donor_show_photos:on}).eq('id',1);el.disabled=false;if(error){el.checked=!on;R.toast(error.message)}else R.toast(on?'تظهر صور المكرَّمين للمانحين':'أُخفيت صور المكرَّمين عن المانحين')};

  // ---------------- Arabic counts ----------------
  const countAr=(n,sing,one,two,plural)=>n<=0?'بدون '+plural:n===1?one:n===2?two:n<=10?`${n} ${plural}`:`${n} ${sing}`;

  // ---------------- administrative structure ----------------
  async function loadOrg(force){
    if(!force&&K.org&&Date.now()-K.orgAt<60000)return K.org;
    const q=(t,sel,mod)=>{let x=db.from(t).select(sel);if(mod)x=mod(x);return x};
    const [a,c,h,tl,sl,p,st]=await Promise.all([
      q('associations','*',x=>x.order('created_at')),q('centers','*',x=>x.order('name')),
      q('halaqas','id,name,active,association_id,center_id,logo_path',x=>x.eq('active',true).order('name')),
      q('halaqa_teachers','halaqa_id,teacher_id'),q('halaqa_supervisors','halaqa_id,supervisor_id'),
      q('profiles','id,full_name,role,association_id,avatar_path,is_platform_owner,active',x=>x.in('role',['admin','supervisor','teacher']).order('full_name')),
      q('students','id,halaqa_id,status',x=>x.eq('status','active').limit(5000))]);
    if(h.error)throw h.error;
    const people=(p.data||[]).filter(x=>x.active!==false);
    const by=Object.fromEntries(people.map(x=>[x.id,x]));
    const per={};(st.data||[]).forEach(s=>{per[s.halaqa_id]=(per[s.halaqa_id]||0)+1});
    const halaqas=(h.data||[]).map(x=>({...x,students:per[x.id]||0,
      teachers:(tl.data||[]).filter(l=>l.halaqa_id===x.id).map(l=>by[l.teacher_id]).filter(Boolean),
      sups:(sl.data||[]).filter(l=>l.halaqa_id===x.id).map(l=>by[l.supervisor_id]).filter(Boolean)}));
    const assocs=(a.data||[]).map(as=>{
      const mine=halaqas.filter(x=>x.association_id===as.id),staff=people.filter(x=>!x.is_platform_owner&&x.association_id===as.id);
      const centers=(c.data||[]).filter(x=>x.association_id===as.id&&x.active!==false).map(cn=>({...cn,halaqat:mine.filter(x=>x.center_id===cn.id)}));
      const known=new Set(centers.map(x=>x.id));
      return {...as,admins:staff.filter(x=>x.role==='admin'),sups:staff.filter(x=>x.role==='supervisor'),teachers:staff.filter(x=>x.role==='teacher'),
        centers,loose:mine.filter(x=>!x.center_id||!known.has(x.center_id)),halaqat:mine.length,students:mine.reduce((s,x)=>s+x.students,0)};
    });
    K.org={assocs,people,halaqas,centersMissing:!!c.error};K.orgAt=Date.now();return K.org;
  }
  const grad={deep:'#084F39,#0B6E4F',gold:'#9A6B00,#D9A94B',emerald:'#0B6E4F,#1FA37A',teal:'#0B6B7A,#2BB3C0',blue:'#1451A3,#3F8EE0',slate:'#2F4A5C,#5C8097'};
  const band=(g,inner)=>`<div class="rc85-band" style="background:linear-gradient(135deg,${grad[g]})">${inner}</div>`;
  const stat=(l,v)=>`<div class="rc85-stat"><b>${e(v)}</b><span>${e(l)}</span></div>`;
  const sectionH=(n,t,g,act,fn)=>`<div class="rc85-sec"><span class="rc85-step" style="background:linear-gradient(135deg,${grad[g]})">${n}</span><b>${e(t)}</b>${act?`<button type="button" class="dn-btn tonal" onclick="${fn}">${e(act)}</button>`:''}</div>`;
  const personCard=(p,g,roleText,halaqat,removeFn)=>`<div class="rc85-person" style="border-color:var(--rc85-${g},#0B6E4F)">${band(g,`${R.avatar(p.avatar_path,p.full_name,54)}<div class="rc85-pt"><b>${e(p.full_name)}</b><small>${e(roleText)}${halaqat.length?' · '+e(halaqat.join('، ')):''}</small></div>${removeFn?`<button type="button" class="rc85-x" title="إزالة من الجمعية" onclick="${removeFn}">✕</button>`:''}`)}</div>`;
  const missing=t=>`<div class="dn-card rc85-miss">${e(t)}</div>`;

  R.page('org',{title:'الهيكل الإداري',roles:['admin','supervisor'],render:async()=>{
    let o;try{o=await loadOrg(false)}catch(err){return R.card(R.empty(err.message||'تعذر تحميل الهيكل الإداري'))}
    const owner=!!window.__rc85Owner,canEdit=owner||role()==='admin';
    if(!owner&&!K.assoc)K.assoc=(o.assocs[0]||{}).id||null;
    const a=o.assocs.find(x=>x.id===K.assoc);
    if(owner&&!a){
      return band('deep',`<div class="rc85-ht"><h2>إدارة النظام</h2><small>أنت: مسؤول النظام · تربط الجمعيات ومسؤوليها</small></div><div class="rc85-stats">${stat('جمعيات',o.assocs.length)}${stat('مسؤولو جمعيات',o.assocs.reduce((s,x)=>s+x.admins.length,0))}${stat('حلقات',o.assocs.reduce((s,x)=>s+x.halaqat,0))}${stat('طلاب',o.assocs.reduce((s,x)=>s+x.students,0))}</div>`)
        +`<div class="rc85-sec"><b>الجمعيات (${o.assocs.length})</b><button type="button" class="dn-btn tonal" onclick="RC50.k85.addAssoc()">إضافة جمعية</button></div>`
        +(o.assocs.length?o.assocs.map(x=>`<button type="button" class="rc85-assoc" onclick="RC50.k85.openAssoc('${x.id}')">${band('deep',`${x.logo_path&&isImg(x.logo_path)?`<img class="rc85-logo" src="${x.logo_path}" alt="">`:'<span class="rc85-logo">🕌</span>'}<div class="rc85-pt"><b>${e(x.name)}</b><small>${x.admins[0]?'المسؤول: '+e(x.admins[0].full_name):'لم يُعيَّن مسؤول بعد'}</small></div><span>‹</span>`)}<div class="rc85-stats light">${stat('مشرفون',x.sups.length)}${stat('مراكز',x.centers.length)}${stat('حلقات',x.halaqat)}${stat('محفّظون',x.teachers.length)}${stat('طلاب',x.students)}</div></button>`).join(''):missing('لا توجد جمعيات بعد. أضف أول جمعية ثم عيّن مسؤولها.'));
    }
    if(!a)return R.card(R.empty('لم تُربط بجمعية بعد.'));
    const hs=x=>[...a.centers.flatMap(c=>c.halaqat),...a.loose].filter(h=>(x.role==='teacher'?h.teachers:h.sups).some(p=>p.id===x.id)).map(h=>h.name);
    const halaqaRow=h=>`<div class="rc85-hrow"><span class="rc85-hn"><b>${e(h.name)}</b><small>${h.students} طالبًا · المحفّظ: ${h.teachers.length?e(h.teachers.map(t=>t.full_name).join('، ')):'<span style="color:#C62828">لم يُعيَّن</span>'}</small></span>${canEdit&&a.centers.length?`<button type="button" class="dn-link" onclick="RC50.k85.move('${h.id}')">نقل</button>`:''}${owner?`<button type="button" class="rc85-x dark" title="فصل عن الجمعية" onclick="RC50.k85.detach('${h.id}')">✕</button>`:''}</div>`;
    const center=c=>`<details class="rc85-center" ${K.open[c.id]?'open':''} ontoggle="RC50.k85.open['${c.id}']=this.open"><summary>${band(c.kind==='mosque'?'gold':'emerald',`<span class="rc85-logo">${c.logo_path&&isImg(c.logo_path)?`<img src="${c.logo_path}" alt="">`:'🏛'}</span><div class="rc85-pt"><b>${e(c.name)}</b><small>${c.kind==='mosque'?'مسجد':'مركز'} · ${countAr(c.halaqat.length,'حلقة','حلقة واحدة','حلقتان','حلقات')}</small></div>${canEdit?`<button type="button" class="rc85-x" title="حذف" onclick="event.preventDefault();RC50.k85.delCenter('${c.id}')">✕</button>`:''}`)}</summary><div class="rc85-cbody">${c.halaqat.map(halaqaRow).join('')||'<small class="dn-muted">لا توجد حلقات هنا بعد.</small>'}</div></details>`;
    return `${owner?`<button type="button" class="dn-link" onclick="RC50.k85.openAssoc(null)">‹ كل الجمعيات</button>`:''}`
      +band('deep',`<div class="rc85-ht"><h2>${e(a.name)}</h2><small>أنت: ${owner?'مسؤول النظام':(role()==='admin'?'مسؤول الجمعية':'مشرف الحلقات')}</small></div>${canEdit?`<button type="button" class="rc85-x" title="تعديل الاسم" onclick="RC50.k85.renameAssoc('${a.id}')">✎</button>`:''}<div class="rc85-stats">${stat('مشرفون',a.sups.length)}${stat('مراكز',a.centers.length)}${stat('حلقات',a.halaqat)}${stat('محفّظون',a.teachers.length)}${stat('طلاب',a.students)}</div>`)
      +sectionH(1,'مسؤول الجمعية','deep',owner?'تعيين':null,"RC50.k85.pick('admin')")
      +(a.admins.length?a.admins.map(p=>personCard(p,'deep','مسؤول الجمعية',[],owner?`RC50.k85.remove('${p.id}','admin')`:null)).join(''):missing('لم يُعيَّن مسؤول لهذه الجمعية بعد.'))
      +sectionH(2,'مشرفو الحلقات','gold',canEdit?'إضافة':null,"RC50.k85.pick('supervisor')")
      +(a.sups.length?a.sups.map(p=>personCard(p,'gold','مشرف',hs(p),canEdit?`RC50.k85.remove('${p.id}','supervisor')`:null)).join(''):missing('لا يوجد مشرفون في هذه الجمعية بعد.'))
      +sectionH(3,'المراكز والمساجد','emerald',canEdit&&!o.centersMissing?'إضافة':null,'RC50.k85.addCenter()')
      +(a.centers.map(center).join('')||missing('لا توجد مراكز أو مساجد بعد.'))
      +(a.loose.length?`<div class="dn-card"><b>حلقات غير مرتبطة بمركز</b>${a.loose.map(halaqaRow).join('')}</div>`:'')
      +(owner?`<button type="button" class="dn-btn tonal" style="width:100%;margin:6px 0" onclick="RC50.k85.pick('halaqa')">ربط حلقة بهذه الجمعية</button>`:'')
      +sectionH(4,'المحفّظون','teal',canEdit?'إضافة':null,"RC50.k85.pick('teacher')")
      +(a.teachers.length?a.teachers.map(p=>personCard(p,'teal','محفّظ',hs(p),canEdit?`RC50.k85.remove('${p.id}','teacher')`:null)).join(''):missing('لا يوجد محفّظون في هذه الجمعية بعد.'))
      +sectionH(5,'الطلاب','blue',null,'')
      +`<button type="button" class="rc85-assoc" onclick="go('students')">${band('blue',`<b style="font-size:34px">${a.students}</b><div class="rc85-pt"><b>طالب نشط</b><small>موزّعون على ${countAr(a.halaqat,'حلقة','حلقة واحدة','حلقتان','حلقات')}</small></div><span>‹</span>`)}</button>`;
  }});
  const reload=()=>{K.orgAt=0;render()};
  const ok=async(p,msg)=>{const r=await p;if(r&&r.error){R.toast(r.error.message||'تعذر تنفيذ العملية');return false}R.toast(msg);return true};
  K.openAssoc=id=>{K.assoc=id;render()};
  K.addAssoc=()=>{const n=(prompt('اسم الجمعية')||'').trim();if(n)ok(db.from('associations').insert({name:n}),'أُضيفت جمعية '+n).then(reload)};
  K.renameAssoc=id=>{const a=K.org.assocs.find(x=>x.id===id),n=(prompt('اسم الجمعية',a?a.name:'')||'').trim();if(n)ok(db.from('associations').update({name:n}).eq('id',id),'حُفظ الاسم').then(reload)};
  K.addCenter=()=>{
    R.sheet('rc85Center','إضافة مركز أو مسجد',`<label class="dn-field"><span>الاسم</span><input id="rc85CName" class="dn-in"></label><label class="dn-field"><span>النوع</span><select id="rc85CKind" class="dn-in"><option value="center">مركز</option><option value="mosque">مسجد</option></select></label>`,R.btn('حفظ','RC50.k85.saveCenter()'));
  };
  K.saveCenter=()=>{const n=(document.getElementById('rc85CName')?.value||'').trim(),k=document.getElementById('rc85CKind')?.value||'center';if(!n)return;R.closeSheet('rc85Center');ok(db.from('centers').insert({name:n,kind:k,active:true,association_id:K.assoc}),'أُضيف '+n).then(reload)};
  K.delCenter=id=>{if(confirm('حذف المركز؟ تبقى الحلقات وتصير «غير مرتبطة بمركز». لا يُحذف أي طالب أو حلقة.'))ok(db.from('centers').delete().eq('id',id),'حُذف المركز').then(reload)};
  K.move=hid=>{
    const a=K.org.assocs.find(x=>x.id===K.assoc);if(!a)return;
    R.sheet('rc85Move','نقل الحلقة',`<label class="dn-field"><span>إلى</span><select id="rc85MoveTo" class="dn-in"><option value="">بلا مركز</option>${a.centers.map(c=>`<option value="${c.id}">${e(c.name)}</option>`).join('')}</select></label>`,R.btn('نقل',`RC50.k85.moveGo('${hid}')`));
  };
  K.moveGo=hid=>{const v=document.getElementById('rc85MoveTo')?.value||null;R.closeSheet('rc85Move');ok(db.from('halaqas').update({center_id:v||null}).eq('id',hid),'نُقلت الحلقة').then(reload)};
  K.pick=kind=>{
    const aid=K.assoc,o=K.org;
    const list=kind==='halaqa'?o.halaqas.filter(h=>h.association_id!==aid).map(h=>[h.id,h.name+(h.association_id?' (تتبع جمعية أخرى)':'')])
      :o.people.filter(p=>!p.is_platform_owner&&p.role===kind&&p.association_id!==aid).map(p=>[p.id,p.full_name+(p.association_id?' (في جمعية أخرى)':'')]);
    const title={halaqa:'ربط حلقة',admin:'تعيين مسؤول الجمعية',supervisor:'إضافة مشرف',teacher:'إضافة محفّظ'}[kind];
    const hint={halaqa:'',admin:'الحساب يجب أن يكون من نوع «مسؤول جمعية» (من شاشة الحسابات والصلاحيات).',supervisor:'الحساب يجب أن يكون معتمدًا كمشرف.',teacher:'الحساب يجب أن يكون معتمدًا كمحفّظ.'}[kind];
    R.sheet('rc85Pick',title,list.length?`<label class="dn-field"><span>اختر</span><select id="rc85PickSel" class="dn-in">${list.map(([v,l])=>`<option value="${v}">${e(l)}</option>`).join('')}</select></label><small class="dn-muted">${e(hint)}</small>`:`<p class="dn-muted">لا توجد خيارات متاحة. ${e(hint)}</p>`,list.length?R.btn('حفظ',`RC50.k85.pickGo('${kind}')`):'');
  };
  K.pickGo=async kind=>{
    const v=document.getElementById('rc85PickSel')?.value,aid=K.assoc;R.closeSheet('rc85Pick');if(!v)return;
    if(kind==='halaqa'){if(await ok(db.from('halaqas').update({association_id:aid,center_id:null}).eq('id',v),'رُبطت الحلقة بالجمعية'))await db.from('students').update({association_id:aid}).eq('halaqa_id',v)}
    else await ok(db.from('profiles').update({association_id:aid}).eq('id',v),'تم الربط بالجمعية');
    reload();
  };
  K.remove=async(pid,kind)=>{
    const p=K.org.people.find(x=>x.id===pid),a=K.org.assocs.find(x=>x.id===K.assoc);if(!p||!a)return;
    const rn={admin:'مسؤول الجمعية',supervisor:'المشرف',teacher:'المحفّظ'}[kind];
    if(!confirm(`إزالة ${p.full_name} من «${a.name}»؟\nيُفصل ${rn}${kind!=='admin'?' ويُرفع عن حلقاتها':''}. يبقى حسابه وبياناته كما هي، ويمكن إعادة إضافته لاحقًا.`))return;
    const ids=[...a.centers.flatMap(c=>c.halaqat),...a.loose].map(h=>h.id);
    if(kind==='teacher'&&ids.length)await db.from('halaqa_teachers').delete().eq('teacher_id',pid).in('halaqa_id',ids);
    if(kind==='supervisor'&&ids.length)await db.from('halaqa_supervisors').delete().eq('supervisor_id',pid).in('halaqa_id',ids);
    await ok(db.from('profiles').update({association_id:null}).eq('id',pid),'أُزيل '+p.full_name+' من الجمعية');reload();
  };
  K.detach=async hid=>{
    const h=K.org.halaqas.find(x=>x.id===hid);if(!h||!confirm(`فصل ${h.name} عن الجمعية؟\nتصير الحلقة حلقة مستقلة: يراها مسؤول النظام فقط، إضافةً إلى من أُسند إليها مباشرة من مشرفين ومحفّظين. يبقى طلابها ومحفّظوها ومشرفوها كما هم، ولا يُحذف أي طالب أو تسميع. يمكنك ربطها بجمعية في أي وقت.`))return;
    if(await ok(db.from('halaqas').update({association_id:null,center_id:null}).eq('id',hid),'فُصلت '+h.name))await db.from('students').update({association_id:null}).eq('halaqa_id',hid);
    reload();
  };

  // ---------------- association team: compact rows with photos, tap for details ----------------
  R.page('team',{title:'فريق الجمعية',roles:['admin','supervisor'],render:async()=>{
    const [p,h,l,st]=await Promise.all([
      db.from('profiles').select('id,full_name,role,phone,active,avatar_path').in('role',['teacher','supervisor']).order('full_name').limit(500),
      db.from('halaqas').select('id,name').limit(300),db.from('halaqa_teachers').select('halaqa_id,teacher_id').limit(1500),
      db.from('students').select('id,halaqa_id,status').eq('status','active').limit(5000)]);
    if(p.error)return R.card(R.empty(p.error.message));
    const hn=Object.fromEntries((h.data||[]).map(x=>[x.id,x.name])),links=l.data||[],per={};(st.data||[]).forEach(s=>{per[s.halaqa_id]=(per[s.halaqa_id]||0)+1});
    const row=m=>{
      const mine=links.filter(k=>k.teacher_id===m.id),hs=mine.map(k=>hn[k.halaqa_id]).filter(Boolean),stu=mine.reduce((s,k)=>s+(per[k.halaqa_id]||0),0);
      const g=m.active===false?'slate':m.role==='supervisor'?'gold':'emerald',rl=m.active===false?'مجمَّد':m.role==='supervisor'?'مشرف':'محفّظ';
      const sum=m.role==='supervisor'?countAr(hs.length,'حلقة','حلقة واحدة','حلقتان','حلقات'):`${countAr(hs.length,'حلقة','حلقة واحدة','حلقتان','حلقات')} · ${stu} طالبًا`;
      return `<details class="rc85-team"><summary>${band(g,`${R.avatar(m.avatar_path,m.full_name,46)}<div class="rc85-pt"><b>${e(m.full_name)}</b><small>${rl} · ${sum}</small></div><span class="rc85-chev">⌄</span>`)}</summary><div class="rc85-cbody">${hs.length?`<div class="rc85-chips">${hs.map(x=>`<span>${e(x)}</span>`).join('')}</div>`:(m.role!=='supervisor'?'<b style="color:#C62828">لم يُسنَد إلى حلقة بعد</b>':'')}${m.phone?`<a class="dn-btn tonal" style="display:block;text-align:center;margin-top:8px" href="tel:${e(m.phone)}">📞 ${e(m.phone)}</a>`:''}</div></details>`;
    };
    const all=p.data||[],sup=all.filter(m=>m.role==='supervisor'),tch=all.filter(m=>m.role==='teacher');
    const hideSup=role()==='supervisor';/* RC86: supervisors are independent of each other */
    return `${hideSup?'':`<h3>المشرفون (${sup.length})</h3>${sup.map(row).join('')||R.empty('لا يوجد مشرفون')}`}<h3>المحفّظون (${tch.length})</h3>${tch.map(row).join('')||R.empty('لا يوجد محفّظون')}`;
  }});

  // ---------------- navigation: structure page next to the team ----------------
  const prevNav=window.navItems;
  window.navItems=function(){
    const items=prevNav.apply(this,arguments),r=role();
    if(['admin','supervisor'].includes(r)&&!items.some(x=>x[0]==='org')){
      const i=items.findIndex(x=>x[0]==='team');items.splice(i<0?items.length:i,0,['org','الهيكل الإداري']);
    }
    return items;
  };
})();
