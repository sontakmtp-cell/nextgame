import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, DirectionalLight, Mesh, Vector3 } from 'three';
import type { WorkshopSceneProps } from '@prompt-chien/renderer3d';
export function Probe({ body }: { body: WorkshopSceneProps['body'] }) {
  const { gl, scene, camera, invalidate } = useThree(), renders = useRef(0);
  useFrame(() => { renders.current++; });
  useEffect(() => {
    const core=body.modules.find(m=>m.catalogId==='core')!;
    const contextExtension=gl.getContext().getExtension('WEBGL_lose_context');
    const screen=(x:number,y:number,z:number)=>{scene.updateMatrixWorld(true);const p=new Vector3(x,y,z).project(camera),rect=gl.domElement.getBoundingClientRect();return{x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};};
    const api={
      energy:()=>{const result:unknown[]=[];scene.traverse(o=>{if(o.name==='core-energy-links'){const wire=o.getObjectByName('energy-wire') as Mesh;result.push({...o.userData,sample:Array.from(wire.geometry.getAttribute('position').array.slice(0,90))});}});return result;},
      shadows:()=>{scene.updateMatrixWorld(true);const lights:{cast:boolean;map:number|undefined;radius:number}[]=[],meshes:{name:string;minY:number;maxY:number}[]=[];scene.traverse(o=>{if(o instanceof DirectionalLight)lights.push({cast:o.castShadow,map:o.shadow.map?.width,radius:o.shadow.radius});if(o instanceof Mesh&&o.castShadow){let parent=o.parent;while(parent&&!parent.name.startsWith('module-'))parent=parent.parent;if(parent){const box=new Box3().setFromObject(o);meshes.push({name:o.name,minY:box.min.y,maxY:box.max.y});}}});return{enabled:gl.shadowMap.enabled,type:gl.shadowMap.type,lights,meshes,catcher:!!scene.getObjectByName('shadow-catcher')};},
      read:()=>{const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');let modules=0,energyLinks=0;const qualities:string[]=[];scene.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('pick-'))modules++;if(o.name==='core-energy-links')energyLinks+=Number(o.userData.links??0);if(o.name.startsWith('synth-'))qualities.push(o.name.split('-').at(-1)??'');});return{renders:renders.current,connected:gl.domElement.isConnected,qualities,drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,modules,energyLinks,gpu:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',webgl:context.getParameter(context.VERSION),dpr:gl.getPixelRatio(),camera:camera.position.toArray(),zoom:'zoom'in camera?camera.zoom:0};},
      module:(id:string)=>{const object=scene.getObjectByName(`pick-${id}`);if(!object)throw Error(`Missing module ${id}`);const p=object.getWorldPosition(new Vector3());return screen(p.x,p.y+.081,p.z);},
      cell:(x:number,y:number)=>screen(x+.5-(core.cell.x+1),.006,-(y+.5-(core.cell.y+1))),
      bounds:()=>body.modules.map(m=>{const object=scene.getObjectByName(`module-${m.id}`);if(!object)return null;const box=new Box3().setFromObject(object),a=screen(box.min.x,box.min.y,box.min.z),b=screen(box.max.x,box.max.y,box.max.z);return{id:m.id,min:box.min.toArray(),max:box.max.toArray(),screen:[a,b]};}),
      loss:()=>{const e=gl.getContext().getExtension('WEBGL_lose_context');if(!e)throw Error('No context loss extension');e.loseContext();return()=>e.restoreContext();},
      restore:()=>{contextExtension?.restoreContext();invalidate();},
      profile:async(count:number)=>{const samples:number[]=[],intervals:number[]=[];let prior=performance.now();for(let i=0;i<count;i++){await new Promise<void>(r=>requestAnimationFrame(()=>r()));const start=performance.now();intervals.push(start-prior);gl.render(scene,camera);samples.push(performance.now()-start);prior=start;}return{samples,intervals,kind:'manual render CPU submission + RAF intervals; not GPU completion or 120s stress'};}
    };
    Object.assign(window,{u3d02:api});return()=>{if(Reflect.get(window,'u3d02')===api)Reflect.deleteProperty(window,'u3d02');};
  },[body,gl,scene,camera,invalidate]);
  return null;
}
