import {createPixPayment,pixEnabled} from './pix.js';
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
const formatters=new Map();
export function localParts(instant, timezone) {
  let formatter=formatters.get(timezone);
  if(!formatter){formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});if(formatters.size>=64)formatters.delete(formatters.keys().next().value);formatters.set(timezone,formatter);}
  const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
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
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) fail('Data inválida');
  const day=new Date(`${date}T12:00:00Z`).getUTCDay(); const result=[],starts=new Map(),busyByProfessional=new Map(),blocksByProfessional=new Map();
  const midnight=Date.parse(date),windowStart=midnight-86400000,windowEnd=midnight+2*86400000;
  const index=(map,row)=>{if(Date.parse(row.starts_at)>=windowEnd||Date.parse(row.ends_at)<=windowStart)return;const rows=map.get(row.professional_id)||[];rows.push(row);map.set(row.professional_id,rows);};
  for(const a of t.appointments)if(ACTIVE.includes(a.status)&&!(a.status==='awaiting_payment'&&Date.parse(a.expires_at)<=now))index(busyByProfessional,a);
  for(const b of t.blocks)index(blocksByProfessional,b);
  for(const p of t.professionals.filter(p=>p.active && (!professionalId || p.id===professionalId) && p.service_ids.includes(s.id))) {
    const seen=new Set();
    // Keep each rule's 15-minute grid; deduplicate before expensive timezone conversion.
    for(const rule of p.availability.filter(r=>r.weekday===day)) {
      for(let minute=parseTime(rule.start);minute+s.duration_minutes+t.buffer_minutes<=parseTime(rule.end);minute+=15) {
        if(seen.has(minute))continue;seen.add(minute);
        const time=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
        if(!starts.has(minute)){try{starts.set(minute,localToUTC(date,time,t.timezone));}catch(error){if(error instanceof Problem && error.message==='Horário local inexistente')starts.set(minute,null);else throw error;}}
        const start=starts.get(minute);if(!start)continue;
        const end=new Date(Date.parse(start)+(s.duration_minutes+t.buffer_minutes)*60000).toISOString();
        if(Date.parse(start)<now+t.min_notice_minutes*60000 || Date.parse(start)>now+t.horizon_days*86400000) continue;
        const busy=(busyByProfessional.get(p.id)||[]).some(a=>overlap(start,end,a.starts_at,a.ends_at));
        if(!busy && !(blocksByProfessional.get(p.id)||[]).some(b=>overlap(start,end,b.starts_at,b.ends_at))) result.push({starts_at:start,ends_at:end,time,professional_id:p.id,professional_name:p.name});
      }
    }
  }
  return result.sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
}
export function customer(t, data, {trusted=false}={}) {
  if(!/^\+[1-9]\d{7,14}$/.test(data.phone)) fail('Telefone deve incluir + e código do país');
  let c=t.customers.find(c=>c.phone===data.phone);
  const fresh=!c;
  if(fresh) {c={id:uid(),name:data.name,phone:data.phone,consent:false,consents:[],created_at:new Date().toISOString(),last_visit_at:null,tags:[]};t.customers.push(c);}
  if(fresh||trusted){
    if(data.name)c.name=data.name;
    if(data.email)c.email=data.email;
    if(data.consent!==undefined){c.consent=data.consent;c.consents.push({at:new Date().toISOString(),purpose:'marketing',channel:data.source||'web',granted:data.consent});}
  }
  return c;
}
export function queue(t,type,payload,scheduledAt=new Date().toISOString(),key='') {
  if(key && t.jobs.some(j=>j.key===key)) return;
  t.jobs.push({id:uid(),type,payload,scheduled_at:scheduledAt,status:'pending',attempts:0,key});
}
export function book(t,data,{actor='customer',source='web',now=Date.now(),paymentEnabled=false}={}) {
  const fingerprint=hashToken(JSON.stringify(data));
  if(data.idempotency_key && t.idempotency[data.idempotency_key]) {const cached=t.idempotency[data.idempotency_key];if(cached.fingerprint!==fingerprint) fail('Chave de idempotência reutilizada',409);return entity(t,'appointments',cached.id);}
  if(source==='web' && t.appointments.filter(a=>a.source==='web' && Date.parse(a.created_at)>now-3600000).length>=100)fail('Limite de reservas públicas atingido. Fale com o estabelecimento.',429);
  if(t.appointments.length>=100000)fail('Limite de histórico atingido. Contate o suporte para arquivamento.',429);
  const s=entity(t,'services',data.service_id), p=entity(t,'professionals',data.professional_id);
  const date=localParts(data.starts_at,t.timezone).date;
  const slot=slots(t,s.id,date,p.id,now).find(x=>Date.parse(x.starts_at)===Date.parse(data.starts_at));
  if(!slot) fail('Este horário não está mais disponível',409);
  if(s.deposit_cents && !paymentEnabled) fail('PIX ainda não foi configurado pelo estabelecimento',503);
  const c=data.customer_id?entity(t,'customers',data.customer_id):customer(t,{name:data.name,phone:data.phone,email:data.email,consent:data.consent,source});
  const a={id:uid(),customer_id:c.id,professional_id:p.id,service_id:s.id,starts_at:slot.starts_at,ends_at:slot.ends_at,status:s.deposit_cents?'awaiting_payment':'confirmed',price_cents:s.price_cents,deposit_cents:s.deposit_cents,payment_status:'unpaid',payer_email:data.email||null,source,created_at:new Date(now).toISOString(),expires_at:s.deposit_cents?new Date(now+15*60000).toISOString():null,manage_token:randomBytes(24).toString('hex'),campaign_id:data.campaign_id||null};
  t.appointments.push(a);
  for(const w of t.waitlist.filter(w=>['waiting','offered'].includes(w.status)&&w.customer_id===c.id&&w.service_id===s.id&&w.date===date&&(!w.professional_id||w.professional_id===p.id)))w.status='booked';
  if(data.idempotency_key)t.idempotency[data.idempotency_key]={id:a.id,fingerprint};
  audit(t,actor,'appointment.created',a.id);
  if(s.deposit_cents) {if(pixEnabled(t))t.payments.push(createPixPayment(t,a));else queue(t,'create_payment',{appointment_id:a.id},undefined,`payment:${a.id}`);}
  else scheduleReminders(t,a,now);
  return a;
}
export function reminderKey(type,a){return `${type}:${a.id}:${a.starts_at}${a.reminder_version?`:${a.reminder_version}:${a.professional_id}`:''}`;}
export function scheduleReminders(t,a,now=Date.now()) {
  queue(t,'confirmation',{appointment_id:a.id},undefined,reminderKey('confirmation',a));
  const at=Date.parse(a.starts_at)-86400000;
  if(at>now)queue(t,'reminder',{appointment_id:a.id},new Date(at).toISOString(),reminderKey('reminder',a));
}
export function transition(t,a,status,actor='operator',now=Date.now()) {
  if(!(TRANSITIONS[a.status]||[]).includes(status))fail(`Transição inválida: ${a.status} → ${status}`,409);
  if(a.status==='awaiting_payment' && status==='confirmed')fail('Confirmação depende de pagamento verificado',409);
  a.status=status;a.updated_at=new Date(now).toISOString();audit(t,actor,`appointment.${status}`,a.id);
  if(status==='completed') {const c=entity(t,'customers',a.customer_id);c.last_visit_at=new Date(now).toISOString(); if(t.review_url)queue(t,'review',{customer_id:c.id,appointment_id:a.id},new Date(now+2*3600000).toISOString(),`review:${a.id}`);}
  if(status.startsWith('cancelled')) {
    t.jobs.filter(j=>j.payload.appointment_id===a.id && j.status==='pending').forEach(j=>j.status='cancelled');
    if(Date.parse(a.starts_at)>now)for(const w of t.waitlist.filter(w=>w.status==='waiting' && w.service_id===a.service_id && (!w.professional_id || w.professional_id===a.professional_id) && w.date===localParts(a.starts_at,t.timezone).date)){
      if(t.appointments.some(other=>other.customer_id===w.customer_id&&ACTIVE.includes(other.status)&&other.service_id===w.service_id&&localParts(other.starts_at,t.timezone).date===w.date)){w.status='booked';continue;}
      queue(t,'waitlist',{customer_id:w.customer_id,waitlist_id:w.id,starts_at:a.starts_at},undefined,`waitlist:${w.id}:${a.starts_at}`);w.status='offered';
    }
  }
  return a;
}
export function reschedule(t,a,data,actor='operator',now=Date.now()) {
  if(!['pending','confirmed'].includes(a.status))fail('Agendamento não pode ser reagendado neste estado',409);
  if(actor==='whatsapp'||actor==='customer')checkCustomerChange(t,a,now);
  const previous=a.status; a.status='expired';
  let slot;try{const date=localParts(data.starts_at,t.timezone).date;slot=slots(t,a.service_id,date,data.professional_id||a.professional_id,now).find(x=>Date.parse(x.starts_at)===Date.parse(data.starts_at));}finally{a.status=previous;}
  if(!slot)fail('Horário indisponível',409);
  a.status=previous;a.starts_at=slot.starts_at;a.ends_at=slot.ends_at;a.professional_id=slot.professional_id;
  t.jobs.filter(j=>j.payload.appointment_id===a.id && j.status==='pending').forEach(j=>j.status='cancelled');
  a.reminder_version=(a.reminder_version||0)+1;
  scheduleReminders(t,a,now);audit(t,actor,'appointment.rescheduled',a.id);return a;
}
export function settle(t,payment,now=Date.now(),actor='payment-provider') {
  const a=entity(t,'appointments',payment.appointment_id);
  if(['paid','refunded','charged_back'].includes(payment.status))return a;
  if(payment.amount_cents!==a.deposit_cents)fail('Valor de pagamento divergente',409);
  payment.status='paid';payment.paid_at=new Date(now).toISOString();a.payment_status='paid';
  if(a.status==='awaiting_payment' && Date.parse(a.expires_at)>now) {a.status='confirmed';scheduleReminders(t,a,now);}
  else {payment.needs_review=true;queue(t,'payment_review',{appointment_id:a.id},undefined,`review-payment:${payment.id}`);}
  audit(t,actor,'payment.paid',payment.id);return a;
}
export function expire(t,now=Date.now()) {
  for(const a of t.appointments.filter(a=>a.status==='awaiting_payment' && Date.parse(a.expires_at)<=now))transition(t,a,'expired','worker',now);
}
export function checkCustomerChange(t,a,now=Date.now()){if(Date.parse(a.starts_at)-now<t.cancellation_hours*3600000)fail('Prazo de alteração encerrado. Fale com o estabelecimento.',409);}
export function reconcilePayment(t,p,status,now=Date.now()){
  if(status==='approved')return settle(t,p,now);
  if(!['refunded','charged_back','in_mediation'].includes(status))return;
  const a=entity(t,'appointments',p.appointment_id);
  if(['refunded','charged_back'].includes(p.status))return;
  p.status=status;p.needs_review=true;a.payment_status=status;
  queue(t,'payment_review',{appointment_id:a.id},undefined,`payment-state:${p.id}:${status}`);audit(t,'payment-provider',`payment.${status}`,p.id);
}
export function metrics(t,date) {
  const rows=t.appointments.filter(a=>localParts(a.starts_at,t.timezone).date===date);
  return {appointments:rows.length,confirmed:rows.filter(a=>ACTIVE.includes(a.status)).length,expected_revenue:rows.filter(a=>!a.status.startsWith('cancelled') && a.status!=='expired').reduce((sum,a)=>sum+a.price_cents,0),received_revenue:t.payments.filter(p=>p.status==='paid' && localParts(p.paid_at,t.timezone).date===date).reduce((sum,p)=>sum+p.amount_cents,0),cancelled:rows.filter(a=>a.status.startsWith('cancelled')).length,no_show:rows.filter(a=>a.status==='no_show').length,recoverable:t.customers.filter(c=>c.consent && c.last_visit_at && Date.parse(c.last_visit_at)<Date.now()-t.recovery_days*86400000).length,recovered_revenue:t.appointments.filter(a=>a.campaign_id && a.status==='completed').reduce((sum,a)=>sum+a.price_cents,0)};
}
