import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('packages/content/src',{recursive:true});
const values=fn=>Array.from({length:4096},(_,i)=>Math.round(fn(i*Math.PI*2/4096)*1000000));
await writeFile('packages/content/src/lut.ts',`// Generated offline once; do not calculate trigonometry in the runtime.\nexport const SIN: readonly number[] = ${JSON.stringify(values(Math.sin))};\nexport const COS: readonly number[] = ${JSON.stringify(values(Math.cos))};\n`);
await writeFile('packages/content/src/manifest.ts','export const contentManifest = {} as const;\n');
await writeFile('packages/brain/src/identity.ts',`export const COMPILER_DIGEST = '${'0'.repeat(64)}';\n`);
