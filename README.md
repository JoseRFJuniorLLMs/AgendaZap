# AgendaZap

**AgendaZap** é um SaaS de atendimento, agendamento e recuperação de clientes via WhatsApp para pequenos negócios.

O objetivo do produto é simples: **transformar conversas em agendamentos e agendamentos em receita**, reduzindo horários ociosos, faltas e trabalho manual.

## Proposta de valor

- Atendimento inicial automatizado pelo WhatsApp
- Consulta de serviços, preços e horários
- Agendamento, reagendamento e cancelamento
- Confirmação e lembretes automáticos
- Cobrança de sinal via PIX
- Recuperação de clientes inativos
- Preenchimento de horários vagos após cancelamentos
- Solicitação de avaliação no Google
- CRM e dashboard de receita/agendamentos

## Público inicial

MVP direcionado a pequenos negócios de serviços:

- clínicas de estética
- salões e barbearias
- dentistas
- fisioterapia
- pilates
- massoterapia
- tatuadores
- profissionais autônomos com agenda

## Princípio do MVP

O MVP deve ser **vendável antes de ser sofisticado**.

A prioridade é provar três resultados:

1. gerar agendamentos;
2. reduzir faltas e horários vazios;
3. recuperar clientes e receita.

## Arquitetura proposta

```text
Cliente
   |
   v
WhatsApp Cloud API
   |
   v
AgendaZap API
   |
   +--> Motor de Agenda
   +--> CRM
   +--> Automação / Filas
   +--> LLM / Assistente
   +--> PIX / Pagamentos
   |
   v
PostgreSQL
   |
   v
Dashboard Web / PWA
```

Stack inicial sugerida:

- Frontend: Next.js + TypeScript
- Backend: Rust/Axum ou FastAPI
- Banco: PostgreSQL
- Cache/Jobs: Redis
- Mensageria: fila simples no MVP
- WhatsApp: Meta WhatsApp Cloud API
- Pagamentos: PIX via provedor integrado
- IA: provider abstraction para LLM
- Deploy: Docker

## Especificações

| SPEC | Documento | Escopo |
|---|---|---|
| SPEC-0001 | [Produto e MVP](docs/specs/SPEC-0001-PRODUCT-MVP.md) | visão, personas, requisitos e critérios de sucesso |
| SPEC-0002 | [Arquitetura](docs/specs/SPEC-0002-ARCHITECTURE.md) | componentes, serviços, modelo de dados e APIs |
| SPEC-0003 | [WhatsApp e IA](docs/specs/SPEC-0003-WHATSAPP-AI.md) | conversação, intents, handoff e automações |
| SPEC-0004 | [Agenda, PIX e Receita](docs/specs/SPEC-0004-BOOKING-PAYMENTS.md) | agenda, sinal, cancelamentos e recuperação |
| SPEC-0005 | [Segurança e LGPD](docs/specs/SPEC-0005-SECURITY-LGPD.md) | privacidade, segurança, retenção e auditoria |
| SPEC-0006 | [Roadmap](docs/specs/SPEC-0006-ROADMAP.md) | fases de implementação e definição de pronto |

## Status

Projeto em especificação inicial.

Próximo marco: **MVP funcional com onboarding de estabelecimento, agenda pública e fluxo de agendamento via WhatsApp**.
