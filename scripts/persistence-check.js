import {randomUUID} from 'node:crypto';
import {Store} from '../src/store.js';
const schema='agendazap_probe_'+randomUUID().replace(/-/g,'');
const store=new Store({schema});await store.init();
try{
  await store.transaction('probe',state=>{state.receipts.probe={ok:true};});
  const duplicate=new Store({schema});
  await duplicate.init().then(()=>{throw new Error('Second writer accepted');},error=>{if(!error.message.includes('already running'))throw error;});
  const before=JSON.stringify(store.state);
  await store.transaction('rejected',state=>{state.receipts.invalid=true;throw new Error('domain rejection');}).catch(error=>{if(error.message!=='domain rejection')throw error;});
  if(JSON.stringify(store.state)!==before||!store.healthy)throw new Error('Domain rollback failed');
  await store.transaction('invalid-unicode',state=>{state.receipts.invalid='NUL\0';}).then(()=>{throw new Error('Invalid SQL text accepted');},error=>{if(!/^22/.test(error.code||'')||error.status!==400)throw error;});
  if(JSON.stringify(store.state)!==before||!store.healthy)throw new Error('SQL data rollback poisoned store');
  await store.transaction('after-sql-error',state=>{state.receipts.recovered=true;});
  await store.close();
  const replay=new Store({schema});await replay.init();
  try{if(!replay.state.receipts.probe?.ok||replay.state.receipts.invalid)throw new Error('PostgreSQL reload failed');await replay.client.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await replay.close();}
  console.log('PASS PostgreSQL commit / domain rollback / SQL error recovery / reload / writer lock');
}finally{await store.close();}
