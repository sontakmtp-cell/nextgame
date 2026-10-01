import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
try{await readFile('.env');console.log('.env already exists; preserved');}
catch(error){if(error.code!=='ENOENT')throw error;const password=randomBytes(24).toString('hex');await writeFile('.env',`POSTGRES_DB=promptchien\nPOSTGRES_USER=promptchien\nPOSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://promptchien:${password}@127.0.0.1:15432/promptchien\nMINIO_ROOT_USER=local-${randomBytes(6).toString('hex')}\nMINIO_ROOT_PASSWORD=${randomBytes(24).toString('hex')}\nOBJECT_ENDPOINT=http://127.0.0.1:19000\nAPI_HOST=127.0.0.1\nAPI_PORT=3001\n`,{flag:'wx'});console.log('Created ignored local .env; credentials are not printed');}
