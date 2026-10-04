# SPEC-0009 — SaaS Billing

**Status:** Draft  
**Versão:** 0.1.0

## 1. Objetivo

Cobrar pelo AgendaZap sem perder visibilidade da margem por tenant.

## 2. Planos

Estrutura:

- plan_id;
- code;
- monthly_price;
- included_limits;
- feature_flags;
- overage_rules;
- active.

## 3. Métricas de uso

Medir:

- WhatsApp outbound;
- WhatsApp templates;
- LLM tokens/calls;
- storage;
- professionals;
- locations;
- automations;
- recovery actions.

## 4. Unit economics

Por tenant:

```text
gross_margin =
subscription_revenue
- messaging_cost
- llm_cost
- payment_cost_allocated
- infra_cost_allocated
```

## 5. Guardrails de margem

- quotas;
- soft limit;
- hard limit quando necessário;
- alertas de custo;
- rate limit por plano;
- custo estimado por automação.

## 6. Subscription lifecycle

Estados:

- trial;
- active;
- past_due;
- suspended;
- cancelled.

## 7. Entitlements

Feature flag por plano:

- AI;
- Revenue Engine;
- multiple_locations;
- packages;
- memberships;
- advanced_analytics;
- white_label.

## 8. Trial

Trial deve ter:

- duração definida;
- limite de uso;
- onboarding completo;
- recovered revenue visível;
- CTA de conversão.

## 9. Billing audit

Registrar:

- plan change;
- subscription change;
- charge;
- refund;
- credit;
- quota override.

## 10. Métricas SaaS

- MRR;
- ARPA;
- trial conversion;
- logo churn;
- revenue churn;
- gross margin;
- CAC payback quando houver CAC;
- expansion revenue.
