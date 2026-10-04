# SPEC-0001 — Produto e MVP

**Status:** Draft  
**Versão:** 0.1.0  
**Produto:** AgendaZap

## 1. Objetivo

AgendaZap é um SaaS multi-tenant para pequenos negócios de serviços que concentra atendimento, agenda, cobrança de sinal, CRM e automações de relacionamento.

O MVP deve permitir que um estabelecimento comece a operar no mesmo dia do cadastro.

## 2. Problema

Pequenos negócios perdem receita por:

- demora para responder mensagens;
- agenda fragmentada;
- faltas sem confirmação;
- cancelamentos que deixam horários vazios;
- ausência de cobrança de sinal;
- clientes antigos sem acompanhamento;
- inexistência de métricas simples de conversão e receita.

## 3. Personas

### 3.1 Proprietário
Precisa visualizar agenda, receita prevista, horários vagos, faltas e clientes recuperáveis.

### 3.2 Profissional
Precisa visualizar sua agenda e bloquear horários.

### 3.3 Cliente
Precisa consultar serviços, escolher horário, confirmar, pagar sinal, reagendar ou cancelar.

### 3.4 Atendente
Precisa assumir uma conversa quando a automação não resolver o caso.

## 4. Escopo MVP

### MUST

- multi-tenant;
- cadastro de estabelecimento;
- cadastro de profissionais;
- cadastro de serviços;
- duração e preço por serviço;
- disponibilidade semanal;
- bloqueio de agenda;
- consulta de horários livres;
- criação de agendamento;
- reagendamento;
- cancelamento;
- status do agendamento;
- cadastro básico de cliente;
- integração WhatsApp;
- lembrete automático;
- dashboard operacional;
- histórico de atendimento;
- consentimento e opt-out de mensagens.

### SHOULD

- PIX para sinal;
- recuperação de clientes;
- lista de espera;
- preenchimento de cancelamentos;
- solicitação de avaliação;
- assistente de IA;
- handoff para humano.

### COULD

- múltiplas unidades;
- campanhas segmentadas;
- programa de fidelidade;
- cupons;
- marketplace;
- integração com Google Calendar.

### WON'T no MVP

- prontuário médico;
- diagnóstico;
- armazenamento de dados clínicos sensíveis;
- folha de pagamento;
- contabilidade;
- ERP completo.

## 5. Fluxo principal

```text
Cliente inicia conversa
        |
        v
Identificação / consentimento
        |
        v
Escolha do serviço
        |
        v
Escolha do profissional (opcional)
        |
        v
Horários disponíveis
        |
        v
Reserva temporária
        |
        +--> Sinal PIX exigido? -- sim --> pagamento
        |                               |
        |                               v
        |                           confirmação
        |
        +--> não ----------------------> confirmação
        |
        v
Lembrete
        |
        v
Atendimento
        |
        v
Pós-atendimento / avaliação / retorno
```

## 6. Estados do agendamento

- `pending`
- `awaiting_payment`
- `confirmed`
- `checked_in`
- `completed`
- `cancelled_by_customer`
- `cancelled_by_business`
- `no_show`
- `expired`

Toda transição deve ser validada no backend.

## 7. Dashboard mínimo

Cards:

- agendamentos de hoje;
- receita prevista do dia;
- horários vagos;
- confirmações pendentes;
- cancelamentos;
- no-shows;
- clientes elegíveis para recuperação.

Listas:

- próximos atendimentos;
- agenda por profissional;
- pagamentos pendentes;
- clientes para reativação.

## 8. Métricas

- conversas iniciadas;
- conversas convertidas em agendamento;
- taxa de conversão;
- agendamentos confirmados;
- taxa de no-show;
- receita prevista;
- receita confirmada;
- clientes recuperados;
- receita atribuída a recuperação;
- tempo médio até agendamento.

## 9. Requisitos não funcionais

- responsivo;
- PWA;
- API idempotente em operações críticas;
- isolamento de tenant;
- timezone por estabelecimento;
- logs estruturados;
- observabilidade básica;
- backup automatizado;
- operação degradada sem LLM;
- nenhuma regra crítica pode depender exclusivamente do modelo de IA.

## 10. Critérios de sucesso do MVP

O MVP é considerado comercialmente validado quando:

1. um estabelecimento é configurado em menos de 30 minutos;
2. um cliente consegue agendar sem intervenção humana;
3. o sistema impede double booking;
4. lembrete é enviado automaticamente;
5. proprietário acompanha agenda e receita em dashboard;
6. pelo menos uma automação de recuperação de cliente gera retorno mensurável.

## 11. Fora de escopo clínico

AgendaZap não deve tomar decisões médicas, inferir diagnósticos ou armazenar prontuário no MVP.
