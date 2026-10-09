# SPEC-0015 — Posicionamento Comercial e ICP

**Status:** Proposed  
**Versão:** 0.1.0

## 1. Objetivo

Definir para quem o AgendaZap é vendido, qual problema econômico resolve e como o produto deve ser apresentado.

O AgendaZap não deve competir como "mais uma agenda". A categoria comercial principal é **Revenue Autopilot para negócios de serviços via WhatsApp**.

## 2. Promessa principal

> Preencher horários vazios, reduzir faltas, reativar clientes e provar quanto faturamento foi recuperado.

Agenda, CRM, PIX, IA, voz e automações são mecanismos de execução dessa promessa.

## 3. ICP inicial

Prioridade P0:

- salões de beleza;
- barbearias;
- estúdios de manicure, cílios e sobrancelhas;
- estética não clínica;
- tatuadores com operação multi-profissional.

Perfil ideal:

- 3 a 10 profissionais;
- 150+ atendimentos/mês;
- ticket médio entre R$ 60 e R$ 300;
- WhatsApp como canal principal;
- cancelamentos/no-shows recorrentes;
- dono ou gerente ainda participa da operação;
- base de clientes existente;
- decisão de compra local e rápida.

## 4. Anti-ICP inicial

Não priorizar:

- grandes redes com ciclo enterprise;
- negócios sem agenda;
- operações sem WhatsApp;
- autônomos de baixíssimo volume quando CAC/suporte não fecharem;
- segmentos clínicos que exijam prontuário ou tratamento de dado sensível não suportado.

## 5. Jobs to be Done

1. "Quando alguém cancelar, quero preencher o horário."
2. "Quero trazer de volta clientes que sumiram."
3. "Quero reduzir faltas."
4. "Quero parar de responder as mesmas perguntas no WhatsApp."
5. "Quero saber se a automação realmente gerou dinheiro."

## 6. Mensagens comerciais

Preferir:

- "Cancelou? O AgendaZap tenta preencher.";
- "Cliente sumiu? O AgendaZap tenta trazer de volta.";
- "No fim do mês, veja quanto dinheiro foi recuperado.";
- "WhatsApp + agenda + recuperação de receita."

Evitar como headline:

- "CRM omnichannel";
- "IA generativa";
- "plataforma tudo-em-um";
- arquitetura ou linguagem técnica.

## 7. Métricas

- recovered_revenue_per_active_tenant;
- cancellation_recovery_rate;
- reactivation_rate;
- occupancy;
- no_show_rate;
- payback_ratio = recovered_revenue / subscription_price;
- activation_to_value_time.

## 8. Gate comercial

Uma funcionalidade P0 deve contribuir diretamente para pelo menos um:

- recuperar receita;
- aumentar ocupação;
- reduzir no-show;
- reduzir trabalho operacional;
- reduzir tempo de onboarding;
- aumentar retenção.

## 9. Definition of Done

- landing descreve resultado antes de features;
- onboarding e demo usam um vertical inicial;
- dashboard apresenta receita recuperada;
- demo mostra cancelamento -> recuperação -> atribuição;
- pricing comunica ROI, não apenas lista de recursos;
- ICP está refletido no CRM comercial e lead scoring.
