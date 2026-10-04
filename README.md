# AgendaZap

**AgendaZap** é um SaaS de atendimento, agendamento e **recuperação automática de receita** via WhatsApp para pequenos negócios de serviços.

> **Tese do produto:** o AgendaZap não deve ser apenas mais uma agenda com chatbot. Ele deve identificar receita perdida e tentar recuperá-la automaticamente.

## AgendaZap Revenue Autopilot

O produto atua em quatro momentos:

1. **Converte** conversas em agendamentos.
2. **Protege** receita com confirmação, lembretes e sinal via PIX.
3. **Recupera** receita quando há cancelamentos, horários vazios ou clientes inativos.
4. **Prova** quanto faturamento foi atribuído às automações.

Exemplo de dashboard:

```text
RECEITA DO MÊS

Receita prevista ........ R$ 28.400
Receita recebida ........ R$ 23.190
Receita recuperada ...... R$  4.260

├─ Clientes reativados .. R$ 2.100
├─ Cancelamentos cobertos R$ 1.340
└─ No-shows evitados .... R$   820
```

## Vertical inicial

O MVP comercial é direcionado primeiro a:

- salões de beleza;
- barbearias;
- manicure, cílios e sobrancelhas;
- estética não clínica;
- tatuadores;
- profissionais autônomos com agenda.

Outros verticais podem ser adicionados posteriormente por perfis de configuração.

## Proposta de valor

- atendimento automatizado pelo WhatsApp;
- WhatsApp Flows para jornadas estruturadas;
- agenda pública e PWA;
- profissionais, salas, cadeiras e equipamentos;
- cobrança de sinal via PIX;
- lembretes e confirmação;
- recuperação de clientes inativos;
- preenchimento automático de cancelamentos;
- lista de espera;
- pacotes, créditos e recorrência;
- solicitação de avaliações;
- CRM;
- atribuição de receita recuperada;
- dashboard operacional e comercial.

## Arquitetura

```text
Cliente
   |
   +--------------------+
   |                    |
   v                    v
WhatsApp            Página pública
Flows + IA              / PWA
   |                    |
   +---------+----------+
             |
             v
       AgendaZap API
             |
  +----------+-----------+-----------+-----------+
  |          |           |           |           |
  v          v           v           v           v
Agenda    Revenue      CRM       Payments    Automation
Engine    Engine                  Adapter       Jobs
  |          |           |           |           |
  +----------+-----------+-----------+-----------+
             |
             v
         PostgreSQL
             |
        Outbox / Jobs
             |
             v
          Redis
```

Stack inicial:

- Frontend: Next.js + TypeScript
- Backend: Rust/Axum
- Banco: PostgreSQL
- Jobs/cache: Redis
- WhatsApp: Meta WhatsApp Business Platform
- Pagamentos: adapter para PSP/PIX
- IA: provider abstraction + tool calling
- Deploy: Docker

## Especificações

| SPEC | Documento | Escopo |
|---|---|---|
| SPEC-0001 | [Produto e MVP](docs/specs/SPEC-0001-PRODUCT-MVP.md) | tese, vertical, requisitos e validação |
| SPEC-0002 | [Arquitetura](docs/specs/SPEC-0002-ARCHITECTURE.md) | módulos, dados, APIs e concorrência |
| SPEC-0003 | [WhatsApp e IA](docs/specs/SPEC-0003-WHATSAPP-AI.md) | Flows, intents, tools, handoff e IA |
| SPEC-0004 | [Agenda, PIX e Receita](docs/specs/SPEC-0004-BOOKING-PAYMENTS.md) | agenda, holds, PIX, pacotes e recorrência |
| SPEC-0005 | [Segurança e LGPD](docs/specs/SPEC-0005-SECURITY-LGPD.md) | segurança, consentimentos e privacidade |
| SPEC-0006 | [Roadmap](docs/specs/SPEC-0006-ROADMAP.md) | ordem de implementação comercial |
| SPEC-0007 | [Revenue Engine](docs/specs/SPEC-0007-REVENUE-ENGINE.md) | recuperação e atribuição de receita |
| SPEC-0008 | [WhatsApp Flows](docs/specs/SPEC-0008-WHATSAPP-FLOWS.md) | onboarding e jornadas estruturadas |
| SPEC-0009 | [SaaS Billing](docs/specs/SPEC-0009-SAAS-BILLING.md) | planos, assinatura, quotas e margem |
| SPEC-0010 | [Resources & Packages](docs/specs/SPEC-0010-RESOURCES-PACKAGES.md) | recursos, pacotes, créditos e memberships |
| SPEC-0011 | [Reliability](docs/specs/SPEC-0011-RELIABILITY.md) | outbox, retry, idempotência e reconciliação |
| SPEC-0012 | [Growth Analytics](docs/specs/SPEC-0012-GROWTH-ANALYTICS.md) | funil, cohort, LTV, reviews e indicação |

## Princípios

- **receita recuperada é funcionalidade P0**;
- o MVP deve ser vendável antes de ser sofisticado;
- IA não controla regras críticas;
- nenhuma integração externa é source of truth;
- onboarding deve ser rápido;
- tudo que aumenta complexidade deve justificar conversão, receita, retenção ou redução de trabalho.

## Status

**Especificação v0.2.0 — pós-auditoria recursiva.**

Próximo marco: **core de agenda + Revenue Engine + WhatsApp Flows + primeiro tenant pagante**.
