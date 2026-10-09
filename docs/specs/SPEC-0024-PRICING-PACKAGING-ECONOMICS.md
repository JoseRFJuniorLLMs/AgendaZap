# SPEC-0024 — Pricing, Packaging e Unit Economics

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Cobrar com base no valor gerado sem entrar em guerra de preço de agenda básica.

## 2. Arquitetura de oferta inicial

### Essencial — referência R$ 99–149/mês

- agenda;
- CRM;
- lembretes;
- PIX manual;
- página pública.

### Revenue — referência R$ 249/mês

Plano recomendado.

- tudo do Essencial;
- WhatsApp;
- lista de espera;
- reativação;
- recuperação de cancelamentos;
- atribuição de receita;
- dashboard Revenue Autopilot.

### Pro AI — referência R$ 397+/mês

- tudo do Revenue;
- Voice AI;
- analytics avançado;
- integrações premium;
- recursos avançados de automação.

Valores são hipótese comercial e devem ser configuráveis.

## 3. Setup

Faixa de referência após fase fundador:

- R$ 297 a R$ 997 conforme migração, configuração e treinamento.

## 4. ROI

Indicadores:

```text
payback_ratio = recovered_revenue / subscription_price
net_value = recovered_revenue - subscription_price
```

Não afirmar causalidade quando a atribuição não suportar.

## 5. Entitlements

Cada plano define:

- professionals;
- locations;
- WhatsApp;
- automation quota;
- AI quota;
- voice quota;
- analytics;
- integrations;
- support tier.

## 6. Overage

Preferir previsibilidade:

- alerta 70%;
- alerta 90%;
- soft limit;
- upgrade explícito;
- hard limit apenas para custo variável relevante.

## 7. Margem

Medir por tenant:

- subscription;
- WhatsApp;
- AI;
- voice;
- PSP;
- infra;
- support allocation;
- gross margin.

## 8. Experimentos

Permitir:

- founder;
- trial;
- coupon;
- annual;
- setup waived;
- grandfathering.

Todo desconto tem motivo e validade.

## 9. Definition of Done

- catálogo de planos versionado;
- feature flags por plano;
- usage visível;
- margem estimável;
- plano recomendado destacado;
- pricing page comunica ROI;
- upgrade/downgrade auditáveis.
