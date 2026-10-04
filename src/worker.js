import * as d from './domain.js';
import * as providers from './providers.js';

export function startWorker(store,{interval=15000}={}) {
  let stopped=false,running=false;
  async function tick() {
    if(stopped||running||!store.healthy)return;
    running=true;
    try {
      await store.transaction('worker',state=>{
        for(const t of Object.values(state.tenants)) {
          d.expire(t);
          for(const j of t.jobs)if(j.status==='running' && Date.parse(j.claimed_at)<Date.now()-120000){j.status='pending';j.scheduled_at=new Date().toISOString();}
        }
        for(const [key,s]of Object.entries(state.sessions))if(!s.revoked&&s.expires_at<Date.now())s.revoked=true;
      });
      // Bound one pass so large tenants cannot monopolize the process.
      let processed=0;
      for(const tenant of Object.values(store.state.tenants)) {
        for(const job of tenant.jobs.filter(j=>j.status==='pending' && Date.parse(j.scheduled_at)<=Date.now()).slice(0,20)) {
          if(stopped||processed++>=50)break;
          await store.transaction('worker',state=>{const j=d.entity(state.tenants[tenant.id],'jobs',job.id);j.status='running';j.claimed_at=new Date().toISOString();j.attempts++;});
          try {
            const t=store.state.tenants[tenant.id],j=d.entity(t,'jobs',job.id);
            if(j.type==='payment_review') {await status(t.id,j.id,'blocked','Pagamento fora do prazo: revisão manual necessária');continue;}
            if(j.type==='create_payment') {
              const a=d.entity(t,'appointments',j.payload.appointment_id);
              if(a.status!=='awaiting_payment'){await status(t.id,j.id,'cancelled');continue;}
              if(!providers.integrationStatus().pix){await status(t.id,j.id,'blocked','Configure PIX');continue;}
              if(!d.entity(t,'customers',a.customer_id).email){await status(t.id,j.id,'blocked','Informe o e-mail do pagador no link de pagamento');continue;}
              const payment=await providers.charge(t,a,d.entity(t,'customers',a.customer_id));
              await store.transaction('worker',state=>{const live=state.tenants[t.id];if(!live.payments.some(p=>p.id===payment.id))live.payments.push(payment);const current=d.entity(live,'jobs',j.id);current.status='done';d.audit(live,'worker','payment.created',payment.id);});
              continue;
            }
            const a=j.payload.appointment_id?t.appointments.find(a=>a.id===j.payload.appointment_id):null;
            const customerId=j.payload.customer_id||a?.customer_id;
            const c=customerId?t.customers.find(c=>c.id===customerId):null;
            if(!c || !c.phone.startsWith('+')) {await status(t.id,j.id,'cancelled');continue;}
            if(['recovery','waitlist','review'].includes(j.type)&&!c.consent){await status(t.id,j.id,'cancelled','Sem consentimento promocional');continue;}
            if(['confirmation','reminder'].includes(j.type)&&(!a||!['confirmed','pending'].includes(a.status)||Date.parse(a.starts_at)<Date.now())){await status(t.id,j.id,'cancelled');continue;}
            if(j.type==='reminder' && j.key!==`reminder:${a.id}:${a.starts_at}`){await status(t.id,j.id,'cancelled');continue;}
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
              payload={template,parameters:[c.name,t.name,a?new Date(a.starts_at).toLocaleString('pt-BR',{timeZone:t.timezone}):link]};
            }
            const sent=await providers.sendWhatsApp(t.integrations.phone_id,c.phone,payload);
            await store.transaction('worker',state=>{const live=state.tenants[t.id],current=d.entity(live,'jobs',j.id);current.status='done';current.provider_id=sent.messages?.[0]?.id;current.sent_at=new Date().toISOString();if(j.payload.conversation_id){const msg=d.entity(live,'conversations',j.payload.conversation_id).messages.find(m=>m.id===j.payload.message_id);if(msg){msg.provider_id=current.provider_id;msg.status='sent';}}});
          }catch(error) {
            await store.transaction('worker',state=>{const j=d.entity(state.tenants[tenant.id],'jobs',job.id);j.status=j.attempts>=5?'failed':'pending';j.last_error=error.status?error.message:'Falha temporária no provedor';j.scheduled_at=new Date(Date.now()+Math.min(3600000,30000*2**j.attempts)).toISOString();});
          }
        }
      }
    }catch(error){console.error(JSON.stringify({event:'worker_failed',error_type:error.constructor.name}));}
    finally{running=false;}
  }
  async function status(tenantId,jobId,status,error='') {await store.transaction('worker',state=>{const j=d.entity(state.tenants[tenantId],'jobs',jobId);j.status=status;j.last_error=error;});}
  const timer=setInterval(tick,interval);timer.unref();tick();
  return ()=>{stopped=true;clearInterval(timer);};
}
