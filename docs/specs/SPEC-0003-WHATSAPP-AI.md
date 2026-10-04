# SPEC-0003 — WhatsApp e IA

**Status:** Draft  
**Versão:** 0.2.0

## 1. Objetivo

WhatsApp é canal de conversão. IA melhora linguagem e roteamento; fluxos determinísticos executam operações críticas.

## 2. Camadas

### Conversação livre
LLM interpreta intenção e entidades.

### WhatsApp Flows
Usado para jornadas estruturadas:

- selecionar serviço;
- selecionar profissional;
- selecionar data/horário;
- confirmar dados;
- entrar em lista de espera;
- reagendar/cancelar.

### Tools determinísticas
Toda ação de negócio passa por APIs validadas.

## 3. Onboarding do tenant

A integração deve prever onboarding assistido/embedded quando suportado pelo provedor, incluindo:

- vínculo da conta;
- número;
- webhook;
- templates;
- status da integração;
- health check.

## 4. Intents

- greeting
- list_services
- service_price
- check_availability
- book
- reschedule
- cancel
- join_waitlist
- payment_help
- business_hours
- address
- review
- talk_to_human
- unknown

## 5. Tools

- `list_services`
- `get_service_details`
- `get_available_slots`
- `create_booking_hold`
- `confirm_booking`
- `reschedule_booking`
- `cancel_booking`
- `join_waitlist`
- `get_payment_status`
- `request_human_handoff`

## 6. Restrições da IA

LLM não pode:

- gravar direto no banco;
- alterar preço;
- inventar disponibilidade;
- selecionar tenant;
- alterar política financeira;
- autorizar reembolso;
- ignorar RBAC;
- executar operação fora da allowlist.

Prompt injection é dado não confiável, não autorização.

## 7. Handoff

Handoff obrigatório em:

- solicitação explícita;
- pagamento inconsistente;
- baixa confiança persistente;
- reclamação;
- exceção comercial;
- risco de ação irreversível.

Durante handoff, bot entra em modo passivo.

## 8. Templates e lifecycle

Criar registry interno:

- template_name;
- language;
- category;
- provider_status;
- version;
- purpose;
- variables_schema.

Mensagens devem acompanhar status de entrega quando disponível.

## 9. Metering

Registrar por tenant:

- mensagens inbound/outbound;
- templates enviados;
- tokens de LLM;
- custo estimado;
- chamadas de tool;
- latência;
- falhas;
- conversão atribuída.

## 10. Fallback

Sem LLM, operações essenciais continuam via Flows/menu/página pública.

Sem WhatsApp, página pública continua disponível.

## 11. Next Best Action

A IA pode sugerir oportunidades, mas a decisão operacional nasce do Revenue Engine.

Exemplos:

- cliente deveria ter retornado;
- slot tem risco de ociosidade;
- cancelamento abriu oportunidade;
- cliente é candidato à lista de espera.

A versão inicial pode usar regras determinísticas; modelos preditivos são evolução posterior.
