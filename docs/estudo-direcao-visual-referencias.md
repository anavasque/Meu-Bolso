# Estudo de direção visual — referências aplicadas ao Bolso

Estudo preparado em 15/11/2026. As cinco imagens anexadas foram observadas. Este documento é uma proposta visual, não uma alteração do aplicativo. Nenhuma skill foi instalada, nenhum script de terceiros foi executado e nenhum arquivo de produção foi alterado.

## Direção proposta

Um Bolso mais organizado e leve, com base clara, blocos candy usados com intenção e os ícones pixelados já associados ao app. O resultado deve continuar reconhecível como Bolso, em vez de virar uma cópia dos dashboards das referências. Prioridade: leitura rápida do saldo, gastos e limites no iPhone.

## Cinco aprendizados das referências

| Referência | O que funciona visualmente | Aplicação no Bolso | O que evitar |
|---|---|---|---|
| Foto 1 — saúde, fundo bege e módulos claros | Muito espaço entre grupos e diferença clara entre informação principal e apoio. | Dar ao saldo um bloco calmo e separar as linhas de categorias por espaçamento, sem adicionar caixas a cada pequena informação. | Bolhas luminosas, sombras volumosas, calendário permanente e menus laterais no celular. |
| Foto 2 — painel médico creme, rosa e amarelo | Cores ajudam a identificar blocos e as listas têm alinhamento consistente. | Menta para saldo, lilás para dinheiro guardado, rosa para registrar e amarelo como apoio; nome de categoria à esquerda, dinheiro à direita. | Copiar a alta densidade de estatísticas, a sidebar preta ou o texto minúsculo. |
| Foto 3 — painel lavanda | Hierarquia entre fundo, painéis e elemento ativo; áreas organizadas por proximidade. | Usar a paleta escolhida também no fundo e destacar a aba ativa com um único preenchimento suave, preservando o menu inferior com cinco itens. | Cartão inclinado, vidro/transparência atrás de texto, avatares sem utilidade e calendário complexo. |
| Foto 4 — painel esportivo roxo e rosa | Progressos compreensíveis e agrupamento visual por objetivo. | Limites e dinheiro guardado podem ter pequenos blocos de resumo com progresso, números bem alinhados e textos objetivos. | Gradientes fortes, sombras em todos os cartões, excesso de roxo saturado ou ocupação de toda a tela por um único gráfico. |
| Foto 5 — orçamento com porquinho | A metáfora do cofrinho é imediata e gasto/limite aparecem juntos. | Preservar o porquinho pixelado do Bolso e mostrar “gasto de limite”, além do restante ou excesso em texto. | Barras verticais, serifas/negrito pesado e ocupar grande parte da tela com uma ilustração. |

## Sistema visual a preservar

- Fontes: VT323 regular e alternativa Pixelify Sans regular. Não trocar silenciosamente por outra família, nem criar títulos pesados.
- Ícones: pixel art colorida, contorno ameixa e grade consistente. Se uma aba do menu tem cor, todas têm.
- Base Candy: creme muito claro `#fffaf7`, texto ameixa `#423349`, rosa `#f6bbdf`, lilás `#dfcdf6`, menta `#c8efd7`, amarelo `#ffe89b` e azul `#a9dff1`. As demais paletas continuam alterando fundo e superfícies.
- Geometria: cantos moderados, em torno de 12–16px nas superfícies; trilhos de barra discretos. Evitar tanto o excesso de pílulas quanto a rigidez inteiramente quadrada.
- Respiro: margens laterais de aproximadamente 20px no celular; 16–24px entre grupos e 8px entre elementos relacionados.
- Navegação: cinco abas inferiores fixas com ícone e rótulo, respeitando a área segura do iPhone.
- Ação de novo registro: manter a linguagem rosa anterior, com texto regular e alvo de toque adequado. O botão ameixa grande recentemente rejeitado não deve voltar neste estudo.

## Duas telas para o resumo visual

### Início

Ordem: marca Bolso e mês; saldo disponível; gastos por categoria; botão rosa original “+ Novo registro”; menu inferior.

O saldo é o ponto de partida, com pequeno ícone de moedas. Mostrar apenas categorias com gastos, com ícone, nome e valor alinhados, barra horizontal e o limite mensal já definido logo abaixo. Não introduzir novos eixos, donuts, gráficos de pizza ou informações duplicadas.

Dados fictícios coerentes para o mockup: entradas de R$ 4.000,00, gastos de R$ 1.050,00 e dinheiro guardado de R$ 500,00, resultando em R$ 2.450,00 disponíveis. Categorias visíveis: Alimentação R$ 350,00 (limite R$ 500,00), Transporte R$ 150,00 (limite R$ 250,00), Casa R$ 550,00 (limite R$ 800,00). A imagem é um estudo; não usar dados reais da pessoa.

### Limites

Ordem: título e mês; resumo curto do total planejado; lista de três categorias com gasto e teto; ação “+ Definir limite”; menu inferior.

Nas linhas de limite, mostrar progressos horizontais associados explicitamente ao teto: Alimentação R$ 350,00 de R$ 500,00, restantes R$ 150,00; Transporte R$ 150,00 de R$ 250,00, restantes R$ 100,00; Casa R$ 550,00 de R$ 800,00, restantes R$ 250,00. Evitar duplicar os valores em legendas separadas. O excesso deve aparecer em palavras e valor, não só por mudança de cor.

## Skills pesquisadas e lidas no GitHub

### Anthropic — frontend-design

[SKILL.md original](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)

Aproveitar a orientação de construir uma identidade específica para o produto, escolher uma hierarquia tipográfica deliberada, criticar a proposta contra o briefing e reduzir decoração que não ajuda a tarefa. No Bolso isso significa manter o pixel e a leveza já aprovados, em vez de aplicar um kit genérico de dashboard. As preferências explícitas da usuária prevalecem sobre recomendações externas.

### Vercel — web-design-guidelines

[SKILL.md original](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)

[Guia efetivamente lido](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)

Aproveitar foco visível, rótulos em controles e ícones, números tabulares, tratamento de conteúdo longo, áreas seguras e respeito a reduzir movimento. Gestos devem continuar tendo alternativa por toque. O estudo não executou uma auditoria completa do código e não adotou automaticamente regras editoriais incompatíveis com o português ou com o estilo aprovado.

### UI/UX Pro Max — nextlevelbuilder

[SKILL.md original](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md)

Aproveitar prioridades de legibilidade, consistência de ícones, alvos de toque de pelo menos 44px, desenho mobile-first, revelação progressiva de opções e navegação inferior com até cinco itens. A pesquisa foi de leitura do material; seu gerador de sistemas de design não foi instalado ou executado, e não se afirma haver recomendações calculadas pela base de dados da skill.

## Verificação antes de qualquer implementação futura

Conferir a proposta no iPhone em largura de 320–390px, números longos, modo escuro, Pixelify e VT323, categorias personalizadas, limite excedido e estado sem gastos. Confirmar que nenhuma tela perdeu uma ação existente e que o estudo não reintroduziu mudanças já rejeitadas. A imagem-resumo é para avaliação visual antes de alterar o app.
