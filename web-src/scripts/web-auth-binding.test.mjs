/* Security regression (audit fingerprint auth-web-oauth-implicit-no-state-login-fixation). */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const r=p=>fs.readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const fn=r('core/runtime.js').match(/function halaqatiStripUnboundOAuthHash\(\)\{[^\n]*\}/)[0];
function run(hash,pendingAt){const ss={halaqati_web_oauth_pending:pendingAt==null?null:String(pendingAt)};let replaced=null;
 const ctx={location:{hash,pathname:'/app/',search:'?a=1'},history:{replaceState:(a,b,u)=>{replaced=u}},sessionStorage:{getItem:k=>ss[k]??null,removeItem:k=>{ss[k]=null}},Date,Number};vm.createContext(ctx);vm.runInContext(fn+';this.r=halaqatiStripUnboundOAuthHash()',ctx);return {stripped:ctx.r,replaced}}
test('an uninitiated implicit OAuth hash is stripped before supabase-js can consume it',()=>{const x=run('#access_token=A&refresh_token=B&token_type=bearer',null);assert.equal(x.stripped,true);assert.equal(x.replaced,'/app/?a=1')});
test('a hash for a sign-in started in this tab within 15 minutes is kept (and the flag is single-use)',()=>{assert.equal(run('#access_token=A&refresh_token=B',Date.now()-1000).stripped,false);assert.equal(run('#access_token=A',Date.now()-20*60*1000).stripped,true)});
test('recovery and confirmation links (type=) and plain hashes are untouched',()=>{assert.equal(run('#access_token=A&type=recovery',null).stripped,false);assert.equal(run('#type=signup&access_token=A',null).stripped,false);assert.equal(run('#/page',null).stripped,false);assert.equal(run('',null).stripped,false)});
test('the strip runs before createClient, the flag is set before signInWithOAuth, and startup re-prepares storage on an owner switch',()=>{const c=r('core/runtime.js');assert.ok(c.indexOf('halaqatiStripUnboundOAuthHash();')<c.indexOf('window.supabase.createClient('));
 {const a=r('features/auth/runtime.js'),w=a.indexOf("setItem('halaqati_web_oauth_pending'");assert.ok(w>0&&w<a.lastIndexOf('db.auth.signInWithOAuth'),'web flag is set right before the web signInWithOAuth call')};
 const s=r('core/startup.js');assert.match(s,/prev&&prev!==session\.user\.id/);assert.match(s,/prepareOfflineStorageForUser\(session\.user\.id\)/)});
test('a discarded OAuth return is announced to the user (not a silent failed login) and nothing else sets the notice',()=>{
 const run2=(hash,pendingAt)=>{const ss={halaqati_web_oauth_pending:pendingAt==null?null:String(pendingAt)};const ctx={location:{hash,pathname:'/',search:''},history:{replaceState(){}},sessionStorage:{getItem:k=>ss[k]??null,removeItem(){}},Date,Number};vm.createContext(ctx);vm.runInContext(fn+';halaqatiStripUnboundOAuthHash()',ctx);return ctx.__halaqatiOAuthRejected===true};
 assert.equal(run2('#access_token=A',null),true);assert.equal(run2('#access_token=A',Date.now()),false);assert.equal(run2('#access_token=A&type=recovery',null),false);
 assert.match(r('core/startup.js'),/__halaqatiOAuthRejected&&!state\.user/)});
