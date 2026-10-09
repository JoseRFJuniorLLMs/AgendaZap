# SPEC-0021 — Marketing Attribution e Click-to-WhatsApp

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Ligar campanha de marketing a conversa, booking e receita, evitando transformar o AgendaZap em mais um editor de anúncios.

## 2. Canais

- Instagram;
- Facebook;
- Google;
- QR Code;
- link direto;
- referral;
- orgânico;
- campanha própria;
- parceiros.

## 3. Attribution chain

```text
campaign
 -> tracked link / click identifier
 -> conversation
 -> customer
 -> hold
 -> booking
 -> completed/paid
 -> attributed revenue
```

## 4. Dados

- campaign_id;
- source;
- medium;
- content;
- term;
- click_id quando permitido;
- first_touch;
- last_touch;
- conversation_id;
- appointment_id;
- attributed_amount.

## 5. Click-to-WhatsApp

Gerar links de campanha com contexto mínimo seguro.

A mensagem inicial pode conter código de campanha não secreto.

Nunca usar texto do usuário para escolher tenant.

## 6. Modelos de atribuição

MVP:

- first touch;
- last touch;
- recovery override para Revenue Engine quando elegível.

Evitar dupla atribuição integral.

## 7. Dashboard

Mostrar:

- leads;
- conversations;
- bookings;
- completed;
- revenue;
- recovered revenue;
- conversion rate;
- cost quando informado;
- ROAS quando houver custo confiável.

## 8. Privacidade

- minimizar identificadores;
- documentar finalidade;
- respeitar consentimento;
- retenção configurável;
- não armazenar payload publicitário desnecessário.

## 9. Definition of Done

- link rastreável gera lead;
- conversa mantém campaign_id;
- booking herda atribuição;
- receita completada aparece por campanha;
- recovery não duplica receita de aquisição;
- export CSV disponível.
