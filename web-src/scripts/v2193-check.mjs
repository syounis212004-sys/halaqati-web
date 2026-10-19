import fs from 'node:fs';
const ops=fs.readFileSync('src/features/operations/runtime.js','utf8');
const plans=fs.readFileSync('src/features/plans/runtime.js','utf8');
const css=fs.readFileSync('src/styles/app.css','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
function need(v,msg){if(!v)throw new Error(msg)}
need(['2.19.3','2.20.0','2.30.0','2.40.0','2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version),'package version must be 2.19.3+');
need(ops.includes('opsQuickLoadingOverlay()'),'quick mode must open an immediate loading overlay');
need(ops.includes("opsQuickChooseAbsence('excused')")&&ops.includes("opsQuickChooseAbsence('absent')"),'absence popup choices are missing');
need(ops.includes('opsQuickPlanBundle(st,se.session_date)'),'quick save must use Smart Plan bundle');
need(ops.includes('for(let i=1;i<=21;i++)'),'next scheduled Smart Plan search is missing');
need(!ops.slice(ops.indexOf('Halaqati v2.19.3')).includes('ops-att-three'),'v2.19.3 quick UI must not use 3 permanent attendance buttons');
need(plans.includes('scheduledPages<=0.001'),'zero-page rest-day assignment guard is missing');
need(plans.includes("ayahSegments:[],ayahLabel:''"),'zero-page guard must not fabricate an ayah range');
need(css.includes('ops-counters-compact')&&css.includes('ops-absence-sheet'),'compact one-screen CSS is missing');
console.log('v2.19.3 quick memorization checks passed ✅');
