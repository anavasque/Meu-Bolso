-- Bolso E2EE vaults. Run using the Supabase migration/SQL-editor postgres role.
-- No financial plaintext, passwords, recovery codes or unwrapped keys belong here.
begin;

create table public.encrypted_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  envelope jsonb not null,
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encrypted_vault_envelope_v1 check (coalesce(
    jsonb_typeof(envelope) = 'object'
    and octet_length(envelope::text) <= 7100000
    and envelope ?& array['version','alg','ownerId','vaultId','kdf','keyWrap','recoveryWrap','data']
    and envelope - array['version','alg','ownerId','vaultId','kdf','keyWrap','recoveryWrap','data']::text[] = '{}'::jsonb
    and envelope -> 'version' = '1'::jsonb
    and envelope ->> 'alg' = 'AES-256-GCM'
    and jsonb_typeof(envelope -> 'ownerId') = 'string'
    and envelope ->> 'ownerId' = user_id::text
    and jsonb_typeof(envelope -> 'vaultId') = 'string'
    and envelope ->> 'vaultId' ~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'

    and jsonb_typeof(envelope -> 'kdf') = 'object'
    and (envelope -> 'kdf') ?& array['name','iterations','salt']
    and (envelope -> 'kdf') - array['name','iterations','salt']::text[] = '{}'::jsonb
    and envelope #>> '{kdf,name}' = 'PBKDF2-SHA256'
    and jsonb_typeof(envelope #> '{kdf,iterations}') = 'number'
    and case when envelope #>> '{kdf,iterations}' ~ '^[0-9]{6,7}$'
      then (envelope #>> '{kdf,iterations}')::integer between 600000 and 2000000 else false end
    and jsonb_typeof(envelope #> '{kdf,salt}') = 'string'
    and envelope #>> '{kdf,salt}' ~ '^[A-Za-z0-9+/]{22}==$'

    and jsonb_typeof(envelope -> 'keyWrap') = 'object'
    and (envelope -> 'keyWrap') ?& array['iv','ciphertext']
    and (envelope -> 'keyWrap') - array['iv','ciphertext']::text[] = '{}'::jsonb
    and jsonb_typeof(envelope #> '{keyWrap,iv}') = 'string'
    and envelope #>> '{keyWrap,iv}' ~ '^[A-Za-z0-9+/]{16}$'
    and jsonb_typeof(envelope #> '{keyWrap,ciphertext}') = 'string'
    and envelope #>> '{keyWrap,ciphertext}' ~ '^[A-Za-z0-9+/]{64}$'

    and jsonb_typeof(envelope -> 'recoveryWrap') = 'object'
    and (envelope -> 'recoveryWrap') ?& array['iv','ciphertext']
    and (envelope -> 'recoveryWrap') - array['iv','ciphertext']::text[] = '{}'::jsonb
    and jsonb_typeof(envelope #> '{recoveryWrap,iv}') = 'string'
    and envelope #>> '{recoveryWrap,iv}' ~ '^[A-Za-z0-9+/]{16}$'
    and jsonb_typeof(envelope #> '{recoveryWrap,ciphertext}') = 'string'
    and envelope #>> '{recoveryWrap,ciphertext}' ~ '^[A-Za-z0-9+/]{64}$'

    and jsonb_typeof(envelope -> 'data') = 'object'
    and (envelope -> 'data') ?& array['iv','ciphertext']
    and (envelope -> 'data') - array['iv','ciphertext']::text[] = '{}'::jsonb
    and jsonb_typeof(envelope #> '{data,iv}') = 'string'
    and envelope #>> '{data,iv}' ~ '^[A-Za-z0-9+/]{16}$'
    and jsonb_typeof(envelope #> '{data,ciphertext}') = 'string'
    and length(envelope #>> '{data,ciphertext}') between 24 and 6990528
    and case when envelope #>> '{data,ciphertext}' ~ '^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
      then octet_length(decode(envelope #>> '{data,ciphertext}', 'base64')) between 18 and 5242896 else false end
  , false))
);

alter table public.encrypted_vaults owner to postgres;
alter table public.encrypted_vaults enable row level security;

create policy encrypted_vault_read_own
  on public.encrypted_vaults for select to authenticated
  using ((select auth.uid()) = user_id);

-- No write policy and no direct client DML: all writes must pass CAS below.
revoke all on table public.encrypted_vaults from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.encrypted_vaults to authenticated;

create function public.save_encrypted_vault(p_expected_revision bigint, p_envelope jsonb)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740990 then
    raise exception using errcode = '22023', message = 'invalid_expected_revision';
  end if;
  if p_envelope is null or jsonb_typeof(p_envelope) <> 'object'
    or p_envelope ->> 'ownerId' is distinct from v_user_id::text then
    raise exception using errcode = '22023', message = 'invalid_vault_owner';
  end if;

  if p_expected_revision = 0 then
    insert into public.encrypted_vaults as vault (user_id, envelope, revision)
      values (v_user_id, p_envelope, 1)
      on conflict (user_id) do nothing
      returning vault.revision, vault.updated_at into v_revision, v_updated_at;
  else
    update public.encrypted_vaults as vault
      set envelope = p_envelope,
          revision = vault.revision + 1,
          updated_at = clock_timestamp()
      where vault.user_id = v_user_id and vault.revision = p_expected_revision
      returning vault.revision, vault.updated_at into v_revision, v_updated_at;
  end if;

  if not found then
    raise exception using errcode = 'PT409', message = 'vault_revision_conflict',
      detail = 'Fetch the current vault and resolve the conflict before retrying.';
  end if;
  return query select v_revision, v_updated_at;
end;
$function$;

alter function public.save_encrypted_vault(bigint, jsonb) owner to postgres;
revoke all on function public.save_encrypted_vault(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_encrypted_vault(bigint, jsonb) to authenticated;

comment on table public.encrypted_vaults is 'E2EE snapshots: opaque ciphertext and wrapped data keys only; no server decryption key.';
comment on function public.save_encrypted_vault(bigint, jsonb) is 'Authenticated owner-only CAS. Expected 0 creates revision 1. Stale writes fail PT409.';

commit;
