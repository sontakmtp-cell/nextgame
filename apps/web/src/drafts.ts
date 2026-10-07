import type { BotDefinition } from '@prompt-chien/contracts';
export interface Draft {id:string;revision:number;definition:BotDefinition;hypothesis:string;weakness:string;parentHash:string|null;savedAt:string}
export class DraftConflict extends Error {constructor(){super('Tab khác đã lưu bản mới. Bản đang sửa vẫn được giữ; lưu thành Synth mới hoặc tải bản mới.');}}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('prompt-chien-local',1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('heads',{keyPath:'id'});db.createObjectStore('revisions',{keyPath:['id','revision']});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function listDrafts():Promise<Draft[]>{const db=await database();try{return await new Promise((resolve,reject)=>{const req=db.transaction('heads').objectStore('heads').getAll();req.onsuccess=()=>resolve((req.result as Draft[]).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));req.onerror=()=>reject(req.error);});}finally{db.close();}}
export async function revisions(id:string):Promise<Draft[]>{const db=await database();try{return await new Promise((resolve,reject)=>{const req=db.transaction('revisions').objectStore('revisions').getAll(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]));req.onsuccess=()=>resolve(req.result as Draft[]);req.onerror=()=>reject(req.error);});}finally{db.close();}}
export async function saveDraft(input:Omit<Draft,'revision'|'savedAt'>,expectedRevision:number):Promise<Draft>{
  const db=await database();try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(['heads','revisions'],'readwrite'),heads=tx.objectStore('heads'),get=heads.get(input.id);let saved:Draft;let conflict=false;
    get.onsuccess=()=>{const current=get.result as Draft|undefined;if((current?.revision??0)!==expectedRevision){conflict=true;tx.abort();return;}
      saved={...input,revision:expectedRevision+1,savedAt:new Date().toISOString()};heads.put(saved);tx.objectStore('revisions').add(saved);};
    tx.oncomplete=()=>resolve(saved);tx.onabort=()=>reject(conflict?new DraftConflict():tx.error??new Error('Không lưu được bản nháp.'));tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
