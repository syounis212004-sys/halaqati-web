import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function api(){const ctx={window:{},crypto:{randomUUID:()=> 'new-id'}};vm.runInNewContext(fs.readFileSync(new URL('../src/features/sessions/server.js',import.meta.url),'utf8'),ctx);return ctx.window.HalaqatiSessionServer;}
test('atomic create returns the server ID without overwriting an existing daily session',async()=>{
 const calls=[];const db={rpc:async(n,p)=>{calls.push([n,p]);return {data:[{id:'existing',notes:'keep'}]};},from:()=>{throw Error('must not overwrite existing session')}};
 const row=await api().save(db,{localId:'proposed',intent:'create',obj:{id:'proposed',halaqa_id:'h',session_date:'2026-10-19',session_type:'tasmee',title:'different'}});
 assert.equal(row.id,'existing');assert.equal(calls[0][0],'rc23_get_or_create_session');assert.equal(calls[0][1].p_proposed_id,'proposed');
});
test('editing uses native RPC and preserves server activity metadata',async()=>{
 const calls=[];const db={rpc:async(n,p)=>{calls.push([n,p]);return {data:{id:'s',activity_data:{archived:true,other:1}}}}};
 const row=await api().save(db,{intent:'edit',localId:'s',obj:{halaqa_id:'h',session_date:'2026-10-20',session_type:'sard',title:'t',notes:'n'}});
 assert.equal(calls[0][0],'rc182_update_session_details');assert.equal(calls[0][1].p_session_id,'s');assert.equal(row.activity_data.other,1);
});
test('rejected writes and empty confirmations never count as success',async()=>{
 await assert.rejects(()=>api().save({rpc:async()=>({error:{message:'denied'}})},{intent:'create',obj:{}}),/denied/);
 await assert.rejects(()=>api().archive({rpc:async()=>({data:[]})},'s',true),/الخادم/);
});
test('archive uses native contract and returns confirmed metadata',async()=>{
 let args;const row=await api().archive({rpc:async(n,p)=>{args=[n,p];return {data:{id:'s',activity_data:{other:'kept',archived:true}}}}},'s',true);
 assert.equal(args[0],'rc182_set_session_archived');assert.equal(args[1].p_archived,true);assert.equal(row.activity_data.other,'kept');
});
test('closing an unsynced session preserves its pending creation intent',()=>{
 const runtime=fs.readFileSync(new URL('../src/core/runtime.js',import.meta.url),'utf8');
 const source=runtime.slice(runtime.indexOf('function enqueueOffline('),runtime.indexOf('function resolveSessionId('));
 let q=[{type:'session',intent:'create',localId:'s',dedupeKey:'session:s',key:'session:s',obj:{id:'s',title:'new',status:'open'}}];
 const ctx={readOfflineQueue:()=>q,normalizeOfflineOperation:x=>({...x}),writeOfflineQueue:x=>q=x,state:{networkVerified:false},cacheSnapshot:()=>{},captureSyncSessionDependencies:()=>{}};
 vm.runInNewContext(source,ctx);ctx.enqueueOffline({type:'session',intent:'status',localId:'s',dedupeKey:'session:s',key:'session:s',obj:{id:'s',status:'closed'}});
 assert.equal(q[0].intent,'create');assert.equal(q[0].obj.title,'new');assert.equal(q[0].obj.status,'closed');
});
test('created offline session keeps its final closed state after atomic creation',async()=>{
 let patch;const db={rpc:async()=>({data:[{id:'s',status:'open'}]}),from:()=>({update:p=>{patch=p;return {eq:()=>({select:()=>({single:async()=>({data:{id:'s',status:p.status}})})})}}})};
 const row=await api().save(db,{intent:'create',localId:'s',obj:{status:'closed'}});assert.equal(row.status,'closed');assert.equal(patch.status,'closed');
});
test('edits made while an older operation is syncing remain queued',async()=>{
 const runtime=fs.readFileSync(new URL('../src/core/runtime.js',import.meta.url),'utf8');const source=runtime.slice(runtime.indexOf('async function syncOfflineQueue('),runtime.indexOf('function monthlyPointsForStudent('));
 let q=[{id:'op',type:'session',revision:0}];const noop=()=>{};
 const ctx={console,state:{user:{id:'u'},syncing:false,offlineRosterCache:{}},syncVerifiedServerSessions:new Set(),readOfflineQueue:()=>q,writeOfflineQueue:x=>q=x,internetReachable:async()=>true,ensureServerAuthSession:async()=>true,pruneDeletedSessionOfflineData:async()=>{},readSessionMap:()=>({}),offlineOperationPriority:()=>1,applyOfflineOperation:async()=>{q=[{id:'op',type:'session',revision:1}]},updateSyncBadge:noop,captureSyncSessionDependencies:noop,clearSyncRecoverySessions:noop,sessionMapKey:()=>null,toast:noop,cacheSnapshot:noop,renderSyncStatusDialog:noop,syncQueueStats:()=>({failed:0}),setTimeout:noop};
 vm.runInNewContext(source,ctx);await ctx.syncOfflineQueue({refreshAfter:false});assert.equal(q.length,1);assert.equal(q[0].revision,1);
});
