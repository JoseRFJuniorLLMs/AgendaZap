# AgendaZap — contrato da versão 1.0

Base histórica publicada em 03/10/2026; persistência atualizada em 04/10/2026. As SPEC-0001–0012 em main 188f6eb são os requisitos vigentes; este documento descreve a implementação parcial e não substitui as specs v0.2. O código implementado e a matriz de validação não devem ser confundidos com homologação de provedores ou conformidade legal.

## Decisões

Node.js 22 + Express 5, schemas Zod, interface ES Modules/HTML/CSS responsiva e PWA. **PostgreSQL é a única persistência de negócio**, por instrução específica mais recente do usuário. Stack Node/Express ainda diverge de Rust/Axum e Next.js propostos nas specs; não declarar equivalência arquitetural completa. Nenhum banco nem modelo de áudio da EVA é alterado.

## Arquitetura

| Componente | Implementação |
|---|---|
| Identidade/API | src/server.js — contratos; sessão; CSRF; RBAC; tenant autenticado |
| Agenda/CRM | src/domain.js — vagas; transições; hold; auditoria; métricas |
| Persistência | src/store.js — transações PostgreSQL; projeção JSONB; advisory lock |
| Conversas | src/conversation.js — menu; gerenciamento; opt-out; handoff |
| Integrações | src/providers.js — Meta; src/pix.js — Pix direto; classificador opcional |
| Worker | src/worker.js — fila persistida; expiração; retry; efeitos externos |
| Frontend | public/ — landing; onboarding; painel; agenda pública; PWA |

Projeção raiz tenants/accounts/sessions/receipts. Cada tenant contém catálogo, equipe/regras semanais, clientes, appointments, bloqueios, pagamentos, conversas, jobs, waitlist, auditoria e idempotência. Valores monetários em centavos; IDs UUID; instantes UTC; agenda em timezone IANA.

Transação: cópia da projeção; validação; BEGIN; row lock; UPDATE JSONB; registro de revisão; COMMIT; troca da projeção após confirmação. Falha ambígua impede novas gravações até restart/reload. Advisory lock de sessão garante um writer por schema; MemoryStore somente em testes. Modelo relacional com constraints por profissional/recurso ainda pendente. Consulte reviews/SPEC-V0.2-GAP-ANALYSIS.md.

## Agenda e pagamentos

Candidatos a cada 15 minutos, incluindo duração + buffer. Validar dentro da transação: serviço ativo; profissional ativo e vinculado; regra semanal; bloqueio; sobreposição; antecedência; horizonte; timezone. Bloqueios que sobrepõem reservas ativas são recusados. Horário local inexistente é recusado.

Sem sinal: confirmed. Com sinal: awaiting_payment, hold 15min; não aceita serviço com sinal sem PIX configurado. Worker expira; disponibilidade já ignora hold vencido. Operador não confirma awaiting_payment; somente pagamento verificado.

| Origem | Destinos |
|---|---|
| pending | confirmed; cancelled_by_customer; cancelled_by_business |
| awaiting_payment | confirmed pelo provedor; expired; cancelled_by_customer; cancelled_by_business |
| confirmed | checked_in; completed; no_show; cancelled_by_customer; cancelled_by_business |
| checked_in | completed |
| completed; no_show; expired; cancelled_* | terminal |

Reserva captura preços; reagendamento mantém identidade e preços e substitui lembretes. Cancelamento público observa cancellation_hours; operador pode tratar exceções manualmente. Não há estorno automático, crédito nem retenção parcial nesta versão.

Pix direto: configuração por estabelecimento, múltiplas chaves e uma principal. BR Code estático inclui chave, recebedor, cidade, valor e txid por reserva; QR gerado no servidor. Confirmação manual por owner/manager com referência bancária, idempotência e auditoria. Recebimento após expiração/cancelamento exige revisão sem recuperar o horário. Devolução é feita no banco e registrada por owner.

Não exige e-mail do pagador nem token de intermediário. A validade da reserva não expira o QR estático no banco; a tela esconde o QR após o prazo e orienta contato com o estabelecimento. Chaves precisam estar registradas no banco; validação local não verifica titularidade.

## WhatsApp e IA

GET challenge valida token e hub.mode. POST valida x-hub-signature-256 do corpo original. Tenant vem do metadata.phone_number_id; proprietário só vincula ID autorizado no ambiente. Credenciais são globais da plataforma; embedded signup e credenciais independentes por tenant são evolução.

Estados start→service→date→slot→start; gerenciamento manage→manage_action→date→slot. Menu consulta catálogo/vagas e usa o mesmo motor de reserva. Replay por provider_message_id é ignorado. HUMANO/atendente ou 3 falhas causam handoff; bot não compete. SAIR/PARAR/STOP revogam marketing mesmo em handoff. Gerenciamento identifica o cliente pelo telefone recebido no webhook autenticado.

Resposta humana exige handoff e última mensagem recebida <24h; worker revalida janela. Fora da janela, usar templates aprovados. Lembrete/confirmação usam WHATSAPP_REMINDER_TEMPLATE; retorno/waitlist WHATSAPP_RECOVERY_TEMPLATE; avaliação WHATSAPP_REVIEW_TEMPLATE. Templates pt_BR com 3 parâmetros: nome; negócio; horário ou link. Falta de token/template bloqueia job explicitamente.

