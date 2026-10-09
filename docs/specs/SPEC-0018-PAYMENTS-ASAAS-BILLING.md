# SPEC-0018 — Pagamentos Automatizados, Asaas e Billing SaaS

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Manter PIX direto/manual como opção simples e adicionar um PSP opcional para confirmação automática, recorrência e expansão financeira.

O primeiro adapter candidato é Asaas, sem acoplar o domínio ao fornecedor.

## 2. Modos por tenant

- pix_manual;
- psp_pix;
- psp_card;
- psp_boleto;
- híbrido conforme plano e configuração.

## 3. Contrato PaymentProvider

- create_charge;
- get_charge;
- cancel_charge;
- refund_charge;
- create_subscription;
- cancel_subscription;
- handle_webhook;
- reconcile.

## 4. Source of truth

Frontend nunca confirma pagamento automaticamente.

Estado financeiro só muda após:

- webhook autenticado + validação;
- consulta autoritativa;
- ou confirmação manual explícita no modo pix_manual.

## 5. Estados

- pending;
- paid;
- expired;
- cancelled;
- refunded;
- partially_refunded;
- review_required.

## 6. SaaS billing

Separar completamente:

1. dinheiro do cliente final para o estabelecimento;
2. mensalidade AgendaZap.

Lifecycle:

- trial;
- active;
- past_due;
- grace;
- suspended;
- cancelled.

## 7. Pricing/entitlements

Billing deve fornecer:

- plan_id;
- limits;
- feature flags;
- overage;
- usage;
- gross margin estimada.

Nunca suspender agenda ou acesso a dados sem política explícita e grace period.

## 8. NFS-e

Quando provider suportar e o tenant habilitar:

- configuração fiscal separada;
- emissão vinculada à cobrança;
- status e erro auditáveis;
- retry controlado.

AgendaZap não presume enquadramento tributário.

## 9. Webhooks

- assinatura validada;
- idempotência;
- persistência de payload mínimo necessário;
- reconciliação;
- replay seguro;
- sem confiar em valor enviado pelo frontend.

## 10. Unit economics

Por tenant:

```text
gross_margin =
subscription_revenue
- messaging_cost
- ai_cost
- voice_cost
- payment_cost_allocated
- infra_cost_allocated
```

## 11. Definition of Done

- pix_manual continua funcionando sem PSP;
- adapter PSP pode ser ativado por tenant;
- pagamento automático confirma booking;
- webhook replay não duplica;
- refund é auditável;
- billing SaaS é independente do dinheiro do estabelecimento;
- custo por tenant aparece no painel administrativo.
