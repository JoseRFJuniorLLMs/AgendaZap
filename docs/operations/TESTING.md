# Testes e verificação

npm run check; npm test: 19 testes de domínio/HTTP/providers/backup; MemoryStore não prova banco real.

Com DATABASE_URL: node scripts/persistence-check.js valida commit; rollback; reload e writer lock em schema descartável. Com BACKUP_KEY_FILE: node scripts/operational-check.js comprova restauração AES-GCM em schema isolado e sessões revogadas.

node scripts/smoke.js https://35.247.217.66.nip.io/AgendaZap valida HTTPS/API/assets. node scripts/live-qa.js create; restart SOMENTE app; node scripts/live-qa.js verify comprova durabilidade e cancela reserva fictícia. Não usar credenciais de clientes.

Matriz v0.2 em docs/reviews/SPEC-V0.2-GAP-ANALYSIS.md; testes existentes não demonstram funcionalidades ausentes.
