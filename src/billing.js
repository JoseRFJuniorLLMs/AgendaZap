import {createHmac,timingSafeEqual} from 'node:crypto';
import {fail} from './domain.js';

export const PLANS = Object.freeze([
  {
    id:'founder',
    name:'Fundador',
    price_cents:14900,
    setup_cents:29700,
    description:'Agenda e atendimento essenciais para colocar o negócio em movimento.',
    features:['Agenda e serviços','Atendimento pelo WhatsApp','Lembretes automáticos','Dashboard básico']
  },
  {
    id:'professional',
    name:'Profissional',
    price_cents:24900,
    setup_cents:59700,
    recommended:true,
    description:'Revenue Autopilot, PIX e Voice AI para uma operação que quer recuperar receita.',
    features:['Tudo do Fundador','PIX e confirmação de sinal','Lista de espera','Recuperação de cancelamentos','Clientes inativos','Franquia de voz com IA','Receita recuperada no dashboard']
  },
  {
    id:'pro',
    name:'Pro',
    price_cents:39700,
    setup_cents:99700,
    description:'Operação avançada com automações e recursos premium.',
    features:['Tudo do Profissional','Revenue Engine avançado','Atendimento por voz com IA','TTS premium e métricas de voz','Pacotes e créditos','Recursos compartilhados','Analytics avançado','Suporte prioritário']
  }
]);

export function billingConfig() {
  const provider_configured=Boolean(process.env.BILLING_ACCESS_TOKEN&&process.env.BILLING_WEBHOOK_SECRET);
  return {
    provider:'mercadopago',
    provider_configured,
    configured:provider_configured,
    plans:PLANS
  };
}

export function getPlan(planId) {
  const plan=PLANS.find(plan=>plan.id===planId);
  if(!plan)fail('Plano inválido',400);
  return plan;
}

async function provider(path,options={}) {
  const response=await fetch('https://api.mercadopago.com'+path,{
    ...options,
    headers:{
      authorization:`Bearer ${process.env.BILLING_ACCESS_TOKEN}`,
      'content-type':'application/json',
      ...options.headers
    },
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw new Error(`Billing provider HTTP ${response.status}`);
  return response.json();
}

export async function subscription(t,email,key,planId='professional') {
  const config=billingConfig();
  if(!config.provider_configured)fail('Cobrança da plataforma ainda não configurada',503);
  const plan=getPlan(planId);
  const result=await provider('/preapproval',{
    method:'POST',
    headers:{'X-Idempotency-Key':key},
    body:JSON.stringify({
      reason:`AgendaZap ${plan.name}`,
      external_reference:t.id,
      payer_email:email,
      status:'pending',
      back_url:`${process.env.PUBLIC_ORIGIN}${process.env.BASE_PATH||'/AgendaZap'}/#app/billing`,
      auto_recurring:{
        frequency:1,
        frequency_type:'months',
        transaction_amount:plan.price_cents/100,
        currency_id:'BRL'
      }
    })
  });
  const checkout=new URL(result.init_point);
  if(checkout.protocol!=='https:'||!/(^|\.)mercadopago\.(com|com\.br)$/.test(checkout.hostname))throw new Error('Untrusted billing redirect');
  return {
    provider_id:String(result.id),
    status:result.status,
    checkout_url:checkout.href,
    created_at:new Date().toISOString(),
    price_cents:plan.price_cents,
    setup_cents:plan.setup_cents,
    plan_id:plan.id,
    plan_name:plan.name
  };
}

export const getSubscription=id=>provider('/preapproval/'+encodeURIComponent(id));
export const cancelSubscription=id=>provider('/preapproval/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({status:'cancelled'})});

export function billingSignature({signature,requestId,dataId}) {
  if(!process.env.BILLING_WEBHOOK_SECRET||!signature||!requestId)return false;
  const parts=Object.fromEntries(signature.split(',').map(x=>x.trim().split('=')));
  const ts=Number(parts.ts);
  const milliseconds=ts<1e12?ts*1000:ts;
  if(!Number.isFinite(milliseconds)||Math.abs(Date.now()-milliseconds)>300000)return false;
  const expected=createHmac('sha256',process.env.BILLING_WEBHOOK_SECRET).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest('hex');
  const a=Buffer.from(expected),b=Buffer.from(parts.v1||'');
  return a.length===b.length&&timingSafeEqual(a,b);
}
