/* Halaqati RC27.40 — "NX": the web twin of the Android app's component kit (Components.kt, UnifiedCards.kt,
   GoldenShell.kt, HalaqatiInsightKit.kt). Screens are built from these helpers so every page looks and behaves
   like the Compose app: Material 3 buttons, FilterChips, StatusPill, MetricCard, GoldenFeatureHero, InsightCardShell,
   bottom sheets, dropdown menus, Material icons. All helpers return HTML strings (RTL, Arabic) and call existing
   global handlers through inline onclick strings — screens keep using the legacy data layer (state, db, handlers). */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ic=(n,s,c)=>typeof mi==='function'?mi(n,s,c):'';
  const attr=(o)=>Object.entries(o||{}).filter(([,v])=>v!=null&&v!==false).map(([k,v])=>v===true?k:`${k}="${h(v)}"`).join(' ');
  const NX={h,icon:ic};

  // ---------- buttons (Material 3) ----------
  /** kind: filled | tonal | outlined | text | danger ; opts: {icon,onclick,full,small,disabled,title,cls,id} */
  NX.btn=(label,o={})=>`<button type="button" class="nx-btn nx-${o.kind||'filled'} ${o.full?'nx-full':''} ${o.small?'nx-small':''} ${o.cls||''}" ${attr({id:o.id,onclick:o.onclick,title:o.title,disabled:o.disabled,'aria-label':o.aria})}>${o.icon?ic(o.icon,o.small?16:18):''}<span>${label==null?'':label}</span></button>`;
  /** 48dp touch target, 40dp tile like the app's top-bar tiles when tile:true */
  NX.iconBtn=(icon,o={})=>`<button type="button" class="nx-iconbtn ${o.tile?'nx-tile':''} ${o.cls||''}" ${attr({id:o.id,onclick:o.onclick,title:o.title,'aria-label':o.title||o.aria,disabled:o.disabled})}>${ic(icon,o.size||24)}${o.badge?`<i class="nx-badge">${h(o.badge)}</i>`:''}</button>`;
  NX.fab=(icon,label,onclick)=>`<button type="button" class="nx-fab" onclick="${h(onclick)}" aria-label="${h(label)}">${ic(icon,24)}<span>${h(label)}</span></button>`;

  // ---------- chips / pills ----------
  NX.chip=(label,o={})=>`<button type="button" class="nx-chip ${o.selected?'on':''} ${o.cls||''}" ${attr({onclick:o.onclick,'aria-pressed':o.selected?'true':'false'})}>${o.selected&&o.check!==false?ic('Check',17):(o.icon?ic(o.icon,17):'')}<span>${label}</span></button>`;
  NX.chips=(items,o={})=>`<div class="nx-chips ${o.wrap?'wrap':''}" role="group">${items.map(i=>NX.chip(i.label,i)).join('')}</div>`;
  /** kind: success | warning | danger | info | neutral */
  NX.pill=(text,kind='info',o={})=>`<span class="nx-pill nx-s-${kind} ${o.cls||''}">${o.icon?ic(o.icon,14):''}${text}</span>`;

  // ---------- surfaces ----------
  NX.card=(inner,o={})=>`<div class="nx-card ${o.onclick?'nx-click':''} ${o.cls||''}" ${attr({id:o.id,onclick:o.onclick,style:o.style,'data-id':o.dataId,tabindex:o.onclick?0:null,role:o.onclick?'button':null})}>${inner}</div>`;
  NX.section=(title,actions='',o={})=>`<div class="nx-section ${o.cls||''}"><h3>${title}</h3>${actions?`<div class="nx-section-actions">${actions}</div>`:''}</div>`;
  NX.metric=(title,value,o={})=>`<div class="nx-metric ${o.onclick?'nx-click':''}" ${attr({onclick:o.onclick,role:o.onclick?'button':null,tabindex:o.onclick?0:null})}>${o.icon?`<span class="nx-metric-ic">${ic(o.icon,20)}</span>`:''}<b>${value}</b><span>${title}</span>${o.subtitle?`<small>${o.subtitle}</small>`:''}</div>`;
  NX.metrics=(arr,cols)=>`<div class="nx-metrics" style="--cols:${cols||arr.length}">${arr.join('')}</div>`;
  NX.avatar=(name,o={})=>`<span class="nx-avatar ${o.cls||''}" style="${o.size?`width:${o.size}px;height:${o.size}px;`:''}">${h((String(name||'').trim()[0])||'ط')}</span>`;
  NX.notice=(text,kind='info')=>`<div class="nx-notice nx-s-${kind}">${text}</div>`;
  NX.empty=(text,o={})=>`<div class="nx-empty">${o.lottie&&typeof window.rc27Motion==='function'?'':`<span class="nx-empty-ic">${ic(o.icon||'SearchOff',28)}</span>`}<p>${text}</p>${o.label?NX.btn(o.label,{kind:'outlined',onclick:o.onclick}):''}</div>`;
  NX.progress=(pct,o={})=>`<div class="nx-progress ${o.cls||''}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>`;
  NX.divider=()=>'<hr class="nx-divider">';

  /** GoldenFeatureHero: title, subtitle, optional badge, optional actions row and art. */
  NX.hero=(title,subtitle,o={})=>`<section class="nx-hero ${o.cls||''}"><div class="nx-hero-row"><div class="nx-hero-t"><h2>${title}</h2><p>${subtitle||''}</p></div>${o.art||(o.icon?`<span class="nx-hero-ic">${ic(o.icon,30)}</span>`:'')}${o.badge?`<span class="nx-hero-badge">${o.badge}</span>`:''}</div>${o.actions?`<div class="nx-hero-actions">${o.actions}</div>`:''}</section>`;

  /** InsightCardShell (HalaqatiInsightKit): tinted card with round icon, title, summary, count and collapsible body. */
  NX.insight=(kind,icon,title,summary,o={})=>`<div class="nx-insight nx-s-${kind||'info'} ${o.onclick?'nx-click':''}" ${attr({onclick:o.onclick})}><div class="nx-insight-head"><span class="nx-insight-ic">${ic(icon,22)}</span><div class="nx-insight-t"><b>${title}</b>${summary?`<small>${summary}</small>`:''}</div>${o.count!=null?`<span class="nx-insight-n">${o.count}</span>`:''}${o.expanded!=null?`<span class="nx-insight-chev ${o.expanded?'up':''}">${ic('ExpandMore',22)}</span>`:''}</div>${o.body?`<div class="nx-insight-body">${o.body}</div>`:''}</div>`;

  /** CompactSearchField: 48dp, search icon, clear button. oninput string receives the value via this.value. */
  NX.search=(value,placeholder,o={})=>`<label class="nx-search ${o.cls||''}">${ic('Search',20)}<input type="search" value="${h(value||'')}" placeholder="${h(placeholder||'بحث')}" ${attr({id:o.id,oninput:o.oninput,onchange:o.onchange})} autocomplete="off">${o.trailing||''}</label>`;
  /** Outlined text field with label above (web adaptation of OutlinedTextField). */
  NX.field=(label,o={})=>`<label class="nx-field ${o.cls||''}"><span>${label}</span>${o.html||`<input ${attr({id:o.id,type:o.type||'text',value:o.value,placeholder:o.placeholder,oninput:o.oninput,onchange:o.onchange,required:o.required,min:o.min,max:o.max,inputmode:o.inputmode,autocomplete:'off'})}>`}${o.hint?`<small>${o.hint}</small>`:''}</label>`;
  NX.select=(label,options,o={})=>NX.field(label,{...o,html:`<select ${attr({id:o.id,onchange:o.onchange})}>${options.map(x=>`<option value="${h(x.value)}" ${String(x.value)===String(o.value)?'selected':''}>${h(x.label)}</option>`).join('')}</select>`});
  NX.switchRow=(label,checked,onchange,o={})=>`<label class="nx-switchrow"><span>${label}</span><input type="checkbox" class="nx-switch" ${checked?'checked':''} ${attr({onchange,id:o.id})}></label>`;

  // ---------- dropdown menu (Compose DropdownMenu) ----------
  const MENUS=new Map();let menuSeq=0,openMenu=null;
  function closeMenu(){if(openMenu){openMenu.remove();openMenu=null}}
  NX.closeMenu=closeMenu;
  /** items: [{label,icon,onclick,danger,hidden}] — returns the "⋮" IconButton html. */
  NX.kebab=(items,o={})=>{
    const key='m'+(++menuSeq);MENUS.set(key,items.filter(i=>!i.hidden));if(MENUS.size>400)MENUS.delete(MENUS.keys().next().value);
    return `<button type="button" class="nx-iconbtn ${o.cls||''}" title="${h(o.title||'خيارات')}" aria-label="${h(o.title||'خيارات')}" aria-haspopup="menu" onclick="event.stopPropagation();NX.openMenu(this,'${key}')">${ic('MoreVert',22)}</button>`;
  };
  NX.openMenu=(btn,key)=>{
    closeMenu();const items=MENUS.get(key)||[];if(!items.length)return;
    const m=document.createElement('div');m.className='nx-menu';m.setAttribute('role','menu');
    m.innerHTML=items.map((i,ix)=>`<button type="button" role="menuitem" class="${i.danger?'danger':''}" data-i="${ix}">${i.icon?ic(i.icon,20):'<span class="sp"></span>'}<span>${i.label}</span></button>`).join('');
    document.body.appendChild(m);openMenu=m;
    const r=btn.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight,vw=innerWidth,vh=innerHeight;
    let left=r.left;if(left+mw>vw-8)left=Math.max(8,vw-mw-8);
    let top=r.bottom+4;if(top+mh>vh-8)top=Math.max(8,r.top-mh-4);
    m.style.left=left+'px';m.style.top=top+'px';
    m.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b)return;const it=items[+b.dataset.i];closeMenu();try{typeof it.onclick==='function'?it.onclick():(0,eval)(it.onclick)}catch(err){console.error(err)}});
    setTimeout(()=>{document.addEventListener('click',closeMenu,{once:true});document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){closeMenu();document.removeEventListener('keydown',esc)}})},0);
  };

  // ---------- sheet / dialog (ModalBottomSheet on phones, centred dialog on desktop) ----------
  NX.dialog=(id,title,body,o={})=>{
    let d=document.getElementById(id);
    if(!d){d=document.createElement('dialog');d.id=id;d.className='nx-dlg';document.body.appendChild(d);d.addEventListener('close',()=>{o.onClose&&o.onClose()})}
    d.className='nx-dlg '+(o.cls||'');
    d.innerHTML=`<div class="nx-dlg-body"><div class="nx-dlg-grab"></div><header class="nx-dlg-head"><h3>${title}</h3><button type="button" class="nx-iconbtn" aria-label="إغلاق" onclick="document.getElementById('${id}').close()">${ic('Close',22)}</button></header><div class="nx-dlg-content">${body}</div>${o.footer?`<footer class="nx-dlg-foot">${o.footer}</footer>`:''}</div>`;
    if(!d.open)d.showModal();
    d.onclick=e=>{if(e.target===d)d.close()};
    return d;
  };
  NX.closeDialog=id=>document.getElementById(id)?.close();
  /** Confirm dialog (AlertDialog). */
  NX.confirm=(title,text,okLabel,onOk,o={})=>{
    const id='nxConfirm';window.__nxOk=()=>{NX.closeDialog(id);try{onOk()}catch(e){console.error(e)}};
    NX.dialog(id,title,`<p class="nx-confirm-text">${text}</p>`,{cls:'nx-small-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:`NX.closeDialog('${id}')`})}${NX.btn(okLabel||'تأكيد',{kind:o.danger?'danger':'filled',onclick:'__nxOk()'})}`});
  };

  // ---------- skeleton / loader ----------
  NX.skeleton=(rows=3)=>`<div class="nx-skel">${Array.from({length:rows},(_,i)=>`<div class="nx-skel-card"><i style="width:${i%2?72:58}%"></i><i style="width:90%"></i><i style="width:68%"></i></div>`).join('')}</div>`;

  window.NX=NX;
})();
