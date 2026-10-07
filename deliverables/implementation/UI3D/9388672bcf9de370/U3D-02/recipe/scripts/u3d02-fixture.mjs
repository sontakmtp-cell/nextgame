import { catalog, sliceKits, ruleset } from '../packages/content/dist/index.js';
import { createWorld, publicFrame } from '../packages/engine/dist/index.js';
import { save, evidence } from './u3d02-evidence.mjs';
const body=structuredClone(sliceKits[0].body);
const fourDirections=structuredClone(body);
// Connected and asymmetric fixture includes exactly the four cardinal headings.
fourDirections.modules.filter(m=>m.catalogId!=='core').forEach((m,i)=>m.orientation=i%4);
const twentyFour={grid:body.grid,modules:[{id:'offset-core',catalogId:'core',cell:{x:3,y:4},orientation:3},...Array.from({length:23},(_,i)=>({id:`plate-${i}`,catalogId:'armor',cell:{x:i%7+2,y:Math.floor(i/7)+3},orientation:i%4})).filter(m=>!(m.cell.x>=3&&m.cell.x<=4&&m.cell.y>=4&&m.cell.y<=5))]};
// Replace removed core-overlap cells until there are 24 total, without overlap.
for(let x=2;twentyFour.modules.length<24;x++)twentyFour.modules.push({id:`extension-${x}`,catalogId:'armor',cell:{x,y:7},orientation:x%4});
const world=await createWorld(sliceKits[0],sliceKits[1],'00000000000000000000000000000001'),frame=publicFrame(world);
const fixture={body,fourDirections,twentyFour,footprints:Object.fromEntries(catalog.map(c=>[c.id,c.footprint])),frames:[frame],layout:{width:ruleset.arena.width/1000,depth:ruleset.arena.height/1000,objective:{x:0,z:0,radius:ruleset.arena.controlRadius/1000},props:[{x:22,z:0,width:1.5,depth:5,height:1.8},{x:-22,z:0,width:1.5,depth:5,height:1.8}]},provenance:'Body from current sliceKits, frame from current createWorld/publicFrame; no private actor resources or Brain in browser DTO; 24-module fixture is render stress, not ranked valid'};
await save('.local/u3d02/fixture.json',fixture);await save(`${evidence}/fixture.json`,fixture);console.log(`fixture ${body.modules.length} modules; 24 fixture ${twentyFour.modules.length}`);
