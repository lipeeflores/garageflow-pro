# Relatório: arnaldo-api (Parte A do plano 2026-10-15)

Executor: Claude Sonnet 5.5. Tudo em `main`. Último commit da função: `01bd11c` (VERSAO `a5-2026-10-15T18:05-03:00`).

## Resumo

- **A0 a A6 feitas e empurradas para `main`.** `npx vitest run src/test/arnaldo`: **124 testes verdes** em 6 arquivos.
- **Publicação (A0/A5) verificada pela sessão do servidor:** depois de o Lipe pedir no chat do Lovable, a função respondeu a saúde (`{"ok":true,"versao":"a5-2026-10-15T18:05-03:00"}`), `POST` sem token deu 401 e chamadas assinadas reais (`quem_sou`, `agenda_do_dia`) funcionaram, inclusive pelo Hermes de ponta a ponta. Os segredos já estão no Lovable e no servidor. Ou seja, os passos 3 e 4 da A5 estão cumpridos. Antes do pedido ao Lipe, o curl deu 404 por mais de 15 minutos: o Lovable **não publica sozinho** uma função nova vinda do GitHub; precisa do pedido no chat.
- **A6 (P1) implementada**, 6 ações: `precificar_itens`, `enviar_orcamento`, `controle_qualidade`, `registrar_pagamento`, `resumo_financeiro`, `contas_a_pagar`. Cada hook foi lido antes (ver "A6" abaixo).
- **Para o MCP expor as ferramentas P1, o servidor precisa de `ARNALDO_ENABLE_P1=1`** (o `tools.mjs` já filtra por essa variável). A sessão do servidor liga.
- **Pendente: publicar o commit `b123d4b` (A6).** A função em produção ainda é a `a5-2026-10-15T18:05-03:00`; o curl de saúde seguiu na a5 por 12 minutos depois do push, porque o Lovable só publica quando o Lipe pede no chat dele. Quando publicar, o curl de saúde passa a devolver `a6-2026-10-15T18:29-03:00`. Enquanto isso, o MCP deve ficar sem `ARNALDO_ENABLE_P1=1`: as 6 ações P1 devolveriam `acao_desconhecida`.

## Header anon é obrigatório?

**Não foi testado sem o header.** O `config.toml` tem `verify_jwt = false` e a função foi publicada e atendida com sucesso; o MCP manda `authorization: Bearer <anon>` em toda chamada, então funciona nos dois casos. Se algum dia der 401 do gateway (antes de chegar na função), o `verify_jwt` foi religado pelo Lovable.

## Segredos que o Lipe cria no Lovable (Cloud → Secrets)

Nomes apenas; nenhum valor foi para o git.

| nome | o que é |
|---|---|
| `ARNALDO_API_TOKEN` | 48 caracteres aleatórios (`openssl rand -hex 24`). O MCP manda em `x-arnaldo-token`. Sem ele a função devolve 401 |
| `ARNALDO_CALLER_SECRET` | 48 aleatórios, **outro** valor. Chave do HMAC da identidade do chamador (o plugin `md_arnaldo` assina com ela) |
| `ARNALDO_APP_URL` | URL publicada do app, sem barra no fim. Usada no `link_orcamento` |

Sem `ARNALDO_API_TOKEN` configurado a função recusa tudo (401); sem `ARNALDO_CALLER_SECRET` toda chamada dá `assinatura_invalida`. Sem `ARNALDO_APP_URL`, `status_do_carro` simplesmente não devolve `link_orcamento`. Os valores vão ao Lipe pelo chat e ao servidor só na Parte C.

Também precisa existir no banco o tenant com `slug = 'md-mecanica'` (a função o resolve por esse slug a cada chamada; se faltar, toda ação dá `erro_interno`).

## Ações implementadas (25 de 25)

**P0, 19 ações** (todas com `reason` ignorado e dinheiro removido na API quando o papel não vê): `quem_sou`, `meus_dados`, `cadastrar_cliente_veiculo`, `status_do_carro`, `horarios_livres`, `agendar`, `meus_agendamentos`, `remarcar`, `cancelar_agendamento`, `agenda_do_dia`, `buscar`, `ver_os`, `abrir_os`, `registrar_checkin`, `anexar_foto`, `registrar_diagnostico`, `adicionar_itens`, `mover_etapa`, `atribuir`.

**P1, 6 ações, só `gestao` e `dono`** (pátio, cliente e `sistema` levam `sem_permissao` sem gravar nada, testado):

