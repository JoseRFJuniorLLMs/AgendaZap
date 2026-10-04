# SPEC-0014 — Voice AI

**Status:** Draft  
**Versão:** 0.1.0  
**Produto:** AgendaZap

## 1. Objetivo

Adicionar uma camada de voz ao AgendaZap sem retirar do backend determinístico a autoridade sobre agenda, preço, pagamento e regras comerciais.

O sistema deve aceitar áudio de clientes, converter fala em texto, executar o fluxo normal de intenção/tools e, quando configurado, responder também em áudio.

## 2. Arquitetura

```text
CLIENTE
   |
   +--> Texto ----------------------+
   |                                |
   +--> Áudio                       |
          |                         |
          v                         |
 gemini-3.5-transcribe-live         |
          |                         |
          v                         |
      Canonical Text ---------------+
                  |
                  v
          AgendaZap Intent Layer
                  |
                  v
             Backend Tools
                  |
        +---------+----------+
        |                    |
        v                    v
    Agenda/CRM         Payments/Revenue
        |                    |
        +---------+----------+
                  |
                  v
       Canonical Response Text
             |            |
             |            v
             |   gemini-3.8-flash-lite-tts
             |            |
             v            v
           Texto        Áudio
```

## 3. Modelos

### Speech-to-Text em tempo real
`gemini-3.5-transcribe-live`

Uso:
- áudio contínuo;
- baixa latência;
- transcrição incremental;
- detecção automática de idioma;
- custom vocabulary;
- smart transcription quando aplicável.

### Speech-to-Text de arquivo
`gemini-3.5-transcribe`

Uso:
- mensagens de áudio recebidas como arquivo;
- transcrição assíncrona/não-live.

### Text-to-Speech padrão
`gemini-3.8-flash-lite-tts`

Uso:
- resposta rápida;
- custo menor;
- volume alto;
- padrão do plano que incluir voz.

### Text-to-Speech premium
`gemini-3.8-flash-tts`

Uso:
- voz de maior fidelidade;
- personalidade de marca;
- casos premium.

### Conversação voz-a-voz
`gemini-3.8-live`

Uso:
- ligação;
- recepcionista por voz;
- diálogo em tempo real;
- function calling durante sessão live.

Não é obrigatório para o primeiro MVP de voz via WhatsApp.

## 4. Modos de resposta por tenant

```text
text_only
text_and_audio
mirror_customer
audio_only
```

### text_only
Sempre responde em texto.

### text_and_audio
Sempre gera texto canônico e áudio correspondente.

### mirror_customer
Cliente escreve -> responde texto.

Cliente envia áudio -> responde texto + áudio.

### audio_only
Permitido apenas quando explicitamente configurado. O texto canônico continua sendo produzido e registrado internamente.

## 5. Regra canônica

Toda resposta nasce primeiro como **Canonical Response Text**.

O TTS apenas vocaliza esse texto.

Isso garante que:
- áudio e texto tenham o mesmo conteúdo;
- TTS não decida preço;
- TTS não invente horários;
- auditoria seja baseada em texto;
- fallback para texto seja trivial.

## 6. Fluxo de áudio recebido

```text
WhatsApp Audio
      |
      v
Media Fetch
      |
      v
Audio Normalization
      |
      v
Transcription
      |
      v
Canonical Text
      |
      v
Intent + Entities
      |
      v
Validated Tool Call
      |
      v
Canonical Response Text
```

## 7. Custom Vocabulary

Cada tenant pode manter vocabulário próprio.

Exemplos:
- balayage;
- barboterapia;
- botox capilar;
- design de sobrancelha;
- alongamento em gel;
- nomes de profissionais;
- nomes comerciais;
- nomes de serviços.

Limites do provedor devem ser respeitados.

O sistema deve priorizar termos realmente relevantes em vez de enviar listas gigantes sem necessidade.

## 8. Segurança

A transcrição é entrada não confiável.

Regras:
- áudio não concede permissões;
- texto transcrito passa pela mesma validação de qualquer mensagem;
- prompt injection falado não altera RBAC;
- tenant nunca vem exclusivamente do conteúdo transcrito;
- nenhuma operação financeira é autorizada somente pelo modelo;
- function calling precisa de schema e allowlist.

## 9. Privacidade

Padrão recomendado:
- armazenar transcrição quando necessária ao histórico;
- não armazenar áudio bruto indefinidamente;
- retenção de áudio configurável;
- consentimento e política de privacidade devem informar uso de processamento de voz;
- evitar enviar áudio/PII desnecessário a modelos externos.

## 10. Fallback

### Falha de STT
- informar que o áudio não pôde ser entendido;
- oferecer texto;
- permitir reenvio.

### Falha de TTS
- enviar texto normalmente;
- não bloquear booking.

### Falha do modelo Live
- cair para STT + fluxo textual determinístico.

### Falha total de IA
- menu/WhatsApp Flow/página pública continuam disponíveis.

## 11. Metering

Registrar por tenant:
- segundos/minutos transcritos;
- quantidade de áudios;
- caracteres/tokens sintetizados;
- quantidade de respostas faladas;
- custo STT;
- custo TTS;
- custo Live;
- latência;
- taxa de erro.

## 12. UX WhatsApp

Quando o cliente envia áudio:

```text
Cliente:
🎙️ áudio 0:37

AgendaZap:
💬 "Tenho horários amanhã às 14h, 15h30 e 17h."

🔊 resposta em áudio
```

No modo `mirror_customer`, isso vira o comportamento padrão.

## 13. Planos

### Fundador
- texto;
- voz não incluída por padrão.

### Profissional — R$ 249/mês
- texto;
- franquia limitada de STT/TTS;
- mirror_customer opcional.

### Pro — R$ 397/mês
- voz ampliada;
- TTS premium opcional;
- métricas de voz;
- personalização de voz;
- futuro agente Live.

Limites finais dependem do custo real por tenant.

## 14. API interna

Interfaces sugeridas:

```text
transcribe_audio()
transcribe_stream()
synthesize_speech()
create_live_session()
get_voice_usage()
```

Adapters não devem vazar detalhes do provedor para o domínio.

## 15. Eventos

- `voice.input_received`
- `voice.transcription_started`
- `voice.transcription_completed`
- `voice.transcription_failed`
- `voice.tts_started`
- `voice.tts_completed`
- `voice.tts_failed`
- `voice.live_session_started`
- `voice.live_session_closed`

## 16. Observabilidade

Correlacionar:
- tenant_id;
- conversation_id;
- message_id;
- provider;
- model;
- latency_ms;
- audio_duration_ms;
- estimated_cost.

Não registrar conteúdo de áudio em logs técnicos.

## 17. Definition of Done

P0 de voz é considerado concluído quando:

1. áudio do cliente é recebido;
2. áudio é transcrito;
3. intenção é processada;
4. backend consulta agenda real;
5. resposta canônica é produzida;
6. texto é enviado;
7. TTS gera áudio quando configurado;
8. falha de TTS não impede resposta;
9. custo de voz é medido;
10. modo de resposta é configurável por tenant.
