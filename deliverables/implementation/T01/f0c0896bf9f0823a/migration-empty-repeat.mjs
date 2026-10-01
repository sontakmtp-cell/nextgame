import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const db=`g0_check_${randomUUID().replaceAll('-','')}`,source=await readFile('migrations/001_g0.sql','utf8'),hash=createHash('sha256').update(source).digest('hex'),commands=[];
function psql(database,sql,expected=0){
  const args=['compose','exec','-T','postgres','sh','-c',`exec psql -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "${database}"`];
  const result=spawnSync('docker',args,{input:sql,encoding:'utf8'});commands.push({command:'docker',args,sql,exitCode:result.status,stdout:result.stdout,stderr:result.stderr,expected});assert.equal(result.status,expected,result.stderr);return result.stdout.trim();
}
const sql=`BEGIN;\nSELECT pg_advisory_xact_lock(7012026);\n${source}\nDO $$ BEGIN IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='001_g0' AND source_digest<>'${hash}') THEN RAISE EXCEPTION 'migration drift'; END IF; END $$;\nINSERT INTO schema_migrations VALUES ('001_g0','${hash}') ON CONFLICT DO NOTHING;\nCOMMIT;\n`;
try{
  psql('postgres',`CREATE DATABASE "${db}";`);
  assert.equal(psql(db,"SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"),'0');
  psql(db,sql);const before=psql(db,'SELECT version,source_digest FROM schema_migrations ORDER BY version;');
  psql(db,sql);assert.equal(psql(db,'SELECT version,source_digest FROM schema_migrations ORDER BY version;'),before);assert.equal(psql(db,'SELECT count(*) FROM schema_migrations;'),'1');
  const query="SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;";
  const schemaBefore=psql(db,query);psql(db,sql);const schemaAfter=psql(db,query);assert.equal(schemaAfter,schemaBefore);
  psql(db,sql.replaceAll(hash,'0'.repeat(64)),3);assert.equal(psql(db,'SELECT version,source_digest FROM schema_migrations ORDER BY version;'),before);
  console.log('Empty DB migration + repeated schema/data equivalence + modified digest rejection: passed');
}finally{psql('postgres',`DROP DATABASE IF EXISTS "${db}";`);await writeFile(new URL('./migration-empty-repeat.json',import.meta.url),JSON.stringify({timestamp:new Date().toISOString(),sourceHash:hash,commands},null,2)+'\n');}
