/* Halaqati v2.14.1 — offline-first master data (halaqas, categories, students).
   Loaded as a classic script after core/runtime.js and before students/runtime.js. */
const MASTER_TABLES={
  halaqa:{table:'halaqas',stateKey:'halaqas',label:'الحلقة'},
  category:{table:'student_categories',stateKey:'categories',label:'الفئة'},
  student:{table:'students',stateKey:'students',label:'الطالب'}
};

function masterCfg(entity){return MASTER_TABLES[entity]||null}
function masterRows(entity){let c=masterCfg(entity);return c?(state[c.stateKey]||[]):[]}
function masterFind(entity,id){return masterRows(entity).find(x=>String(x.id)===String(id))||null}
function masterServerStamp(row){if(row&&Object.prototype.hasOwnProperty.call(row,'_server_updated_at'))return row._server_updated_at||null;return row?.updated_at||null}
function masterSameStamp(a,b){if(!a&&!b)return true;if(!a||!b)return false;return String(a)===String(b)}
function masterStripMeta(row){let x={...cloneJson(row||{})};for(let k of Object.keys(x))if(k.startsWith('_'))delete x[k];delete x.updated_at;delete x.created_at;return x}
function masterPayload(entity,row){
  let x=masterStripMeta(row),out={};
  let keys=entity==='halaqa'
    ?['name','description','supervisor_id','location','schedule_text','active']
    :entity==='category'
      ?['halaqa_id','name','min_age','max_age','description','active','created_by']
      :['full_name','user_id','halaqa_id','primary_teacher_id','date_of_birth','phone','guardian_phone','enrollment_date','status','photo_path','notes','target_pages_weekly','target_review_pages_weekly','guardian_email','gender','national_id','program_name','school_grade','address','category_id','track_code','withdrawn_at','withdrawn_by'];
  for(let k of keys)if(Object.prototype.hasOwnProperty.call(x,k))out[k]=x[k];
  return out
}
function masterDecorateLocal(entity,row,{baseUpdatedAt=undefined,syncState='pending'}={}){
  let now=new Date().toISOString(),stamp=baseUpdatedAt===undefined?masterServerStamp(row):baseUpdatedAt;return {...row,_offline:true,_syncState:syncState,_server_updated_at:stamp||null,_local_updated_at:now}
}
function masterPutLocal(entity,row){let rows=masterRows(entity),i=rows.findIndex(x=>String(x.id)===String(row.id));if(i>=0)rows[i]=row;else rows.push(row);return row}
function masterRemoveLocal(entity,id){let c=masterCfg(entity);if(!c)return;state[c.stateKey]=(state[c.stateKey]||[]).filter(x=>String(x.id)!==String(id))}
function masterQueueKey(entity,id){return `master:${entity}:${id}`}
function masterDeleteQueueKey(entity,id){return `master-delete:${entity}:${id}`}
function masterPendingUpsert(entity,id){let key=masterQueueKey(entity,id);return readOfflineQueue().find(x=>x.type==='master_upsert'&&x.dedupeKey===key)||null}
function masterPendingDelete(entity,id){let key=masterDeleteQueueKey(entity,id);return readOfflineQueue().find(x=>x.type==='master_delete'&&x.dedupeKey===key)||null}
function masterRemoveQueueWhere(fn){let q=readOfflineQueue(),left=q.filter(x=>!fn(x));if(left.length!==q.length)writeOfflineQueue(left);return q.length-left.length}
function masterEntityIdFromOp(op){return op?.entityId||op?.payload?.id||null}
function masterMarkSynced(entity,row){if(!row)return null;let clean={...row,_offline:false,_syncState:'synced',_server_updated_at:row.updated_at||null};delete clean._local_updated_at;return masterPutLocal(entity,clean)}
function masterRebaseDependentDelete(entity,id,serverUpdatedAt){if(!serverUpdatedAt)return;let q=readOfflineQueue(),changed=false;q=q.map(op=>{if(op.type==='master_delete'&&op.entity===entity&&String(op.entityId)===String(id)){changed=true;return normalizeOfflineOperation({...op,baseUpdatedAt:serverUpdatedAt,status:'pending',lastError:'',conflict:null})}return op});if(changed)writeOfflineQueue(q)}
function masterConflictError(entity,id,serverRow,reason='changed'){
  let c=masterCfg(entity),e=new Error(reason==='deleted'?`${c?.label||'السجل'} حُذف أو لم يعد متاحاً على الخادم`:`تم تعديل ${c?.label||'السجل'} من جهاز آخر بعد آخر نسخة لديك`);
  e.code='HALAQATI_CONFLICT';e.masterConflict={entity,entityId:id,reason,serverUpdatedAt:serverRow?.updated_at||null,serverRow:serverRow?cloneJson(serverRow):null};return e
}
function isMasterConflictError(e){return String(e?.code||'')==='HALAQATI_CONFLICT'||!!e?.masterConflict}
function masterSyncOperationLabel(op){if(op.type!=='master_upsert'&&op.type!=='master_delete')return '';let c=masterCfg(op.entity);return `${op.type==='master_delete'?'حذف':'حفظ'} ${c?.label||'بيانات'}`}
function masterOfflinePriority(op){
  if(op.type==='master_upsert')return op.entity==='halaqa'?10:op.entity==='category'?20:op.entity==='student'?30:35;
  if(op.type==='master_delete')return op.entity==='student'?85:op.entity==='category'?90:op.entity==='halaqa'?100:95;
  return NaN
}
function masterConflictActionHtml(op){if(!op?.conflict)return '';return `<div class="sync-conflict-actions"><button class="mini" onclick="resolveMasterConflict('${op.id}','local')">اعتماد تعديلي</button><button class="mini" onclick="resolveMasterConflict('${op.id}','server')">اعتماد نسخة الخادم</button></div>`}

