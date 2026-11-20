(function () {
  'use strict';
  async function all(makeQuery,identity,size=500) {
    const user=identity?.(),rows=[];let from=0;
    for(;;){
      const r=await makeQuery().range(from,from+size-1);
      if(identity&&identity()!==user)throw new Error('تغير الحساب أثناء تحميل البيانات');
      if(r.error)throw new Error(r.error.message||String(r.error));
      const page=r.data||[];
      rows.push(...page);from+=page.length;
      if(page.length<size)return rows; /* a short page is the last one: no extra empty request */
    }
  }
  async function result(makeQuery,identity,size){try{return {data:await all(makeQuery,identity,size),error:null}}catch(error){return {data:null,error}}}
  window.HalaqatiData={all,result};
})();
