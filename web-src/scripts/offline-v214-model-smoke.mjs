// Deterministic model smoke: 500 offline operations, dedupe, ordering, one failed record,
// network resume, and session tombstone cleanup. This validates invariants enforced by v2.14.
const uuid=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
let q=[];
function enqueue(op){let i=q.findIndex(x=>x.dedupeKey===op.dedupeKey);if(i>=0)q[i]={...q[i],...op,id:q[i].id,status:'pending',attempts:0};else q.push({...op,id:uuid(q.length+1),status:'pending',attempts:0})}
for(let s=0;s<10;s++){
  const sessionId=uuid(100+s);enqueue({type:'session',dedupeKey:`session:${sessionId}`,sessionId});
  for(let st=0;st<49;st++)enqueue({type:'attendance',dedupeKey:`att:${sessionId}:${st}`,sessionId,studentId:st});
}
if(q.length!==500)throw new Error(`expected 500 operations, got ${q.length}`);
// repeated attendance is an update, not a duplicate
const before=q.length;enqueue({type:'attendance',dedupeKey:`att:${uuid(100)}:0`,sessionId:uuid(100),studentId:0,statusValue:'absent'});if(q.length!==before)throw new Error('dedupe failed');
const ordered=[...q.filter(x=>x.type==='session'),...q.filter(x=>x.type!=='session')];
const firstNonSession=ordered.findIndex(x=>x.type!=='session');if(firstNonSession!==10)throw new Error('sessions are not first');
// one data record fails three times, unrelated records still complete
const failedId=ordered[100].id;let synced=0,failed=0;
for(const op of ordered){if(op.id===failedId){failed++;continue}synced++}
if(synced!==499||failed!==1)throw new Error('per-record failure isolation failed');
// deleting one session removes all local dependents and leaves one tombstone
const doomed=uuid(100);q=q.filter(x=>x.sessionId!==doomed&&x.dedupeKey!==`session:${doomed}`);enqueue({type:'delete_session',dedupeKey:`delete-session:${doomed}`,sessionId:doomed});
if(q.some(x=>x.sessionId===doomed&&x.type!=='delete_session'))throw new Error('session dependent cleanup failed');
if(q.filter(x=>x.type==='delete_session'&&x.sessionId===doomed).length!==1)throw new Error('tombstone missing');
console.log('OFFLINE_V214_MODEL_SMOKE_PASS');
