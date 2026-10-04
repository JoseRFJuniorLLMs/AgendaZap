import path from 'node:path';

export const env = {
  port: Number.parseInt(process.env.VOICE_PORT || '3001', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  sharedSecret: process.env.VOICE_SHARED_SECRET || '',
  dataDir: process.env.VOICE_DATA_DIR || path.resolve('data'),
  maxAudioBytes: Number.parseInt(process.env.VOICE_MAX_AUDIO_BYTES || String(20 * 1024 * 1024), 10),
  maxTtsChars: Number.parseInt(process.env.VOICE_MAX_TTS_CHARS || '4000', 10),
  transcribeModel: process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe',
  transcribeLiveModel: process.env.GEMINI_TRANSCRIBE_LIVE_MODEL || 'gemini-3.5-transcribe-live',
  ttsModel: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
  ttsPremiumModel: process.env.GEMINI_TTS_PREMIUM_MODEL || 'gemini-3.8-flash-tts',
  liveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live'
};

export const DEFAULT_VOICE_CONFIG = Object.freeze({
  responseMode: 'mirror_customer',
  languageCodes: ['pt-BR'],
  customVocabulary: ['AgendaZap', 'balayage', 'barboterapia', 'botox capilar', 'design de sobrancelha', 'alongamento em gel'],
  transcriptionMode: 'smart',
  voice: 'Kore',
  style: 'Amigável, objetiva, profissional e natural em português do Brasil.',
  usePremiumTts: false,
  retainAudio: false,
  transcribeModel: env.transcribeModel,
  transcribeLiveModel: env.transcribeLiveModel,
  ttsModel: env.ttsModel,
  ttsPremiumModel: env.ttsPremiumModel,
  liveModel: env.liveModel
});

export function normalizeTenantId(value) {
  const tenantId = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)) throw new Error('tenant_id inválido');
  return tenantId;
}

export function sanitizeVoiceConfig(input = {}) {
  const modes = new Set(['text_only', 'text_and_audio', 'mirror_customer', 'audio_only']);
  const transcriptionModes = new Set(['smart', 'verbatim']);
  const result = {};

  if (input.responseMode !== undefined) {
    if (!modes.has(input.responseMode)) throw new Error('responseMode inválido');
    result.responseMode = input.responseMode;
  }

  if (input.languageCodes !== undefined) {
    if (!Array.isArray(input.languageCodes) || input.languageCodes.length > 8) throw new Error('languageCodes inválido');
    result.languageCodes = input.languageCodes.map(String).map(v => v.trim()).filter(Boolean);
  }

  if (input.customVocabulary !== undefined) {
    if (!Array.isArray(input.customVocabulary)) throw new Error('customVocabulary inválido');
    const terms = [...new Set(input.customVocabulary.map(String).map(v => v.trim()).filter(Boolean))];
    if (terms.length > 1000) throw new Error('customVocabulary excede 1000 termos');
    result.customVocabulary = terms;
  }

  if (input.transcriptionMode !== undefined) {
    const mode = String(input.transcriptionMode).toLowerCase();
    if (!transcriptionModes.has(mode)) throw new Error('transcriptionMode inválido');
    result.transcriptionMode = mode;
  }

  for (const key of ['voice', 'style']) {
    if (input[key] !== undefined) result[key] = String(input[key]).trim().slice(0, 500);
  }

  for (const key of ['usePremiumTts', 'retainAudio']) {
    if (input[key] !== undefined) result[key] = Boolean(input[key]);
  }

  return result;
}