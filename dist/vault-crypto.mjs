/**
 * Bolso E2EE vault, envelope v1. Browser Web Crypto only; no network or storage.
 * Callers must keep the vault password separate from the account password.
 * Sessions hold key material only in module-private memory. lockVault drops it;
 * JavaScript garbage collection cannot promise physical memory zeroization.
 */
export const VAULT_LIMITS = Object.freeze({
  version: 1,
  iterations: 600000,
  maxIterations: 2000000,
  minPasswordLength: 12,
  maxPasswordLength: 1024,
  maxPayloadBytes: 5 * 1024 * 1024
});
export class VaultError extends Error {
  constructor(code, message) { super(message); this.name = 'VaultError'; this.code = code; }
}
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const sessions = new WeakMap();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const invalid = () => new VaultError('INVALID_ENVELOPE', 'O arquivo do cofre é inválido ou incompatível.');
const failed = () => new VaultError('UNLOCK_FAILED', 'Não foi possível abrir o cofre. Confira a senha ou o arquivo.');
function webCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new VaultError('CRYPTO_UNAVAILABLE', 'Use um navegador compatível em uma conexão HTTPS.');
  return globalThis.crypto;
}
function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key)) || actual.some(key => !keys.includes(key))) throw invalid();
  if (actual.some(key => !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, key), 'value'))) throw invalid();
}
function encode64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
function decode64(text, min, max = min) {
  if (typeof text !== 'string' || text.length < Math.ceil(min / 3) * 4 || text.length > Math.ceil(max / 3) * 4 || text.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw invalid();
  let bytes;
  try { bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0)); } catch { throw invalid(); }
  if (bytes.length < min || bytes.length > max || encode64(bytes) !== text) throw invalid();
  return bytes;
}
function box(value, min, max = min) {
  exactObject(value, ['iv', 'ciphertext']);
  decode64(value.iv, 12); decode64(value.ciphertext, min, max);
}
/** Returns true, or throws VaultError before any expensive key derivation. */
export function validateEnvelope(value) {
  exactObject(value, ['version', 'alg', 'ownerId', 'vaultId', 'kdf', 'keyWrap', 'recoveryWrap', 'data']);
  if (value.version !== 1 || value.alg !== 'AES-256-GCM' || typeof value.ownerId !== 'string' || !UUID.test(value.ownerId) || typeof value.vaultId !== 'string' || !UUID.test(value.vaultId)) throw invalid();
  exactObject(value.kdf, ['name', 'iterations', 'salt']);
  if (value.kdf.name !== 'PBKDF2-SHA256' || !Number.isSafeInteger(value.kdf.iterations) || value.kdf.iterations < VAULT_LIMITS.iterations || value.kdf.iterations > VAULT_LIMITS.maxIterations) throw invalid();
  decode64(value.kdf.salt, 16);
  box(value.keyWrap, 48); box(value.recoveryWrap, 48);
  box(value.data, 18, VAULT_LIMITS.maxPayloadBytes + 16);
  return true;
}
function owner(envelope, expected) {
  if (typeof expected !== 'string' || !UUID.test(expected) || envelope.ownerId !== expected) throw new VaultError('OWNER_MISMATCH', 'Este cofre pertence a outra conta.');
}
function password(value) {
  if (typeof value !== 'string' || Array.from(value).length < VAULT_LIMITS.minPasswordLength || value.length > VAULT_LIMITS.maxPasswordLength) throw new VaultError('INVALID_PASSWORD', 'Use uma senha de cofre com pelo menos 12 caracteres.');
}
function random(length) { return webCrypto().getRandomValues(new Uint8Array(length)); }
function kdfParameters() { return { name: 'PBKDF2-SHA256', iterations: VAULT_LIMITS.iterations, salt: encode64(random(16)) }; }
async function passwordKey(value, parameters) {
  password(value);
  const bytes = encoder.encode(value);
  try {
    const material = await webCrypto().subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await webCrypto().subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: decode64(parameters.salt, 16), iterations: parameters.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } finally { bytes.fill(0); }
}
function aad(envelope, role) { return encoder.encode(JSON.stringify(['Bolso vault', envelope.version, envelope.alg, envelope.ownerId, envelope.vaultId, role])); }
function parameters(envelope, role, iv) { return { name: 'AES-GCM', iv, tagLength: 128, additionalData: aad(envelope, role) }; }
async function importDataKey(raw) { return webCrypto().subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function encryptBox(bytes, key, envelope, role, previousIv) {
  let iv;
  do { iv = random(12); } while (encode64(iv) === previousIv);
  const result = await webCrypto().subtle.encrypt(parameters(envelope, role, iv), key, bytes);
  return { iv: encode64(iv), ciphertext: encode64(new Uint8Array(result)) };
}
async function decryptBox(value, key, envelope, role) {
  return new Uint8Array(await webCrypto().subtle.decrypt(parameters(envelope, role, decode64(value.iv, 12)), key, decode64(value.ciphertext, role === 'data' ? 18 : 48, role === 'data' ? VAULT_LIMITS.maxPayloadBytes + 16 : 48)));
}
function payloadBytes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new VaultError('INVALID_DATA', 'Os dados do cofre precisam ser um objeto JSON.');
  const pending = [{ value, depth: 0 }], seen = new WeakSet(); let count = 0;
  while (pending.length) {
    const { value: current, depth } = pending.pop();
    if (++count > 200000 || depth > 64) throw new VaultError('INVALID_DATA', 'Os dados do cofre excedem o tamanho permitido.');
    if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
    if (typeof current === 'number' && Number.isFinite(current)) continue;
    if (typeof current !== 'object') throw new VaultError('INVALID_DATA', 'Use apenas valores JSON nos dados do cofre.');
    const proto = Object.getPrototypeOf(current);
    if (!Array.isArray(current) && proto !== Object.prototype && proto !== null) throw new VaultError('INVALID_DATA', 'Use apenas objetos JSON nos dados do cofre.');
    if (seen.has(current)) continue; seen.add(current);
    for (const key of Object.keys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new VaultError('INVALID_DATA', 'Use apenas valores JSON nos dados do cofre.');
      pending.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
  let serialized;
  try { serialized = JSON.stringify(value); } catch { throw new VaultError('INVALID_DATA', 'Os dados do cofre não são um JSON válido.'); }
  const bytes = encoder.encode(serialized);
  if (bytes.length > VAULT_LIMITS.maxPayloadBytes) throw new VaultError('INVALID_DATA', 'O cofre excede o limite de 5 MB.');
  return bytes;
}
async function readPayload(envelope, key) {
  const bytes = await decryptBox(envelope.data, key, envelope, 'data');
  try {
    const value = JSON.parse(decoder.decode(bytes));
    const checked = payloadBytes(value); checked.fill(0); return value;
  } finally { bytes.fill(0); }
}
function makeSession(raw, key, envelope) {
  const session = Object.freeze(Object.create(null));
  // Rewrapping the master key on a password change requires a private in-memory
  // wrapping copy. Neither it nor the non-extractable CryptoKey is exposed.
  sessions.set(session, { raw: new Uint8Array(raw), key, ownerId: envelope.ownerId, vaultId: envelope.vaultId });
  return session;
}
function sessionState(session, envelope) {
  const state = session && sessions.get(session);
  if (!state || state.ownerId !== envelope.ownerId || state.vaultId !== envelope.vaultId) throw new VaultError('SESSION_INVALID', 'Desbloqueie o cofre novamente.');
  return state;
}
/** Drops this session and best-effort clears its private wrapping byte array. */
export function lockVault(session) {
  const state = session && sessions.get(session);
  if (state) { state.raw.fill(0); sessions.delete(session); }
}
function copyEnvelope(envelope) { return JSON.parse(JSON.stringify(envelope)); }
export async function createVault(data, vaultPassword, ownerId) {
  password(vaultPassword);
  if (typeof ownerId !== 'string' || !UUID.test(ownerId)) throw new VaultError('OWNER_MISMATCH', 'Use o identificador da conta autenticada.');
  const bytes = payloadBytes(data), raw = random(32), recoveryRaw = random(32);
  try {
    const envelope = { version: 1, alg: 'AES-256-GCM', ownerId, vaultId: webCrypto().randomUUID(), kdf: kdfParameters() };
    const key = await importDataKey(raw), wrappingKey = await passwordKey(vaultPassword, envelope.kdf), recoveryWrappingKey = await importDataKey(recoveryRaw);
    envelope.keyWrap = await encryptBox(raw, wrappingKey, envelope, 'keyWrap');
    envelope.recoveryWrap = await encryptBox(raw, recoveryWrappingKey, envelope, 'recoveryWrap');
    envelope.data = await encryptBox(bytes, key, envelope, 'data');
    validateEnvelope(envelope);
    const recoveryKey = encode64(recoveryRaw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { envelope, recoveryKey, session: makeSession(raw, key, envelope) };
  } finally { raw.fill(0); recoveryRaw.fill(0); bytes.fill(0); }
}
export async function unlockVault(envelope, vaultPassword, ownerId) {
  validateEnvelope(envelope); owner(envelope, ownerId); password(vaultPassword);
  let raw;
  try {
    const wrappingKey = await passwordKey(vaultPassword, envelope.kdf);
    raw = await decryptBox(envelope.keyWrap, wrappingKey, envelope, 'keyWrap');
    const key = await importDataKey(raw);
    await readPayload(envelope, key);
    return makeSession(raw, key, envelope);
  } catch { throw failed(); } finally { raw?.fill(0); }
}
export async function decryptVault(envelope, session, ownerId) {
  validateEnvelope(envelope); owner(envelope, ownerId);
  const state = sessionState(session, envelope);
  let value;
  try { value = await readPayload(envelope, state.key); } catch { throw failed(); }
  sessionState(session, envelope); return value;
}
export async function encryptVault(data, session, envelope) {
  validateEnvelope(envelope); const state = sessionState(session, envelope), bytes = payloadBytes(data);
  try {
    const result = copyEnvelope(envelope);
    result.data = await encryptBox(bytes, state.key, result, 'data', envelope.data.iv);
    sessionState(session, envelope); validateEnvelope(result); return result;
  } finally { bytes.fill(0); }
}
/** Rewraps the existing master key; this does not revoke copies of older keys. */
export async function changePassword(envelope, session, newPassword) {
  validateEnvelope(envelope); password(newPassword); const state = sessionState(session, envelope);
  const raw = new Uint8Array(state.raw);
  try {
    try { await readPayload(envelope, state.key); } catch { throw failed(); }
    sessionState(session, envelope);
    const result = copyEnvelope(envelope); result.kdf = kdfParameters();
    const wrappingKey = await passwordKey(newPassword, result.kdf);
    sessionState(session, envelope);
    result.keyWrap = await encryptBox(raw, wrappingKey, result, 'keyWrap');
    sessionState(session, envelope); validateEnvelope(result); return result;
  } finally { raw.fill(0); }
}
export async function recoverVault(envelope, recoveryKey, newPassword, ownerId) {
  validateEnvelope(envelope); owner(envelope, ownerId); password(newPassword);
  if (typeof recoveryKey !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoveryKey)) throw new VaultError('RECOVERY_FAILED', 'A chave de recuperação não abriu este cofre.');
  let recoveryRaw, raw, session;
  try {
    recoveryRaw = decode64(recoveryKey.replace(/-/g, '+').replace(/_/g, '/') + '=', 32);
    const recoveryWrappingKey = await importDataKey(recoveryRaw);
    raw = await decryptBox(envelope.recoveryWrap, recoveryWrappingKey, envelope, 'recoveryWrap');
    const key = await importDataKey(raw); await readPayload(envelope, key);
    session = makeSession(raw, key, envelope);
    const result = await changePassword(envelope, session, newPassword);
    return { envelope: result, session };
  } catch { if (session) lockVault(session); throw new VaultError('RECOVERY_FAILED', 'A chave de recuperação não abriu este cofre.'); }
  finally { recoveryRaw?.fill(0); raw?.fill(0); }
}
