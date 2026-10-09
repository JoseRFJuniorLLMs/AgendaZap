# SPEC-0026 — Revenue Autopilot Execution Roadmap

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Consolidar a ordem de implementação que maximiza chance de venda e reduz construção prematura.

## 2. Ordem P0

1. WhatsApp oficial multi-tenant — SPEC-0016;
2. onboarding/importação — SPEC-0017 e SPEC-0025;
3. Revenue Engine demonstrável — SPEC-0007;
4. dashboard de ROI — SPEC-0012;
5. ICP/posicionamento — SPEC-0015;
6. pricing/entitlements — SPEC-0024;
7. processo comercial — SPEC-0023.

## 3. Ordem P1

1. Google Calendar;
2. PSP opcional/Asaas;
3. reviews/referral;
4. attribution Click-to-WhatsApp;
5. billing SaaS automatizado.

## 4. Ordem P2

1. distribuição/Reserve with Google;
2. app AgendaZap Pro;
3. canais adicionais;
4. predictive occupancy;
5. marketplace.

## 5. O que não fazer antes do PMF

- app obrigatório para consumidor;
- marketplace amplo;
- múltiplas verticais simultâneas;
- ML para problema que regra resolve;
- reescrita arquitetural sem ganho comercial;
- integração que não tenha hipótese de ROI.

## 6. Release gates

### Gate A — Vendável

- onboarding sem engenharia;
- agenda confiável;
- WhatsApp funcional;
- recuperação demonstrável;
- termos/privacidade;
- backup/restore.

### Gate B — Repetível

- 10 tenants ativos;
- activation medido;
- lead scoring;
- demo padrão;
- pricing validado;
- suporte documentado.

### Gate C — Escalável

- credenciais isoladas;
- billing automático;
- cost observability;
- quotas;
- integração health;
- incident response;
- métricas de churn.

## 7. KPI hierarchy

North Star:

**Recovered Revenue per Active Tenant (RRAT)**

Produto:

- occupancy;
- cancellation recovery;
- reactivation;
- no-show;
- booking conversion.

SaaS:

- MRR;
- ARPA;
- activation;
- logo churn;
- gross margin;
- CAC payback.

## 8. Regra de priorização

```text
priority =
revenue_impact
+ activation_impact
+ retention_impact
+ support_reduction
- implementation_cost
- variable_cost_risk
- compliance_risk
```

## 9. Definition of Done

A SPEC é operacional quando cada iniciativa tem:

- owner;
- milestone;
- métrica de sucesso;
- feature flag quando aplicável;
- testes;
- observabilidade;
- rollback/fallback;
- evidência de resultado.
