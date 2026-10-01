#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { ContractError, parseBot, validateBody } from '@prompt-chien/contracts';
import { compile } from '@prompt-chien/brain';
import { catalog } from '@prompt-chien/content';
try {
  const [command,path]=process.argv.slice(2);
  if(command!=='validate'||!path)throw new Error('Usage: prompt-chien validate <bot.json>. Simulate/experiment/replay await G1.');
  const bot=parseBot(await readFile(path,'utf8'));
  const body=validateBody(bot.body,catalog),brain=compile(bot.brain,body.modules);
  console.log(JSON.stringify({status:'passed',cost:body.cost,mass:body.mass,irNodes:brain.nodeCount,compilerDigest:brain.compilerDigest}));
}catch(error){console.error(JSON.stringify(error instanceof ContractError?{code:error.code,pointer:error.pointer,message:error.message}:{message:String(error)}));process.exitCode=1;}
