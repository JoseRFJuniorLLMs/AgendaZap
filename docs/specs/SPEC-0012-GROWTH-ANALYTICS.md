# SPEC-0012 — Growth Analytics

**Status:** Draft  
**Versão:** 0.1.0

## 1. Objetivo

Medir não apenas uso do software, mas crescimento e retorno econômico produzido para o tenant.

## 2. Funil principal

```text
Conversation
   -> Intent
   -> Slot viewed
   -> Hold
   -> Booking
   -> Confirmed
   -> Completed
   -> Repeat
```

## 3. Eventos

- lead_created;
- conversation_started;
- service_viewed;
- slot_viewed;
- hold_created;
- booking_created;
- payment_started;
- payment_paid;
- appointment_completed;
- review_requested;
- review_clicked;
- referral_created;
- referral_converted;
- recovery_contacted;
- recovery_converted.

## 4. Cohorts

Agrupar por:

- mês de aquisição;
- serviço;
- profissional;
- canal;
- campanha;
- tenant/location.

## 5. Retenção do cliente final

Medir:

- repeat rate;
- days between visits;
- cohort retention;
- customer lifetime revenue.

## 6. Retenção do tenant

Medir:

- active days;
- bookings processed;
- recovered revenue;
- feature adoption;
- admin sessions;
- cancellation intent.

## 7. Reviews

Após atendimento:

1. coletar satisfação simples;
2. permitir encaminhamento para review externo quando configurado;
3. se houver problema, oferecer contato com o negócio;
4. nunca bloquear ou manipular avaliação de forma enganosa.

## 8. Referral loop

Criar:

- referral_code;
- referral_source_customer;
- referred_customer;
- converted_at;
- reward_rule opcional.

## 9. Attribution

Separar:

- organic;
- WhatsApp;
- public booking;
- campaign;
- recovery;
- referral;
- manual.

## 10. Dashboard

### Owner
- receita;
- ocupação;
- recovered revenue;
- clientes novos;
- clientes recorrentes;
- cancelamentos;
- no-show;
- referrals.

### AgendaZap
- MRR;
- active tenants;
- usage;
- cost per tenant;
- gross margin;
- recovered revenue per tenant.

## 11. Métrica North Star

**Recovered Revenue per Active Tenant**, acompanhada de occupancy e repeat rate.
