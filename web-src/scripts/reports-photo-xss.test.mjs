/* Security regression: the ranking list in native/reports.js must never put a hostile student photo value into <img src>.
   Loads the real reports.js in a vm with a stubbed browser and renders window.rankingPage() (behaviour, not a regex). */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const rt=fs.readFileSync(new URL('../src/core/runtime.js',import.meta.url),'utf8');
const safe=rt.match(/function safeImgSrc\(v\)\{[^\n]*\}/)[0];
const code=fs.readFileSync(new URL('../src/features/native/reports.js',import.meta.url),'utf8');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(photoUrls){
  const noop=()=>'';
  const NX=new Proxy({h:esc,icon:noop,avatar:n=>`<span class="nx-avatar">${esc(n)}</span>`},{get:(t,k)=>k in t?t[k]:noop});
  const rows=[{student_id:'s1',track:'hifz',full_name:'طالب',pages:1,mistakes:0,prompts:0,points:5}];
  const sb={NX,state:{profile:{role:'admin'},students:[{id:'s1',full_name:'طالب'}],photoUrls,leaderMonthly:rows,leaderDaily:rows,offline:false},
    document:{querySelectorAll:()=>[],getElementById:()=>null,body:{}},navigator:{onLine:true},MutationObserver:class{observe(){}},
    console,Set,Date,Number,String,Math,Array,Object,Map,JSON,Promise,setTimeout,clearTimeout,monthLabel:v=>v,fmt:v=>String(v),toast:noop,today:()=>'2026-11-21',render:noop,addEventListener:noop};
  sb.window=sb;const w=sb;vm.createContext(sb);vm.runInContext(safe+';this.safeImgSrc=safeImgSrc',sb);
  vm.runInContext(code,sb);return String(w.rankingPage());
}
const hostile=['data:image/png;base64,AAAA" onerror="window.__pwn=1" x="','https://a.b/x" onerror="window.__pwn=1','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4='];
test('hostile photo values never reach an <img> attribute in the ranking list',()=>{
  for(const v of hostile){const html=render({s1:v});assert.doesNotMatch(html,/onerror=/,v);assert.doesNotMatch(html,/<img[^>]*src=/,v);assert.match(html,/rc85-ph/,'falls back to the initial')}
});
test('a valid photo is still rendered',()=>{
  const ok='data:image/jpeg;base64,/9j/4AAQ==';const html=render({s1:ok});assert.match(html,new RegExp('<img src="'+ok.replace(/[/+]/g,'\\$&')+'"'));
  assert.match(render({s1:'https://x.supabase.co/a.png?t=1&u=2'}),/src="https:\/\/x\.supabase\.co\/a\.png\?t=1&amp;u=2"/);
});
