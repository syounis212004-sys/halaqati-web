const CACHE='halaqati-v2.11.0-web-21100';
const CORE=['./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(x=>new Request(x,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('halaqati-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function fresh(req){try{return await fetch(new Request(req,{cache:'no-store'}))}catch(e){const c=await caches.open(CACHE);return (await c.match(req))||(await c.match('./index.html'))||Response.error()}}
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;if(e.request.mode==='navigate'||/\.(?:html|js|json|webmanifest)$/i.test(u.pathname)){e.respondWith(fresh(e.request));return;}e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r})));});
