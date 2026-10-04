import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {TenantVoiceStore,UsageStore} from '../src/store.js';

test('concurrent tenant updates preserve every tenant and every distinct field',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'voice-race-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=new TenantVoiceStore(dir);await store.init();
  await Promise.all(Array.from({length:30},(_,i)=>store.update('tenant'+i,{style:'Style '+i})));
  for(let i=0;i<30;i++)assert.equal((await store.get('tenant'+i)).style,'Style '+i);
  await Promise.all([store.update('same',{style:'New style'}),store.update('same',{voice:'Kore'})]);const same=await store.get('same');assert.equal(same.style,'New style');assert.equal(same.voice,'Kore');
});
test('usage rejects negative and non-finite meter values and preserves parallel appends',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'voice-usage-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=new UsageStore(dir);await store.init();
  await assert.rejects(store.append({tenantId:'t',audioDurationMs:-1}));await assert.rejects(store.append({tenantId:'t',ttsCharacters:NaN}));
  await Promise.all(Array.from({length:30},()=>store.append({tenantId:'t',audioDurationMs:1000,operation:'live',model:'local',ok:false})));
  const summary=await store.summary('t');assert.equal(summary.requests,30);assert.equal(summary.errors,30);assert.equal(summary.audioDurationMs,30000);
});
test('invalid numeric environment fails startup instead of silently disabling limits',async()=>{
  const child=spawn(process.execPath,['--input-type=module','-e',`import '${new URL('../src/config.js',import.meta.url).href}'`],{env:{...process.env,VOICE_MAX_AUDIO_BYTES:'NaN'},windowsHide:true,stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',b=>errors+=b);const code=await new Promise(r=>child.once('exit',r));assert.notEqual(code,0);assert.match(errors,/VOICE_MAX_AUDIO_BYTES/);
});
test('real WebSocket malformed frames and premature messages do not crash voice service',async t=>{
  const {default:WebSocket,WebSocketServer}=await import('ws');
  const upstream=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>upstream.once('listening',r));upstream.on('connection',socket=>socket.on('error',()=>{}));
  const dir=await fs.mkdtemp(path.join(fileURLToPath(new URL('../',import.meta.url)),'.wire-'));
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'voice-wire-data-'));let child;
  t.after(async()=>{if(child&&child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}for(const c of upstream.clients)c.terminate();await new Promise(r=>upstream.close(r));await fs.rm(dir,{recursive:true,force:true});await fs.rm(data,{recursive:true,force:true});});
  for(const name of ['config.js','store.js','audio.js'])await fs.copyFile(new URL('../src/'+name,import.meta.url),path.join(dir,name));
  await fs.writeFile(path.join(dir,'provider.js'),`export class GeminiVoiceProvider {get configured(){return true;}liveWebSocketUrl(){return 'ws://127.0.0.1:${upstream.address().port}';}liveTranscribeSetup(){return {setup:{}};}async synthesizeSpeech(){throw Object.assign(new Error('PRIVATE PROVIDER PAYLOAD'),{status:429});}}`);
  await fs.copyFile(new URL('../src/server.js',import.meta.url),path.join(dir,'server.js'));
  const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,VOICE_PORT:String(port),VOICE_DATA_DIR:data,VOICE_SHARED_SECRET:'local-test-secret'},windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('voice startup: '+stderr)),10000);child.once('error',reject);child.stdout.on('data',()=>{if(stdout.includes('agendazap-voice')){clearTimeout(timer);resolve();}});});
  const url=`http://127.0.0.1:${port}`;
  for(let i=0;i<130;i++)assert.equal((await fetch(url+'/api/voice/config/audit')).status,401);
  const headers={'x-agendazap-secret':'local-test-secret','x-agendazap-tenant':'audit'};
  assert.equal((await fetch(url+'/api/voice/config/audit',{headers})).status,200);
  assert.equal((await fetch(url+'/api/voice/config/other',{headers})).status,403);
  let response=await fetch(url+'/api/voice/tts/audit',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{"text":"Hello"}'});assert.equal(response.status,429);assert(!(await response.text()).includes('PRIVATE'));
  response=await fetch(url+'/api/voice/respond/audit',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{"canonicalText":"Hello","customerInputType":"audio"}'});assert.equal(response.status,200);assert.equal((await response.json()).audioError,'tts_unavailable');
  const client=new WebSocket(`ws://127.0.0.1:${port}/ws/voice/live/audit`,{headers});client.on('error',()=>{});await new Promise((r,reject)=>{client.once('open',r);client.once('error',reject);});client.send('{"type":"audio","data":"AA=="}');const closed=new Promise(r=>client.once('close',r));client._socket.write(Buffer.from([0xc1,0x80,0,0,0,0]));await closed;
  assert.equal(child.exitCode,null,stderr);assert.equal((await fetch(url+'/healthz')).status,200);
  await new Promise(r=>setTimeout(r,100));const usage=await (await fetch(url+'/api/voice/usage/audit',{headers})).json();assert(usage.errors>=3);assert.equal(usage.errors,usage.requests);
});
