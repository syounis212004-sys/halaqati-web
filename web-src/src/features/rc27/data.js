(function () {
  'use strict';
  async function all(makeQuery,identity) {
    const user=identity?.(),rows=[];let from=0;
    for(;;){
      const r=await makeQuery().range(from,from+499);
      if(identity&&identity()!==user)throw new Error('تغير الحساب أثناء تحميل البيانات');
      if(r.error)throw new Error(r.error.message||String(r.error));
      const page=r.data||[];if(!page.length)return rows;
      rows.push(...page);from+=page.length;
    }
  }
  async function result(makeQuery,identity){try{return {data:await all(makeQuery,identity),error:null}}catch(error){return {data:null,error}}}
  window.HalaqatiData={all,result};
})();
