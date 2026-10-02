import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const files=[];
for(const name of ['engine','content','brain','contracts'])for(const file of await readdir(`packages/${name}/src`))if(file.endsWith('.ts')&&file!=='identity.ts'&&file!=='manifest.ts')files.push(`packages/${name}/src/${file}`);
files.sort();const engineDigest=createHash('sha256').update((await Promise.all(files.map(async path=>path+'\n'+await readFile(path,'utf8')))).join('\n')).digest('hex');
await writeFile('packages/engine/src/identity.ts',`// SHA256 of sorted engine + content + brain + contracts sources, excluding generated identities/manifests.\nexport const ENGINE_DIGEST='${engineDigest}';\n`);
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-b'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
const {sliceKits,passiveVariant,behaviorCards}=await import('../packages/content/dist/index.js');await mkdir('packages/content/data/g1',{recursive:true});
for(const bot of sliceKits){await writeFile(`packages/content/data/g1/${bot.name}.bot.json`,JSON.stringify(bot,null,2)+'\n');await writeFile(`packages/content/data/g1/${bot.name}.passive.bot.json`,JSON.stringify(passiveVariant(bot),null,2)+'\n');}
await writeFile('packages/content/data/g1/behavior-cards.json',JSON.stringify(behaviorCards,null,2)+'\n');console.log(JSON.stringify({engineDigest,sources:files}));
