import fs from 'node:fs';
const vector=fs.readFileSync('src/features/reports/vector-pdf-runtime.js','utf8');
const block=vector.match(/@media print\{\s*html,body\{visibility:visible!important\}\s*#hf-vector-print-root,#hf-vector-print-root \*\{visibility:visible!important\}\s*#hf-vector-print-root\{display:block!important;position:static!important\}\s*\}/s)?.[0];
if(!block)throw new Error('v2.40.6 print-visibility override could not be extracted from vector runtime');
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:7mm}
html,body{margin:0;background:#fff;font-family:Arial,sans-serif}
/* Reproduce the legacy app print rule that caused the real blank PDF. */
@media print{body *{visibility:hidden!important}#reportExportArea,#reportExportArea *{visibility:visible!important}}
/* Inject the actual override extracted from src/features/reports/vector-pdf-runtime.js. */
${block}
#hf-vector-print-root{padding:18px}.box{border:1px solid #222;padding:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:6px}
</style></head><body><main id="hf-vector-print-root"><div class="box"><h1>HALAQATI_PDF_VISIBILITY_PASS</h1><p>تقرير حلقتي - 1234567890</p><table><tr><th>الطالب</th><th>الحفظ</th></tr><tr><td>محمد سمير أبو يونس</td><td>12.5</td></tr></table></div></main></body></html>`;
process.stdout.write(html);
