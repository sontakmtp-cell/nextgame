import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseBot, canonical, sha256 } from '../packages/contracts/dist/index.js';
import { freezeBot } from '../packages/brain/dist/index.js';
import { catalog,contentManifest } from '../packages/content/dist/index.js';
const bot=parseBot(await readFile('Docs/examples/mantis.bot.json','utf8')),vectors=[];
for(let i=0;i<32;i++){
  const variant=structuredClone(bot);variant.name=`Parity ${i}`;
  variant.body.modules.reverse();variant.body.modules.find(m=>m.catalogId==='blade').orientation=i%4;
  variant.brain.states[0].rules[0].intent.thrust.strafe.value=i*31;
  const pkg=await freezeBot(variant,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);
  vectors.push({name:`bot-${i}`,bot:variant,packageHash:pkg.packageHash,presentationHash:pkg.presentationHash});
}
const bytes=[null,true,0,-2147483648,2147483647,{z:1,a:'e\u0301'},[3,2,1],{signed:-0}];
const encoded=[];for(const value of bytes){const text=canonical(value);encoded.push({value,text,hash:await sha256(text)});}
await mkdir('tests/browser',{recursive:true});
await writeFile('tests/browser/vectors.json',JSON.stringify({version:'G0-parity-1',compilerDigest:contentManifest.compilerDigest,vectors,encoded},null,2)+'\n');
console.log(`Generated ${vectors.length+encoded.length} Windows/Node golden vectors`);
