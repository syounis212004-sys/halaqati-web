/* Halaqati web 2.88.0 — staff pages ported from the native app (RC42/RC43):
   the matrix recitation log (students × days, Excel/Word export) and the weekly summary. */
(function(){
  'use strict';
  const R=window.RC50;if(!R)return;
  const e=R.e,STAFF=['admin','supervisor','teacher'];
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayS=()=>typeof today==='function'?today():iso(new Date());
  const num2=v=>{const n=Number(v)||0;return Math.abs(n-Math.round(n))<1e-9?String(Math.round(n)):n.toFixed(2).replace(/0$/,'')};
  const ACT={all:['الكل',null],hifz:['حفظ',['new_hifz','hifz']],review:['مراجعة',['review_near','review_far','review']],sard:['سرد',['sard']],tathbit:['تثبيت',['tathbit']]};
  const halaqas=()=>(state.halaqas||[]).filter(h=>h.active!==false);
  const students=hid=>(state.students||[]).filter(s=>s.status==='active'&&(!hid||s.halaqa_id===hid)).slice().sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'ar'));

  async function fetchRange(hid,from,to){
    const f=q=>{q=q.gte('sessions.session_date',from).lte('sessions.session_date',to).neq('sessions.status','cancelled').limit(8000);return hid?q.eq('sessions.halaqa_id',hid):q};
    const [rec,att]=await Promise.all([
      f(db.from('recitation_entries').select('student_id,activity_type,pages_count,evaluation,mistakes,prompts,safety_percentage,sessions!inner(session_date,halaqa_id,status)')),
      f(db.from('attendance_records').select('student_id,status,sessions!inner(session_date,halaqa_id,status)'))]);
    if(rec.error)throw rec.error;if(att.error)throw att.error;
    return {rec:(rec.data||[]).filter(x=>x.sessions),att:(att.data||[]).filter(x=>x.sessions)};
  }
  const halaqaSelect=(cur,fn)=>`<label class="dn-field"><span>الحلقة</span><select onchange="${fn}(this.value)"><option value="">كل الحلقات</option>${halaqas().map(h=>`<option value="${e(h.id)}" ${h.id===cur?'selected':''}>${e(h.name)}</option>`).join('')}</select></label>`;
  const months12=()=>{const out=[],d=new Date();d.setDate(1);for(let i=0;i<12;i++){out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);d.setMonth(d.getMonth()-1)}return out};

  // ================= matrix recitation log =================
  const M=R.mx={halaqa:'',month:todayS().slice(0,7),act:'all'};
  R.page('matrix',{title:'سجل التسميعات',roles:STAFF,render:async()=>{
    const keys=months12();if(!keys.includes(M.month))M.month=keys[0];
    const y=+M.month.slice(0,4),m=+M.month.slice(5,7),from=`${M.month}-01`,to=iso(new Date(y,m,0));
    const d=await fetchRange(M.halaqa,from,to);
    const types=ACT[M.act][1];
    const days=[...new Set([...d.rec,...d.att].map(x=>x.sessions.session_date))].sort();
    const cell={},tot={};
    d.rec.forEach(x=>{if(['test','tilawah'].includes(x.activity_type))return;if(types&&!types.includes(x.activity_type))return;
      const k=x.student_id+'|'+x.sessions.session_date,c=cell[k]=cell[k]||{p:0,q:[]};c.p+=Number(x.pages_count)||0;if(x.safety_percentage!=null)c.q.push(+x.safety_percentage);
      const t=tot[x.student_id]=tot[x.student_id]||{p:0,q:[]};t.p+=Number(x.pages_count)||0;if(x.safety_percentage!=null)t.q.push(+x.safety_percentage)});
    const absent={},present={};
    d.att.forEach(x=>{const k=x.student_id+'|'+x.sessions.session_date;if(x.status==='absent'||x.status==='excused')absent[k]=x.status;if(x.status==='present'||x.status==='late')present[x.student_id]=(present[x.student_id]||0)+1});
    const sts=students(M.halaqa).filter(s=>days.length||true);
    R.cache.mx={days,sts,cell,tot,absent,present};
    const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
    const cls=q=>q==null?'':q>=90?'g':q>=75?'m':'w';
    const head=`<tr><th class="mx-name">الطالب</th>${days.map(dd=>`<th>${e(dd.slice(8))}</th>`).join('')}<th>المجموع</th><th>الجودة</th><th>حضور</th></tr>`;
    const body=sts.map(s=>{const t=tot[s.id]||{p:0,q:[]};
      return `<tr><td class="mx-name">${e(s.full_name)}</td>${days.map(dd=>{const k=s.id+'|'+dd,c=cell[k];
        if(c&&c.p>0)return `<td class="mx-c ${cls(avg(c.q))}">${e(num2(c.p))}</td>`;
        if(absent[k])return `<td class="mx-a">${absent[k]==='excused'?'ع':'غ'}</td>`;return '<td class="mx-e">·</td>'}).join('')}<td class="mx-t">${e(num2(t.p))}</td><td>${avg(t.q)==null?'—':e(num2(avg(t.q)))+'٪'}</td><td>${present[s.id]||0}</td></tr>`}).join('');
    const grand=sts.reduce((a,s)=>a+((tot[s.id]||{}).p||0),0);
    return `<div class="dn-hello">سجل التسميعات · جدول الطلاب × الأيام</div>
      ${R.monthPicker(keys,M.month,'RC50.mxMonth')}
      <div class="dn-two">${halaqaSelect(M.halaqa,'RC50.mxHalaqa')}<label class="dn-field"><span>النشاط</span><select onchange="RC50.mxAct(this.value)">${Object.entries(ACT).map(([k,v])=>`<option value="${k}" ${k===M.act?'selected':''}>${v[0]}</option>`).join('')}</select></label></div>
      <div class="dn-tiles">${R.tile('طالبًا',sts.length)}${R.tile('أيام الجلسات',days.length)}${R.tile('مجموع الصفحات',num2(grand))}</div>
      ${sts.length&&days.length?`<div class="mx-wrap"><table class="mx"><thead>${head}</thead><tbody>${body}</tbody></table></div><p class="dn-muted">الألوان بحسب جودة التسميع: أخضر 90٪ فأكثر، أصفر 75٪ فأكثر. غ غياب · ع بعذر.</p>
      <div class="dn-actions">${R.btn('تصدير Excel','RC50.mxExcel()','tonal')}${R.btn('تصدير Word','RC50.mxWord()','tonal')}</div>`:R.card(R.empty('لا توجد جلسات أو تسميعات في هذا الشهر لهذه الحلقة.'))}`;
  }});
  R.mxMonth=v=>{M.month=v;render()};R.mxHalaqa=v=>{M.halaqa=v;render()};R.mxAct=v=>{M.act=v;render()};
  const sheetRows=()=>{
    const c=R.cache.mx;if(!c)return [];
    const avg=a=>a&&a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:'';
    const rows=[['الطالب',...c.days.map(x=>x.slice(5)),'المجموع','الجودة ٪','أيام الحضور']];
    c.sts.forEach(s=>{const t=c.tot[s.id]||{p:0,q:[]};rows.push([s.full_name,...c.days.map(dd=>{const k=s.id+'|'+dd,x=c.cell[k];return x&&x.p>0?Math.round(x.p*100)/100:(c.absent[k]?(c.absent[k]==='excused'?'ع':'غ'):'')}),Math.round(t.p*100)/100,avg(t.q),c.present[s.id]||0])});
    return rows;
  };
  const fname=ext=>`سجل-التسميعات-${M.month}.${ext}`;
  async function loadXlsx(){
    if(window.XLSX)return;
    await new Promise((res,rej)=>{const s=document.createElement('script');s.src=new URL('vendor/xlsx-0.18.5.min.js',document.baseURI).href;s.onload=res;s.onerror=()=>rej(new Error('تعذر تحميل مكتبة Excel'));document.head.appendChild(s)});
  }
  R.mxExcel=async()=>{
    try{await loadXlsx();const ws=XLSX.utils.aoa_to_sheet(sheetRows()),wb=XLSX.utils.book_new();ws['!cols']=[{wch:28}];ws['!views']=[{rightToLeft:true}];XLSX.utils.book_append_sheet(wb,ws,'سجل التسميعات');wb.Workbook={Views:[{RTL:true}]};XLSX.writeFile(wb,fname('xlsx'))}
    catch(err){R.toast(err.message)}
  };
  R.mxWord=()=>{
    const rows=sheetRows();if(!rows.length)return;
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl"><head><meta charset="utf-8"><style>@page{size:landscape}body{font-family:Cairo,Arial;direction:rtl}table{border-collapse:collapse;width:100%;font-size:10pt}td,th{border:1px solid #888;padding:3px 5px;text-align:center}th{background:#e6efe9}td:first-child{text-align:right}</style></head><body><h2>سجل التسميعات — ${e(R.monthLabel(M.month))}</h2><table>${rows.map((r,i)=>`<tr>${r.map(c=>i===0?`<th>${e(c)}</th>`:`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿',html],{type:'application/msword'}));a.download=fname('doc');document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  };

  // ================= weekly summary =================
  const W=R.wk={halaqa:''};
  R.page('weekly',{title:'الملخص الأسبوعي',roles:STAFF,render:async()=>{
    const to=todayS(),f=new Date(to+'T00:00:00');f.setDate(f.getDate()-6);const from=iso(f);
    const d=await fetchRange(W.halaqa,from,to);
    const sts=students(W.halaqa),by={};
    sts.forEach(s=>by[s.id]={h:0,r:0,s:0,q:[],pres:0,abs:0,sess:0});
    d.rec.forEach(x=>{const o=by[x.student_id];if(!o)return;const p=Number(x.pages_count)||0,t=x.activity_type;
      if(['new_hifz','hifz'].includes(t))o.h+=p;else if(['review_near','review_far','review'].includes(t))o.r+=p;else if(t==='sard')o.s+=p;
      if(x.safety_percentage!=null&&!['test'].includes(t))o.q.push(+x.safety_percentage)});
    d.att.forEach(x=>{const o=by[x.student_id];if(!o)return;o.sess++;if(x.status==='present'||x.status==='late')o.pres++;else if(x.status==='absent')o.abs++});
    const rows=sts.map(s=>({s,o:by[s.id]})),sum=k=>rows.reduce((a,r)=>a+r.o[k],0);
    const q=rows.flatMap(r=>r.o.q),avgQ=q.length?Math.round(q.reduce((a,b)=>a+b,0)/q.length*10)/10:null;
    const top=rows.filter(r=>r.o.h+r.o.s+r.o.r>0).sort((a,b)=>(b.o.h+b.o.s+b.o.r)-(a.o.h+a.o.s+a.o.r)).slice(0,3);
    const quiet=rows.filter(r=>r.o.sess>0&&r.o.h+r.o.s+r.o.r===0).map(r=>r.s.full_name);
    const lines=[`الملخص الأسبوعي (${from} ← ${to})`,`الطلاب: ${sts.length} · حفظ ${num2(sum('h'))} ص · مراجعة ${num2(sum('r'))} ص · سرد ${num2(sum('s'))} ص${avgQ!=null?` · جودة ${num2(avgQ)}٪`:''}`,
      ...(top.length?['الأكثر إنجازًا: '+top.map(r=>`${r.s.full_name} (${num2(r.o.h+r.o.s+r.o.r)} ص)`).join('، ')]:[]),...(quiet.length?['حضروا ولم يسمّعوا: '+quiet.slice(0,8).join('، ')]:[]),'— حلقاتي'];
    R.cache.wkText=lines.join('\n');
    return `<div class="dn-hello">آخر 7 أيام: ${e(from)} ← ${e(to)}</div>${halaqaSelect(W.halaqa,'RC50.wkHalaqa')}
      <div class="dn-tiles">${R.tile('حفظ',num2(sum('h')))}${R.tile('مراجعة',num2(sum('r')))}${R.tile('سرد',num2(sum('s')))}</div>
      <div class="dn-tiles">${R.tile('الطلاب',sts.length)}${R.tile('جودة',avgQ==null?'—':num2(avgQ)+'٪')}${R.tile('غياب',rows.reduce((a,r)=>a+r.o.abs,0))}</div>
      ${top.length?R.card(`<h3>الأكثر إنجازًا</h3>${top.map((r,i)=>`<div class="dn-row"><span class="dn-av m${i+1}">${R.medal(i+1)}</span><div><b>${e(r.s.full_name)}</b><small>${e(num2(r.o.h))} حفظ · ${e(num2(r.o.r))} مراجعة · ${e(num2(r.o.s))} سرد</small></div></div>`).join('')}`):''}
      ${quiet.length?R.card(`<h3>حضروا ولم يسمّعوا</h3><p>${e(quiet.join('، '))}</p>`):''}
      <h3 class="dn-h">تفصيل الطلاب</h3>${rows.map(r=>R.card(`<div class="dn-row between"><div><b>${e(r.s.full_name)}</b><small>حضور ${r.o.pres}/${r.o.sess} · غياب ${r.o.abs}</small></div><div class="dn-wk-n"><b>${e(num2(r.o.h+r.o.r+r.o.s))}</b><small>صفحة</small></div></div>`,'slim')).join('')||R.card(R.empty('لا يوجد طلاب.'))}
      <div class="dn-actions">${R.btn('مشاركة الملخص','RC50.wkShare()','tonal')}</div>`;
  }});
  R.wkHalaqa=v=>{W.halaqa=v;render()};
  R.wkShare=async()=>{const t=R.cache.wkText;if(!t)return;try{if(navigator.share)await navigator.share({text:t});else{await navigator.clipboard.writeText(t);R.toast('نُسخ الملخص')}}catch(_e){}};

  // ---------- navigation ----------
  const prevNav=window.navItems;
  window.navItems=function(){
    const items=prevNav.apply(this,arguments),role=state?.profile?.role;
    if(!STAFF.includes(role))return items;
    const out=items.filter(x=>x[0]!=='matrix'&&x[0]!=='weekly'),i=out.findIndex(x=>x[0]==='settings'),extra=[['matrix','سجل التسميعات'],['weekly','الملخص الأسبوعي']];
    if(i<0)out.push(...extra);else out.splice(i,0,...extra);return out;
  };
})();
