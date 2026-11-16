# Plano de login e senha do Bolso

Preparado em 15/11/2026. Documento de planejamento: nenhum login, banco, DNS ou fluxo do aplicativo foi alterado. A usuária escolheu criptografia ponta a ponta (E2EE), e a arquitetura adotada é Supabase Free. A conta/configuração remota ainda precisa ser fornecida. Este agente não implementou a interface de login.

## Recomendação adotada

Usar Supabase Auth para cadastro, login e recuperação da conta, Postgres com RLS para isolamento e um cofre E2EE independente para os registros. Não construir uma tabela própria de hashes de senha no Bolso enquanto o Auth gerenciado for usado.

**Senha de acesso e senha/chave do cofre devem ser diferentes.** O Supabase Auth recebe a senha de acesso para autenticar. Essa senha não pode ser reutilizada como segredo do cofre e nunca deve ser repassada ao módulo de E2EE. A senha do cofre só deve desbloquear a chave no aparelho; a chave aberta e essa senha nunca vão para Auth, banco, logs ou telemetria.

O acesso direto do navegador ao Supabase usa outro modelo de sessão: não prometer cookies HttpOnly com um cliente estático convencional. Se for exigido cookie HttpOnly, usar uma API intermediária/BFF em mesma origem, com sessão no servidor, em vez de armazenar os tokens de acesso no JavaScript. A escolha entre cliente estático e BFF deve ser explícita antes do login ser ativado.

As seções sobre hashes e cookies abaixo são uma referência para uma eventual API/BFF própria; no caminho Supabase, a implementação interna de hashing pertence ao serviço Auth. Não migrar ou sobrescrever os usuários internos do Auth com uma implementação própria.

## Experiência proposta

| Tela/ação | Comportamento |
|---|---|
| Criar conta | E-mail, senha e confirmação; verificação de e-mail antes da sincronização remota. |
| Entrar | E-mail e senha; resposta genérica para credenciais inválidas. |
| Sair | Revoga a sessão no servidor e apaga o cookie. A política para dados locais exige decisão explícita. |
| Esqueci minha senha | Envia link temporário para e-mail, sem revelar se a conta existe. |
| Trocar senha | Exige autenticação recente, invalida sessões antigas conforme política. |
| Sem internet | O uso do cofre local depende da criptografia escolhida; não simular uma autenticação online válida. |

Proposta de produto: manter o modo local como opção e usar conta para sincronização, sem enviar automaticamente os registros que já estão no celular. A primeira migração precisa mostrar qual conta receberá os dados e preservar um backup.

## Senhas

Guardar somente hash adaptativo com salt aleatório, parâmetros e versão. Não guardar senha em texto legível, não criptografá-la de modo reversível e não usar SHA-256 puro como hash de senha.

Preferência para API própria: Argon2id, calibrado no ambiente real. Referência inicial da OWASP: memória de 19 MiB, duas iterações e paralelismo 1. Quando Argon2id não estiver disponível, a OWASP recomenda scrypt; a configuração deve ser escolhida e medida na VPS. Bibliotecas de autenticação maduras são preferíveis a construir o protocolo manualmente.

Aceitar frases-senha longas, permitir colar e usar gerenciadores. Sem MFA, propor mínimo de 15 caracteres, máximo de pelo menos 64, sem regras artificiais como exigir um símbolo específico. Limitar o tamanho máximo em bytes e medir custo para evitar abuso. Não registrar senhas, hashes ou tokens em logs.

