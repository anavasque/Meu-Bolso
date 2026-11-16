# Comparação de bancos para o Bolso

Decisão: Supabase PostgreSQL Free, por reunir banco e Auth gerenciado para o login futuro. A usuária escolheu E2EE; o banco não guardará os campos financeiros abertos.

| Opção | Vantagem | Trabalho adicional |
|---|---|---|
| Supabase Free | PostgreSQL, políticas RLS e autenticação no mesmo serviço. | Conta adicional, quotas e possibilidade de pausa. O cofre E2EE é responsabilidade do app. |
| Cloudflare D1 Free | Boa integração com a hospedagem Cloudflare e base simples compatível com SQLite. | Não fornece o fluxo de login e recuperação por si só; requer API e autenticação. |
| SQLite na VPS existente | Sem custo de licença ou serviço separado; suficiente para dados simples. | API, autenticação, TLS, manutenção e backups ficam sob responsabilidade da VPS. A VPS continua tendo seu custo. |

Não há benefício em complicar o armazenamento com tabelas abertas de transações quando o servidor não poderá ler os dados. Um snapshot cifrado por conta, com controle de revisão, é suficiente para a primeira versão. Anexos e grandes volumes exigiriam revisar essa estratégia.

O plano gratuito deve ser confirmado na conta antes da ativação. E-mail de confirmação/recuperação em produção também exige revisar as limitações de envio do provedor de autenticação.

Fontes: [Supabase preços](https://supabase.com/pricing), [D1 preços](https://developers.cloudflare.com/d1/platform/pricing/), [SQLite: aplicações adequadas](https://www.sqlite.org/whentouse.html).
