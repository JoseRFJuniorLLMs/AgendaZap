import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {decryptSnapshot} from '../src/backup.js';
import {Store} from '../src/store.js';
if(!process.env.BACKUP_KEY_FILE||!process.env.DATABASE_URL)throw new Error('Set backup key and DATABASE_URL');
const directory='data/backups',file=readdirSync(directory).filter(f=>f.endsWith('.azbk')).sort().at(-1);
const snapshot=decryptSnapshot(readFileSync(directory+'/'+file),Buffer.from(readFileSync(process.env.BACKUP_KEY_FILE,'utf8').trim(),'hex'));
const expected=Object.keys(snapshot.state.tenants).length;if(!expected)throw new Error('Nonempty backup required');
const schema='agendazap_restore_'+randomUUID().replace(/-/g,'');
execFileSync(process.execPath,['scripts/restore-backup.js','--isolated-empty-target',directory+'/'+file],{stdio:'inherit',env:{...process.env,DATABASE_SCHEMA:schema}});
const restored=new Store({schema});await restored.init();
try{
  if(Object.keys(restored.state.tenants).length!==expected||Object.values(restored.state.sessions).some(s=>!s.revoked))throw new Error('Restore mismatch');
  await restored.client.query(`DROP SCHEMA "${schema}" CASCADE`);
}finally{await restored.close();}
console.log('PASS AES-GCM backup / isolated PostgreSQL restore / revoked sessions');
