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
const students = read('src/features/students/runtime.js');
const legacy = read('src/legacy/app.js');
const index = read('index.html');
const migration = read('supabase/migrations/20260831_v217_smart_plan_categories_admin_delete.sql');

must(pkg.version === '2.18.2', 'package version must be 2.18.2');
must(core.includes("APP_VERSION_NAME='2.18.2'") && core.includes('APP_VERSION_CODE=21802'), 'app version constants are incorrect');
must(main.includes("version: '2.18.2'"), 'ready event must expose v2.18.0');
must(engine.includes("scope_type: ['student', 'category', 'halaqa']"), 'category scope support is missing from engine');
must(engine.includes('memorization_line_keys') && engine.includes('completedLineKeys'), 'QCF line-based plan tracking is missing');
must(engine.includes('reachesReverseBoundary'), 'reverse-direction milestone protection is missing');
must(runtime.includes('buildReverseHifzRange') && runtime.includes('reverse_surahs_forward_ayahs'), 'reverse-surah hifz route is missing');
must(runtime.includes('smartPlanSuggestedStart') && runtime.includes("minimum_evaluation:'good'") && runtime.includes('last_accepted_recitation'), 'automatic next memorisation cursor is missing');
must(runtime.includes('spCategory') && runtime.includes("scope==='category'"), 'category smart-plan UI is missing');
must(runtime.includes('student_ranges') && runtime.includes('materializeSmartPlan'), 'per-student group-plan ranges are missing');
must(runtime.includes('SMART_PLAN_DB_COLUMNS') && runtime.includes('SMART_PLAN_DB_COLUMNS.has(key)'), 'smart plan DB payload whitelist is missing');
must(runtime.includes('normalizeSmartPlanRequestedPages') && runtime.includes('Math.ceil(n-1e-9)'), 'automatic upward page-target rounding is missing');
must(index.includes('id="spHifzTargetPages"') && index.includes('step="any"') && !index.includes('min="0.07" max="604" step="0.1"'), 'smart-plan page input still has invalid decimal step constraints');
must(runtime.includes('addSmartPlanAyahRow') && runtime.includes('ayahSegments'), 'daily smart assignment must prefill exact ayahs');
must(sessions.includes('qcf_line_keys') && sessions.includes('halaqatiQcfLineKeysForRecitation'), 'recitation QCF line metadata is missing');
must(!index.includes('id="stPhone"') && !index.includes('id="stTarget"'), 'removed student phone/weekly hifz fields returned');
must(index.includes('مسار الحفظ العام — حفظ + سرد') && index.includes('مسار التثبيت — للطلاب الخاتمين'), 'student track semantics are incorrect');
must(legacy.includes('deleteUserPermanent') && legacy.includes("db.rpc('admin_delete_account'"), 'permanent account deletion UI/RPC is missing');
for (const fragment of [
  'add column if not exists category_id uuid',
  "scope_type in ('student','category','halaqa')",
  'smart_plans_category_active_range_idx',
  'create or replace function public.admin_delete_account',
  'security definer',
  'delete from auth.users',
  'grant execute on function public.admin_delete_account(uuid) to authenticated',
]) must(migration.toLowerCase().includes(fragment.toLowerCase()), `v2.17 migration is missing: ${fragment}`);

// These subsystems were intentionally not modified by v2.17.
const stableHashes = {
  'src/features/notifications/runtime.js': '870ddce53363cf1ca4be8d2569ef1f96b14585fca06ebbf09e44e8e58c2104f5',
  'src/features/notifications/push-bridge.js': '94e1564d45173a0efa59b68688525564ad399498641fa6edb108b944196cd82b',
  'src/features/reports/runtime.js': 'c8b31694396053b3055c77030af31dd1a4f20e27d5960d23ed30954666150d73',
  'src/features/reports/lazy.js': '673c2bb06aca7b195e58b8c1c11e4e80ddab3150fd6571d05f42a5edf63ab2dd',
  'supabase/functions/halaqati-notify/index.ts': '15b4832fce8122fde577394b5a57ec049d4b7ab257cc029f4133678dbad6acc8',
};
for (const [file, expected] of Object.entries(stableHashes)) must(hash(file) === expected, `stable subsystem changed unexpectedly: ${file}`);

console.log('Halaqati v2.18.0 smart plans legacy compatibility checks passed.');
