# Banco adotado: Supabase PostgreSQL Free

Implementação preparada em 15/11/2026. O projeto remoto ainda não foi criado/conectado. Não há credenciais reais no código e nenhum registro pessoal foi enviado. O login permanece em planejamento separado.

## Por que esta opção

O Bolso tem dados simples e pode usar um snapshot JSON criptografado por conta. O Supabase reúne PostgreSQL e autenticação gerenciada, reduzindo o trabalho do futuro cadastro/login. O plano Free tem quotas e pode pausar por inatividade; gratuidade não significa capacidade ou disponibilidade ilimitadas. Consulte [preços](https://supabase.com/pricing) e [limites do plano](https://supabase.com/docs/guides/platform/billing-on-supabase).

Não foi escolhida uma base SQL com colunas abertas para valor, categoria ou observação. Com a E2EE escolhida, os cálculos e filtros ficam no aparelho. A tabela remota guarda somente o envelope cifrado e os metadados necessários à conta e sincronização.

## Estrutura implementada

`public.encrypted_vaults`:

- `user_id`: UUID associado a `auth.users`, uma linha por conta.
- `envelope`: JSON v1 com algoritmo, parâmetros de derivação, chave de dados envolvida por senha e por recuperação, e conteúdo cifrado.
- `revision`: revisão crescente, para impedir sobrescrita silenciosa entre aparelhos.
- `created_at` e `updated_at`: metadados visíveis ao serviço.

A aplicação não cria uma tabela própria de senha. O Supabase Auth cuidará da autenticação; a senha do cofre é diferente e nunca é enviada ao Auth ou ao banco.

## Isolamento e permissões

RLS permite a usuários autenticados ler apenas a própria linha. Visitantes anônimos não podem ler ou escrever. As tabelas não dão INSERT/UPDATE/DELETE direto ao cliente.

As gravações usam `public.save_encrypted_vault(p_expected_revision bigint, p_envelope jsonb)`:

- Deriva o proprietário de `auth.uid()`; não aceita um parâmetro `user_id` arbitrário.
- Confere `envelope.ownerId` e as restrições de formato, tamanho e campos permitidos.
- Revisão esperada `0` cria a primeira versão `1`; uma linha já existente causa conflito.
- Atualização exige que a revisão esperada ainda seja atual.
- Retorna `revision` e `updated_at`. Conflitos têm SQLSTATE `PT409`; a Data API retorna HTTP 409.

A função é SECURITY DEFINER para permitir somente essa escrita controlada, mantendo DML direto revogado. É propriedade do papel `postgres`, usa `search_path=pg_catalog`, nomes qualificados e nenhuma SQL dinâmica. Isso é deliberado: o privilégio da função ignora RLS, então os testes verificam explicitamente o proprietário derivado da sessão. A chave administrativa/secret não pertence ao navegador.

A estrutura bloqueia campos adicionais no envelope para evitar gravar JSON financeiro aberto por engano. Ela verifica o formato, não tem a chave para verificar ou ler o conteúdo autenticado; a autenticação AES-GCM é verificada no aparelho.

## Para ativar na conta da usuária

1. Criar uma conta e um projeto **Free** no [painel Supabase](https://supabase.com/dashboard). Guardar a senha do banco em um gerenciador; não usá-la como senha do cofre.
2. Abrir **SQL Editor**, criar uma consulta e executar o conteúdo completo de `supabase/migrations/001_encrypted_vaults.sql`. Executar uma única vez no projeto escolhido; alterações futuras devem usar outra migration.
3. Conferir a tabela `encrypted_vaults`, a política RLS e a função de gravação. Ela ficará vazia até existir uma pessoa autenticada e uma ação de criação de cofre.
4. Separar a **URL do projeto** e a chave **publishable** para a configuração do cliente. Não usar `sb_secret`, `service_role`, token administrativo nem senha do banco.
5. Implementar o login planejado, o desbloqueio local e a sincronização assíncrona descritos em `integracao-cofre.md` antes de migrar dados reais.
6. Validar duas contas reais de teste e a reabertura off-line no Safari. Depois migrar uma cópia dos dados, preservando o original até conferir a leitura.

Criar a conta não dá acesso automático ao Codex. Se não houver uma conexão autorizada à conta, os passos no painel serão executados pela usuária com orientação. Não solicitar que senhas administrativas sejam coladas na conversa.

## Verificação feita localmente

Os testes executam a migration em PostgreSQL real compilado para WASM via PGlite. O ambiente cria uma simulação mínima de `auth.users`, papéis e `auth.uid()` apenas para testar. Não é um projeto Supabase remoto e não substitui a validação da configuração real.

Cobertura: acesso anônimo, isolamento entre duas contas, ownerId adulterado, DML direto, conflito de revisão, campos abertos indevidos, parâmetros inválidos, criptografia e integração cifragem → transporte → banco → decifragem.

## Fontes oficiais

- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: chaves de API](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase: funções de banco e SECURITY DEFINER](https://supabase.com/docs/guides/database/functions)
- [PGlite: PostgreSQL para testes locais](https://pglite.dev/docs/)
