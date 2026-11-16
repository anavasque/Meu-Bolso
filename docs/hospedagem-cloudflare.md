# Hospedagem do Bolso na Cloudflare

Preparado em 15/11/2026. Plano de execução; nenhuma conta, DNS, publicação ou configuração do aplicativo foi alterada. A criptografia e qualquer API continuam pendentes da escolha da usuária.

## Arquitetura proposta

O Bolso atual pode ficar no Cloudflare Pages, servindo apenas o conteúdo de `dist/`. A VPS fica disponível para os outros serviços e, se o modelo escolhido exigir sincronização, para uma API separada. O aplicativo atual não precisa de banco de dados, processo Node.js ou servidor de aplicação na VPS.

A conta Cloudflare ainda será criada. É possível começar com um endereço `*.pages.dev` e associar o domínio definitivo depois. Para reduzir migrações de armazenamento do celular, vale definir o endereço definitivo antes do uso principal.

## Conferência do projeto atual

- `dist/index.html` é a entrada; as rotas usam fragmentos como `#inicio` e não exigem regras de rewrite.
- Manifesto: `id`, `start_url` e `scope` são `./`; ícones, fontes, CSS e JS usam caminhos relativos. Publicar o conteúdo de `dist/` na raiz do hostname preserva essa estrutura.
- O service worker atual usa `bolso-shell-v21`, busca navegações na rede primeiro e utiliza um HTML local para abrir off-line. Não salva uma cópia da página de verificação da hospedagem no shell.
- O cache explícito contém apenas o aplicativo e seus recursos; atualizações não removem `localStorage`.
- O app atual grava registros em JSON no `localStorage` e exporta backup JSON legível. HTTPS e mudança de hospedagem não criptografam esse conteúdo automaticamente.
- Não existe API no aplicativo atual. Também não existe autenticação ou sincronização com a VPS.
- Não há arquivo `_headers` no pacote atual. `serve.mjs` é somente o servidor local de desenvolvimento, e não deve ser enviado como serviço obrigatório.

## Publicação inicial por Direct Upload

