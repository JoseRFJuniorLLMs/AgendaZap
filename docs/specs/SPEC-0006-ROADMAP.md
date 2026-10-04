# SPEC-0006 — Roadmap

**Status:** Draft  
**Versão:** 0.2.0

## Princípio

Não construir sete fases antes de vender. O roadmap deve reduzir o tempo até o primeiro tenant pagante.

## Fase 0 — Fundação

- monorepo;
- Docker;
- PostgreSQL;
- Redis;
- migrations;
- CI;
- lint;
- testes;
- secret scanning;
- observabilidade;
- outbox base.

**DoD:** sobe localmente e em ambiente de demonstração.

## Fase 1 — Core de agenda

- tenant;
- location;
- auth/RBAC;
- professionals;
- services;
- resources;
- availability;
- holds;
- appointments;
- dashboard.

**DoD:** não há double booking de profissional/recurso.

## Fase 2 — Jornada comercial

- página pública;
- mobile-first;
- WhatsApp webhook;
- WhatsApp Flows;
- booking;
- cancel;
- reschedule;
- waitlist;
- handoff.

**DoD:** cliente agenda sem atendente.

## Fase 3 — PIX + Revenue Engine

- payment adapter;
- hold TTL;
- PIX;
- reminders;
- cancellation recovery;
- reactivation;
- revenue attribution;
- recovered revenue dashboard.

**DoD:** sistema demonstra dinheiro recuperado.

## Fase 4 — Primeiro tenant pagante

- onboarding;
- import CSV;
- demo tenant;
- plano inicial;
- subscription;
- usage metering;
- termos;
- privacidade;
- suporte operacional.

**DoD:** pelo menos um tenant real pagando.

## Fase 5 — Retenção e monetização

- packages;
- credits;
- memberships;
- commissions;
- Google Calendar;
- reviews;
- referral loop.

## Fase 6 — IA avançada

- intent classification;
- entity extraction;
- tool calling;
- semantic FAQ;
- next-best-action;
- cost observability;
- provider fallback.

IA entra depois do core determinístico provar conversão.

## Fase 7 — Escala

- múltiplas unidades;
- planos;
- quotas;
- white-label;
- vertical profiles;
- advanced analytics;
- predictive occupancy.

## Gates

Feature só entra antes do PMF se:

1. aumenta conversão;
2. reduz no-show;
3. recupera receita;
4. reduz trabalho;
5. melhora retenção;
6. reduz custo de onboarding;
7. melhora margem.

## Indicador North Star

**Recovered Revenue per Active Tenant (RRAT)**

Indicadores auxiliares:

- occupancy;
- no-show;
- reactivation;
- cancellation recovery;
- booking conversion;
- MRR;
- gross margin per tenant.
