/* Halaqati v2.40.8 — Chromium vector direct-save + isolated system printing */
(function(){
  'use strict';
  const VERSION='2.40.8-chromium-direct-vector-layout-fix';
  const compatibilityRasterExport=typeof window.downloadReportPdfFromPreview==='function'?window.downloadReportPdfFromPreview:null;
  const FONT_CACHE=new Map();
  let styleCachePromise=null;
  let cairoPdfFontPromise=null;

  function previewHost(){
    const dlg=document.getElementById('reportPreviewDlg');
    return dlg?.open?dlg:document.body;
  }
  function notify(msg,type='success'){
    try{
      const dlg=document.getElementById('reportPreviewDlg');
      if(dlg?.open){
        dlg.querySelector('.hf-preview-save-status')?.remove();
        const el=document.createElement('div');
        el.className='hf-preview-save-status';el.dir='rtl';
        const good=type!=='error';
        el.style.cssText=`position:absolute;top:72px;left:50%;transform:translateX(-50%);z-index:2147483646;max-width:min(92%,620px);padding:12px 16px;border-radius:13px;border:1px solid ${good?'#9ccdb7':'#e2abab'};background:${good?'#effaf5':'#fff1f1'};color:${good?'#0d5a40':'#9c3333'};box-shadow:0 12px 35px #0002;font-family:Cairo,Tahoma,Arial,sans-serif;font-weight:800;text-align:center;pointer-events:auto`;
        el.textContent=msg;dlg.appendChild(el);
        setTimeout(()=>{try{el.remove()}catch(_e){}},6500);
        return;
      }
    }catch(_e){}
    try{ if(typeof toast==='function') return toast(msg); }catch(_e){}
    console.log('[Halaqati PDF]',msg);
  }
  function latinDigits(s){return String(s??'').replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])}
  function safeFilename(name){
    let s=latinDigits(name||'halaqati-report.pdf').replace(/[\\/:*?"<>|\r\n]+/g,'_').replace(/\s+/g,' ').trim();
    if(!/\.pdf$/i.test(s))s+='.pdf';
    return s.slice(0,120)||'halaqati-report.pdf';
  }
  function isNative(){return !!(window.Capacitor?.isNativePlatform?.()||window.Capacitor?.getPlatform?.()==='android'||window.Capacitor?.getPlatform?.()==='ios')}
  function progress(text,title='جاري إنشاء ملف PDF'){
    let el=document.getElementById('hfVectorPdfProgress');
    if(!el){
      el=document.createElement('div');el.id='hfVectorPdfProgress';el.dir='rtl';
      el.style.cssText='position:absolute;inset:0;z-index:2147483645;background:rgba(247,247,242,.97);display:grid;place-items:center;font-family:Cairo,Tahoma,Arial,sans-serif;color:#0d3b2f';
      el.innerHTML='<div style="background:#fff;border:1px solid #dfe6e2;border-radius:18px;padding:20px 24px;box-shadow:0 16px 50px #0d3b2f22;text-align:center;min-width:250px"><b style="display:block;font-size:17px;margin-bottom:5px"></b><span style="font-size:12px;color:#68736e"></span></div>';
      previewHost().appendChild(el);
    }
    const b=el.querySelector('b'),span=el.querySelector('span');
    if(b)b.textContent=title;
    if(span)span.textContent=text||'PDF متجهي · Cairo · RTL';
    return el;
  }
  function hideProgress(){document.getElementById('hfVectorPdfProgress')?.remove()}
  function setSaveButtonState(state){
    try{
      const btn=document.getElementById('hfSavePdf');if(!btn)return;
      if(!btn.dataset.hfIdleText)btn.dataset.hfIdleText=btn.textContent||'حفظ PDF';
      if(state==='busy'){btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent='جاري الحفظ…';return;}
      btn.disabled=false;btn.removeAttribute('aria-busy');
      if(state==='done'){btn.textContent='تم الحفظ ✓';setTimeout(()=>{if(!btn.disabled)btn.textContent=btn.dataset.hfIdleText||'حفظ PDF'},5000);return;}
      if(state==='error'){btn.textContent='تعذر الحفظ';setTimeout(()=>{if(!btn.disabled)btn.textContent=btn.dataset.hfIdleText||'حفظ PDF'},3500);return;}
      btn.textContent=btn.dataset.hfIdleText||'حفظ PDF';
    }catch(_e){}
  }
  function toDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('FileReader failed'));r.readAsDataURL(blob)})}
  function bytesToBase64(bytes){
    let binary='';const chunk=0x6000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));
    return btoa(binary);
  }
  async function inlineUrl(raw,base){
    const clean=String(raw||'').trim().replace(/^['"]|['"]$/g,'');
    if(!clean||clean.startsWith('data:')||clean.startsWith('#'))return clean;
    let abs;try{abs=new URL(clean,base||location.href).href}catch(_e){return clean}
    if(FONT_CACHE.has(abs))return FONT_CACHE.get(abs);
    try{
      const r=await fetch(abs,{cache:'force-cache'});if(!r.ok)throw new Error(String(r.status));
      const blob=await r.blob(),data=await toDataUrl(blob);FONT_CACHE.set(abs,data);return data;
    }catch(_e){return abs}
  }
  async function inlineCssUrls(css,base){
    const matches=[...String(css||'').matchAll(/url\(([^)]+)\)/g)];
    if(!matches.length)return css;
    let out=css;
    for(const m of matches){
      const clean=m[1].trim().replace(/^['"]|['"]$/g,'');
      if(!/\.(woff2?|ttf|otf|svg|png|jpe?g)(\?|#|$)/i.test(clean)&&!clean.includes('/fonts/'))continue;
      const data=await inlineUrl(clean,base);
      if(data&&data!==clean)out=out.split(m[0]).join(`url("${data}")`);
    }
    return out;
  }
  async function collectDocumentCss(){
    if(styleCachePromise)return styleCachePromise;
    styleCachePromise=(async()=>{
      const chunks=[];
      for(const node of [...document.querySelectorAll('link[rel="stylesheet"],style')]){
        if(node.tagName==='STYLE'){chunks.push(node.textContent||'');continue}
        const href=node.href;if(!href)continue;
        try{const r=await fetch(href,{cache:'force-cache'});if(!r.ok)continue;chunks.push(await inlineCssUrls(await r.text(),href))}catch(_e){}
      }
      return chunks.join('\n');
    })();
    return styleCachePromise;
  }
  function sanitizeClone(root){
    root.querySelectorAll('script,iframe,object,embed,form,video,audio').forEach(n=>n.remove());
    root.querySelectorAll('*').forEach(el=>{
      for(const a of [...el.attributes]){
        const n=a.name.toLowerCase(),v=String(a.value||'');
        if(n.startsWith('on'))el.removeAttribute(a.name);
        if((n==='href'||n==='src'||n==='xlink:href')&&/^\s*javascript:/i.test(v))el.removeAttribute(a.name);
      }
      el.removeAttribute('contenteditable');el.removeAttribute('spellcheck');el.removeAttribute('inert');
    });
    return root;
  }
  async function inlineImages(root){
    const imgs=[...root.querySelectorAll('img[src]')];
    await Promise.all(imgs.map(async img=>{
      const src=img.getAttribute('src');if(!src||src.startsWith('data:'))return;
      try{const abs=new URL(src,location.href).href;const r=await fetch(abs,{cache:'force-cache'});if(!r.ok)return;img.src=await toDataUrl(await r.blob())}catch(_e){}
    }));
  }
  function printOverrides(orientation,fontFamily){
    const size=orientation==='portrait'?'A4 portrait':'A4 landscape';
    return `
      @page{size:${size};margin:7mm}
      html,body{margin:0!important;padding:0!important;background:#fff!important;direction:rtl!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:${fontFamily||"'Cairo',Tahoma,Arial,sans-serif"}!important;color:#18231f}
      @media print{
        html,body{visibility:visible!important}
        #hf-vector-print-root,#hf-vector-print-root *{visibility:visible!important}
        #hf-vector-print-root{display:block!important;position:static!important}
      }
      #hf-vector-print-root{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;direction:rtl!important;background:#fff!important;font-family:${fontFamily||"'Cairo',Tahoma,Arial,sans-serif"}!important}
      #hf-vector-print-root *{font-family:inherit!important}
      .pro-report{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}
      .pro-report-page{width:100%!important;max-width:none!important;min-height:0!important;margin:0!important;padding:0!important;box-shadow:none!important;border:0!important;border-radius:0!important;overflow:visible!important;break-after:page!important;page-break-after:always!important;background:#fff!important}
      .pro-report-page:last-child{break-after:auto!important;page-break-after:auto!important}
      .pro-table-wrap{width:100%!important;max-width:100%!important;overflow:visible!important}
      table.pro-table{width:100%!important;max-width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
      table.pro-table thead{display:table-header-group!important}
      table.pro-table tfoot{display:table-footer-group!important}
      table.pro-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
      table.pro-table th,table.pro-table td{box-sizing:border-box!important;overflow:visible!important;text-overflow:clip!important}
      table.pro-table .name,table.pro-table .hf-col-name{white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important}
      table.pro-table .hf-col-compact{white-space:nowrap!important;word-break:keep-all!important}
      table.pro-table .hf-col-flex,table.pro-table .text-cell,table.pro-table .hf-col-auto{white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
      .student-report-card,.pro-head,.pro-meta,.pro-kpis,.pro-footer{break-inside:avoid!important;page-break-inside:avoid!important}
      .hf-edit-note,.hf-pdf-progress,.hf-pdf-render-stage,#reportPreviewDlg{display:none!important}
    `;
  }
  async function buildVectorHtml(source,orientation){
    if(!source)throw new Error('لا يوجد محتوى PDF');
    try{window.applyAutoFitPdfTables?.(source)}catch(_e){}
    const clone=sanitizeClone(source.cloneNode(true));
    clone.id='hf-vector-print-root';clone.style.transform='none';clone.style.transformOrigin='top left';clone.style.position='static';clone.style.left='auto';clone.style.top='auto';clone.style.boxShadow='none';clone.style.width='100%';clone.style.maxWidth='none';
    clone.querySelectorAll('[data-hf-base-font]').forEach(el=>el.removeAttribute('data-hf-base-font'));
    await inlineImages(clone);
    const css=await collectDocumentCss();
    const fontFamily=source.style.fontFamily||"'Cairo',Tahoma,Arial,sans-serif";
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'\n'+printOverrides(orientation,fontFamily)+'</style></head><body>'+clone.outerHTML+'<script>document.documentElement.dataset.hfReady="1";<\/script></body></html>';
  }

  function persistPrintRecoveryState(){
    try{ if(typeof saveOfflineAuth==='function'&&typeof state!=='undefined'&&state?.user) saveOfflineAuth(state.user); }catch(_e){}
    try{ if(typeof cacheSnapshot==='function') cacheSnapshot(); }catch(_e){}
    try{
      const page=(typeof state!=='undefined'&&state?.page)||'reports';
      localStorage.setItem('halaqati_print_resume_v2407',JSON.stringify({page,at:Date.now()}));
    }catch(_e){}
  }

  async function nativePrintHtml(html,filename,orientation){
    const p=window.Capacitor?.Plugins?.HalaqatiPdf;
    if(!p?.exportPdf)throw new Error('محرك الطباعة المتجهي غير متاح في هذه النسخة');
    persistPrintRecoveryState();
    return await p.exportPdf({html,filename,orientation});
  }

  async function nativeSaveHtmlPdf(html,filename,orientation){
    const p=window.Capacitor?.Plugins?.HalaqatiPdf;
    if(!p?.saveHtmlPdf)throw new Error('محرك Chromium للحفظ المتجهي غير متاح');
    return await p.saveHtmlPdf({html,filename,orientation});
  }

  async function webPrint(html){
    return await new Promise((resolve,reject)=>{
      const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
      let done=false,timer;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);setTimeout(()=>frame.remove(),500);ok?resolve():reject(new Error('تعذر فتح نافذة الطباعة'))};
      frame.onload=()=>{
        try{
          const w=frame.contentWindow,d=w.document;
          const start=()=>{try{w.focus();w.print();setTimeout(()=>finish(true),500)}catch(_e){finish(false)}};
          if(d.fonts?.ready)d.fonts.ready.then(start).catch(start);else start();
        }catch(_e){finish(false)}
      };
      document.body.appendChild(frame);frame.srcdoc=html;timer=setTimeout(()=>finish(false),15000);
    });
  }

  function parseColor(raw){
    const s=String(raw||'').trim().toLowerCase();
    if(!s||s==='transparent')return null;
    let m=s.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)$/);
    if(m){const a=m[4]==null?1:Number(m[4]);if(a<=0.01)return null;return [Number(m[1]),Number(m[2]),Number(m[3]),a]}
    m=s.match(/^#([0-9a-f]{6})$/i);if(m)return [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16),1];
    m=s.match(/^#([0-9a-f]{3})$/i);if(m)return [...m[1]].map(x=>parseInt(x+x,16)).concat(1);
    return null;
  }
  function visibleStyle(style){return style&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0.01}
  function rectInside(rect,root){return rect.width>0.2&&rect.height>0.2&&rect.right>root.left&&rect.bottom>root.top&&rect.left<root.right&&rect.top<root.bottom}
  function relRect(rect,root,scale,ox,oy){return {x:ox+(rect.left-root.left)*scale,y:oy+(rect.top-root.top)*scale,w:rect.width*scale,h:rect.height*scale}}
  function clipped(value,min,max){return Math.max(min,Math.min(max,value))}

  async function ensureDirectVectorFont(pdf){
    if(!cairoPdfFontPromise){
      cairoPdfFontPromise=(async()=>{
        const r=await fetch('./core/fonts/cairo-pdf.ttf',{cache:'force-cache'});
        if(!r.ok)throw new Error('تعذر تحميل خط Cairo المتجهي');
        const bytes=new Uint8Array(await r.arrayBuffer());
        if(bytes.length<100000)throw new Error('ملف خط Cairo المتجهي غير صالح');
        return bytesToBase64(bytes);
      })();
    }
    const b64=await cairoPdfFontPromise,file='Halaqati-Cairo.ttf',family='HalaqatiCairo';
    try{pdf.addFileToVFS(file,b64)}catch(_e){}
    try{pdf.addFont(file,family,'normal')}catch(_e){}
    try{pdf.addFont(file,family,'bold')}catch(_e){}
    pdf.setFont(family,'normal');
    try{pdf.setLanguage('ar-SA')}catch(_e){}
    return family;
  }

  function makeDirectStage(source,orientation){
    const clone=sanitizeClone(source.cloneNode(true));
    // Preserve the source id (especially #reportPreviewPaper) so the off-screen clone
    // keeps the exact preview/Auto-fit CSS. The clone is appended after the live preview,
    // so DOM id lookups continue to resolve the live preview first while CSS styles both.
    if(!clone.id)clone.id='hf-direct-vector-stage';
    clone.dataset.hfDirectVectorStage='1';
    clone.style.transform='none';clone.style.transformOrigin='top left';clone.style.boxShadow='none';clone.style.margin='0';
    clone.style.width=orientation==='portrait'?'792px':'1120px';
    clone.style.maxWidth='none';clone.style.position='fixed';clone.style.left='-20000px';clone.style.top='0';clone.style.zIndex='-2147480000';clone.style.opacity='0.01';clone.style.pointerEvents='none';clone.style.background='#fff';
    clone.querySelectorAll('[data-hf-base-font]').forEach(el=>el.removeAttribute('data-hf-base-font'));
    document.body.appendChild(clone);
    return clone;
  }

  function drawElementBackground(pdf,el,rootRect,scale,ox,oy){
    const style=getComputedStyle(el);if(!visibleStyle(style))return;
    const rect=el.getBoundingClientRect();if(!rectInside(rect,rootRect))return;
    const fill=parseColor(style.backgroundColor);if(!fill)return;
    const rr=relRect(rect,rootRect,scale,ox,oy),radius=Math.max(0,parseFloat(style.borderTopLeftRadius)||0)*scale;
    pdf.setFillColor(fill[0],fill[1],fill[2]);
    if(radius>0.15&&typeof pdf.roundedRect==='function')pdf.roundedRect(rr.x,rr.y,rr.w,rr.h,Math.min(radius,rr.w/2),Math.min(radius,rr.h/2),'F');
    else pdf.rect(rr.x,rr.y,rr.w,rr.h,'F');
  }
  function drawElementBorders(pdf,el,rootRect,scale,ox,oy){
    const style=getComputedStyle(el);if(!visibleStyle(style))return;
    const rect=el.getBoundingClientRect();if(!rectInside(rect,rootRect))return;
    const rr=relRect(rect,rootRect,scale,ox,oy);
    const sides=[['Top','x','y','w'],['Right'],['Bottom'],['Left']];
    const paint=(side,x1,y1,x2,y2)=>{
      const width=parseFloat(style['border'+side+'Width'])||0;if(width<0.4)return;
      const color=parseColor(style['border'+side+'Color']);if(!color)return;
      pdf.setDrawColor(color[0],color[1],color[2]);pdf.setLineWidth(Math.max(0.08,width*scale));pdf.line(x1,y1,x2,y2);
    };
    paint('Top',rr.x,rr.y,rr.x+rr.w,rr.y);
    paint('Right',rr.x+rr.w,rr.y,rr.x+rr.w,rr.y+rr.h);
    paint('Bottom',rr.x,rr.y+rr.h,rr.x+rr.w,rr.y+rr.h);
    paint('Left',rr.x,rr.y,rr.x,rr.y+rr.h);
  }

  async function imgDataUrl(img){
    if(String(img.src||'').startsWith('data:'))return img.src;
    try{
      const c=document.createElement('canvas'),w=Math.max(1,img.naturalWidth||img.width||100),h=Math.max(1,img.naturalHeight||img.height||100);
      c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);return c.toDataURL('image/png');
    }catch(_e){
      try{const r=await fetch(img.currentSrc||img.src,{cache:'force-cache'});if(r.ok)return await toDataUrl(await r.blob())}catch(_e2){}
      return '';
    }
  }

  async function drawImages(pdf,page,rootRect,scale,ox,oy){
    for(const img of [...page.querySelectorAll('img')]){
      const style=getComputedStyle(img),rect=img.getBoundingClientRect();
      if(!visibleStyle(style)||!rectInside(rect,rootRect))continue;
      const data=await imgDataUrl(img);if(!data)continue;
      const rr=relRect(rect,rootRect,scale,ox,oy);
      try{pdf.addImage(data,'PNG',rr.x,rr.y,rr.w,rr.h,undefined,'FAST')}catch(_e){}
    }
  }

  function textTokens(node){
    const raw=String(node.nodeValue||'');const out=[];
    for(const m of raw.matchAll(/\S+/g))out.push({text:m[0],start:m.index,end:m.index+m[0].length});
    return out;
  }
  function drawTextNodes(pdf,page,rootRect,scale,ox,oy,fontFamily){
    const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;if(!p||!String(node.nodeValue||'').trim())return NodeFilter.FILTER_REJECT;
      if(p.closest('script,style,svg,canvas,video,audio'))return NodeFilter.FILTER_REJECT;
      const st=getComputedStyle(p);return visibleStyle(st)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    let node;
    while((node=walker.nextNode())){
      const parent=node.parentElement,style=getComputedStyle(parent),color=parseColor(style.color)||[24,35,31,1];
      const fontPx=Math.max(6,parseFloat(style.fontSize)||11),weight=parseInt(style.fontWeight,10)||400;
      const fontPt=clipped(fontPx*scale*(72/25.4),4,34);
      for(const token of textTokens(node)){
        const range=document.createRange();
        try{range.setStart(node,token.start);range.setEnd(node,token.end)}catch(_e){continue}
        const rect=range.getBoundingClientRect();if(!rectInside(rect,rootRect))continue;
        const arabic=/[\u0590-\u08ff]/.test(token.text);
        const x=arabic?ox+(rect.right-rootRect.left)*scale:ox+(rect.left-rootRect.left)*scale;
        const y=oy+((rect.top-rootRect.top)+Math.min(rect.height*.82,fontPx*1.05))*scale;
        try{
          pdf.setFont(fontFamily,weight>=600?'bold':'normal');pdf.setFontSize(fontPt);pdf.setTextColor(color[0],color[1],color[2]);
          if(typeof pdf.setR2L==='function')pdf.setR2L(arabic);
          pdf.text(token.text,x,y,{align:arabic?'right':'left',baseline:'alphabetic'});
        }catch(_e){}
      }
    }
    try{if(typeof pdf.setR2L==='function')pdf.setR2L(false)}catch(_e){}
  }

  async function buildDirectVectorPdf(source,orientation='landscape',onProgress){
    if(!source)throw new Error('لا يوجد محتوى PDF');
    if(!window.jspdf?.jsPDF){
      if(window.HalaqatiLazy?.ensureLib)await window.HalaqatiLazy.ensureLib('jspdf');
    }
    const JsPdf=window.jspdf?.jsPDF||window.jsPDF;if(!JsPdf)throw new Error('مكتبة PDF المتجهية غير متاحة');
    try{window.applyAutoFitPdfTables?.(source)}catch(_e){}
    const stage=makeDirectStage(source,orientation);
    try{
      try{if(document.fonts?.ready)await document.fonts.ready}catch(_e){}
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const pdf=new JsPdf({orientation,unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true,precision:3});
      const fontFamily=await ensureDirectVectorFont(pdf);
      const pages=[...stage.querySelectorAll(':scope > .pro-report > .pro-report-page,:scope > .pro-report-page')];
      const list=pages.length?pages:[stage];
      for(let i=0;i<list.length;i++){
        if(i)pdf.addPage('a4',orientation);
        const page=list[i],rootRect=page.getBoundingClientRect();
        if(rootRect.width<10||rootRect.height<10)throw new Error('تعذر قياس صفحة التقرير المتجهية');
        const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight(),margin=7;
        const usableW=pageW-margin*2,usableH=pageH-margin*2;
        const scale=Math.min(usableW/rootRect.width,usableH/rootRect.height);
        const drawW=rootRect.width*scale,drawH=rootRect.height*scale;
        const ox=(pageW-drawW)/2,oy=margin;
        pdf.setFillColor(255,255,255);pdf.rect(0,0,pageW,pageH,'F');
        const elements=[page,...page.querySelectorAll('*')].filter(el=>!el.closest?.('.hf-edit-note,.hf-pdf-progress'));
        for(const el of elements)drawElementBackground(pdf,el,rootRect,scale,ox,oy);
        await drawImages(pdf,page,rootRect,scale,ox,oy);
        drawTextNodes(pdf,page,rootRect,scale,ox,oy,fontFamily);
        for(const el of elements)drawElementBorders(pdf,el,rootRect,scale,ox,oy);
        if(onProgress)onProgress(i+1,list.length);
        await new Promise(r=>setTimeout(r,0));
      }
      try{pdf.setProperties({title:'تقرير حلقتي',subject:'تقرير من تطبيق حلقتي',creator:'Halaqati v2.40.8',keywords:'حلقتي, تقرير, القرآن'})}catch(_e){}
      return pdf;
    }finally{stage.remove()}
  }

  async function saveDirectPdf(pdf,filename){
    const name=safeFilename(filename);
    if(isNative()){
      const p=window.Capacitor?.Plugins?.HalaqatiPdf;
      if(!p?.saveBase64Pdf)throw new Error('الحفظ المباشر غير متاح في هذه النسخة');
      const buffer=pdf.output('arraybuffer');
      if(!buffer||buffer.byteLength<512)throw new Error('ملف PDF الناتج غير صالح');
      const base64=bytesToBase64(new Uint8Array(buffer));
      return await p.saveBase64Pdf({filename:name,base64});
    }
    pdf.save(name);return {saved:true,filename:name,engine:'browser-download'};
  }

  async function exportElementDirectPdf(source,filename,orientation='landscape'){
    setSaveButtonState('busy');
    const overlay=progress('تجهيز نفس تنسيق المعاينة داخل Chromium…','حفظ PDF متجهي');
    let completed=false;
    try{
      if(!source)throw new Error('لا يوجد محتوى PDF');
      const html=await buildVectorHtml(source,orientation);
      const span=overlay.querySelector('span');
      if(span)span.textContent='إنشاء صفحات A4 بالخطوط والتقسيم نفسه ثم الحفظ مباشرة…';
      if(isNative()){
        try{
          const res=await nativeSaveHtmlPdf(html,safeFilename(filename),orientation);
          if(res?.saved){
            const kb=Math.max(1,Math.round(Number(res.bytes||0)/1024));
            const pages=Number(res.pages)>0?` · ${res.pages} صفحة`:'';
            notify(`تم حفظ PDF بنجاح في Downloads/Halaqati${pages}${res.bytes?` · ${kb} KB`:''}`);
            completed=true;setSaveButtonState('done');
          }
          return res;
        }catch(error){
          console.warn('Chromium direct vector save failed; switching to compatibility renderer',error);
          if(source.id==='reportPreviewPaper'&&compatibilityRasterExport){
            hideProgress();
            notify('تعذر محرك Chromium المتجهي على هذا الجهاز؛ جاري استخدام وضع التوافق عالي الدقة…','error');
            const fallbackResult=await compatibilityRasterExport();
            if(fallbackResult?.saved===false)throw new Error(fallbackResult.error||'فشل وضع التوافق في حفظ PDF');
            completed=true;setSaveButtonState('done');
            return fallbackResult;
          }
          throw error;
        }
      }
      // Browser/PWA fallback: keep the mature preview renderer rather than the v2.40.7
      // token-by-token jsPDF renderer that could compress a long track into one page.
      if(source.id==='reportPreviewPaper'&&compatibilityRasterExport){
        hideProgress();
        const fallbackResult=await compatibilityRasterExport();
        if(fallbackResult?.saved===false)throw new Error(fallbackResult.error||'فشل وضع التوافق في حفظ PDF');
        completed=true;setSaveButtonState('done');
        return fallbackResult;
      }
      const pdf=await buildDirectVectorPdf(source,orientation);
      const result=await saveDirectPdf(pdf,filename);
      completed=true;setSaveButtonState('done');
      return result;
    }catch(error){
      setSaveButtonState('error');
      throw error;
    }finally{hideProgress();if(!completed&&document.getElementById('hfSavePdf')?.disabled)setSaveButtonState('error')}
  }

  async function printElementVector(source,filename,orientation='landscape'){
    const overlay=progress('تجهيز نسخة مستقلة للطباعة…','فتح الطباعة');
    try{
      const html=await buildVectorHtml(source,orientation);
      const span=overlay.querySelector('span');if(span)span.textContent='فتح شاشة الطباعة بدون استخدام صفحة التطبيق الرئيسية…';
      if(isNative()){
        const res=await nativePrintHtml(html,safeFilename(filename),orientation);
        if(res?.cancelled)notify('تم إلغاء الطباعة');else if(res?.completed)notify('اكتملت مهمة الطباعة');
        return res;
      }
      await webPrint(html);return {opened:true,printDialog:true};
    }finally{hideProgress()}
  }

  function currentReportFileMeta(){
    const paper=document.getElementById('reportPreviewPaper');
    if(!paper||!paper.innerHTML.trim())throw new Error('افتح معاينة التقرير أولاً');
    const orientation=document.getElementById('hfOrientation')?.value||paper.dataset.orientation||'landscape';
    const isStudents=/بيانات الطلاب الأساسية/.test(paper.textContent||'');
    let stamp='';try{stamp=typeof reportFileStamp==='function'?reportFileStamp():''}catch(_e){}
    let date='';try{date=typeof today==='function'?today():new Date().toISOString().slice(0,10)}catch(_e){date=new Date().toISOString().slice(0,10)}
    const name=isStudents?`بيانات_طلاب_حلقتي_${date}.pdf`:`تقرير_حلقتي_${stamp||date}.pdf`;
    return {paper,orientation,name};
  }

  window.downloadReportPdfFromPreview=async function(){
    try{const x=currentReportFileMeta();return await exportElementDirectPdf(x.paper,x.name,x.orientation)}
    catch(e){console.error('Halaqati direct vector PDF error',e);hideProgress();notify('تعذر حفظ PDF: '+(e?.message||e),'error')}
  };
  window.printReportPdfFromPreview=async function(){
    try{const x=currentReportFileMeta();return await printElementVector(x.paper,x.name,x.orientation)}
    catch(e){console.error('Halaqati isolated print error',e);hideProgress();notify('تعذر فتح الطباعة: '+(e?.message||e),'error')}
  };

  window.exportParentReportPdf=async function(id,p='month'){
    try{
      if(!document.getElementById('opsParentReportCard')&&typeof openParentReport==='function')openParentReport(id,p);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const card=document.getElementById('opsParentReportCard');if(!card)throw new Error('تعذر تجهيز تقرير ولي الأمر');
      let date='';try{date=typeof today==='function'?today():new Date().toISOString().slice(0,10)}catch(_e){date=new Date().toISOString().slice(0,10)}
      return await exportElementDirectPdf(card,`halaqati-parent-${id}-${p}-${date}.pdf`,'portrait');
    }catch(e){console.error('Halaqati parent direct vector PDF error',e);hideProgress();notify('تعذر حفظ PDF: '+(e?.message||e),'error')}
  };

  window.HalaqatiPdfUiNotify=notify;
  window.HalaqatiVectorPdf={version:VERSION,buildHtml:buildVectorHtml,buildDirectPdf:buildDirectVectorPdf,exportElement:exportElementDirectPdf,printElement:printElementVector,saveDirectPdf,nativeSaveHtmlPdf};
  console.info('Halaqati PDF engine loaded',VERSION);
})();
