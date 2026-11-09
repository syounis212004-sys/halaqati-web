/* Halaqati web 2.88.2 — native RC27.8 / RC34–RC37: hifz AND sard are measured as ONE continuous stretch from the first ayah recited
   in the period to the last ayah reached along the route (Mushaf lines, 15 per page); repeats count once. Recitations without ayah data
   are added by their own pages_count. Placeholder rows (unrated, 0 pages, 0 safety) never count towards quality averages. */
(function(){
  'use strict';
  const NAS='reverse_surahs_forward_ayahs';
  const pos=(s,a,route)=>((route===NAS?200-s:s)*1000)+a;
  const num=v=>{const n=Number(v);return isFinite(n)?n:0};
  const hasAyahs=r=>r&&r.start_surah&&r.start_ayah&&r.end_surah&&r.end_ayah;
  function lineCount(from,to,route){
    const layout=typeof smartPlanQuranLayout==='function'?smartPlanQuranLayout():null;
    if(!layout||typeof smartPlanAyahLineKeys!=='function'||typeof ayahCounts==='undefined')return null;
    const keys=new Set,step=route===NAS?-1:1;
    for(let s=from.s;step<0?s>=to.s:s<=to.s;s+=step){
      const a0=s===from.s?from.a:1,a1=s===to.s?to.a:ayahCounts[s-1];
      for(let a=a0;a<=a1;a++)smartPlanAyahLineKeys(s,a,layout).forEach(k=>keys.add(k));
    }
    return keys.size;
  }
  /** rows: recitation_entries-like objects. Returns pages (null counter ⇒ plain pages_count sum, like the native fallback). */
  function pages(rows,route){
    route=route||NAS;rows=rows||[];
    const ayah=rows.filter(hasAyahs),loose=rows.filter(r=>!hasAyahs(r)).reduce((x,r)=>x+Math.max(0,num(r.pages_count)),0),sum=rows.reduce((x,r)=>x+Math.max(0,num(r.pages_count)),0);
    if(!ayah.length)return loose;
    let base=null,end=null;
    for(const r of ayah){
      const s={s:+r.start_surah,a:+r.start_ayah},e={s:+r.end_surah,a:+r.end_ayah};
      if(!base||pos(s.s,s.a,route)<pos(base.s,base.a,route))base=s;
      if(!end||pos(e.s,e.a,route)>pos(end.s,end.a,route))end=e;
    }
    const lines=lineCount(base,end,route);
    return lines==null?sum:lines/15+loose;
  }
  const isPlaceholder=r=>{
    const ev=String(r&&r.evaluation||'').trim().toLowerCase(),unrated=!ev||ev==='not_rated'||ev==='null';
    const noSafety=!(num(r&&r.safety_percentage)>0),noPages=!(num(r&&r.pages_count)>0);
    return unrated&&noSafety&&noPages;
  };
  window.HalaqatiSpan={pages,isPlaceholder,lineCount};
})();
