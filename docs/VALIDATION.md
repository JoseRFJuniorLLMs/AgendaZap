# Validação da base publicada

Atualização 04/10/2026: main 188f6eb integrado; requisitos v0.2 em docs/specs são fonte de escopo. Esta validação não declara entrega integral da v0.2.

19 testes local/VM: domínio; HTTP; RBAC/CSRF; concorrência; idempotência; pagamentos tardios; providers simulados; backup AES-GCM. npm run check passou; npm audit sem vulnerabilidades.

Migração PostgreSQL concluída na VM: snapshot criptografado; comparação integral de estado; sessões revogadas. Probe real de commit/rollback/reload/lock; restauração em schema isolado; HTTP real com duas reservas concorrentes; restart e verificação de conta/reserva; cancelamento de QA. HTTPS página/health/assets/manifest passaram. Health informa PostgreSQL.

Nenhuma mensagem WhatsApp nem pagamento real foi enviado. Credenciais de QA privadas na VM; negócios são fictícios. Homologação de provedores; dados reais; backup offsite/PITR e RPO/RTO permanecem pendentes.

Relatório de lacunas: reviews/SPEC-V0.2-GAP-ANALYSIS.md. Grafo gerado antes da migração é histórico; seus nós de HeraclitusDB não descrevem a persistência atual.
