import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const shell=`set -eu
mkdir /tmp/project
cd /input
tar --exclude=node_modules --exclude=dist --exclude=dist-types --exclude=.env --exclude=.local --exclude=output --exclude=deliverables --exclude='*.tsbuildinfo' -cf - . | tar -xf - -C /tmp/project
cd /tmp/project
npm exec --yes --package=pnpm@10.34.6 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.34.6 -- pnpm build
npm exec --yes --package=pnpm@10.34.6 -- pnpm check
npm exec --yes --package=pnpm@10.34.6 -- pnpm test:unit
node apps/cli/dist/index.js validate Docs/examples/mantis.bot.json
`;
const child=spawn('docker',['run','--rm','--name','nextgame-g0-linux-check','-v',`${resolve('.') }:/input:ro`,'node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d','sh','-c',shell],{stdio:'inherit'});
child.once('error',error=>{console.error(error);process.exitCode=1;});child.once('exit',code=>{process.exitCode=code??1;});
