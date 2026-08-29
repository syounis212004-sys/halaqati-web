const CACHE='halaqati-v2.10.1-webfix-20260829-2';
const CORE=['./','./index.html','./404.html','./manifest.webmanifest','./report-hotfix.js','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE.map(x=>new Request(x,{cache:'reload'}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('halaqati-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request,fallback){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(new Request(request,{cache:'no-store'}));
    if(response&&response.ok) await cache.put(fallback||request,response.clone());
    return response;
  }catch(_e){
    return (await cache.match(fallback||request)) || (await cache.match('./index.html')) || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request,'./index.html'));
    return;
  }

  const fresh=/\.(?:html|js|json|webmanifest)$/i.test(url.pathname);
  if(fresh){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      if(response&&response.ok) caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
      return response;
    }))
  );
});
