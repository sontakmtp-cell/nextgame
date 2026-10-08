import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, MeshBasicMaterial } from 'three';
import { coreLinkPaths, updateCoreLinks } from './energy.js';
import type { CoreLink } from './energy.js';
import type { SynthVisualProps } from './interfaces.js';
function makeTubes(links: readonly CoreLink[], radial: number) {
  const count=links.length*9*radial,geometry=new BufferGeometry(),indices:number[]=[];
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(count*3),3).setUsage(DynamicDrawUsage));
  for(let arc=0;arc<links.length;arc++)for(let step=0;step<8;step++)for(let ring=0;ring<radial;ring++){const a=(arc*9+step)*radial+ring,b=(arc*9+step)*radial+(ring+1)%radial,c=a+radial,d=b+radial;indices.push(a,c,b,b,c,d);}
  geometry.setIndex(indices);return geometry;
}
function updateTubes(geometry: BufferGeometry,links: readonly CoreLink[],radial:number,radius:number) {
  const attribute=geometry.getAttribute('position');let offset=0;
  for(const link of links)for(let i=0;i<9;i++) {
    const p=link.points[i]!,a=link.points[Math.max(0,i-1)]!,b=link.points[Math.min(8,i+1)]!;
    let tx=b.x-a.x,ty=b.y-a.y,tz=b.z-a.z;const magnitude=Math.hypot(tx,ty,tz)||1;tx/=magnitude;ty/=magnitude;tz/=magnitude;
    const horizontal=Math.hypot(tx,tz),px=horizontal>1e-8?-tz/horizontal:1,pz=horizontal>1e-8?tx/horizontal:0;
    const qx=ty*pz,qy=tz*px-tx*pz,qz=-ty*px;
    for(let ring=0;ring<radial;ring++){const angle=ring/radial*Math.PI*2,c=Math.cos(angle)*radius,s=Math.sin(angle)*radius;attribute.setXYZ(offset++,p.x+px*c+qx*s,p.y+qy*s,p.z+pz*c+qz*s);}
  }
  attribute.needsUpdate=true;
}
export function CoreLinks(props: SynthVisualProps & { readonly reducedMotion?: boolean; readonly animate?: boolean; readonly motionClock?: RefObject<number> }) {
  const invalidate=useThree(s=>s.invalidate),gl=useThree(s=>s.gl),elapsed=useRef(0),halo=useRef<MeshBasicMaterial>(null);
  const links=useMemo(()=>coreLinkPaths(props),[props.body,props.publicState,props.footprintByCatalogId,props.manifest]);
  const radial=props.quality==='low'?3:5;
  const geometry=useMemo(()=>({wire:makeTubes(links,radial),sheath:makeTubes(links,radial),halo:makeTubes(links,radial)}),[links,radial]);
  const update=()=>{updateTubes(geometry.wire,links,radial,.006);updateTubes(geometry.sheath,links,radial,.011);updateTubes(geometry.halo,links,radial,.021);};
  useEffect(()=>{elapsed.current=0;updateCoreLinks(links,0);update();invalidate();return()=>{geometry.wire.dispose();geometry.sheath.dispose();geometry.halo.dispose();};},[geometry,invalidate]);
  useEffect(()=>{const visible=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[invalidate]);
  useEffect(()=>{if(props.reducedMotion){updateCoreLinks(links,0);update();if(halo.current)halo.current.opacity=.35;}invalidate();},[props.reducedMotion,invalidate,geometry]);
  useFrame((_state,delta)=>{
    if(props.reducedMotion||!links.length||document.hidden||gl.getContext().isContextLost())return;
    elapsed.current=props.motionClock?.current??elapsed.current+Math.min(delta,.05);updateCoreLinks(links,elapsed.current);update();
    if(halo.current)halo.current.opacity=.25+.18*(.5+.5*Math.sin(elapsed.current*17));
    if (props.animate !== false) invalidate();
  });
  const color=props.team==='A'?'#ffae32':'#12cfe2';
  return <group name="core-energy-links" userData={{links:links.length,modules:links.length/3,moving:!props.reducedMotion,contacts:links.map(l=>({moduleId:l.moduleId,bolt:l.bolt,start:l.start,end:l.end}))}}>
    <mesh name="energy-glow" geometry={geometry.halo} frustumCulled={false}><meshBasicMaterial ref={halo} color={color} transparent opacity={.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    <mesh geometry={geometry.sheath} frustumCulled={false}><meshBasicMaterial color={color} transparent opacity={.85} depthWrite={false} toneMapped={false} /></mesh>
    <mesh name="energy-wire" geometry={geometry.wire} frustumCulled={false}><meshBasicMaterial color={props.team==='A'?'#fff4ce':'#d4ffff'} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}
