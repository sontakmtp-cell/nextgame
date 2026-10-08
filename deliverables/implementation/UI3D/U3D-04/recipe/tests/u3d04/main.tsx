import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { ArenaScene, arenaCamera } from '@prompt-chien/renderer3d';
import type { ArenaSceneProps, Quality } from '@prompt-chien/renderer3d';
import { Probe } from './Probe.js';
const fixture = await (await fetch('/fixture.json')).json() as { fixtures: Record<string, ArenaSceneProps['frames']>; footprints: ArenaSceneProps['footprintByCatalogId']; maxHp: Readonly<Record<string,number>>; layout: ArenaSceneProps['layout'] };
const manifest = await (await fetch('/assets/ui3d/u3d01/manifest.json')).json();
function Demo() {
  const [mode,setMode] = useState('ranged'), [quality,setQuality] = useState<Quality>('high'), [position,setPosition] = useState(0), [vfx,setVfx] = useState(true), [reduced,setReduced] = useState(false), [camera,setCamera] = useState(arenaCamera), [playing,setPlaying] = useState(false);
  const clock = useRef(0), frames = fixture.fixtures[mode]!;
  useEffect(()=>{clock.current=position;},[position]);
  useEffect(()=>{ let prior=0,raf=0;const animate=(time:number)=>{if(playing&&prior)clock.current=(clock.current+Math.min(time-prior,100)*.06)%(frames.length-1);prior=time;raf=requestAnimationFrame(animate);};raf=requestAnimationFrame(animate);return()=>cancelAnimationFrame(raf); },[playing,frames]);
  return <><div style={{padding:10}}><label>Fixture<select aria-label="Fixture" value={mode} onChange={e=>{setPlaying(false);setMode(e.target.value);setPosition(0);clock.current=0;}}>{Object.keys(fixture.fixtures).map(k=><option key={k}>{k}</option>)}</select></label><label>Quality<select aria-label="Quality" value={quality} onChange={e=>setQuality(e.target.value as Quality)}>{['high','medium','low'].map(k=><option key={k}>{k}</option>)}</select></label><label>Position<input type="number" value={position} onChange={e=>{setPlaying(false);setPosition(Number(e.target.value));clock.current=Number(e.target.value);}} /></label><label>VFX<input type="checkbox" checked={vfx} onChange={e=>setVfx(e.target.checked)} /></label><label>Reduced<input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)} /></label><button onClick={()=>setPlaying(!playing)}>{playing?'Pause':'Play'}</button></div><div style={{height:900,width:1500}}><ArenaScene layout={fixture.layout} frames={frames} position={position} positionRef={clock} playing={playing} footprintByCatalogId={fixture.footprints} maxHpByCatalogId={fixture.maxHp} manifest={manifest} vfx={vfx} viewport={{quality,camera,cameraLocked:false,reducedMotion:reduced,grayscale:false,onCameraChange:setCamera,onReady:()=>{},onGraphicsState:()=>{},onRequest2d:()=>{}}}><Probe /></ArenaScene></div></>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
