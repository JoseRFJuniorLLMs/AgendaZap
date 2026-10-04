# SPEC-0006 — Roadmap

**Status:** Draft  
**Versão:** 0.1.0

## Objetivo

Chegar a um MVP demonstrável e vendável com o menor número de dependências possível.

## Fase 0 — Fundação

Entregas:

- estrutura do repositório;
- configuração de ambiente;
- Docker;
- banco;
- migrations;
- CI;
- lint;
- testes;
- documentação de setup.

**Definition of Done:** projeto sobe localmente com um comando documentado.

## Fase 1 — Core comercial

Entregas:

- tenant;
- autenticação;
- profissionais;
- serviços;
- disponibilidade;
- bloqueios;
- appointments;
- dashboard diário.

**Definition of Done:** operador consegue cadastrar negócio e criar agendamento sem WhatsApp.

## Fase 2 — Página pública

Entregas:

- slug público;
- catálogo;
- horários;
- fluxo mobile;
- criação de agendamento.

**Definition of Done:** cliente externo agenda sozinho.

## Fase 3 — WhatsApp

Entregas:

- webhook;
- identificação de cliente;
- menu/fluxo determinístico;
- consulta de serviço;
- consulta de disponibilidade;
- agendamento;
- reagendamento;
- cancelamento.

**Definition of Done:** jornada completa pelo WhatsApp sem IA.

## Fase 4 — PIX

Entregas:

- payment adapter;
- cobrança;
- QR/copia e cola;
- webhook;
- hold com TTL;
- confirmação automática.

**Definition of Done:** sinal pago confirma reserva de forma idempotente.

## Fase 5 — Automações

Entregas:

- lembretes;
- confirmação;
- no-show;
- pós-atendimento;
- recuperação de cliente;
- lista de espera;
- preenchimento de cancelamento.

**Definition of Done:** sistema executa automações e mede receita atribuída.

## Fase 6 — IA

Entregas:

- intent classification;
- entity extraction;
- tool calling;
- fallback;
- handoff;
- observabilidade de custo e latência.

**Definition of Done:** IA melhora linguagem/roteamento sem controlar regras críticas.

## Fase 7 — Comercialização

Entregas:

- onboarding simplificado;
- plano e assinatura;
- landing page;
- demo tenant;
- exportação básica;
- termos e privacidade;
- métricas SaaS.

## Backlog pós-MVP

- Google Calendar;
- múltiplas unidades;
- campanhas segmentadas;
- cupons;
- fidelidade;
- integrações contábeis;
- analytics avançado;
- white-label;
- marketplace.

## Critério de prioridade

Cada nova feature deve responder pelo menos a uma pergunta:

1. aumenta conversão?
2. reduz faltas?
3. recupera receita?
4. reduz trabalho manual?
5. aumenta retenção do estabelecimento?

Se não responder a nenhuma, não entra antes da validação comercial.
