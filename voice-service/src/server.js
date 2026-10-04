import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import multer from 'multer';
import WebSocket, { WebSocketServer } from 'ws';

import { env, normalizeTenantId } from './config.js';
import { GeminiVoiceProvider } from './provider.js';
import { TenantVoiceStore, UsageStore } from './store.js';
import {audioDurationMs} from './audio.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true,maxPayload:env.maxWsBytes });
const provider = new GeminiVoiceProvider({ apiKey: env.geminiApiKey });
const tenantStore = new TenantVoiceStore(env.dataDir);
const usageStore = new UsageStore(env.dataDir);
const uploadDir = path.join(os.tmpdir(), 'agendazap-voice');

await fs.mkdir(uploadDir, { recursive: true });
await tenantStore.init();
await usageStore.init();

app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(express.json({ limit: '256kb' }));

function secretsEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

function apiAuth(req, res, next) {
  if(req.path==='/health')return next();
  if (env.sharedSecret && !secretsEqual(req.get('x-agendazap-secret'), env.sharedSecret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const authorized=req.get('x-agendazap-tenant');
  const target=req.path.match(/^\/(?:config|usage|transcribe|tts|respond)\/([a-zA-Z0-9_-]{1,64})$/)?.[1];
  if(authorized&&authorized!==target)return res.status(403).json({error:'tenant_mismatch'});
  next();
}

const rateState = new Map();
function simpleRateLimit(req, res, next) {
  if(req.path==='/health')return next();
  const key = req.ip || 'unknown';
  const now = Date.now();
  const current = rateState.get(key) || { windowStarted: now, count: 0 };

  if (now - current.windowStarted > 60_000) {
    current.windowStarted = now;
    current.count = 0;
  }

  current.count += 1;
  if(!rateState.has(key)&&rateState.size>=10000)rateState.delete(rateState.keys().next().value);rateState.set(key, current);

  if (current.count > 120) return res.status(429).json({ error: 'rate_limit' });
  next();
}

app.use('/api/voice', apiAuth,simpleRateLimit);

app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    provider: 'gemini',
    configured: provider.configured,
    models: {
      transcribe: env.transcribeModel,
      transcribeLive: env.transcribeLiveModel,
      tts: env.ttsModel,
      ttsPremium: env.ttsPremiumModel,
      live: env.liveModel
    }
  });
});

app.get('/api/voice/health', (req, res) => {
  res.json({
    ok: true,
    provider: 'gemini',
    configured: provider.configured,
    transcribeModel: env.transcribeModel,
    ttsModel: env.ttsModel,
    ttsPremiumModel: env.ttsPremiumModel
  });
});

app.get('/api/voice/config/:tenantId', async (req, res, next) => {
  try { res.json(await tenantStore.get(req.params.tenantId)); }
  catch (error) { next(error); }
});

app.put('/api/voice/config/:tenantId', async (req, res, next) => {
  try { res.json(await tenantStore.update(req.params.tenantId, req.body || {})); }
  catch (error) { next(error); }
});

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: env.maxAudioBytes, files: 1 }
});

app.post('/api/voice/transcribe/:tenantId', upload.single('audio'), async (req, res, next) => {
  const started = Date.now();
  let tenantId;

  try {
    tenantId = normalizeTenantId(req.params.tenantId);
    if (!req.file) return res.status(400).json({ error: 'audio_required' });

    const config = await tenantStore.get(tenantId);
    const durationMs=await audioDurationMs(req.file.path);
    const result = await provider.transcribeFile({
      filePath: req.file.path,
      mimeType: req.file.mimetype || 'application/octet-stream',
      config
    });

    const latencyMs = Date.now() - started;
    await usageStore.append({
      tenantId,
      operation: 'transcribe_file',
      model: result.model,
      audioBytes: req.file.size,
      audioDurationMs: durationMs,
      latencyMs,
      ok: true
    });

    res.json({ ...result, latencyMs });
  } catch (error) {
    if (tenantId) {
      await usageStore.append({
        tenantId,
        operation: 'transcribe_file',
        model: env.transcribeModel,
        latencyMs: Date.now() - started,
        ok: false
      }).catch(() => {});
    }
    next(error);
  } finally {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
  }
});

