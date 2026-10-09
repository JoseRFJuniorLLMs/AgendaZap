# SPEC-0006 — Roadmap

**Status:** Draft  
**Versão:** 0.3.0

## Princípio

Não construir sete fases antes de vender. O roadmap deve reduzir o tempo até primeiro valor econômico comprovado e primeiro tenant pagante.

A ordem comercial detalhada está em [SPEC-0026](SPEC-0026-REVENUE-AUTOPILOT-EXECUTION-ROADMAP.md).

## Fase 0 — Fundação

- PostgreSQL;
- CI/testes;
- segurança;
- observabilidade;
- backup/restore;
- deploy reproduzível.

**DoD:** ambiente demonstrável e recuperável.

## Fase 1 — Core de agenda

- tenant;
- auth/RBAC;
- professionals;
- services;
- availability;
- holds;
- appointments;
- blocks;
- dashboard.

**DoD:** não há double booking.

## Fase 2 — Conversão

- página pública;
- mobile-first/PWA;
- WhatsApp;
- booking/cancel/reschedule;
- waitlist;
- handoff.

**DoD:** cliente agenda sem atendente.

## Fase 3 — Revenue Autopilot

- PIX;
- reminders;
- cancellation recovery;
- reactivation;
- revenue attribution;
- recovered revenue dashboard.

**DoD:** sistema demonstra dinheiro recuperado.

## Fase 4 — Comercialização P0

- posicionamento e ICP — SPEC-0015;
- WhatsApp multi-tenant — SPEC-0016;
- importação/migração — SPEC-0017;
- onboarding/trial — SPEC-0025;
- pricing/entitlements — SPEC-0024;
- GTM/lead scoring — SPEC-0023.

**DoD:** tenant real ativa sem engenharia e entende o ROI.

## Fase 5 — Retenção e integrações P1

- Google Calendar — SPEC-0017;
- PSP opcional/Asaas e billing — SPEC-0018;
- reviews/referrals — SPEC-0019;
- marketing attribution/Click-to-WhatsApp — SPEC-0021.

**DoD:** integrações aumentam ocupação, retenção ou margem de forma mensurável.

## Fase 6 — Distribuição

- public booking distribution;
- Reserve with Google quando elegível;
- parceiros/canais externos.

Referência: SPEC-0020.

## Fase 7 — Mobile profissional

- PWA madura;
- push operacional;
- AgendaZap Pro somente se métricas justificarem.

Referência: SPEC-0022.

## Fase 8 — Escala

- múltiplas unidades;
- quotas;
- white-label quando comercialmente validado;
- analytics avançado;
- predictive occupancy;
- marketplace somente após PMF.

## Gates

Feature só antecipa ordem se:

1. aumenta conversão;
2. reduz no-show;
3. recupera receita;
4. reduz trabalho;
5. melhora retenção;
6. reduz onboarding;
7. melhora margem.

## North Star

**Recovered Revenue per Active Tenant (RRAT)**

Auxiliares:

- occupancy;
- no-show;
- reactivation;
- cancellation recovery;
- booking conversion;
- activation;
- MRR;
- gross margin per tenant;
- CAC payback.
