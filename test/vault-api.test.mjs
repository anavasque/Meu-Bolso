import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault} from '../dist/vault-crypto.mjs';
import {createSupabaseVaultAdapter} from '../dist/vault-api.mjs';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const {envelope}=await createVault({records:[{note:'minha nota confidencial',amount:12345}]},'uma senha longa para o cofre',alice);
const publicKey='sb_publishable_test1234567890',time='2026-11-15T12:00:00Z';
function setup({owner=alice,token='session-token',status=200,rows=null}={}){
 const calls=[];
 const adapter=createSupabaseVaultAdapter({url:'https://example.supabase.co',publicKey,getAccessToken:()=>token,fetchImpl:async(url,options)=>{
  calls.push({url,options});if(url.endsWith('/auth/v1/user'))return Response.json({id:owner});
  if(status!==200)return Response.json({message:'not exposed'},{status});
  return Response.json(rows??(options.method==='POST'?[{revision:1,updated_at:time}]:[{envelope,revision:1,updated_at:time}]));
 }});
 return {adapter,calls};
}
test('transport sends ciphertext only with account session and explicit optimistic revision',async()=>{
 const x=setup();const saved=await x.adapter.save(envelope,0);assert.equal(saved.revision,1);
 const body=x.calls[1].options.body;assert(!body.includes('minha nota confidencial'));assert.equal(JSON.parse(body).p_expected_revision,0);assert.equal(JSON.parse(body).p_envelope.ownerId,alice);
 assert.equal(x.calls[1].options.headers.Authorization,'Bearer session-token');assert.equal(x.calls[1].options.cache,'no-store');assert.equal(x.calls[1].options.credentials,'omit');
});
test('remote reads remain scoped to the logged-in owner',async()=>{
 const x=setup();assert.equal((await x.adapter.load()).envelope.ownerId,alice);assert(x.calls[1].url.includes('user_id=eq.'+alice));
 const y=setup({owner:bob});await assert.rejects(()=>y.adapter.load(),e=>e.code==='OWNER_MISMATCH');
});
test('missing sessions, privileged keys and plaintext payloads are refused',async()=>{
 const x=setup({token:null});await assert.rejects(()=>x.adapter.load(),e=>e.code==='AUTH_REQUIRED');assert.equal(x.calls.length,0);
 assert.throws(()=>createSupabaseVaultAdapter({url:'https://example.supabase.co',publicKey:'sb_secret_private',getAccessToken:()=>''}),e=>e.code==='INVALID_CONFIG');
 const y=setup();await assert.rejects(()=>y.adapter.save({records:[{amount:100}]},0));assert.equal(y.calls.length,0);
});
test('conflicts are surfaced without retries or overwrite',async()=>{
 const x=setup({status:409});await assert.rejects(()=>x.adapter.save(envelope,0),e=>e.code==='CONFLICT');assert.equal(x.calls.length,2);
});
test('ownership changes during login cannot upload the old account vault',async()=>{
 const x=setup({owner:bob});await assert.rejects(()=>x.adapter.save(envelope,0),e=>e.code==='OWNER_MISMATCH');assert.equal(x.calls.length,1);
});
test('empty and expired remote sessions never replace local state',async()=>{
 const x=setup({rows:[]});assert.equal(await x.adapter.load(),null);
 const y=setup({status:401});await assert.rejects(()=>y.adapter.load(),e=>e.code==='AUTH_REQUIRED');
});
