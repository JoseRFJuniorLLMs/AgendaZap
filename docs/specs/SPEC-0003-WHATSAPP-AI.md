# SPEC-0003 — WhatsApp e IA

**Status:** Draft  
**Versão:** 0.1.0

## 1. Objetivo

Transformar o WhatsApp no principal canal de conversão do AgendaZap sem tornar o sistema dependente de respostas probabilísticas.

## 2. Canal

Integração primária:

- Meta WhatsApp Cloud API;
- webhook para mensagens recebidas;
- templates aprovados para mensagens iniciadas pelo estabelecimento;
- tracking de status quando disponível.

## 3. Intents iniciais

- `greeting`
- `list_services`
- `service_price`
- `check_availability`
- `book`
- `reschedule`
- `cancel`
- `payment_help`
- `business_hours`
- `address`
- `talk_to_human`
- `unknown`

## 4. Regra de arquitetura

O LLM pode:

- interpretar linguagem natural;
- extrair intenção;
- extrair entidades;
- redigir respostas;
- resumir conversa.

O LLM não pode:

- gravar diretamente no banco;
- confirmar horário inexistente;
- criar cobrança arbitrária;
- alterar preço;
- autorizar estorno;
- ignorar regras de agenda.

Toda ação deve virar chamada determinística a uma tool/API validada.

## 5. Tools

Exemplo:

```json
{
  "name": "get_available_slots",
  "arguments": {
    "service_id": "uuid",
    "professional_id": "uuid|null",
    "date": "YYYY-MM-DD"
  }
}
```

Tools mínimas:

- `list_services`
- `get_service_details`
- `get_available_slots`
- `create_booking_hold`
- `confirm_booking`
- `reschedule_booking`
- `cancel_booking`
- `get_payment_status`
- `request_human_handoff`

## 6. Estado conversacional

Fluxo controlado pelo backend:

```text
START
  |
  v
IDENTIFY_CUSTOMER
  |
  v
UNDERSTAND_INTENT
  |
  +--> FAQ
  +--> HUMAN
  +--> BOOKING
          |
          v
       SERVICE
          |
          v
     PROFESSIONAL
          |
          v
        SLOT
          |
          v
       CONFIRM
          |
          v
       PAYMENT?
          |
          v
         DONE
```

## 7. Handoff humano

Disparar handoff quando:

- cliente solicita;
- baixa confiança;
- três falhas consecutivas de interpretação;
- reclamação;
- pagamento inconsistente;
- política comercial não automatizada.

Durante handoff, o bot não deve competir com o atendente.

## 8. Automação outbound

Casos permitidos:

- confirmação;
- lembrete;
- cobrança de sinal;
- aviso de cancelamento;
- oferta de vaga para lista de espera;
- pós-atendimento;
- reativação de cliente, respeitando consentimento e regras do canal.

## 9. Recuperação de clientes

Elegibilidade configurável:

- último atendimento > N dias;
- serviço elegível;
- cliente não opt-out;
- ausência de campanha recente;
- limite de frequência.

Registrar:

- campanha;
- mensagem;
- resposta;
- agendamento atribuído;
- receita atribuída.

## 10. Observabilidade

Registrar:

- intent detectada;
- tool chamada;
- latência;
- falha;
- handoff;
- tokens/custo quando aplicável;
- resultado de negócio.

Não registrar segredos nem dados desnecessários em prompts/logs.

## 11. Fallback sem IA

O produto deve continuar operando com menu e fluxos determinísticos se o provedor de LLM falhar.
