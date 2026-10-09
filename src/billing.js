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

export function billingConfig(){return {provider:'manual',provider_configured:false,configured:false,plans:PLANS};}
export function getPlan(planId){const plan=PLANS.find(p=>p.id===planId);if(!plan){const error=new Error('Plano inválido');error.status=400;throw error;}return plan;}