O caminho simples é enviar os arquivos prontos pelo painel ou por Wrangler. O Pages aceita pasta ou ZIP no painel; Wrangler recebe a pasta. Um projeto criado como Direct Upload não pode ser convertido depois em integração Git; se essa automação for desejada desde o começo, deve-se criar um projeto Git integrado. [Documentação oficial](https://developers.cloudflare.com/pages/get-started/direct-upload/)

Preparação local, quando a publicação for autorizada e a conta estiver disponível:

```powershell
node scripts/prepare-offline.mjs
node --check dist/app.js
node --check dist/sw.js
node --test test/*.test.mjs
```

No painel da Cloudflare, criar o projeto Pages por upload e enviar o conteúdo de `dist/`, com `index.html` na raiz do pacote. Não enviar backups financeiros, a pasta `preview/`, credenciais, `.git/` ou `.openai/`.

Alternativa por CLI, com autenticação interativa na conta correta:

```powershell
npx wrangler login
npx wrangler pages project create
npx wrangler pages deploy dist --project-name NOME_REAL_DO_PROJETO
```

Não executar esses comandos antes de confirmar a conta e o nome do projeto. Não colocar tokens no código, no ZIP ou neste documento.

## Cache e PWA

Evitar regras extras de “Cache Everything” no domínio do aplicativo. O Pages já administra seu cache de distribuição; regras de cache adicionais do domínio podem servir conteúdo antigo após publicação. [Comportamento oficial de cache](https://developers.cloudflare.com/pages/configuration/serving-pages/)

Antes da primeira publicação, podemos acrescentar um `dist/_headers` para revalidação no navegador e cabeçalhos básicos. Exemplo a revisar e testar, ainda não aplicado:

```text
/*
  Cache-Control: no-cache
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
```

Essa política é conservadora porque os nomes dos arquivos são estáveis e as versões atuais estão nas query strings. Não configurar `immutable` para `sw.js`, HTML ou esses arquivos sem antes mudar a estratégia de versionamento. O cache off-line explícito do service worker é separado da política HTTP acima. O Pages interpreta `_headers` dentro da pasta de saída; respostas de futuras Pages Functions precisam definir seus próprios cabeçalhos. [Documentação de headers](https://developers.cloudflare.com/pages/configuration/headers/)

Na homologação, verificar status e MIME de `/`, `/sw.js`, CSS, JS, manifesto, fontes e ícones. Um arquivo ausente pode cair no fallback de SPA e responder HTML; um status 200 isolado não prova que o asset está correto. Testar abertura on-line, fechamento e reabertura, modo avião, atualização de versão e instalação no Safari real. Nunca limpar dados do site como passo de atualização.

## Domínio definitivo

Cadastrar primeiro o domínio em Pages → projeto → Custom domains e seguir a configuração indicada pelo painel. Um subdomínio pode apontar por CNAME para o projeto Pages mesmo quando a zona DNS está em outro provedor. Para o domínio raiz, a documentação exige a zona na conta Cloudflare e os nameservers correspondentes. Não criar apenas o CNAME sem associar o domínio ao projeto. [Configuração oficial](https://developers.cloudflare.com/pages/configuration/custom-domains/)

Não alterar registros existentes da VPS ou de e-mail para ligar somente o subdomínio do Bolso.

## Migração dos dados do celular

O armazenamento é separado por origem, que inclui protocolo e hostname; o domínio novo não poderá ler automaticamente o armazenamento do endereço atual. [Referência localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

Sequência recomendada:

1. Exportar o backup no Bolso atual, no navegador onde estão os registros.
2. Guardar esse arquivo em local privado; o formato atual ainda não é criptografado.
3. Abrir o endereço definitivo e importar o backup.
4. Conferir registros, categorias, limites, dinheiro guardado e preferências.
5. Instalar novamente a PWA pelo endereço definitivo e testar reabertura.
6. Manter o site antigo e o backup até confirmar os dados no novo endereço. Não apagar dados para fazer a migração.

Também há mudança de origem ao sair de `projeto.pages.dev` para um domínio próprio; usar o domínio definitivo antes da importação evita repetir essa etapa.

## Compatibilidade com uma API futura na VPS

Esta é uma proposta de integração, não uma implementação. A decisão de criptografia vem primeiro.

- Usar HTTPS também entre Cloudflare e a VPS. Se o hostname da API for proxyado, configurar certificado válido na origem e modo Full (strict). [Documentação SSL](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- Uma opção é `api.seudominio.com`, com CORS restrito à origem real do Bolso. Outra é encaminhar `/api/` pelo mesmo domínio; essa rota precisa de Worker/Function/proxy e não surge automaticamente ao publicar arquivos estáticos.
- A API deve autenticar e autorizar cada usuário, mesmo se receber apenas dados cifrados. Não colocar banco de dados diretamente acessível pelo navegador.
- Dados da API não devem entrar no cache público, em URLs ou em logs de conteúdo. Reservar tratamento explícito para `/api/` no service worker quando a API existir.
- Se for escolhida criptografia ponta a ponta, o aplicativo deve enviar somente o conteúdo já cifrado. Banco criptografado em disco ou HTTPS sozinhos não entregam esse modelo.
- Origem estável, backup/restauração e política de recuperação de chaves precisam ser validados antes de migrar dados reais.

## O que ainda falta para executar

- Conta Cloudflare criada e autenticada pela usuária.
- Nome do projeto e decisão entre Direct Upload e integração Git.
- Domínio/subdomínio escolhido, ou decisão de usar temporariamente `pages.dev`.
- Modelo de criptografia escolhido; não foi implementado neste trabalho.
- Se houver API: sistema operacional, endereço e forma de administração da VPS, além do desenho de autenticação e sincronização.

O plano e a compatibilidade foram conferidos em código e nas fontes oficiais citadas. A infraestrutura real ainda não foi provisionada nem testada.
