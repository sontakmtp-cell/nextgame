import { mkdir, writeFile } from 'node:fs/promises';
const deps = { contracts: {ajv:'8.20.0'}, content: {'@prompt-chien/contracts':'workspace:*'}, brain: {'@prompt-chien/contracts':'workspace:*'} };
for (const [name, dependencies] of Object.entries(deps)) {
  const dir = `packages/${name}`;
  await mkdir(`${dir}/src`, {recursive:true});
  await writeFile(`${dir}/package.json`, JSON.stringify({name:`@prompt-chien/${name}`,version:'0.0.0',private:true,type:'module',exports:{'.':'./dist/index.js'},types:'./dist/index.d.ts',dependencies},null,2)+'\n');
  const references = name === 'contracts' ? [] : [{path:'../contracts'}];
  await writeFile(`${dir}/tsconfig.json`,JSON.stringify({extends:'../../tsconfig.base.json',compilerOptions:{rootDir:'src',outDir:'dist'},include:['src/**/*.ts'],references},null,2)+'\n');
}
await writeFile('tsconfig.json',JSON.stringify({files:[],references:['packages/contracts','packages/content','packages/brain','apps/api','apps/cli','apps/web'].map(path=>({path}))},null,2)+'\n');