| ação | como espelha o app |
|---|---|
| `precificar_itens` | `useUpsertItemPricing`: upsert em `work_order_pricing` com `total_price = preço × quantidade do item`, `unit_cost` nulo se não informado. Recalcula `work_orders.total_amount` (soma dos `total_price`). Lote validado antes de gravar; item de outra OS ou preço ≤ 0 derrubam o lote. OS FINALIZADO/CANCELADO → `etapa_invalida` |
| `enviar_orcamento` | `BudgetQuickDialog`: todo item com `total_price > 0` (senão `dados_invalidos` listando os itens sem preço), grava `total_amount` e leva AGUARDANDO_ORCAMENTO → AGUARDANDO_APROVACAO. Devolve `link_orcamento` (se `ARNALDO_APP_URL` existir). Se já estiver em AGUARDANDO_APROVACAO, só devolve o link de novo |
| `controle_qualidade` | `QualityControlDialog`: insere em `work_order_quality` (`manager_id` = ator, `APROVADO`/`DEVOLVIDO_AJUSTES`) e muda a etapa para PRONTO_PARA_RETIRADA ou AJUSTES. Só vale em EM_QUALIDADE; exige ator identificado |
| `registrar_pagamento` | `useCreatePayment`: `payments` (`processed_by` = ator) + `financial_entries` RECEITA (`category` = rótulo da forma, `description` = "Pagamento OS XXXXXXXX"). Extras de segurança, que o app não tem: recusa (`conflito`) o mesmo valor+forma na mesma OS em até 2 minutos (retentativa do modelo) e desfaz o pagamento se o lançamento financeiro falhar. Devolve `total_pago`, `total_os` e `saldo` |
| `resumo_financeiro` | `useFinancialData`: receita (`financial_entries` RECEITA por `entry_date`), formas de pagamento (por `paid_at`), OS finalizadas (por `created_at`, como o hook faz), ticket médio = receita / finalizadas, e `em_andamento` = soma de `total_amount` das OS em PRONTO_PARA_RETIRADA/APROVADO/EM_EXECUCAO/EM_QUALIDADE. Período máximo 366 dias |
| `contas_a_pagar` | `useBills`: `listar` (PENDENTE+VENCIDO por padrão, por vencimento, com resumo pendente/vencido/fixas/flutuantes), `criar` (PENDENTE, FLUTUANTE por padrão), `pagar` (PAGO + `paid_at` + `paid_amount`, que é `valor` ou o valor da conta). Como no app, pagar uma conta **não** cria lançamento em `financial_entries` |

Campos extras aceitos pela API e que o schema atual do MCP (`tools.mjs`) ainda não declara, caso a sessão do servidor queira expor: em `contas_a_pagar` `categoria` (FIXA/FLUTUANTE), `status`, `fornecedor`, `observacoes`, `recorrente`, `dia_recorrencia`. Hoje o MCP só manda `acao`, `conta_id`, `descricao`, `valor`, `vencimento`, que bastam.

## Estrutura

- `supabase/functions/arnaldo-api/index.ts`: só o wrapper Deno (único import de esm.sh).
- `supabase/functions/_shared/arnaldo/handler.ts`: todo o atendimento HTTP (CORS, saúde, token, caller assinado, tenant, papel, despacho). Foi separado do `index.ts` para ser testável com vitest.
- Resto de `_shared/arnaldo/`: `phone`, `caller`, `roles`, `money`, `workflow`, `agenda`, `db`, `util`, `os`, `router`, `actions/*` como no mapa do plano.
- Testes: `src/test/arnaldo/{puros,workflow-agenda,router,os,handler}.test.ts`, mais `fakeDb.ts` e `fixtures.ts`. Os casos de A4 ficaram em `os.test.ts` (não acrescentados ao `router.test.ts`) para dividir as fixtures.
- Imports com extensão `.ts` funcionam no vitest sem mexer no `vitest.config.ts`. `tsc -p tsconfig.app.json`: 2 erros, os dois antigos (`useAppointments.ts:225`, `useVehicles.ts:127`); nenhum novo.

## Desvios do plano e decisões (a outra sessão precisa saber)

