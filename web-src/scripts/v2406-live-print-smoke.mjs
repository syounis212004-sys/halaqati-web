import fs from 'node:fs';
const vector=fs.readFileSync('src/features/reports/vector-pdf-runtime.js','utf8');
const visibility=vector.match(/@media print\{\s*html,body\{visibility:visible!important\}\s*#hf-vector-print-root,#hf-vector-print-root \*\{visibility:visible!important\}\s*#hf-vector-print-root\{display:block!important;position:static!important\}\s*\}/s)?.[0];
const live=vector.match(/@media print\{\s*#reportExportArea\{display:none!important;visibility:hidden!important\}[\s\S]*?#hf-vector-print-root \*\{visibility:visible!important\}\s*\}/)?.[0];
if(!visibility||!live)throw new Error('v2.40.6 live print CSS could not be extracted');
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:7mm}html,body{margin:0;background:white;font-family:Arial,sans-serif}
@media print{body *{visibility:hidden!important}#reportExportArea,#reportExportArea *{visibility:visible!important}#reportExportArea{position:absolute;inset:0;width:100%}}
${visibility}
${live}
#hf-vector-print-root{padding:20px}#reportExportArea{padding:20px}
</style></head><body>
<section id="reportExportArea"><h1>LEGACY_SHOULD_NOT_PRINT</h1></section>
<main id="hf-vector-print-root"><h1>HALAQATI_V2406_LIVE_PRINT_PASS</h1><p>تقرير حلقتي 1234567890</p></main>
</body></html>`;
process.stdout.write(html);
