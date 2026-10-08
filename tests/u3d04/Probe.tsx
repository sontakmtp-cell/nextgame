import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh } from 'three';
export function Probe() {
  const {gl,scene} = useThree(), renders=useRef(0), intervals=useRef<number[]>([]), prior=useRef(0);
  useFrame(()=>{renders.current++;const now=performance.now();if(prior.current&&intervals.current.length<10000)intervals.current.push(now-prior.current);prior.current=now;});
  useEffect(()=>{
    const api={ read:()=>{const objects:{name:string;position:number[];rotation:number[];data:unknown;visible:boolean}[]=[];const qualities:string[]=[];scene.traverse(o=>{if(o.name.startsWith('synth-'))qualities.push(o.name.split('-').at(-1)!);if(/^(actor-|telegraph-|projectile-|shield-|phase-|effect-|module-|replay-world|gameplay-ring|objective)/.test(o.name))objects.push({name:o.name,position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],data:o.userData,visible:o.visible});});const c=gl.getContext(),e=c.getExtension('WEBGL_debug_renderer_info');return {renders:renders.current,objects,qualities,drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,gpu:c.getParameter(e?.UNMASKED_RENDERER_WEBGL??c.RENDERER),meshes:scene.children.filter(o=>o instanceof Mesh).length};}, reset:()=>{intervals.current=[];prior.current=0;}, samples:()=>intervals.current };
    Object.assign(window,{u3d04:api});return()=>{Reflect.deleteProperty(window,'u3d04');};
  },[gl,scene]);return null;
}