Simulação de fluxo no painel persiste mensagens marcadas simulated; jobs de resposta não enviam WhatsApp. Ela não equivale a homologação de uma conta Meta.

IA opcional compatível chat/completions; classifica services/book/cancel/reschedule/human/address/hours/unknown. Allowlist; mensagem limitada; sem tools de escrita ou finanças. Falha/saída inválida volta ao menu. Extração sofisticada de entidades/tools e medição de custo por token não implementadas nesta versão. Referências: [Meta webhook](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/) e [payload Meta](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference).

## Automações e receita

Tick 15s; jobs persistidos; claim running; stale claim >2min volta pending; até 5 tentativas e backoff 30s×2^tentativa, teto 1h. Worker e HTTP compartilham escritor. Mensagens têm entrega ao menos uma vez: falha após envio externo pode duplicar mensagem. PIX usa idempotência do provedor. Ausência de credenciais → blocked, não sucesso fictício.

Confirmação na reserva; lembrete 24h antes se futuro; avaliação 2h após completed se review_url e consentimento; recuperação manual seleciona inativos consentidos, sem reserva ativa e sem convite nos últimos 30 dias. Lista de espera por serviço/data/profissional opcional; cancelamento enfileira candidatos; convite não promete vaga. Primeira reserva validada ganha.

expected_revenue = serviços do dia sem cancelados/expirados; received_revenue = sinais PIX reconhecidos no dia; recovered_revenue = valor de serviços completed atribuídos por campaign_id. Valores não são contabilidade nem prova de pagamento integral. Atribuição por link é correlação.

## Segurança e privacidade

Senha≥12; scrypt com sal 16 bytes/saída 64 bytes; comparação constante. Sessão aleatória 32 bytes; hash persistido; TTL 12h; HttpOnly/SameSite Strict/Secure em produção. CSRF em mutações; origem estrangeira recusada; JSON estrito; 128KB; auth 20/min/IP; API 300/min/IP; reservas públicas 5/h/telefone. Logout revoga; mudança de senha revoga todas.

owner: tudo/equipe/estorno/export/anonymize; manager: catálogo/agenda/CRM/jobs/pagamentos/configuração operacional; attendant: CRM/agenda/conversas; professional: própria agenda/status/bloqueios e catálogo necessário. Tenant vem da conta. Public catálogo sem clientes; link manage tem segredo 24 bytes enviado em header e mantido em fragmento da URL. Tratar link como credencial. CSP/Helmet; strings escapadas; PostgreSQL/HTTP loopback atrás de TLS Nginx; segredos fora de Git; logs sem corpo/tokens/telefones.

Marketing opcional com evidência; worker revalida consentimento. Exportação/correção/revogação disponíveis. **Anonimização limpa a projeção atual no PostgreSQL; backups e o histórico legado anterior continuam sujeitos a uma política de retenção/eliminação.** Não declarar conformidade LGPD certificada. Antes de dados reais, controlador deve definir contato, retenção, bases, contratos e processo de eliminação integral/criptoapagamento ou reconstrução autorizada. Retenção automática por categoria ainda não implementada. MFA/recuperação de senha por e-mail são backlog. Sem prontuário/dados clínicos.

Backup do app não é backup do banco. Operador deve configurar backup PostgreSQL/PITR e cópia fora da VM antes de SLA comercial. Restauração de snapshot do app em schema isolado foi comprovada; não equivale a testar recuperação completa do servidor PostgreSQL.

## Matriz de entrega

| Componente da base anterior (não é a matriz v0.2) | Situação |
|---|---|
| Fundação; core; público | Implementados; testes e deploy descritos em VALIDATION.md |
| WhatsApp | Código/testes locais; ativação Meta e templates pendentes |
| PIX | Adapter/hold/webhook/estorno; homologação real pendente |
| Automação | Fila e regras implementadas; envio depende de integração |
| IA | Classificador básico/fallback; entidades/tools avançadas adiadas |
| Comercialização | Landing/onboarding/export/PWA/termos; planos mensais disponíveis; cobrança e ativação acertadas com administrador |

Backlog: enforcement automático de plano; Meta multiempresa; segredos por tenant; LLM avançado/custos; MFA; reset de senha; snapshots/eventos por entidade; multi-host; eliminação integral; políticas financeiras parciais; Google Calendar; múltiplas unidades; fidelidade; cupons; marketplace. Esses itens não devem ser marcados como concluídos apenas porque há publicação.

## Backup da aplicação e assinatura

AES-256-GCM da projeção completa; backup no startup e a cada 24h; arquivo 0600; escrita atômica; retenção 30 cópias; chave hex de 32 bytes em /etc/agendazap-backup.key fora dos backups. Recuperação exige preservar essa chave em cofre e copiar backups para destino independente. O backup da projeção do AgendaZap é adicional ao backup PostgreSQL. Restore exige schema explicitamente isolado e vazio; nunca sobrescreve negócio ativo; sessões restauradas são revogadas. Integridade e restauração isolada devem ser comprovadas em VALIDATION.md.

Plano/assinatura: preços permanecem no GET billing, com provider manual. Checkout automático e webhooks do intermediário foram removidos. A mensalidade é combinada com o administrador e fica separada dos sinais recebidos diretamente pelos estabelecimentos.
