import { canonical,sha256 } from '../../packages/contracts/dist/index.js';
import { freezeBot } from '../../packages/brain/dist/index.js';
import { catalog,contentManifest } from '../../packages/content/dist/index.js';
import type { BotDefinition } from '../../packages/contracts/dist/index.js';
import vectors from './vectors.json';
const result=document.getElementById('result')!;
try {
  let checks=0;
  for(const row of vectors.vectors){
    const actual=await freezeBot(row.bot as BotDefinition,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);
    if(actual.packageHash!==row.packageHash||actual.presentationHash!==row.presentationHash)throw new Error(row.name);
    checks++;
  }
  for(const row of vectors.encoded){if(canonical(row.value)!==row.text||await sha256(row.text)!==row.hash)throw new Error('canonical bytes');checks++;}
  result.textContent=JSON.stringify({status:'passed',checks,compilerDigest:contentManifest.compilerDigest,userAgent:navigator.userAgent},null,2);
}catch(error){result.textContent=`FAILED: ${String(error)}`;}