1. **Código de erro `conflito`**: o plano usa `conflito` nas ações (`cadastrar_cliente_veiculo` com placa de outro cliente; segundo `registrar_checkin`), mas a lista do contrato HTTP não o inclui. Implementei `conflito` como o texto do plano manda. O MCP repassa a resposta inteira, então não quebra nada, mas a lista de códigos do contrato deveria ganhar `conflito`.
2. **`dados` como lista**: `meus_agendamentos` e `agenda_do_dia` devolvem **array** em `dados` (como o catálogo diz `[...]`), apesar de o contrato falar em "objeto". Cada item de `agenda_do_dia` leva `status` (AGENDADO/CHEGOU/NAO_COMPARECEU), para misturar os faltosos dos 3 dias anteriores.
3. **Papel `sistema`** (cron): o catálogo só o lista em `quem_sou`. Liberei também, só para leitura, `status_do_carro`, `horarios_livres`, `agenda_do_dia`, `buscar` e `ver_os`. Nenhuma ação de escrita aceita `sistema`, nem as P1 (as que exigem ator ficam vetadas, como no plano).
4. **Caminho da foto em `anexar_foto`**: usei o formato que o app já usa (`work-orders/<os_id>/<tipo em minúsculas>/<ts>-<id curto>.<ext>`, igual ao `PhotoUpload.tsx`) e não `${tenant}/${os_id}/${uuid}`, como o plano mandou conferir. A tabela `attachments` não tem coluna de legenda: `legenda` vira um evento `NOTA_ARNALDO` na OS.
5. **Telefone gravado em `customers.phone_number`**: DDD + número, sem o `55` (11 dígitos), que é o formato que o app já assume (`PendingTasksAlert` acrescenta o 55). A busca normaliza em JS os dois lados, então telefones salvos em qualquer formato casam.
6. **`registrar_diagnostico`** a partir de CHECKIN_CONCLUIDO passa por EM_DIAGNOSTICO e chega em AGUARDANDO_ORCAMENTO (dois updates, dois eventos). Fora dessas etapas, grava o laudo e não mexe na etapa.
7. **`registrar_checkin`** só move a etapa se a OS ainda está em AGUARDANDO_CHECKIN (não rebaixa uma OS adiantada). O app faz `upsert` no check-in; aqui o segundo check-in é `conflito`, como o plano pede.
8. **Grade de agenda**: `horarios_livres` trata `ate` como dia inclusivo (máx. 14 dias, `de` + 13). `agendar`/`remarcar` recalculam a vaga naquele minuto; horário fora da grade, no passado ou lotado dá `conflito_agenda` com até 3 alternativas do dia (sem repetir o horário pedido).
9. O evento de mudança de etapa gravado pelo trigger do banco leva `actor_id = auth.uid()`, que é nulo com a service role. Por isso `mover_etapa` com `observacao` grava um evento `NOTA_ARNALDO` com o `actor_id` do ator. Sem observação, quem mudou a etapa não fica registrado no evento.

## Ambiente e riscos

- `npm ci` falha neste repo: `package-lock.json` está fora de sincronia com o `package.json`. Usei `npm install --no-package-lock`; nenhum lockfile foi alterado.
- `deno` não existe nesta máquina: o código foi testado em Node/vitest. Em produção o Lovable empacotou `../_shared/arnaldo/*` e a A5 rodou (confirmado pela sessão do servidor).
- Esta pasta é compartilhada com a outra sessão (Parte B): os commits de `hermes/` estão intercalados com os meus em `main`. Só dei `git add` nos meus caminhos.
- Nada foi gravado nem apagado no banco de produção (não há acesso); os testes usam só o `fakeDb`.

---

# Parte D1 (documentos da MD): `dados_documento`, `registrar_entrega` e número da OS

Plano `2026-10-15-documentos-md.md`. 154 testes verdes (`npx vitest run src/test/arnaldo`), `tsc -p tsconfig.app.json` com os mesmos 2 erros antigos. `VERSAO` = `d1-…`. O que o Lipe pede ao Lovable está em `2026-10-16-documentos-lovable.md`. **Nada disso está em produção até o Lovable aplicar a migração e publicar a função.**

## Ações novas ou alteradas

- **`dados_documento`** (`tipo`: `orcamento`, `ficha_entrada`, `os_patio`, `recibo`; alvo: `os_id`, `numero` ou `placa`). Todos os papéis chamam; a API decide o que sai:

| tipo | cliente | pátio | gestão / dono / sistema | exige |
|---|---|---|---|---|
| `orcamento` | só da própria OS | `sem_permissao` | sim | etapa a partir de AGUARDANDO_APROVACAO (CANCELADO não), senão `etapa_invalida` |
| `recibo` | só da própria OS | `sem_permissao` | sim | pagamento registrado **ou** FINALIZADO, senão `etapa_invalida` |
| `ficha_entrada` | só da própria OS | sim | sim | check-in, senão `nao_encontrado` |
| `os_patio` | `sem_permissao` | sim | sim (**sem dinheiro**) | nada |

  Cliente pedindo OS de outro ou inexistente recebe a mesma resposta (`nao_encontrado`, "Não achei essa ordem de serviço neste número."); por placa de outro, a mensagem de sempre ("Não achei esse carro no cadastro deste número.").
