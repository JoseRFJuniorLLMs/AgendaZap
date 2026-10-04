import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';
import {MemoryStore} from '../src/store.js';
import {localToUTC,uid} from '../src/domain.js';

const store=new MemoryStore(),app=createApp(store,{basePath:'/AgendaZap',origin:'http://localhost',secure:false});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}/AgendaZap/api`;
after(()=>server.close());
async function request(path,{method='GET',body,session,headers={}}={}) {const response=await fetch(url+path,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(session?{cookie:session.cookie,'x-csrf-token':session.csrf}:{}),...headers},body:body!==undefined?JSON.stringify(body):undefined});const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function register(slug) {const r=await request('/auth/register',{method:'POST',body:{name:'Owner',email:slug+'@example.com',password:'Strong-test-password1',business_name:slug,slug}});assert.equal(r.status,201);return {...r.data,cookie:r.cookie};}
test('end-to-end: onboarding, public booking, tenant isolation, CSRF and RBAC',async()=>{
  const alice=await register('studio-alice'),bob=await register('studio-bob');
  let r=await request('/services',{method:'POST',session:alice,body:{name:'Corte',duration_minutes:30,price_cents:5000,deposit_cents:0,active:true}});assert.equal(r.status,201);const service=r.data;
  r=await request('/professionals',{method:'POST',session:alice,body:{name:'Ana',active:true,service_ids:[service.id],availability:Array.from({length:7},(_,weekday)=>({weekday,start:'09:00',end:'18:00'}))}});assert.equal(r.status,201);const professional=r.data;
  const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
  r=await request(`/public/studio-alice/availability?service_id=${service.id}&date=${date}`);assert.equal(r.status,200);assert(r.data.length>0);const slot=r.data[0];
  const payload={name:'Marina',phone:'+5511888887777',consent:false,service_id:service.id,professional_id:professional.id,starts_at:slot.starts_at,idempotency_key:uid()};
  r=await request('/public/studio-alice/appointments',{method:'POST',body:payload});assert.equal(r.status,201);const booking=r.data;
  assert.equal((await request('/public/studio-alice/appointments',{method:'POST',body:payload})).data.appointment.id,booking.appointment.id);
  assert.equal((await request('/public/studio-alice/appointments',{method:'POST',body:{...payload,idempotency_key:uid()}})).status,409);
  assert.equal((await request(`/services/${service.id}`,{method:'PATCH',session:bob,body:service})).status,400); // unknown id field rejected before access
  assert.equal((await request(`/services/${service.id}`,{method:'PATCH',session:bob,body:{name:'Fake',duration_minutes:30,price_cents:0,deposit_cents:0,active:true}})).status,404);
  assert.deepEqual((await request('/customers',{session:bob})).data,[]);
  assert.equal((await request('/customers')).status,401);
  assert.equal((await request('/services',{method:'POST',session:{...alice,csrf:'wrong'},body:{}})).status,403);
  assert.equal((await request('/auth/login',{method:'POST',body:{email:'studio-alice@example.com',password:'wrong'}})).status,401);
  assert.equal((await request('/auth/login',{method:'POST',body:{email:'studio-alice@example.com',password:'Strong-test-password1'}})).status,200);
  r=await request('/users',{method:'POST',session:alice,body:{name:'Atendente',email:'staff@example.com',password:'Strong-test-password1',role:'attendant'}});assert.equal(r.status,201);
  r=await request('/auth/login',{method:'POST',body:{email:'staff@example.com',password:'Strong-test-password1'}});const staff={...r.data,cookie:r.cookie};
  assert.equal((await request('/settings',{session:staff})).status,403);
  assert.equal((await request('/payments',{session:staff})).status,403);
  assert.equal((await request('/public/studio-bob/appointments',{method:'POST',body:{...payload,idempotency_key:uid()}})).status,404);
  r=await request(`/public/appointments/${booking.appointment.id}/manage`,{headers:{'x-booking-token':booking.manage_token}});assert.equal(r.status,200);assert.equal(r.data.appointment.manage_token,undefined);
  assert.equal((await request(`/public/appointments/${booking.appointment.id}/manage`)).status,404);
  r=await request(`/public/appointments/${booking.appointment.id}/cancel`,{method:'POST',body:{},headers:{'x-booking-token':booking.manage_token}});assert.equal(r.status,200);
  r=await request('/dashboard?date='+date,{session:alice});assert.equal(r.data.metrics.cancelled,1);assert.equal(r.data.metrics.expected_revenue,0);
  assert.equal((await request('/auth/logout',{method:'POST',session:alice,body:{}})).status,200);
  assert.equal((await request('/auth/me',{session:alice})).status,401);
});
test('webhooks reject unsigned payloads and strict schemas block mass assignment',async()=>{
  assert.equal((await request('/webhooks/whatsapp',{method:'POST',body:{entry:[]}})).status,401);
  assert.equal((await request('/webhooks/payments/mercadopago',{method:'POST',body:{data:{id:'123'}}})).status,401);
  assert.equal((await request('/auth/register',{method:'POST',body:{name:'Bad',email:'bad@example.com',password:'Strong-password1',business_name:'Bad',slug:'bad-studio',role:'owner',tenant_id:'other'}})).status,400);
});
test('published root redirects once and serves application without a redirect loop',async()=>{
  const root=url.replace(/\/api$/,'');
  const withoutSlash=await fetch(root,{redirect:'manual'});assert.equal(withoutSlash.status,308);assert.equal(withoutSlash.headers.get('location'),'/AgendaZap/');
  const response=await fetch(root+'/');assert.equal(response.status,200);assert.match(await response.text(),/id="app"/);
});
