import fs from 'node:fs';
const s=fs.readFileSync('src/features/sessions/runtime.js','utf8');
const fn=s.match(/async function openSessionRoster\(id\)\{[\s\S]*?\n\}/)?.[0]||'';
if(!fn.includes("state.page='sessions';state.sessionView=id")||!fn.includes('prepareSessionForOfflineWork(id)')||!fn.includes('await loadSessionRosterData(id)')||!fn.includes('render()')){
  console.error('HOME_SESSION_OPEN_CHECK_FAIL: openSessionRoster must switch to sessions page before rendering');
  process.exit(1);
}
if(!fn.includes('sessionRosterCachedForOffline(id)')){
  console.error('HOME_SESSION_OPEN_CHECK_FAIL: offline session cache guard is missing');
  process.exit(1);
}
console.log('HOME_SESSION_OPEN_CHECK_PASS');
