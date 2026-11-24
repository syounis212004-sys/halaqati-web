// The Smart Plans list card must show today's duty and the last recitation of the ACTIVE Sard phase (like the app),
// not the Hifz ones. Checks the wiring in plans.js and runs NXPhases.sardView against a stubbed phase snapshot.
import fs from 'node:fs';
import vm from 'node:vm';
const phases = fs.readFileSync(new URL('../src/features/native/phases.js', import.meta.url), 'utf8');
const plans = fs.readFileSync(new URL('../src/features/native/plans.js', import.meta.url), 'utf8');
const fail = m => { console.error('FAIL:', m); process.exit(1); };

if (!/const sv=\(!tath&&ph&&ph\.type==='sard'&&window\.NXPhases/.test(plans)) fail('plans.js does not ask the Sard snapshot for an active Sard phase');
if (!/const last=sv\?sv\.last:/.test(plans)) fail('last recitation is not taken from the Sard snapshot');
if (!/const aText=sv\?/.test(plans)) fail("today's duty is not taken from the Sard snapshot");

const start = phases.indexOf('window.NXPhases.sardView=function');
if (start < 0) fail('NXPhases.sardView is missing');
const end = phases.indexOf('\n  };\n', start);
const src = phases.slice(start, end + 5);

function run({ assignment, needsStart = false, scheduledToday = true, last = null }) {
  const win = { NXPhases: {}, RC27PhaseActivities: () => [{ key: 'hifz', lastRecitation: { id: 'hifz-new' } }, { key: 'sard', assignment, needsStart, scheduledToday, lastRecitation: last }], surahs: [] };
  const ctx = {
    window: win, surahs: Array.from({ length: 114 }, (_, i) => `س${i + 1}`),
    T0: () => '2026-11-24', P: () => ({ snapshot: () => ({ ok: 1 }) }),
    endpointOfLine: key => ({ s: 51, a: 45 }),
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return win.NXPhases.sardView({ id: 'p' }, 's1');
}

const a = run({ assignment: { lineKeys: ['518:3'], start: { s: 52, a: 1 }, pages: 5 }, last: { id: 'sard-27-10' } });
if (a.text !== 'من سورة س52 آية 1 إلى سورة س51 آية 45') fail('assignment text: ' + a.text);
if (a.last.id !== 'sard-27-10') fail('last recitation must be the Sard one, got ' + a.last.id);
if (a.pages !== 5 || !a.hasAssignment) fail('assignment flags');
const b = run({ assignment: null, needsStart: true });
if (!b.needsStart || b.text !== '' || b.last !== null) fail('needsStart / no Sard recitation case');
const c = run({ assignment: null, scheduledToday: false });
if (c.scheduledToday !== false || c.hasAssignment) fail('not a duty day case');
console.log('native plan card Sard check passed');
