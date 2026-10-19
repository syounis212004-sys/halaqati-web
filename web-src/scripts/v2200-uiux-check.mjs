import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const core=read('src/core/runtime.js');
const main=read('src/main.js');
const nav=read('src/core/navigation.js');
const ops=read('src/features/operations/runtime.js');
const css=read('src/styles/uiux-pro-max.css');
const html=read('index.html');
const notes=read('V2200_UIUX_PRO_MAX_AR.md');

function need(v,msg){if(!v)throw new Error(msg)}
need(['2.20.0','2.30.0','2.40.0','2.40.1','2.40.2','2.40.4','2.40.6','2.40.8','2.41.1','2.41.2'].includes(pkg.version),'package version must preserve v2.20.0 UI/UX baseline');
need(core.includes(`APP_VERSION_NAME='${pkg.version}'`)&&core.includes(pkg.version==='2.41.2'?'APP_VERSION_CODE=24102':pkg.version==='2.41.1'?'APP_VERSION_CODE=24101':['2.40.8','2.41.1','2.41.2'].includes(pkg.version)?'APP_VERSION_CODE=24008':pkg.version==='2.40.6'?'APP_VERSION_CODE=24006':pkg.version==='2.40.4'?'APP_VERSION_CODE=24004':pkg.version==='2.40.2'?'APP_VERSION_CODE=24002':pkg.version==='2.40.1'?'APP_VERSION_CODE=24001':pkg.version==='2.40.0'?'APP_VERSION_CODE=24000':pkg.version==='2.30.0'?'APP_VERSION_CODE=23000':'APP_VERSION_CODE=22000'),'runtime version/code mismatch');
need(main.includes("import './styles/uiux-pro-max.css'"),'UI/UX Pro Max stylesheet is not imported');
need(main.includes(`version: '${pkg.version}'`),'ready event version mismatch');

// Accessible navigation and mobile-first structure.
need(html.includes('id="mobileNav"')&&html.includes('aria-label="التنقل الرئيسي"'),'mobile navigation container missing');
need(html.includes('aria-label="فتح القائمة"'),'menu aria label missing');
need(html.includes('aria-label="إغلاق القائمة"'),'drawer close control missing');
need(nav.includes('function navSvg(')&&nav.includes('function buildMobileNav('),'SVG/mobile navigation runtime missing');
need(nav.includes('aria-current="page"'),'active navigation semantics missing');
need(nav.includes("['home','الرئيسية'],['sessions','الجلسات'],['students','الطلاب'],['plans','الخطط'],['more','المزيد']"),'manager mobile navigation priorities changed unexpectedly');

// Core UX rules from the approved design layer.
need(css.includes('UI/UX Pro Max v2.13.0 design layer'),'design layer marker missing');
need(css.includes(':focus-visible'),'visible keyboard focus missing');
need(css.includes('min-height:44px')||css.includes('min-height:48px'),'touch target rule missing');
need(css.includes('.mobile-nav{'),'mobile bottom navigation styling missing');
need(css.includes('@media (prefers-reduced-motion:reduce)'),'reduced motion support missing');
need(css.includes('env(safe-area-inset-bottom')||css.includes('safe-area-inset-bottom'),'safe area handling missing');
need(css.includes('.ops-quick-shell'),'quick memorization UX layer missing');
need(css.includes('.dialog')||css.includes('dialog'),'dialog/bottom-sheet UX rules missing');
need(css.includes('body.dark'),'dark mode compatibility missing');

// Preserve functional behavior and last fixes.
need(ops.includes('opsQuickPlanBundle(st,today())'),'quick memorization must keep Smart Plan assignment source');
need(ops.includes("opsQuickChooseAbsence('excused')")&&ops.includes("opsQuickChooseAbsence('absent')"),'absence detail flow missing');
need(ops.includes('aria-live="polite"'),'quick status live-region missing');
need(!Object.keys(pkg.dependencies||{}).some(x=>/icon|bootstrap|tailwind|material|chakra|mantine/i.test(x)),'new UI/icon framework dependency is not allowed');
need(notes.includes('بدون Framework أو مكتبة أيقونات أو dependency جديدة'),'release note does not document dependency policy');

console.log('v2.20.0 UI/UX Pro Max baseline checks passed ✅');
