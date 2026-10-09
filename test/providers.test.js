import test from 'node:test';
import assert from 'node:assert/strict';
import {billingConfig,getPlan} from '../src/billing.js';
import {charge,integrationStatus} from '../src/providers.js';
import {normalizePixConfig,pixPayload,crc16,createPixPayment} from '../src/pix.js';
import {randomUUID} from 'node:crypto';

const config=(type='email',value='pix@example.com')=>{const id=randomUUID();return {enabled:true,recipient_name:'Pousada São José',recipient_city:'São Paulo',keys:[{id,type,value,label:'Principal'}],default_key_id:id};};
function fields(payload){const result={};let offset=0;while(offset<payload.length){const tag=payload.slice(offset,offset+2),size=Number(payload.slice(offset+2,offset+4));result[tag]=payload.slice(offset+4,offset+4+size);offset+=4+size;}assert.equal(offset,payload.length);return result;}
test('all five key types are normalized and invalid keys/defaults rejected',()=>{
  const samples=[['cpf','529.982.247-25','52998224725'],['cnpj','11.222.333/0001-81','11222333000181'],['email','PIX@example.com','pix@example.com'],['phone','+55 (11) 99999-9999','+5511999999999'],['random','123e4567-e89b-42d3-a456-426614174000','123e4567-e89b-42d3-a456-426614174000']];
  for(const [type,value,expected]of samples)assert.equal(normalizePixConfig(config(type,value)).keys[0].value,expected);
  for(const [type,value]of [['cpf','11111111111'],['cnpj','11222333000180'],['email','invalid'],['phone','11999999999'],['random','invalid']])assert.throws(()=>normalizePixConfig(config(type,value)));
  assert.throws(()=>normalizePixConfig({...config(),default_key_id:randomUUID()}),/principal/);
  const p=config();p.keys.push({...p.keys[0],id:randomUUID()});assert.throws(()=>normalizePixConfig(p),/duplicadas/);
});
test('BR Code encodes recipient, exact amount, unique reference and standard CRC-16',()=>{
  assert.equal(crc16('123456789'),'29B1');
  const payload=pixPayload({key:'pix@example.com',name:'Pousada São José',city:'São Paulo',amount_cents:2350,txid:'RESERVA123'}),parsed=fields(payload);
  assert.equal(parsed['00'],'01');assert.equal(parsed['53'],'986');assert.equal(parsed['54'],'23.50');assert.equal(parsed['58'],'BR');assert.equal(parsed['59'],'POUSADA SAO JOSE');assert.equal(parsed['60'],'SAO PAULO');assert.equal(fields(parsed['26'])['01'],'pix@example.com');assert.equal(fields(parsed['62'])['05'],'RESERVA123');assert.equal(parsed['63'],crc16(payload.slice(0,-4)));
});
test('direct Pix generates PNG without a network request and preserves the original receiver',async()=>{
  const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected external call')};
  try {const t={pix:normalizePixConfig(config())},a={id:randomUUID(),deposit_cents:2350,expires_at:new Date(Date.now()+900000).toISOString()};const p=await charge(t,a);assert.equal(p.provider,'pix_manual');assert.equal(p.status,'pending');assert.equal(p.amount_cents,2350);assert.equal(Buffer.from(p.qr_code_base64,'base64').subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal((await charge(t,a)).id,p.id);assert.equal(integrationStatus(t).pix,true);assert.equal(integrationStatus().pix,false);t.pix.keys[0].value='changed@example.com';assert(p.qr_code.includes('pix@example.com'));assert.notEqual(createPixPayment(t,a).qr_code,p.qr_code);}finally{globalThis.fetch=original;}
});
test('platform plans remain available without an automatic payment provider',()=>{assert.equal(billingConfig().provider,'manual');assert.equal(billingConfig().provider_configured,false);assert.equal(getPlan('professional').price_cents,24900);assert.throws(()=>getPlan('invalid'));});
