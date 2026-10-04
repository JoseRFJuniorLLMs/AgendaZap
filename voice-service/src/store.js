import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_VOICE_CONFIG, normalizeTenantId, sanitizeVoiceConfig } from './config.js';

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function atomicWriteJson(file, value) {
  const tmp = file + '.' + process.pid + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, file);
}

export class TenantVoiceStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'tenant-voice-config.json');
  }

  async init() { await ensureDir(this.dataDir); }

  async get(tenantId) {
    tenantId = normalizeTenantId(tenantId);
    const all = await readJson(this.file, {});
    return { ...DEFAULT_VOICE_CONFIG, ...(all[tenantId] || {}) };
  }

  async update(tenantId, patch) {
    tenantId = normalizeTenantId(tenantId);
    const clean = sanitizeVoiceConfig(patch);
    const all = await readJson(this.file, {});
    all[tenantId] = { ...(all[tenantId] || {}), ...clean, updatedAt: new Date().toISOString() };
    await atomicWriteJson(this.file, all);
    return this.get(tenantId);
  }
}

function emptySummary(tenantId) {
  return { tenantId, requests: 0, errors: 0, audioBytes: 0, audioDurationMs: 0, ttsCharacters: 0, latencyMs: 0, byOperation: {}, byModel: {} };
}

export class UsageStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'voice-usage.ndjson');
  }

  async init() { await ensureDir(this.dataDir); }

  async append(event) {
    const row = { occurredAt: new Date().toISOString(), ...event };
    await fs.appendFile(this.file, JSON.stringify(row) + '\n', 'utf8');
  }

  async summary(tenantId) {
    tenantId = normalizeTenantId(tenantId);
    let text = '';
    try { text = await fs.readFile(this.file, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return emptySummary(tenantId); throw error; }

    const rows = text.split('\n').filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .filter(row => row.tenantId === tenantId);

    return rows.reduce((acc, row) => {
      acc.requests += 1;
      acc.audioBytes += Number(row.audioBytes || 0);
      acc.audioDurationMs += Number(row.audioDurationMs || 0);
      acc.ttsCharacters += Number(row.ttsCharacters || 0);
      acc.latencyMs += Number(row.latencyMs || 0);
      acc.byOperation[row.operation] = (acc.byOperation[row.operation] || 0) + 1;
      acc.byModel[row.model] = (acc.byModel[row.model] || 0) + 1;
      if (row.ok === false) acc.errors += 1;
      return acc;
    }, emptySummary(tenantId));
  }
}