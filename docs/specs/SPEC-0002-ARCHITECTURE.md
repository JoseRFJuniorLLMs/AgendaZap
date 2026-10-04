# SPEC-0002 — Arquitetura

**Status:** Draft  
**Versão:** 0.2.0

## 1. Estratégia

- monólito modular;
- PostgreSQL como source of truth;
- transactional outbox;
- workers assíncronos;
- adapters para fornecedores;
- isolamento multi-tenant;
- domínio independente de LLM, WhatsApp e PSP.

## 2. Módulos

- Identity
- Tenancy
- Locations
- Catalog
- Professionals
- Resources
- Scheduling
- Customers
- Conversations
- Payments
- Revenue Engine
- Automation
- Billing
- Analytics
- Audit

## 3. Entidades mínimas

### tenants
`id, name, slug, timezone, status, plan_id, created_at`

### locations
`id, tenant_id, name, timezone, address, active`

### users
`id, tenant_id, name, email, auth_provider, role`

### professionals
`id, tenant_id, location_id, name, active`

### services
`id, tenant_id, name, duration_minutes, buffer_minutes, price_cents, deposit_cents, active`

### resources
Representa sala, cadeira, equipamento ou outro recurso finito.

`id, tenant_id, location_id, type, name, capacity, active`

### service_resource_requirements
`service_id, resource_type, quantity`

### availability_rules
`id, subject_type, subject_id, weekday, start_time, end_time`

### calendar_blocks
`id, subject_type, subject_id, starts_at, ends_at, reason`

### customers
`id, tenant_id, name, phone_e164, last_visit_at, created_at`

### customer_consents
`id, customer_id, purpose, legal_basis, source, granted_at, revoked_at, evidence`

### booking_holds
`id, tenant_id, customer_id, service_id, professional_id, starts_at, ends_at, expires_at, status`

### booking_hold_resources
`booking_hold_id, resource_id`

### appointments
`id, tenant_id, location_id, customer_id, professional_id, service_id, starts_at, ends_at, status, price_cents, deposit_required_cents, payment_status, source, created_at`

### appointment_resources
`appointment_id, resource_id`

### payments
`id, tenant_id, appointment_id, provider, provider_reference, amount_cents, status, paid_at`

### conversations
`id, tenant_id, customer_id, channel, state, human_handoff, started_at, closed_at`

### messages
`id, conversation_id, direction, provider_message_id, template_id, status, content_ref, created_at`

### waitlist_entries
`id, tenant_id, customer_id, service_id, professional_id, date_from, date_to, time_window, status`

### recovery_opportunities
`id, tenant_id, customer_id, appointment_id, type, estimated_value_cents, status, created_at`

### revenue_attributions
`id, tenant_id, opportunity_id, appointment_id, amount_cents, attribution_type, created_at`

### outbox_events
`id, tenant_id, event_type, aggregate_type, aggregate_id, payload, created_at, published_at`

### webhook_events
`id, provider, provider_event_id, payload_hash, received_at, processed_at, status`

### idempotency_keys
`key, tenant_id, operation, response_ref, expires_at`

### dead_letter_jobs
`id, job_type, payload, error, attempts, created_at`

### plans
`id, code, name, price_cents, limits`

### subscriptions
`id, tenant_id, plan_id, status, starts_at, renews_at`

### usage_events
`id, tenant_id, metric, quantity, occurred_at`

### audit_events
`id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at`

## 4. Concorrência

Double booking deve ser impedido no banco para:

- profissional;
- recurso;
- booking hold ativo;
- appointment ativo.

Preferir exclusion constraints por range temporal quando compatível.

## 5. API

### Public
- `GET /public/:tenant/services`
- `GET /public/:tenant/availability`
- `POST /public/:tenant/holds`
- `POST /public/:tenant/bookings`

### Admin
- CRUD services
- CRUD professionals
- CRUD resources
- availability
- blocks
- customers
- appointments
- recovery opportunities
- analytics
- billing

### Webhooks
- `POST /webhooks/whatsapp`
- `POST /webhooks/payments/:provider`

## 6. Eventos

- `slot.became_available`
- `booking_hold.created`
- `booking_hold.expired`
- `appointment.created`
- `appointment.confirmed`
- `appointment.cancelled`
- `appointment.completed`
- `appointment.no_show`
- `payment.paid`
- `customer.reactivation_candidate`
- `recovery.opportunity_created`
- `recovery.converted`
- `revenue.attributed`

## 7. Deploy

Desenvolvimento:

- web
- api
- worker
- postgres
- redis

Produção inicial pode ser uma única aplicação/VM/PaaS, mantendo banco persistente, backup e worker separado logicamente.

## 8. Regra de evolução

Separar microserviços apenas por pressão real de escala, segurança ou ownership.
