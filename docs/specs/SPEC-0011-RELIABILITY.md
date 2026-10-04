# SPEC-0011 — Reliability

**Status:** Draft  
**Versão:** 0.1.0

## 1. Objetivo

Garantir que pagamentos, bookings e mensagens continuem corretos apesar de retries, webhooks duplicados e falhas parciais.

## 2. Transactional Outbox

Toda operação que altera estado e precisa emitir evento:

1. altera agregado;
2. grava outbox na mesma transação;
3. commit;
4. worker publica/processa;
5. marca published_at.

## 3. Idempotência

Obrigatória em:

- create hold;
- confirm booking;
- payment webhook;
- WhatsApp webhook;
- refund;
- recovery conversion.

## 4. Webhook inbox

Persistir antes de processar:

- provider;
- event_id;
- payload_hash;
- received_at;
- status;
- attempts;
- error.

Duplicata retorna sucesso sem repetir efeito.

## 5. Retry

Política:

- exponential backoff;
- jitter;
- max attempts;
- classificação transient/permanent.

## 6. Dead Letter Queue

Após limite:

- mover para DLQ;
- registrar causa;
- alertar;
- permitir replay manual seguro.

## 7. Reconciliação

Jobs periódicos:

- pagamentos pendentes;
- holds expirados;
- appointments inconsistentes;
- mensagens sem status final;
- outbox não publicada.

## 8. SLO inicial

Antes de clientes pagantes definir:

- availability target;
- webhook processing latency;
- booking confirmation latency;
- RPO;
- RTO.

## 9. Observabilidade

Correlacionar:

- trace_id;
- tenant_id;
- appointment_id;
- payment_id;
- provider_event_id.

Nunca usar PII como identificador de log.

## 10. Failure modes testados

- webhook duplicado;
- webhook fora de ordem;
- timeout depois de pagamento;
- worker crash;
- Redis indisponível;
- LLM indisponível;
- WhatsApp indisponível;
- PSP indisponível;
- DB rollback;
- hold expirando durante pagamento.
