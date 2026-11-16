import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault,unlockVault,decryptVault,encryptVault,changePassword,recoverVault,validateEnvelope,lockVault} from '../dist/vault-crypto.mjs';
const owner='55555555-5555-4555-8555-555555555555',other='66666666-6666-4666-8666-666666666666';
const password='frase exclusiva de teste do cofre',replacement='outra frase exclusiva de teste';
const data={records:[{note:'descrição financeira particular',amount:999}],categories:[{name:'Pessoal'}]};
const fixture=await createVault(data,password,owner);
const clone=value=>JSON.parse(JSON.stringify(value));
test('vault stores only authenticated ciphertext and uses fresh random IVs',async()=>{
 validateEnvelope(fixture.envelope);const encoded=JSON.stringify(fixture.envelope);assert(!encoded.includes(data.records[0].note));assert(!encoded.includes('Pessoal'));assert(!encoded.includes(password));assert(!encoded.includes(fixture.recoveryKey));
 const session=await unlockVault(fixture.envelope,password,owner);assert.deepEqual(await decryptVault(fixture.envelope,session,owner),data);
 const update=await encryptVault(data,session,fixture.envelope);assert.notEqual(update.data.iv,fixture.envelope.data.iv);assert.notEqual(update.data.ciphertext,fixture.envelope.data.ciphertext);lockVault(session);
});
test('wrong passwords, ciphertext tampering, swapped roles and another account fail closed',async()=>{
 await assert.rejects(()=>unlockVault(fixture.envelope,'senha errada longa o bastante',owner),e=>e.code==='UNLOCK_FAILED');
 const corrupted=clone(fixture.envelope);corrupted.data.ciphertext=(corrupted.data.ciphertext[0]==='A'?'B':'A')+corrupted.data.ciphertext.slice(1);await assert.rejects(()=>unlockVault(corrupted,password,owner));
 const swapped=clone(fixture.envelope);[swapped.keyWrap,swapped.recoveryWrap]=[swapped.recoveryWrap,swapped.keyWrap];await assert.rejects(()=>unlockVault(swapped,password,owner));
 await assert.rejects(()=>unlockVault(fixture.envelope,password,other),e=>e.code==='OWNER_MISMATCH');
});
test('password rotation retains data and recovery without disclosing a key',async()=>{
 const session=await unlockVault(fixture.envelope,password,owner);assert.equal(JSON.stringify(session),'{}');const updated=await changePassword(fixture.envelope,session,replacement);
 await assert.rejects(()=>unlockVault(updated,password,owner));const reopened=await unlockVault(updated,replacement,owner);assert.deepEqual(await decryptVault(updated,reopened,owner),data);lockVault(session);lockVault(reopened);
 const recovered=await recoverVault(updated,fixture.recoveryKey,'terceira frase exclusiva de teste',owner);assert.deepEqual(await decryptVault(recovered.envelope,recovered.session,owner),data);lockVault(recovered.session);
 await assert.rejects(()=>recoverVault(updated,'A'.repeat(43),replacement,owner),e=>e.code==='RECOVERY_FAILED');
});
test('invalid metadata and plaintext fields are rejected before opening a vault',()=>{
 for(const change of [e=>e.records=[],e=>e.kdf.iterations=1,e=>e.kdf.iterations=2000001,e=>e.data.iv='invalid',e=>e.keyWrap.ciphertext='AA==']){const envelope=clone(fixture.envelope);change(envelope);assert.throws(()=>validateEnvelope(envelope));}
});
test('locking revokes sessions and rejects results from operations already in flight',async()=>{
 for(const operation of ['read','write','password']){
  const session=await unlockVault(fixture.envelope,password,owner);
  const pending=operation==='read'?decryptVault(fixture.envelope,session,owner):operation==='write'?encryptVault(data,session,fixture.envelope):changePassword(fixture.envelope,session,replacement);
  lockVault(session);await assert.rejects(()=>pending,e=>e.code==='SESSION_INVALID');await assert.rejects(()=>decryptVault(fixture.envelope,session,owner),e=>e.code==='SESSION_INVALID');
 }
});
test('invalid passwords and unsupported JSON cannot create a vault',async()=>{
 await assert.rejects(()=>createVault(data,'curta',owner),e=>e.code==='INVALID_PASSWORD');const cycle={};cycle.self=cycle;await assert.rejects(()=>createVault(cycle,password,owner),e=>e.code==='INVALID_DATA');
});
