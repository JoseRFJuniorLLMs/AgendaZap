import test from 'node:test';
import assert from 'node:assert/strict';
import {subscription,billingConfig,getSubscription,billingSignature} from '../src/billing.js';
import {charge,getPayment} from '../src/providers.js';
import {createHmac} from 'node:crypto';

test('PIX adapter sends real payer email, correct cents and stable idempotency to provider',async()=>{
  const originalFetch=global.fetch,originalEnv={...process.env};
  try{
    process.env.PIX_ACCESS_TOKEN='test';process.env.PIX_WEBHOOK_SECRET='test';process.env.PUBLIC_ORIGIN='https://example.invalid';
    let captured;global.fetch=async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({id:123,point_of_interaction:{transaction_data:{qr_code:'TEST_CODE'}}})};};
    const a={id:'booking-test',deposit_cents:2350,expires_at:new Date(Date.now()+900000).toISOString()};
    const result=await charge({name:'Teste'},a,{name:'Cliente fictício',email:'payer@example.invalid'});
    assert.equal(result.amount_cents,2350);assert.equal(result.qr_code,'TEST_CODE');assert.equal(captured.options.headers['X-Idempotency-Key'],a.id);
    const body=JSON.parse(captured.options.body);assert.equal(body.payer.email,'payer@example.invalid');assert.equal(body.transaction_amount,23.5);assert.equal(body.external_reference,a.id);
    await assert.rejects(charge({name:'Teste'},a,{name:'No email'}),/e-mail do pagador/);
  }finally{global.fetch=originalFetch;process.env=originalEnv;}
});
test('subscription adapter exposes canonical plans and uses selected monthly price',async()=>{
  const originalFetch=global.fetch,originalEnv={...process.env};
  try{
    delete process.env.BILLING_ACCESS_TOKEN;
    delete process.env.BILLING_WEBHOOK_SECRET;
    const config=billingConfig();
    assert.equal(config.provider_configured,false);
    assert.deepEqual(config.plans.map(p=>[p.id,p.price_cents,p.setup_cents]),[
      ['founder',14900,29700],
      ['professional',24900,59700],
      ['pro',39700,99700]
    ]);
    await assert.rejects(subscription({id:'t'},'qa@example.invalid','key','professional'),/não configurada/);

    process.env.BILLING_ACCESS_TOKEN='fake-test';
    process.env.BILLING_WEBHOOK_SECRET='secret';
    process.env.PUBLIC_ORIGIN='https://example.invalid';

    let payload;
    global.fetch=async(url,options)=>{
      payload=JSON.parse(options.body);
      return {ok:true,json:async()=>({id:'sub-test',status:'pending',init_point:'https://www.mercadopago.com.br/subscriptions/checkout?test=1'})};
    };

    const result=await subscription({id:'tenant-test'},'qa@example.invalid','checkout-key','professional');
    assert.equal(result.status,'pending');
    assert.equal(result.plan_id,'professional');
    assert.equal(result.price_cents,24900);
    assert.equal(result.setup_cents,59700);
    assert.equal(payload.auto_recurring.transaction_amount,249);
    assert.equal(payload.frequency_type,undefined);
    assert.equal(payload.auto_recurring.frequency_type,'months');
    assert.equal(payload.status,'pending');
    assert.equal(payload.external_reference,'tenant-test');

    const ts=String(Date.now());
    const v1=createHmac('sha256','secret').update(`id:abc;request-id:request;ts:${ts};`).digest('hex');
    assert(billingSignature({signature:`ts=${ts},v1=${v1}`,requestId:'request',dataId:'abc'}));
    assert(!billingSignature({signature:`ts=${ts},v1=${v1}`,requestId:'different',dataId:'abc'}));
  }finally{
    global.fetch=originalFetch;
    process.env=originalEnv;
  }
});
