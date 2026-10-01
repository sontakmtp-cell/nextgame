import { parseBot,validateBody } from '../packages/contracts/dist/index.js';
import { compile } from '../packages/brain/dist/index.js';
import { catalog } from '../packages/content/dist/index.js';
console.log('READY');
try {
  const chunks=[];let bytes=0;
  for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>262144)throw new Error('BYTE_CAP');chunks.push(chunk);}
  const bot=parseBot(Buffer.concat(chunks).toString('utf8'));
  const body=validateBody(bot.body,catalog),compiled=compile(bot.brain,body.modules);
  console.log(JSON.stringify({status:'passed',cost:body.cost,irNodes:compiled.nodeCount,compilerDigest:compiled.compilerDigest,rss:process.memoryUsage().rss}));
}catch(error){console.error(JSON.stringify({status:'failed',code:error.code??'INPUT',pointer:error.pointer??'',message:error.message}));process.exitCode=1;}
