import assert from 'node:assert/strict';
import { readFile,mkdir,writeFile,unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const valid=spawnSync(process.execPath,['scripts/compile-sandbox.mjs','Docs/examples/mantis.bot.json'],{encoding:'utf8'});
assert.equal(valid.status,0,valid.stderr);assert.match(valid.stdout,/"status":"passed"/);
await mkdir('.local',{recursive:true});const file='.local/invalid-sandbox.json';
let created=false;
try{
  const bot=JSON.parse(await readFile('Docs/examples/mantis.bot.json','utf8'));bot.rogue=true;
  await writeFile(file,JSON.stringify(bot),{flag:'wx'});
  created=true;
  const invalid=spawnSync(process.execPath,['scripts/compile-sandbox.mjs',file],{encoding:'utf8'});
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/SCHEMA/);
}finally{if(created)await unlink(file);}
const guards=spawnSync('docker',['run','--rm','--network','none','--memory','256m','--memory-swap','256m','--cpus','1','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--entrypoint','node','nextgame-brain:g0','--input-type=module','-e',`import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';assert.notEqual(process.getuid(),0);assert.throws(()=>fs.writeFileSync('/tmp/probe','x'));assert.throws(()=>fs.readFileSync('/app/.env'));assert.deepEqual(Object.keys(os.networkInterfaces()),['lo']);const status=fs.readFileSync('/proc/self/status','utf8');assert.match(status,/NoNewPrivs:\\s+1/);assert.match(status,/CapEff:\\s+0000000000000000/);console.log('unprivileged/read-only/no host credentials/no network/capabilities guards passed');`],{encoding:'utf8'});
assert.equal(guards.status,0,guards.stderr);
assert.equal(spawnSync('docker',['ps','-aq','--filter','label=promptchien.stage=G0'],{encoding:'utf8'}).stdout.trim(),'');
console.log(valid.stdout.trim());console.log(guards.stdout.trim());console.log('Invalid schema rejected and compile containers cleaned up');