function queueMasterUpsert(entity,row,{baseUpdatedAt=undefined,guardianProvided=undefined,guardianId=undefined}={}){
  let id=row?.id||offlineUuid(),existing=masterPendingUpsert(entity,id),base=existing?.baseUpdatedAt;
  if(base===undefined)base=baseUpdatedAt!==undefined?baseUpdatedAt:masterServerStamp(masterFind(entity,id));
  let payload=masterPayload(entity,{...row,id}),gp=guardianProvided===undefined?!!existing?.guardianProvided:!!guardianProvided,gi=guardianProvided===undefined?(existing?.guardianId??null):(guardianId||null);
  return enqueueOffline({type:'master_upsert',entity,entityId:id,key:masterQueueKey(entity,id),dedupeKey:masterQueueKey(entity,id),payload,baseUpdatedAt:base||null,guardianProvided:gp,guardianId:gi,forceLocal:false,conflict:null})
}
function queueMasterDelete(entity,row,{baseUpdatedAt=undefined}={}){
  if(!row?.id)return null;let id=row.id,base=baseUpdatedAt!==undefined?baseUpdatedAt:masterServerStamp(row);
  return enqueueOffline({type:'master_delete',entity,entityId:id,key:masterDeleteQueueKey(entity,id),dedupeKey:masterDeleteQueueKey(entity,id),baseUpdatedAt:base||null,forceLocal:false,conflict:null})
}
function masterKickSync(){updateSyncBadge();if(navigator.onLine)setTimeout(()=>syncOfflineQueue({refreshAfter:false}),30)}

async function saveMasterLocal(entity,id,obj,{guardianProvided=undefined,guardianId=undefined}={}){
  let old=id?masterFind(entity,id):null,stableId=id||offlineUuid(),base=masterServerStamp(old),created=old?.created_at||new Date().toISOString();
  let row=masterDecorateLocal(entity,{...(old||{}),...obj,id:stableId,created_at:created,updated_at:old?.updated_at||created},{baseUpdatedAt:base});
  if(entity==='student'&&guardianProvided!==undefined){row._guardian_id=guardianId||null;let g=(state.guardianAccounts||[]).find(x=>x.id===guardianId);row.guardian_email=g?.email||null;if(g?.phone)row.guardian_phone=g.phone}
  masterPutLocal(entity,row);queueMasterUpsert(entity,row,{baseUpdatedAt:base,guardianProvided,guardianId});cacheSnapshot();masterKickSync();return row
}
async function patchStudentsOfflineFirst(ids,patch){let changed=[];for(let id of ids||[]){let old=masterFind('student',id);if(!old)continue;changed.push(await saveMasterLocal('student',id,{...patch}))}cacheSnapshot();return changed}

