import test from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser} from './helpers/database.mjs';
import {createVault,unlockVault,decryptVault,encryptVault,lockVault} from '../dist/vault-crypto.mjs';
import {createSupabaseVaultAdapter} from '../dist/vault-api.mjs';
const alice='33333333-3333-4333-8333-333333333333',bob='44444444-4444-4444-8444-444444444444';
test('encrypted client payload completes a real Postgres round trip without giving another account access',async()=>{
 const db=await database();let token='alice-session';
 const users={'alice-session':alice,'bob-session':bob};
 try{
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[alice,bob]);
  const adapter=createSupabaseVaultAdapter({url:'https://fixture.supabase.co',publicKey:'sb_publishable_fixture1234567890',getAccessToken:()=>token,fetchImpl:async(url,options)=>{
   const owner=users[options.headers.Authorization.slice(7)];if(!owner)return Response.json({},{status:401});
   if(url.endsWith('/auth/v1/user'))return Response.json({id:owner});await asUser(db,'authenticated',owner);
   try{
    if(url.includes('/rpc/')){const body=JSON.parse(options.body);assert(!options.body.includes('nota que deve ficar privada'));return Response.json((await db.query('SELECT * FROM public.save_encrypted_vault($1,$2::jsonb)',[body.p_expected_revision,JSON.stringify(body.p_envelope)])).rows);}
    const rows=(await db.query('SELECT envelope,revision,updated_at FROM public.encrypted_vaults')).rows;return Response.json(rows);
   }catch(e){return Response.json({},{status:e.code==='PT409'?409:400});}
  }});
  const created=await createVault({records:[{note:'nota que deve ficar privada',amount:2590}]},'uma senha exclusiva do cofre',alice);
  await adapter.save(created.envelope,0);lockVault(created.session);
  const stored=await adapter.load(),session=await unlockVault(stored.envelope,'uma senha exclusiva do cofre',alice);
  assert.equal((await decryptVault(stored.envelope,session,alice)).records[0].amount,2590);
  const changed=await encryptVault({records:[{note:'nota que deve ficar privada',amount:3000}]},session,stored.envelope);await adapter.save(changed,stored.revision);
  await assert.rejects(()=>adapter.save(stored.envelope,stored.revision),e=>e.code==='CONFLICT');lockVault(session);
  token='bob-session';assert.equal(await adapter.load(),null);await assert.rejects(()=>adapter.save(changed,0),e=>e.code==='OWNER_MISMATCH');
 }finally{await db.close();}
});
