import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),children=[];
async function start(){children.push(spawn(process.execPath,['--env-file=.env','apps/api/dist/index.js'],{stdio:'inherit'}));children.push(spawn(process.execPath,[require.resolve('../apps/web/node_modules/vite/bin/vite.js'),'--host','127.0.0.1'],{cwd:'apps/web',stdio:'inherit'}));}
async function stop(){await Promise.all(children.splice(0).map(child=>new Promise(resolve=>{child.once('exit',resolve);if(child.exitCode!==null)resolve();else child.kill('SIGTERM');})));}
async function ready(url){for(let i=0;i<100;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Smoke failed: ${url}`);}
try{
  for(let round=0;round<2;round++){
    await start();
    const api=await ready('http://127.0.0.1:3001/api/health');if((await api.json()).status!=='ok')throw new Error('API shape');
    await ready('http://127.0.0.1:3001/api/ready');
    const web=await ready('http://127.0.0.1:5173');if(!(await web.text()).includes('PROMPT Chiến'))throw new Error('smoke HTML');
    const proxy=await ready('http://127.0.0.1:5173/api/health');if((await proxy.json()).status!=='ok')throw new Error('proxy shape');
    await stop();console.log(`API/web/readiness/proxy start-stop round ${round+1}: passed`);
  }
}finally{await stop();}
