# SPEC-0019 — Reviews, Reputação e Indicação

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Transformar atendimento concluído em reputação e aquisição mensurável sem manipulação enganosa de avaliações.

## 2. Fluxo de review

```text
appointment.completed
 -> wait configurable delay
 -> request satisfaction/review
 -> click external review
 -> attribution
```

## 3. Configuração

Por tenant:

- review_url;
- enabled;
- delay_minutes;
- channels;
- frequency cap;
- quiet hours.

## 4. Regras

- não solicitar review repetidamente;
- respeitar opt-out;
- não bloquear cliente insatisfeito de acessar página externa;
- feedback interno pode abrir handoff;
- guardar somente dados necessários.

## 5. Referral

Criar códigos/links:

- referral_code;
- source_customer_id;
- referred_customer_id;
- clicked_at;
- booked_at;
- completed_at;
- reward_rule opcional.

## 6. Métricas

- review_requests;
- review_clicks;
- review_conversion_proxy;
- referral_created;
- referral_booking;
- referral_completed;
- attributed_revenue.

## 7. Automação

Eventos elegíveis:

- completed;
- milestone de visitas;
- aniversário de cliente se base legal/configuração permitir;
- referral converted.

## 8. Definition of Done

- tenant configura URL;
- completed dispara job idempotente;
- frequency cap funciona;
- clique é atribuído;
- indicação pode ser vinculada a booking;
- dashboard separa aquisição orgânica, review e referral.
