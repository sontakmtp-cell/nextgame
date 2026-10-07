import { ArenaRenderer } from '../../packages/renderer/src/index.js';
import type { ArenaOptions } from '../../packages/renderer/src/index.js';
import type { PublicFrame } from '../../packages/contracts/src/index.js';
const frames=await (await fetch('/fixture.json')).json() as PublicFrame[],host=document.getElementById('stage')!;
let renderer:ArenaRenderer,options:ArenaOptions={quality:'high',vfx:true,reducedMotion:false,grayscale:false};
const intervals:number[]=[];let handle=0,last=0,start=0;
async function create(){renderer=new ArenaRenderer(host,()=>{});await renderer.init();renderer.render(frames,0,options);}
await create();
const bench={frames:frames.length,modules:frames[0]!.actors.A.modules.length+frames[0]!.actors.B.modules.length,projectiles:frames[0]!.projectiles.length,events:frames[0]!.events.length,
  start(){intervals.length=0;last=0;start=performance.now();const loop=(time:number)=>{if(last)intervals.push(time-last);last=time;renderer.render(frames,((time-start)*.06)%(frames.length-1),options);handle=requestAnimationFrame(loop);};handle=requestAnimationFrame(loop);},
  stop(){cancelAnimationFrame(handle);return {elapsedMs:performance.now()-start,frameIntervals:[...intervals],drawTimes:[...renderer.samples]};},
  async rebuild(){renderer.destroy();await create();},
  quality(value:'high'|'medium'|'low'){options={...options,quality:value};},
};
(window as unknown as {g2Bench:typeof bench}).g2Bench=bench;document.getElementById('status')!.textContent='READY · synthetic stress: 42 modules / 128 projectiles / 256 events per tick';
