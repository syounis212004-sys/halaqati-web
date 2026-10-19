import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const out=process.env.ARTIFACTS_DIR||'.artifacts';fs.mkdirSync(out,{recursive:true});const failures=[];const errors=[];
for(const width of [360,390,768,1024,1440]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await context.route(/https:\/\//,route=>route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(`${width}: ${e.message}`));
 await page.goto(process.env.BASE_URL||'http://localhost:4173/');await page.waitForFunction(()=>!!window.HalaqatiCertificates);await page.locator('#rc27Splash').evaluate(e=>e.remove()).catch(()=>{});await page.evaluate(()=>document.fonts.ready);
 const login=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));if(login.scroll>width+1)failures.push(`login ${width} overflow ${login.scroll}`);
 if(width===390||width===1440)await page.screenshot({path:`${out}/halaqati-login-${width}.png`,fullPage:true});
 await page.evaluate(()=>{
  state.user={id:'00000000-0000-0000-0000-000000000001'};state.profile={id:state.user.id,role:'admin',full_name:'د. محمد سمير أبو يونس — إدارة الحلقات',active:true,approval_status:'approved'};state.offline=true;state.networkVerified=false;
  state.halaqas=[{id:'00000000-0000-0000-0000-000000000002',name:'حلقة معاوية بن أبي سفيان',active:true,halaqa_type:'regular'}];
  state.students=[{id:'00000000-0000-0000-0000-000000000003',full_name:'محمد عبد الرحمن أبو يونس',status:'active',halaqa_id:state.halaqas[0].id,track_code:'general_hifz',enrollment_date:'2026-01-01'}];
  state.sessions=[{id:'00000000-0000-0000-0000-000000000004',halaqa_id:state.halaqas[0].id,session_date:today(),session_type:'tasmee',status:'open',title:'جلسة اليوم',activity_data:{}}];
  document.getElementById('auth').classList.add('hidden');document.getElementById('app').classList.remove('hidden');
 });
 for(const target of ['home','students','sessions','plans','certificates','reports','settings','notifications','quran']){
  try{
   await page.evaluate(p=>go(p),target);await page.waitForTimeout(450);
   const sizes=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,width:innerWidth,title:document.querySelector('#pageTitle').textContent,iframes:document.querySelectorAll('iframe').length}));
   if(sizes.doc>width+1)failures.push(`${width}/${target} overflow ${sizes.doc}`);
   if(sizes.iframes)failures.push(`${width}/${target} iframe`);
   if(['home','certificates','settings'].includes(target)&&(width===390||width===1440))await page.screenshot({path:`${out}/halaqati-${target}-${width}.png`,fullPage:true});
  }catch(e){failures.push(`${width}/${target}: ${e.message}`)}
 }
 await page.evaluate(()=>go('settings'));
 await page.getByRole('button',{name:'طريقة التثبيت',exact:true}).click();assert.ok(await page.locator('#pwaInstallHelp').isVisible());
 await page.evaluate(()=>rc27SetView('desktop'));assert.equal(await page.locator('html').getAttribute('data-view'),'desktop');
 await page.evaluate(()=>rc27SetView('mobile'));assert.equal(await page.locator('html').getAttribute('data-view'),'mobile');
 if(width===390){await page.evaluate(()=>toggleDrawer(true));await page.keyboard.press('Escape');assert.ok(!await page.locator('#drawer').evaluate(e=>e.classList.contains('open')))}
 if(width===390||width===1440){
  for(const role of ['supervisor','teacher','guardian']){
   await page.evaluate(role=>{state.profile.role=role;return go('home')},role);await page.waitForTimeout(450);
   assert.ok(!(await page.locator('#content').innerText()).includes('undefined'));
   if(role==='guardian')assert.equal(await page.locator('#nav button[onclick="go(\'users\')"]').count(),0);
  }
  await page.evaluate(()=>{document.body.classList.add('dark');return go('home')});await page.screenshot({path:`${out}/halaqati-dark-${width}.png`,fullPage:true});
 }
 await context.close();
}
console.log(JSON.stringify({failures,errors},null,2));await browser.close();if(failures.length||errors.length)process.exitCode=1;
