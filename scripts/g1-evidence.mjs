import { readFile,writeFile,mkdir,readdir,cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
const base='.local/g1',skip=new Set(['node_modules','dist','dist-types','.git','.env','.local','output','deliverables','.playwright-cli']);
async function inventory(dir='.') {const files=[];for(const e of await readdir(dir,{withFileTypes:true})){if(skip.has(e.name)||e.name.endsWith('.tsbuildinfo'))continue;const path=dir==='.'?e.name:`${dir}/${e.name}`;if(e.isDirectory())files.push(...await inventory(path));else if(e.isFile())files.push(path);}return files.sort();}
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const windows=await json(`${base}/release-windows-corpus.json`),linux=await json(`${base}/release-linux/linux-corpus.json`),browser=await json(`${base}/release-browser-parity.json`),qa=await json(`${base}/release-browser-qa.json`);
if([windows,linux,browser,qa].some(r=>r.status!=='passed')||windows.corpusDigest!==linux.corpusDigest||windows.engineDigest!==browser.engineDigest||windows.records.length!==1000||linux.records.length!==1000||browser.records.length!==100)throw new Error('Final differential evidence gate');
const winFixtures=await json(`${base}/release-fixtures/manifest.json`),linuxFixtures=await json(`${base}/release-linux/fixtures/manifest.json`);
if(JSON.stringify(winFixtures)!==JSON.stringify(linuxFixtures))throw new Error('Nine archive fixtures differ across Windows/Linux');
const commandFiles=(await readdir(`${base}/release-checks`)).filter(f=>f.endsWith('.json'));
for(const file of commandFiles)if((await json(`${base}/release-checks/${file}`)).exitCode!==0)throw new Error(`Failed captured command ${file}`);
if((await json(`${base}/release-linux/command-record.json`)).exitCode!==0)throw new Error('Failed Linux command');
const files=[];for(const path of await inventory())files.push({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
const snapshotHash=createHash('sha256').update(JSON.stringify(files)).digest('hex'),revision=snapshotHash.slice(0,16),root='deliverables/implementation';
const metadata={snapshotHash,revision,revisionKind:'SHA256 sorted source inventory; uncommitted working-tree implementation',gitRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gitStatus:execFileSync('git',['status','--short'],{encoding:'utf8'}),timestamp:new Date().toISOString(),runtime:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,files};
const dirs=Object.fromEntries(['T04','T05','T06'].map(t=>[t,`${root}/${t}/${revision}`]));
for(const dir of Object.values(dirs)){await mkdir(dir,{recursive:true});await writeFile(`${dir}/snapshot.json`,JSON.stringify(metadata,null,2)+'\n');}
async function copy(ticket,source,name){await cp(`${base}/${source}`,`${dirs[ticket]}/${name}`,{recursive:true,errorOnExist:true,force:false});}
await copy('T04','release-checks','commands');await copy('T04','release-profile.json','profile.json');await copy('T04','before-geometry-cache-profile.json','profile-before-cache.json');
await copy('T05','release-behavior.json','behavior.json');await copy('T05','release-visuals','screenshots');await copy('T05','release-browser-qa.json','browser-qa.json');
await copy('T06','release-windows-corpus.json','windows-corpus.json');await copy('T06','release-linux/linux-corpus.json','linux-corpus.json');await copy('T06','release-linux/command-record.json','linux-command.json');await copy('T06','release-browser-parity.json','browser-parity.json');
await copy('T06','release-fixtures','fixtures');await copy('T06','release-negative/results.json','windows-cli-negative.json');await copy('T06','release-linux/negative/results.json','linux-cli-negative.json');
await writeFile(`${dirs.T06}/linux-fixtures-manifest.json`,JSON.stringify(linuxFixtures,null,2)+'\n');
const summary={status:'technical checks passed; G1 acceptance pending human fun/readability and numeric prototype signoff',revision,snapshotHash,engineDigest:windows.engineDigest,corpusDigest:windows.corpusDigest,windowsRows:1000,linuxRows:1000,browserRows:100,checkpointIntervalsPerPlatform:windows.checkpointIntervals,archiveFixtureParity:9,dirs};
await writeFile(`${root}/G1_EVIDENCE.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
