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
  await store.close();
  const replay=new Store({schema});await replay.init();
  try{if(!replay.state.receipts.probe?.ok||replay.state.receipts.invalid)throw new Error('PostgreSQL reload failed');await replay.client.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await replay.close();}
  console.log('PASS PostgreSQL commit / rollback / reload / writer lock');
}finally{await store.close();}
