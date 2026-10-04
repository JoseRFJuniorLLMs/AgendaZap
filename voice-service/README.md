# AgendaZap Voice Service

Implementação da SPEC-0014 Voice AI.

## Funções

- configuração de voz por tenant;
- Gemini 3.5 Transcribe para arquivos;
- Gemini 3.5 Transcribe Live via WebSocket;
- Gemini 3.8 Flash-Lite TTS;
- Gemini 3.8 Flash TTS premium;
- resposta canônica com decisão texto/áudio;
- custom vocabulary;
- metering;
- fallback sem bloquear texto;
- exclusão local de áudio após transcrição.

## Variáveis

GEMINI_API_KEY, VOICE_SHARED_SECRET, VOICE_PORT e VOICE_DATA_DIR.

A chave Gemini existe somente no backend.

## HTTP

GET /healthz

GET /api/voice/config/:tenantId

PUT /api/voice/config/:tenantId

POST /api/voice/transcribe/:tenantId

Multipart com campo audio e duration_ms opcional.

POST /api/voice/tts/:tenantId

JSON:
{
  "text": "Tenho horários amanhã às 14h e 16h.",
  "premium": false
}

POST /api/voice/respond/:tenantId

JSON:
{
  "canonicalText": "Tenho horários amanhã às 14h e 16h.",
  "customerInputType": "audio"
}

GET /api/voice/usage/:tenantId

## Live STT

WS /ws/voice/live/:tenantId

Cliente envia:
{"type":"audio","data":"BASE64_PCM","mimeType":"audio/pcm;rate=16000"}
{"type":"end"}

Servidor responde:
{"type":"transcript","text":"..."}

## Segurança

Se VOICE_SHARED_SECRET estiver configurado:
- HTTP exige X-AgendaZap-Secret
- WebSocket exige ?token=<secret>

Em produção isso deve ser integrado ao auth/RBAC do AgendaZap.
