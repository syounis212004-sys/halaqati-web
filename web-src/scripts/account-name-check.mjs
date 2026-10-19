import fs from 'node:fs';

const auth=fs.readFileSync('src/features/auth/runtime.js','utf8');
const settings=fs.readFileSync('src/features/settings/runtime.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const core=fs.readFileSync('src/core/runtime.js','utf8');

const must=[
  ['Google detection', auth.includes('function isGoogleAccount')],
  ['first Google prompt', auth.includes('maybePromptGoogleAccountName()')],
  ['profile self update', auth.includes("db.from('profiles').update({full_name:name,preferences:prefs})")],
  ['confirmation preference', auth.includes('account_name_confirmed:true')],
  ['auth metadata sync', auth.includes("db.auth.updateUser({data:{full_name:name,name}}")],
  ['name dialog', html.includes('id="accountNameDlg"') && html.includes('id="accountFullName"')],
  ['pending name edit', html.includes('onclick="openAccountNameDialog(false)"')],
  ['settings name card', settings.includes('<h3>اسم الحساب</h3>') && settings.includes('تعديل الاسم الكامل')],
  ['version name', core.includes("APP_VERSION_NAME='2.44.0'")],
  ['version code', core.includes('APP_VERSION_CODE=24400')]
];
for(const [name,ok] of must){if(!ok){console.error('ACCOUNT_NAME_CHECK_FAIL:',name);process.exit(1)}}
console.log('ACCOUNT_NAME_CHECK_PASS');
