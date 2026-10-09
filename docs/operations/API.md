# SPEC-0009 — Contrato HTTP

Prefixo /AgendaZap/api; JSON; erro {error,details?}. 400 schema; 401 sessão/assinatura; 403 RBAC/CSRF; 404 objeto fora de tenant; 409 regra; 429 limite; 503 banco/provedor. Valores em centavos; instantes ISO com timezone; IDs UUID.

| Domínio | Endpoints |
|---|---|
| Auth | POST /auth/register; POST /auth/login; POST /auth/logout; GET /auth/me; POST /auth/password |
| Catálogo | GET/POST /services; PATCH /services/:id; GET/POST /professionals; PATCH /professionals/:id |
| Agenda | GET /availability; GET/POST /blocks; DELETE /blocks/:id; GET/POST /appointments; POST /appointments/:id/status; POST /appointments/:id/reschedule |
| CRM | GET/POST /customers; PATCH /customers/:id; GET /customers/:id/export; POST /customers/:id/anonymize; GET/POST /waitlist |
| Atendimento | GET /conversations; POST /conversations/:id/handoff; POST /conversations/:id/reply; POST /conversations/simulate |
| Automação | GET /jobs; POST /jobs/:id/retry; POST /campaigns/recovery |
| Financeiro | GET /payments; POST /payments/:id/confirm; POST /payments/:id/refund |
| Administração | GET/PATCH /settings; PATCH /settings/whatsapp; PATCH /settings/pix; GET/POST /users; POST /users/:id/disable; GET /audit; GET /export; GET /dashboard |
| Público | GET /public/:slug; GET /public/:slug/availability; POST /public/:slug/appointments; GET /public/appointments/:id/manage; POST /public/appointments/:id/cancel; POST /public/appointments/:id/reschedule |
| Integração | GET/POST /webhooks/whatsapp; GET /health; GET /config |

Register: name/email/password(12–128)/business_name/slug(3–50)/timezone?. Retorno user/tenant/csrf + cookie. Login email/password. Mutações autenticadas requerem x-csrf-token. Nunca tenant_id no payload privilegiado.

Service completo: name/duration_minutes(15–480)/price_cents/deposit_cents/active. Professional completo: name/active/service_ids/availability[{weekday 0–6,start HH:MM,end HH:MM}]. PATCH usa objeto completo; não aceitar id extra.

Booking: service_id/professional_id/starts_at/name/phone E.164/consent/idempotency_key(8–80)/campaign_id?. Query vagas service_id/date YYYY-MM-DD/professional_id?. Slot starts_at/ends_at/time/professional_id/professional_name. Status {status}; reschedule {starts_at,professional_id?}.

Customer name/phone/consent; PATCH inclui tags. Block professional_id/starts_at/ends_at/reason. Waitlist customer_id/service_id/professional_id?/date. Reply {text}; handoff {enabled}; simulate {phone,name,text}.

Settings completo name/timezone/address/review_url/min_notice_minutes/horizon_days/buffer_minutes/cancellation_hours/recovery_days/payment_email?. User name/email/password/role/professional_id?; role manager/attendant/professional; proprietário só register. WhatsApp {phone_id}, autorizado no ambiente.

Público booking retorna appointment+manage_token apenas ao criador. Manage/cancel/reschedule exigem x-booking-token. Catálogo público não inclui clientes/configuração sensível. Webhooks exigem assinatura do fornecedor antes de qualquer mutação.

## Pix direto por estabelecimento

PATCH /settings/pix (owner + CSRF): enabled, recipient_name, recipient_city, keys[{id UUID,type cpf/cnpj/email/phone/random,value,label}], default_key_id. Máximo 10 chaves, sem duplicatas; principal precisa pertencer à lista. Validação de formato não verifica titularidade no banco. Catálogo público só informa pix_enabled. QR Code e Copia e Cola ficam no link protegido da reserva.

POST /payments/:id/confirm (owner/manager + CSRF): {bank_reference}, após conferir o recebimento no banco. É idempotente e auditado; referência não pode ser reutilizada em outro pagamento do mesmo estabelecimento. Pagamento após expiração/cancelamento exige revisão e não reabre o horário.

POST /payments/:id/refund (owner + CSRF): {bank_reference}, registra devolução já feita no banco; não transfere dinheiro. Mercado Pago e seus webhooks foram removidos. Planos da plataforma continuam visíveis; mensalidade é acertada manualmente com o administrador.
