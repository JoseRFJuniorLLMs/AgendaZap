// Live QA on the requested installation. Only explicitly named fictional QA
// records are created. Credentials stay in the private ignored data directory.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
const origin=process.env.PUBLIC_ORIGIN||'https://35.247.217.66.nip.io';
const base=origin+'/AgendaZap/api';
let session;
async function req(path,{method='GET',body,auth=false}={}) {
  const res=await fetch(base+path,{method,headers:{origin,...(body?{'content-type':'application/json'}:{}),...(auth?{cookie:session.cookie,'x-csrf-token':session.csrf}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const data=await res.json();if(res.status>=500)throw new Error(`${path} ${res.status} ${data.error}`);return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
function expect(condition,message){if(!condition)throw new Error(message);console.log('PASS '+message);}
const file='data/live-qa.json';
if(process.argv[2]==='create') {
  mkdirSync('data',{recursive:true});
  const qa={name:'Validação AgendaZap',email:`qa-${randomBytes(4).toString('hex')}@example.invalid`,password:randomBytes(24).toString('base64url'),slug:'agendazap-qa-'+randomBytes(3).toString('hex'),date:new Date(Date.now()+4*86400000).toISOString().slice(0,10)};
  let r=await req('/auth/register',{method:'POST',body:{name:qa.name,email:qa.email,password:qa.password,business_name:'AgendaZap · QA fictício',slug:qa.slug}});expect(r.status===201,'registration on PostgreSQL');session={...r.data,cookie:r.cookie};
  r=await req('/services',{method:'POST',auth:true,body:{name:'Serviço fictício de QA',duration_minutes:30,price_cents:5000,deposit_cents:0,active:true}});expect(r.status===201,'catalog persistence');qa.service_id=r.data.id;
  r=await req('/professionals',{method:'POST',auth:true,body:{name:'Profissional fictício QA',active:true,service_ids:[qa.service_id],availability:Array.from({length:7},(_,weekday)=>({weekday,start:'09:00',end:'18:00'}))}});expect(r.status===201,'professional persistence');qa.professional_id=r.data.id;
  r=await req(`/public/${qa.slug}/availability?service_id=${qa.service_id}&date=${qa.date}`);expect(r.status===200&&r.data.length>0,'public availability');
  const booking={name:'Cliente fictício QA',phone:'+5511000000000',consent:false,service_id:qa.service_id,professional_id:qa.professional_id,starts_at:r.data[0].starts_at,idempotency_key:randomUUID()};
  const attempts=await Promise.all([req(`/public/${qa.slug}/appointments`,{method:'POST',body:booking}),req(`/public/${qa.slug}/appointments`,{method:'POST',body:{...booking,idempotency_key:randomUUID()}})]);
  expect(attempts.filter(x=>x.status===201).length===1&&attempts.filter(x=>x.status===409).length===1,'concurrency on real persistence');
  qa.appointment_id=attempts.find(x=>x.status===201).data.appointment.id;
  writeFileSync(file,JSON.stringify(qa),{mode:0o600});
  console.log('QA credentials stored privately; restart app then run verify');
}else {
  const qa=JSON.parse(readFileSync(file,'utf8'));
  let r=await req('/auth/login',{method:'POST',body:{email:qa.email,password:qa.password}});expect(r.status===200,'account survives restart');session={...r.data,cookie:r.cookie};
  r=await req('/appointments',{auth:true});expect(r.status===200&&r.data.some(a=>a.id===qa.appointment_id&&a.status==='confirmed'),'booking survives restart');
  r=await req(`/appointments/${qa.appointment_id}/status`,{method:'POST',auth:true,body:{status:'cancelled_by_business'}});expect(r.status===200,'QA booking cancelled after verification');
  r=await req('/dashboard?date='+qa.date,{auth:true});expect(r.data.metrics.cancelled===1&&r.data.metrics.expected_revenue===0,'replayed metrics reflect cancellation');
}

