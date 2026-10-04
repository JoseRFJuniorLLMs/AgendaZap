import {readFileSync,readdirSync} from 'node:fs';
import {decryptSnapshot} from '../src/backup.js';
const directory=process.env.BACKUP_DIR||'data/backups';
const file=readdirSync(directory).filter(f=>f.endsWith('.azbk')).sort().at(-1);
if(!file||!process.env.BACKUP_KEY_FILE)throw new Error('Backup/key unavailable');
const key=Buffer.from(readFileSync(process.env.BACKUP_KEY_FILE,'utf8').trim(),'hex');
const snapshot=decryptSnapshot(readFileSync(directory+'/'+file),key);
console.log('PASS encrypted backup integrity; tenants='+Object.keys(snapshot.state.tenants).length);
console.log(directory+'/'+file);
