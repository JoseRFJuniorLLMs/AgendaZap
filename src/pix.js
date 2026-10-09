import {z} from 'zod';
import QRCode from 'qrcode';
import {createHash} from 'node:crypto';

function invalid(message){const error=new Error(message);error.status=400;throw error;}
const ascii=(value,max)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 $%*+\-./:]/g,'').trim().slice(0,max);
const keySchema=z.object({id:z.string().uuid(),type:z.enum(['cpf','cnpj','email','phone','random']),value:z.string().trim().min(1).max(77),label:z.string().trim().max(50).default('')}).strict();
const configSchema=z.object({enabled:z.boolean(),recipient_name:z.string().trim().max(100),recipient_city:z.string().trim().max(100),keys:z.array(keySchema).max(10),default_key_id:z.string().uuid().nullable()}).strict();
function validDocument(value,type){
  if(!/^\d+$/.test(value)||/^(\d)\1+$/.test(value))return false;
  const weights=type==='cpf'?[[10,9,8,7,6,5,4,3,2],[11,10,9,8,7,6,5,4,3,2]]:[[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]];
  if(value.length!==(type==='cpf'?11:14))return false;
  return weights.every(w=>{const remainder=w.reduce((sum,n,i)=>sum+n*Number(value[i]),0)%11;return Number(value[w.length])===(remainder<2?0:11-remainder);});
}
export function normalizePixConfig(input){
  const data=configSchema.parse(input);
  data.recipient_name=ascii(data.recipient_name,25);data.recipient_city=ascii(data.recipient_city,15);
  data.keys=data.keys.map(key=>{
    let value=key.value;
    if(['cpf','cnpj'].includes(key.type)){value=value.replace(/[.\-/\s]/g,'');if(!validDocument(value,key.type))invalid('CPF ou CNPJ da chave Pix inválido');}
    if(key.type==='phone'){value=value.replace(/[()\-\s]/g,'');if(!/^\+[1-9]\d{7,14}$/.test(value))invalid('Telefone Pix deve incluir + e código do país');}
    if(key.type==='email'){value=value.toLowerCase();if(!z.string().email().safeParse(value).success)invalid('E-mail Pix inválido');}
    if(key.type==='random'){value=value.toLowerCase();if(!z.string().uuid().safeParse(value).success)invalid('Chave aleatória Pix inválida');}
    if(!/^[\x20-\x7E]+$/.test(value))invalid('Chave Pix contém caracteres inválidos');
    return {...key,value};
  });
  if(new Set(data.keys.map(k=>k.id)).size!==data.keys.length||new Set(data.keys.map(k=>k.value)).size!==data.keys.length)invalid('Chaves Pix duplicadas');
  if(data.default_key_id&&!data.keys.some(k=>k.id===data.default_key_id))invalid('Selecione uma chave Pix principal cadastrada');
  if(data.enabled&&(!data.recipient_name||!data.recipient_city||!data.default_key_id))invalid('Informe recebedor, cidade e chave principal para ativar o Pix');
  return data;
}
export const pixEnabled=t=>!!(t?.pix?.enabled&&t.pix.recipient_name&&t.pix.recipient_city&&t.pix.keys?.some(k=>k.id===t.pix.default_key_id));
export function crc16(value){let crc=0xFFFF;for(const byte of Buffer.from(value,'utf8')){crc^=byte<<8;for(let i=0;i<8;i++)crc=((crc&0x8000)?(crc<<1)^0x1021:crc<<1)&0xFFFF;}return crc.toString(16).toUpperCase().padStart(4,'0');}
const tlv=(id,value)=>{if(Buffer.byteLength(value)>99)invalid('Campo Pix excede o tamanho permitido');return id+String(Buffer.byteLength(value)).padStart(2,'0')+value;};
export function pixPayload({key,name,city,amount_cents,txid}){
  if(!Number.isSafeInteger(amount_cents)||amount_cents<=0||amount_cents>10000000)invalid('Valor Pix inválido');
  if(!/^[a-zA-Z0-9]{1,25}$/.test(txid))invalid('Identificador Pix inválido');
  const payload=tlv('00','01')+tlv('26',tlv('00','br.gov.bcb.pix')+tlv('01',key))+tlv('52','0000')+tlv('53','986')+tlv('54',(amount_cents/100).toFixed(2))+tlv('58','BR')+tlv('59',ascii(name,25))+tlv('60',ascii(city,15))+tlv('62',tlv('05',txid))+'6304';
  return payload+crc16(payload);
}
export function createPixPayment(t,a){
  if(!pixEnabled(t)){const error=new Error('Configure o Pix do estabelecimento');error.status=503;throw error;}
  const key=t.pix.keys.find(k=>k.id===t.pix.default_key_id),txid=createHash('sha256').update(a.id).digest('hex').slice(0,25);
  return {id:'pix-'+a.id,appointment_id:a.id,amount_cents:a.deposit_cents,status:'pending',provider:'pix_manual',created_at:new Date().toISOString(),txid,recipient_name:t.pix.recipient_name,recipient_city:t.pix.recipient_city,key_type:key.type,key_value:key.value,qr_code:pixPayload({key:key.value,name:t.pix.recipient_name,city:t.pix.recipient_city,amount_cents:a.deposit_cents,txid}),expires_at:a.expires_at};
}
export async function paymentWithQr(payment){if(!payment||payment.provider!=='pix_manual'||!payment.qr_code)return payment;return {...payment,qr_code_base64:(await QRCode.toDataURL(payment.qr_code,{width:280,margin:4,errorCorrectionLevel:'M'})).split(',')[1]};}
