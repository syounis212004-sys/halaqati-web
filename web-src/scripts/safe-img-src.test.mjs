/* Security regression (audit fingerprint xss-unescaped-data-image-src-avatar-photo-logo): every user-writable image value must pass safeImgSrc before it reaches an innerHTML src="...". */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync(new URL('../src/core/runtime.js',import.meta.url),'utf8');
const fn=src.match(/function safeImgSrc\(v\)\{[^\n]*\}/)[0];const ctx={};vm.createContext(ctx);vm.runInContext(fn+';this.f=safeImgSrc',ctx);const f=ctx.f;
test('accepts strict base64 images and clean https URLs',()=>{assert.equal(f('data:image/jpeg;base64,/9j/4AAQ=='),'data:image/jpeg;base64,/9j/4AAQ==');assert.equal(f('https://x.supabase.co/a.png?t=1&u=2'),'https://x.supabase.co/a.png?t=1&amp;u=2')});
test('rejects attribute breakout and other schemes',()=>{for(const bad of ['data:image/png;base64,x" onerror="window.__x=1','data:image/svg+xml;base64,AAA=','javascript:alert(1)','data:text/html;base64,AAAA','https://a.b/"><script>','https://a.b/x onerror=1','',null,undefined,'//evil'])assert.equal(f(bad),'')});
test('every known image sink wraps its value',()=>{const read=p=>fs.readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
 for(const [p,re] of [['core/runtime.js',/function avatarHtml[^\n]*safeImgSrc\(/],['features/rc86/parity.js',/safe=safeImgSrc\(photo\)/],['features/native/management.js',/const isLogo=v=>!!safeImgSrc\(v\)/],['features/rc53/runtime.js',/safeImgSrc\(p\.avatar_path\)/],['features/native/reports.js',/safeImgSrc\(photoOf\(/],['features/sessions/runtime.js',/safeImgSrc\(state\.photoUrls\[sid\]\)/]])assert.match(read(p),re,p);
 assert.doesNotMatch(read('features/native/management.js'),/src="\$\{(x\.logo_path|F\.logo|LG\.logo)\}"/)});
