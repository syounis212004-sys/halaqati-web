const CACHE_NAME = 'halaqati-pwa-v2.9.0-20260829';

const CORE = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

const REMOTE_STATIC = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap',
  'https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/verses.json'
];

const STATIC_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'raw.githubusercontent.com'
]);

async function safeCache(cache, request) {
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(request, response.clone());
    }
  } catch (_) {}
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE.map(x => safeCache(cache, x)));
    await Promise.allSettled(REMOTE_STATIC.map(x => safeCache(cache, x)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('halaqati-pwa-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Supabase/API/auth traffic must always stay network-backed and is handled by
  // the app's own local queue/cache. Never cache private API responses here.
  if (!sameOrigin && !STATIC_HOSTS.has(url.hostname)) return;

  if (sameOrigin && req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('./index.html');
      const update = fetch(req).then(async res => {
        if (res && res.ok) await cache.put('./index.html', res.clone());
        return res;
      }).catch(() => null);

      // Fast startup: show cached UI immediately, refresh silently in background.
      if (cached) {
        event.waitUntil(update);
        return cached;
      }

      return (await update) || new Response(
        '<!doctype html><meta charset="utf-8"><title>حلقتي</title><div dir="rtl" style="font-family:sans-serif;padding:30px">شغّل التطبيق مرة واحدة أثناء توفر الإنترنت لإكمال تجهيز العمل دون اتصال.</div>',
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    })());
    return;
  }

  // Cache-first for app shell and static libraries/fonts/Quran metadata.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreVary: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        await cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      if (sameOrigin) {
        return (await cache.match('./index.html')) || Response.error();
      }
      throw err;
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
