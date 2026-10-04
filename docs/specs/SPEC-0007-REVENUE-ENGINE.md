# SPEC-0007 — Revenue Engine

**Status:** Draft  
**Versão:** 0.1.0

## 1. Objetivo

O Revenue Engine identifica capacidade ociosa e clientes com probabilidade de retorno e transforma isso em oportunidades mensuráveis de receita.

## 2. Tipos de oportunidade

- cancelled_slot;
- inactive_customer;
- waitlist_match;
- no_show_recovery;
- expiring_credit;
- membership_renewal;
- low_occupancy_window.

## 3. Pipeline

```text
Evento operacional
      |
      v
Detector de oportunidade
      |
      v
Eligibility Rules
      |
      v
Opportunity
      |
      v
Action / Message
      |
      v
Booking
      |
      v
Completed / Paid
      |
      v
Revenue Attribution
```

## 4. Eligibility

Regras mínimas:

- tenant ativo;
- cliente não opt-out para a finalidade;
- frequency cap;
- serviço compatível;
- disponibilidade real;
- oportunidade não expirada;
- sem campanha conflitante.

## 5. Priorização

MVP usa scoring determinístico:

```text
score =
  value_weight
+ urgency_weight
+ affinity_weight
+ availability_weight
- fatigue_penalty
```

Machine learning não é requisito inicial.

## 6. Atribuição

Revenue Engine registra:

- opportunity_id;
- action_id;
- customer_id;
- appointment_id;
- attributed_amount;
- attribution_window;
- attribution_method.

Não permitir dupla atribuição integral do mesmo appointment.

## 7. Cancelamento recuperado

Quando `slot.became_available` ocorrer:

1. consultar waitlist;
2. consultar clientes compatíveis;
3. aplicar consentimento/frequency cap;
4. ordenar;
5. oferecer slot;
6. primeiro aceite válido recebe hold;
7. appointment concluído gera recovered revenue.

## 8. Reativação

Candidatura pode considerar:

- intervalo desde última visita;
- frequência histórica;
- serviço habitual;
- dia/horário preferido;
- campanhas recentes;
- disponibilidade.

## 9. Métricas

- opportunities_created;
- opportunities_contacted;
- opportunities_converted;
- recovered_revenue;
- recovered_revenue_per_tenant;
- cancellation_recovery_rate;
- reactivation_rate;
- average_recovery_value;
- fatigue/opt-out rate.

## 10. North Star

**Recovered Revenue per Active Tenant (RRAT).**

## 11. Guardrails

- não enviar sem finalidade/base apropriada;
- respeitar quiet hours configuráveis;
- frequency cap;
- cancelamento imediato de automações após opt-out;
- Revenue Engine nunca cria desconto ou altera preço sem regra configurada.
