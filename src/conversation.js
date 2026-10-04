import {customer,uid,slots,book,entity,transition,reschedule,audit,queue,localParts} from './domain.js';
import {integrationStatus} from './providers.js';

const money=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(x/100);
export function converse(t,{phone,name,text,message_id},intent=null) {
  const c=customer(t,{phone,name:name||'Cliente WhatsApp'});
  let conv=t.conversations.find(x=>x.customer_id===c.id && !x.closed_at);
  if(!conv) {conv={id:uid(),customer_id:c.id,state:'start',human_handoff:false,messages:[],failures:0,started_at:new Date().toISOString(),last_inbound_at:null};t.conversations.push(conv);}
  if(conv.messages.some(m=>m.provider_id===message_id))return null;
  conv.last_inbound_at=new Date().toISOString();conv.messages.push({id:uid(),direction:'in',text,provider_id:message_id,at:conv.last_inbound_at});
  const input=text.toLowerCase().trim();let reply;
  if(['sair','parar','stop'].includes(input)) {c.consent=false;c.consents.push({at:new Date().toISOString(),purpose:'marketing',channel:'whatsapp',granted:false});reply='Preferência registrada. Você não receberá mensagens promocionais.';}
  else if(['humano','atendente'].some(x=>input.includes(x)) || intent==='human') {conv.human_handoff=true;conv.state='human';reply='Vou encaminhar sua conversa para um atendente.';}
  else if(conv.human_handoff)return null;
  else if(input==='menu' || ['oi','olá','ola','bom dia'].includes(input)) {conv.state='start';reply=`Olá, ${c.name}! Sou o assistente do ${t.name}.\n1. Agendar\n2. Serviços e preços\n3. Meus agendamentos\n4. Falar com atendente\nDigite SAIR para revogar mensagens promocionais.`;}
  else if(conv.state==='start' && (input==='4')) {conv.human_handoff=true;reply='Um atendente vai continuar sua conversa.';}
  else if(conv.state==='start' && (input==='2' || intent==='services')) {reply=t.services.filter(s=>s.active).map((s,i)=>`${i+1}. ${s.name} · ${s.duration_minutes} min · ${money(s.price_cents)}`).join('\n')||'Nenhum serviço cadastrado.';reply+='\nDigite 1 para agendar ou MENU.';}
  else if(conv.state==='start' && (input==='3' || intent==='cancel' || intent==='reschedule')) {
    conv.options=t.appointments.filter(a=>a.customer_id===c.id && ['confirmed','pending','awaiting_payment'].includes(a.status)).map(a=>a.id);conv.state='manage';
    reply=conv.options.length?conv.options.map((id,i)=>{const a=entity(t,'appointments',id);return `${i+1}. ${entity(t,'services',a.service_id).name}: ${new Date(a.starts_at).toLocaleString('pt-BR',{timeZone:t.timezone})}`;}).join('\n')+'\nEscolha o número.':'Você não tem agendamentos ativos. Digite MENU.';
  }
  else if(conv.state==='manage' && conv.options[Number(input)-1]) {conv.appointment_id=conv.options[Number(input)-1];conv.state='manage_action';reply='Digite CANCELAR para cancelar; REAGENDAR para escolher uma nova data.';}
  else if(conv.state==='manage_action' && input==='cancelar') {const a=entity(t,'appointments',conv.appointment_id);if(Date.parse(a.starts_at)-Date.now()<t.cancellation_hours*3600000){conv.human_handoff=true;reply='Este cancelamento precisa ser tratado por um atendente pela política de antecedência.';}else{transition(t,a,'cancelled_by_customer','whatsapp');conv.state='start';reply='Agendamento cancelado. Digite MENU.';}}
  else if(conv.state==='manage_action' && input==='reagendar') {conv.service_id=entity(t,'appointments',conv.appointment_id).service_id;conv.rescheduling=true;conv.state='date';reply='Qual a nova data? Use AAAA-MM-DD.';}
  else if(conv.state==='start' && (input==='1' || intent==='book')) {conv.options=t.services.filter(s=>s.active).map(s=>s.id);conv.state='service';reply=conv.options.map((id,i)=>`${i+1}. ${entity(t,'services',id).name}`).join('\n')+'\nEscolha o número do serviço.';}
  else if(conv.state==='service' && conv.options[Number(input)-1]) {conv.service_id=conv.options[Number(input)-1];conv.state='date';reply='Qual data? Use AAAA-MM-DD.';}
  else if(conv.state==='date' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    conv.options=slots(t,conv.service_id,input).slice(0,30);conv.state='slot';
    reply=conv.options.length?conv.options.map((s,i)=>`${i+1}. ${s.time} · ${s.professional_name}`).join('\n')+'\nEscolha o número do horário.':'Nenhuma vaga nesta data. Digite MENU para recomeçar.';
  }
  else if(conv.state==='slot' && conv.options[Number(input)-1]) {
    const slot=conv.options[Number(input)-1];
    try {
      const a=conv.rescheduling?reschedule(t,entity(t,'appointments',conv.appointment_id),slot,'whatsapp'):book(t,{service_id:conv.service_id,professional_id:slot.professional_id,starts_at:slot.starts_at,customer_id:c.id,idempotency_key:message_id},{source:'whatsapp',paymentEnabled:integrationStatus().pix});
      conv.state='start';conv.rescheduling=false;
      const link=`${process.env.PUBLIC_ORIGIN}${process.env.BASE_PATH||'/AgendaZap'}/#manage/${a.id}/${a.manage_token}`;
      reply=a.status==='awaiting_payment'?`Reserva feita por 15 minutos. Abra o link para pagar o sinal: ${link}`:`Agendamento confirmado! Gerencie aqui: ${link}`;
    }catch(e){reply=e.status?`${e.message}. Digite MENU.`:'Não consegui reservar. Um atendente vai ajudar.';conv.state='start';}
  }
  else if(intent==='address')reply=t.address||'Endereço ainda não informado.';
  else if(intent==='hours')reply='Consulte os horários disponíveis escolhendo 1 para agendar.';
  else {conv.failures++;if(conv.failures>=3){conv.human_handoff=true;reply='Vou encaminhar para um atendente.';}else reply='Não entendi. Digite MENU para ver as opções ou HUMANO.';}
  conv.messages.push({id:uid(),direction:'out',text:reply,at:new Date().toISOString(),status:'queued'});
  queue(t,'reply',{customer_id:c.id,conversation_id:conv.id,text:reply,message_id:conv.messages.at(-1).id},undefined,`reply:${message_id}`);
  audit(t,'whatsapp','conversation.received',conv.id);return reply;
}
