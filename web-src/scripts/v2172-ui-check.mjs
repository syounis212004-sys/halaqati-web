import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const core=read('src/core/runtime.js');
const legacy=read('src/legacy/app.js');
const sessions=read('src/features/sessions/runtime.js');
const plans=read('src/features/plans/runtime.js');
const css=read('src/styles/app.css');
const main=read('src/main.js');
const pkg=JSON.parse(read('package.json'));

function must(v,msg){if(!v){console.error('FAIL:',msg);process.exit(1)}}
must(pkg.version==='2.18.2','package version must be 2.18.2');
must(core.includes("APP_VERSION_NAME='2.18.2'")&&core.includes('APP_VERSION_CODE=21802'),'runtime version constants must be 2.18.2 / 21802');
must(main.includes("version: '2.18.2'"),'ready event must expose 2.17.2');
must(legacy.includes('quranSurahsForJuz')&&legacy.includes('ayah-juz-strip')&&legacy.includes('ayah-dual-range'),'offline juz/surah/dual-ayah selector missing');
must(legacy.includes('إذا كانت السورة موزعة على جزئين فستظهر كاملة في كليهما'),'split-surah behavior is not documented in the picker');
must(sessions.includes("syncAyahPickerFromFields(id)"),'saved recitations do not restore the new ayah picker');
must(plans.includes("state.smartPlanTab==='archived'")&&plans.includes('smartArchivedPlansHtml'),'archived plans tab missing');
must(plans.includes('restoreSmartPlan')&&plans.includes('deleteArchivedSmartPlan')&&plans.includes("smart_plan_delete"),'archived restore/permanent delete flow missing');
must(css.includes('.topbar{height:auto;min-height:68px')&&css.includes('.top-title b{display:block'),'mobile header overflow fix missing');
must(css.includes('.ayah-juz-strip')&&css.includes('.ayah-surah-strip')&&css.includes('.ayah-dual-range'),'ayah picker styles missing');

const arr=(name)=>{
  const m=core.match(new RegExp(`const ${name}=([^;]+);`));
  if(!m)throw new Error('Cannot read '+name);
  return Function('return '+m[1])();
};
const counts=arr('ayahCounts'), starts=arr('juzStarts');
const prefix=[0];for(const n of counts)prefix.push(prefix.at(-1)+n);
const globalAyah=(s,a)=>prefix[s-1]+a;
const range=j=>({start:globalAyah(...starts[j-1]),end:j<30?globalAyah(...starts[j])-1:6236});
const surahsForJuz=j=>{const r=range(j),out=[];for(let s=1;s<=114;s++){const a=globalAyah(s,1),b=globalAyah(s,counts[s-1]);if(a<=r.end&&b>=r.start)out.push(s)}return out};
must(surahsForJuz(30).includes(78)&&surahsForJuz(30).includes(114),'juz 30 surah filter is wrong');
must(surahsForJuz(1).includes(2)&&surahsForJuz(2).includes(2)&&surahsForJuz(3).includes(2),'a surah spanning multiple juz must appear in every intersecting juz');
must(counts.length===114&&prefix.at(-1)===6236,'offline Quran counts are incomplete');

console.log('Halaqati v2.17.2 archived plans, mobile header, and offline Quran selector checks passed.');
