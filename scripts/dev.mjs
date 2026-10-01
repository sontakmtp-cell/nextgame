import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require=createRequire(import.meta.url),pnpm=process.env.npm_execpath;
if(!pnpm)throw new Error('Run with pnpm dev');
if(!existsSync('.env')){console.error('Run pnpm env:init first.');process.exit(1);}
const build=spawn(process.execPath,[pnpm,'build'],{stdio:'inherit'});
await new Promise((resolve,reject)=>{build.once('error',reject);build.once('exit',code=>code===0?resolve():reject(new Error(`build ${code}`)));});
const children=[spawn(process.execPath,['--env-file=.env','apps/api/dist/index.js'],{stdio:'inherit'}),spawn(process.execPath,[require.resolve('../apps/web/node_modules/vite/bin/vite.js')],{cwd:'apps/web',stdio:'inherit'})];
let closing=false;
function stop(code=0){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
for(const child of children){child.once('error',error=>{console.error(error);stop(1);});child.once('exit',code=>{if(!closing)stop(code??1);});}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop());
