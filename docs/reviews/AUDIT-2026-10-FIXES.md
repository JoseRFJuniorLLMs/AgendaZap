# Continuação da auditoria wf_9b967ef9-f79

Base: `0eeb86da0094382202a0f233d487a0f915a4f0b2`. Correções preparadas num worktree separado. Os modelos Gemini existentes foram preservados.

| Achados confirmados | Correção |
|---|---|
| F1 F2 F47 F50 | Caminho de voz exato; rejeição de normalização; tenant autorizado e segredo enviados pelo nginx; IP sobrescrito no proxy; limite separado da API; autenticação antes do limite de voz; CSRF em escritas de voz. |
| F3 | Simulador mantém uma cópia temporária isolada; não altera agenda nem fila de produção. |
| F4 F21 F64 | Checkout e cancelamento serializados por tenant; pausa impede nova assinatura; cancelamento por webhook limpa a chave de checkout. |
| F5 F6 F7 | Operador recebe link de gerenciamento/PIX e pode informar e-mail do pagador; login inclui professional_id; reservas não sobrescrevem identidade ou consentimento no CRM. |
| F8 F22 | Estornos/chargebacks são reconciliados; pagamentos terminados não voltam a pagos por notificações antigas. |
| F9 F62 | Sessões expiradas/revogadas são removidas; até dez sessões por conta; limites de cadastro e reserva; teto de histórico sem apagar dados. |
| F10 F11 F26 | Bloqueios comparam instantes normalizados; webhook valida por mensagem; texto longo é limitado; alterações não relacionadas e reações são ignoradas; botões são interpretados. |
| F12 F24 F27 | Shutdown aguarda envio em curso; template de avaliação leva o link correto; respostas têm prioridade e tenants alternam na fila. |
| F13 F14 F15 F16 F19 F25 F28 | Contexto de reagendamento é limpo; lembretes têm versão; erros de domínio recebem resposta; política de antecedência é aplicada; lista de espera muda de estado; falhas são consecutivas; catálogo informativo não simula menu numérico. |
| F17 F18 F63 | Formatter/collator reutilizados; horários por minuto reutilizados entre profissionais; conflitos indexados por dia/profissional; regras sobrepostas deduplicadas; horários inexistentes no DST são omitidos; catálogo limitado. |
| F29 (F30 duplicado) | Unicode inválido recusado; erro SQL recuperável faz rollback sem inutilizar a projeção; COMMIT ambíguo recarrega; perda de conexão encerra o processo para recuperação pelo systemd. |
| F32 F56 F57 | Migração restaura código/dependências/env até o health; auto-deploy valida em stage e guarda revisão saudável; rollback restaura configurações, código, dependências e voz; revisão falhada fica bloqueada. |
| F34 F35 F36 F37 F38 F39 F40 F42 F44 F45 F61 | Navegação limpa menu/debounce; CSP permite áudio blob e erro de reprodução é visível; CRM descarta resposta antiga; 401 limpa sessão; retorno à reserva reinicia etapas incompletas; patterns válidos; cache clona antes de consumo; reagendamento mantém profissional; botões respeitam perfis; erros HTML são resumidos; senha acessível a todos os perfis. |
| F46 F48 F51 F52 F53 F55 | Listener de erro WebSocket; gravação atômica serializada; duração derivada do arquivo; falhas de voz contabilizadas; códigos HTTP do provedor preservados sem expor payload; limites numéricos validados. |
| F58 F59 | CI fornece senha de validação ao compose; exemplo usa schema agendazap. |

## Verificações

- Suíte Node ampliada com regressões HTTP, domínio, fila, persistência, interface com DOM simulado, cache e sockets reais. Provedores externos são simulados.
- `npm run check` verifica os JavaScripts de aplicação, interface e voz.
- `python3 deploy/test-auto-deploy.py` (Linux): falhas em testes, build, nginx, troca de voz e health; sucesso; segunda tentativa da mesma revisão bloqueada. Serviços simulados; cópias, arquivos e rsync reais em diretórios temporários.
- `nginx -t` com configuração temporária na VM antes de instalar o snippet.
- `scripts/persistence-check.js` usa schema PostgreSQL aleatório isolado; confirma recuperação após erro SQL e remove apenas esse schema.
- Contêiner candidato mede um WAV real de um segundo antes da troca em produção.

## Limites e pendências

F20/F23 permanecem sem verificação de contrato/homologação Mercado Pago. F33/F41 exigem validação de layout num navegador real. F49/F54 exigem carga/benchmark; o WebSocket agora tem teto explícito de 1 MiB, mas isso não substitui avaliação de capacidade. F31/F43 foram rejeitados na auditoria; não são apresentados como correções.

Os limites de histórico e cadastro são guardrails; a projeção PostgreSQL continua numa linha única e não constitui solução completa de escala. Arquivamento exige processo explícito. O teste de shutdown evita duplicação por parada graciosa; interrupções abruptas ainda exigem idempotência do provedor.

## Auto-deploy

Instalar `deploy/agendazap-auto-deploy.sh` em `/usr/local/sbin/deploy-agendazap` antes do primeiro push com este snippet. O timer usa esse caminho fixo e não atualiza sozinho o script. `deploy/configure-voice-proxy.py` gera o segredo local sem modificar IDs de modelos. O SHA fica em `/var/lib/agendazap-deploy/deployed-sha`; o SHA recusado em `failed-sha`. Para tentar novamente uma revisão recusada depois de reparar uma condição externa, o operador remove explicitamente `failed-sha`. Backups ficam em `/home/web2a/backups/agendazap-ci` e incluem credenciais protegidas com acesso root.

Para rodar toda a suíte: `npm ci`, `npm ci --prefix voice-service`, `npm test`, `npm run check`. CI também executa a suíte visual existente.
