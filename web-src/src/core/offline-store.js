const DB_NAME='halaqati-offline-v214';
const DB_VERSION=1;
const OUTBOX='outbox';
const SNAPSHOTS='snapshots';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function reqResult(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB request failed'))})}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'))})}

class HalaqatiOfflineStore {
  constructor(){this.db=null;this.openPromise=null;this.writeChain=Promise.resolve();this.available=true}
  async open(){
    if(this.db)return this.db;
    if(this.openPromise)return this.openPromise;
    if(!('indexedDB' in globalThis)){this.available=false;return null}
    this.openPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(OUTBOX)){
          const s=db.createObjectStore(OUTBOX,{keyPath:'id'});
          s.createIndex('userId','userId',{unique:false});
          s.createIndex('userStatus',['userId','status'],{unique:false});
          s.createIndex('userDedupe',['userId','dedupeKey'],{unique:false});
          s.createIndex('userSession',['userId','sessionId'],{unique:false});
          s.createIndex('userCreated',['userId','createdAt'],{unique:false});
        }
        if(!db.objectStoreNames.contains(SNAPSHOTS))db.createObjectStore(SNAPSHOTS,{keyPath:'userId'});
      };
      req.onsuccess=()=>{this.db=req.result;this.db.onversionchange=()=>{try{this.db.close()}catch{}this.db=null};resolve(this.db)};
      req.onerror=()=>{this.available=false;reject(req.error||new Error('IndexedDB open failed'))};
      req.onblocked=()=>console.warn('Halaqati IndexedDB upgrade blocked');
    }).catch(err=>{console.warn('Offline IndexedDB unavailable, using localStorage fallback',err);this.available=false;return null});
    return this.openPromise;
  }
  _schedule(fn){this.writeChain=this.writeChain.then(fn,fn);return this.writeChain}
  async listOperations(userId){
    const db=await this.open();if(!db||!userId)return [];
    const tx=db.transaction(OUTBOX,'readonly'),done=txDone(tx);
    const idx=tx.objectStore(OUTBOX).index('userId');
    const rows=await reqResult(idx.getAll(IDBKeyRange.only(userId)));
    await done;
    return (rows||[]).sort((a,b)=>Number(a.order||0)-Number(b.order||0)||String(a.createdAt||'').localeCompare(String(b.createdAt||''))).map(clone);
  }
  async replaceOperations(userId,ops){
    if(!userId)return;
    const rows=(ops||[]).map(clone);
    return this._schedule(async()=>{
      const db=await this.open();if(!db)return;
      const readTx=db.transaction(OUTBOX,'readonly'),readDone=txDone(readTx),idx=readTx.objectStore(OUTBOX).index('userId');
      const keys=await reqResult(idx.getAllKeys(IDBKeyRange.only(userId)));await readDone;
      const tx=db.transaction(OUTBOX,'readwrite'),done=txDone(tx),store=tx.objectStore(OUTBOX);
      for(const k of keys||[])store.delete(k);
      for(const row of rows)store.put(row);
      await done;
    })
  }
  async putSnapshot(userId,snapshot){
    if(!userId||!snapshot)return;
    const row={userId,updatedAt:new Date().toISOString(),snapshot:clone(snapshot)};
    return this._schedule(async()=>{const db=await this.open();if(!db)return;const tx=db.transaction(SNAPSHOTS,'readwrite');tx.objectStore(SNAPSHOTS).put(row);await txDone(tx)})
  }
  async getSnapshot(userId){
    const db=await this.open();if(!db||!userId)return null;
    const tx=db.transaction(SNAPSHOTS,'readonly'),done=txDone(tx);const row=await reqResult(tx.objectStore(SNAPSHOTS).get(userId));await done;return row?.snapshot?clone(row.snapshot):null
  }
  async clearUser(userId){
    if(!userId)return;
    return this._schedule(async()=>{
      const db=await this.open();if(!db)return;
      const readTx=db.transaction(OUTBOX,'readonly'),readDone=txDone(readTx),idx=readTx.objectStore(OUTBOX).index('userId');
      const keys=await reqResult(idx.getAllKeys(IDBKeyRange.only(userId)));await readDone;
      const tx=db.transaction([OUTBOX,SNAPSHOTS],'readwrite'),done=txDone(tx),out=tx.objectStore(OUTBOX);
      for(const k of keys||[])out.delete(k);
      tx.objectStore(SNAPSHOTS).delete(userId);
      await done
    })
  }
  async migrateLegacy(userId,{queue=[],snapshot=null}={}){
    if(!userId)return {queue:[],snapshot:null};
    const db=await this.open();if(!db)return {queue:clone(queue||[]),snapshot:clone(snapshot)};
    let existing=await this.listOperations(userId);
    if(!existing.length&&Array.isArray(queue)&&queue.length){await this.replaceOperations(userId,queue);existing=await this.listOperations(userId)}
    let snap=await this.getSnapshot(userId);
    if(!snap&&snapshot){await this.putSnapshot(userId,snapshot);snap=clone(snapshot)}
    return {queue:existing,snapshot:snap}
  }
  async flush(){try{await this.writeChain}catch{}}
}

export const halaqatiOfflineStore=new HalaqatiOfflineStore();
export function installHalaqatiOfflineStore(){window.HalaqatiOfflineStore=halaqatiOfflineStore;return halaqatiOfflineStore.open()}
