# SPEC-0008 — WhatsApp Flows

**Status:** Draft  
**Versão:** 0.1.0

## 1. Objetivo

Usar jornadas estruturadas dentro do WhatsApp para reduzir atrito e dependência de interpretação probabilística.

## 2. Flows P0

### Booking Flow
- serviço;
- profissional opcional;
- unidade;
- data;
- slot;
- confirmação.

### Reschedule Flow
- appointment;
- novo slot;
- confirmação.

### Cancel Flow
- appointment;
- motivo opcional;
- confirmação.

### Waitlist Flow
- serviço;
- datas;
- janela;
- profissional opcional.

## 3. Backend contract

Flow nunca recebe autoridade para confirmar disponibilidade por conta própria.

Toda submissão crítica chama backend para:

- validar tenant;
- validar customer;
- recalcular slot;
- criar hold;
- confirmar estado atual.

## 4. Versionamento

Registrar:

- flow_name;
- provider_flow_id;
- version;
- status;
- schema_hash;
- published_at.

Mudança incompatível gera nova versão.

## 5. Onboarding da integração

Tenant precisa de:

- status do número;
- webhook health;
- templates;
- flows publicados;
- permissões;
- last_error;
- last_successful_webhook_at.

## 6. Templates

Registry interno com:

- name;
- language;
- purpose;
- category;
- provider_status;
- variables;
- version.

## 7. UX

Objetivos:

- máximo de passos estritamente necessários;
- não perguntar informação já conhecida;
- apresentar preço antes de confirmação;
- mostrar timezone local;
- tratamento claro para slot perdido.

## 8. Fallback

Se Flow falhar:

1. oferecer página pública;
2. oferecer fluxo textual determinístico;
3. permitir handoff.

## 9. Observabilidade

- flow_opened;
- flow_started;
- flow_submitted;
- flow_error;
- hold_created;
- booking_confirmed;
- abandonment_step;
- conversion_rate.
