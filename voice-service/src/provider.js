import { GoogleGenAI } from '@google/genai';

export class GeminiVoiceProvider {
  constructor({ apiKey }) {
    this.apiKey = apiKey;
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  get configured() { return Boolean(this.client && this.apiKey); }

  requireConfigured() {
    if (!this.configured) {
      const error = new Error('GEMINI_API_KEY não configurada');
      error.statusCode = 503;
      throw error;
    }
  }

  async transcribeFile({ filePath, mimeType, config }) {
    this.requireConfigured();
    let uploaded;

    try {
      uploaded = await this.client.files.upload({
        file: filePath,
        config: { mime_type: mimeType }
      });

      const transcriptionConfig = {
        language_codes: config.languageCodes || [],
        mode: config.transcriptionMode || 'smart'
      };

      if (config.customVocabulary?.length) {
        transcriptionConfig.custom_vocabulary = config.customVocabulary;
      }

      const interaction = await this.client.interactions.create({
        model: config.transcribeModel,
        input: [{
          type: 'audio',
          uri: uploaded.uri,
          mime_type: uploaded.mimeType || mimeType
        }],
        generation_config: {
          transcription_config: transcriptionConfig
        }
      });

      return {
        text: interaction.output_text ?? interaction.outputText ?? '',
        model: config.transcribeModel
      };
    } finally {
      if (uploaded?.name) {
        try { await this.client.files.delete({ name: uploaded.name }); }
        catch {}
      }
    }
  }

  async synthesizeSpeech({ text, config, premium = false, style, voice }) {
    this.requireConfigured();

    const model = premium || config.usePremiumTts ? config.ttsPremiumModel : config.ttsModel;

    const interaction = await this.client.interactions.create({
      model,
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text,
          annotations: [{
            type: 'speech_metadata',
            style: style || config.style || ''
          }]
        }]
      }],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [
          { voice: voice || config.voice || 'Kore' }
        ]
      }
    });

    if (!interaction.output_audio?.data) {
      const error = new Error('Gemini TTS não retornou áudio');
      error.statusCode = 502;
      throw error;
    }

    return {
      audio: Buffer.from(interaction.output_audio.data, 'base64'),
      mimeType: interaction.output_audio.mime_type || interaction.output_audio.mimeType || 'audio/wav',
      model
    };
  }

  liveWebSocketUrl() {
    this.requireConfigured();
    return 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(this.apiKey);
  }

  liveTranscribeSetup(config) {
    const inputAudioTranscription = {
      languageCodes: config.languageCodes || [],
      mode: (config.transcriptionMode || 'smart').toUpperCase()
    };

    if (config.customVocabulary?.length) inputAudioTranscription.customVocabulary = config.customVocabulary;

    return {
      setup: {
        model: 'models/' + config.transcribeLiveModel,
        generationConfig: { responseModalities: ['TEXT'] },
        inputAudioTranscription
      }
    };
  }
}