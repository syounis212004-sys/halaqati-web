import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';

/* Landing page (signed-out visitors only): injects the static markup, SEO tags and the inline gate into index.html.
   The gate source is read from src/landing/gate.js so the browser and node --test run the same function. */
function landingPlugin() {
  const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  return {
    name: 'halaqati-landing',
    async transformIndexHtml(html, ctx) {
      const { landingHtml, faqJsonLd, appJsonLd } = await import('./src/landing/markup.js');
      const { SITE_URL } = await import('./src/landing/content.js');
      let version = '';
      try { version = JSON.parse(read('../version.json')).versionName || ''; } catch (_e) { /* optional */ }
      const gate = read('./src/landing/gate.js').replace('export function', 'function');
      const mainChunk = ctx.bundle && Object.values(ctx.bundle).find((c) => c.type === 'chunk' && /src[\\/]main\.js$/.test(c.facadeModuleId || ''));
      const preload = mainChunk ? `var l=document.createElement('link');l.rel='modulepreload';l.href='./${mainChunk.fileName}';document.head.appendChild(l);` : '';
      let fontPre = '';
      try { const m = /url\(\.\/(fonts\/[^)]+\.woff2)\)/.exec(read('./public/core/cairo.css')); if (m) fontPre = `var f=document.createElement('link');f.rel='preload';f.as='font';f.type='font/woff2';f.crossOrigin='';f.href='./core/${m[1]}';document.head.appendChild(f);`; } catch (_e) { /* optional */ }
      const title = 'حلقاتي - منصة إدارة حلقات تحفيظ القرآن الكريم';
      const desc = 'إدارة ومتابعة حلقات تحفيظ القرآن الكريم: التسميع والخطط والحضور والتقارير ومتابعة أولياء الأمور، على الجوال والحاسوب وبلا إنترنت.';
      const head = `<link rel="canonical" href="${SITE_URL}" />
  <meta property="og:type" content="website" /><meta property="og:locale" content="ar_AR" /><meta property="og:site_name" content="حلقاتي" />
  <meta property="og:title" content="${title}" /><meta property="og:description" content="${desc}" /><meta property="og:url" content="${SITE_URL}" />
  <meta property="og:image" content="${SITE_URL}landing/og.jpg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(appJsonLd(version))}</script>
  <script type="application/ld+json">${JSON.stringify(faqJsonLd())}</script>
  <style>#hlRoot{display:none}html[data-landing] #hlRoot{display:block}html[data-landing] #rc27Splash,html[data-landing] #auth{display:none}</style>
  <script>(function(){try{${gate}
var keys=[];try{for(var i=0;i<localStorage.length;i++)keys.push(localStorage.key(i))}catch(e){}
var on=shouldShowLanding({search:location.search,hash:location.hash,storageKeys:keys,native:!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()),standalone:(window.matchMedia&&['standalone','minimal-ui','fullscreen'].some(function(m){return matchMedia('(display-mode: '+m+')').matches}))||navigator.standalone===true,webdriver:navigator.webdriver===true});
if(on){var d=document.documentElement,t=null;try{t=localStorage.getItem('hl_theme')}catch(e){}
if(!t)t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
d.setAttribute('data-landing','');d.setAttribute('data-hl-theme',t);
var c=document.createElement('link');c.rel='stylesheet';c.href='./landing/landing.css';document.head.appendChild(c);${fontPre}}
else{${preload}}}catch(e){}})();</script>`;
      return html.replace('<!--HL-HEAD-->', head).replace('<!--HL-BODY-->', `<div id="hlRoot">${landingHtml({ version })}</div>`);
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    landingPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{html,js,css,png,svg,webmanifest,woff,woff2,ttf,json}'],
        globIgnores: ['vendor/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.includes('/vendor/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'halaqati-vendor-v2140',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
