import {randomUUID, createHash, scryptSync, randomBytes, timingSafeEqual} from 'node:crypto';

export class Problem extends Error { constructor(status, message) { super(message); this.status=status; } }
export const fail = (message, status=400) => { throw new Problem(status,message); };
export const uid = () => randomUUID();
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function passwordHash(password) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function passwordValid(password, stored) { const [salt, hash]=stored.split(':'); const actual=scryptSync(password,salt,64); const expected=Buffer.from(hash,'hex'); return actual.length===expected.length && timingSafeEqual(actual,expected); }
export const ACTIVE = ['pending','awaiting_payment','confirmed','checked_in'];
export const TRANSITIONS = {pending:['confirmed','cancelled_by_customer','cancelled_by_business'],awaiting_payment:['confirmed','expired','cancelled_by_customer','cancelled_by_business'],confirmed:['checked_in','completed','no_show','cancelled_by_customer','cancelled_by_business'],checked_in:['completed']};
export const overlap = (a,b,c,d) => Date.parse(a)<Date.parse(d) && Date.parse(c)<Date.parse(b);
export const entity = (tenant,type,id) => tenant[type].find(x=>x.id===id) || fail('Registro não encontrado',404);
export function audit(t, actor, action, id) { t.audit.push({id:uid(),at:new Date().toISOString(),actor,action,entity_id:id}); }
export function newTenant({name,slug,timezone='America/Sao_Paulo'}, accountId) {
  try { new Intl.DateTimeFormat('pt-BR',{timeZone:timezone}); } catch { fail('Timezone inválido'); }
  const id=uid();
  return {id,name,slug,timezone,owner_id:accountId,created_at:new Date().toISOString(),address:'',review_url:'',min_notice_minutes:60,horizon_days:90,buffer_minutes:0,cancellation_hours:24,recovery_days:60,services:[],professionals:[],customers:[],appointments:[],blocks:[],waitlist:[],payments:[],conversations:[],jobs:[],audit:[],idempotency:{},integrations:{phone_id:''}};
}
export function localParts(instant, timezone) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, minutes:Number(p.hour)*60+Number(p.minute)};
}
export function localToUTC(date, time, timezone) {
  const target=Date.parse(`${date}T${time}:00Z`); let guess=target;
  for(let i=0;i<3;i++){ const p=localParts(guess,timezone); const actual=Date.parse(`${p.date}T00:00:00Z`)+p.minutes*60000; guess+=target-actual; }
  const check=localParts(guess,timezone); if(check.date!==date || check.minutes!==parseTime(time)) fail('Horário local inexistente');
  return new Date(guess).toISOString();
}
export function parseTime(time) {const [h,m]=time.split(':').map(Number); return h*60+m;}
export function slots(t, serviceId, date, professionalId, now=Date.now()) {
  const s=entity(t,'services',serviceId); if(!s.active) return [];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fail('Data inválida');
  const day=new Date(`${date}T12:00:00Z`).getUTCDay(); const result=[];
  for(const p of t.professionals.filter(p=>p.active && (!professionalId || p.id===professionalId) && p.service_ids.includes(s.id))) {
    for(const rule of p.availability.filter(r=>r.weekday===day)) {
      for(let minute=parseTime(rule.start);minute+s.duration_minutes+t.buffer_minutes<=parseTime(rule.end);minute+=15) {
        const time=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
        const start=localToUTC(date,time,t.timezone), end=new Date(Date.parse(start)+(s.duration_minutes+t.buffer_minutes)*60000).toISOString();
        if(Date.parse(start)<now+t.min_notice_minutes*60000 || Date.parse(start)>now+t.horizon_days*86400000) continue;
        const busy=t.appointments.some(a=>a.professional_id===p.id && ACTIVE.includes(a.status) && !(a.status==='awaiting_payment' && Date.parse(a.expires_at)<=now) && overlap(start,end,a.starts_at,a.ends_at));
        if(!busy && !t.blocks.some(b=>b.professional_id===p.id && overlap(start,end,b.starts_at,b.ends_at))) result.push({starts_at:start,ends_at:end,time,professional_id:p.id,professional_name:p.name});
      }
    }
  }
  return result.sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
}
export function customer(t, data) {
  if(!/^\+[1-9]\d{7,14}$/.test(data.phone)) fail('Telefone deve incluir + e código do país');
  let c=t.customers.find(c=>c.phone===data.phone);
  if(!c) {c={id:uid(),name:data.name,phone:data.phone,consent:false,consents:[],created_at:new Date().toISOString(),last_visit_at:null,tags:[]};t.customers.push(c);}
  if(data.name) c.name=data.name;
  if(data.email)c.email=data.email;
  if(data.consent!==undefined) {c.consent=data.consent;c.consents.push({at:new Date().toISOString(),purpose:'marketing',channel:data.source||'web',granted:data.consent});}
  return c;
}
export function queue(t,type,payload,scheduledAt=new Date().toISOString(),key='') {
  if(key && t.jobs.some(j=>j.key===key)) return;
  t.jobs.push({id:uid(),type,payload,scheduled_at:scheduledAt,status:'pending',attempts:0,key});
}
export function book(t,data,{actor='customer',source='web',now=Date.now(),paymentEnabled=false}={}) {
  const fingerprint=hashToken(JSON.stringify(data));
  if(data.idempotency_key && t.idempotency[data.idempotency_key]) {const cached=t.idempotency[data.idempotency_key];if(cached.fingerprint!==fingerprint) fail('Chave de idempotência reutilizada',409);return entity(t,'appointments',cached.id);}
  const s=entity(t,'services',data.service_id), p=entity(t,'professionals',data.professional_id);
  const date=localParts(data.starts_at,t.timezone).date;
  const slot=slots(t,s.id,date,p.id,now).find(x=>Date.parse(x.starts_at)===Date.parse(data.starts_at));
  if(!slot) fail('Este horário não está mais disponível',409);
  if(s.deposit_cents && !paymentEnabled) fail('PIX ainda não foi configurado pelo estabelecimento',503);
  const c=data.customer_id?entity(t,'customers',data.customer_id):customer(t,{name:data.name,phone:data.phone,email:data.email,consent:data.consent,source});
  const a={id:uid(),customer_id:c.id,professional_id:p.id,service_id:s.id,starts_at:slot.starts_at,ends_at:slot.ends_at,status:s.deposit_cents?'awaiting_payment':'confirmed',price_cents:s.price_cents,deposit_cents:s.deposit_cents,payment_status:'unpaid',source,created_at:new Date(now).toISOString(),expires_at:s.deposit_cents?new Date(now+15*60000).toISOString():null,manage_token:randomBytes(24).toString('hex'),campaign_id:data.campaign_id||null};
  t.appointments.push(a);
  if(data.idempotency_key)t.idempotency[data.idempotency_key]={id:a.id,fingerprint};
  audit(t,actor,'appointment.created',a.id);
  if(s.deposit_cents) queue(t,'create_payment',{appointment_id:a.id},undefined,`payment:${a.id}`);
  else scheduleReminders(t,a,now);
  return a;
}
export function scheduleReminders(t,a,now=Date.now()) {
  queue(t,'confirmation',{appointment_id:a.id},undefined,`confirmation:${a.id}:${a.starts_at}`);
  const at=Date.parse(a.starts_at)-86400000;
  if(at>now)queue(t,'reminder',{appointment_id:a.id},new Date(at).toISOString(),`reminder:${a.id}:${a.starts_at}`);
}
export function transition(t,a,status,actor='operator',now=Date.now()) {
  if(!(TRANSITIONS[a.status]||[]).includes(status))fail(`Transição inválida: ${a.status} → ${status}`,409);
  if(a.status==='awaiting_payment' && status==='confirmed')fail('Confirmação depende de pagamento verificado',409);
  a.status=status;a.updated_at=new Date(now).toISOString();audit(t,actor,`appointment.${status}`,a.id);
  if(status==='completed') {const c=entity(t,'customers',a.customer_id);c.last_visit_at=new Date(now).toISOString(); if(t.review_url)queue(t,'review',{customer_id:c.id,appointment_id:a.id},new Date(now+2*3600000).toISOString(),`review:${a.id}`);}
  if(status.startsWith('cancelled')) {
    t.jobs.filter(j=>j.payload.appointment_id===a.id && j.status==='pending').forEach(j=>j.status='cancelled');
    for(const w of t.waitlist.filter(w=>w.status==='waiting' && w.service_id===a.service_id && (!w.professional_id || w.professional_id===a.professional_id) && w.date===localParts(a.starts_at,t.timezone).date))queue(t,'waitlist',{customer_id:w.customer_id,waitlist_id:w.id,starts_at:a.starts_at},undefined,`waitlist:${w.id}:${a.id}`);
  }
  return a;
}
export function reschedule(t,a,data,actor='operator',now=Date.now()) {
  if(!['pending','confirmed'].includes(a.status))fail('Agendamento não pode ser reagendado neste estado',409);
  const previous=a.status; a.status='expired';
  const date=localParts(data.starts_at,t.timezone).date;
  const slot=slots(t,a.service_id,date,data.professional_id||a.professional_id,now).find(x=>Date.parse(x.starts_at)===Date.parse(data.starts_at));
  if(!slot) {a.status=previous;fail('Horário indisponível',409);}
  a.status=previous;a.starts_at=slot.starts_at;a.ends_at=slot.ends_at;a.professional_id=slot.professional_id;
  t.jobs.filter(j=>j.payload.appointment_id===a.id && j.status==='pending').forEach(j=>j.status='cancelled');
  scheduleReminders(t,a,now);audit(t,actor,'appointment.rescheduled',a.id);return a;
}
export function settle(t,payment,now=Date.now()) {
  const a=entity(t,'appointments',payment.appointment_id);
  if(payment.status==='paid')return a;
  if(payment.amount_cents!==a.deposit_cents)fail('Valor de pagamento divergente',409);
  payment.status='paid';payment.paid_at=new Date(now).toISOString();a.payment_status='paid';
  if(a.status==='awaiting_payment' && Date.parse(a.expires_at)>now) {a.status='confirmed';scheduleReminders(t,a,now);}
  else {payment.needs_review=true;queue(t,'payment_review',{appointment_id:a.id},undefined,`review-payment:${payment.id}`);}
  audit(t,'payment-provider','payment.paid',payment.id);return a;
}
export function expire(t,now=Date.now()) {
  for(const a of t.appointments.filter(a=>a.status==='awaiting_payment' && Date.parse(a.expires_at)<=now))transition(t,a,'expired','worker',now);
}
export function metrics(t,date) {
  const rows=t.appointments.filter(a=>localParts(a.starts_at,t.timezone).date===date);
  return {appointments:rows.length,confirmed:rows.filter(a=>ACTIVE.includes(a.status)).length,expected_revenue:rows.filter(a=>!a.status.startsWith('cancelled') && a.status!=='expired').reduce((sum,a)=>sum+a.price_cents,0),received_revenue:t.payments.filter(p=>p.status==='paid' && localParts(p.paid_at,t.timezone).date===date).reduce((sum,p)=>sum+p.amount_cents,0),cancelled:rows.filter(a=>a.status.startsWith('cancelled')).length,no_show:rows.filter(a=>a.status==='no_show').length,recoverable:t.customers.filter(c=>c.consent && c.last_visit_at && Date.parse(c.last_visit_at)<Date.now()-t.recovery_days*86400000).length,recovered_revenue:t.appointments.filter(a=>a.campaign_id && a.status==='completed').reduce((sum,a)=>sum+a.price_cents,0)};
}
