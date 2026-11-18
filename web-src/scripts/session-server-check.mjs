/* HalaqatiSessionServer.save against a fake db: a "status" operation for a session the server has never seen
   (a session opened from "today" while offline) must create it instead of failing with "Cannot coerce the result to a single JSON object". */
import fs from 'node:fs';
import vm from 'node:vm';
const win = {}; vm.runInNewContext(fs.readFileSync(new URL('../src/features/sessions/server.js', import.meta.url), 'utf8'), { window: win, crypto: { randomUUID: () => 'proposed-id' } });
const { save } = win.HalaqatiSessionServer; let fails = 0; const note = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };

/* a tiny PostgREST-like fake: rows by id, update().eq().select() returns the matched rows, .single() errors like PostgREST when the count is not 1 */
const make = rows => { const log = [];
  const db = { rpc: async (name, args) => { log.push('rpc:' + name); if (name === 'rc23_get_or_create_session') { const row = { id: args.p_proposed_id, halaqa_id: args.p_halaqa_id, session_date: args.p_session_date, session_type: args.p_session_type, status: 'open', activity_data: {} }; rows.push(row); return { data: [row], error: null } } return { data: null, error: { message: 'unexpected rpc ' + name } } },
    from: table => ({ update: patch => ({ eq: (col, val) => { const hit = rows.filter(r => r[col] === val); hit.forEach(r => Object.assign(r, patch)); log.push('update:' + table);
      const res = { data: hit, error: null }; const chain = { select: () => Object.assign(Promise.resolve(res), { single: () => Promise.resolve(hit.length === 1 ? { data: hit[0], error: null } : { data: null, error: { message: 'Cannot coerce the result to a single JSON object' } }) }) }; return chain } }) }) };
  return { db, log } };

{ const rows = [{ id: 'S1', status: 'open', activity_data: {} }], { db, log } = make(rows);
  const r = await save(db, { intent: 'status', localId: 'S1', obj: { id: 'S1', status: 'closed' } });
  note(r.id === 'S1' && r.status === 'closed' && !log.includes('rpc:rc23_get_or_create_session'), `status on an existing session only updates it (${log.join(',')})`); }
{ const rows = [], { db, log } = make(rows);
  let err = null, r = null; try { r = await save(db, { intent: 'status', localId: 'NEW1', obj: { id: 'NEW1', halaqa_id: 'H1', session_date: '2026-11-18', session_type: 'tasmee', status: 'open', activity_data: { quick_start: true } } }) } catch (e) { err = e }
  note(!err && r && r.id === 'NEW1', `status on a session the server has never seen creates it (error: ${err && err.message}; log: ${log.join(',')})`); }
{ const rows = [], { db } = make(rows);
  const r = await save(db, { intent: 'status', localId: 'NEW2', obj: { id: 'NEW2', halaqa_id: 'H1', session_date: '2026-11-18', session_type: 'tasmee', status: 'closed' } }).catch(e => ({ err: e.message }));
  note(r.status === 'closed', `a new session closed before it was ever uploaded ends closed on the server (${JSON.stringify(r)})`); }
{ const rows = [], { db } = make(rows); const r = await save(db, { intent: 'create', localId: 'NEW3', obj: { id: 'NEW3', halaqa_id: 'H1', session_date: '2026-11-18', session_type: 'tasmee', status: 'open' } });
  note(r.id === 'NEW3' && r.status === 'open', 'create is unchanged'); }
console.log(fails ? fails + ' FAILED' : 'Session server checks: all passed'); process.exit(fails ? 1 : 0);
