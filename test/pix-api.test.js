import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';
import {MemoryStore} from '../src/store.js';
import * as d from '../src/domain.js';

async function setup(t){
 const store=new MemoryStore(),server=createApp(store,{origin:'http://localhost'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const url='http://127.0.0.1:'+server.address().port+'/AgendaZap/api';
 async function request(path,{method='GET',body,session,token}={}){const r=await fetch(url+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session.cookie,'x-csrf-token':session.csrf}:{}),...(token?{'x-booking-token':token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function register(slug){const r=await request('/auth/register',{method:'POST',body:{name:'Owner',email:slug+'@example.com',password:'Strong-test-password1',business_name:slug,slug}});assert.equal(r.status,201);return {...r.data,cookie:r.cookie};}
 const owner=await register('pix-hotel'),other=await register('other-hotel'),tenant=()=>store.state.tenants[owner.tenant.id];
 const s={id:d.uid(),name:'Reserva',active:true,duration_minutes:30,price_cents:5000,deposit_cents:1500},p={id:d.uid(),name:'Equipe',active:true,service_ids:[s.id],availability:Array.from({length:7},(_,weekday)=>({weekday,start:'09:00',end:'18:00'}))};tenant().services.push(s);tenant().professionals.push(p);const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
 const key=d.uid(),config={enabled:true,recipient_name:'Hotel Teste',recipient_city:'São Paulo',keys:[{id:key,type:'email',value:'hotel@example.com',label:'Conta principal'}],default_key_id:key};
 const booking=(time='10:00')=>({name:'Hóspede',phone:'+5511999999999',service_id:s.id,professional_id:p.id,starts_at:d.localToUTC(date,time,tenant().timezone),idempotency_key:d.uid()});
 return {store,request,owner,other,tenant,config,booking};
}
test('Pix configuration is owner-only, tenant-scoped, CSRF-protected and absent from public catalog',async t=>{
 const {request,owner,other,config}=await setup(t);
 assert.equal((await request('/settings/pix',{method:'PATCH',body:config})).status,401);
 assert.equal((await request('/settings/pix',{method:'PATCH',session:{...owner,csrf:'wrong'},body:config})).status,403);
 assert.equal((await request('/settings/pix',{method:'PATCH',session:owner,body:config})).status,200);
 assert.equal((await request('/settings',{session:other})).data.pix.keys.length,0);
 const publicData=(await request('/public/pix-hotel')).data;assert.equal(publicData.pix_enabled,true);assert(!JSON.stringify(publicData).includes('hotel@example.com'));
 await request('/users',{method:'POST',session:owner,body:{name:'Gerente',email:'manager@example.com',password:'Strong-test-password1',role:'manager'}});
 const login=await request('/auth/login',{method:'POST',body:{email:'manager@example.com',password:'Strong-test-password1'}}),manager={...login.data,cookie:login.cookie};
 assert.equal((await request('/settings/pix',{method:'PATCH',session:manager,body:config})).status,403);
 assert.equal((await request('/settings/pix',{method:'PATCH',session:owner,body:{...config,default_key_id:d.uid()}})).status,400);
 assert.equal((await request('/settings/pix',{method:'PATCH',session:owner,body:{...config,tenant_id:other.tenant.id}})).status,400);
});
test('public deposit booking creates a QR immediately and manual confirmation is isolated, audited and idempotent',async t=>{
 const {request,owner,other,tenant,config,booking}=await setup(t);
 assert.equal((await request('/public/pix-hotel/appointments',{method:'POST',body:booking()})).status,503);
 await request('/settings/pix',{method:'PATCH',session:owner,body:config});
 const payload=booking(),created=await request('/public/pix-hotel/appointments',{method:'POST',body:payload});assert.equal(created.status,201);assert.equal(created.data.appointment.status,'awaiting_payment');
 const aid=created.data.appointment.id,token=created.data.manage_token;
 assert.equal((await request('/public/pix-hotel/appointments',{method:'POST',body:payload})).data.appointment.id,aid);assert.equal(tenant().payments.length,1);
 const managed=await request('/public/appointments/'+aid+'/manage',{token});assert.equal(managed.status,200);const payment=managed.data.payment;assert(payment.qr_code.includes('hotel@example.com'));assert(payment.qr_code_base64);assert.equal(payment.amount_cents,1500);
 assert.equal((await request('/public/appointments/'+aid+'/manage')).status,404);
 const path='/payments/'+payment.id+'/confirm';assert.equal((await request(path,{method:'POST',body:{bank_reference:'E2E-1'}})).status,401);assert.equal((await request(path,{method:'POST',session:other,body:{bank_reference:'E2E-1'}})).status,404);
 assert.equal((await request(path,{method:'POST',session:owner,body:{bank_reference:''}})).status,400);
 assert.equal((await request(path,{method:'POST',session:owner,body:{bank_reference:'E2E-1'}})).status,200);const count=tenant().jobs.length;
 assert.equal((await request(path,{method:'POST',session:owner,body:{bank_reference:'E2E-1'}})).status,200);assert.equal(tenant().jobs.length,count);assert.equal(tenant().appointments[0].status,'confirmed');assert.equal(tenant().payments[0].confirmed_by,owner.user.id);assert(tenant().audit.some(a=>a.action==='payment.paid'&&a.actor===owner.user.id));
 const confirmed=await request('/public/appointments/'+aid+'/manage',{token});assert(!confirmed.data.payment.qr_code);
 const second=await request('/public/pix-hotel/appointments',{method:'POST',body:booking('11:00')});const pid=tenant().payments.find(p=>p.appointment_id===second.data.appointment.id).id;
 assert.equal((await request('/payments/'+pid+'/confirm',{method:'POST',session:owner,body:{bank_reference:'E2E-1'}})).status,409);
 assert.equal((await request('/payments/'+payment.id+'/refund',{method:'POST',session:owner,body:{bank_reference:'REFUND-1'}})).status,200);assert.equal(tenant().payments[0].status,'refunded');assert.equal((await request(path,{method:'POST',session:owner,body:{bank_reference:'E2E-1'}})).status,409);
});
test('key changes preserve issued charges and late receipt does not revive an expired slot',async t=>{
 const {store,request,owner,tenant,config,booking}=await setup(t);await request('/settings/pix',{method:'PATCH',session:owner,body:config});
 const first=await request('/public/pix-hotel/appointments',{method:'POST',body:booking()}),aid=first.data.appointment.id,payment=tenant().payments[0];
 await request('/settings/pix',{method:'PATCH',session:owner,body:{...config,keys:[{...config.keys[0],value:'new@example.com'}]}});
 const m=await request('/public/appointments/'+aid+'/manage',{token:first.data.manage_token});assert(m.data.payment.qr_code.includes('hotel@example.com'));
 await store.transaction('test-expire',state=>{const live=state.tenants[owner.tenant.id];live.appointments[0].expires_at=new Date(Date.now()-1000).toISOString();d.expire(live);});
 const expired=await request('/public/appointments/'+aid+'/manage',{token:first.data.manage_token});assert(!expired.data.payment.qr_code);
 const replacement=await request('/public/pix-hotel/appointments',{method:'POST',body:booking()});assert.equal(replacement.status,201);
 await request('/payments/'+payment.id+'/confirm',{method:'POST',session:owner,body:{bank_reference:'LATE-1'}});assert.equal(tenant().appointments[0].status,'expired');assert.equal(tenant().payments[0].needs_review,true);assert.equal(tenant().appointments[1].status,'awaiting_payment');
 await request('/settings/pix',{method:'PATCH',session:owner,body:{...config,enabled:false}});assert.equal((await request('/public/pix-hotel')).data.pix_enabled,false);assert.equal((await request('/public/pix-hotel/appointments',{method:'POST',body:booking('12:00')})).status,503);
});
