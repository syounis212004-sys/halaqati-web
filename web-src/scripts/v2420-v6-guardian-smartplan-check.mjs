import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json')),core=read('src/core/runtime.js'),plans=read('src/features/plans/runtime.js'),engine=read('src/features/plans/engine.js'),guardian=read('src/features/guardian/runtime.js'),students=read('src/features/students/runtime.js'),settings=read('src/features/settings/runtime.js'),migration=read('supabase/migrations/20260907_v2420_guardian_rank_context.sql'),main=read('src/main.js'),legacy=read('src/legacy/app.js');
assert.ok(['2.42.0','2.43.0','2.44.0'].includes(pkg.version));
assert.ok(core.includes(`APP_VERSION_NAME='${pkg.version}'`)&&core.includes(pkg.version==='2.44.0'?'APP_VERSION_CODE=24400':pkg.version==='2.43.0'?'APP_VERSION_CODE=24300':'APP_VERSION_CODE=24200'));
assert.ok(core.includes('function computeRecitationV6')&&core.includes("scoring_version:'V6'"));
assert.ok(!core.includes('return {line_count:'),'V6 must not persist a non-schema line_count column');
assert.ok(settings.includes('معيار جودة التسميع V6')&&settings.includes('النقرة = 0.5'));
assert.ok(plans.includes('smartPlanHifzCursorScore')&&plans.includes('furthest')||plans.includes('FURTHEST'));
assert.ok(plans.includes('auto_cursor_repaired')&&plans.includes('beforeCreatedAt:plan.created_at'),'existing auto-start plans need historical-only cursor repair');
assert.ok(!plans.includes('الخطط الذكية v2.19.0'),'old plan UI version label must be removed');
assert.ok(engine.includes('recoveryShare')&&engine.includes('futureRegularDates'),'deficit must be spread across future plan days');
assert.ok(guardian.includes('ملخص المتابعة')&&guardian.includes('تطور الحفظ')&&guardian.includes('guardian_student_dashboard_range'));
assert.ok(guardian.includes('ترتيب الفئة')&&guardian.includes('ترتيب الحلقة'));
assert.ok(migration.includes('track_code is not distinct from v_track')&&migration.includes('category_rank'));
assert.ok(migration.includes("case when m.pages>0 then rank()"),'zero-activity tracks must not receive fake ranks');
assert.ok(main.includes('halaqati-guardian-v242-runtime'));
console.log('v2.42.0 V6 + guardian + smart-plan checks passed ✅');

assert.ok(legacy.includes('guardianRangeDashboards')&&legacy.includes('guardian_student_dashboard_range'),'range ranking must use cohort-safe dashboard RPC')
