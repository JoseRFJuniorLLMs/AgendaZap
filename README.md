<p align="center">
  <img src="assets/logo-agendazap-full.svg" alt="AgendaZap — Revenue Autopilot" width="520" />
</p>

# AgendaZap

**AgendaZap** é um SaaS de atendimento, agendamento e **recuperação automática de receita** via WhatsApp para pequenos negócios de serviços.

## Identidade visual

Ativos oficiais:

- `assets/logo-agendazap-full.svg` — logo completa com tagline;
- `assets/logo-agendazap-horizontal.svg` — wordmark horizontal;
- `assets/icon-agendazap.svg` — ícone para sidebar, favicon e PWA.
- `assets/brand/agendazap-logo.png` — versão raster da marca completa;
- `assets/brand/agendazap-icon.png` — ícone raster para materiais externos;
- `assets/brand/agendazap-brand-board.png` — prancha oficial de identidade visual.

Paleta principal: `#25D366`, `#0B8F4B`, `#101722`, `#64748B`.

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

## Voice AI

Arquitetura oficial de voz:

- entrada em áudio com `gemini-3.5-transcribe-live`;
- transcrição de arquivo com `gemini-3.5-transcribe`;
- TTS padrão com `gemini-3.8-flash-lite-tts`;
- TTS premium com `gemini-3.8-flash-tts`;
- voz-a-voz em tempo real com `gemini-3.8-live`.

A resposta é sempre produzida primeiro como texto canônico. O áudio é uma representação dessa resposta, nunca uma fonte paralela de decisão.

### Implementação atual do Voice AI

A camada de voz já possui:

- serviço Node.js isolado em `voice-service/`;
- configuração por tenant;
- transcrição de arquivo;
- transcrição Live por WebSocket;
- custom vocabulary;
- smart transcription;
- TTS padrão e premium;
- fallback para texto;
- metering por tenant;
- testes de store/config;
- Docker e healthcheck;
- proxy HTTP/WebSocket no Nginx;
- tela de teste real de STT/TTS no frontend;
- CI cobrindo sintaxe, testes e containers.

O que ainda depende do próximo backend do AgendaZap é a etapa **transcrição → intenção → agenda real → booking → resposta WhatsApp**. A Voice Layer já entrega os contratos para essa integração.

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
| SPEC-0013 | [Frontend Hardening & UX](docs/specs/SPEC-0013-FRONTEND-HARDENING-UX.md) | branding, cache, deploy, acessibilidade, routing e quality gates |
| SPEC-0014 | [Voice AI](docs/specs/SPEC-0014-VOICE-AI.md) | STT, TTS, modo por tenant, fallback e voz em tempo real |

## Princípios

- **receita recuperada é funcionalidade P0**;
- o MVP deve ser vendável antes de ser sofisticado;
- IA não controla regras críticas;
- nenhuma integração externa é source of truth;
- onboarding deve ser rápido;
- tudo que aumenta complexidade deve justificar conversão, receita, retenção ou redução de trabalho.

## Deploy automático da VM

A produção em `https://35.247.217.66.nip.io/AgendaZap/` é reconciliada automaticamente com o branch `main`.

A VM `memoria-vm-2` verifica o SHA remoto a cada 30 segundos. Quando encontra um commit novo, ela:

1. atualiza o clone Git;
2. executa `npm ci`, validação de sintaxe e a suíte completa;
3. preserva dados e configuração em `/etc/agendazap.env`;
4. reconstrói o Voice AI isolado na porta local `8794`;
5. atualiza systemd e o snippet Nginx;
6. valida PostgreSQL, API e Voice AI;
7. grava o SHA implantado;
8. executa rollback quando o healthcheck falha.

O GitHub Actions continua sendo o quality gate do repositório; a VM realiza a reconciliação de produção sem armazenar uma chave SSH permanente no GitHub.

## Status

**AgendaZap v1.0.0 — backend, PostgreSQL, frontend, Voice AI layer, testes e deploy automático versionados.**

Health de produção: `/AgendaZap/api/health`.

O Voice AI requer `GEMINI_API_KEY` configurada de forma segura na VM para habilitar STT/TTS real.
