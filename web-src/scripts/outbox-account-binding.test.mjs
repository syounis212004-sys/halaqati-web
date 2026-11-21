/* Security regression (audit fingerprint offline-outbox-not-bound-to-account-replays-under-next-login). */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const r=p=>fs.readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('phase outbox ops are stamped, owner-checked and allowlisted',()=>{const s=r('features/rc27/phases.js');
 assert.match(s,/const stamp=op=>\(\{\.\.\.op,id:crypto\.randomUUID\(\),at:Date\.now\(\),u:state\.user\?\.id\|\|null\}\)/);
 assert.equal((s.match(/q\.push\(stamp\(op\)\)/g)||[]).length,2,'both enqueue paths stamp the owner');
 assert.doesNotMatch(s,/q\.push\(\{\.\.\.op,id:crypto\.randomUUID\(\),at:Date\.now\(\)\}\)/);
 assert.match(s,/if\(!ownedBy\(op,me\)\)/);assert.match(s,/ALLOW_T\.has\(op\.table\)/);assert.match(s,/ALLOW_R\.has\(op\.name\)/);
 for(const t of ['smart_plans','smart_plan_phases','smart_plan_events','smart_plan_phase_states','smart_plan_phase_templates'])assert.ok(s.includes("'"+t+"'"),t);
 assert.match(s,/OPS_TTL/);assert.doesNotMatch(s,/!o\.dead\|\|true/)});
test('visit queue never replays another account op',()=>{const s=r('features/rc53/runtime.js');assert.match(s,/q\.push\(\{\.\.\.op,u:state\.user\?\.id\|\|null\}\)/);assert.match(s,/op\.u&&op\.u!==state\.user\?\.id/)});