function masterDropStudentDependentQueue(studentId){
  let sid=String(studentId);return masterRemoveQueueWhere(op=>{
    if(op.type==='master_delete')return op.entity==='student'&&String(masterEntityIdFromOp(op))===sid;
    if(op.type==='attendance'||op.type==='behavior')return String(op.payload?.student_id||'')===sid;
    if(op.type==='report')return String(op.payload?.studentId||op.payload?.attendance?.student_id||op.payload?.note?.student_id||'')===sid;
    return false
  })
}
function masterDropHalaqaDependentQueue(halaqaId,sessionIds=[]){
  let hid=String(halaqaId),sessionSet=new Set((sessionIds||[]).map(String));return masterRemoveQueueWhere(op=>{
    if(op.type==='master_upsert'||op.type==='master_delete'){
      if(op.entity==='halaqa')return String(masterEntityIdFromOp(op))===hid;
      if(op.entity==='category'||op.entity==='student')return String(op.payload?.halaqa_id||masterFind(op.entity,masterEntityIdFromOp(op))?.halaqa_id||'')===hid
    }
    if(op.type==='session')return String(op.obj?.halaqa_id||'')===hid;
    let ses=sessionIdForOfflineOp(op);return ses&&sessionSet.has(String(ses))
  })
}

async function deleteMasterLocal(entity,id,{cascade=false}={}){
  let row=masterFind(entity,id);if(!row)return false;let pendingCreate=masterPendingUpsert(entity,id),wasNeverSynced=!!pendingCreate&&!pendingCreate.baseUpdatedAt&&!masterServerStamp(row);
  if(entity==='student')masterDropStudentDependentQueue(id);
  if(entity==='category'){
    for(let st of state.students||[])if(String(st.category_id||'')===String(id)){let old=masterServerStamp(st);st.category_id=null;st._offline=true;st._syncState='pending';queueMasterUpsert('student',st,{baseUpdatedAt:masterPendingUpsert('student',st.id)?.baseUpdatedAt??old})}
  }
  if(entity==='halaqa'&&cascade){
    let sessionIds=(state.sessions||[]).filter(s=>String(s.halaqa_id)===String(id)).map(s=>s.id);masterDropHalaqaDependentQueue(id,sessionIds);
    let studentIds=new Set((state.students||[]).filter(s=>String(s.halaqa_id)===String(id)).map(s=>String(s.id)));
    state.students=(state.students||[]).filter(s=>!studentIds.has(String(s.id)));state.categories=(state.categories||[]).filter(c=>String(c.halaqa_id)!==String(id));state.sessions=(state.sessions||[]).filter(s=>String(s.halaqa_id)!==String(id));
    state.goals=(state.goals||[]).filter(x=>!studentIds.has(String(x.student_id)));state.monthly=(state.monthly||[]).filter(x=>!studentIds.has(String(x.student_id)));state.dailySummary=(state.dailySummary||[]).filter(x=>!studentIds.has(String(x.student_id)));state.leaderDaily=(state.leaderDaily||[]).filter(x=>!studentIds.has(String(x.student_id)));state.leaderMonthly=(state.leaderMonthly||[]).filter(x=>!studentIds.has(String(x.student_id)));state.halaqaTeachers=(state.halaqaTeachers||[]).filter(x=>String(x.halaqa_id)!==String(id));state.halaqaSupervisors=(state.halaqaSupervisors||[]).filter(x=>String(x.halaqa_id)!==String(id));
    for(let sid of sessionIds)delete state.offlineRosterCache[sid]
  }
  masterRemoveLocal(entity,id);
  if(wasNeverSynced){masterRemoveQueueWhere(op=>(op.type==='master_upsert'||op.type==='master_delete')&&op.entity===entity&&String(masterEntityIdFromOp(op))===String(id))}
  else queueMasterDelete(entity,row,{baseUpdatedAt:masterServerStamp(row)});
  cacheSnapshot();masterKickSync();return true
}

