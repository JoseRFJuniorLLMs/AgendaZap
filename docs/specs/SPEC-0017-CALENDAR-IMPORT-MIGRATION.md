# SPEC-0017 — Google Calendar, Importação e Migração

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Reduzir fricção de adoção importando base existente e sincronizando compromissos externos sem double booking.

## 2. Google Calendar

Suportar conexão por profissional e, posteriormente, por unidade.

Modos:

- AgendaZap -> Google;
- Google -> AgendaZap como bloqueio;
- bidirecional controlado.

AgendaZap continua source of truth para bookings criados no produto.

## 3. Regras de sincronização

Evento externo ocupado gera bloqueio, não appointment comercial.

Persistir:

- provider_calendar_id;
- provider_event_id;
- etag/version;
- starts_at;
- ends_at;
- sync_origin;
- last_synced_at;
- deleted_at.

## 4. Conflitos

- nunca mover silenciosamente appointment confirmado;
- conflito externo posterior gera alerta;
- exclusão de evento espelhado remove apenas bloqueio correspondente;
- timezone é obrigatório;
- replay é idempotente.

## 5. Webhook/sync

- usar notificação de mudança quando suportada;
- reconciliar periodicamente como fallback;
- cursor/token de sync persistido;
- expiração da assinatura renovada automaticamente.

## 6. Importação de clientes

Formatos P0:

- CSV;
- XLSX convertido/normalizado no backend ou fluxo assistido;
- template oficial para download.

Campos:

- name;
- phone;
- email opcional;
- tags;
- last_visit_at;
- notes não sensíveis;
- consent apenas quando houver evidência importável.

Nunca inferir consentimento promocional.

## 7. Importação de agenda

Permitir import assistido de:

- profissionais;
- serviços;
- clientes;
- futuros compromissos.

Executar preview antes de commit.

## 8. Deduplicação

Chaves de matching:

1. telefone normalizado;
2. e-mail quando disponível;
3. nome apenas como sugestão, nunca merge automático isolado.

## 9. UX

Wizard:

1. fonte;
2. upload/conexão;
3. mapear campos;
4. validar;
5. preview de erros;
6. importar;
7. relatório final.

## 10. Métricas

- onboarding_import_success;
- records_imported;
- duplicate_rate;
- sync_conflicts;
- calendar_sync_lag;
- time_to_first_booking.

## 11. Definition of Done

- importar 1.000 clientes com relatório determinístico;
- reprocessar arquivo não duplica;
- calendário externo bloqueia slot;
- booking AgendaZap aparece no calendário conectado;
- falha de provider não corrompe agenda;
- desconectar integração preserva appointments do AgendaZap.
