# SPEC-0001 — Produto e MVP

**Status:** Draft  
**Versão:** 0.2.0  
**Produto:** AgendaZap

## 1. Tese

AgendaZap é um SaaS multi-tenant de **Revenue Autopilot** para negócios de serviços.

O produto não é apenas uma agenda. Ele deve:

1. converter conversas em agendamentos;
2. proteger receita com confirmação e sinal;
3. detectar receita em risco;
4. tentar recuperar receita automaticamente;
5. atribuir o resultado financeiro às automações.

## 2. Vertical inicial

O MVP prioriza beleza e serviços pessoais:

- salões;
- barbearias;
- manicure;
- cílios e sobrancelhas;
- estética não clínica;
- tatuadores;
- profissionais autônomos.

O produto deve permanecer configurável para novos verticais, mas não deve sacrificar velocidade de execução tentando resolver todos no primeiro release.

## 3. Problemas

- demora no WhatsApp;
- agenda fragmentada;
- no-show;
- cancelamentos;
- horários ociosos;
- falta de cobrança de sinal;
- clientes que deixam de retornar;
- recursos compartilhados mal controlados;
- dificuldade de provar o retorno financeiro de ferramentas digitais.

## 4. Personas

### Proprietário
Quer faturamento, ocupação, receita recuperada e controle.

### Profissional
Quer agenda simples, disponibilidade e comissões claras.

### Cliente
Quer resolver tudo em poucos passos.

### Atendente
Quer assumir exceções sem competir com o bot.

## 5. Escopo MVP

### MUST — P0

- multi-tenant;
- estabelecimento e unidade;
- profissionais;
- serviços;
- recursos compartilhados;
- duração, preço e sinal;
- disponibilidade;
- bloqueios;
- consulta de slots;
- booking hold;
- agendamento;
- reagendamento;
- cancelamento;
- lista de espera;
- WhatsApp;
- WhatsApp Flows;
- lembretes;
- consentimentos por finalidade;
- PIX via adapter;
- recuperação de clientes;
- preenchimento de cancelamentos;
- atribuição de receita recuperada;
- dashboard operacional e de receita;
- histórico e auditoria;
- handoff humano.

### SHOULD — P1

- Google Calendar;
- importação CSV;
- pacotes/créditos;
- comissões;
- assinatura/membership;
- reviews;
- indicação;
- assistente LLM;
- campanhas segmentadas.

### COULD — P2

- múltiplas marcas;
- estoque;
- cupons;
- white-label;
- marketplace;
- analytics preditivo.

### WON'T no MVP

- prontuário;
- diagnóstico;
- folha completa;
- contabilidade completa;
- ERP genérico;
- marketplace.

## 6. Jornada principal

```text
Lead
 |
 v
WhatsApp / Página pública
 |
 v
Serviço
 |
 v
Profissional + Recursos
 |
 v
Slot disponível
 |
 v
Booking Hold
 |
 +--> sinal? --> PIX --> confirmado
 |                         |
 +-------------------------+
 |
 v
Lembrete / confirmação
 |
 v
Atendimento
 |
 +--> completed --> review + retorno futuro
 |
 +--> cancelled --> Revenue Engine
 |
 +--> no_show --> Revenue Engine / regra
```

## 7. Estados do agendamento

- `pending`
- `hold`
- `awaiting_payment`
- `confirmed`
- `checked_in`
- `completed`
- `cancelled_by_customer`
- `cancelled_by_business`
- `no_show`
- `expired`

Transições são determinísticas e validadas no backend.

## 8. Dashboard mínimo

### Operação
- agenda do dia;
- ocupação;
- horários vazios;
- pagamentos pendentes;
- confirmações;
- cancelamentos;
- lista de espera.

### Receita
- receita prevista;
- receita recebida;
- receita recuperada;
- receita em risco;
- clientes reativados;
- slots recuperados;
- no-shows evitados.

## 9. Métricas P0

- lead -> booking;
- booking -> confirmed;
- confirmation -> completed;
- no-show rate;
- occupancy rate;
- cancellation recovery rate;
- reactivation rate;
- recovered revenue;
- revenue per available hour;
- automation conversion rate;
- time-to-book.

## 10. Requisitos não funcionais

- PWA;
- mobile-first;
- idempotência;
- isolamento de tenant;
- timezone por unidade;
- logs estruturados;
- outbox;
- retries;
- backup;
- operação degradada sem LLM;
- regras críticas independentes de IA.

## 11. Validação comercial

O MVP é validado quando:

1. tenant é configurado em até 30 minutos;
2. cliente agenda sozinho;
3. não existe double booking de profissional nem recurso;
4. PIX confirma reserva de forma idempotente;
5. cancelamento dispara recuperação;
6. cliente inativo pode ser reativado;
7. dashboard atribui receita recuperada;
8. existe pelo menos um tenant pagante;
9. o tenant consegue identificar retorno financeiro do AgendaZap.

## 12. Restrição clínica

O MVP não armazena prontuário, diagnóstico ou informação clínica desnecessária.
