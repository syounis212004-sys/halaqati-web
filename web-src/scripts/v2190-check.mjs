import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const core=read('src/core/runtime.js'),main=read('src/main.js'),ops=read('src/features/operations/runtime.js'),css=read('src/styles/app.css'),sql=read('supabase/migrations/20260904_v2190_operations_suite.sql');
assert.ok(['2.19.0','2.19.1','2.19.2','2.19.3','2.20.0','2.30.0','2.40.0','2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version));
assert.ok(core.includes(`APP_VERSION_NAME='${pkg.version}'`)&&core.includes(pkg.version==='2.41.2'?'APP_VERSION_CODE=24102':pkg.version==='2.41.1'?'APP_VERSION_CODE=24101':['2.40.8','2.41.1','2.41.2'].includes(pkg.version)?'APP_VERSION_CODE=24008':pkg.version==='2.40.6'?'APP_VERSION_CODE=24006':pkg.version==='2.40.4'?'APP_VERSION_CODE=24004':pkg.version==='2.40.2'?'APP_VERSION_CODE=24002':pkg.version==='2.40.1'?'APP_VERSION_CODE=24001':pkg.version==='2.40.0'?'APP_VERSION_CODE=24000':pkg.version==='2.30.0'?'APP_VERSION_CODE=23000':pkg.version==='2.20.0'?'APP_VERSION_CODE=22000':pkg.version==='2.19.3'?'APP_VERSION_CODE=21903':pkg.version==='2.19.2'?'APP_VERSION_CODE=21902':pkg.version==='2.19.1'?'APP_VERSION_CODE=21901':'APP_VERSION_CODE=21900'));
assert.ok(main.includes('halaqati-operations-runtime')&&main.includes(`version: '${pkg.version}'`));
for(const [label,needle] of [
 ['daily dashboard','opsDashboardHome'],['start today session','startTodaySession'],['smart assignment','smartPlanAssignmentLabel'],
 ['early warnings','opsStudentSignals'],['student profile','opsStudentProfileHtml'],['month comparison','opsMonthCompare'],
 ['parent report','openParentReport'],['badges','opsBadges'],['track separation','opsSetProgramTrack'],
 ['cache','OPS_CACHE_TTL'],['skeleton','opsSkeleton'],['undo delete','OPS_DELETE_UNDO_MS'],
 ['backup','exportHalaqatiBackup'],['search','openGlobalSearch'],['quick mode','openQuickMemorization'],
 ['health','opsHealth'],['duplicate guard','opsReportSignature'],['audit','opsAudit']
]) assert.ok(ops.includes(needle),`${label} missing`);
assert.ok(css.includes('v2.19.0 — Operations Suite'));
assert.ok(sql.includes('halaqati_audit_log')&&sql.includes("track_code in ('general_hifz','tathbit')"));
assert.ok(sql.includes('pages_count <= 80')&&sql.includes('enable row level security'));
assert.ok(sql.includes('recitation_entries_no_exact_duplicate_idx')&&sql.includes('nulls not distinct'));
assert.ok(ops.includes("await window.HalaqatiLazy.ensureLib('html2canvas');return window.html2canvas"));
assert.ok(ops.includes("await window.HalaqatiLazy.ensureLib('jspdf');let C=window.jspdf?.jsPDF"));
console.log('HALAQATI_V2190_OPERATIONS_SUITE_CHECK_PASS');
