import { validateEnvelope } from './vault-crypto.mjs';

export class VaultSyncError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'VaultSyncError'; this.code = code; this.status = status; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function publicApiKey(value) {
  if (typeof value !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(value)) return true;
  try {
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'anon';
  } catch { return false; }
}
function rowMetadata(row) {
  if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.updated_at !== 'string' || Number.isNaN(Date.parse(row.updated_at))) {
    throw new VaultSyncError('INVALID_RESPONSE', 'O servidor retornou uma versão inválida do cofre.');
  }
  return { revision: row.revision, updatedAt: row.updated_at };
}
/**
 * Encrypted-only transport. The future login supplies a fresh access token.
 * Never pass a service_role/secret key, account password or vault password here.
 * RLS and the RPC enforce account isolation on the server, independently of JS.
 */
export function createSupabaseVaultAdapter({ url, publicKey, getAccessToken, fetchImpl = globalThis.fetch }) {
  let origin;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw Error();
    origin = parsed.origin;
  } catch { throw new VaultSyncError('INVALID_CONFIG', 'Configure a URL HTTPS do projeto Supabase.'); }
  if (!publicApiKey(publicKey) || typeof getAccessToken !== 'function' || typeof fetchImpl !== 'function') {
    throw new VaultSyncError('INVALID_CONFIG', 'Use apenas a chave pública do projeto e uma sessão de usuário.');
  }
  async function request(path, token, options = {}) {
    let response;
    try {
      response = await fetchImpl(origin + path, {
        ...options, credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { apikey: publicKey, Authorization: 'Bearer ' + token, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
      });
    } catch { throw new VaultSyncError('NETWORK_ERROR', 'Não foi possível conectar ao cofre. Seus dados locais não foram alterados.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new VaultSyncError('AUTH_REQUIRED', 'Entre na sua conta para acessar o cofre.', response.status);
      if (response.status === 409) throw new VaultSyncError('CONFLICT', 'O cofre mudou em outro aparelho. Recarregue antes de salvar.', 409);
      throw new VaultSyncError('SERVER_ERROR', 'Não foi possível concluir a operação no cofre.', response.status);
    }
    try { return await response.json(); }
    catch { throw new VaultSyncError('INVALID_RESPONSE', 'O servidor retornou uma resposta inválida.'); }
  }
  async function identity() {
    const token = await getAccessToken();
    if (typeof token !== 'string' || !token || token.length > 16384 || token === publicKey) throw new VaultSyncError('AUTH_REQUIRED', 'Entre na sua conta para acessar o cofre.');
    const user = await request('/auth/v1/user', token);
    if (!user || typeof user.id !== 'string' || !UUID.test(user.id)) throw new VaultSyncError('AUTH_REQUIRED', 'A sessão não é válida. Entre novamente.');
    return { token, ownerId: user.id };
  }
  return Object.freeze({
    async getCurrentUserId() { return (await identity()).ownerId; },
    async load() {
      const { token, ownerId } = await identity();
      const rows = await request('/rest/v1/encrypted_vaults?select=envelope,revision,updated_at&user_id=eq.' + ownerId + '&limit=1', token);
      if (!Array.isArray(rows) || rows.length > 1) throw new VaultSyncError('INVALID_RESPONSE', 'O servidor retornou uma resposta inválida.');
      if (!rows.length) return null;
      validateEnvelope(rows[0].envelope);
      if (rows[0].envelope.ownerId !== ownerId) throw new VaultSyncError('OWNER_MISMATCH', 'Este cofre pertence a outra conta.');
      return { envelope: rows[0].envelope, ...rowMetadata(rows[0]) };
    },
    async save(envelope, expectedRevision) {
      validateEnvelope(envelope);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) throw new VaultSyncError('INVALID_REVISION', 'A versão do cofre é inválida.');
      // Snapshot before awaiting: caller changes cannot replace the validated payload.
      const snapshot = JSON.parse(JSON.stringify(envelope));
      const { token, ownerId } = await identity();
      if (snapshot.ownerId !== ownerId) throw new VaultSyncError('OWNER_MISMATCH', 'Este cofre pertence a outra conta.');
      const rows = await request('/rest/v1/rpc/save_encrypted_vault', token, { method: 'POST', body: JSON.stringify({ p_expected_revision: expectedRevision, p_envelope: snapshot }) });
      if (!Array.isArray(rows) || rows.length !== 1) throw new VaultSyncError('INVALID_RESPONSE', 'O servidor retornou uma resposta inválida.');
      const result = rowMetadata(rows[0]);
      if (result.revision !== expectedRevision + 1) throw new VaultSyncError('INVALID_RESPONSE', 'O servidor retornou uma versão inesperada do cofre.');
      return result;
    }
  });
}
