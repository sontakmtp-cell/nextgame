import { it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonical,sha256 } from '../packages/contracts/dist/index.js';
import type { BotDefinition } from '../packages/contracts/dist/index.js';
import { freezeBot } from '../packages/brain/dist/index.js';
import { catalog,contentManifest } from '../packages/content/dist/index.js';
it('Node platform matches the shared browser/Windows golden byte and package vectors',async()=>{
  const vectors=JSON.parse(readFileSync('tests/browser/vectors.json','utf8')) as {vectors:{name:string;bot:BotDefinition;packageHash:string;presentationHash:string}[];encoded:{value:unknown;text:string;hash:string}[]};
  for(const row of vectors.vectors){const pkg=await freezeBot(row.bot,catalog,contentManifest.catalogDigest,contentManifest.capabilityDigest);expect(pkg.packageHash,row.name).toBe(row.packageHash);expect(pkg.presentationHash,row.name).toBe(row.presentationHash);}
  for(const row of vectors.encoded){expect(canonical(row.value)).toBe(row.text);expect(await sha256(row.text)).toBe(row.hash);}
});
