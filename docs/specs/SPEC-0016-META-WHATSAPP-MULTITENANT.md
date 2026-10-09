# SPEC-0016 — WhatsApp Oficial Multi-Tenant

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Permitir que cada tenant conecte e opere seu próprio número WhatsApp Business sem intervenção técnica manual da equipe AgendaZap.

## 2. Princípios

- credencial nunca é global quando o tenant requer isolamento;
- tenant é resolvido por identidade autenticada do provedor, nunca por texto recebido;
- segredo fica criptografado e fora de logs;
- onboarding precisa ser guiado;
- falha no WhatsApp não bloqueia agenda pública.

## 3. Fluxo de onboarding

```text
Owner
 -> Conectar WhatsApp
 -> autorização/embedded signup quando disponível
 -> selecionar/vincular número
 -> registrar webhook
 -> validar assinatura
 -> validar envio
 -> validar template
 -> health check
 -> Ativo
```

## 4. Estados

- disconnected;
- connecting;
- pending_verification;
- active;
- degraded;
- blocked;
- revoked.

## 5. Dados

`whatsapp_connections`:

- id;
- tenant_id;
- provider;
- business_account_id;
- phone_number_id;
- display_phone;
- encrypted_access_token_ref;
- verify_token_ref;
- status;
- health_checked_at;
- connected_at;
- revoked_at.

`whatsapp_templates`:

- tenant_id;
- name;
- language;
- category;
- provider_status;
- purpose;
- variables_schema;
- updated_at.

## 6. APIs internas

- POST /integrations/whatsapp/connect;
- GET /integrations/whatsapp/status;
- POST /integrations/whatsapp/test;
- POST /integrations/whatsapp/disconnect;
- GET/POST /webhooks/whatsapp.

## 7. Requisitos

- assinatura de webhook validada antes de parsear efeitos;
- idempotência por provider_message_id;
- rotação de credenciais;
- tenant isolation;
- templates versionados;
- janela de atendimento respeitada;
- handoff humano preservado;
- rate limits por tenant;
- metering por tenant.

## 8. Observabilidade

Medir:

- inbound/outbound;
- delivery/read quando disponível;
- erro por código;
- webhook latency;
- template rejection;
- blocked sends;
- tenant health.

## 9. UX

Configurações deve mostrar:

- número conectado;
- estado;
- último health check;
- templates;
- botão testar;
- instrução objetiva para correção.

Nenhuma tela deve exigir que o cliente copie `phone_number_id`, token ou variável de ambiente.

## 10. Segurança

- criptografia de segredo em repouso;
- segregação por tenant;
- nenhum token no frontend;
- auditoria connect/disconnect;
- revoke imediato;
- scopes mínimos.

## 11. Definition of Done

- dois tenants conectam números independentes;
- mensagem recebida no tenant A nunca aparece no B;
- envio usa credencial do tenant correto;
- onboarding é concluído sem editar servidor;
- revoke interrompe envio;
- testes cobrem replay, assinatura, isolamento e credencial ausente.
