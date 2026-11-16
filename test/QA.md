# Plano de verificação — Bolso

- Valores monetários: aceitar formatos brasileiros válidos, rejeitar NaN, negativos e valores sem precisão; persistir centavos inteiros.
- Datas/períodos: mês sem registros, virada de mês/ano, semana na virada de mês; não misturar resumos do período.
- Reservas: guardar e retirar são transferências, não receitas/despesas; impedir retirada superior ao reservado; manter patrimônio total.
- Backup: exportação/restauração preserva conteúdo; rejeitar estrutura inválida, IDs repetidos, datas impossíveis e valores não inteiros; não substituir estado antes da confirmação.
- Persistência: captura de falha/quota, recuperação de arquivo inválido sem limpar dados automaticamente.
- Segurança de interface: observações e conteúdo de backup nunca interpolados em HTML sem escaping; não depender de rede para fontes/ícones.
- Acessibilidade: campos nomeados, foco no diálogo, ação de fechar/cancelar, contraste e foco visível, reduzir movimento, cinco abas com rótulos.
- PWA: manifest e ícones válidos, cache do shell, fallback off-line sem interceptar origens externas; revisão manual em iPhone necessária para instalação real.
