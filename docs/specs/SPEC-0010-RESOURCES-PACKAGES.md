# SPEC-0010 — Resources & Packages

**Status:** Draft  
**Versão:** 0.1.0

## 1. Recursos físicos

Tipos:

- room;
- chair;
- equipment;
- station;
- custom.

Cada serviço pode exigir zero ou mais recursos.

## 2. Disponibilidade de recurso

Um slot só existe quando todos os requisitos podem ser atendidos simultaneamente.

Exemplo:

```text
Corte:
  profissional = 1
  cadeira = 1

Laser:
  profissional = 1
  sala = 1
  equipamento_laser = 1
```

## 3. Capacidade

Resource pode ter:

- exclusive;
- capacity=N.

MVP pode começar com recursos exclusivos e adicionar capacidade depois.

## 4. Packages

Pacote define:

- nome;
- preço;
- validade;
- itens;
- quantidade por item;
- regras de consumo.

## 5. Credits

Ledger, não contador mutável.

Cada movimento:

- grant;
- consume;
- refund;
- expire;
- adjustment.

Saldo é derivado do ledger.

## 6. Memberships

Pode conceder:

- créditos mensais;
- descontos;
- prioridade;
- serviços inclusos;
- benefícios.

## 7. Comissões

Regra futura P1:

- percentual;
- valor fixo;
- por serviço;
- por profissional;
- exceções.

Comissão nasce do atendimento concluído/pago, não do booking.

## 8. Auditoria

Mudanças de recurso, pacote, crédito, membership e comissão são auditadas.
