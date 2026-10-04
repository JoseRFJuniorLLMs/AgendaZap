import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encryptSnapshot,decryptSnapshot} from '../src/backup.js';
test('encrypted backup restores state and rejects corruption/wrong key',()=>{
  const key=randomBytes(32),state={tenants:{test:{name:'Teste'}},accounts:{},sessions:{},receipts:{}};
  const bytes=encryptSnapshot(state,key);assert.deepEqual(decryptSnapshot(bytes,key).state,state);
  assert(!bytes.includes(Buffer.from('Teste')));assert.throws(()=>decryptSnapshot(bytes,randomBytes(32)));
  const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;assert.throws(()=>decryptSnapshot(corrupt,key));
});
