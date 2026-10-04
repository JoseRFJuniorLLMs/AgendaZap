# Deploy e operação — PostgreSQL

URL: https://35.247.217.66.nip.io/AgendaZap/; VM memoria-vm-2; SSH web2a/google_compute_engine. App /home/web2a/AgendaZap; serviço agendazap; porta 8793 loopback; Nginx existente.

PostgreSQL é a única persistência de negócio. DATABASE_URL privada em /etc/agendazap.env 0600; DATABASE_SCHEMA=agendazap; role/database exclusivos. Não publicar senha nem abrir porta do banco. O deploy/install.sh pressupõe banco provisionado; substituir CHANGE_ME antes de iniciar. compose.yaml oferece PostgreSQL 17 com volume próprio para desenvolvimento.

Store mantém projeção JSONB e revisões em commit PostgreSQL; advisory lock de sessão recusa segundo writer inclusive em outro host. Ainda não habilitar réplicas: domínio usa estado em memória. Falha de COMMIT ambígua exige restart/reload.

Verificar: npm test; scripts/persistence-check.js; scripts/operational-check.js; scripts/smoke.js URL. QA cria registros fictícios; create seguido de restart do app e verify testa durabilidade. Nunca registrar credenciais em logs.

Backup AES-GCM da projeção: startup/24h; 30 arquivos; chave separada /etc/agendazap-backup.key. Restaurar somente em DATABASE_SCHEMA isolado e vazio usando restore-backup.js --isolated-empty-target FILE. Sessões revogadas. Snapshot não substitui backup PostgreSQL/PITR; cópia fora da VM e RPO/RTO ainda pendentes.

Migração já executada em 04/10/2026: snapshot anterior; restauração isolada; comparação integral; cutover. deploy/provision-postgresql.py e migrate-postgresql.sh são ferramentas de cutover único e recusam sobrescrever role/banco existentes. Não são rotina de redeploy. Artefatos anteriores em /home/web2a/backups/agendazap-before-postgresql-*.tgz e .env (privado). Para rollback técnico: parar app; preservar novo snapshot; restaurar código e configuração anteriores; instalar dependências e iniciar. Isso reverte também o backend e precisa de decisão consciente; não descartar novos dados nem apagar bancos.

Somente o serviço AgendaZap foi reiniciado. Outras aplicações/bancos preservados. Integrações WhatsApp/PIX/assinatura permanecem sem credenciais conforme instrução do usuário.
