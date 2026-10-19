import fs from 'node:fs';
const core=fs.readFileSync('src/core/runtime.js','utf8');
const ses=fs.readFileSync('src/features/sessions/runtime.js','utf8');
const required=[
  'pruneDeletedSessionOfflineData',
  'ensureOfflineSessionQueued',
  'prepareSessionForOfflineWork',
  "prepareSessionForOfflineWork(seId);",
  "await pruneDeletedSessionOfflineData({silent:true})"
];
for(const x of required)if(!core.includes(x)){console.error('missing core guard',x);process.exit(1)}
if(!ses.includes('let sid=sessionIdForOfflineOp(op)')){console.error('session deletion does not remove payload-based queue operations');process.exit(1)}
if(!ses.includes('prepareSessionForOfflineWork(id);')){console.error('opening roster does not snapshot/queue offline session');process.exit(1)}
if(core.includes('تمت استعادة الجلسة المرتبطة بالبيانات المحلية تلقائياً')){console.error('old phantom-session recreation path still exists');process.exit(1)}
console.log('OFFLINE_QUEUE_STABILITY_CHECK_PASS');