Fontes: [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Sessão e API

- Cookie proposto: `__Host-bolso_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`. Strict pode ser usado se os fluxos de navegação e recuperação forem compatíveis.
- Token de sessão aleatório de 256 bits; armazenar apenas seu hash no banco. Rotacionar depois do login e revogar no logout.
- Proposta inicial de duração: sete dias, com renovação controlada e expiração por inatividade; valores de produto a confirmar.
- HTTPS obrigatório; verificar Origin e usar proteção CSRF nas operações que alteram dados. SameSite não substitui toda proteção CSRF.
- Respostas de autenticação e dados financeiros com `Cache-Control: no-store`. Nunca colocar respostas de `/api/` no cache do service worker.
- Rate limit persistente por conta e origem/IP, com espera progressiva e limite global de trabalho de hash. Não depender só de um Map em memória, que perde estado ao reiniciar ou escalar.
- Não retornar detalhes de hash, sessões internas ou dados de outras contas ao navegador.

Fonte: [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Isolamento por usuário

O servidor obtém `user_id` exclusivamente da sessão validada. Toda consulta de leitura, escrita e exclusão aplica esse proprietário. Um `user_id` enviado pelo cliente nunca decide a conta acessada.

Estrutura mínima proposta para autenticação própria:

- `users`: identificador aleatório, e-mail normalizado único, hash de senha, estado de verificação e datas.
- `sessions`: hash do token, proprietário, criação, expiração e revogação.
- `auth_tokens`: hash de token de verificação/recuperação, proprietário, finalidade, expiração e uso.
- Dados financeiros ou cofre: chave de proprietário obrigatória; conteúdo definido somente após a escolha de criptografia.

Usar consultas parametrizadas, transações e chaves estrangeiras. Se usar Supabase, ativar RLS nas tabelas expostas e políticas ligadas ao usuário autenticado; a chave de serviço fica somente no servidor. Testar com duas contas reais de teste que A não pode ler, sobrescrever ou excluir B, incluindo requisições com IDs adulterados.

Fonte: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Recuperação e criptografia

Links de recuperação precisam de tokens criptograficamente aleatórios, curtos em validade, de uso único, guardados como hash. Usar resposta uniforme, limite de envios e endereço público previamente configurado para montar o link. Não confiar no cabeçalho Host recebido para montar URLs. Após a troca, revogar sessões antigas e notificar o proprietário.

Recuperar a senha de acesso e recuperar a chave dos registros são processos diferentes. Com a E2EE escolhida, o servidor não poderá simplesmente recuperar os registros ao redefinir a senha de acesso. Será necessário código de recuperação ou outro aparelho autorizado. Redefinir a senha do Supabase Auth não altera a senha do cofre nem revela sua chave. Não usar o hash de autenticação como chave do cofre.

Fonte: [Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Integração obrigatória entre login e cofre E2EE

- Ao sair ou trocar de conta, bloquear o cofre e descartar a chave aberta e os registros descriptografados em memória. Revogar a sessão não apaga automaticamente o estado visual do app.
- Separar caches locais de cada conta. Nunca enviar o cofre de uma conta para outra só porque a sessão mudou; importação exige uma ação explícita.
- O service worker só guarda o shell público do PWA. Nem respostas de Auth, nem JSON financeiro aberto, nem tokens entram no cache de navegação.
- O login prova a identidade para o servidor; não desbloqueia o cofre automaticamente. O desbloqueio por senha do cofre é local e separado.
- Uma falha de XSS ou atualização maliciosa do app enquanto o cofre estiver aberto pode acessar os dados e a chave no aparelho. E2EE impede leitura do conteúdo armazenado no servidor sem a chave, mas não fornece sigilo absoluto para um aparelho/app já comprometido.

## Pendências antes de executar

1. Concluído: Supabase Free e E2EE escolhidos; preparar configuração real do projeto.
2. Confirmar domínio/origem da API e acesso ao ambiente escolhido.
3. Definir se o app continuará com modo local sem conta.
4. Selecionar serviço de e-mail e verificar seu domínio e limites gratuitos.
5. Implementar testes de autenticação, autorização, recuperação, expiração, CSRF e ausência de cache de dados privados antes de publicar endpoints.

Nenhum dado financeiro deve ser colocado numa API pública sem autenticação enquanto o login estiver sendo preparado.
