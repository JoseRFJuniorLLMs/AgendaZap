# SPEC-0002 — Arquitetura

**Status:** Draft  
**Versão:** 0.1.0

## 1. Princípios

- monólito modular no MVP;
- fronteiras claras entre domínios;
- banco relacional como source of truth;
- jobs assíncronos para mensagens e automações;
- integrações externas atrás de adapters;
- nenhuma dependência direta entre domínio e fornecedor.

## 2. Arquitetura

```text
                 +------------------+
                 | Dashboard / PWA  |
                 +---------+--------+
                           |
                           v
+-----------+      +-------+--------+       +----------------+
| WhatsApp  +----->+  AgendaZap API +------>+ PostgreSQL     |
+-----------+      +---+---+---+----+       +----------------+
                      |   |   |
              +-------+   |   +---------+
              v           v             v
         +---------+  +---------+  +----------+
         | Jobs    |  | LLM     |  | Payments |
         | / Redis |  | Adapter |  | Adapter  |
         +---------+  +---------+  +----------+
```

## 3. Módulos

### Identity
Usuários administrativos, autenticação e autorização.

### Tenancy
Estabelecimentos, unidades, configurações e timezone.

### Catalog
Serviços, preços, duração e profissionais habilitados.

### Scheduling
Disponibilidade, bloqueios, reservas e agendamentos.

### Customers
Cadastro mínimo, consentimentos, tags e histórico.

### Conversations
Sessões do WhatsApp, mensagens, intents e handoff.

### Payments
Cobranças, PIX, webhooks, reconciliação e estorno.

### Automation
Lembretes, recuperação, lista de espera e pós-atendimento.

### Analytics
Eventos, funil, receita e indicadores.

## 4. Modelo de dados mínimo

### tenants
- id
- name
- slug
- timezone
- status
- created_at

### users
- id
- tenant_id
- name
- email
- password_hash / auth_provider
- role

### professionals
- id
- tenant_id
- name
- active

### services
- id
- tenant_id
- name
- duration_minutes
- price_cents
- deposit_cents
- active

### professional_services
- professional_id
- service_id

### availability_rules
- id
- professional_id
- weekday
- start_time
- end_time

### calendar_blocks
- id
- professional_id
- starts_at
- ends_at
- reason

### customers
- id
- tenant_id
- name
- phone_e164
- consent_status
- last_visit_at

### appointments
- id
- tenant_id
- customer_id
- professional_id
- service_id
- starts_at
- ends_at
- status
- price_cents
- deposit_required_cents
- payment_status
- source
- created_at

### payments
- id
- tenant_id
- appointment_id
- provider
- provider_reference
- amount_cents
- status
- paid_at

### conversations
- id
- tenant_id
- customer_id
- channel
- state
- human_handoff
- started_at
- closed_at

### messages
- id
- conversation_id
- direction
- provider_message_id
- content
- created_at

### automation_jobs
- id
- tenant_id
- type
- payload
- scheduled_at
- status
- attempts

### audit_events
- id
- tenant_id
- actor_type
- actor_id
- event_type
- entity_type
- entity_id
- metadata
- created_at

## 5. Controle de concorrência

A criação do agendamento deve ocorrer em transação.

Regra: o mesmo profissional não pode possuir dois agendamentos ativos com intervalo sobreposto.

Recomendação PostgreSQL:

- lock transacional ou exclusion constraint por intervalo;
- idempotency key para requests vindos de webhooks;
- reserva temporária com TTL quando pagamento for obrigatório.

## 6. API inicial

### Auth
- `POST /auth/login`
- `POST /auth/logout`

### Services
- `GET /services`
- `POST /services`
- `PATCH /services/:id`

### Professionals
- `GET /professionals`
- `POST /professionals`
- `PATCH /professionals/:id`

### Availability
- `GET /availability?service_id=&date=`

### Appointments
- `POST /appointments`
- `GET /appointments/:id`
- `POST /appointments/:id/confirm`
- `POST /appointments/:id/reschedule`
- `POST /appointments/:id/cancel`

### Customers
- `GET /customers`
- `GET /customers/:id`

### Webhooks
- `POST /webhooks/whatsapp`
- `POST /webhooks/payments/:provider`

## 7. Eventos de domínio

- `customer.created`
- `appointment.created`
- `appointment.awaiting_payment`
- `appointment.confirmed`
- `appointment.rescheduled`
- `appointment.cancelled`
- `appointment.completed`
- `appointment.no_show`
- `payment.created`
- `payment.paid`
- `payment.failed`
- `customer.reactivation_candidate`

## 8. Deployment inicial

Docker Compose para desenvolvimento:

- web
- api
- postgres
- redis

Produção pode começar em uma única VM ou PaaS, desde que banco tenha backup e persistência adequados.

## 9. Evolução

Só separar serviços quando existir necessidade operacional comprovada. Microserviço prematuro não é requisito de produto.
