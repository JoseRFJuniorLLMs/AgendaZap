import {readFileSync} from 'node:fs';
import {Store} from '../src/store.js';
import {decryptSnapshot} from '../src/backup.js';
if(process.argv[2]!=='--isolated-empty-target'||!process.argv[3]||!process.env.BACKUP_KEY_FILE||!process.env.DATABASE_URL||!process.env.DATABASE_SCHEMA||process.env.DATABASE_SCHEMA==='agendazap')throw new Error('Usage: isolated DATABASE_SCHEMA / DATABASE_URL / BACKUP_KEY_FILE; restore-backup.js --isolated-empty-target FILE');
const snapshot=decryptSnapshot(readFileSync(process.argv[3]),Buffer.from(readFileSync(process.env.BACKUP_KEY_FILE,'utf8').trim(),'hex'));
if(snapshot.version!==1)throw new Error('Unsupported backup schema');
const store=new Store();await store.init();
try{
  if(Object.values(store.state).some(group=>Object.keys(group).length))throw new Error('Target is not empty; restore refused');
  for(const session of Object.values(snapshot.state.sessions))session.revoked=true;
  await store.transaction('isolated-restore',state=>{Object.assign(state,snapshot.state);});
  console.log('Restored isolated PostgreSQL schema; sessions revoked');
}finally{await store.close();}