async function masterFetchServer(entity,id){let c=masterCfg(entity);if(!c)return null;let r=await db.from(c.table).select('*').eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data||null}
async function masterCheckConflict(op){
  if(op.forceLocal||!op.baseUpdatedAt)return null;let current=await masterFetchServer(op.entity,op.entityId);
  if(!current)throw masterConflictError(op.entity,op.entityId,null,'deleted');
  if(!masterSameStamp(current.updated_at,op.baseUpdatedAt))throw masterConflictError(op.entity,op.entityId,current,'changed');
  return current
}
async function applyMasterOfflineOperation(op){
  let c=masterCfg(op.entity);if(!c)throw new Error('Unknown master entity '+op.entity);
  if(op.type==='master_upsert'){
    await masterCheckConflict(op);
    let payload={id:op.entityId,...cloneJson(op.payload||{})};
    let r=await db.from(c.table).upsert(payload,{onConflict:'id'}).select('*').single();if(r.error)throw r.error;let data=r.data;
    if(op.entity==='student'&&op.guardianProvided){let link=await db.rpc('set_student_primary_guardian',{p_student_id:op.entityId,p_guardian_id:op.guardianId||null});if(link.error)throw link.error;let rr=await db.from('students').select('*').eq('id',op.entityId).single();if(rr.error)throw rr.error;data=rr.data}
    masterMarkSynced(op.entity,data);masterRebaseDependentDelete(op.entity,op.entityId,data.updated_at);cacheSnapshot();return data
  }
  if(op.type==='master_delete'){
    let current=await masterFetchServer(op.entity,op.entityId);if(!current)return true;
    if(!op.forceLocal&&op.baseUpdatedAt&&!masterSameStamp(current.updated_at,op.baseUpdatedAt))throw masterConflictError(op.entity,op.entityId,current,'changed');
    if(op.entity==='halaqa'){let r=await db.rpc('delete_halaqa_cascade',{p_halaqa_id:op.entityId});if(r.error)throw r.error}
    else{if(op.entity==='student'&&current.photo_path){try{await db.storage.from('student-photos').remove([current.photo_path])}catch(e){console.warn('student photo cleanup failed',e)}}let r=await db.from(c.table).delete().eq('id',op.entityId);if(r.error)throw r.error}
    return true
  }
}

async function resolveMasterConflict(opId,choice){
  let q=readOfflineQueue(),op=q.find(x=>x.id===opId);if(!op?.conflict)return toast('لا يوجد تعارض لهذه العملية');
  if(choice==='local'){
    q=q.map(x=>x.id===opId?normalizeOfflineOperation({...x,status:'pending',attempts:0,lastError:'',forceLocal:true,baseUpdatedAt:x.conflict?.serverUpdatedAt||x.baseUpdatedAt,conflict:null}):x);writeOfflineQueue(q);toast('سيتم اعتماد تعديلك المحلي');renderSyncStatusDialog();masterKickSync();return
  }
  if(choice==='server'){
    q=q.filter(x=>x.id!==opId);writeOfflineQueue(q);let serverRow=op.conflict?.serverRow||null;
    if(serverRow)masterMarkSynced(op.entity,serverRow);else masterRemoveLocal(op.entity,op.entityId);
    cacheSnapshot();toast('تم اعتماد نسخة الخادم');
    if(navigator.onLine){try{await loadAll(true)}catch(e){}}render();renderSyncStatusDialog();return
  }
}

async function uploadStudentPhotoOnline(studentId,file){
  if(!file)return null;if(!(await serverWriteReady()))return null;
  let ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${studentId}/${Date.now()}.${ext}`;
  let up=await db.storage.from('student-photos').upload(path,file,{upsert:false});if(up.error)throw up.error;return path
}
