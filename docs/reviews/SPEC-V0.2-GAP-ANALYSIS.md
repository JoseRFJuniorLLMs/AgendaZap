# Revisão das specs v0.2 — AgendaZap Revenue Autopilot

Referência: main `188f6eb062012a56ef1760a2ff039aad73215549`; 13 commits integrados por fast-forward. README e SPEC-0001–0012 remotos foram preservados. Código anterior preservado em checkpoint e stash. Data: 04/10/2026.

## Resultado

As specs mudaram o critério de entrega: agenda e mensagens não bastam; é necessário detectar oportunidades; convertê-las sem conflito; medir receita recuperada com evidência; controlar custo por tenant. A aplicação publicada é a base anterior e NÃO atende integralmente a v0.2.

O usuário determinou explicitamente somente PostgreSQL. Essa instrução específica prevalece sobre a regra geral do workspace para projetos novos. A aplicação foi migrada e publicada com PostgreSQL exclusivo; drivers/proto HeraclitusDB foram removidos. Nenhum banco de outro projeto foi migrado.

## Matriz de cobertura

| Requisito | Cobertura atual | Trabalho necessário |
|---|---|---|
| Agenda e isolamento por tenant | Parcial | Múltiplas unidades; recursos físicos; restrições relacionais |
| Booking holds | Parcial | Hoje appointment awaiting_payment expira em 15 min; criar hold independente mesmo sem PIX; proteger profissional e recursos |
| Persistência PostgreSQL | Implementada como transição | Projeção JSONB transacional e advisory lock; normalizar entidades e constraints da SPEC-0002 |
| Revenue Engine P0 | Parcial e insuficiente | Campanha manual existe; faltam opportunities; eligibility; ranking; quiet hours; actions; atribuição deduplicada; RRAT |
| WhatsApp Flows P0 | Ausente | Registry; endpoint de dados; validação backend; publish/version; eventos e fallback |
| Consentimento por finalidade | Parcial | Boolean marketing não cobre transactional/reactivation/review_request/profiling; versão do texto e evidência por propósito |
| Reliability | Parcial | Jobs no mesmo commit e retries existem; faltam inbox durável antes do processamento; outbox explícito; jitter; DLQ; reconciliação e alertas |
| SaaS billing | Parcial | Checkout mensal e webhook existem; faltam planos; trial; entitlements; quotas; usage/cost; lifecycle normalizado; margem |
| Recursos; pacotes; créditos | Ausente | Recursos exclusivos primeiro; ledger de créditos; saldo derivado; validade; memberships; comissões por serviço concluído/pago |
| Growth analytics | Parcial | Dashboard operacional existe; faltam eventos do funil; cohorts; referral codes/conversions; churn e recorrência |
| Operação segura | Parcial | HTTPS; autenticação; RBAC; snapshots AES-GCM e restauração passaram; faltam backup fora da VM; RPO/RTO; retenção; recuperação de senha e homologação de provedores |

## Problemas que precisam de contrato explícito

