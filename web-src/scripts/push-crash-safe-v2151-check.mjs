import fs from 'node:fs';
function need(cond,msg){if(!cond){console.error('PUSH_CRASH_SAFE_CHECK_FAIL:',msg);process.exit(1)}}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const bridge=fs.readFileSync('src/features/notifications/push-bridge.js','utf8');
const runtime=fs.readFileSync('src/features/notifications/runtime.js','utf8');
const main=fs.readFileSync('src/main.js','utf8');
need(pkg.dependencies?.['@capacitor/push-notifications']==='8.1.2','official Capacitor push dependency missing');
need(bridge.includes("from '@capacitor/push-notifications'"),'official PushNotifications import missing');
need(!bridge.includes('registerPlugin('),'custom push bridge must be absent');
need(runtime.includes("addListener('registration'"),'registration listener missing');
need(runtime.includes("addListener('registrationError'"),'registrationError listener missing');
need(runtime.includes('enablePushNotifications(false).catch'),'background Push initialization must be error-contained');
need(main.includes("version: '2.18.2'"),'main version is not v2.18.2');
console.log('PUSH_CRASH_SAFE_CHECK_PASS');
