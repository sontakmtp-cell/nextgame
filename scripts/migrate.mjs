import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const source=await readFile('migrations/001_g0.sql','utf8'),hash=createHash('sha256').update(source).digest('hex');
const sql=`BEGIN;\nSELECT pg_advisory_xact_lock(7012026);\n${source}\nDO $$ BEGIN IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='001_g0' AND source_digest<>'${hash}') THEN RAISE EXCEPTION 'migration drift'; END IF; END $$;\nINSERT INTO schema_migrations VALUES ('001_g0','${hash}') ON CONFLICT DO NOTHING;\nCOMMIT;\n`;
const run=spawnSync('docker',['compose','exec','-T','postgres','sh','-c','exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],{input:sql,encoding:'utf8',stdio:['pipe','inherit','inherit']});
if(run.error)throw run.error;process.exitCode=run.status??1;
