import express from 'express';
import helmet from 'helmet';
import {z} from 'zod';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Store} from './store.js';
import * as d from './domain.js';
import * as providers from './providers.js';
import {converse} from './conversation.js';
import {startWorker} from './worker.js';
import {startBackups} from './backup.js';
import * as billing from './billing.js';
import {normalizePixConfig,createPixPayment,paymentWithQr} from './pix.js';
import {boundedRate,validUnicode} from './limits.js';
const customerCollator=new Intl.Collator('pt-BR',{sensitivity:'base'});

const text=z.string().trim().min(1).max(160);
const id=z.string().uuid();
const phone=z.string().regex(/^\+[1-9]\d{7,14}$/);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant=z.string().datetime({offset:true});
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const booking=z.object({service_id:id,professional_id:id,starts_at:instant,name:text,phone,email:z.string().email().max(200).optional(),consent:z.boolean().default(false),idempotency_key:z.string().min(8).max(80),campaign_id:z.string().max(80).optional()}).strict();
const serviceSchema=z.object({name:text,duration_minutes:z.number().int().min(15).max(480),price_cents:z.number().int().min(0).max(10000000),deposit_cents:z.number().int().min(0).max(10000000).default(0),active:z.boolean().default(true)}).strict().refine(x=>x.deposit_cents<=x.price_cents,{message:'Sinal não pode exceder o preço'});
const professionalSchema=z.object({name:text,active:z.boolean().default(true),service_ids:z.array(id).max(100),availability:z.array(z.object({weekday:z.number().int().min(0).max(6),start:time,end:time}).strict().refine(x=>x.start<x.end)).max(50)}).strict();
const settingsSchema=z.object({name:text,timezone:z.string().max(80),address:z.string().max(300),review_url:z.union([z.literal(''),z.string().url().regex(/^https:\/\//)]),min_notice_minutes:z.number().int().min(0).max(10080),horizon_days:z.number().int().min(1).max(365),buffer_minutes:z.number().int().min(0).max(120),cancellation_hours:z.number().int().min(0).max(720),recovery_days:z.number().int().min(7).max(365),payment_email:z.union([z.literal(''),z.string().email()]).optional()}).strict();
const safeTenant = t => ({id:t.id,name:t.name,slug:t.slug,timezone:t.timezone,address:t.address,review_url:t.review_url,min_notice_minutes:t.min_notice_minutes,horizon_days:t.horizon_days,buffer_minutes:t.buffer_minutes,cancellation_hours:t.cancellation_hours,recovery_days:t.recovery_days,payment_email:t.payment_email||'',integrations:t.integrations});
const safeAppointment = a => {const {manage_token,...rest}=a;return rest;};
const parse=(schema,value)=>schema.parse(value);
const catalog=t=>({tenant:{name:t.name,slug:t.slug,timezone:t.timezone,address:t.address,cancellation_hours:t.cancellation_hours},services:t.services.filter(s=>s.active),professionals:t.professionals.filter(p=>p.active).map(p=>({id:p.id,name:p.name,service_ids:p.service_ids})),pix_enabled:providers.integrationStatus(t).pix});

export function createApp(store,{basePath=process.env.BASE_PATH||'/AgendaZap',origin=process.env.PUBLIC_ORIGIN||'http://localhost:8793',secure=process.env.COOKIE_SECURE==='true'}={}) {
  const app=express(); app.disable('x-powered-by');app.set('strict routing',true);app.set('trust proxy','loopback');
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],mediaSrc:["'self'",'blob:'],connectSrc:["'self'"],formAction:["'self'"],frameAncestors:["'none'"],upgradeInsecureRequests:secure?[]:null}}}));
  app.use(express.json({limit:'128kb',verify:(req,res,buf)=>{req.rawBody=buf;}}));
  app.use((req,res,next)=>validUnicode(req.body)?next():res.status(400).json({error:'Texto contém caracteres inválidos'}));
  const router=express.Router();
  const rate=new Map();
  router.use('/api',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    const bucket=req.path==='/voice-authorize'?'voice':req.path.startsWith('/auth')?'auth':'api';
    if(!boundedRate(rate,`${req.ip}:${bucket}`,{limit:bucket==='auth'?20:300}))return res.status(429).json({error:'Aguarde antes de tentar novamente'});
    if(!['GET','HEAD','OPTIONS'].includes(req.method) && !req.path.startsWith('/webhooks')) {
      if(req.get('origin') && req.get('origin')!==origin)return res.status(403).json({error:'Origem inválida'});
      if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Origem inválida'});
      if(!req.is('application/json'))return res.status(415).json({error:'Use application/json'});
    }
    next();
  });
  const simulations=new Map();
  function getTenant(slug) {return Object.values(store.state.tenants).find(t=>t.slug===slug)||d.fail('Estabelecimento não encontrado',404);}
  const cookieName='agendazap_session';
  function token(req) {return req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.split('=').slice(1).join('=')||'';}
  function auth(req,res,next) {
    const session=store.state.sessions[d.hashToken(token(req))];
    if(!session || session.revoked || session.expires_at<Date.now())return res.status(401).json({error:'Entre para continuar'});
    const account=store.state.accounts[session.account_id];
    if(!account || !account.active)return res.status(401).json({error:'Sessão inválida'});
    req.account=account;req.tenant=store.state.tenants[account.tenant_id];req.session=session;
    if(!['GET','HEAD'].includes(req.method) && req.get('x-csrf-token')!==session.csrf)return res.status(403).json({error:'Sessão expirada. Atualize a página.'});
    next();
  }
  const roles=(...allowed)=>(req,res,next)=>allowed.includes(req.account.role)?next():res.status(403).json({error:'Seu perfil não permite esta ação'});
  const operator=roles('owner','manager','attendant');
  const manager=roles('owner','manager');
  const owner=roles('owner');
  async function mutate(req,fn) {return store.transaction(req.account.id,state=>fn(state.tenants[req.account.tenant_id],state));}
  function accountResponse(req) {return {user:{id:req.account.id,name:req.account.name,email:req.account.email,role:req.account.role,professional_id:req.account.professional_id},tenant:safeTenant(req.tenant),csrf:req.session.csrf};}
  async function loginSession(res,state,account) {
    for(const [key,s]of Object.entries(state.sessions))if(s.revoked||s.expires_at<Date.now())delete state.sessions[key];
    const own=Object.entries(state.sessions).filter(([,s])=>s.account_id===account.id);for(const [key]of own.slice(0,Math.max(0,own.length-9)))delete state.sessions[key];
    const raw=randomBytes(32).toString('hex'); const csrf=randomBytes(24).toString('hex');
    state.sessions[d.hashToken(raw)]={account_id:account.id,csrf,expires_at:Date.now()+12*3600000,revoked:false};
    res.cookie(cookieName,raw,{httpOnly:true,sameSite:'strict',secure,path:basePath||'/',maxAge:12*3600000});
    return {user:{id:account.id,name:account.name,email:account.email,role:account.role,professional_id:account.professional_id},tenant:safeTenant(state.tenants[account.tenant_id]),csrf};
  }
  router.get('/api/health',async(req,res)=>{try{await store.probe?.();res.status(store.healthy?200:503).json({status:store.healthy?'ok':'unavailable',database:'PostgreSQL',version:'1.0.0',revision:process.env.APP_REVISION||null});}catch{res.status(503).json({status:'unavailable'});}});
  router.get('/api/config',(req,res)=>res.json({base_path:basePath,integrations:providers.integrationStatus()}));
  router.post('/api/auth/register',async(req,res)=>{
    const data=parse(z.object({name:text,email:z.string().email().max(200).transform(x=>x.toLowerCase()),password:z.string().min(12).max(128),business_name:text,slug:z.string().regex(/^[a-z0-9][a-z0-9-]{2,49}$/),timezone:z.string().max(80).default('America/Sao_Paulo')}).strict(),req.body);
    const result=await store.transaction('registration',async state=>{
      if(Object.keys(state.tenants).length>=10000||Object.values(state.tenants).filter(t=>Date.parse(t.created_at)>Date.now()-86400000).length>=1000)d.fail('Cadastro temporariamente indisponível. Contate o suporte.',429);
      if(state.accounts[data.email] || Object.values(state.tenants).some(t=>t.slug===data.slug))d.fail('E-mail ou endereço já cadastrado',409);
      const account={id:d.uid(),email:data.email,name:data.name,password_hash:d.passwordHash(data.password),role:'owner',active:true};
      const tenant=d.newTenant({name:data.business_name,slug:data.slug,timezone:data.timezone},account.id);account.tenant_id=tenant.id;
      state.accounts[account.id]=account;state.accounts[data.email]={alias:account.id};state.tenants[tenant.id]=tenant;
      d.audit(tenant,account.id,'tenant.created',tenant.id);return loginSession(res,state,account);
    });res.status(201).json(result);
  });
  router.post('/api/auth/login',async(req,res)=>{
    const data=parse(z.object({email:z.string().email().transform(x=>x.toLowerCase()),password:z.string().max(128)}).strict(),req.body);
    const result=await store.transaction('login',async state=>{const alias=state.accounts[data.email],account=alias&&state.accounts[alias.alias];if(!account?.active||!d.passwordValid(data.password,account.password_hash))d.fail('E-mail ou senha incorretos',401);d.audit(state.tenants[account.tenant_id],account.id,'auth.login',account.id);return loginSession(res,state,account);});res.json(result);
  });
  router.post('/api/auth/logout',async(req,res)=>{const key=d.hashToken(token(req));const s=store.state.sessions[key];if(s&&!s.revoked&&s.expires_at>=Date.now()&&req.get('x-csrf-token')!==s.csrf)d.fail('Sessão inválida',403);await store.transaction('logout',state=>{delete state.sessions[key];});res.clearCookie(cookieName,{path:basePath||'/'});res.json({ok:true});});
  router.get('/api/auth/me',auth,(req,res)=>res.json(accountResponse(req)));
  router.get('/api/voice-authorize',auth,manager,(req,res)=>{
    if((req.get('origin')&&req.get('origin')!==origin)||req.get('sec-fetch-site')==='cross-site')return res.sendStatus(403);
    if(req.get('x-original-method')&&!['GET','HEAD','OPTIONS'].includes(req.get('x-original-method'))&&req.get('x-csrf-token')!==req.session.csrf)return res.sendStatus(403);
    const original=String(req.get('x-original-uri')||'').split('?')[0];
    const prefix=basePath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const match=original.match(new RegExp(`^${prefix}/(?:api/voice/(?:config|usage|transcribe|tts|respond)|ws/voice/live)/([a-zA-Z0-9_-]{1,64})$`));
    if(!match||match[1]!==req.tenant.id)return res.sendStatus(403);
    res.set('X-AgendaZap-Tenant',req.tenant.id);
    res.sendStatus(204);
  });
  router.post('/api/auth/password',auth,async(req,res)=>{const data=parse(z.object({current:z.string().max(128),password:z.string().min(12).max(128)}).strict(),req.body);await mutate(req,(t,state)=>{const account=state.accounts[req.account.id];if(!d.passwordValid(data.current,account.password_hash))d.fail('Senha atual incorreta',403);account.password_hash=d.passwordHash(data.password);for(const [key,s]of Object.entries(state.sessions))if(s.account_id===account.id)delete state.sessions[key];d.audit(t,account.id,'auth.password_changed',account.id);});res.json({ok:true});});
  router.get('/api/dashboard',auth,(req,res)=>{
    const day=parse(date,req.query.date||d.localParts(Date.now(),req.tenant.timezone).date);
    const t=req.tenant;
    const appointments=t.appointments.filter(a=>(req.account.role!=='professional'||a.professional_id===req.account.professional_id)&&d.localParts(a.starts_at,t.timezone).date===day).map(a=>({...safeAppointment(a),customer_name:d.entity(t,'customers',a.customer_id).name,service_name:d.entity(t,'services',a.service_id).name,professional_name:d.entity(t,'professionals',a.professional_id).name}));
    res.json({date:day,metrics:req.account.role==='professional'?{appointments:appointments.length}:d.metrics(t,day),appointments,tenant:safeTenant(t)});
  });
  for(const[type,schema]of [['services',serviceSchema],['professionals',professionalSchema]]) {
    router.get(`/api/${type}`,auth,(req,res)=>res.json(req.tenant[type]));
    router.post(`/api/${type}`,auth,manager,async(req,res)=>{const data=parse(schema,req.body);const result=await mutate(req,t=>{if(t[type].length>=100)d.fail('Limite do catálogo atingido. Contate o suporte.',429);if(type==='professionals')for(const sid of data.service_ids)d.entity(t,'services',sid);const item={id:d.uid(),...data};t[type].push(item);d.audit(t,req.account.id,`${type}.created`,item.id);return item;});res.status(201).json(result);});
    router.patch(`/api/${type}/:id`,auth,manager,async(req,res)=>{const data=parse(schema,req.body);const result=await mutate(req,t=>{const item=d.entity(t,type,req.params.id);if(type==='professionals')for(const sid of data.service_ids)d.entity(t,'services',sid);Object.assign(item,data);d.audit(t,req.account.id,`${type}.updated`,item.id);return item;});res.json(result);});
  }
  router.get('/api/availability',auth,(req,res)=>res.json(d.slots(req.tenant,parse(id,req.query.service_id),parse(date,req.query.date),req.query.professional_id)));
  router.get('/api/blocks',auth,(req,res)=>res.json(req.tenant.blocks.filter(b=>req.account.role!=='professional'||b.professional_id===req.account.professional_id)));
  router.post('/api/blocks',auth,async(req,res)=>{const data=parse(z.object({professional_id:id,starts_at:instant,ends_at:instant,reason:text}).strict().refine(x=>Date.parse(x.starts_at)<Date.parse(x.ends_at)),req.body);data.starts_at=new Date(data.starts_at).toISOString();data.ends_at=new Date(data.ends_at).toISOString();if(req.account.role==='professional' && data.professional_id!==req.account.professional_id)d.fail('Acesso negado',403);if(!['owner','manager','professional'].includes(req.account.role))d.fail('Acesso negado',403);const result=await mutate(req,t=>{d.entity(t,'professionals',data.professional_id);if(t.appointments.some(a=>a.professional_id===data.professional_id && d.ACTIVE.includes(a.status)&&d.overlap(data.starts_at,data.ends_at,a.starts_at,a.ends_at)))d.fail('O bloqueio sobrepõe agendamentos existentes',409);const b={id:d.uid(),...data};t.blocks.push(b);d.audit(t,req.account.id,'block.created',b.id);return b;});res.status(201).json(result);});
  router.delete('/api/blocks/:id',auth,async(req,res)=>{await mutate(req,t=>{const b=d.entity(t,'blocks',req.params.id);if(!['owner','manager'].includes(req.account.role)&&!(req.account.role==='professional'&&b.professional_id===req.account.professional_id))d.fail('Acesso negado',403);t.blocks=t.blocks.filter(x=>x.id!==b.id);d.audit(t,req.account.id,'block.removed',b.id);});res.json({ok:true});});
  router.get('/api/appointments',auth,(req,res)=>res.json(req.tenant.appointments.filter(a=>req.account.role!=='professional'||a.professional_id===req.account.professional_id).map(safeAppointment)));
  router.post('/api/appointments',auth,operator,async(req,res)=>{const data=parse(booking,req.body);const a=await mutate(req,t=>d.book(t,data,{actor:req.account.id,source:'operator',paymentEnabled:providers.integrationStatus(t).pix}));res.status(201).json({...safeAppointment(a),manage_url:`${origin}${basePath}/#manage/${a.id}/${a.manage_token}`});});
  router.get('/api/appointments/:id/payment-link',auth,operator,(req,res)=>{const a=d.entity(req.tenant,'appointments',req.params.id);res.json({manage_url:`${origin}${basePath}/#manage/${a.id}/${a.manage_token}`});});
  router.post('/api/appointments/:id/status',auth,async(req,res)=>{const data=parse(z.object({status:z.enum(['confirmed','checked_in','completed','no_show','cancelled_by_business'])}).strict(),req.body);res.json(safeAppointment(await mutate(req,t=>{const a=d.entity(t,'appointments',req.params.id);if(req.account.role==='professional'&&a.professional_id!==req.account.professional_id)d.fail('Acesso negado',403);return d.transition(t,a,data.status,req.account.id);})));});
  router.post('/api/appointments/:id/reschedule',auth,operator,async(req,res)=>{const data=parse(z.object({starts_at:instant,professional_id:id.optional()}).strict(),req.body);res.json(safeAppointment(await mutate(req,t=>d.reschedule(t,d.entity(t,'appointments',req.params.id),data,req.account.id))));});
  router.get('/api/customers',auth,operator,(req,res)=>{
    const paged=req.query.page!==undefined||req.query.page_size!==undefined||req.query.q!==undefined;
    if(!paged)return res.json(req.tenant.customers);
    const page=Math.max(1,Number.parseInt(String(req.query.page||'1'),10)||1);
    const pageSize=Math.min(100,Math.max(5,Number.parseInt(String(req.query.page_size||'20'),10)||20));
    const q=String(req.query.q||'').trim().toLocaleLowerCase('pt-BR');
    const filtered=req.tenant.customers
      .filter(customer=>{
        if(!q)return true;
        const haystack=[customer.name,customer.phone,...(customer.tags||[])].join(' ').toLocaleLowerCase('pt-BR');
        return haystack.includes(q);
      })
      .sort((a,b)=>customerCollator.compare(String(a.name||''),String(b.name||'')));
    const total=filtered.length;
    const pages=Math.max(1,Math.ceil(total/pageSize));
    const safePage=Math.min(page,pages);
    const start=(safePage-1)*pageSize;
    res.json({items:filtered.slice(start,start+pageSize),total,page:safePage,page_size:pageSize,pages});
  });
  router.post('/api/customers',auth,operator,async(req,res)=>{const data=parse(z.object({name:text,phone,consent:z.boolean()}).strict(),req.body);res.status(201).json(await mutate(req,t=>{const c=d.customer(t,data,{trusted:true});d.audit(t,req.account.id,'customer.updated',c.id);return c;}));});
  router.patch('/api/customers/:id',auth,operator,async(req,res)=>{const data=parse(z.object({name:text,phone,consent:z.boolean(),tags:z.array(z.string().max(30)).max(20)}).strict(),req.body);res.json(await mutate(req,t=>{const c=d.entity(t,'customers',req.params.id);if(t.customers.some(x=>x.id!==c.id&&x.phone===data.phone))d.fail('Telefone já cadastrado',409);Object.assign(c,data);c.consents.push({at:new Date().toISOString(),purpose:'marketing',channel:'operator',granted:data.consent});d.audit(t,req.account.id,'customer.updated',c.id);return c;}));});
  router.get('/api/customers/:id/export',auth,manager,async(req,res)=>{const result=await mutate(req,t=>{const c=d.entity(t,'customers',req.params.id);d.audit(t,req.account.id,'customer.exported',c.id);return {customer:c,appointments:t.appointments.filter(a=>a.customer_id===c.id).map(safeAppointment),conversations:t.conversations.filter(x=>x.customer_id===c.id)};});res.attachment('cliente.json').json(result);});
  router.post('/api/customers/:id/anonymize',auth,owner,async(req,res)=>{await mutate(req,t=>{const c=d.entity(t,'customers',req.params.id);c.name='Cliente anonimizado';c.phone=`erased:${c.id}`;delete c.email;c.consent=false;c.tags=[];c.consents=[];c.anonymized_at=new Date().toISOString();for(const conv of t.conversations.filter(x=>x.customer_id===c.id)){conv.messages=[];conv.closed_at=new Date().toISOString();}for(const j of t.jobs.filter(j=>j.payload.customer_id===c.id&&j.status==='pending'))j.status='cancelled';d.audit(t,req.account.id,'customer.anonymized_projection',c.id);});res.json({ok:true,note:'Projeção anonimizada. Histórico imutável segue política de retenção; solicitação de eliminação deve ser tratada pelo responsável.'});});
  router.get('/api/waitlist',auth,operator,(req,res)=>res.json(req.tenant.waitlist));
  router.post('/api/waitlist',auth,operator,async(req,res)=>{const data=parse(z.object({customer_id:id,service_id:id,professional_id:id.nullable().optional(),date}).strict(),req.body);res.status(201).json(await mutate(req,t=>{d.entity(t,'customers',data.customer_id);d.entity(t,'services',data.service_id);if(data.professional_id)d.entity(t,'professionals',data.professional_id);const w={id:d.uid(),...data,status:'waiting',created_at:new Date().toISOString()};t.waitlist.push(w);return w;}));});
  router.get('/api/payments',auth,manager,(req,res)=>res.json(req.tenant.payments.map(({qr_code,qr_code_base64,...rest})=>rest)));
  router.post('/api/payments/:id/confirm',auth,manager,async(req,res)=>{const data=parse(z.object({bank_reference:z.string().trim().min(1).max(100)}).strict(),req.body);res.json(await mutate(req,t=>{const p=d.entity(t,'payments',req.params.id);if(p.provider!=='pix_manual')d.fail('Pagamento antigo requer conciliação pelo administrador',409);if(p.status==='paid')return p;if(p.status!=='pending')d.fail('Pagamento não pode ser confirmado',409);if(t.payments.some(other=>other.id!==p.id&&other.bank_reference===data.bank_reference))d.fail('Referência bancária já utilizada',409);d.settle(t,p,Date.now(),req.account.id);p.confirmed_by=req.account.id;p.bank_reference=data.bank_reference;p.confirmation_method='manual';return p;}));});
  router.post('/api/payments/:id/refund',auth,owner,async(req,res)=>{const data=parse(z.object({bank_reference:z.string().trim().min(1).max(100)}).strict(),req.body);await mutate(req,t=>{const p=d.entity(t,'payments',req.params.id);if(p.status!=='paid')d.fail('Pagamento não permite registro de devolução',409);p.status='refunded';p.refund_reference=data.bank_reference;p.refunded_at=new Date().toISOString();d.entity(t,'appointments',p.appointment_id).payment_status='refunded';d.audit(t,req.account.id,'payment.refund_recorded',p.id);});res.json({ok:true});});
  router.get('/api/conversations',auth,operator,(req,res)=>res.json(req.tenant.conversations));
  router.post('/api/conversations/:id/handoff',auth,operator,async(req,res)=>{const data=parse(z.object({enabled:z.boolean()}).strict(),req.body);res.json(await mutate(req,t=>{const c=d.entity(t,'conversations',req.params.id);c.human_handoff=data.enabled;c.state=data.enabled?'human':'start';c.failures=0;d.audit(t,req.account.id,'conversation.handoff',c.id);return c;}));});
  router.post('/api/conversations/:id/reply',auth,operator,async(req,res)=>{const data=parse(z.object({text:z.string().trim().min(1).max(2000)}).strict(),req.body);await mutate(req,t=>{const c=d.entity(t,'conversations',req.params.id);if(!c.human_handoff)d.fail('Assuma o atendimento primeiro',409);if(!c.last_inbound_at||Date.parse(c.last_inbound_at)<Date.now()-24*3600000)d.fail('Janela de 24h encerrada; use um template aprovado',409);const msg={id:d.uid(),direction:'out',text:data.text,at:new Date().toISOString(),status:'queued'};c.messages.push(msg);d.queue(t,'reply',{customer_id:c.customer_id,text:data.text,conversation_id:c.id,message_id:msg.id},undefined,`reply:${msg.id}`);});res.json({ok:true});});
  router.post('/api/conversations/simulate',auth,operator,(req,res)=>{const data=parse(z.object({phone,name:text,text:z.string().min(1).max(2000)}).strict(),req.body);const key=`${req.tenant.id}:${req.account.id}`;let simulation=simulations.get(key);if(!simulation||simulation.expires<Date.now()){if(simulations.size>=100)simulations.delete(simulations.keys().next().value);simulation={tenant:structuredClone(req.tenant),expires:Date.now()+3600000,count:0};simulations.set(key,simulation);}if(++simulation.count>1000){simulations.delete(key);d.fail('Simulação concluída. Abra uma nova sessão de teste.',429);}const reply=converse(simulation.tenant,{...data,message_id:d.uid()});for(const j of simulation.tenant.jobs)j.status='simulated';res.json({reply,simulated:true});});
  router.get('/api/jobs',auth,manager,(req,res)=>res.json(req.tenant.jobs));
  router.post('/api/jobs/:id/retry',auth,manager,async(req,res)=>{await mutate(req,t=>{const j=d.entity(t,'jobs',req.params.id);if(!['failed','blocked'].includes(j.status))d.fail('Job não pode ser reexecutado',409);j.status='pending';j.attempts=0;j.scheduled_at=new Date().toISOString();});res.json({ok:true});});
  router.post('/api/campaigns/recovery',auth,manager,async(req,res)=>{const campaign=d.uid();let count=0;await mutate(req,t=>{for(const c of t.customers.filter(c=>c.consent&&c.last_visit_at&&Date.parse(c.last_visit_at)<Date.now()-t.recovery_days*86400000&&!t.appointments.some(a=>a.customer_id===c.id&&d.ACTIVE.includes(a.status)))){if(t.jobs.some(j=>j.type==='recovery'&&j.payload.customer_id===c.id&&Date.parse(j.scheduled_at)>Date.now()-30*86400000))continue;d.queue(t,'recovery',{customer_id:c.id,campaign_id:campaign});count++;}d.audit(t,req.account.id,'campaign.recovery_created',campaign);});res.json({campaign_id:campaign,queued:count});});
  router.get('/api/settings',auth,manager,(req,res)=>res.json({tenant:safeTenant(req.tenant),integrations:providers.integrationStatus(req.tenant),pix:req.tenant.pix||{enabled:false,recipient_name:'',recipient_city:'',keys:[],default_key_id:null}}));
  router.patch('/api/settings',auth,manager,async(req,res)=>{const data=parse(settingsSchema,req.body);try{new Intl.DateTimeFormat('pt-BR',{timeZone:data.timezone});}catch{d.fail('Timezone inválido');}res.json(await mutate(req,t=>{Object.assign(t,data);d.audit(t,req.account.id,'tenant.settings_updated',t.id);return safeTenant(t);}));});
  router.patch('/api/settings/pix',auth,owner,async(req,res)=>{const data=normalizePixConfig(req.body);res.json(await mutate(req,t=>{t.pix=data;d.audit(t,req.account.id,'integration.pix_updated',t.id);return t.pix;}));});
  router.patch('/api/settings/whatsapp',auth,owner,async(req,res)=>{const data=parse(z.object({phone_id:z.string().regex(/^\d{5,30}$/)}).strict(),req.body);if(data.phone_id!==process.env.WHATSAPP_PHONE_ID)d.fail('Número precisa ser autorizado no ambiente pelo administrador da plataforma',403);await mutate(req,(t,state)=>{if(Object.values(state.tenants).some(other=>other.id!==t.id&&other.integrations.phone_id===data.phone_id))d.fail('Número já vinculado',409);t.integrations.phone_id=data.phone_id;d.audit(t,req.account.id,'integration.whatsapp_linked',t.id);});res.json({ok:true});});
  router.get('/api/users',auth,owner,(req,res)=>res.json(Object.values(store.state.accounts).filter(a=>a.tenant_id===req.tenant.id).map(({password_hash,...a})=>a)));
  router.post('/api/users',auth,owner,async(req,res)=>{const data=parse(z.object({name:text,email:z.string().email().transform(x=>x.toLowerCase()),password:z.string().min(12).max(128),role:z.enum(['manager','attendant','professional']),professional_id:id.nullable().optional()}).strict(),req.body);const result=await mutate(req,(t,state)=>{if(state.accounts[data.email])d.fail('E-mail já cadastrado',409);if(data.role==='professional'){if(!data.professional_id)d.fail('Selecione um profissional');d.entity(t,'professionals',data.professional_id);}const {password,...rest}=data;const a={id:d.uid(),...rest,tenant_id:t.id,active:true,password_hash:d.passwordHash(password)};state.accounts[a.id]=a;state.accounts[a.email]={alias:a.id};d.audit(t,req.account.id,'user.created',a.id);const {password_hash,...safe}=a;return safe;});res.status(201).json(result);});
  router.post('/api/users/:id/disable',auth,owner,async(req,res)=>{await mutate(req,(t,state)=>{const a=state.accounts[req.params.id];if(!a||a.tenant_id!==t.id)d.fail('Usuário não encontrado',404);if(a.role==='owner')d.fail('Não é possível desativar proprietário',409);a.active=false;d.audit(t,req.account.id,'user.disabled',a.id);});res.json({ok:true});});
  router.get('/api/audit',auth,manager,(req,res)=>res.json(req.tenant.audit.slice(-500).reverse()));
  router.get('/api/billing',auth,owner,(req,res)=>{
    const config=billing.billingConfig();
    res.json({
      plans:config.plans,
      provider:config.provider,
      provider_configured:config.provider_configured,
      subscription:req.tenant.billing||{status:'not_configured'}
    });
  });
  router.post('/api/billing/checkout',auth,owner,(req,res)=>{billing.getPlan(req.body?.plan_id);d.fail('Cobrança automática removida. Combine a mensalidade com o administrador da plataforma.',503);});
  router.post('/api/billing/cancel',auth,owner,(req,res)=>{d.fail('Solicite o encerramento da assinatura ao administrador da plataforma.',409);});
  router.get('/api/export',auth,owner,async(req,res)=>{const data=await mutate(req,t=>{d.audit(t,req.account.id,'tenant.exported',t.id);return {...t,appointments:t.appointments.map(safeAppointment)};});res.attachment('agendazap-export.json').json(data);});

  router.get('/api/public/:slug', (req,res)=>res.json(catalog(getTenant(req.params.slug))));
  router.get('/api/public/:slug/availability',(req,res)=>res.json(d.slots(getTenant(req.params.slug),parse(id,req.query.service_id),parse(date,req.query.date),req.query.professional_id)));
  router.post('/api/public/:slug/appointments',async(req,res)=>{const data=parse(booking,req.body);const tenant=getTenant(req.params.slug);const result=await store.transaction('public-booking',state=>{const t=state.tenants[tenant.id];if(t.appointments.filter(a=>a.created_at>new Date(Date.now()-3600000).toISOString()&&d.entity(t,'customers',a.customer_id).phone===data.phone).length>=5)d.fail('Limite de reservas por telefone atingido',429);return d.book(t,data,{paymentEnabled:providers.integrationStatus(t).pix});});res.status(201).json({appointment:safeAppointment(result),manage_token:result.manage_token});});
  function managed(req,state=store.state) {for(const t of Object.values(state.tenants)){const a=t.appointments.find(a=>a.id===req.params.id && a.manage_token===req.get('x-booking-token'));if(a)return {t,a};}d.fail('Agendamento não encontrado',404);}
  router.get('/api/public/appointments/:id/manage',async(req,res)=>{const {t,a}=managed(req);let payment=t.payments.find(p=>p.appointment_id===a.id)||null;if(!payment&&a.status==='awaiting_payment'&&Date.parse(a.expires_at)>Date.now()&&providers.integrationStatus(t).pix)payment=await store.transaction('pix-create',state=>{const {t:live,a:current}=managed(req,state);if(current.status!=='awaiting_payment'||Date.parse(current.expires_at)<=Date.now())d.fail('Prazo da reserva encerrado',409);const existing=live.payments.find(p=>p.appointment_id===current.id);if(existing)return existing;const created=createPixPayment(live,current);live.payments.push(created);d.audit(live,'customer','payment.created',created.id);return created;});if(payment&&(a.status!=='awaiting_payment'||Date.parse(a.expires_at)<=Date.now())){const {qr_code,qr_code_base64,key_value,...safe}=payment;payment=safe;}res.json({appointment:safeAppointment(a),catalog:catalog(t),payment:await paymentWithQr(payment)});});
  router.post('/api/public/appointments/:id/cancel',async(req,res)=>{await store.transaction('public-cancel',state=>{const {t,a}=managed(req,state);if(Date.parse(a.starts_at)-Date.now()<t.cancellation_hours*3600000)d.fail('Prazo de cancelamento encerrado. Fale com o estabelecimento.',409);d.transition(t,a,'cancelled_by_customer','customer');});res.json({ok:true});});
  router.post('/api/public/appointments/:id/reschedule',async(req,res)=>{const data=parse(z.object({starts_at:instant,professional_id:id.optional()}).strict(),req.body);res.json(await store.transaction('public-reschedule',state=>{const {t,a}=managed(req,state);if(Date.parse(a.starts_at)-Date.now()<t.cancellation_hours*3600000)d.fail('Prazo de reagendamento encerrado',409);return safeAppointment(d.reschedule(t,a,data,'customer'));}));});
  router.get('/api/webhooks/whatsapp',(req,res)=>{if(!process.env.WHATSAPP_VERIFY_TOKEN||req.query['hub.mode']!=='subscribe'||req.query['hub.verify_token']!==process.env.WHATSAPP_VERIFY_TOKEN)return res.sendStatus(403);res.type('text').send(req.query['hub.challenge']);});
  router.post('/api/webhooks/whatsapp',async(req,res)=>{
    if(!providers.whatsappSignature(req.rawBody,req.get('x-hub-signature-256')))d.fail('Assinatura inválida',401);
    const entries=Array.isArray(req.body?.entry)?req.body.entry.slice(0,20):[];
    for(const entry of entries)for(const change of Array.isArray(entry.changes)?entry.changes.slice(0,20):[]){const value=change.value;if(change.field&&change.field!=='messages')continue;const phoneId=value?.metadata?.phone_number_id;if(typeof phoneId!=='string')continue;const t=Object.values(store.state.tenants).find(t=>t.integrations.phone_id===phoneId);if(!t)continue;
      for(const raw of Array.isArray(value.messages)?value.messages.slice(0,100):[]){
        const parsed=z.object({id:z.string().max(100),from:z.string().regex(/^\d{8,15}$/),type:z.string(),text:z.object({body:z.string().transform(s=>s.slice(0,4000))}).optional(),button:z.object({text:z.string().max(4000)}).optional(),interactive:z.object({button_reply:z.object({title:z.string().max(4000)}).optional(),list_reply:z.object({title:z.string().max(4000)}).optional()}).optional()}).safeParse(raw);if(!parsed.success)continue;
        const m=parsed.data,message=m.type==='text'?m.text?.body:m.type==='button'?m.button?.text:m.type==='interactive'?(m.interactive?.button_reply?.title||m.interactive?.list_reply?.title):['audio','image','document'].includes(m.type)?'HUMANO':null;if(!message)continue;
        const intent=m.type==='text'?await providers.classify(message):null;const name=typeof value.contacts?.[0]?.profile?.name==='string'?value.contacts[0].profile.name.slice(0,160):undefined;
        await store.transaction('whatsapp',state=>{converse(state.tenants[t.id],{phone:`+${m.from}`,name,text:message,message_id:m.id},intent);});
      }
      if(Array.isArray(value.statuses))await store.transaction('whatsapp-status',state=>{for(const status of value.statuses.slice(0,100))if(typeof status.id==='string'&&typeof status.status==='string')for(const conv of state.tenants[t.id].conversations)for(const msg of conv.messages)if(msg.provider_id===status.id)msg.status=status.status.slice(0,30);});
    }
    res.json({ok:true});
  });
  router.use(express.static(resolve('public'),{index:'index.html',maxAge:0}));
  router.use('/api',(req,res)=>res.status(404).json({error:'Endpoint não encontrado'}));
  app.get(basePath,(req,res)=>res.redirect(308,basePath+'/'));
  app.use(basePath||'/',router);
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    if(error instanceof z.ZodError)return res.status(400).json({error:'Verifique os campos',details:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
    if(error.status)return res.status(error.status).json({error:error.message});
    console.error(JSON.stringify({event:'request_failed',method:req.method,path:req.path,status:500,error_type:error.constructor.name}));
    res.status(503).json({error:'Serviço temporariamente indisponível. Tente novamente.'});
  });
  return app;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(existsSync('.env'))process.loadEnvFile?.('.env');
  const store=new Store(); await store.init();
  const app=createApp(store); const server=app.listen(Number(process.env.PORT||8793),process.env.HOST||'127.0.0.1',()=>console.log(JSON.stringify({event:'started',port:process.env.PORT||8793})));
  const stopWorker=startWorker(store);
  const stopBackups=startBackups(store);
  let stopping=false;
  async function stop(code=0){if(stopping)return;stopping=true;stopBackups();const drained=stopWorker();server.close(async()=>{await drained;await store.tail;await store.close();process.exit(code);});setTimeout(()=>process.exit(1),20000).unref();}
  store.onUnavailable=()=>{void stop(1);};
  process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
}
