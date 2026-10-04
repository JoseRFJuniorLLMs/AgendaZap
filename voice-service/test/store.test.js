import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { TenantVoiceStore, UsageStore } from '../src/store.js';

test('tenant config defaults and persists response mode', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agendazap-voice-'));
  const store = new TenantVoiceStore(dir);
  await store.init();

  const before = await store.get('demo');
  assert.equal(before.responseMode, 'mirror_customer');

  const after = await store.update('demo', {
    responseMode: 'text_and_audio',
    customVocabulary: ['AgendaZap', 'balayage', 'AgendaZap']
  });

  assert.equal(after.responseMode, 'text_and_audio');
  assert.deepEqual(after.customVocabulary, ['AgendaZap', 'balayage']);
});

test('usage store aggregates by tenant', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agendazap-usage-'));
  const usage = new UsageStore(dir);
  await usage.init();

  await usage.append({
    tenantId: 'demo',
    operation: 'tts',
    model: 'gemini-3.8-flash-lite-tts',
    ttsCharacters: 42,
    latencyMs: 120,
    ok: true
  });

  const summary = await usage.summary('demo');
  assert.equal(summary.requests, 1);
  assert.equal(summary.ttsCharacters, 42);
  assert.equal(summary.byOperation.tts, 1);
});