app.post('/api/voice/tts/:tenantId', async (req, res, next) => {
  const started = Date.now();
  let tenantId;

  try {
    tenantId = normalizeTenantId(req.params.tenantId);
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text_required' });
    if (text.length > env.maxTtsChars) return res.status(413).json({ error: 'text_too_long' });

    const config = await tenantStore.get(tenantId);
    const result = await provider.synthesizeSpeech({
      text,
      config,
      premium: Boolean(req.body?.premium),
      style: req.body?.style,
      voice: req.body?.voice
    });

    const latencyMs = Date.now() - started;
    await usageStore.append({
      tenantId,
      operation: 'tts',
      model: result.model,
      ttsCharacters: text.length,
      latencyMs,
      ok: true
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.audio.length);
    res.setHeader('X-AgendaZap-Model', result.model);
    res.setHeader('X-AgendaZap-Latency-Ms', String(latencyMs));
    res.send(result.audio);
  } catch (error) {
    if (tenantId) {
      await usageStore.append({
        tenantId,
        operation: 'tts',
        model: env.ttsModel,
        ttsCharacters: String(req.body?.text || '').length,
        latencyMs: Date.now() - started,
        ok: false
      }).catch(() => {});
    }
    next(error);
  }
});

app.post('/api/voice/respond/:tenantId', async (req, res, next) => {
  const started = Date.now();

  try {
    const tenantId = normalizeTenantId(req.params.tenantId);
    const canonicalText = String(req.body?.canonicalText || '').trim();
    const customerInputType = req.body?.customerInputType === 'audio' ? 'audio' : 'text';

    if (!canonicalText) return res.status(400).json({ error: 'canonical_text_required' });
    if (canonicalText.length > env.maxTtsChars) return res.status(413).json({ error: 'text_too_long' });

    const config = await tenantStore.get(tenantId);
    const shouldSpeak =
      config.responseMode === 'text_and_audio' ||
      config.responseMode === 'audio_only' ||
      (config.responseMode === 'mirror_customer' && customerInputType === 'audio');

    const payload = {
      mode: config.responseMode,
      canonicalText,
      text: config.responseMode === 'audio_only' ? null : canonicalText,
      audio: null,
      audioMimeType: null,
      audioModel: null
    };

    if (shouldSpeak) {
      try {
        const audio = await provider.synthesizeSpeech({ text: canonicalText, config });
        payload.audio = audio.audio.toString('base64');
        payload.audioMimeType = audio.mimeType;
        payload.audioModel = audio.model;

        await usageStore.append({
          tenantId,
          operation: 'respond_tts',
          model: audio.model,
          ttsCharacters: canonicalText.length,
          latencyMs: Date.now() - started,
          ok: true
        });
      } catch (error) {
        payload.audioError = 'tts_unavailable';
        await usageStore.append({tenantId,operation:'respond_tts',model:config.ttsModel,ttsCharacters:canonicalText.length,latencyMs:Date.now()-started,ok:false}).catch(()=>{});
        if (config.responseMode === 'audio_only') payload.text = canonicalText;
      }
    }

    res.json(payload);
  } catch (error) { next(error); }
});

app.get('/api/voice/usage/:tenantId', async (req, res, next) => {
  try { res.json(await usageStore.summary(req.params.tenantId)); }
  catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  const reported=Number(error.statusCode||error.status);const status=error.code==='LIMIT_FILE_SIZE'?413:reported>=400&&reported<=599?reported:400;
  res.status(status).json({
    error: error.code || 'voice_error',
    message: status===429?'Limite do provedor de voz atingido. Tente novamente.':status>=500?'Serviço de voz temporariamente indisponível.':'Não foi possível processar a solicitação de voz.'
  });
});

server.on('upgrade', async (req, socket, head) => {
  socket.on('error',()=>socket.destroy());
  try {
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/ws\/voice\/live\/([a-zA-Z0-9_-]{1,64})$/);
    if (!match) return socket.destroy();

    if (env.sharedSecret && !secretsEqual(req.headers['x-agendazap-secret']||url.searchParams.get('token'), env.sharedSecret)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }

    const tenantId = normalizeTenantId(match[1]);
    if(req.headers['x-agendazap-tenant']&&req.headers['x-agendazap-tenant']!==tenantId)return socket.destroy();
    const config = await tenantStore.get(tenantId);

    wss.handleUpgrade(req, socket, head, client => {
      wss.emit('connection', client, req, { tenantId, config });
    });
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (client, req, context) => {
  const { tenantId, config } = context;
  const started = Date.now();
  let failed=false,ready=false,metered=false;
  const meter=()=>{if(metered)return;metered=true;usageStore.append({tenantId,operation:'transcribe_live',model:config.transcribeLiveModel,audioDurationMs:Date.now()-started,latencyMs:Date.now()-started,ok:ready&&!failed}).catch(()=>{});};
  client.on('error',()=>{failed=true;client.terminate();});
  client.on('close',meter);

  if (!provider.configured) {
    failed=true;
    client.close(1011, 'GEMINI_API_KEY não configurada');
    return;
  }

  const upstream = new WebSocket(provider.liveWebSocketUrl(),{maxPayload:env.maxWsBytes});

  upstream.on('open', () => {
    if(client.readyState!==WebSocket.OPEN){upstream.close();return;}
    upstream.send(JSON.stringify(provider.liveTranscribeSetup(config)));
    client.send(JSON.stringify({ type: 'ready', model: config.transcribeLiveModel }));
  });

  client.on('message', raw => {
    try {
      if(upstream.readyState!==WebSocket.OPEN){if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify({type:'error',error:'upstream_not_ready'}));return;}
      const message = JSON.parse(raw.toString());

      if (message.type === 'audio' && typeof message.data === 'string') {
        upstream.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: message.data,
              mimeType: message.mimeType || 'audio/pcm;rate=16000'
            }
          }
        }));
      } else if (message.type === 'end') {
        upstream.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      } else if (message.type === 'activity_start') {
        upstream.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
      } else if (message.type === 'activity_end') {
        upstream.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      }
    } catch {
      if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify({ type: 'error', error: 'invalid_message' }));
    }
  });

  upstream.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      const interim = message.serverContent?.interimInputTranscription?.text;
      const finalTranscript = message.serverContent?.inputTranscription?.text;

      if (interim) {
        client.send(JSON.stringify({
          type: 'transcript',
          final: false,
          text: interim
        }));
      }

      if (finalTranscript) {
        client.send(JSON.stringify({
          type: 'transcript',
          final: true,
          text: finalTranscript
        }));
      }

      if (message.setupComplete) {
        ready=true;
        client.send(JSON.stringify({ type: 'setup_complete' }));
      }
    } catch {}
  });

  upstream.on('error', () => {
    failed=true;
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'error', error: 'upstream_error' }));
  });

  upstream.on('close', code => {
    if(code!==1000)failed=true;
    if (client.readyState === WebSocket.OPEN) client.close(1000, 'upstream_closed');

    meter();
  });

  client.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close();
  });
});

server.listen(env.port, '0.0.0.0', () => {
  console.log(JSON.stringify({
    service: 'agendazap-voice',
    port: env.port,
    geminiConfigured: provider.configured
  }));
});
