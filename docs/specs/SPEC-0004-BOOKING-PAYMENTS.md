# SPEC-0004 — Agenda, PIX e Receita

**Status:** Draft  
**Versão:** 0.1.0

## 1. Motor de agenda

A disponibilidade de um slot é derivada de:

1. regra semanal do profissional;
2. serviço escolhido;
3. duração;
4. intervalo/buffer;
5. bloqueios;
6. agendamentos existentes;
7. antecedência mínima;
8. horizonte máximo de agendamento.

## 2. Double booking

É proibido confirmar dois agendamentos sobrepostos do mesmo profissional.

A proteção deve existir no banco, não apenas no frontend.

## 3. Reserva temporária

Quando houver sinal:

1. cria `booking_hold`;
2. bloqueia slot por TTL;
3. gera cobrança PIX;
4. pagamento confirmado dentro do prazo -> appointment `confirmed`;
5. TTL expirado -> hold liberado.

## 4. PIX

A camada de pagamento deve ser provider-agnostic.

Interface conceitual:

```text
create_charge()
get_charge()
refund_charge()
handle_webhook()
```

Campos esperados:

- provider;
- reference;
- amount;
- status;
- qr_code;
- copy_paste_code;
- expires_at.

## 5. Webhook

Requisitos:

- validar autenticidade;
- idempotência;
- persistir evento bruto de forma segura;
- reconciliar pagamento;
- emitir evento interno.

Nunca confiar em confirmação do frontend.

## 6. Cancelamento

Política configurável por tenant:

- prazo mínimo;
- retenção do sinal;
- crédito para reagendamento;
- reembolso total/parcial.

O AgendaZap executa a política configurada, sem inventar decisões comerciais.

## 7. Lista de espera

Cliente pode declarar:

- serviço;
- profissional opcional;
- datas;
- janela de horários.

Quando surgir vaga:

1. identificar candidatos;
2. ordenar por regra simples;
3. notificar;
4. primeiro que confirmar recebe hold;
5. demais deixam de receber aquela vaga.

## 8. Recuperação de cancelamento

Ao cancelar um horário futuro, emitir:

`slot.became_available`

Esse evento pode disparar:

- lista de espera;
- clientes interessados;
- clientes elegíveis a retorno.

## 9. No-show

Estados:

- confirmado;
- checked-in;
- completed;
- no-show.

O sistema deve permitir marcação manual e, posteriormente, automação por regra.

## 10. Receita

Separar:

- `expected_revenue`: valor dos agendamentos;
- `received_revenue`: pagamentos efetivamente reconhecidos;
- `recovered_revenue`: receita atribuída a campanhas ou preenchimento de cancelamento.

## 11. Auditoria financeira

Toda mudança de:

- valor;
- pagamento;
- reembolso;
- cancelamento com impacto financeiro

deve gerar evento de auditoria.
