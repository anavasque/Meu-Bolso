# Meu-Bolso
Bolso é um site de gestão de finanças amigável e personalizável.

# Bolso

A versão ativa é um aplicativo de finanças pessoais em português, sem serviços de IA. HTML, CSS e JavaScript sem etapa de compilação. Os dados ficam no armazenamento do navegador deste aparelho; não há sincronização entre dispositivos.

## Executar

Requer Node.js. Nesta pasta, execute `node serve.mjs` e abra http://127.0.0.1:4173. Para instalação no iPhone, use a versão hospedada em HTTPS no Safari e escolha Compartilhar → Adicionar à Tela de Início. Aguarde a confirmação de que o uso off-line está pronto antes de desconectar.

## Dados e backup

Exporte um backup nas configurações antes de limpar dados do navegador, reinstalar ou trocar de aparelho. Importar substitui os dados atuais após confirmação. Arquivos de backup contêm informações financeiras e devem ser guardados em um local privado. Uma instalação diferente ou outro navegador pode ter armazenamento separado.

Guardar e retirar dinheiro são transferências entre disponível e reservado, sem aumentar entradas ou gastos. Os resumos consideram os lançamentos registrados no app, e não um saldo bancário consultado.

## Recursos locais

Ícones em SVG/pixel art e a logo do bolso com três moedas são originais. Cabeçalho, abertura e ícones de instalação usam a logo aprovada, exportada por `scripts/export-brand.ps1`. A VT323 é a fonte pixelada padrão aprovada, com tamanho ajustado para leitura e sem negrito sintético. A atualização migra a aparência das instalações anteriores, preserva os dados financeiros e permite trocar de fonte depois. A fonte do aparelho, Inter, IBM Plex Sans, Manrope e Public Sans continuam disponíveis em Ajustes; os arquivos originais são hospedados localmente, com licenças OFL em `dist/fonts/`, e incluídos no cache off-line. A paleta Candy conserva o fundo original; Pêssego, Oceano e Jardim mudam também fundo, superfícies, campos e navegação, com variantes claras e escuras. O service worker mantém o aplicativo disponível sem internet após o cache inicial. A autenticação da hospedagem pode exigir internet no primeiro acesso. A instalação e o comportamento real do Safari devem ser verificados em um iPhone.

## Verificação

Antes de publicar, execute `node scripts/prepare-offline.mjs`, `node --check dist/app.js` e `node --test test/*.test.mjs`. O gerador incorpora o HTML local no service worker. As versões no meta `bolso-build`, no cache e nas URLs dos assets devem coincidir. On-line, a navegação consulta a hospedagem normalmente; sem rede, utiliza o shell próprio empacotado, sem guardar páginas temporárias de verificação da hospedagem. Atualizações nunca apagam o armazenamento financeiro.

## Categorias

Categorias personalizadas guardam nome, cor e ícone localmente, junto aos registros e no backup JSON. Backups antigos sem categorias continuam válidos. Crie categorias em Ajustes → Categorias ou no seletor de categoria de um registro. Categorias utilizadas por registros ou limites não podem ser excluídas; seus nomes e ícones podem ser editados. As categorias de gasto fixo e parcelas são classificações de lançamentos manuais.

Categorias de entrada e gasto são separadas no formulário. As categorias personalizadas guardam também seu tipo; categorias antigas sem tipo continuam como gastos, sem recategorizar lançamentos antigos.

## Banco e cofre E2EE em preparação

A base Supabase/PostgreSQL está definida em `supabase/migrations/001_encrypted_vaults.sql`, com RLS e gravação por revisão. `dist/vault-crypto.mjs` e `dist/vault-api.mjs` implementam criptografia no aparelho e transporte de ciphertext. Consulte `docs/banco-supabase.md` e `docs/integracao-cofre.md` para ativação e limites.

Esses módulos ainda não são chamados pelo app publicado. Não há projeto Supabase conectado nem migração dos dados reais; o armazenamento e os backups atuais continuam no formato anterior até a integração de login/desbloqueio. Para testar o código preparado: `npm ci` e `npm test`. A dependência PGlite é usada somente em desenvolvimento/testes.
