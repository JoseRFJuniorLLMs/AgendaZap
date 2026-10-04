# SPEC-0005 — Segurança e LGPD

**Status:** Draft  
**Versão:** 0.2.0

## 1. Princípios

- data minimization;
- privacy by design;
- least privilege;
- tenant isolation;
- defense in depth;
- encryption in transit;
- secret management;
- auditabilidade;
- saída de IA sempre não confiável.

## 2. Dados MVP

Necessários:

- nome;
- telefone;
- agendamentos;
- serviços;
- eventos de comunicação;
- pagamentos;
- consentimentos.

Evitar:

- prontuário;
- diagnóstico;
- documentos sem finalidade;
- dados sensíveis não necessários.

## 3. Consentimentos

Não usar um único `consent_status`.

Modelo por finalidade:

- transactional;
- marketing;
- review_request;
- reactivation;
- profiling, se futuramente aplicável.

Registrar:

- finalidade;
- base aplicável;
- origem;
- timestamp;
- versão do texto;
- concessão/revogação;
- evidência.

## 4. Multi-tenancy

- tenant derivado da sessão/token;
- tenant nunca confiado do payload privilegiado;
- queries obrigatoriamente escopadas;
- testes negativos entre tenants;
- objetos externos mapeados para tenant internamente.

## 5. RBAC

- owner
- manager
- professional
- attendant
- billing_admin

Acesso financeiro e integrações requer privilégios próprios.

## 6. Segredos

Nunca versionar:

- tokens;
- API keys;
- DB passwords;
- webhook secrets;
- payment credentials;
- private keys.

## 7. Webhooks

- assinatura;
- timestamp quando disponível;
- replay protection;
- idempotência;
- payload validation;
- armazenamento do hash/event ID;
- rate limiting;
- processamento assíncrono.

## 8. IA

- tools allowlist;
- schema validation;
- RBAC antes da tool;
- tenant binding fora do prompt;
- prompt injection não altera privilégios;
- nenhuma operação financeira irreversível baseada somente na saída do modelo;
- PII minimizada no contexto.

## 9. Retenção

Políticas separadas para:

- mensagens;
- eventos operacionais;
- financeiro;
- auditoria;
- logs;
- analytics.

## 10. Direitos do titular

Preparar fluxos para:

- acesso;
- correção;
- revogação;
- exportação;
- anonimização/exclusão quando aplicável.

## 11. Backup e recuperação

- backup automatizado;
- criptografia;
- retenção;
- restore test;
- RPO/RTO definidos antes do primeiro tenant pagante.

## 12. Auditoria

Eventos críticos:

- login;
- role change;
- integration change;
- price change;
- booking mutation;
- payment/refund;
- consent change;
- export;
- billing change.

## 13. Segurança operacional

Antes de produção:

- headers;
- CSRF quando aplicável;
- rate limit;
- brute-force protection;
- dependency scanning;
- secret scanning;
- SAST;
- migrations revisáveis;
- logs sem segredos.
