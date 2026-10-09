# SPEC-0022 — Estratégia Mobile: PWA e AgendaZap Pro

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Decisão

Não exigir aplicativo nativo para o cliente final.

O canal primário do consumidor continua:

- WhatsApp;
- página pública mobile;
- PWA quando desejada.

Aplicativo nativo é destinado futuramente à equipe do estabelecimento.

## 2. Motivo

Instalação obrigatória aumenta fricção para quem apenas quer marcar um serviço.

Para profissionais, notificações e fluxo operacional recorrente podem justificar app.

## 3. PWA P0

Deve suportar:

- agenda;
- CRM;
- dashboard;
- pagamentos;
- configurações essenciais;
- install prompt quando apropriado;
- cache seguro de shell;
- sem cache de dado sensível fora da política.

## 4. AgendaZap Pro futuro

Casos:

- agenda de hoje;
- check-in;
- completed/no-show;
- novo agendamento;
- reagendamento/cancelamento;
- confirmação de PIX;
- ficha resumida do cliente;
- push operacional;
- alerta de novo booking;
- alerta de horário recuperado.

## 5. Tecnologia

Preferir reaproveitamento da web app, por exemplo wrapper híbrido, antes de criar duas bases nativas independentes.

A escolha final depende de métricas de uso e requisitos de push/device.

## 6. Gate para app nativo

Só iniciar quando:

- houver base ativa relevante;
- profissionais usarem mobile diariamente;
- push tiver impacto mensurável;
- PWA não atender requisito crítico.

## 7. Segurança

- sessão revogável;
- biometria apenas como proteção local opcional;
- nenhum segredo de provider embarcado;
- push sem conteúdo sensível por padrão.

## 8. Definition of Done

PWA:

- fluxos P0 funcionam em 390px;
- pode ser instalada;
- não há dependência de desktop.

App Pro futuro:

- reaproveita API;
- push auditável;
- logout remoto;
- deep links seguros;
- sem duplicação de regra de negócio.
