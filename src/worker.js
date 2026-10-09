import * as d from './domain.js';
import * as providers from './providers.js';

export function selectJobs(state,cursor=0){
  const tenants=Object.values(state.tenants);if(!tenants.length)return [];
  const ordered=[...tenants.slice(cursor%tenants.length),...tenants.slice(0,cursor%tenants.length)];
  const priority=j=>j.type==='reply'?0:j.type==='create_payment'?1:['confirmation','reminder'].includes(j.type)?2:3;
  const queues=ordered.map(t=>({t,jobs:t.jobs.filter(j=>j.status==='pending'&&Date.parse(j.scheduled_at)<=Date.now()).sort((a,b)=>priority(a)-priority(b)||a.scheduled_at.localeCompare(b.scheduled_at)).slice(0,20)}));
  const selected=[];while(selected.length<50){let found=false;for(const q of queues){const job=q.jobs.shift();if(job){selected.push({tenant:q.t,job});found=true;if(selected.length===50)break;}}if(!found)break;}
  return selected;
}

export function startWorker(store,{interval=15000}={}) {
  let stopped=false,running=false,cursor=0,inflight=Promise.resolve();
  async function tick() {
    if(stopped||running||!store.healthy)return;
    running=true;
    try {
      await store.transaction('worker',state=>{
        for(const t of Object.values(state.tenants)) {
          d.expire(t);
          const today=d.localParts(Date.now(),t.timezone).date;for(const w of t.waitlist)if(['waiting','offered'].includes(w.status)&&w.date<today)w.status='expired';
          for(const j of t.jobs)if(j.status==='running' && Date.parse(j.claimed_at)<Date.now()-120000){j.status='pending';j.scheduled_at=new Date().toISOString();}
        }
        for(const [key,s]of Object.entries(state.sessions))if(s.revoked||s.expires_at<Date.now())delete state.sessions[key];
      });
      // Bound one pass so large tenants cannot monopolize the process.
      const selected=selectJobs(store.state,cursor++);
      for(const {tenant,job} of selected) {
          if(stopped)break;
          await store.transaction('worker',state=>{const j=d.entity(state.tenants[tenant.id],'jobs',job.id);j.status='running';j.claimed_at=new Date().toISOString();j.attempts++;});
          try {
            const t=store.state.tenants[tenant.id],j=d.entity(t,'jobs',job.id);
            if(j.type==='payment_review') {await status(t.id,j.id,'blocked','Pagamento fora do prazo: revisão manual necessária');continue;}
            if(j.type==='create_payment') {
              const a=d.entity(t,'appointments',j.payload.appointment_id);
              if(a.status!=='awaiting_payment'){await status(t.id,j.id,'cancelled');continue;}
              if(!providers.integrationStatus(t).pix){await status(t.id,j.id,'blocked','Configure PIX');continue;}
              const payer={...d.entity(t,'customers',a.customer_id),email:a.payer_email||d.entity(t,'customers',a.customer_id).email};
              const payment=await providers.charge(t,a,payer);
              await store.transaction('worker',state=>{const live=state.tenants[t.id];if(!live.payments.some(p=>p.id===payment.id))live.payments.push(payment);const current=d.entity(live,'jobs',j.id);current.status='done';d.audit(live,'worker','payment.created',payment.id);});
              continue;
            }
            const a=j.payload.appointment_id?t.appointments.find(a=>a.id===j.payload.appointment_id):null;
            const customerId=j.payload.customer_id||a?.customer_id;
            const c=customerId?t.customers.find(c=>c.id===customerId):null;
            if(!c || !c.phone.startsWith('+')) {await status(t.id,j.id,'cancelled');continue;}
            if(['recovery','waitlist','review'].includes(j.type)&&!c.consent){await status(t.id,j.id,'cancelled','Sem consentimento promocional');continue;}
            if(['confirmation','reminder'].includes(j.type)&&(!a||!['confirmed','pending'].includes(a.status)||Date.parse(a.starts_at)<Date.now())){await status(t.id,j.id,'cancelled');continue;}
            if(['confirmation','reminder'].includes(j.type) && j.key!==d.reminderKey(j.type,a)){await status(t.id,j.id,'cancelled');continue;}
            if(j.type==='waitlist'){
              const w=t.waitlist.find(w=>w.id===j.payload.waitlist_id);
              if(!w||!['waiting','offered'].includes(w.status)||Date.parse(j.payload.starts_at)<=Date.now()||t.appointments.some(a=>a.customer_id===c.id&&d.ACTIVE.includes(a.status)&&a.service_id===w.service_id&&d.localParts(a.starts_at,t.timezone).date===w.date)){await status(t.id,j.id,'cancelled');continue;}
            }
            if(j.type==='recovery' && t.appointments.some(a=>a.customer_id===c.id&&d.ACTIVE.includes(a.status))){await status(t.id,j.id,'cancelled');continue;}
            if(!providers.integrationStatus().whatsapp||!t.integrations.phone_id){await status(t.id,j.id,'blocked','Configure WhatsApp e templates aprovados');continue;}
            let payload;
            if(j.type==='reply') {
              const conv=d.entity(t,'conversations',j.payload.conversation_id);
              if(!conv.last_inbound_at||Date.parse(conv.last_inbound_at)<Date.now()-24*3600000){await status(t.id,j.id,'blocked','Janela de atendimento encerrada');continue;}
              payload={text:j.payload.text};
            }else {
              const template=j.type==='recovery'||j.type==='waitlist'?process.env.WHATSAPP_RECOVERY_TEMPLATE:j.type==='review'?process.env.WHATSAPP_REVIEW_TEMPLATE:process.env.WHATSAPP_REMINDER_TEMPLATE;
              if(!template){await status(t.id,j.id,'blocked','Template aprovado não configurado');continue;}
              const link=j.type==='recovery'?`${process.env.PUBLIC_ORIGIN}${process.env.BASE_PATH||'/AgendaZap'}/#book/${t.slug}?campaign=${j.payload.campaign_id}`:j.type==='review'?t.review_url:`${process.env.PUBLIC_ORIGIN}${process.env.BASE_PATH||'/AgendaZap'}/#book/${t.slug}`;
              payload={template,parameters:[c.name,t.name,j.type==='review'?link:a?new Date(a.starts_at).toLocaleString('pt-BR',{timeZone:t.timezone}):link]};
            }
            const sent=await providers.sendWhatsApp(t.integrations.phone_id,c.phone,payload);
            await store.transaction('worker',state=>{const live=state.tenants[t.id],current=d.entity(live,'jobs',j.id);current.status='done';current.provider_id=sent.messages?.[0]?.id;current.sent_at=new Date().toISOString();if(j.payload.conversation_id){const msg=d.entity(live,'conversations',j.payload.conversation_id).messages.find(m=>m.id===j.payload.message_id);if(msg){msg.provider_id=current.provider_id;msg.status='sent';}}});
          }catch(error) {
            await store.transaction('worker',state=>{const j=d.entity(state.tenants[tenant.id],'jobs',job.id);j.status=j.attempts>=5?'failed':'pending';j.last_error=error.status?error.message:'Falha temporária no provedor';j.scheduled_at=new Date(Date.now()+Math.min(3600000,30000*2**j.attempts)).toISOString();});
          }
      }
    }catch(error){console.error(JSON.stringify({event:'worker_failed',error_type:error.constructor.name}));}
    finally{running=false;}
  }
  async function status(tenantId,jobId,status,error='') {await store.transaction('worker',state=>{const j=d.entity(state.tenants[tenantId],'jobs',jobId);j.status=status;j.last_error=error;});}
  const run=()=>{if(running||stopped)return inflight;inflight=tick();return inflight;};
  const timer=setInterval(run,interval);timer.unref();run();
  return async()=>{stopped=true;clearInterval(timer);await inflight;};
}
