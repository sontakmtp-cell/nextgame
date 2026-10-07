import assert from 'node:assert/strict';
import { readFile,readdir,writeFile,mkdir,cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
const skip=new Set(['node_modules','dist','dist-types','.git','.env','.local','output','deliverables','.playwright-cli','test-results','playwright-report']);
async function inventory(dir='.'){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(skip.has(entry.name)||(entry.name.startsWith('.env.')&&entry.name!=='.env.example')||entry.name.endsWith('.tsbuildinfo'))continue;const path=dir==='.'?entry.name:`${dir}/${entry.name}`;if(entry.isDirectory())out.push(...await inventory(path));else if(entry.isFile())out.push(path);}return out.sort();}
const json=async path=>JSON.parse(await readFile(path,'utf8')),base='.local/g2';
const qa=await json(`${base}/qa/browser-qa.json`),budget=await json(`${base}/budget.json`),fonts=await json(`${base}/fontcheck.json`),profile=await json(`${base}/profile.json`);
assert.equal(qa.status,'passed');assert.equal(budget.status,'passed');assert.equal(fonts.status,'passed');assert(profile.desktop.elapsedMs>=120000);assert.equal(profile.heap.targetMet,true);
const commands=await readdir(`${base}/final-commands`);for(const required of ['build.json','check.json','unit.json','linux.json','browser.json','edge.json','budget.json','profile.json','boundary-negative.json'])assert(commands.includes(required),required);for(const file of commands){if(!file.endsWith('.json'))continue;const result=await json(`${base}/final-commands/${file}`);if(file==='profile.json'){assert.equal(result.exitCode,profile.desktop.targetMet?0:1);}else assert.equal(result.exitCode,0,`Command failed: ${file}`);}
const unit=await json(`${base}/final-commands/unit.json`),unitTests=Number(unit.stdout.match(/Tests\s+(\d+)\s+passed/)?.[1]);assert(unitTests>=161);
const files=[];for(const path of await inventory())files.push({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
const snapshotHash=createHash('sha256').update(JSON.stringify(files)).digest('hex'),revision=snapshotHash.slice(0,16),dirs=Object.fromEntries(['T07','T08'].map(t=>[t,`deliverables/implementation/${t}/${revision}`]));
const metadata={revision,snapshotHash,revisionKind:'sorted SHA256 source inventory; uncommitted working tree',gitRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),timestamp:new Date().toISOString(),runtime:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,files};
for(const dir of Object.values(dirs)){await mkdir(dir,{recursive:true});await writeFile(`${dir}/snapshot.json`,JSON.stringify(metadata,null,2)+'\n');}
await cp(`${base}/final-commands`,`${dirs.T07}/commands`,{recursive:true});await cp(`${base}/qa/browser-qa.json`,`${dirs.T07}/browser-qa.json`);await cp(`${base}/qa/screenshots`,`${dirs.T08}/screenshots`,{recursive:true});
for(const file of ['profile.json','profile-before-cap.json','budget.json','fontcheck.json'])await cp(`${base}/${file}`,`${dirs.T08}/${file}`);await cp(`${base}/renderer-stress.png`,`${dirs.T08}/screenshots/renderer-stress.png`);
if((await readdir(base)).includes('qa-edge'))await cp(`${base}/qa-edge/browser-qa.json`,`${dirs.T07}/edge-qa.json`);
const summary={status:'G2 local implementation; acceptance incomplete',revision,snapshotHash,dirs,unitTests,browserChecks:qa.checks.length,browser:qa.browser,engineDigest:qa.localExperiment.manifest.engineDigest,compilerDigest:qa.localExperiment.manifest.compilerDigest,catalogDigest:qa.localExperiment.manifest.catalogDigest,rulesetDigest:qa.localExperiment.manifest.rulesetDigest,desktopFrameGate:profile.desktop.targetMet?'passed on recorded host only':'failed strict p95 target on recorded host',unrun:['10 beginner usability sessions','12 readability/counterplay participants','Independent art QA','Actual reference integrated GPU/Android','Full assistive-tech/contrast and browser matrix','G1 fun/numeric signoff']};
await writeFile('deliverables/implementation/G2_EVIDENCE.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
