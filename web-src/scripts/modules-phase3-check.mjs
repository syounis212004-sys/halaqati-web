import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const files={
  core:'src/core/runtime.js', nav:'src/core/navigation.js', auth:'src/features/auth/runtime.js',
  students:'src/features/students/runtime.js', sessions:'src/features/sessions/runtime.js',
  settings:'src/features/settings/runtime.js', legacy:'src/legacy/app.js', startup:'src/core/startup.js', main:'src/main.js'
};
for(const [k,p] of Object.entries(files)){if(!fs.existsSync(p))throw new Error(`missing ${k}: ${p}`)}
const text=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,read(p)]));
const need=(k,names)=>{for(const n of names){if(!new RegExp(`(?:async\\s+)?function\\s+${n}\\s*\\(`).test(text[k]))throw new Error(`${n} missing from ${k}`)}};
need('nav',['toggleDrawer','navItems','buildNav','go','setFab','fabAction','render']);
need('auth',['hideAuthForms','loginWithGoogle','login','refreshFromServer','boot','logout','loadAll']);
need('students',['activeStudents','filteredStudents','studentsPage','openStudent','studentProfile','halaqasPage']);
need('sessions',['sessionsPage','openSession','openSessionRoster','sessionRosterPage','quickAttendance','calcRecRow','cancelSession']);
need('settings',['settingsPage','getThemePrefs','applySavedTheme','saveThemeSettings','changeMyPassword','checkForAppUpdate']);
const forbidden=['loginWithGoogle','studentsPage','openStudent','sessionsPage','openSessionRoster','settingsPage','getThemePrefs','render','navItems'];
for(const n of forbidden){if(new RegExp(`(?:async\\s+)?function\\s+${n}\\s*\\(`).test(text.legacy))throw new Error(`${n} still lives in legacy/app.js`)}
const order=['coreRuntimeUrl','navigationRuntimeUrl','authRuntimeUrl','studentsRuntimeUrl','sessionsRuntimeUrl','settingsRuntimeUrl','legacyUrl','smartPlansRuntimeUrl','reportsRuntimeUrl','startupRuntimeUrl'];
let pos=-1;for(const token of order){const p=text.main.indexOf(`loadClassicScript(${token}`);if(p<0)throw new Error(`${token} not loaded`);if(p<=pos)throw new Error(`bad module load order near ${token}`);pos=p}
if(!text.startup.includes('db.auth.onAuthStateChange')||!text.startup.includes('ensureQuranLayout'))throw new Error('startup hooks incomplete');
if(!text.core.includes("const APP_VERSION_NAME='2.41.2'"))throw new Error('core version mismatch');
console.log('PHASE3_MODULES_CHECK_PASS');
