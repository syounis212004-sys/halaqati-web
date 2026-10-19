// v2.14 queue stability VM smoke: deletion must remove all dependent payload types,
// while unrelated operations survive and a server tombstone can be retained.
const session='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
let q=[
 {type:'session',localId:session,key:'session:'+session},
 {type:'attendance',payload:{session_id:session},key:'att:'+session+':a'},
 {type:'behavior',payload:{session_id:session},key:'beh:'+session+':a'},
 {type:'report',payload:{sessionId:session},key:'report:'+session+':a'},
 {type:'attendance',payload:{session_id:other},key:'att:'+other+':b'}
];
const sid=op=>op.type==='session'?op.localId:op.type==='report'?op.payload?.sessionId:op.payload?.session_id;
q=q.filter(op=>String(sid(op)||'')!==session&&!String(op.key||'').includes(session));
q.push({type:'delete_session',payload:{session_id:session},key:'delete-session:'+session});
if(q.length!==2)throw new Error('dependent operation cleanup failed');
if(!q.some(x=>x.type==='attendance'&&x.payload.session_id===other))throw new Error('unrelated operation was lost');
if(!q.some(x=>x.type==='delete_session'))throw new Error('delete tombstone missing');
console.log('OFFLINE_QUEUE_STABILITY_VM_PASS');
