import { spawn,spawnSync } from 'node:child_process';
import { readFile,stat } from 'node:fs/promises';
const path=process.argv[2];if(!path)throw new Error('Usage: pnpm compile:sandbox <bot.json>');
if((await stat(path)).size>262144)throw new Error('BYTE_CAP');
const input=await readFile(path);if(input.length>262144)throw new Error('BYTE_CAP');
const created=spawnSync('docker',['create','-i','--label','promptchien.stage=G0','--network','none','--memory','256m','--memory-swap','256m','--cpus','1','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','nextgame-brain:g0'],{encoding:'utf8'});
if(created.status!==0)throw new Error(created.stderr);
const id=created.stdout.trim();
let deadline,expired=false;
try {
  const child=spawn('docker',['start','--attach','--interactive',id],{stdio:['pipe','pipe','inherit']});
  let output='',started=false;
  deadline=setTimeout(()=>{expired=true;spawnSync('docker',['kill',id],{stdio:'ignore'});},10000);
  child.stdout.on('data',chunk=>{
    output+=chunk.toString();process.stdout.write(chunk);
    if(!started&&output.includes('READY\n')){
      started=true;clearTimeout(deadline);
      deadline=setTimeout(()=>{expired=true;spawnSync('docker',['kill',id],{stdio:'ignore'});},2000);
      child.stdin.end(input);
    }
  });
  child.stdin.on('error',()=>{});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(expired)throw new Error('COMPILE_DEADLINE (infraFailure, never bot loss)');
  process.exitCode=code??1;
}finally{clearTimeout(deadline);spawnSync('docker',['rm','--force',id],{stdio:'ignore'});}