1. **Receita recuperada atual não comprova o novo requisito.** `src/domain.js` soma o preço do serviço concluído com campaign_id. A origem do campaign_id pode vir do pedido público; não há oportunidade/ação/janela validada. Recebido atualmente soma depósitos PIX; não representa pagamento integral. Implementar atribuição server-side; separar valor atribuído; concluído; liquidado; estornado. Uma reserva só pode contribuir uma vez para o mesmo total. Evitar somar valor cheio em campanhas diferentes.
2. **Receita protegida por lembrete é contrafactual.** Sem controle ou baseline definido; mostrar estimativa identificada; não dinheiro observado. Definir RRAT com período; tenants elegíveis/ativos; receita liquidada ou realizada; cancelamentos e estornos.
3. **JSONB é transição; não cumpre o modelo relacional completo.** Hoje a serialização de um escritor e uma transação PostgreSQL impedem conflito de profissional. Recursos e holds precisam de allocation ranges; constraints/exclusion por sujeito; expiry e conversão atômicas. Não habilitar múltiplos writers enquanto domínio lê a projeção em memória.
4. **Processamento de webhook pode acontecer antes da persistência.** Persistir ID/hash/payload mínimo e receipt antes de classificar ou executar negócio. Replays; fora de ordem e timeout de provedor precisam de reconciliação; confirmação externa não pode ser inventada após timeout.
5. **Consentimento antigo não autoriza todas as finalidades novas.** Preservar evidência legada como marketing; solicitar opt-in específico quando necessário; não promover boolean automaticamente para todos os propósitos.
6. **Escopo comercial é amplo.** O primeiro pagante cedo exige um recorte verificável: uma unidade; recursos exclusivos; cancelamento + lista de espera + reativação; uma oferta sem desconto inventado; um plano com limite. Packages/memberships/growth avançado seguem as fases posteriores. Isso não remove os demais requisitos P0; ordena sua implementação.
7. **Stack ainda diverge.** Specs propõem Rust/Axum e Next.js/TypeScript; base publicada é Node/Express e ES modules. PostgreSQL agora coincide com a decisão do usuário. Registrar ADR antes de declarar conformidade arquitetural; troca de linguagem não substitui requisitos de negócio.

## Ordem de implementação e critérios de aceite

1. Modelo relacional + migrations + dados legados: tenants/locations/resources/service requirements/customer consents/holds/appointments/allocations; duas reservas de profissionais diferentes pelo mesmo recurso devem produzir um vencedor; hold expirado libera slot; pagamento atrasado nunca toma outra reserva.
2. Inbox/outbox/idempotency/DLQ/reconciliation: crash antes/depois do commit; webhook duplicado e fora de ordem; PSP timeout; indisponibilidade do worker. Estado final convergente; job permanente visível; replay auditado.
3. Revenue Engine vertical: cancelled_slot e inactive_customer; elegibilidade e frequência; oferta; booking; completion/payment; attribution; dashboard. Sem duplo crédito; opt-out e quiet hours obrigatórios; link não fabrica atribuição.
4. Flows e onboarding Meta: usar mesmo motor de holds e reservas; versão do registry; fallback público/humano; instrumentar submissão/erro/conversão. Credenciais próprias e homologação necessárias.
5. Billing antes do pagante: um plano/trial; lifecycle; limites; medição por tenant; custo estimado/real identificado; alerta e enforcement previsíveis; acesso financeiro segregado.
6. Primeiro cliente: termos/privacidade; retenção e suporte; RPO/RTO; backup fora da VM e restauração; homologação WhatsApp/PIX; demonstração de receita atribuída com números verificáveis.
7. Fases posteriores: ledger pacotes/créditos; memberships; comissões; reviews/referrals/cohorts e Google Calendar.

## Evidência da migração PostgreSQL

- 19 testes passaram localmente e na VM; npm audit sem vulnerabilidades na instalação.
- Banco e role exclusivos `agendazap`; configuração privada `/etc/agendazap.env`; acesso loopback.
- Snapshot AES-GCM produzido com serviço parado; restauração em schema vazio; comparação recursiva de TODO o estado; sessões revogadas; schema renomeado somente após validação.
- Probe PostgreSQL: commit; rejeição sem alteração parcial; reload; recusa de segundo writer.
- Restauração adicional de backup em schema isolado comprovada; schema de QA removido.
- HTTP real: cadastro; catálogo; disponibilidade; duas reservas concorrentes (uma aceita e outra conflito); restart somente AgendaZap; conta/reserva preservadas; cancelamento de QA e métricas verificados.
- HTTPS página/assets/API/manifest aprovados; health informa PostgreSQL.
- Rollback preservado em `/home/web2a/backups/agendazap-before-postgresql-*`; snapshot anterior e chave separados. Restore revoga sessões. Backup offsite e PITR ainda não configurados.

Essas evidências validam a migração e a base anterior. Não validam os recursos v0.2 ausentes nem integrações reais sem credenciais.
