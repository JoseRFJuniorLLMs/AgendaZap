# SPEC-0025 — Onboarding, Trial e Commercial Readiness

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Fazer um novo tenant sair de cadastro para primeiro valor percebido sem intervenção de engenharia.

## 2. Activation checklist

- conta criada;
- negócio configurado;
- ao menos um profissional;
- ao menos um serviço;
- horários;
- WhatsApp conectado ou canal público ativo;
- PIX opcional;
- clientes importados opcionalmente;
- primeiro booking;
- primeira automação;
- dashboard ativo.

## 3. Time to Value

Métricas:

- signup_to_catalog;
- signup_to_integration;
- signup_to_first_booking;
- signup_to_first_recovered_revenue.

North Star de onboarding:

**tempo até primeiro valor comprovado**.

## 4. Trial

Trial deve:

- ter início/fim;
- mostrar recursos incluídos;
- mostrar uso;
- preservar dados após fim por janela definida;
- não mascarar custos;
- destacar receita recuperada.

## 5. Demo tenant

Ambiente de demo separado de produção real:

- dados sintéticos;
- resetável;
- cenários previsíveis;
- cancelamento recuperável;
- cliente inativo;
- no-show;
- PIX.

## 6. Suporte

Antes de clientes pagantes:

- canal de suporte;
- owner operacional;
- procedimento de incidente;
- backup/PITR;
- restore testado;
- status/health;
- política de retenção;
- termos e privacidade.

## 7. Health score do tenant

Sinais:

- integração ativa;
- bookings semanais;
- automações;
- recovered revenue;
- admin sessions;
- erro recorrente;
- uso de recursos-chave.

## 8. Churn prevention

Detectar:

- 7/14 dias sem booking;
- integração quebrada;
- queda abrupta;
- trial sem ativação;
- past_due;
- cancel intent.

## 9. Definition of Done

- owner ativa conta sem terminal;
- checklist mostra progresso;
- demo pode ser resetada;
- trial tem lifecycle;
- restore operacional foi testado;
- suporte sabe diagnosticar integration health;
- primeiro cliente pagante não depende de editar código.