- **Dinheiro:** `os_patio` **e** `ficha_entrada` não têm as chaves `itens[].preco_unitario`, `itens[].total`, `totais` e `pagamentos` (ausentes, não nulas), **para nenhum papel, nem o dono**. Os itens dessas duas saem como `{tipo, descricao, codigo, quantidade}`. A ficha também fica sem dinheiro (decisão minha, além do plano, que só exigia no `os_patio`): o pátio pode pedir a ficha, e a ficha não tem valor. **Os templates da ficha e da OS do pátio não podem ler `totais`, `pagamentos` nem preço dos itens.** `link_aprovacao` só vem no orçamento (o link do orçamento mostra os preços; no pátio seria vazamento); nos outros tipos é `null`. `validade_ate` só no orçamento.
- **Exceção ao filtro do roteador:** a ação tem `liberaDinheiro: true`, para o roteador não aplicar `semDinheiro` por cima (senão o cliente dono da OS perderia os preços do próprio orçamento e o `valor` dos pagamentos). É a única ação assim; o roteador continua filtrando todas as outras.
- **Contrato:** exatamente as chaves do plano. Campos sem dado vêm `null`. `os.aprovada_em` é o último evento `WORKFLOW_STEP_CHANGE` para APROVADO; `validade_ate` = data do envio do orçamento (evento para AGUARDANDO_APROVACAO, senão hoje) + `config.validade_orcamento_dias`. `fotos`: só fotos (áudio e ponto fora), as que não são avaria primeiro, avarias depois, cada grupo por data. `totais.desconto` é sempre 0 (o app não tem desconto). `previsao_entrega` é a data como está no banco (coluna `date`, sem horário). `config` = `tenants.settings.documentos` mesclado com os padrões (textos copiados dos mockups).
- **`registrar_entrega`** (gestão/dono): `os_id` ou `numero`, `km_saida` (obrigatório), `garantia_dias` (padrão da config, 90; 0 = sem garantia), `proxima_revisao_km`, `proxima_revisao_data`. Grava `entregue_em`, `km_saida`, `garantia_ate` (data de hoje + dias, fuso de São Paulo) e, se a OS está em PRONTO_PARA_RETIRADA, move para FINALIZADO no mesmo update. Em outra etapa registra a entrega e **não** mexe na etapa (`finalizada: false`). CANCELADO → `etapa_invalida`; entrega já registrada → `conflito` (não sobrescreve).
- **`registrar_checkin`** aceita `tem_estepe`, `estado_estepe`, `tem_macaco`, `tem_chave_roda`, `avarias` (sim/não aceitam `true/false`, "sim", "não"). Se a migração ainda não foi aplicada, grava no formato antigo com esses dados no texto dos pertences (ver o relatório do Lovable).
- **Número da OS** (`numero` e `numero_fmt` "0042") em toda saída de OS: `abrir_os`, `status_do_carro`, `ver_os`, `buscar`, `enviar_orcamento`, `registrar_entrega` e `dados_documento`. Qualquer ação que recebe `os_id` aceita também o número ("42", "OS 42", "0042", `numero: 42`); `ver_os` e `dados_documento` também aceitam `numero`. `buscar` com o termo "OS 42" / "42" / "0042" acha a OS. `ver_os` agora traz entrega, garantia e os campos novos do check-in.
- **`anexar_foto`:** a `legenda` agora também entra no nome do arquivo (`<tipo>__<legenda>__<timestamp>.<ext>`), de onde o `dados_documento` a lê (a tabela não tem coluna de legenda). Ver "TODO: marcar avaria" no relatório do Lovable.

## Para a sessão do MCP

- Os schemas do MCP precisam declarar: `registrar_entrega`, `dados_documento` e os campos novos de `registrar_checkin`. `dados_documento` aceita `numero` além de `os_id` e `placa`.
- Erros possíveis do `dados_documento`: `dados_invalidos` (tipo ou alvo ausente), `sem_permissao`, `nao_encontrado`, `etapa_invalida`.
- Código de erro `conflito` (já usado antes) também sai de `registrar_entrega`.
