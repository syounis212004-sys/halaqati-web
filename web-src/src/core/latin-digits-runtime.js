/* Halaqati v2.40.0 — Latin digits everywhere (0-9). */
(function(){
  'use strict';
  const AR=/[٠-٩۰-۹]/g;
  const MAP={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  const toLatin=v=>String(v??'').replace(AR,d=>MAP[d]||d);
  window.halaqatiLatinDigits=toLatin;
  window.HALAQATI_AR_LOCALE='ar-EG-u-nu-latn';

  function normalizeTextNode(node){
    if(node?.nodeType===3 && AR.test(node.nodeValue||'')){AR.lastIndex=0;node.nodeValue=toLatin(node.nodeValue)}else AR.lastIndex=0;
  }
  function normalizeElement(root){
    if(!root)return;
    if(root.nodeType===3){normalizeTextNode(root);return}
    if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;
    const tag=root.nodeType===1?root.tagName:'';
    if(['SCRIPT','STYLE','NOSCRIPT'].includes(tag))return;
    if(root.nodeType===1){
      for(const attr of ['placeholder','title','aria-label'])if(root.hasAttribute?.(attr)){const v=root.getAttribute(attr);if(AR.test(v||'')){AR.lastIndex=0;root.setAttribute(attr,toLatin(v))}else AR.lastIndex=0}
      if((root instanceof HTMLInputElement||root instanceof HTMLTextAreaElement)&&AR.test(root.value||'')){AR.lastIndex=0;root.value=toLatin(root.value)}else AR.lastIndex=0;
    }
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){const p=n.parentElement?.tagName;return ['SCRIPT','STYLE','NOSCRIPT'].includes(p)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
    let n;while((n=walker.nextNode()))normalizeTextNode(n)
  }
  let scheduled=false,queue=new Set();
  function flush(){scheduled=false;const items=[...queue];queue.clear();items.forEach(normalizeElement)}
  function enqueue(node){if(!node)return;queue.add(node);if(!scheduled){scheduled=true;if(window.requestAnimationFrame)window.requestAnimationFrame(flush);else setTimeout(flush,0)}}
  const observer=new MutationObserver(list=>{for(const m of list){if(m.type==='characterData')enqueue(m.target);else for(const n of m.addedNodes)enqueue(n)}});
  function start(){normalizeElement(document.body);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  document.addEventListener('input',e=>{const el=e.target;if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el?.isContentEditable))return;if(el.isContentEditable){enqueue(el);return}const v=el.value;if(AR.test(v||'')){AR.lastIndex=0;const a=el.selectionStart,b=el.selectionEnd;el.value=toLatin(v);try{el.setSelectionRange(a,b)}catch(_e){}}else AR.lastIndex=0},true);
})();
