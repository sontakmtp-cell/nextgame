import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Extract only: no installer execution, registry changes or global PATH mutation.
const dir = resolve('.local/u3d01/ktx');
const url = 'https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Windows-x64.exe';
const expected = '1f323b0fec19794f5e6c0425a61d4b1da396872a10be862d105f4f4b2d2957fe';
await mkdir(dir, { recursive: true });
const installer = resolve(dir, 'KTX-Software-4.4.2-Windows-x64.exe');
let data;
try { data = await readFile(installer); } catch (e) {
  if (e.code !== 'ENOENT') throw e;
  // curl honors the Windows/network proxy environment; download is bounded.
  execFileSync('curl.exe', ['--fail', '--location', '--connect-timeout', '15', '--max-time', '600', '--output', installer, url], { stdio: 'inherit' });
  data = await readFile(installer);
}
if (createHash('sha256').update(data).digest('hex') !== expected) throw Error('KTX release checksum mismatch');
await writeFile(installer, data);
execFileSync(resolve('tools/u3d01/node_modules/7zip-bin-full/win/x64/7z.exe'), ['x', installer, `-o${dir}`, '-y'], { stdio: 'ignore' });
console.log(execFileSync(resolve(dir, 'bin/toktx.exe'), ['--version'], { encoding: 'utf8' }).trim());
await writeFile(resolve(dir, 'provenance.json'), JSON.stringify({ url, sha256: expected, version: '4.4.2', mode: '7zip extraction; installer never executed' }, null, 2) + '\n');
