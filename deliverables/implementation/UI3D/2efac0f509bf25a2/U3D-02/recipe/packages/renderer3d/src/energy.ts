import { Vector3 } from 'three';
import { moduleTransform } from './geometry.js';
import type { SynthVisualProps } from './interfaces.js';
import { baseHoverHeight, hoverAmplitude, hoverHeight } from './hover.js';
type Port = { id: string; catalogId: string; baseY: number; x: number; z: number; ex: number; ez: number; height: number };
export interface CoreLink { moduleId: string; bolt: number; seed: number; start: Vector3; end: Vector3; cruise: number|null; points: Vector3[]; source: Port; target: Port; sourceFace: 'x'|'z'; targetFace: 'x'|'z' }
function port(props: SynthVisualProps, module: SynthVisualProps['body']['modules'][number]): Port {
  const t = moduleTransform(props.body, module, props.footprintByCatalogId), bounds = props.manifest.modules.find(a => a.catalogId === module.catalogId)?.normalization.bounds;
  const ex = bounds ? Math.max(Math.abs(bounds.min[0]), Math.abs(bounds.max[0])) : t.footprint * .47;
  const ez = bounds ? Math.max(Math.abs(bounds.min[2]), Math.abs(bounds.max[2])) : t.footprint * .47;
  return { id: module.id, catalogId: module.catalogId, baseY: baseHoverHeight(module.catalogId), x: t.x, z: t.z, ex: module.orientation % 2 ? ez : ex, ez: module.orientation % 2 ? ex : ez, height: bounds?.max[1] ?? 1 };
}
function crossedInterval(a: Vector3, b: Vector3, box: Port) {
  let lo = 0, hi = 1;
  for (const [from,to,center,extent] of [[a.x,b.x,box.x,box.ex+.035],[a.z,b.z,box.z,box.ez+.035]]) {
    const delta = to! - from!;
    if (Math.abs(delta) < 1e-8) { if (Math.abs(from! - center!) > extent!) return null; }
    else { const t1=(center!-extent!-from!)/delta,t2=(center!+extent!-from!)/delta; lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2)); }
  }
  return lo < hi && hi > 0 && lo < 1 ? [Math.max(.01,lo),Math.min(.99,hi)] as const : null;
}
// Three decorative arcs per alive module. Ports stay outside normalized art
// bounds; no line runs into Core's center or changes engine connectivity.
export function coreLinkPaths(props: SynthVisualProps) {
  const alive = (id: string) => !props.publicState || props.publicState.modules.some(m => 'public-'+m.ordinal === id && m.status === 'alive');
  const core = props.body.modules.find(m => m.catalogId === 'core');
  if (!core || !alive(core.id)) return [];
  const origin = port(props,core), visible = props.body.modules.filter(m => alive(m.id));
  const links: CoreLink[] = [];
  for (const module of visible) {
    if (module === core) continue;
    const target = port(props,module), dx=target.x-origin.x,dz=target.z-origin.z,length=Math.hypot(dx,dz);
    if (length < .01) continue;
    const ux=dx/length,uz=dz/length;
    const edge=(p:Port)=>Math.min(Math.abs(ux)>1e-8?p.ex/Math.abs(ux):Infinity,Math.abs(uz)>1e-8?p.ez/Math.abs(uz):Infinity);
    const from=edge(origin)+.008,to=length-edge(target)-.008;
    if (to<=from) continue;
    for (let bolt=0;bolt<3;bolt++) {
      const start=new Vector3(origin.x+ux*from,origin.baseY+origin.height*(.55+.18*bolt),origin.z+uz*from),end=new Vector3(origin.x+ux*to,target.baseY+target.height*(.4+.22*bolt),origin.z+uz*to);
      let cruise: number|null=null;
      // Lift over intervening housings instead of crossing solid art.
      for(const obstacle of visible) {
        if(obstacle===core||obstacle===module)continue;
        const bounds=port(props,obstacle),interval=crossedInterval(start,end,bounds);
        if(interval)cruise=Math.max(cruise??0,bounds.baseY+hoverAmplitude(bounds.catalogId)+bounds.height+.16+.08*bolt);
      }
      const seed=[...module.id].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261)+bolt*977;
      const face=(p:Port)=>p.ex/Math.max(1e-8,Math.abs(ux))<=p.ez/Math.max(1e-8,Math.abs(uz))?'x' as const:'z' as const;
      if(cruise!==null)cruise=Math.max(cruise,start.y+.1,end.y+.1);
      links.push({moduleId:module.id,bolt,seed,start,end,cruise,points:Array.from({length:9},()=>new Vector3()),source:origin,target,sourceFace:face(origin),targetFace:face(target)});
    }
  }
  updateCoreLinks(links,0);return links;
}
export function updateCoreLinks(links: readonly CoreLink[], seconds: number) {
  for(const link of links) {
    const dx=link.end.x-link.start.x,dz=link.end.z-link.start.z;
    link.start.y=hoverHeight(link.source.catalogId,link.source.id,seconds)+link.source.height*(.55+.18*link.bolt);
    link.end.y=hoverHeight(link.target.catalogId,link.target.id,seconds)+link.target.height*(.4+.22*link.bolt);
    for(let i=0;i<link.points.length;i++) {
      const f=link.cruise!==null?Math.max(0,Math.min(1,(i-1)/6)):i/(link.points.length-1),envelope=Math.sin(f*Math.PI),phase=((Math.imul(link.seed+i*313,1664525)>>>0)/4294967296)*Math.PI*2;
      const side=Math.sin(phase+seconds*(13+link.bolt*3))*.06*envelope;
      const jitter=(Math.sin(phase*2+seconds*21)+Math.sin(phase+seconds*11))*.021*envelope;
      const point=link.points[i]!;
      const y=link.cruise!==null&&i>0&&i<8?Math.max(link.cruise,link.start.y+.1,link.end.y+.1):link.start.y+(link.end.y-link.start.y)*f;
      point.set(link.start.x+dx*f+(link.sourceFace==='z'?side:0),y+envelope*.025+jitter,link.start.z+dz*f+(link.sourceFace==='x'?side:0));
      // Clamp any corner jitter onto the outside of the facing shell.
      for(const [box,face,direction] of [[link.source,link.sourceFace,1],[link.target,link.targetFace,-1]] as const) {
        if(Math.abs(point.x-box.x)<box.ex+.005&&Math.abs(point.z-box.z)<box.ez+.005&&point.y<hoverHeight(box.catalogId,box.id,seconds)+box.height+.005){if(face==='x')point.x=box.x+Math.sign(dx)*direction*(box.ex+.008);else point.z=box.z+Math.sign(dz)*direction*(box.ez+.008);}
      }
    }
  }
}
