import { readFile,writeFile,mkdir,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname,join } from 'node:path';
import os from 'node:os';
const skip=new Set(['node_modules','dist','dist-types','.git','.env','.local','output','deliverables','.playwright-cli']);
async function inventory(dir='.'){
  const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(skip.has(entry.name)||entry.name.endsWith('.tsbuildinfo'))continue;const path=dir==='.'?entry.name:`${dir}/${entry.name}`;if(entry.isDirectory())out.push(...await inventory(path));else if(entry.isFile())out.push(path);}return out.sort();
}
const hashes=[];
for(const path of await inventory())hashes.push({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
const revision=createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),short=revision.slice(0,16);
const root=`deliverables/implementation`,dirs=Object.fromEntries(['T01','T02','T03'].map(ticket=>[ticket,`${root}/${ticket}/${short}`]));
for(const dir of Object.values(dirs))await mkdir(dir,{recursive:true});
const metadata={revision,gitRevision:null,revisionKind:'SHA256 file snapshot (workspace has no .git)',timestamp:new Date().toISOString(),timeZone:'Asia/Saigon',runtime:process.version,os:os.type(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemory:os.totalmem(),files:hashes};
for(const dir of Object.values(dirs))await writeFile(`${dir}/snapshot.json`,JSON.stringify(metadata,null,2)+'\n');
const records=[];
async function run(ticket,label,command,args){
  const startedAt=new Date().toISOString();let stdout='',stderr='';
  const child=spawn(command,args,{env:{...process.env,NO_COLOR:'1'}});
  child.stdout.on('data',chunk=>stdout+=chunk.toString());child.stderr.on('data',chunk=>stderr+=chunk.toString());
  const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  const record={label,command,args,exitCode,startedAt,finishedAt:new Date().toISOString(),stdout,stderr};records.push(record);
  await writeFile(`${dirs[ticket]}/${label}.json`,JSON.stringify(record,null,2)+'\n');console.log(`${ticket} ${label}: exit ${exitCode}`);
  if(exitCode!==0)throw new Error(`Evidence gate failed: ${label}`);
}
const npx=join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js');
const pnpm=(...args)=>[npx,'--yes','pnpm@10.34.6',...args];
try{
  await run('T01','frozen-install',process.execPath,pnpm('install','--frozen-lockfile'));
  await run('T01','build',process.execPath,pnpm('build'));
  await run('T01','check',process.execPath,pnpm('check'));
  await run('T01','boundary-negative',process.execPath,['scripts/boundary-selfcheck.mjs']);
  await run('T03','unit',process.execPath,pnpm('test:unit'));
  await run('T01','linux-clean',process.execPath,['scripts/linux-check.mjs']);
  await run('T01','service-start', 'docker',['compose','up','-d','--wait']);
  await run('T01','migration-repeat1',process.execPath,pnpm('db:migrate'));
  await run('T01','migration-repeat2',process.execPath,pnpm('db:migrate'));
  await run('T01','smoke-restart',process.execPath,pnpm('test:e2e'));
  await run('T03','cli',process.execPath,['apps/cli/dist/index.js','validate','Docs/examples/mantis.bot.json']);
  await run('T03','sandbox-build','docker',['build','-f','dev/brain.Dockerfile','-t','nextgame-brain:g0','.']);
  await run('T03','sandbox-positive-negative-guards',process.execPath,['scripts/sandbox-selfcheck.mjs']);
  await run('T01','service-stop','docker',['compose','stop']);
  await run('T01','service-restart','docker',['compose','start','--wait']);
  await run('T01','service-finish-stop','docker',['compose','stop']);
  await writeFile(`${dirs.T02}/content-manifest.json`,await readFile('packages/content/data/manifest.json'));
  await writeFile(`${dirs.T02}/suite.json`,await readFile('packages/content/data/suite.json'));
  const summary={revision,short,dirs,passed:records.map(({label,exitCode})=>({label,exitCode})),remoteCI:'configured-unrun',browser:'capture separately for same revision',finishedAt:new Date().toISOString()};
  await writeFile(`${root}/latest.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({revision,dirs}));
}catch(error){console.error(error);process.exitCode=1;}
