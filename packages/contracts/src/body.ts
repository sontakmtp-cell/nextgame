import { ContractError } from './json.js';
import type { BotDefinition, Placement } from './types.js';
export interface CatalogEntry { id: string; cost: number; mass: number; hp: number; enabled: boolean; damage: boolean; max: number; footprint: number }
export function geometryOrder(a: Placement,b: Placement): number { return a.cell.y-b.cell.y || a.cell.x-b.cell.x || (a.catalogId<b.catalogId?-1:a.catalogId>b.catalogId?1:0) || a.orientation-b.orientation; }
export function validateBody(body: BotDefinition['body'], catalog: readonly CatalogEntry[], ranked = false): {cost:number;mass:number;radiusSquared:number;modules:Placement[]} {
  if (body.modules.length>24) throw new ContractError('MODULE_CAP','/body/modules');
  const ids = new Set<string>(), counts = new Map<string,number>(), occupied = new Map<string,number>();
  const entries = new Map(catalog.map(c=>[c.id,c]));
  const modules = [...body.modules].sort(geometryOrder);
  let cost=0,mass=0,core:Placement|undefined,weapons=0;
  for (const [index,module] of modules.entries()) {
    const pointer=`/body/modules/${body.modules.indexOf(module)}`;
    if (ids.has(module.id)) throw new ContractError('DUPLICATE_ID',`${pointer}/id`);
    ids.add(module.id);
    const entry=entries.get(module.catalogId);
    if (!entry || !entry.enabled) throw new ContractError('CATALOG_DISABLED',`${pointer}/catalogId`);
    const count=(counts.get(entry.id)??0)+1;counts.set(entry.id,count);
    if (count>entry.max) throw new ContractError('CATALOG_CAP',pointer);
    if (entry.id==='core') core=module;
    if (entry.damage) weapons++;
    cost+=entry.cost;mass+=entry.mass;
    for(let y=module.cell.y;y<module.cell.y+entry.footprint;y++) for(let x=module.cell.x;x<module.cell.x+entry.footprint;x++) {
      if (x<0 || y<0 || x>=12 || y>=12) throw new ContractError('GRID_BOUNDS',pointer);
      const key=`${x},${y}`;
      if (occupied.has(key)) throw new ContractError('OVERLAP',pointer);
      occupied.set(key,index);
    }
  }
  if (!core) throw new ContractError('CORE_REQUIRED','/body/modules');
  if (cost>100 || weapons>3) throw new ContractError('BUILD_BUDGET','/body/modules');
  const queue=[`${core.cell.x},${core.cell.y}`],seen=new Set(queue);
  for(let i=0;i<queue.length;i++) {
    const [x,y]=queue[i]!.split(',').map(Number) as [number,number];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const key=`${x+dx},${y+dy}`;
      if(occupied.has(key)&&!seen.has(key)){seen.add(key);queue.push(key);}
    }
  }
  if(seen.size!==occupied.size) throw new ContractError('DISCONNECTED','/body/modules');
  let radiusSquared=0;
  for(const key of occupied.keys()) {
    const [x,y]=key.split(',').map(Number) as [number,number];
    for(const dx of [0,1]) for(const dy of [0,1]) radiusSquared=Math.max(radiusSquared,((x+dx-core.cell.x-1)*1000)**2+((y+dy-core.cell.y-1)*1000)**2);
  }
  if(radiusSquared>6500**2) throw new ContractError('RADIUS_CAP','/body/modules');
  if(ranked && ((counts.get('thruster')??0)<2 || weapons<1)) throw new ContractError('RANKED_BODY','/body/modules');
  return {cost,mass,radiusSquared,modules};
}
