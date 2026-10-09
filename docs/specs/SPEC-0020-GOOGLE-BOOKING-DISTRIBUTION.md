# SPEC-0020 — Discovery e Distribuição de Reservas

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Preparar o AgendaZap para distribuir disponibilidade em canais externos, incluindo integrações de reserva do Google quando elegível e aprovado.

## 2. Premissa

Integração com plataformas externas depende de requisitos, homologação e elegibilidade do parceiro. A SPEC define arquitetura, não garante aceitação comercial.

## 3. Modelo

```text
AgendaZap availability
 -> Distribution Adapter
 -> Channel catalog
 -> Channel availability
 -> External booking
 -> validated booking command
 -> AgendaZap appointment
```

## 4. Entidades

- distribution_channels;
- merchant_mappings;
- service_mappings;
- booking_mappings;
- sync_jobs.

## 5. Regras

- AgendaZap mantém disponibilidade canônica;
- provider IDs são mappings;
- booking externo passa pelas mesmas regras de conflito;
- cancelamento/reagendamento sincronizam quando contrato permitir;
- idempotência por external_booking_id.

## 6. Canais

P0 de arquitetura:

- public booking URL;
- links UTM;
- QR Code;
- adapter genérico.

P2:

- Reserve with Google ou equivalente;
- outros marketplaces que comprovem CAC/receita incremental.

## 7. Métricas

- bookings_by_channel;
- conversion_by_channel;
- revenue_by_channel;
- cancellation_by_channel;
- sync_failure_rate.

## 8. Gate

Não implementar canal novo sem hipótese mensurável de:

- aquisição;
- ocupação;
- receita;
- redução de CAC.

## 9. Definition of Done

- adapter genérico sem dependência do domínio;
- mapping de merchant/service;
- booking externo idempotente;
- disponibilidade não é duplicada;
- dashboard atribui booking e receita ao canal.
