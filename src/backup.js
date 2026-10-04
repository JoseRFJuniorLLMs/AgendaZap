import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,renameSync,readdirSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';

export function encryptSnapshot(state,key) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const body=Buffer.from(JSON.stringify({version:1,at:new Date().toISOString(),state}));
  const encrypted=Buffer.concat([cipher.update(body),cipher.final()]);
  return Buffer.concat([Buffer.from('AZBK1'),iv,cipher.getAuthTag(),encrypted]);
}
export function decryptSnapshot(bytes,key) {
  if(bytes.subarray(0,5).toString()!=='AZBK1')throw new Error('Invalid backup format');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(5,17));decipher.setAuthTag(bytes.subarray(17,33));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(33)),decipher.final()]).toString());
}
export function saveBackup(state,{directory=process.env.BACKUP_DIR||resolve(process.env.DATA_DIR||'data','backups'),keyFile=process.env.BACKUP_KEY_FILE}={}) {
  if(!keyFile)return null;
  const key=Buffer.from(readFileSync(keyFile,'utf8').trim(),'hex');if(key.length!==32)throw new Error('Backup key must be 32 bytes');
  mkdirSync(directory,{recursive:true,mode:0o700});
  const name='agendazap-'+new Date().toISOString().replace(/[:.]/g,'-')+'.azbk',target=resolve(directory,name);
  writeFileSync(target+'.tmp',encryptSnapshot(state,key),{mode:0o600});renameSync(target+'.tmp',target);
  // Only this application's own snapshot files.
  const files=readdirSync(directory).filter(x=>/^agendazap-.*\.azbk$/.test(x)).sort();
  for(const name of files.slice(0,-30))unlinkSync(resolve(directory,name));
  return target;
}
export function startBackups(store) {
  const run=()=>{try{if(store.healthy){const file=saveBackup(store.state);if(file)console.log(JSON.stringify({event:'backup_created'}));}}catch(error){console.error(JSON.stringify({event:'backup_failed',error_type:error.constructor.name}));}};
  run();const timer=setInterval(run,24*3600000);timer.unref();return ()=>clearInterval(timer);
}
