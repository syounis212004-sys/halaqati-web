import fs from 'node:fs';
import crypto from 'node:crypto';

const read = file => fs.readFileSync(file, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const pkg = JSON.parse(read('package.json'));
const core = read('src/core/runtime.js');
const main = read('src/main.js');
const engine = read('src/features/plans/engine.js');
const runtime = read('src/features/plans/runtime.js');
const sessions = read('src/features/sessions/runtime.js');
const index = read('index.html');
const migration = read('supabase/migrations/20260830144555_smart_plans_v216.sql');

must(pkg.version === '2.18.2', 'package version must be 2.18.2');
must(core.includes("APP_VERSION_NAME='2.18.2'") && core.includes('APP_VERSION_CODE=21802'), 'app version constants are incorrect');
must(main.includes("version: '2.18.2'"), 'ready event must expose v2.18.0');
must(main.indexOf('halaqati-legacy-runtime') < main.indexOf('halaqati-smart-plans-runtime'), 'smart plans must load after legacy overrides');
must(main.indexOf('halaqati-smart-plans-runtime') < main.indexOf('halaqati-notifications-runtime'), 'stable notification runtime must remain independently loaded');
must(engine.includes("from 'quran-meta/hafs'"), 'exact Hafs Quran metadata is missing');
must(engine.includes('max_daily_multiplier') && engine.includes('extensionNeeded'), 'deficit damping or auto-extension is missing');
must(engine.includes("kind: 'tathbit'") && engine.includes('milestone_approved'), 'quality gate or milestone workflow is missing');
must(runtime.includes("type==='smart_plan_upsert'") && runtime.includes("type==='smart_plan_event'"), 'offline smart-plan operations are missing');
must(runtime.includes('smartPlanBaseCacheSnapshot') && runtime.includes('smartPlanBaseRestoreSnapshot'), 'offline smart-plan snapshot integration is missing');
must(runtime.includes('oneTapSmartPlanPrefill') && runtime.includes('smartPlanSessionWidget'), 'daily session integration is missing');
must(runtime.includes('smartPlanDistributionText') && runtime.includes('هدف الخطة'), 'v2.17.2 whole-page distribution UI is missing');
must(runtime.includes('state.sessionRoster?.recitations') && runtime.includes('halaqatiResolveSmartPlanForRecitation'), 'v2.17.2 live/manual recitation plan tracking is missing');
must(engine.includes('exactDailyQuota') && engine.includes('exactCumulativeQuota') && engine.includes('completedToday'), 'v2.17.2 page quota/completion fix is missing');
must(sessions.includes("inferredPlan?.id") && sessions.includes("inferredPlan?.plan_type"), 'manual recitation auto-link to smart plan is missing');
must(runtime.includes('checkSmartPlanAlerts') && runtime.includes('smart-plan-prep:'), 'delay/home preparation alerts are missing');
must(sessions.includes('smart_plan_id:r.dataset.smartPlanId'), 'recitation-to-plan event link is missing');
must(index.includes('id="smartPlanDlg"') && index.includes('id="spCatchUp"'), 'smart plan form is missing');

for (const fragment of [
  'create table if not exists public.smart_plans',
  'create table if not exists public.smart_plan_events',
  'enable row level security',
  'grant select, insert, update, delete on table public.smart_plans to authenticated',
  'smart_plans_student_active_range_idx',
  'smart_plan_events_milestone_idx',
  '(select auth.uid())',
  'security invoker',
]) must(migration.toLowerCase().includes(fragment.toLowerCase()), `migration is missing: ${fragment}`);
must(!migration.toLowerCase().includes('security definer'), 'smart plan migration must not add SECURITY DEFINER functions');

const stableHashes = {
  'src/features/notifications/runtime.js': '870ddce53363cf1ca4be8d2569ef1f96b14585fca06ebbf09e44e8e58c2104f5',
  'src/features/notifications/push-bridge.js': '94e1564d45173a0efa59b68688525564ad399498641fa6edb108b944196cd82b',
  'src/features/reports/runtime.js': 'c8b31694396053b3055c77030af31dd1a4f20e27d5960d23ed30954666150d73',
  'src/features/reports/lazy.js': '673c2bb06aca7b195e58b8c1c11e4e80ddab3150fd6571d05f42a5edf63ab2dd',
  'src/legacy/app.js': '408940e1e4cf6ef2b7e0935d569afdc8139028bd0b2b25eecfa086a112baa053',
  'supabase/functions/halaqati-notify/index.ts': '15b4832fce8122fde577394b5a57ec049d4b7ab257cc029f4133678dbad6acc8',
};
for (const [file, expected] of Object.entries(stableHashes)) must(hash(file) === expected, `stable v2.15.7 subsystem changed unexpectedly: ${file}`);

console.log('Halaqati v2.17.2 smart plans accuracy fixes passed.');
console.log('Stable PDF and official Push files match v2.15.7 byte-for-byte.');
