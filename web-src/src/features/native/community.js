/* RC27.40 native screens: community — web twin of CommunityNativeScreen, NotificationsNativeScreen,
   NotificationPreferencesDialog, GuardianCompetitionNativeScreen, GuardianAchievementsNativeScreen and
   GuardianProfileNativeScreen (ManagementScreens.kt / GuardianParityScreens.kt). See docs/NATIVE_PORT_BRIEF.md.
   Data layer = the existing web state + the same tables / RPCs the Android repository calls. */
(function(){
  'use strict';
  if(typeof NX==='undefined'||typeof state==='undefined')return;
  const h=NX.h,ic=NX.icon;
  const isDk=()=>document.documentElement.getAttribute('data-view')==='desktop';
  const online=()=>navigator.onLine!==false;
  const $id=i=>document.getElementById(i);
  const fd=v=>{try{return new Date(v).toLocaleDateString('ar-EG-u-nu-latn')}catch(_e){return ''}};
  const ft=v=>{try{const d=new Date(v);const p=n=>String(n).padStart(2,'0');return `\u2066${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}\u2069`}catch(_e){return String(v||'').slice(0,16).replace('T',' ')}};
  const num=v=>{const r=Math.round(Number(v||0)*100)/100;return String(r)};
  const call=(n,...a)=>{try{return typeof window[n]==='function'?window[n](...a):undefined}catch(e){console.warn(e)}};
  const guard=fn=>function(){try{return fn.apply(this,arguments)}catch(e){console.error('community page',e);return NX.notice('تعذر عرض هذه الشاشة','error')}};
  const NCM=window.NCM={};
  const CAT={daily:'يومي',monthly:'شهري',schedule:'جدول',urgent:'عاجل',achievement:'إنجاز',general:'عام'};
  const AUD={all:'الكل',teachers:'المحفّظين',guardians:'أولياء الأمور',students:'الطلاب'};
  const PRI={urgent:'عاجل',important:'مهم',normal:'عادي'};
  const PTYPE={question:'استفسار',achievement:'إنجاز',notice:'ملاحظة',discussion:'نقاش'};
  const catAr=v=>CAT[v]||'عام',audAr=v=>AUD[v]||'الكل',priAr=v=>PRI[v]||'عادي',ptAr=v=>PTYPE[v]||'نقاش';
  const canManage=()=>typeof roleCanManage==='function'&&roleCanManage();
  const canAdmin=()=>typeof roleCanAdmin==='function'&&roleCanAdmin();
  const label=t=>`<div class="nc-lbl">${t}</div>`;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  /* ------------------------------------------------------------------ shared: segmented button row */
  const seg=(items,cur,fn)=>`<div class="nc-seg" role="tablist">${items.map(([v,t])=>`<button type="button" role="tab" aria-selected="${v===cur}" class="${v===cur?'on':''}" onclick="${fn}('${v}')">${v===cur?ic('Check',18):''}<span>${t}</span></button>`).join('')}</div>`;
  const chipGroup=(key,items,cur,fn)=>`<div class="nx-chips wrap nc-grid" data-k="${key}">${items.map(([v,t])=>NX.chip(t,{selected:v===cur,check:false,onclick:`${fn}('${key}','${v}',this)`})).join('')}</div>`;
  function confirmDelete(title,msg,onOk){
    window.__ncOk=()=>{NX.closeDialog('ncConfirm');try{onOk()}catch(e){console.error(e)}};
    NX.dialog('ncConfirm',title,`<div class="nc-cdel"><span class="nc-cdel-ic">${ic('DeleteForever',30)}</span><p class="nx-confirm-text">${msg}</p></div>`,{cls:'nx-small-dlg nc-confirm',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ncConfirm')"})}${NX.btn('حذف',{kind:'danger',cls:'nc-del-btn',onclick:'__ncOk()'})}`});
  }

  /* ================================================================== COMMUNITY */
  const C={loadedAt:0,loading:false,error:'',showAll:new Set(),forumType:'all'};
  state.communityTab=state.communityTab||'announcements';
  state.announcementFilter=state.announcementFilter||'all';

  function sortedAnn(){return [...(state.announcements||[])].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||String(b.publish_at||b.created_at||'').localeCompare(String(a.publish_at||a.created_at||'')))}
  function sortedPosts(){return [...(state.forum||[])].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||String(b.created_at||'').localeCompare(String(a.created_at||'')))}
  const halaqaName=id=>id?((state.halaqas||[]).find(x=>x.id===id)?.name||'حلقة'):'كل الحلقات';
  const isExpired=a=>a.expires_at&&new Date(a.expires_at).getTime()<Date.now();

  async function refreshCommunity(force){
    if(!online()||!state.user?.id||state.demo||C.loading)return;
    if(!force&&Date.now()-C.loadedAt<20000)return;
    C.loading=true;C.loadedAt=Date.now();
    try{
      const [a,p,c]=await Promise.all([
        db.from('announcements').select('*').order('pinned',{ascending:false}).order('publish_at',{ascending:false}).limit(200),
        db.from('forum_posts').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(200),
        db.from('forum_comments').select('*').order('created_at',{ascending:true}).limit(1000)]);
      const err=a.error||p.error||c.error;if(err)throw err;
      const sig=x=>JSON.stringify((x||[]).map(r=>[r.id,r.updated_at,r.pinned,r.title,r.body]));
      const changed=sig(a.data)!==sig(state.announcements)||sig(p.data)!==sig(state.forum)||sig(c.data)!==sig(state.comments);
      state.announcements=a.data||[];state.forum=p.data||[];state.comments=c.data||[];C.error='';
      if(changed&&state.page==='community')render();
    }catch(e){C.error=e?.message||'تعذر تحميل المجتمع'}
    finally{C.loading=false;if(state.page==='community'&&C.error)render()}
  }
  NCM.refresh=async function(){await refreshCommunity(true)};

  function annCard(a){
    const mg=canManage(),exp=isExpired(a);
    const pills=[`<span class="nc-cat">${catAr(a.category)}</span>`];
    if(a.priority==='urgent')pills.push(NX.pill('عاجل','danger'));else if(a.priority==='important')pills.push(NX.pill('مهم','warning'));
    if(exp)pills.push(NX.pill('منتهي','neutral'));
    return `<article class="nx-card nx-emph nc-ann ${a.pinned?'pinned':''} ${exp?'expired':''}" data-id="${h(a.id)}">
      <div class="nc-head"><span class="nc-ic">${ic(a.pinned?'PushPin':'Campaign',24)}</span><b class="nc-title">${h(a.title||'إعلان')}</b>${pills.join('')}
      ${mg?`<span class="nc-acts">${NX.iconBtn('Edit',{title:'تعديل الإعلان',onclick:`NCM.openAnn('${a.id}')`})}${NX.iconBtn('DeleteOutline',{title:'حذف الإعلان',cls:'nc-danger',onclick:`NCM.delAnn('${a.id}')`})}</span>`:''}</div>
      <p class="nc-body">${h(a.body||'')}</p>
      <div class="nc-meta"><span>الجمهور: ${audAr(a.audience)} · الأولوية: ${priAr(a.priority)}</span><span class="nc-meta2">${ic('Event',14)}${fd(a.publish_at||a.created_at)}${a.expires_at?` · ينتهي ${fd(a.expires_at)}`:''}${a.halaqa_id?` · ${h(halaqaName(a.halaqa_id))}`:' · كل الحلقات'}</span></div></article>`;
  }
  function postCard(p){
    const cs=(state.comments||[]).filter(c=>c.post_id===p.id),own=p.author_id===state.user?.id,edit=own||canAdmin()||state.demo;
    const open=C.showAll.has(p.id),shown=open?cs:cs.slice(0,3);
    const cm=c=>{const ce=c.author_id===state.user?.id||canAdmin()||state.demo;return `<div class="nc-comment"><div class="nc-cbody"><b>${h(c.author_name||(c.author_id===state.user?.id?'أنت':'عضو'))}<small>${fd(c.created_at)}${c.updated_at&&c.updated_at!==c.created_at?' · تم التعديل':''}</small></b><p>${h(c.body||'')}</p></div>${ce?`<span class="nc-acts">${c.author_id===state.user?.id?NX.iconBtn('Edit',{title:'تعديل التعليق',onclick:`NCM.openComment('${p.post_id||p.id}','${c.id}')`}):''}${NX.iconBtn('DeleteOutline',{title:'حذف التعليق',cls:'nc-danger',onclick:`NCM.delComment('${c.id}')`})}</span>`:''}</div>`};
    return `<article class="nx-card nx-emph nc-post ${p.pinned?'pinned':''}" data-id="${h(p.id)}">
      <div class="nc-head"><span class="nc-ic">${ic(p.pinned?'PushPin':'Forum',24)}</span><div class="nc-grow"><b class="nc-title">${h(p.title||'منشور')}</b><small class="nc-sub">${h(p.author_name||'عضو الحلقة')} · ${fd(p.created_at)}${p.updated_at&&p.updated_at!==p.created_at?' · تم التعديل':''}</small></div><span class="nc-cat">${ptAr(p.post_type)}</span>
      ${edit?`<span class="nc-acts">${NX.iconBtn('Edit',{title:'تعديل المنشور',onclick:`NCM.openPost('${p.id}')`})}${NX.iconBtn('DeleteOutline',{title:'حذف المنشور',cls:'nc-danger',onclick:`NCM.delPost('${p.id}')`})}</span>`:''}</div>
      <p class="nc-body">${h(p.body||'')}</p><hr class="nx-divider">
      <div class="nc-ccount">${ic('Forum',16)}${cs.length} تعليق</div>
      ${shown.map(cm).join('')}
      ${cs.length>3?`<button type="button" class="nx-btn nx-text nx-small nc-more" onclick="NCM.toggleAll('${p.id}')">${open?'عرض أقل':`عرض كل التعليقات (${cs.length})`}</button>`:''}
      ${p.comments_enabled!==false?`<div class="nc-addc">${NX.btn('إضافة تعليق',{kind:'text',icon:'AddComment',onclick:`NCM.openComment('${p.id}')`})}</div>`:`<div class="nc-closed">${ic('Info',16)}التعليقات مغلقة لهذا المنشور</div>`}</article>`;
  }

  const communityHtml=guard(function(){
    const tab=state.communityTab==='forum'?'forum':'announcements',mg=canManage();
    setTimeout(()=>refreshCommunity(false),30);
    const anns=sortedAnn(),posts=sortedPosts(),cur=state.announcementFilter||'all';
    const cats=['all','general','daily','monthly','schedule','achievement','urgent'];
    const cnt=k=>k==='all'?anns.length:anns.filter(a=>(a.category||'general')===k).length;
    const fa=cur==='all'?anns:anns.filter(a=>(a.category||'general')===cur);
    const types=['all','discussion','question','achievement','notice'],ft_=C.forumType;
    const fp=ft_==='all'?posts:posts.filter(p=>(p.post_type||'discussion')===ft_);
    const addBtn=tab==='announcements'
      ?(mg?NX.btn('إعلان',{icon:'Campaign',onclick:'NCM.openAnn()',cls:'nc-add'}):'')
      :NX.btn(mg?'منشور':'استفسار',{icon:'AddComment',onclick:'NCM.openPost()',cls:'nc-add'});
    const filters=tab==='announcements'
      ?NX.chips(cats.map(k=>({label:k==='all'?'الكل':catAr(k),selected:cur===k,check:k===cur,onclick:`setAnnouncementFilter('${k}')`})))
      :NX.chips(types.map(k=>({label:k==='all'?'الكل':ptAr(k),selected:ft_===k,check:k===ft_,onclick:`NCM.forumType('${k}')`})));
    const sideList=tab==='announcements'
      ?cats.map(k=>`<button type="button" class="nc-side-item ${cur===k?'on':''}" onclick="setAnnouncementFilter('${k}')"><span>${k==='all'?'كل الإعلانات':catAr(k)}</span><b>${cnt(k)}</b></button>`).join('')
      :types.map(k=>{const n=k==='all'?posts.length:posts.filter(p=>(p.post_type||'discussion')===k).length;return `<button type="button" class="nc-side-item ${ft_===k?'on':''}" onclick="NCM.forumType('${k}')"><span>${k==='all'?'كل المنشورات':ptAr(k)}</span><b>${n}</b></button>`}).join('');
    const loading=C.loading&&!anns.length&&!posts.length;
    const list=tab==='announcements'
      ?(loading?NX.skeleton(3):fa.length?fa.map(annCard).join(''):NX.empty('لا توجد إعلانات',{icon:'Campaign'}))
      :(loading?NX.skeleton(3):fp.length?fp.map(postCard).join(''):NX.empty('لا توجد منشورات',{icon:'Forum'}));
    const pinned=(tab==='announcements'?anns:posts).filter(x=>x.pinned).length;
    return `<div class="nc-root nc-community">
      ${seg([['announcements','الإعلانات'],['forum','المنتدى']],tab,'setCommunityTab')}
      ${!online()?NX.notice('وضع عدم الاتصال · تُعرض آخر بيانات محفوظة، ولا يمكن النشر أو التعديل قبل عودة الاتصال.','warning'):''}
      ${C.error?NX.notice(h(C.error),'error'):''}
      <div class="nc-split"><div class="nc-main">
        ${addBtn?`<div class="nc-actions nc-phone-only">${addBtn}</div>`:''}
        <div class="nc-filters nc-phone-only">${filters}</div>
        <div class="nc-list">${list}</div></div>
        <aside class="nc-aside nc-dk-only">
          ${addBtn?`<div class="nc-side-cta">${addBtn.replace('nc-add','nc-add nx-full')}</div>`:''}
          <div class="nx-card nc-side-card"><h4>${tab==='announcements'?'التصنيف':'نوع المنشور'}</h4>${sideList}</div>
          <div class="nx-card nc-side-card nc-stats"><div><b>${(tab==='announcements'?anns:posts).length}</b><span>${tab==='announcements'?'إعلان':'منشور'}</span></div><div><b>${pinned}</b><span>مثبّت</span></div>${tab==='forum'?`<div><b>${(state.comments||[]).length}</b><span>تعليق</span></div>`:`<div><b>${anns.filter(isExpired).length}</b><span>منتهي</span></div>`}</div>
        </aside></div></div>`;
  });
  NCM.forumType=t=>{C.forumType=t;render()};
  NCM.toggleAll=id=>{C.showAll.has(id)?C.showAll.delete(id):C.showAll.add(id);render()};

  /* ---- announcement dialog ---- */
  let AN=null;
  NCM.pick=function(key,val,btn){
    if(AN&&key in AN)AN[key]=val;
    const g=btn?.parentElement;if(g)[...g.children].forEach(b=>{b.classList.toggle('on',b===btn);b.setAttribute('aria-pressed',b===btn?'true':'false')});
  };
  NCM.annValid=function(){const t=($id('ncAnTitle')?.value||'').trim().length>=2,b=($id('ncAnBody')?.value||'').trim().length>=2,btn=$id('ncAnSave');if(btn)btn.disabled=!(t&&b)||AN?.saving};
  NCM.openAnn=function(id){
    const cur=id&&typeof id==='string'?(state.announcements||[]).find(x=>x.id===id):null;
    AN={id:cur?.id||'',audience:cur?.audience||'all',priority:cur?.priority||'normal',category:cur?.category||'general',pinned:!!cur?.pinned,saving:false};
    const opts=[{value:'',label:'كل الحلقات'},...(state.halaqas||[]).filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||'حلقة'}))];
    const exp=cur?.expires_at?String(cur.expires_at).slice(0,10):'';
    const body=`${NX.select('الحلقة',opts,{id:'ncAnHalaqa',value:cur?.halaqa_id||''})}
      ${NX.field('العنوان',{id:'ncAnTitle',value:cur?.title||'',oninput:'NCM.annValid()'})}
      ${NX.field('نص الإعلان',{html:`<textarea id="ncAnBody" rows="5" oninput="NCM.annValid()">${h(cur?.body||'')}</textarea>`})}
      ${label('الجمهور')}${chipGroup('audience',['all','guardians','teachers','students'].map(v=>[v,audAr(v)]),AN.audience,'NCM.pick')}
      ${label('الأولوية')}${chipGroup('priority',['normal','important','urgent'].map(v=>[v,priAr(v)]),AN.priority,'NCM.pick')}
      ${label('التصنيف')}${chipGroup('category',['general','daily','monthly','schedule','achievement','urgent'].map(v=>[v,catAr(v)]),AN.category,'NCM.pick')}
      ${NX.field('انتهاء الإعلان (اختياري)',{id:'ncAnExp',type:'date',value:exp})}
      ${NX.switchRow('تثبيت الإعلان',AN.pinned,'AN_PIN(this.checked)',{id:'ncAnPin'})}
      <div class="nc-err" id="ncAnErr" role="alert"></div>`;
    window.AN_PIN=v=>{if(AN)AN.pinned=!!v};
    NX.dialog('ncAnnDlg',cur?'تعديل الإعلان':'إعلان جديد',body,{cls:'nc-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ncAnnDlg')"})}${NX.btn(cur?'حفظ':'نشر',{id:'ncAnSave',onclick:'NCM.saveAnn()'})}`});
    NCM.annValid();
  };
  NCM.saveAnn=async function(){
    if(!AN||AN.saving)return;
    const err=m=>{const e=$id('ncAnErr');if(e)e.textContent=m||''},btn=$id('ncAnSave');
    const title=($id('ncAnTitle').value||'').trim(),body=($id('ncAnBody').value||'').trim(),expv=$id('ncAnExp').value;
    if(title.length<2||body.length<2)return;
    if(!online()&&!state.demo)return err('النشر والتعديل يحتاجان اتصالاً بالإنترنت');
    const obj={title,body,category:AN.category,halaqa_id:$id('ncAnHalaqa').value||null,audience:AN.audience,priority:AN.priority,pinned:!!AN.pinned,expires_at:expv?new Date(expv+'T23:59:59').toISOString():null};
    AN.saving=true;err('');if(btn){btn.disabled=true;btn.querySelector('span').textContent='جاري النشر'}
    try{
      let published=null;
      if(state.demo){
        if(AN.id)Object.assign(state.announcements.find(x=>x.id===AN.id)||{},obj);
        else{obj.id='a'+Date.now();obj.publish_at=new Date().toISOString();state.announcements.unshift(obj);published=obj}
      }else if(AN.id){
        const {data,error}=await db.from('announcements').update(obj).eq('id',AN.id).select().single();if(error)throw error;
        const i=state.announcements.findIndex(x=>x.id===AN.id);if(i>=0)state.announcements[i]=data;
      }else{
        obj.created_by=state.user.id;obj.publish_at=new Date().toISOString();
        const {data,error}=await db.from('announcements').insert(obj).select().single();if(error)throw error;
        state.announcements.unshift(data);published=data;
      }
      const edited=!!AN.id;AN=null;NX.closeDialog('ncAnnDlg');toast(edited?'تم حفظ الإعلان':'تم نشر الإعلان');render();
      if(published&&typeof emitAnnouncementNotification==='function'&&typeof canSendNotifications==='function'&&canSendNotifications())
        emitAnnouncementNotification(published).then(r=>{if(r?.recipients)toast(`تم إرسال إشعار الإعلان إلى ${r.recipients} مستلم`)}).catch(()=>{});
    }catch(e){AN.saving=false;err(e?.message||'تعذر نشر الإعلان');if(btn){btn.querySelector('span').textContent=AN.id?'حفظ':'نشر'}NCM.annValid()}
  };
  NCM.delAnn=function(id){
    const a=(state.announcements||[]).find(x=>x.id===id);if(!a||!canManage())return;
    confirmDelete('حذف الإعلان',`سيتم حذف الإعلان «${h(a.title||'')}» نهائيًا.`,async()=>{
      if(!state.demo){const {error}=await db.from('announcements').delete().eq('id',id);if(error)return toast(error.message)}
      state.announcements=state.announcements.filter(x=>x.id!==id);toast('تمت إزالة الإعلان');render();
    });
  };

  /* ---- forum post dialog ---- */
  let FP=null;
  NCM.fpValid=function(){const t=($id('ncFpTitle')?.value||'').trim().length>=2,b=($id('ncFpBody')?.value||'').trim().length>=2,hl=!!$id('ncFpHalaqa')?.value,btn=$id('ncFpSave');if(btn)btn.disabled=!(t&&b&&hl)||FP?.saving};
  NCM.openPost=function(id){
    const cur=id&&typeof id==='string'?(state.forum||[]).find(x=>x.id===id):null,mg=canManage();
    FP={id:cur?.id||'',type:cur?.post_type||(mg?'discussion':'question'),comments:cur?cur.comments_enabled!==false:true,pinned:!!cur?.pinned,saving:false};
    const hs=(state.halaqas||[]).filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||'حلقة'}));
    const hv=cur?.halaqa_id||hs[0]?.value||'';
    window.FP_SET=(k,v)=>{if(FP)FP[k]=!!v};
    const body=`${NX.select('الحلقة',hs,{id:'ncFpHalaqa',value:hv,onchange:'NCM.fpValid()'})}
      ${mg?label('نوع المنشور')+chipGroup('type',['discussion','question','achievement','notice'].map(v=>[v,ptAr(v)]),FP.type,'NCM.pickPost'):''}
      ${NX.field('العنوان',{id:'ncFpTitle',value:cur?.title||'',oninput:'NCM.fpValid()'})}
      ${NX.field('المحتوى',{html:`<textarea id="ncFpBody" rows="5" oninput="NCM.fpValid()">${h(cur?.body||'')}</textarea>`})}
      ${NX.switchRow('السماح بالتعليقات',FP.comments,"FP_SET('comments',this.checked)")}
      ${mg?NX.switchRow('تثبيت المنشور',FP.pinned,"FP_SET('pinned',this.checked)"):''}
      <div class="nc-err" id="ncFpErr" role="alert"></div>`;
    NX.dialog('ncPostDlg',cur?'تعديل المنشور':mg?'منشور جديد':'استفسار جديد',body,{cls:'nc-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ncPostDlg')"})}${NX.btn(cur?'حفظ':'نشر',{id:'ncFpSave',onclick:'NCM.savePost()'})}`});
    NCM.fpValid();
  };
  NCM.pickPost=function(key,val,btn){if(FP)FP.type=val;const g=btn?.parentElement;if(g)[...g.children].forEach(b=>{b.classList.toggle('on',b===btn);b.setAttribute('aria-pressed',b===btn?'true':'false')})};
  NCM.savePost=async function(){
    if(!FP||FP.saving)return;
    const err=m=>{const e=$id('ncFpErr');if(e)e.textContent=m||''},btn=$id('ncFpSave'),mg=canManage();
    const title=$id('ncFpTitle').value.trim(),body=$id('ncFpBody').value.trim(),hid=$id('ncFpHalaqa').value;
    if(title.length<2||body.length<2||!hid)return;
    if(!online()&&!state.demo)return err('النشر والتعديل يحتاجان اتصالاً بالإنترنت');
    const base={post_type:FP.type,title,body,comments_enabled:FP.comments,pinned:FP.pinned&&mg};
    FP.saving=true;err('');if(btn)btn.disabled=true;
    try{
      const editing=!!FP.id;
      if(state.demo){
        if(editing)Object.assign(state.forum.find(x=>x.id===FP.id)||{},base,{halaqa_id:hid,updated_at:new Date().toISOString()});
        else state.forum.unshift({...base,halaqa_id:hid,id:'f'+Date.now(),author_id:state.user.id,author_name:state.profile.full_name,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      }else if(editing){
        const {data,error}=await db.from('forum_posts').update({...base,halaqa_id:hid,updated_at:new Date().toISOString()}).eq('id',FP.id).select().single();if(error)throw error;
        const i=state.forum.findIndex(x=>x.id===FP.id);if(i>=0)state.forum[i]=data;
      }else{
        const {data,error}=await db.from('forum_posts').insert({...base,halaqa_id:hid,author_id:state.user.id,author_name:state.profile?.full_name}).select().single();if(error)throw error;
        state.forum.unshift(data);
      }
      FP=null;NX.closeDialog('ncPostDlg');toast(editing?'تم تعديل المنشور':'تم نشر المنشور');render();
    }catch(e){FP.saving=false;err(e?.message||'تعذر حفظ المنشور');NCM.fpValid()}
  };
  NCM.delPost=function(id){
    const p=(state.forum||[]).find(x=>x.id===id);if(!p)return;
    confirmDelete('حذف المنشور','سيتم حذف المنشور وتعليقاته المرتبطة وفق سياسات قاعدة البيانات.',async()=>{
      if(!state.demo){
        const c=await db.from('forum_comments').delete().eq('post_id',id);if(c.error)return toast(c.error.message);
        const r=await db.from('forum_posts').delete().eq('id',id);if(r.error)return toast(r.error.message);
      }
      state.forum=state.forum.filter(x=>x.id!==id);state.comments=(state.comments||[]).filter(x=>x.post_id!==id);toast('تم حذف المنشور');render();
    });
  };

  /* ---- comment dialog (add / edit own) ---- */
  let CM=null;
  NCM.openComment=function(postId,commentId){
    const cur=commentId?(state.comments||[]).find(x=>x.id===commentId):null;CM={postId,id:cur?.id||''};
    NX.dialog('ncCommentDlg',cur?'تعديل التعليق':'إضافة تعليق',NX.field('التعليق',{html:`<textarea id="ncCmBody" rows="4" oninput="document.getElementById('ncCmSave').disabled=!this.value.trim()">${h(cur?.body||'')}</textarea>`})+'<div class="nc-err" id="ncCmErr" role="alert"></div>',{cls:'nc-dlg nx-small-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ncCommentDlg')"})}${NX.btn('إرسال',{id:'ncCmSave',disabled:!cur,onclick:'NCM.saveComment()'})}`});
    setTimeout(()=>$id('ncCmBody')?.focus(),50);
  };
  NCM.saveComment=async function(){
    if(!CM)return;const body=$id('ncCmBody').value.trim(),err=m=>{const e=$id('ncCmErr');if(e)e.textContent=m||''};if(!body)return;
    if(!online()&&!state.demo)return err('التعليق يحتاج اتصالاً بالإنترنت');
    const btn=$id('ncCmSave');if(btn)btn.disabled=true;
    try{
      if(CM.id){
        if(state.demo){const c=state.comments.find(x=>x.id===CM.id);c.body=body;c.updated_at=new Date().toISOString()}
        else{const {data,error}=await db.from('forum_comments').update({body}).eq('id',CM.id).select().single();if(error)throw error;const i=state.comments.findIndex(x=>x.id===CM.id);if(i>=0)state.comments[i]=data}
        toast('تم تعديل التعليق');
      }else if(state.demo){state.comments.push({id:'c'+Date.now(),post_id:CM.postId,author_id:state.user.id,author_name:state.profile.full_name,body,created_at:new Date().toISOString(),updated_at:new Date().toISOString()})}
      else{const {data,error}=await db.from('forum_comments').insert({post_id:CM.postId,author_id:state.user.id,author_name:state.profile?.full_name,body}).select().single();if(error)throw error;state.comments.push(data)}
      C.showAll.add(CM.postId);CM=null;NX.closeDialog('ncCommentDlg');render();
    }catch(e){err(e?.message||'تعذر إرسال التعليق');if(btn)btn.disabled=false}
  };
  NCM.delComment=function(id){
    confirmDelete('حذف التعليق','هل تريد حذف هذا التعليق؟',async()=>{
      if(!state.demo){const {error}=await db.from('forum_comments').delete().eq('id',id);if(error)return toast(error.message)}
      state.comments=state.comments.filter(x=>x.id!==id);render();
    });
  };

  /* legacy entry points (FAB, shortcuts) now open the native dialogs */
  window.openAnnouncement=function(id){NCM.openAnn(id)};
  window.openForum=function(id,forceType){NCM.openPost(typeof id==='string'?id:undefined)};
  window.editForumComment=function(id){const c=(state.comments||[]).find(x=>x.id===id);if(c)NCM.openComment(c.post_id,id)};
  window.deleteAnnouncement=NCM.delAnn;window.deleteForumPost=NCM.delPost;window.deleteForumComment=NCM.delComment;

  /* ================================================================== NOTIFICATIONS */
  const NF={q:'',kind:'all',unreadOnly:false,archived:false,open:new Set(),sel:null,panel:'detail',last:0,busy:false};
  const KIND={attendance:'الحضور',recitation:'التسميع',behavior:'السلوك',announcement:'إعلان',achievement:'إنجاز',manual:'إشعار',system:'النظام'};
  const KICON={attendance:'HowToReg',recitation:'MenuBook',behavior:'Psychology',announcement:'Campaign',achievement:'EmojiEvents',system:'Settings'};
  const kindAr=k=>KIND[k]||'إشعار',kindIc=k=>KICON[k]||'Notifications';
  const unread=n=>!n.read_at;
  const groupTitle=n=>String(n.title||'إشعار').split(' · ')[0].trim()||'إشعار';
  const subject=n=>{const t=String(n.title||'');const i=t.indexOf(' · ');return i<0?'':t.slice(i+3).trim()};
  const legacyTest=n=>String(n.body||'').includes('اختبار مرحلي')||String(n.title||'').includes('اختبار مرحلي');
  const archivedN=(n,cut)=>!unread(n)&&new Date(n.created_at).getTime()<cut;
  const stName=n=>(state.students||[]).find(x=>x.id===n.student_id)?.full_name||'';

  function nView(){
    const rows=state.notifications||[],legacy=rows.filter(legacyTest),live=rows.filter(n=>!legacyTest(n));
    const cut=Date.now()-30*86400000,arch=live.filter(n=>archivedN(n,cut)).length;
    const kinds=[...new Set(live.map(n=>n.kind).filter(Boolean))];
    const q=NF.q.trim();
    const shown=live.filter(n=>(NF.archived||!archivedN(n,cut))&&(!NF.unreadOnly||unread(n))&&(NF.kind==='all'||n.kind===NF.kind)&&(!q||(`${n.title||''} ${n.body||''} ${stName(n)}`).includes(q)));
    const groups=new Map();shown.forEach(n=>{const k=groupTitle(n)+'|'+String(n.created_at||'').slice(0,10);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n)});
    return {rows,legacy,live,arch,kinds,shown,groups:[...groups.entries()],unread:live.filter(unread).length};
  }
  function nRow(n,showSubject){
    const u=unread(n),head=showSubject?(subject(n)||n.title||'إشعار'):(n.title||'إشعار'),sel=NF.sel===n.id;
    return `<div class="nc-nrow ${u?'unread':''} ${sel?'sel':''}" data-id="${h(n.id)}" role="button" tabindex="0" onclick="NCM.openN('${n.id}')" onkeydown="if(event.key==='Enter')NCM.openN('${n.id}')">
      <span class="nc-ndot">${u?'<i></i>':''}</span><span class="nc-nkind">${ic(kindIc(n.kind),20)}</span>
      <div class="nc-ntxt"><b>${h(head)}</b><p>${h(n.body||'')}</p><small>${kindAr(n.kind)}${n.created_at?` · ${ft(n.created_at)}`:''}${stName(n)?` · ${h(stName(n))}`:''}</small></div>
      ${u?NX.iconBtn('Done',{title:'تحديد كمقروء',cls:'nc-done',onclick:`event.stopPropagation();NCM.readN(['${n.id}'])`}):''}</div>`;
  }
  function nList(v){
    if(!v.shown.length)return (state.notificationsLoaded||v.rows.length||!online())?NX.empty('لا توجد إشعارات',{icon:'Notifications'}):NX.skeleton(4);
    return v.groups.map(([key,list])=>{
      if(list.length>=3){
        const open=NF.open.has(key)||(isDk()&&list.some(x=>x.id===NF.sel)),gu=list.filter(unread).length,ids=JSON.stringify(list.map(x=>x.id)).replace(/"/g,'&quot;');
        return `<div class="nx-card nc-ngroup"><div class="nc-nghead" role="button" tabindex="0" onclick="NCM.toggleG(this.dataset.k)" data-k="${h(key)}"><span class="nc-ngic">${ic(kindIc(list[0].kind),24)}</span><div class="nc-ntxt"><b>${h(groupTitle(list[0]))}</b><small>${list.length} إشعارًا${gu?` · ${gu} غير مقروء`:''} · ${h(key.split('|')[1])}</small></div>${gu?`<button type="button" class="nx-btn nx-text nx-small" onclick="event.stopPropagation();NCM.readN(${ids})">مقروء</button>`:''}<span class="nc-chev">${ic(open?'ExpandLess':'ExpandMore',24)}</span></div>${open?list.map(n=>`<hr class="nx-divider">${nRow(n,true)}`).join(''):''}</div>`;
      }
      return list.map(n=>`<div class="nx-card nc-nsingle">${nRow(n,false)}</div>`).join('');
    }).join('');
  }
  function nDetail(v){
    const n=(state.notifications||[]).find(x=>x.id===NF.sel);
    if(!n)return `<div class="nc-ndetail-empty">${ic('Notifications',40)}<p>اختر إشعارًا لعرض تفاصيله</p></div>`;
    const dl=n.deep_link&&n.deep_link!=='notifications';
    return `<div class="nc-ndetail"><div class="nc-nd-head"><span class="nc-ngic big">${ic(kindIc(n.kind),28)}</span><div><h3>${h(groupTitle(n))}</h3><small>${kindAr(n.kind)} · ${ft(n.created_at)}</small></div></div>
      ${subject(n)?`<div class="nc-nd-sub">${NX.pill(h(subject(n)),'info',{icon:'Person'})}</div>`:''}
      <p class="nc-nd-body">${h(n.body||'')}</p>
      <div class="nc-nd-acts">${dl?NX.btn('فتح',{icon:'Visibility',onclick:`NCM.deepN('${n.id}')`}):''}${unread(n)?NX.btn('تحديد كمقروء',{kind:'tonal',icon:'Done',onclick:`NCM.readN(['${n.id}'])`}):NX.pill('مقروء','success',{icon:'CheckCircle'})}</div></div>`;
  }
  function composer(){
    const adm=typeof isOwner==='function'&&isOwner();
    const scopes=[...(adm?[{value:'all',label:'كل الحلقات'}]:[]),{value:'halaqa',label:'حلقة'},{value:'category',label:'فئة'},{value:'student',label:'طالب'}];
    setTimeout(()=>call('refreshNotificationTargetOptions'),30);
    return `<div class="nc-compose"><div class="nc-row"><b>إرسال إشعار</b>${NX.pill(adm?'مسؤول النظام':'مشرف الحلقة','info')}</div>
      ${NX.notice('مسؤول النظام يستطيع الإرسال لكل الحلقات أو حلقة/فئة/طالب. المشرف يرسل فقط للحلقات التي يشرف عليها.','info')}
      <div class="nc-form2">${NX.select('النطاق',scopes,{id:'ntScope',value:adm?'all':'halaqa',onchange:'refreshNotificationTargetOptions()'})}
      ${NX.select('المستهدف',[{value:'',label:'—'}],{id:'ntTarget'})}
      ${NX.select('الجمهور',[{value:'guardians',label:'أولياء الأمور'},{value:'all',label:'كل المرتبطين'},{value:'teachers',label:'المحفّظون'}],{id:'ntAudience',value:'guardians'})}
      ${NX.select('النوع',[{value:'manual',label:'إشعار عام'},{value:'achievement',label:'إنجاز / تهنئة'}],{id:'ntKind',value:'manual'})}</div>
      ${NX.field('العنوان',{id:'ntTitle',placeholder:'مثال: تنبيه مهم لأولياء الأمور'})}
      ${NX.field('نص الإشعار',{html:'<textarea id="ntBody" rows="4" maxlength="1200" placeholder="اكتب نص الإشعار"></textarea>'})}
      ${NX.btn('إرسال الإشعار',{id:'ntSendBtn',icon:'Campaign',full:true,onclick:'sendManualNotification()'})}
      <h4 class="nc-sent-h">آخر ما أرسلته</h4><div class="nc-sent">${sentList()}</div></div>`;
  }
  function sentList(){
    const rows=state.sentNotifications||[];if(!rows.length)return '<p class="nx-muted">لم تُرسل إشعارات يدوية من هذا الحساب بعد.</p>';
    const g=new Map;rows.forEach(x=>{const k=x.source_key||x.id,o=g.get(k)||{...x,count:0,sent:0,errors:0};o.count++;if(x.push_status==='sent')o.sent++;if(x.push_status==='error')o.errors++;g.set(k,o)});
    return [...g.values()].slice(0,12).map(x=>`<div class="nc-sent-row"><div class="nc-grow"><b>${h(x.title)}</b><small>${ft(x.created_at)} · ${x.count} مستلم</small></div>${NX.pill(x.sent?`${x.sent} Push`:'داخل التطبيق',x.errors?'danger':x.sent?'success':'neutral')}</div>`).join('');
  }
  const notificationsHtml=guard(function(){
    const v=nView(),mg=typeof canSendNotifications==='function'&&canSendNotifications(),dk=isDk();
    if(online()&&(!state.notificationsLoaded||Date.now()-NF.last>15000)&&!NF.busy){
      NF.busy=true;NF.last=Date.now();
      setTimeout(()=>{if(typeof refreshNotifications!=='function'){NF.busy=false;return}
        refreshNotifications({silent:true}).then(()=>{NF.busy=false;if(state.page==='notifications')render()}).catch(()=>{NF.busy=false})},20);
    }
    if(dk&&(!NF.sel||!v.live.some(n=>n.id===NF.sel)))NF.sel=v.shown[0]?.id||null;
    const bar=`<div class="nc-nbar">${NX.iconBtn('Tune',{title:'تفضيلات الإشعارات',onclick:'NCM.openPrefs()'})}${mg?`<span class="nc-phone-only">${NX.iconBtn('Campaign',{title:'إرسال إشعار',onclick:'NCM.openCompose()'})}</span>`:''}
      ${NX.chip(`غير المقروءة (${v.unread})`,{selected:NF.unreadOnly,onclick:'NCM.nFlag("unreadOnly")'})}
      <span class="nc-grow"></span>${v.unread>0?NX.btn('تحديد الكل كمقروء',{kind:'text',onclick:'NCM.readN(null)'}):''}
</div>`;
    const tools=`${NX.search(NF.q,'بحث باسم الطالب أو النص',{id:'ncNq',oninput:'NCM.nq(this.value)'})}
      ${v.kinds.length>1?NX.chips([{label:'كل الأنواع',selected:NF.kind==='all',onclick:"NCM.nKind('all')"},...v.kinds.map(k=>({label:kindAr(k),selected:NF.kind===k,onclick:`NCM.nKind('${k}')`}))]):''}
      ${v.arch>0||v.legacy.length?`<div class="nc-nextra">${v.arch>0?NX.btn(NF.archived?`إخفاء المؤرشفة (${v.arch})`:`إظهار المؤرشفة (${v.arch})`,{kind:'text',small:true,onclick:'NCM.nFlag("archived")'}):''}${v.legacy.length?NX.btn(`تنظيف إشعارات الاختبارات القديمة (${v.legacy.length})`,{kind:'text',small:true,onclick:'NCM.cleanLegacy()'}):''}</div>`:''}`;
    const panel=mg?`<div class="nc-ptabs">${seg([['detail','التفاصيل'],['compose','إرسال إشعار']],NF.panel,'NCM.nPanel')}</div>${NF.panel==='compose'?composer():nDetail(v)}`:nDetail(v);
    return `<div class="nc-root nc-notifs">${bar}
      ${!online()?NX.notice('وضع عدم الاتصال · تُعرض آخر إشعارات محفوظة.','warning'):''}
      <div class="nc-nsplit"><div class="nc-nmain">${tools}<div class="nc-nlist" id="ncNList">${nList(v)}</div></div>
      ${dk?`<aside class="nc-npanel nx-card" id="ncNPanel">${panel}</aside>`:''}</div></div>`;
  });
  NCM.nq=function(val){NF.q=val;const l=$id('ncNList');if(l)l.innerHTML=nList(nView())};
  NCM.nKind=k=>{NF.kind=NF.kind===k?'all':k;render()};
  NCM.nFlag=k=>{NF[k]=!NF[k];render()};
  NCM.nPanel=p=>{NF.panel=p;render()};
  NCM.toggleG=k=>{NF.open.has(k)?NF.open.delete(k):NF.open.add(k);render()};
  NCM.readN=async function(ids){
    const all=state.notifications||[],list=(ids?all.filter(n=>ids.includes(n.id)):all.filter(n=>!legacyTest(n))).filter(unread);
    if(!list.length)return;
    const now=new Date().toISOString(),sel=list.map(n=>n.id);list.forEach(n=>n.read_at=now);
    state.notificationUnread=all.filter(unread).length;call('updateNotificationBadges');render();
    if(online()&&state.user?.id){const {error}=await db.from('notifications').update({read_at:now}).in('id',sel).eq('recipient_id',state.user.id);if(error){console.warn(error);toast('تعذر حفظ حالة القراءة')}}
  };
  NCM.cleanLegacy=function(){NCM.readN((state.notifications||[]).filter(legacyTest).map(n=>n.id))};
  NCM.openN=async function(id){
    const n=(state.notifications||[]).find(x=>x.id===id);if(!n)return;
    NF.sel=id;NF.panel='detail';
    if(unread(n))await NCM.readN([id]);else render();
    if(!isDk()&&n.deep_link&&n.deep_link!=='notifications')call('openNotificationDeepLink',n.deep_link,n);
  };
  NCM.deepN=function(id){const n=(state.notifications||[]).find(x=>x.id===id);if(n)call('openNotificationDeepLink',n.deep_link||'',n)};
  NCM.openCompose=function(){
    NX.dialog('ncComposeDlg','إرسال إشعار',composer(),{cls:'nc-dlg',onClose:()=>{}});
  };
  /* after a successful send the legacy handler clears #ntTitle — close the phone dialog then */
  if(typeof window.sendManualNotification==='function'){
    const baseSend=window.sendManualNotification;
    window.sendManualNotification=async function(){const r=await baseSend.apply(this,arguments);const t=$id('ntTitle');if((!t||!t.value)&&$id('ncComposeDlg')?.open)NX.closeDialog('ncComposeDlg');return r};
  }

  /* ---- preferences dialog (NotificationPreferencesDialog) ---- */
  let PF=null;
  NCM.openPrefs=function(){
    const p={push_enabled:true,attendance:true,recitation:true,behavior:true,announcements:true,achievements:true,...(state.notificationPreferences||{})};
    PF={push_enabled:!!p.push_enabled,attendance:!!p.attendance,recitation:!!p.recitation,behavior:!!p.behavior,announcements:!!p.announcements,achievements:!!p.achievements};
    window.PF_SET=(k,v)=>{if(PF)PF[k]=!!v};
    const rows=[['push_enabled','الإشعارات الفورية','تشغيل أو إيقاف Push على هذا الحساب'],['attendance','الحضور والغياب','تنبيهات الحضور والتأخر والغياب'],['recitation','التسميع','نتائج الحفظ والمراجعة والسرد'],['behavior','السلوك والمتابعة','ملاحظات السلوك والمتابعة اليومية'],['announcements','الإعلانات','إعلانات الحلقة والمواعيد'],['achievements','الإنجازات','الشهادات والإنجازات']];
    const body=`<div class="nc-prefs">${rows.map(([k,t,d])=>`<label class="nc-pref"><span><b>${t}</b><small>${d}</small></span><input type="checkbox" class="nx-switch" ${PF[k]?'checked':''} onchange="PF_SET('${k}',this.checked)"></label>`).join('')}</div>
      <p class="nx-muted nc-foot">إيقاف نوع معيّن لا يحذف الإشعارات الموجودة داخل التطبيق؛ بل يضبط التفضيلات المستخدمة عند الإرسال.</p><div class="nc-err" id="ncPfErr" role="alert"></div>`;
    NX.dialog('ncPrefsDlg','تفضيلات الإشعارات',body,{cls:'nc-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ncPrefsDlg')"})}${NX.btn('حفظ',{id:'ncPfSave',onclick:'NCM.savePrefs()'})}`});
  };
  NCM.savePrefs=async function(){
    if(!PF||!state.user?.id)return;
    const upd={user_id:state.user.id,...PF,updated_at:new Date().toISOString()},btn=$id('ncPfSave');
    if(!online()){const e=$id('ncPfErr');if(e)e.textContent='حفظ التفضيلات يحتاج اتصالاً بالإنترنت';return}
    if(btn)btn.disabled=true;
    const {error}=await db.from('notification_preferences').upsert(upd,{onConflict:'user_id'});
    if(error){const e=$id('ncPfErr');if(e)e.textContent=error.message||'تعذر حفظ تفضيلات الإشعارات';if(btn)btn.disabled=false;return}
    state.notificationPreferences=upd;NX.closeDialog('ncPrefsDlg');toast('تم حفظ تفضيلات الإشعارات');
    try{if(upd.push_enabled&&typeof isNativeHalaqati==='function'&&isNativeHalaqati()&&typeof pushBuildConfigured==='function'&&pushBuildConfigured())setTimeout(()=>enablePushNotifications(false).catch(()=>{}),50)}catch(_e){}
  };

  /* ================================================================== GUARDIAN */
  const isG=()=>state.profile?.role==='guardian';
  const kids=()=>(typeof activeStudents==='function'?activeStudents():(state.students||[])).filter(s=>s.status==='active'||s.status==null||s.status!=='withdrawn');
  const tathbit=s=>(s?.track_code||s?.track)==='tathbit';
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const todayS=()=>typeof today==='function'?today():ymd(new Date());
  const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return ymd(d)};
  const G={sid:'',track:'hifz',scope:'halaqa',period:'month',view:'competition',boards:{},loadingBoard:'',err:'',ach:{},achLoading:'',dash:{},dashAt:0,dashBusy:false,progErr:''};
  const gStudent=()=>{const k=kids();if(!k.some(s=>s.id===G.sid))G.sid=k[0]?.id||'';return k.find(s=>s.id===G.sid)||null};
  const gRange=()=>{const t=todayS();return G.period==='week'?[addDays(t,-6),t]:G.period==='year'?[t.slice(0,4)+'-01-01',t]:[t.slice(0,8)+'01',t]};
  const gSelect=(s)=>NX.select('الطالب',kids().map(x=>({value:x.id,label:x.full_name})),{id:'ncgSid',value:s?.id,onchange:'NCM.gStudent(this.value)'});
  const gOffline=()=>(!online()||state.networkVerified===false)?NX.notice('وضع عدم الاتصال · تعرض آخر بيانات محفوظة، وتُحدَّث تلقائيًا عند عودة الاتصال.','warning'):'';
  const chipsRow=(arr,cur,fn,cls)=>NX.chips(arr.map(([v,t])=>({label:t,selected:cur===v,check:false,onclick:`${fn}('${v}')`})),{}).replace('class="nx-chips','class="nx-chips nc-eq '+(cls||''));

  NCM.gStudent=id=>{G.sid=id;render()};
  NCM.gView=v=>{G.view=v;render()};
  NCM.gTrack=v=>{G.track=v;render()};
  NCM.gScope=v=>{G.scope=v;render()};
  NCM.gPeriod=v=>{G.period=v;render()};

  async function loadBoard(){
    const s=gStudent();if(!s||!online()||state.networkVerified===false)return;
    const tr=tathbit(s)?'tathbit':G.track,[from,to]=gRange(),key=`${s.id}:${tr}:${G.scope}:${from}:${to}`;
    if(G.boards[key]!==undefined||G.loadingBoard===key)return;
    G.loadingBoard=key;
    try{
      const r=await db.rpc('guardian_competition_board_range',{p_student_id:s.id,p_track:tr,p_scope:G.scope,p_from:from,p_to:to});
      if(r.error)throw r.error;G.boards[key]=r.data||[];G.err='';
    }catch(e){G.err=e?.message||'تعذر تحميل المنافسة';G.boards[key]=[]}
    G.loadingBoard='';if(state.page==='competition')render();
  }
  function competitionHtml(){
    const s=gStudent(),tb=tathbit(s),tr=tb?'tathbit':G.track,[from,to]=gRange(),key=s?`${s.id}:${tr}:${G.scope}:${from}:${to}`:'';
    if(s)setTimeout(loadBoard,0);
    const rows=G.boards[key],loading=s&&rows===undefined&&online();
    const filt=`<div class="nx-card nc-gfilt">${label('الطالب')}${gSelect(s).replace(/<span>الطالب<\/span>/,'')}
      ${label('المسار')}${tb?NX.pill('التثبيت','success'):chipsRow([['hifz','الحفظ'],['review','المراجعة'],['sard','السرد']],G.track,'NCM.gTrack')}
      ${label('نطاق المنافسة')}${chipsRow([['halaqa','الحلقة'],['category','الفئة'],['center','المركز']],G.scope,'NCM.gScope')}
      ${label('الفترة')}${chipsRow([['week','7 أيام'],['month','الشهر'],['year','السنة']],G.period,'NCM.gPeriod')}</div>`;
    const board=!s?NX.empty('لا يوجد طالب مرتبط بهذا الحساب',{icon:'Person'}):loading?NX.skeleton(4):(!rows||!rows.length)?NX.empty('لا توجد نتائج منافسة لهذه الفترة',{icon:'EmojiEvents'})
      :`<div class="nc-board">${rows.map((r,i)=>{
        const rank=Number(r.rank_no??r.rank)||i+1,name=r.full_name??r.student_name??'طالب',pages=Number(r.pages??r.total_pages??0),sf=r.safety??r.avg_safety,mine=r.is_my_child||r.is_current||r.student_id===s.id;
        const sub=`${num(pages)} صفحة${sf!=null&&Number(sf)>=0?` · جودة ${num(sf)}%`:''}${r.points!=null?` · ${num(r.points)} نقطة`:''}`;
        return `<div class="nx-card nc-brow ${mine?'mine':''} ${rank<=3?'top top'+rank:''}"><span class="nc-rank">${rank}</span><div class="nc-grow"><b>${h(name)}</b><small>${sub}</small></div>${mine?NX.pill('ابني','success'):''}</div>`}).join('')}</div>`;
    return `<div class="nc-root nc-g">${gTabs()}${gOffline()}${NX.hero('منافسة أبنائي','ترتيب فعلي بين طلاب نفس المسار داخل الحلقة أو الفئة أو المركز.',{icon:'EmojiEvents',badge:'المنافسة'})}
      ${G.err?NX.notice(h(G.err),'error'):''}<div class="nc-gsplit"><aside class="nc-gside">${filt}</aside><div class="nc-gmain">${board}</div></div></div>`;
  }
  const gTabs=()=>seg([['competition','المنافسة'],['achievements','الإنجازات']],G.view,'NCM.gView');

  async function loadAch(){
    const s=gStudent();if(!s||!online()||state.networkVerified===false||G.achLoading===s.id)return;
    if(G.ach[s.id]&&Date.now()-G.ach[s.id].at<60000)return;
    G.achLoading=s.id;const t=todayS();
    try{
      const [d,b]=await Promise.all([db.rpc('guardian_student_dashboard_range',{p_student_id:s.id,p_from:t.slice(0,4)+'-01-01',p_to:t}),db.rpc('rc182_refresh_student_badges_exact',{p_student_id:s.id,p_month:t.slice(0,8)+'01'})]);
      if(d.error)throw d.error;
      G.ach[s.id]={dash:d.data||{},badges:Array.isArray(b.data)?b.data:[],at:Date.now()};G.err='';
    }catch(e){G.err=e?.message||'تعذر تحميل الإنجازات';G.ach[s.id]=G.ach[s.id]||{dash:{},badges:[],at:Date.now()}}
    G.achLoading='';if(state.page==='competition'&&G.view==='achievements')render();
  }
  function achievementsHtml(){
    const s=gStudent();if(s)setTimeout(loadAch,0);
    const a=s?G.ach[s.id]:null,loading=s&&!a&&online();
    let inner='';
    if(!s)inner=NX.empty('لا يوجد طالب مرتبط بهذا الحساب',{icon:'Person'});
    else if(loading)inner=NX.skeleton(4);
    else{
      const d=a?.dash||{},ranks=d.ranks||{},at=d.attendance||{},hf=ranks.hifz||{},rv=ranks.review||{},sd=ranks.sard||{};
      const tb=tathbit(s),tp=ranks.tathbit?.pages!=null?Number(ranks.tathbit.pages):Number(hf.pages||0)+Number(rv.pages||0)+Number(sd.pages||0);
      const met=tb?NX.metrics([NX.metric('التثبيت',`${num(tp)} ص`,{icon:'MenuBook'})],1)
        :NX.metrics([NX.metric('الحفظ',`${num(hf.pages)} ص`,{icon:'MenuBook'}),NX.metric('المراجعة',`${num(rv.pages)} ص`,{icon:'Replay'}),NX.metric('السرد',`${num(sd.pages)} ص`,{icon:'AutoStories'})],3);
      const sm=(l,v)=>`<div class="nc-small"><b>${Number(v||0)}</b><span>${l}</span></div>`;
      const bs=(a?.badges||[]).slice(0,12);
      inner=`<div class="nc-ach-col">${met}
        <div class="nx-card"><h4 class="nc-h4">الحضور</h4><div class="nc-smalls">${sm('حاضر',at.present)}${sm('غياب',at.absent)}${sm('بعذر',at.excused)}${sm('تأخر',at.late)}</div></div></div>
        <div class="nx-card nc-badges"><h4 class="nc-h4">شارات الإنجاز الموثقة</h4><p class="nx-muted nc-sm">تُمنح تلقائيًا من بيانات التسميع والحضور والخطة، مع حفظ سبب وتاريخ كل شارة.</p>
        ${bs.length?bs.map(b=>`<div class="nc-badge">${ic('EmojiEvents',24)}<div class="nc-grow"><b>${h(b.title||'إنجاز')}</b><small>${h(b.description||'')}</small></div><span class="nc-bm">${h(String(b.period_month||'').slice(0,7).replace('-','/'))}</span></div>`).join(''):'<p class="nx-muted">لا توجد شارة مستحقة بعد. ستظهر تلقائيًا عند تحقق شروطها.</p>'}</div>`;
    }
    return `<div class="nc-root nc-g">${gTabs()}${gOffline()}${NX.hero('إنجازات الطالب','إنجاز الابن في مساره، مع الحضور والجودة.',{icon:'EmojiEvents',badge:'الإنجازات'})}
      <div class="nc-gpick">${gSelect(s)}</div>${G.err?NX.notice(h(G.err),'error'):''}<div class="nc-ach">${inner}</div></div>`;
  }
  window.guardianCompetitionPage=guard(function(){return G.view==='achievements'?achievementsHtml():competitionHtml()});
  window.guardianAchievementsPage=guard(function(){G.view='achievements';return achievementsHtml()});
  /* the legacy competition boards are not used by the native screen — skip their RPCs */
  if(typeof window.ensureGuardianCompetition==='function')window.ensureGuardianCompetition=async function(){};

  /* ---- guardian ranking (period based, legacy data layer) ---- */
  window.guardianRankingPage=guard(function(){
    const ch=typeof guardianVisibleChildren==='function'?guardianVisibleChildren():kids(),mode=state.guardianPeriodMode||'month';
    const dates=mode==='day'?NX.field('اليوم',{type:'date',value:state.guardianPeriodDay||todayS(),onchange:"setGuardianPeriodValue('guardianPeriodDay',this.value)"})
      :mode==='month'?NX.field('الشهر',{type:'month',value:state.guardianPeriodMonth||todayS().slice(0,7),onchange:"setGuardianPeriodValue('guardianPeriodMonth',this.value)"})
      :NX.field('من',{type:'date',value:state.guardianPeriodFrom||todayS().slice(0,8)+'01',onchange:"setGuardianPeriodValue('guardianPeriodFrom',this.value)"})+NX.field('إلى',{type:'date',value:state.guardianPeriodTo||todayS(),onchange:"setGuardianPeriodValue('guardianPeriodTo',this.value)"});
    const all=kids();
    const pick=all.length>1?NX.select('الطالب',[{value:'all',label:'كل أبنائي'},...all.map(x=>({value:x.id,label:x.full_name}))],{value:state.guardianChildFilter||'all',onchange:'setGuardianChildFilter(this.value)'}):'';
    const TR={hifz:'الحفظ',review:'المراجعة',sard:'السرد'},TI={hifz:'MenuBook',review:'Replay',sard:'AutoStories'};
    const err=state.guardianAnalyticsError?NX.notice('تعذر تحديث النتائج: '+h(state.guardianAnalyticsError),'error'):'';
    const cards=ch.map(st=>{
      const dash=state.guardianRangeDashboards?.[typeof guardianRangeRankKey==='function'?guardianRangeRankKey(st.id):'']||{},ranks=dash.ranks||{};
      const lines=['hifz','review','sard'].map(t=>{
        const x=ranks[t]||(typeof guardianRangeRankRow==='function'?guardianRangeRankRow(st.id,t):null)||{},has=Number(x.pages||0)>0||Number(x.points||0)>0;
        const hr=Number(x.halaqa_rank??x.rank_no)||0,ht=Number(x.halaqa_total??x.total_students)||0,cr=Number(x.category_rank)||0,ct=Number(x.category_total)||0;
        return `<div class="nc-rline"><span class="nc-rl-ic">${ic(TI[t],22)}</span><div class="nc-grow"><b>${TR[t]}</b><small>${has?`${num(x.points)} نقطة · ${num(x.pages)} ص`:'لا توجد تسميعات خلال الفترة'}</small></div><div class="nc-rbox"><small>الفئة</small><b>${has&&cr&&ct?`${cr} / ${ct}`:'—'}</b></div><div class="nc-rbox"><small>الحلقة</small><b>${has&&hr&&ht?`${hr} / ${ht}`:'—'}</b></div></div>`}).join('');
      return `<div class="nx-card nc-rcard"><div class="nc-row">${NX.avatar(st.full_name)}<div class="nc-grow"><b>${h(st.full_name)}</b><small class="nx-muted">ترتيبه داخل فئته وعلى الحلقة ضمن نفس المسار</small></div></div>${lines}</div>`}).join('');
    return `<div class="nc-root nc-g">${gOffline()}${NX.hero('ترتيب أبنائي','يظهر ترتيب ابنك داخل الحلقة دون كشف نتائج أو ملفات الطلاب الآخرين.',{icon:'Leaderboard',badge:typeof guardianPeriodLabel==='function'?h(guardianPeriodLabel()):''})}
      <div class="nc-gsplit"><aside class="nc-gside"><div class="nx-card nc-gfilt">${label('الفترة')}${chipsRow([['day','يوم معين'],['range','فترة'],['month','شهر معين']],mode,'setGuardianPeriodMode')}<div class="nc-dates">${dates}</div>${pick}</div></aside>
      <div class="nc-gmain">${err}${cards||NX.empty('لا يوجد طالب مربوط بالحساب',{icon:'Person'})}<div class="nc-privacy">${ic('Info',16)}لا يعرض هذا القسم نقاط أو تقارير الطلاب الآخرين. تُستخدم نتائج الحلقة في الخادم لحساب ترتيب ابنك فقط.</div></div></div></div>`;
  });

  /* ---- guardian profile (GuardianProfileNativeScreen + GuardianAnalyticsCard) ---- */
  const PK={tajweed:'التلاوة والتجويد',tilawah:'التلاوة والتجويد',training:'برنامج تأهيلي'};
  async function programsFor(st){
    const m0=todayS().slice(0,8)+'01',m1=todayS();
    const [hs,mem]=await Promise.all([db.from('halaqas').select('id,name,halaqa_type').limit(200),db.from('student_halaqa_memberships').select('halaqa_id,status').eq('student_id',st.id).limit(50)]);
    if(hs.error)throw hs.error;
    const by=new Map((hs.data||[]).map(x=>[x.id,x])),ids=[...new Set([...(mem.data||[]).filter(x=>(x.status||'active')==='active').map(x=>x.halaqa_id),st.halaqa_id].filter(Boolean))].filter(id=>by.has(id)&&by.get(id).halaqa_type&&by.get(id).halaqa_type!=='regular'&&by.get(id).halaqa_type!=='halaqa');
    if(!ids.length)return [];
    const f=q=>q.eq('student_id',st.id).gte('sessions.session_date',m0).lte('sessions.session_date',m1).neq('sessions.status','cancelled').limit(500);
    const [att,rec]=await Promise.all([f(db.from('attendance_records').select('status,sessions!inner(session_date,halaqa_id,status)')),f(db.from('recitation_entries').select('evaluation,safety_percentage,sessions!inner(session_date,halaqa_id,status)'))]);
    return ids.map(id=>{const a=(att.data||[]).filter(r=>r.sessions?.halaqa_id===id),r=(rec.data||[]).filter(x=>x.sessions?.halaqa_id===id),s=r.map(x=>x.safety_percentage).filter(v=>v!=null).map(Number);
      return {name:by.get(id).name,type:by.get(id).halaqa_type,sessions:a.length,present:a.filter(x=>x.status==='present'||x.status==='late').length,absent:a.filter(x=>x.status==='absent').length,recs:r.length,avg:s.length?Math.round(s.reduce((x,y)=>x+y,0)/s.length*10)/10:null}});
  }
  async function loadProfiles(force){
    if(!isG()||!online()||state.networkVerified===false||G.dashBusy)return;
    if(!force&&Date.now()-G.dashAt<60000)return;
    G.dashBusy=true;G.dashAt=Date.now();const t=todayS(),m0=t.slice(0,8)+'01',tr=addDays(t,-29);
    try{
      await Promise.all(kids().map(async st=>{
        try{
          const [m,tn,td]=await Promise.all([db.rpc('guardian_student_dashboard_range',{p_student_id:st.id,p_from:m0,p_to:t}),db.rpc('guardian_student_dashboard_range',{p_student_id:st.id,p_from:tr,p_to:t}),db.rpc('guardian_student_dashboard_range',{p_student_id:st.id,p_from:t,p_to:t})]);
          if(m.error)throw m.error;
          let programs=(G.dash[st.id]||{}).programs||[];try{programs=await programsFor(st)}catch(_e){}
          G.dash[st.id]={month:m.data||{},trend:tn.data||{},today:td.data||{},programs,at:Date.now()};
          state.guardianDashboards=state.guardianDashboards||{};state.guardianDashboards[st.id]={month:m.data||{},trend:tn.data||{},loadedAt:new Date().toISOString()};
        }catch(e){G.progErr=e?.message||'تعذر تحميل ملف الطالب'}
      }));
      try{cacheSnapshot()}catch(_e){}
    }finally{G.dashBusy=false}
    if(state.page==='profile')render();
  }
  function dashOf(st){
    const c=G.dash[st.id];if(c)return c;
    const o=state.guardianDashboards?.[st.id];return {month:o?.month||{},trend:o?.trend||{},today:{},programs:[],cached:!!o};
  }
  function planOf(st){
    try{
      if(typeof effectiveSmartPlans!=='function'||typeof smartPlanProgress!=='function')return null;
      const ps=effectiveSmartPlans(st,todayS()),plan=ps.find(p=>p.plan_type==='hifz')||ps[0];if(!plan)return null;
      return {plan,progress:smartPlanProgress(plan,st.id,todayS())};
    }catch(_e){return null}
  }
  const rankTxt=(m,sc)=>{const p=Number(m?.pages||0),r=Number(m?.[sc+'_rank']||0),t=Number(m?.[sc+'_total']||0);return p>0&&r>0&&t>0?`${r} / ${t}`:'—'};
  const lastSafety=d=>{const a=d?.daily||[];for(let i=a.length-1;i>=0;i--){const s=a[i]?.safety;if(s!=null&&Number.isFinite(Number(s)))return Number(s)}return null};
  function todayAlert(td,trend){
    const at=td?.attendance||{},daily=td?.daily||trend?.daily||[],t=todayS(),act=daily.find(x=>String(x.date).slice(0,10)===t);
    const pr=Number(at.present||0),ab=Number(at.absent||0),ex=Number(at.excused||0),lt=Number(at.late||0);
    const hf=Number(act?.hifz||0),rv=Number(act?.review||0),sd=Number(act?.sard||0),has=hf>0||rv>0||sd>0;
    const att=lt>0?'متأخر':pr>0?'حاضر':ex>0?'غائب بعذر':ab>0?'غائب':'لم يُسجل الحضور بعد';
    const kind=ab>0?'danger':(ex>0||lt>0)?'warning':(pr>0&&has)?'success':'info';
    const det=[att,hf>0&&`حفظ ${num(hf)} ص`,rv>0&&`مراجعة ${num(rv)} ص`,sd>0&&`سرد ${num(sd)} ص`,act&&act.safety!=null&&`جودة ${num(act.safety)}%`].filter(Boolean).join(' · ');
    const icn=ab>0?'EventBusy':(pr>0&&has)?'CheckCircle':'Today';
    return `<div class="nc-today nx-s-${kind}">${ic(icn,24)}<div class="nc-grow"><b>حالة اليوم</b><span>${h(det||'لم يُسجل نشاط اليوم بعد')}</span></div></div>`;
  }
  function trendHtml(trend,days){
    const by=new Map((trend?.daily||[]).map(x=>[String(x.date).slice(0,10),x])),t=todayS();
    const series=[];for(let o=days-1;o>=0;o--){const d=addDays(t,-o);series.push([d,Number(by.get(d)?.hifz||0)])}
    const total=series.reduce((a,x)=>a+x[1],0),max=Math.max(1,...series.map(x=>x[1]));
    return `<div class="nc-trend"><small class="nx-muted">إجمالي الفترة ${num(total)} ص · أيام الحفظ ${series.filter(x=>x[1]>0).length}</small>
      <div class="nc-bars d${days}" role="img" aria-label="صفحات الحفظ خلال ${days} يومًا، الإجمالي ${num(total)} صفحة">${series.map(([d,v])=>{const day=Number(d.slice(8)),show=days<=7||d===t||day%7===0;return `<div class="nc-bar" title="${d}: ${num(v)} صفحة"><i class="${v>0?'on':''}" style="height:${v>0?8+Math.round(56*v/max):2}px"></i><span>${show?day:''}</span></div>`}).join('')}</div></div>`;
  }
  function summaryText(st,dash,pl){
    const hf=Number(dash.month?.ranks?.hifz?.pages||0),ab=Number(dash.month?.attendance?.absent||0),p=pl?.progress;
    const behind=Number(p?.behindBy||0);
    if(p&&p.health==='red')return `الخطة تحتاج تدخلاً: يوجد تأخر ${num(behind)} صفحة. يُفضّل الالتزام بالمقرر والتعويض الموزع.`;
    if(p&&p.health==='yellow')return `التقدم قريب من المطلوب، لكن توجد فجوة ${num(behind)} صفحة تحتاج متابعة خلال الأيام القادمة.`;
    if(hf<=0)return 'لا توجد صفحات حفظ مسجلة في هذا الشهر حتى الآن.';
    if(ab>=3)return `التقدم المسجل ${num(hf)} صفحة، مع ${ab} أيام غياب تحتاج متابعة.`;
    if(p)return `التقدم مستقر: ${num(hf)} صفحة حفظ هذا الشهر، وإنجاز الخطة ${num(p.percentage)}%.`;
    return `تم تسجيل ${num(hf)} صفحة حفظ هذا الشهر.`;
  }
  function profileCard(st){
    const d=dashOf(st),hf=d.month?.ranks?.hifz||{},at=d.month?.attendance||{},pl=planOf(st),p=pl?.progress;
    const days=[7,14,30].includes(Number(state.guardianTrendDays))?Number(state.guardianTrendDays):7,sf=lastSafety(d.trend);
    const planTxt=p?`${num(p.completed)} / ${num(p.plan?.target_pages??(Number(p.completed||0)+Number(p.remaining||0)))} ص`:'—';
    const gm=(l,v)=>`<div class="nc-gm"><b>${v}</b><span>${l}</span></div>`;
    const a=p?.assignment||{};
    const planBox=p?`<div class="nc-planbox"><div class="nc-row">${ic('MenuBook',22)}<b>خطة اليوم</b></div><p>${Number(a.pages||0)>0?`${num(a.pages)} صفحة · ${h(a.startPage!=null&&a.endPage!=null?`ص ${a.startPage}${a.endPage!==a.startPage?' – '+a.endPage:''}`:'حسب الخطة')}`:Number(p.remaining||0)<=0?'تم إكمال الخطة':'لا يوجد مقرر اليوم'}</p>${Number(p.behindBy||0)>0?`<small class="nc-late">متأخر ${num(p.behindBy)} صفحة، والتعويض موزع على الأيام القادمة.</small>`:''}</div>`:'';
    const progs=(d.programs||[]).length?`<div class="nc-progs"><b>البرامج الأخرى لابني</b>${d.programs.map(x=>`<div class="nc-prog"><div class="nc-row">${ic('School',22)}<div><b>${h(x.name)}</b><small>${PK[x.type]||'دورة'}</small></div></div><p>هذا الشهر: ${x.sessions} جلسة · حضور ${x.present} · غياب ${x.absent}</p><small>${x.recs?`تسميعات ${x.recs}${x.avg!=null?` · متوسط الجودة ${num(x.avg)}%`:''}`:'لا توجد تسميعات مسجلة هذا الشهر'}</small></div>`).join('')}</div>`:'';
    return `<article class="nx-card nx-emph nc-pcard" data-id="${h(st.id)}"><div class="nc-row nc-phead"><span class="nc-pav">${ic('AccountCircle',42)}</span><div class="nc-grow"><b>${h(st.full_name)}</b><small class="nx-muted">${tathbit(st)?'مسار التثبيت':'مسار الحفظ العام'}</small></div></div>
      ${todayAlert(d.today,d.trend)}
      <div class="nc-gms">${gm('حفظ الشهر',`${num(hf.pages)} ص`)}${gm('الحضور',Number(at.present||0))}${gm('ترتيب الفئة',rankTxt(hf,'category'))}${gm('ترتيب الحلقة',rankTxt(hf,'halaqa'))}${gm('جودة آخر تسميع',sf==null?'—':num(sf)+'%')}${gm('إنجاز الخطة',planTxt)}</div>
      <div class="nc-summary">${ic('AutoAwesome',22)}<div><b>ملخص المتابعة</b><p>${h(summaryText(st,d,pl))}</p></div></div>
      <div class="nc-trendbox"><div class="nc-row"><div class="nc-grow"><b>تطور الحفظ</b><small class="nx-muted">صفحات التسميع يومًا بيوم</small></div><div class="nc-days">${[7,14,30].map(n=>NX.chip(String(n),{selected:days===n,check:false,onclick:`setGuardianTrendDays(${n})`})).join('')}</div></div>${trendHtml(d.trend,days)}</div>
      ${progs}${planBox}</article>`;
  }
  const guardianProfileHtml=guard(function(){
    setTimeout(()=>loadProfiles(false),0);
    const ch=kids(),init=state.ncgInitial;
    const rows=[...ch].sort((a,b)=>(a.id===init?0:1)-(b.id===init?0:1)||String(a.full_name).localeCompare(String(b.full_name),'ar'));
    const loading=!G.dashAt&&online()&&!ch.every(s=>state.guardianDashboards?.[s.id]);
    return `<div class="nc-root nc-g nc-prof">${gOffline()}${G.progErr&&!online()?'':G.progErr?NX.notice(h(G.progErr),'error'):''}
      <div class="nx-card nc-pintro"><h3>ملخص المتابعة</h3><p>الحفظ والحضور والترتيب وجودة التسميع وإنجاز الخطة من البيانات الفعلية.</p></div>
      ${!rows.length?NX.empty('لا توجد ملفات طلاب مرتبطة بهذا الحساب',{icon:'Person'}):loading&&!G.dash[rows[0].id]?NX.skeleton(2)+'<div class="nc-pgrid">'+rows.map(profileCard).join('')+'</div>':'<div class="nc-pgrid">'+rows.map(profileCard).join('')+'</div>'}</div>`;
  });

  /* ================================================================== hook the global page functions */
  window.communityPage=communityHtml;
  window.notificationsPage=notificationsHtml;
  if(typeof window.profilePage==='function'){
    const baseProfilePage=window.profilePage;
    window.profilePage=function(){return isG()?guardianProfileHtml():baseProfilePage.apply(this,arguments)};
  }
  if(typeof window.studentProfile==='function'){
    const baseStudentProfile=window.studentProfile;
    window.studentProfile=function(id){
      if(isG()){
        if(!kids().some(s=>s.id===id)){toast('لا تملك صلاحية فتح ملف هذا الطالب');return}
        state.ncgInitial=id;go('profile');return;
      }
      return baseStudentProfile.apply(this,arguments);
    };
  }
  /* manual refresh helpers used by the top bar / sync */
  NCM.refreshGuardian=()=>loadProfiles(true);
})();
