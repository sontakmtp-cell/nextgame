import type { BotDefinition, Placement } from '@prompt-chien/contracts';
export const clone = <T,>(value:T):T=>structuredClone(value);
export function editModule(bot:BotDefinition,id:string,patch:Partial<Placement>|null):BotDefinition {
  const next=clone(bot);next.body.modules=patch===null?next.body.modules.filter(m=>m.id!==id):next.body.modules.map(m=>m.id===id?{...m,...patch}:m);return next;
}
export function newModule(bot:BotDefinition,catalogId:string,x:number,y:number):BotDefinition {
  const next=clone(bot);let n=1;while(next.body.modules.some(m=>m.id===`part${n}`))n++;
  next.body.modules.push({id:`part${n}`,catalogId,cell:{x,y},orientation:0});return next;
}
export function occlusions(bot:BotDefinition):string[] {
  // ponytail: straight cardinal muzzle warning only; exact aim/collision stays in the engine trace.
  const occupied=new Map<string,string>();for(const m of bot.body.modules){const size=m.catalogId==='core'?2:1;for(let x=0;x<size;x++)for(let y=0;y<size;y++)occupied.set(`${m.cell.x+x},${m.cell.y+y}`,m.id);}
  return bot.body.modules.filter(m=>m.catalogId==='burst').filter(m=>{
    const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][m.orientation]!;
    for(let i=1;i<12;i++){const x=m.cell.x+dx!*i,y=m.cell.y+dy!*i;if(x<0||x>11||y<0||y>11)break;if(occupied.has(`${x},${y}`))return true;}return false;
  }).map(m=>m.id);
}
export function diffSummary(before:BotDefinition,after:BotDefinition):string {
  const old=new Map(before.body.modules.map(m=>[m.id,m]));let added=0,removed=0,changed=0;
  for(const m of after.body.modules){const prev=old.get(m.id);if(!prev)added++;else if(JSON.stringify(prev)!==JSON.stringify(m))changed++;old.delete(m.id);}removed=old.size;
  return `Module: +${added} / −${removed} / sửa ${changed}. Brain ${JSON.stringify(before.brain)===JSON.stringify(after.brain)?'giữ nguyên':'đã đổi'}.`;
}
