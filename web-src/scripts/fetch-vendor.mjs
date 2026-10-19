import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const pub=path.join(root,'public');
const core=path.join(pub,'core');
const vendor=path.join(pub,'vendor');
const fontDir=path.join(core,'fonts');
await fs.mkdir(fontDir,{recursive:true});
await fs.mkdir(vendor,{recursive:true});

const coreOnly=process.argv.includes('--core-only');

async function download(url,out){
  try{
    const st=await fs.stat(out);
    if(st.size>1000) return;
  }catch(_e){}
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
  if(!r.ok) throw new Error(`Download failed ${r.status}: ${url}`);
  const buf=Buffer.from(await r.arrayBuffer());
  await fs.writeFile(out,buf);
  console.log('saved',path.relative(root,out),buf.length);
}

await download('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',path.join(core,'supabase-2.min.js'));

// Searchable PDF text layer: static Arabic TTF embedded into jsPDF.
// This font is INVISIBLE in the final PDF; the visible design remains the exact html2canvas image.
// A static TTF is used because jsPDF needs a Unicode TrueType font for reliable Arabic text extraction/search.
await download('https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf',path.join(fontDir,'amiri-search.ttf'));

// v2.40.8 compatibility jsPDF path keeps Cairo available; primary Android save uses Chromium WebView PDF.
// Use the official Google Fonts variable TrueType file; the browser Cairo WOFF bundle remains unchanged.
await download('https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf',path.join(fontDir,'cairo-pdf.ttf'));

if(!coreOnly){
  const files=[
    ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','xlsx-0.18.5.min.js'],
    ['https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js','html2canvas-1.4.1.min.js'],
    ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js','jspdf-2.5.1.umd.min.js'],
    ['https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js','mammoth-1.8.0.browser.min.js'],
    ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjs-3.11.174.min.js'],
    ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js','pdfjs-3.11.174.worker.min.js'],
    ['https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','tesseract-5.min.js'],
  ];
  for(const [u,n] of files) await download(u,path.join(vendor,n));
}

// Cairo is a boot asset so it is included in the PWA precache.
try{
  const fontCssUrl='https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap';
  const r=await fetch(fontCssUrl,{headers:{'user-agent':'Mozilla/5.0 (Android 14) Chrome/140'}});
  if(!r.ok) throw new Error(`font css ${r.status}`);
  let css=await r.text();
  const urls=[...new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m=>m[1]))];
  for(let i=0;i<urls.length;i++){
    const u=urls[i],ext=(new URL(u).pathname.split('.').pop()||'woff2').split('?')[0],name=`cairo-${i}.${ext}`;
    await download(u,path.join(fontDir,name));
    css=css.split(u).join(`./fonts/${name}`);
  }
  await fs.writeFile(path.join(core,'cairo.css'),css,'utf8');
}catch(e){ console.warn('Cairo bundle warning:',e.message); }

// Compact Quran page/line metadata. v2.17.2 requires this asset so page calculations remain exact offline.
const ayahCounts=[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const prefix=[0];for(const n of ayahCounts)prefix.push(prefix[prefix.length-1]+n);const globalAyah=(s,a)=>prefix[s-1]+a;
try{
  const qr=await fetch('https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/verses.json');
  if(!qr.ok) throw new Error(`Quran metadata ${qr.status}`);
  const verses=await qr.json(),page=new Array(6237).fill(0),first=new Array(6237).fill(0),last=new Array(6237).fill(0);
  for(const [key,v] of Object.entries(verses)){
    const [ss,aa]=key.split(':').map(Number),g=globalAyah(ss,aa),lines=(v.lines||[]).map(x=>Number(x.line)).filter(Boolean);
    page[g]=Number(v.page||0);first[g]=lines.length?Math.min(...lines):0;last[g]=lines.length?Math.max(...lines):first[g];
  }
  if(page.filter(Boolean).length<6200) throw new Error('Quran metadata incomplete');
  await fs.writeFile(path.join(core,'quran-layout.js'),'window.HALAQATI_QURAN_LAYOUT='+JSON.stringify({version:1,source:'QCF4 Hafs · Madinah Mushaf 1441 AH',lineModel:15,page,first,last})+';\n','utf8');
}catch(e){
  const existing=path.join(core,'quran-layout.js');
  try{
    const text=await fs.readFile(existing,'utf8');
    if(!text.includes('QCF4 Hafs')||text.includes('||null'))throw new Error('existing Quran layout is not complete');
    console.warn('Quran metadata download failed; keeping the already bundled complete layout:',e.message);
  }catch(_e){
    throw new Error('Exact offline Quran layout is required for v2.17.2: '+e.message);
  }
}
