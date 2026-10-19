import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const apkArg = process.argv[2];
if (!apkArg) {
  console.error('Usage: node scripts/make-update-publish.mjs <signed-apk>');
  process.exit(1);
}

const apkPath = path.resolve(cwd, apkArg);
if (!fs.existsSync(apkPath) || fs.statSync(apkPath).size === 0) {
  console.error(`Signed APK not found or empty: ${apkPath}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
const versionName = String(pkg.version || '1.0.0');
const [major=0, minor=0, patch=0] = versionName.split('.').map(x => Number.parseInt(x, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

const outDir = path.join(cwd, 'update-publish');
fs.mkdirSync(outDir, { recursive: true });

const latestApk = path.join(outDir, 'Halaqati-latest.apk');
fs.copyFileSync(apkPath, latestApk);

const apkUrl = 'https://syounis212004-sys.github.io/halaqati-web/Halaqati-latest.apk';
const manifest = {
  versionName,
  versionCode,
  apkUrl,
  mandatory: false,
  notes: [
    'Smart Plan V5: تقييم نسبي عادل؛ الخطأ = 1 والنقرة = 0.25، وجيد فأعلى يُحتسب تقدماً، وإعادة فقط توقف المسار.',
    'الحد الأدنى اليومي للحفظ لا يسقط بسبب التقدم؛ الزيادة تُحسب في الإنجاز لكن يبقى واجب اليوم التالي.',
    'بطاقة خطة أوضح: المطلوب والمنجز والمتبقي والتقدم، آخر تسميع بالأخطاء والنقرات، المقرر القادم، وشرح سبب المقرر.',
    'إضافة مسار سرد وتثبيت باتجاهين: الناس ← البقرة أو البقرة → الناس، مع يوم سرد أسبوعي وأسبوع سرد مكثف.',
    'إضافة جلسة تربوية/تفاعلية للقصة والتوعية والمسابقات وقيمة الأسبوع، مع أسئلة ودرجات مشاركة منفصلة عن نقاط القرآن.',
    'واجهة ولي الأمر تعرض الخطة وآخر تسميع والمقرر القادم وآخر لقاء تربوي بصورة مختصرة وسهلة.'
  ],

  publishedAt: new Date().toISOString()
};

fs.writeFileSync(
  path.join(outDir, 'version.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
);

console.log(`Update package prepared for v${versionName} (${versionCode})`);
console.log(`APK: ${latestApk}`);
console.log(`Manifest: ${path.join(outDir, 'version.json')}`);
