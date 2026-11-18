/* Shared native RC23/RC18.2 contracts; no fabricated success on missing migrations. */
(function () {
  'use strict';
  function confirmed(result) {
    if (result.error) throw new Error(result.error.message || String(result.error));
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row?.id) throw new Error('لم يرجع الخادم بيانات الجلسة؛ تحقق من الصلاحية وتحديث قاعدة البيانات');
    return row;
  }
  async function save(db, op) {
    const s = op.obj || {}, id = op.localId || s.id;
    if (op.intent === 'edit') {
      let row = confirmed(await db.rpc('rc182_update_session_details', {
        p_session_id: id, p_halaqa_id: s.halaqa_id, p_session_date: s.session_date,
        p_session_type: s.session_type || 'tasmee', p_title: s.title || null, p_notes: s.notes || null,
      }));
      if (s.session_type === 'lesson' && s.activity_data) {
        row = confirmed(await db.from('sessions').update({activity_data: {...row.activity_data, ...s.activity_data}}).eq('id', row.id).select().single());
      }
      if(s.status&&s.status!==row.status)row=confirmed(await db.from('sessions').update({status:s.status}).eq('id',row.id).select().single());
      return row;
    }
    if (op.intent === 'status') {
      /* no .single(): zero matched rows is an answer, not an error. A session opened from "today" while offline only exists on the device, so its
         first operation reaches the server as a status change for an id the server has never seen: it is created below instead of failing. */
      const res = await db.from('sessions').update({status:s.status}).eq('id',id).select();
      if (res.error) throw new Error(res.error.message || String(res.error));
      if (res.data?.length) return res.data[0];
    }
    const proposed = id || crypto.randomUUID();
    let row = confirmed(await db.rpc('rc23_get_or_create_session', {
      p_halaqa_id: s.halaqa_id, p_session_date: s.session_date, p_session_type: s.session_type || 'tasmee',
      p_title: s.title || null, p_proposed_id: proposed,
    }));
    // A competing device may already have created this daily session. Its data wins.
    if (row.id === proposed && (s.notes || Object.keys(s.activity_data || {}).length)) {
      row = confirmed(await db.from('sessions').update({notes:s.notes || null, activity_data:{...row.activity_data,...s.activity_data}}).eq('id',row.id).select().single());
    }
    if(s.status&&s.status!=='open'&&row.status!==s.status)row=confirmed(await db.from('sessions').update({status:s.status}).eq('id',row.id).select().single());
    return row;
  }
  async function archive(db, id, archived) {
    return confirmed(await db.rpc('rc182_set_session_archived', {p_session_id:id,p_archived:!!archived}));
  }
  window.HalaqatiSessionServer = {save, archive};
})();
