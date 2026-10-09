import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createApp} from '../src/server.js';
import {MemoryStore} from '../src/store.js';
import * as d from '../src/domain.js';

async function setup(t){
  const store=new MemoryStore(),server=createApp(store,{origin:'http://localhost'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const url=`http://127.0.0.1:${server.address().port}/AgendaZap/api`;
  async function request(path,{method='GET',body,session,headers={}}={}){const r=await fetch(url+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session.cookie,'x-csrf-token':session.csrf}:{}),...headers},body:body?JSON.stringify(body):undefined});let data;try{data=await r.json();}catch{}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
  const r=await request('/auth/register',{method:'POST',body:{name:'Owner',email:'audit@example.com',password:'Strong-test-password1',business_name:'Audit',slug:'audit'}});assert.equal(r.status,201);const session={...r.data,cookie:r.cookie},tenant=()=>store.state.tenants[session.tenant.id];
  const s={id:d.uid(),name:'Corte',duration_minutes:30,price_cents:3000,deposit_cents:0,active:true},p={id:d.uid(),name:'Ana',active:true,service_ids:[s.id],availability:Array.from({length:7},(_,weekday)=>({weekday,start:'09:00',end:'18:00'}))};tenant().services.push(s);tenant().professionals.push(p);
  const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
  return {store,request,session,tenant,s,p,date,url};
}
test('simulator completes a booking and cancellation without mutating real tenant state',async t=>{
  const {request,tenant,session,date}=await setup(t),before=structuredClone(tenant());
  for(const text of ['menu','1','1',date,'1','menu','3','1','cancelar']){const r=await request('/conversations/simulate',{method:'POST',session,body:{phone:'+5511999999999',name:'Simulated',text}});assert.equal(r.status,200);assert(r.data.simulated);}
  assert.deepEqual(tenant(),before);
});
test('voice authorization rejects normalization tricks, cross-site requests and unsafe requests without CSRF',async t=>{
  const {request,session}=await setup(t),prefix=`/AgendaZap/api/voice/config/${session.tenant.id}`;
  for(const path of [prefix+'/../../usage/other',prefix+'%2f..%2fother',prefix+'/../other','/AgendaZap/api/voice/config/other'])assert.equal((await request('/voice-authorize',{session,headers:{'x-original-uri':path}})).status,403);
  assert.equal((await request('/voice-authorize',{session,headers:{'x-original-uri':prefix+'?unrelated=/other'}})).status,204);
  assert.equal((await request('/voice-authorize',{session,headers:{'x-original-uri':prefix,'origin':'https://attacker.example'}})).status,403);
  assert.equal((await request('/voice-authorize',{session:{...session,csrf:''},headers:{'x-original-uri':prefix,'x-original-method':'PATCH'}})).status,403);
  assert.equal((await request('/voice-authorize',{session,headers:{'x-original-uri':prefix,'x-original-method':'PATCH'}})).status,204);
});
test('operator deposit booking returns tenant-scoped management link and separates payer email',async t=>{
  const {request,session,tenant,s,p,date}=await setup(t);s.deposit_cents=1000;
  const keyId=d.uid();tenant().pix={enabled:true,recipient_name:'AUDIT',recipient_city:'SAO PAULO',keys:[{id:keyId,type:'email',value:'audit@example.com'}],default_key_id:keyId};
  d.customer(tenant(),{phone:'+5511999999999',name:'CRM',email:'crm@example.com'});
  const r=await request('/appointments',{method:'POST',session,body:{name:'Payer',phone:'+5511999999999',email:'payer@example.com',service_id:s.id,professional_id:p.id,starts_at:d.localToUTC(date,'10:00',tenant().timezone),idempotency_key:d.uid()}});
  assert.equal(r.status,201);assert.equal(r.data.status,'awaiting_payment');assert(r.data.manage_url.includes('/#manage/'));assert(!r.data.manage_token);assert.equal(tenant().customers[0].email,'crm@example.com');
  assert.equal((await request(`/appointments/${r.data.id}/payment-link`,{session})).data.manage_url,r.data.manage_url);
  const hash=r.data.manage_url.split('/#manage/')[1],token=hash.split('/')[1];
  const managed=await request(`/public/appointments/${r.data.id}/manage`,{headers:{'x-booking-token':token}});assert.equal(managed.status,200);assert.equal(managed.data.payment.provider,'pix_manual');assert(managed.data.payment.qr_code);assert.equal(tenant().customers[0].email,'crm@example.com');
});
test('professional login immediately contains own professional id and allows own block',async t=>{
  const {request,session,p}=await setup(t);assert.equal((await request('/users',{method:'POST',session,body:{name:'Pro',email:'pro@example.com',password:'Strong-test-password1',role:'professional',professional_id:p.id}})).status,201);
  const r=await request('/auth/login',{method:'POST',body:{email:'pro@example.com',password:'Strong-test-password1'}});assert.equal(r.data.user.professional_id,p.id);
  assert.equal((await request('/blocks',{method:'POST',session:{...r.data,cookie:r.cookie},body:{professional_id:p.id,starts_at:'2027-01-01T09:00:00-03:00',ends_at:'2027-01-01T12:30:00Z',reason:'Block'}})).status,201);
});
test('mixed ISO offsets reject inverted blocks and invalid Unicode does not poison later requests',async t=>{
  const {request,session,p}=await setup(t);
  assert.equal((await request('/blocks',{method:'POST',session,body:{professional_id:p.id,starts_at:'2027-01-01T10:00:00-03:00',ends_at:'2027-01-01T12:00:00Z',reason:'Wrong'}})).status,400);
  assert.equal((await request('/customers',{method:'POST',session,body:{name:'NUL\0',phone:'+5511999999999'}})).status,400);
  assert.equal((await request('/customers',{method:'POST',session,body:{name:'Valid',phone:'+5511999999999',consent:false}})).status,201);
});
test('WhatsApp acknowledgements tolerate unrelated changes, oversized text and reactions without handoff',async t=>{
  const {request,tenant}=await setup(t);tenant().integrations.phone_id='12345';const old=process.env.WHATSAPP_APP_SECRET;process.env.WHATSAPP_APP_SECRET='test';t.after(()=>{if(old===undefined)delete process.env.WHATSAPP_APP_SECRET;else process.env.WHATSAPP_APP_SECRET=old;});
  const body={entry:[{changes:[{field:'other',value:{}},{field:'messages',value:{metadata:{phone_number_id:'12345'},messages:[{id:'large',from:'5511999999999',type:'text',text:{body:'a'.repeat(5000)}},{id:'reaction',from:'5511999999999',type:'reaction'}]}}]}]};
  const signature='sha256='+createHmac('sha256','test').update(JSON.stringify(body)).digest('hex');assert.equal((await request('/webhooks/whatsapp',{method:'POST',body,headers:{'x-hub-signature-256':signature}})).status,200);
  assert.equal(tenant().conversations[0].human_handoff,false);assert.equal(tenant().conversations[0].messages[0].text.length,4000);
});
test('old password login queued behind password change cannot mint a surviving session',async t=>{
  const {request,store,session}=await setup(t);let release;store.tail=new Promise(r=>release=r);const original=store.transaction.bind(store);let changed,logged;const changeQueued=new Promise(r=>changed=r),loginQueued=new Promise(r=>logged=r);
  store.transaction=(actor,fn)=>{const result=original(actor,fn);if(actor==='login')logged();else changed();return result;};
  const change=request('/auth/password',{method:'POST',session,body:{current:'Strong-test-password1',password:'Updated-test-password2'}});await changeQueued;
  const login=request('/auth/login',{method:'POST',body:{email:'audit@example.com',password:'Strong-test-password1'}});await loginQueued;release();
  assert.equal((await change).status,200);assert.equal((await login).status,401);assert.equal(Object.keys(store.state.sessions).length,0);
  assert.equal((await request('/auth/logout',{method:'POST',session,body:{}})).status,200);
});
test('platform billing is manual and former provider webhooks are removed',async t=>{
  const {request,session}=await setup(t);
  const config=await request('/billing',{session});assert.equal(config.data.provider,'manual');assert.equal(config.data.provider_configured,false);
  assert.equal((await request('/billing/checkout',{method:'POST',session,body:{plan_id:'founder'}})).status,503);
  assert.equal((await request('/webhooks/billing/mercadopago',{method:'POST',body:{data:{id:'old'}}})).status,404);
});
