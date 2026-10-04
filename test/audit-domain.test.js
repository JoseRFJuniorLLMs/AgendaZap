import test from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../src/domain.js';
import {converse} from '../src/conversation.js';
import {Store,MemoryStore} from '../src/store.js';
import {selectJobs,startWorker} from '../src/worker.js';
import {boundedRate,validUnicode} from '../src/limits.js';

function fixture(){
  const t=d.newTenant({name:'Audit',slug:'audit'},d.uid());t.min_notice_minutes=0;
  const s={id:d.uid(),name:'Corte',duration_minutes:30,price_cents:3000,deposit_cents:0,active:true};
  const p={id:d.uid(),name:'Ana',active:true,service_ids:[s.id],availability:Array.from({length:7},(_,weekday)=>({weekday,start:'09:00',end:'18:00'}))};
  t.services.push(s);t.professionals.push(p);
  const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
  const input={name:'Original',phone:'+5511999999999',email:'original@example.com',consent:true,service_id:s.id,professional_id:p.id,starts_at:d.localToUTC(date,'12:00',t.timezone),idempotency_key:d.uid()};
  return {t,s,p,date,input};
}
test('public and WhatsApp booking cannot overwrite existing CRM identity or consent',()=>{
  const {t,input,date}=fixture();d.book(t,input);const before=structuredClone(t.customers[0]);
  d.book(t,{...input,name:'Attacker',email:'fake@example.com',consent:false,starts_at:d.localToUTC(date,'13:00',t.timezone),idempotency_key:d.uid()});
  converse(t,{phone:input.phone,name:'Fake WhatsApp',text:'menu',message_id:d.uid()});
  assert.deepEqual(t.customers[0],before);
  d.customer(t,{phone:input.phone,name:'Trusted edit',consent:false},{trusted:true});assert.equal(t.customers[0].name,'Trusted edit');
});
test('abandoned reschedule followed by MENU creates a new appointment',()=>{
  const {t,input,date}=fixture();const old=d.book(t,input),original=old.starts_at;
  const send=text=>converse(t,{phone:input.phone,name:'Client',text,message_id:d.uid()});
  for(const text of ['menu','3','1','reagendar','menu','1','1',date,'1'])send(text);
  assert.equal(old.starts_at,original);assert.equal(t.appointments.length,2);assert.equal(t.conversations[0].rescheduling,false);
});
test('invalid date is answered and consecutive failure count resets on recognized input',()=>{
  const {t,input}=fixture();const send=text=>converse(t,{phone:input.phone,text,message_id:d.uid()});
  send('1');send('1');assert.match(send('2026-02-30'),/MENU/);assert.equal(t.conversations[0].state,'start');
  for(let i=0;i<5;i++){send('not understood');send('menu');}
  assert.equal(t.conversations[0].human_handoff,false);assert.equal(t.conversations[0].failures,0);
});
test('customer reschedule enforces cancellation deadline and preserves state on failed availability',()=>{
  const {t,input,date}=fixture();const a=d.book(t,input);t.cancellation_hours=200;
  assert.throws(()=>d.reschedule(t,a,{starts_at:d.localToUTC(date,'14:00',t.timezone)},'whatsapp'),/Prazo/);
  assert.equal(a.status,'confirmed');
  assert.throws(()=>d.reschedule(t,a,{starts_at:'bad'},'operator'));assert.equal(a.status,'confirmed');
});
test('returning to an old time and changing professional each creates fresh reminders',()=>{
  const {t,input,date,p}=fixture();const second={...p,id:d.uid()};t.professionals.push(second);const a=d.book(t,input);
  d.reschedule(t,a,{starts_at:d.localToUTC(date,'14:00',t.timezone)});
  d.reschedule(t,a,{starts_at:input.starts_at});
  d.reschedule(t,a,{starts_at:input.starts_at,professional_id:second.id});
  const pending=t.jobs.filter(j=>j.status==='pending'&&['confirmation','reminder'].includes(j.type));assert.equal(pending.length,2);
  assert(pending.every(j=>j.key===d.reminderKey(j.type,a)));
});
test('DST gap skips nonexistent slots and overlapping rules do not duplicate candidates',()=>{
  const {t,s,p}=fixture();t.timezone='America/New_York';t.horizon_days=365;p.availability=[{weekday:0,start:'01:00',end:'04:00'},{weekday:0,start:'01:00',end:'04:00'}];
  const slots=d.slots(t,s.id,'2027-03-14',p.id,Date.parse('2027-03-01T00:00:00Z'));
  assert(slots.some(s=>s.time==='03:00'));assert(!slots.some(s=>s.time.startsWith('02:')));assert.equal(new Set(slots.map(s=>s.starts_at)).size,slots.length);
});
test('waitlist is offered once and stops notifying a customer who already booked',()=>{
  const {t,input,s,date}=fixture();const old=d.book(t,input);const c=d.customer(t,{name:'Waiter',phone:'+5511888888888'});
  const w={id:d.uid(),customer_id:c.id,service_id:s.id,date,status:'waiting'};t.waitlist.push(w);
  d.transition(t,old,'cancelled_by_business');assert.equal(w.status,'offered');assert.equal(t.jobs.filter(j=>j.type==='waitlist').length,1);
  d.book(t,{...input,phone:c.phone,customer_id:c.id,idempotency_key:d.uid()});assert.equal(w.status,'booked');
});
test('refunded and charged-back payments cannot be resurrected by delayed approvals',()=>{
  for(const status of ['refunded','charged_back']){const {t,input,s}=fixture();s.deposit_cents=1000;const a=d.book(t,input,{paymentEnabled:true});const p={id:d.uid(),appointment_id:a.id,amount_cents:1000,status:'pending'};d.settle(t,p);d.reconcilePayment(t,p,status);d.reconcilePayment(t,p,'approved');assert.equal(p.status,status);assert.equal(a.payment_status,status);assert(p.needs_review);}
});
test('rate buckets are independent and bounded; invalid SQL Unicode is rejected before persistence',()=>{
  const map=new Map();for(let i=0;i<100;i++)boundedRate(map,String(i),{limit:1,capacity:10});assert.equal(map.size,10);
  assert(!boundedRate(map,'99',{limit:1,capacity:10}));assert(boundedRate(map,'99:voice',{limit:1,capacity:10}));
  assert(!validUnicode({name:'a\0b'}));assert(!validUnicode({name:'\ud800'}));assert(validUnicode({name:'Olá 🎉'}));
});
test('queue prioritizes replies and fairly includes later tenants',()=>{
  const state={tenants:{}};for(let i=0;i<4;i++){const t=d.newTenant({name:'Q',slug:'queue'+i},d.uid());state.tenants[t.id]=t;for(let j=0;j<50;j++)d.queue(t,'recovery',{},undefined,d.uid());d.queue(t,'reply',{},undefined,d.uid());}
  const jobs=selectJobs(state);assert.equal(jobs.length,50);assert(jobs.slice(0,4).every(x=>x.job.type==='reply'));assert.equal(new Set(jobs.map(x=>x.tenant.id)).size,4);
});
test('recoverable SQL data failure rolls back and permits a subsequent transaction',async()=>{
  const store=new Store({connectionString:'postgresql://unused'});store.healthy=true;let fail=true;
  store.client.query=async sql=>{if(sql.startsWith('SELECT revision'))return {rows:[{revision:'0'}]};if(sql.startsWith('UPDATE')&&fail){fail=false;throw Object.assign(new Error('bad Unicode'),{code:'22021'});}return {rows:[]};};
  await assert.rejects(store.transaction('bad',s=>{s.receipts.bad=true;}),e=>e.status===400);
  assert(store.healthy);assert(!store.state.receipts.bad);await store.transaction('good',s=>{s.receipts.good=true;});assert(store.state.receipts.good);
});
test('lost COMMIT acknowledgement reloads authoritative state before next write',async()=>{
  const store=new Store({connectionString:'postgresql://unused'});store.healthy=true;const authoritative={...store.state,receipts:{committed:true}};
  store.client.query=async sql=>{if(sql.startsWith('SELECT revision'))return {rows:[{revision:'0'}]};if(sql==='COMMIT')throw new Error('ack lost');if(sql.startsWith('SELECT payload'))return {rows:[{payload:authoritative}]};return {rows:[]};};
  await assert.rejects(store.transaction('test',s=>{s.receipts.committed=true;}));assert(store.healthy);assert.deepEqual(store.state,authoritative);
});
test('worker stop waits for the in-flight provider send and persists completion',async()=>{
  const {t,input}=fixture();const store=new MemoryStore();store.state.tenants[t.id]=t;t.integrations.phone_id='phone';
  converse(t,{phone:input.phone,text:'menu',message_id:d.uid()});
  const oldFetch=globalThis.fetch;let release,started;const ready=new Promise(r=>started=r);globalThis.fetch=async()=>{started();return new Promise(r=>release=()=>r(new Response('{"messages":[{"id":"sent"}]}',{headers:{'content-type':'application/json'}})));};
  const names=['WHATSAPP_ACCESS_TOKEN','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN'],oldEnv=Object.fromEntries(names.map(n=>[n,process.env[n]]));for(const n of names)process.env[n]='test';
  const stop=startWorker(store,{interval:100000});
  try{await ready;let done=false;const draining=stop().then(()=>done=true);await new Promise(r=>setImmediate(r));assert(!done);release();await draining;assert.equal(store.state.tenants[t.id].jobs[0].status,'done');}
  finally{await stop();globalThis.fetch=oldFetch;for(const n of names)if(oldEnv[n]===undefined)delete process.env[n];else process.env[n]=oldEnv[n];}
});
test('review template carries the review link and shutdown drains the send',async()=>{
  const {t,input}=fixture();t.review_url='https://example.test/review';const a=d.book(t,input);d.transition(t,a,'completed');t.jobs=t.jobs.filter(j=>j.type==='review');t.jobs[0].scheduled_at=new Date().toISOString();t.integrations.phone_id='phone';
  const store=new MemoryStore();store.state.tenants[t.id]=t;const names=['WHATSAPP_ACCESS_TOKEN','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_REVIEW_TEMPLATE'],oldEnv=Object.fromEntries(names.map(n=>[n,process.env[n]]));for(const n of names)process.env[n]='test';
  const oldFetch=globalThis.fetch;let sent,resolve;const done=new Promise(r=>resolve=r);globalThis.fetch=async(target,options)=>{sent=JSON.parse(options.body);resolve();return new Response('{"messages":[{"id":"sent"}]}',{headers:{'content-type':'application/json'}});};const stop=startWorker(store,{interval:100000});
  try{await done;await stop();assert(JSON.stringify(sent).includes(t.review_url));}finally{await stop();globalThis.fetch=oldFetch;for(const n of names)if(oldEnv[n]===undefined)delete process.env[n];else process.env[n]=oldEnv[n];}
});
test('public booking history guard stops phone-rotation abuse before availability work',()=>{
  const {t,input}=fixture();t.appointments=Array.from({length:100},()=>({source:'web',created_at:new Date().toISOString()}));assert.throws(()=>d.book(t,{...input,phone:'+5511888888888'}),e=>e.status===429);
});
