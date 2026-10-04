import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import { DEFAULT_VOICE_CONFIG, normalizeTenantId, sanitizeVoiceConfig } from './config.js';

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function atomicWriteJson(file, value) {
  const tmp = file + '.' + process.pid + '.' + randomUUID() + '.tmp';
  try{await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');await fs.rename(tmp, file);}finally{await fs.unlink(tmp).catch(()=>{});}
}

export class TenantVoiceStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'tenant-voice-config.json');
    this.tail=Promise.resolve();
  }

  async init() { await ensureDir(this.dataDir); }

  async get(tenantId) {
    tenantId = normalizeTenantId(tenantId);
    const all = await readJson(this.file, {});
    return { ...DEFAULT_VOICE_CONFIG, ...(all[tenantId] || {}) };
  }

  update(tenantId, patch) {
    const run=this.tail.then(()=>this.writeUpdate(tenantId,patch));this.tail=run.catch(()=>{});return run;
  }
  async writeUpdate(tenantId, patch) {
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
    this.tail=Promise.resolve();
  }

  async init() { await ensureDir(this.dataDir); }

  append(event) {
    for(const key of ['audioBytes','audioDurationMs','ttsCharacters','latencyMs'])if(event[key]!==undefined&&(!Number.isFinite(event[key])||event[key]<0))return Promise.reject(new Error(`${key} inválido`));
    const row = { occurredAt: new Date().toISOString(), ...event };
    const run=this.tail.then(()=>fs.appendFile(this.file,JSON.stringify(row)+'\n','utf8'));this.tail=run.catch(()=>{});return run;
  }

  async summary(tenantId) {
    await this.tail;
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
