import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const [output,...args]=process.argv.slice(2);if(!output||!args.length)throw new Error('Usage: node g1-run.mjs record.json node-script [args]');
const startedAt=new Date().toISOString(),child=spawn(process.execPath,args,{env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
child.stdout.on('data',chunk=>{stdout+=chunk.toString();process.stdout.write(chunk);});child.stderr.on('data',chunk=>{stderr+=chunk.toString();process.stderr.write(chunk);});
child.once('error',error=>{console.error(error);process.exitCode=1;});child.once('exit',async code=>{await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify({command:process.execPath,args,startedAt,finishedAt:new Date().toISOString(),exitCode:code,stdout,stderr},null,2)+'\n');process.exitCode=code??1;});
