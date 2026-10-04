# SPEC-0004 — Agenda, PIX e Receita

**Status:** Draft  
**Versão:** 0.2.0

## 1. Disponibilidade

Slot válido depende de:

1. unidade;
2. serviço;
3. profissional;
4. duração;
5. buffer;
6. disponibilidade;
7. bloqueios;
8. recursos exigidos;
9. appointments;
10. holds;
11. antecedência;
12. horizonte de agenda.

## 2. Double booking

Proibido sobrepor:

- profissional;
- sala;
- cadeira;
- equipamento;
- qualquer recurso exclusivo.

Proteção obrigatória no banco.

## 3. Booking hold

```text
slot -> hold TTL -> pagamento?
                    |
          +---------+---------+
          |                   |
        pago               expira
          |                   |
     confirmed             libera
```

Hold deve reservar profissional e recursos.

## 4. PIX

Adapter:

- create_charge
- get_charge
- cancel_charge
- refund_charge
- handle_webhook

Webhooks:

- autenticados;
- idempotentes;
- persistidos;
- reconciliados.

Frontend nunca confirma pagamento.

## 5. Políticas comerciais

Por tenant:

- depósito fixo ou percentual;
- prazo de pagamento;
- cancelamento;
- crédito;
- reembolso;
- tolerância;
- no-show.

## 6. Lista de espera

Pode filtrar por:

- serviço;
- profissional;
- unidade;
- datas;
- janela de horário.

Primeiro cliente que aceitar recebe hold temporário.

## 7. Pacotes e créditos

Suportar:

### packages
Pacote comercial, exemplo: 10 sessões.

### package_items
Serviços/créditos incluídos.

### customer_credits
Saldo do cliente.

Consumo deve ser transacional e auditável.

## 8. Memberships

Assinatura recorrente pode conceder:

- créditos;
- serviços;
- descontos;
- prioridade;
- benefícios.

O motor deve ser independente do PSP e permitir meios recorrentes suportados pelo provider escolhido.

## 9. Receita

Separar:

- expected_revenue;
- received_revenue;
- recovered_revenue;
- recurring_revenue;
- refunded_revenue.

## 10. Revenue attribution

Uma receita recuperada precisa de:

- oportunidade;
- ação;
- mensagem/canal;
- appointment convertido;
- valor;
- janela de atribuição.

Evitar dupla atribuição.

## 11. Auditoria financeira

Registrar alteração de:

- preço;
- crédito;
- pagamento;
- refund;
- membership;
- pacote;
- cancelamento com impacto financeiro.
