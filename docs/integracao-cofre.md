# Integração do cofre e do banco

Estado: implementação preparada localmente, sem projeto Supabase conectado e sem migração dos dados reais do app. O site publicado continua usando o armazenamento local anterior. Não apresentar esta etapa como proteção já ativa.

## Componentes

- `supabase/migrations/001_encrypted_vaults.sql`: banco PostgreSQL com uma linha por conta, RLS e escrita com revisão otimista. Senhas de acesso ficam no Supabase Auth, não nesta tabela.
- `dist/vault-crypto.mjs`: criptografia no aparelho, senha do cofre, recuperação e bloqueio de sessão em memória.
- `dist/vault-api.mjs`: transporte que aceita somente envelopes cifrados. Exige sessão Supabase válida e recusa chave privilegiada.
- `test/database.test.mjs`: aplica SQL real em PostgreSQL local via PGlite, com funções de autenticação simuladas apenas para testes.
- `test/vault-integration.test.mjs`: fluxo de cifragem → transporte → PostgreSQL → leitura e decifragem; não é um teste contra Supabase remoto.

## O que precisa acontecer para ativar

1. Criar o projeto Supabase Free e aplicar a migration usando o SQL Editor ou o fluxo de migrations da conta.
2. Fornecer ao aplicativo somente a URL do projeto e a chave **publishable**. Nunca enviar `sb_secret`, `service_role` ou senha do banco para o navegador.
3. Implementar os fluxos de conta planejados em `login-seguranca.md`. O login fornece `getAccessToken`; o adaptador não faz cadastro nem guarda a sessão.
4. Implementar a tela separada de criar/desbloquear o cofre. A senha de cofre deve ser diferente da senha enviada ao Supabase Auth.
5. Mostrar o código de recuperação ao criar o cofre e permitir salvá-lo de forma privada. Nunca persistir esse código no banco nem no armazenamento comum do navegador.
6. Fazer migração explícita: preservar os dados locais, cifrar uma cópia, salvar no banco, reler/decifrar/validar e só então concluir a migração. Não apagar a única cópia boa automaticamente.
7. Integrar gravações assíncronas no app, cache local cifrado para off-line, fila de sincronização, bloqueio por inatividade e limpeza de chave/UI no logout. Não adaptar `localStorage.setItem` com uma gravação criptográfica em segundo plano que possa perder dados ao fechar.
8. Fazer testes reais com duas contas e no Safari antes de ativar para uso diário.

## Contrato para o futuro login

```js
import { createSupabaseVaultAdapter } from './vault-api.mjs';
import { createVault, unlockVault, decryptVault, lockVault } from './vault-crypto.mjs';

const vaults = createSupabaseVaultAdapter({
  url: configuration.supabaseUrl,
  publicKey: configuration.supabasePublishableKey,
  getAccessToken: () => accountSession.access_token,
});

// Executar somente quando a pessoa escolher criar/migrar seu cofre.
const ownerId = await vaults.getCurrentUserId();
const created = await createVault(validatedLocalBackup, separateVaultPassword, ownerId);
const saved = await vaults.save(created.envelope, 0);
// Exibir created.recoveryKey de forma privada; não registrar em console/storage.
lockVault(created.session);

// Em uma sessão posterior, após login e desbloqueio separados:
const remote = await vaults.load();
if (remote) {
  const session = await unlockVault(remote.envelope, separateVaultPassword, ownerId);
  const restored = await decryptVault(remote.envelope, session, ownerId);
  // Validar esquema do Bolso antes de apresentar ou substituir dados locais.
  lockVault(session);
}
```

`save(envelope, expectedRevision)` retorna `{revision, updatedAt}`. Conflitos lançam `VaultSyncError` com código `CONFLICT`; não repetir automaticamente com a revisão nova, pois isso sobrescreveria alterações de outro aparelho. `load()` retorna `null` se a conta ainda não tem cofre.

## Limites e ameaças

O envelope v1 limita o conteúdo JSON a 5 MiB. Isso mantém a implementação simples por snapshots e evita envio de anexos. Se o app atingir esse limite, a operação falha; não trunca registros. Índices e consultas financeiras ficam no aparelho, pois o servidor não lê os campos.

AES-GCM protege confidencialidade e autenticação do conteúdo. O servidor ainda vê identificador da conta, tamanhos, revisões e horários. Acesso malicioso ao código entregue ao navegador, XSS, aparelho comprometido, perda da senha e do código de recuperação e indisponibilidade/exclusão do servidor continuam sendo riscos. Mudança da senha do cofre envolve novamente a chave; não revoga cópias antigas de chaves/dados já obtidas por alguém.

Não guardar senhas do cofre, códigos de recuperação, dados abertos ou chaves financeiras em logs, variáveis públicas, arquivos de configuração, cookies ou banco. O service worker deve continuar armazenando apenas o shell estático.

## Testar

```text
npm ci
npm test
```

O PGlite é dependência de desenvolvimento; não é enviado ao navegador nem precisa rodar na VPS. A implantação real usa o PostgreSQL do Supabase. Os testes não substituem uma revisão de segurança independente.
