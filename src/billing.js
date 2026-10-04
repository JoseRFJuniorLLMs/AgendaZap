import {createHmac,timingSafeEqual} from 'node:crypto';
import {fail} from './domain.js';

export function billingConfig() {
  const amount=Number(process.env.BILLING_PRICE_CENTS||0);
  return {name:process.env.BILLING_PLAN_NAME||'AgendaZap',price_cents:amount,frequency:'monthly',configured:!!(process.env.BILLING_ACCESS_TOKEN&&process.env.BILLING_WEBHOOK_SECRET&&Number.isInteger(amount)&&amount>0)};
}
async function provider(path,options={}) {
  const response=await fetch('https://api.mercadopago.com'+path,{...options,headers:{authorization:`Bearer ${process.env.BILLING_ACCESS_TOKEN}`,'content-type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Billing provider HTTP ${response.status}`);return response.json();
}
export async function subscription(t,email,key) {
  const config=billingConfig();if(!config.configured)fail('Plano de assinatura ainda não configurado pela plataforma',503);
  const result=await provider('/preapproval',{method:'POST',headers:{'X-Idempotency-Key':key},body:JSON.stringify({reason:config.name,external_reference:t.id,payer_email:email,status:'pending',back_url:`${process.env.PUBLIC_ORIGIN}${process.env.BASE_PATH||'/AgendaZap'}/#app/billing`,auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:config.price_cents/100,currency_id:'BRL'}})});
  const checkout=new URL(result.init_point);
  if(checkout.protocol!=='https:'||!/(^|\.)mercadopago\.(com|com\.br)$/.test(checkout.hostname))throw new Error('Untrusted billing redirect');
  return {provider_id:String(result.id),status:result.status,checkout_url:checkout.href,created_at:new Date().toISOString(),price_cents:config.price_cents,plan_name:config.name};
}
export const getSubscription=id=>provider('/preapproval/'+encodeURIComponent(id));
export const cancelSubscription=id=>provider('/preapproval/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({status:'cancelled'})});
export function billingSignature({signature,requestId,dataId}) {
  if(!process.env.BILLING_WEBHOOK_SECRET||!signature||!requestId)return false;
  const parts=Object.fromEntries(signature.split(',').map(x=>x.trim().split('=')));const ts=Number(parts.ts);const milliseconds=ts<1e12?ts*1000:ts;
  if(!Number.isFinite(milliseconds)||Math.abs(Date.now()-milliseconds)>300000)return false;
  const expected=createHmac('sha256',process.env.BILLING_WEBHOOK_SECRET).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest('hex');
  const a=Buffer.from(expected),b=Buffer.from(parts.v1||'');return a.length===b.length&&timingSafeEqual(a,b);
}
