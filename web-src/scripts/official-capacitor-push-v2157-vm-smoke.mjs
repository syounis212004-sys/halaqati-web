import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('src/features/notifications/runtime.js','utf8');
const listeners=new Map();
const calls=[];
const push={
  checkPermissions:async()=>({receive:'granted'}),
  requestPermissions:async()=>({receive:'granted'}),
  addListener:async(name,fn)=>{listeners.set(name,fn);return {remove:async()=>{}}},
  createChannel:async()=>({}),
  register:async()=>{setTimeout(()=>listeners.get('registration')?.({value:'OFFICIAL_FCM_TOKEN_ABC12345'}),5)},
};
const ctx={
  console,setTimeout,clearTimeout,setInterval,clearInterval,Promise,Date,Math,JSON,String,Number,Array,Set,Map,Object,
  navigator:{onLine:true},document:{visibilityState:'visible'},
  window:{HalaqatiPushConfigured:true,HalaqatiPushNotifications:push,Capacitor:{getPlatform:()=> 'android'},addEventListener(){}},
  state:{user:{id:'user-1'},profile:{role:'admin'},page:'home',pushState:{},notificationPreferences:{push_enabled:true},students:[],halaqas:[],categories:[],notifications:[],notificationUnread:0},
  APP_VERSION_NAME:'2.17.2',isNativeHalaqati:()=>true,ensureServerAuthSession:async()=>true,
  db:{
    functions:{invoke:async(_n,{body})=>{
      calls.push(body);
      if(body.action==='test_push')return {data:{ok:true,push_configured:true,push_sent:1},error:null};
      return {data:{ok:true,device:{id:'dev-1'}},error:null};
    }},
    from:()=>({
      select(){return this},eq(){return this},neq(){return this},order(){return this},
      limit:async()=>({data:[],error:null}),maybeSingle:async()=>({data:null,error:null}),
      upsert:async()=>({error:null}),update(){return this},is:async()=>({error:null})
    })
  },
  toast(){},render(){},$:()=>null,esc:s=>String(s??''),fmt:s=>String(s??''),go(){},studentProfile(){},cacheSnapshot(){},attAr:{},behAr:{},activeStudents:()=>[],isOwner:()=>true,
};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(code,ctx,{filename:'notifications-runtime.js'});
const ready=await ctx.enablePushNotifications(true);
if(!ready)throw new Error('official registration flow did not complete');
if(!ctx.state.pushState?.registered)throw new Error('device not marked registered');
if(!calls.some(x=>x.action==='register_device'&&x.push_token==='OFFICIAL_FCM_TOKEN_ABC12345'&&!('registration_type' in x)))throw new Error('official FCM token not uploaded correctly');
await ctx.sendTestPush();
if(!calls.some(x=>x.action==='test_push'))throw new Error('test push was not invoked');
console.log('OFFICIAL_CAPACITOR_PUSH_V2157_VM_PASS');
