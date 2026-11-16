import test from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser} from './helpers/database.mjs';
import {createVault,encryptVault} from '../dist/vault-crypto.mjs';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const financial={version:1,records:[{amount:12345,note:'segredo-financeiro',category:'salary'}]};
test('Postgres migration enforces encrypted owner isolation and safe version updates',async t=>{
 const db=await database();
 try{
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[alice,bob]);
  const a=await createVault(financial,'uma senha longa de teste',alice);
  const b=await createVault({records:[]},'outra senha longa de teste',bob);
  const save=(revision,envelope)=>db.query('SELECT * FROM public.save_encrypted_vault($1,$2::jsonb)',[revision,JSON.stringify(envelope)]);
  await t.test('anonymous callers cannot read or write vaults',async()=>{
   await asUser(db,'anon');await assert.rejects(()=>db.query('SELECT * FROM public.encrypted_vaults'),e=>e.code==='42501');await assert.rejects(()=>save(0,a.envelope),e=>e.code==='42501');
  });
  await t.test('creation derives the owner from the authenticated account',async()=>{
   await asUser(db,'authenticated',alice);assert.equal((await save(0,a.envelope)).rows[0].revision,1);
   await assert.rejects(()=>save(0,b.envelope),e=>e.code==='22023');
  });
  await t.test('users cannot see another account or bypass the write procedure',async()=>{
   await asUser(db,'authenticated',bob);assert.equal((await db.query('SELECT * FROM public.encrypted_vaults')).rows.length,0);
   await save(0,b.envelope);const rows=(await db.query('SELECT * FROM public.encrypted_vaults')).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,bob);
   await assert.rejects(()=>db.query('UPDATE public.encrypted_vaults SET revision=100'),e=>e.code==='42501');
   await assert.rejects(()=>db.query('DELETE FROM public.encrypted_vaults'),e=>e.code==='42501');
  });
  await t.test('stale saves conflict instead of overwriting newer ciphertext',async()=>{
   await asUser(db,'authenticated',alice);const updated=await encryptVault({records:[{amount:500}]},a.session,a.envelope);assert.equal((await save(1,updated)).rows[0].revision,2);
   await assert.rejects(()=>save(1,a.envelope),e=>e.code==='PT409');await assert.rejects(()=>save(0,a.envelope),e=>e.code==='PT409');
   assert.equal((await db.query('SELECT revision FROM public.encrypted_vaults')).rows[0].revision,2);
  });
  await t.test('plaintext fields and malformed cryptographic headers cannot enter the vault table',async()=>{
   for(const invalid of [{...a.envelope,records:financial.records},{...a.envelope,keyWrap:null},{...a.envelope,kdf:{...a.envelope.kdf,iterations:1}}])await assert.rejects(()=>save(2,invalid),e=>e.code==='23514');
   assert.equal((await db.query('SELECT revision FROM public.encrypted_vaults')).rows[0].revision,2);
  });
  await t.test('stored rows contain ciphertext but no financial notes or amounts',async()=>{
   await asUser(db,'postgres');const dump=JSON.stringify((await db.query('SELECT * FROM public.encrypted_vaults')).rows);assert(!dump.includes('segredo-financeiro'));assert(!dump.includes('salary'));assert(!dump.includes('\"amount\"'));
  });
 }finally{await db.close();}
});
