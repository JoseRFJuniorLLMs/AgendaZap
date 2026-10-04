# SPEC-0005 — Segurança e LGPD

**Status:** Draft  
**Versão:** 0.1.0

## 1. Princípios

- minimização de dados;
- privacy by design;
- least privilege;
- isolamento entre tenants;
- criptografia em trânsito;
- segredo fora do código;
- logs sem dados excessivos;
- trilha de auditoria em ações críticas.

## 2. Dados do MVP

Dados necessários:

- nome;
- telefone;
- serviço;
- profissional;
- data/hora;
- eventos de atendimento;
- status de pagamento;
- consentimentos.

Evitar no MVP:

- prontuário;
- diagnóstico;
- laudos;
- informações clínicas;
- documentos pessoais sem necessidade.

## 3. Multi-tenancy

Toda consulta autenticada deve ser escopada por `tenant_id`.

Requisitos:

- tenant derivado da identidade autenticada;
- cliente nunca escolhe arbitrariamente tenant em endpoint privilegiado;
- testes automáticos de isolamento.

## 4. Autenticação

Painel administrativo:

- sessão segura;
- senha com hash forte ou provedor de identidade;
- MFA recomendado para administradores;
- rate limit;
- proteção a credential stuffing.

## 5. RBAC

Papéis iniciais:

### owner
Acesso total ao tenant.

### manager
Agenda, clientes, relatórios e configuração operacional.

### professional
Agenda própria e informações necessárias ao atendimento.

### attendant
Conversas e agendamentos, sem configuração sensível.

## 6. Segredos

Nunca versionar:

- tokens do WhatsApp;
- API keys de LLM;
- credenciais de banco;
- segredos de webhook;
- tokens de pagamento.

Usar variáveis de ambiente ou secret manager.

## 7. Webhooks

- assinatura/autenticidade;
- timestamp quando oferecido;
- replay protection;
- idempotency key;
- rate limiting;
- validação estrita de payload.

## 8. Consentimento e opt-out

Guardar evidência de:

- canal;
- finalidade;
- data;
- status.

Opt-out deve impedir mensagens promocionais futuras, preservando comunicações transacionais permitidas e necessárias conforme configuração e base aplicável.

## 9. Retenção

A política de retenção deve ser configurável e documentada.

Separar:

- registros operacionais;
- eventos financeiros;
- logs técnicos;
- mensagens;
- auditoria.

## 10. Direitos do titular

Preparar fluxos administrativos para:

- confirmação de tratamento;
- acesso;
- correção;
- anonimização/exclusão quando aplicável;
- revogação de consentimento;
- portabilidade quando aplicável.

## 11. Logs

Não registrar:

- tokens;
- credenciais;
- QR PIX completo quando desnecessário;
- conteúdo integral de mensagens em logs técnicos;
- prompts contendo dados desnecessários.

## 12. Backup

- backup automático;
- teste periódico de restauração;
- retenção definida;
- criptografia;
- acesso mínimo.

## 13. Auditoria

Eventos críticos:

- login;
- alteração de usuário/role;
- criação/cancelamento de appointment;
- alteração de preço;
- pagamento;
- reembolso;
- exportação de dados;
- alteração de integrações.

## 14. Segurança de IA

- tools allowlist;
- validação de argumentos;
- prompt injection não concede novas permissões;
- saída do modelo tratada como não confiável;
- nenhuma operação financeira executada apenas porque o modelo pediu.
