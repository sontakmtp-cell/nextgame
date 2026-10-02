import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const output=resolve(process.argv[2]??'.local/g1/linux');await mkdir(output,{recursive:true});
const shell=`set -eu
mkdir /tmp/project
cd /input
tar --exclude=node_modules --exclude=dist --exclude=dist-types --exclude=.env --exclude=.local --exclude=output --exclude=deliverables --exclude=.git --exclude='*.tsbuildinfo' -cf - . | tar -xf - -C /tmp/project
cd /tmp/project
npm exec --yes --package=pnpm@10.34.6 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.34.6 -- pnpm build
npm exec --yes --package=pnpm@10.34.6 -- pnpm check
npm exec --yes --package=pnpm@10.34.6 -- pnpm test:unit
node scripts/g1-corpus.mjs --compare tests/g1/corpus.json --out /evidence/linux-corpus.json
node apps/cli/dist/index.js simulate packages/content/data/g1/Mantis.bot.json packages/content/data/g1/Kestrel.bot.json /evidence/demo
node apps/cli/dist/index.js verify /evidence/demo --full
node scripts/g1-fixtures.mjs /evidence/fixtures
node scripts/g1-cli-negative.mjs /evidence/negative /evidence/fixtures/Mantis-0
`;
const args=['run','--rm','--name','nextgame-g1-linux-check','-e','NO_COLOR=1','-v',`${resolve('.')}:/input:ro`,'-v',`${output}:/evidence`,'node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d','sh','-c',shell],startedAt=new Date().toISOString();
const child=spawn('docker',args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
child.stdout.on('data',chunk=>{stdout+=chunk.toString();process.stdout.write(chunk);});child.stderr.on('data',chunk=>{stderr+=chunk.toString();process.stderr.write(chunk);});
child.once('error',error=>{console.error(error);process.exitCode=1;});child.once('exit',async code=>{await writeFile(`${output}/command-record.json`,JSON.stringify({command:'docker',args,startedAt,finishedAt:new Date().toISOString(),exitCode:code,stdout,stderr},null,2)+'\n');process.exitCode=code??1;});
