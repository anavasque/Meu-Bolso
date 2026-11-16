import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export async function database(){
 const db=new PGlite();
 await db.exec(`CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE ROLE anon NOLOGIN;
 CREATE ROLE authenticated NOLOGIN;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO anon, authenticated;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/001_encrypted_vaults.sql',import.meta.url),'utf8'));
 return db;
}
export async function asUser(db,role,id=''){
 await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
 if(role!=='postgres')await db.exec('SET ROLE '+({anon:'anon',authenticated:'authenticated'}[role]||'NONE'));
}
