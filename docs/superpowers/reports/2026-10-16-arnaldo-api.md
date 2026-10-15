# Relatório: arnaldo-api (Parte A do plano 2026-10-15)

Executor: Claude Sonnet 5.5. Tudo em `main`. Último commit da função: `01bd11c` (VERSAO `a5-2026-10-15T18:05-03:00`).

## Resumo

- **A0 a A5 feitas e empurradas.** `npx vitest run src/test/arnaldo`: **94 testes verdes** em 5 arquivos.
- **A função NÃO está publicada.** O curl de saúde ainda devolve `404 Requested function was not found` mais de 15 minutos depois do push (as outras funções do projeto respondem). O Lovable não pegou a `arnaldo-api` que chegou pelo GitHub. **O Lipe precisa pedir a publicação no chat do Lovable** (texto abaixo).
- **A6 (P1, financeiro) NÃO foi feita**, de propósito: a regra era só depois de A5 no ar e verde, e A5 não está no ar.
- Os passos 3 e 4 da A5 que dependem de produção (curl de saúde com a versão nova, POST sem token → 401) **não foram verificados**. O comportamento está coberto localmente por `handler.test.ts` (saúde sem token e sem tocar no banco; POST sem token ou com token errado ou sem token configurado → 401).

## O que o Lipe precisa fazer agora

Abrir o projeto no Lovable e pedir: *"Publique a edge function arnaldo-api que chegou pelo GitHub"*. Depois conferir:

```
curl -s "https://jodyrgwdpxrjlglepzjh.supabase.co/functions/v1/arnaldo-api?saude=1"
```

Esperado: `{"ok":true,"versao":"a5-2026-10-15T18:05-03:00"}` (ou a versão de um commit mais novo). Em seguida:

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://jodyrgwdpxrjlglepzjh.supabase.co/functions/v1/arnaldo-api" -H "content-type: application/json" -d "{}"
```

Esperado: `401` (e, com o token ainda não criado, qualquer POST dá 401: a porta fica fechada).

Se o curl de saúde der `401` em vez de 200, o Lovable religou o `verify_jwt`: repetir com `-H "authorization: Bearer <VITE_SUPABASE_PUBLISHABLE_KEY do .env>"`.

## Header anon é obrigatório?

**Não deu para saber** (a função não está publicada, então não há resposta para testar). O `supabase/config.toml` tem `[functions.arnaldo-api] verify_jwt = false`. Se o Lovable respeitar, não é obrigatório; se sobrescrever, é. O MCP já manda `authorization: Bearer <anon>` de qualquer forma, então funciona nos dois casos.

## Segredos que o Lipe cria no Lovable (Cloud → Secrets)

Nomes apenas; nenhum valor foi para o git.

| nome | o que é |
|---|---|
| `ARNALDO_API_TOKEN` | 48 caracteres aleatórios (`openssl rand -hex 24`). O MCP manda em `x-arnaldo-token`. Sem ele a função devolve 401 |
| `ARNALDO_CALLER_SECRET` | 48 aleatórios, **outro** valor. Chave do HMAC da identidade do chamador (o plugin `md_arnaldo` assina com ela) |
| `ARNALDO_APP_URL` | URL publicada do app, sem barra no fim. Usada no `link_orcamento` |

Sem `ARNALDO_API_TOKEN` configurado a função recusa tudo (401); sem `ARNALDO_CALLER_SECRET` toda chamada dá `assinatura_invalida`. Sem `ARNALDO_APP_URL`, `status_do_carro` simplesmente não devolve `link_orcamento`. Os valores vão ao Lipe pelo chat e ao servidor só na Parte C.

Também precisa existir no banco o tenant com `slug = 'md-mecanica'` (a função o resolve por esse slug a cada chamada; se faltar, toda ação dá `erro_interno`).

## Ações implementadas (19 de 25)

P0 completo, 19 ações, todas com `reason` ignorado e dinheiro removido na API quando o papel não vê: `quem_sou`, `meus_dados`, `cadastrar_cliente_veiculo`, `status_do_carro`, `horarios_livres`, `agendar`, `meus_agendamentos`, `remarcar`, `cancelar_agendamento`, `agenda_do_dia`, `buscar`, `ver_os`, `abrir_os`, `registrar_checkin`, `anexar_foto`, `registrar_diagnostico`, `adicionar_itens`, `mover_etapa`, `atribuir`. (São 19; os demais itens do catálogo P1 ficaram de fora.)

**Ficaram de fora (A6, P1):** `precificar_itens`, `enviar_orcamento`, `controle_qualidade`, `registrar_pagamento`, `resumo_financeiro`, `contas_a_pagar`. Como o roteador devolve `acao_desconhecida` para elas, o MCP/SOUL não devem anunciá-las até a A6 existir.

## Estrutura

- `supabase/functions/arnaldo-api/index.ts`: só o wrapper Deno (único import de esm.sh).
- `supabase/functions/_shared/arnaldo/handler.ts`: todo o atendimento HTTP (CORS, saúde, token, caller assinado, tenant, papel, despacho). Foi separado do `index.ts` para ser testável com vitest.
- Resto de `_shared/arnaldo/`: `phone`, `caller`, `roles`, `money`, `workflow`, `agenda`, `db`, `util`, `os`, `router`, `actions/*` como no mapa do plano.
- Testes: `src/test/arnaldo/{puros,workflow-agenda,router,os,handler}.test.ts`, mais `fakeDb.ts` e `fixtures.ts`. Os casos de A4 ficaram em `os.test.ts` (não acrescentados ao `router.test.ts`) para dividir as fixtures.
- Imports com extensão `.ts` funcionam no vitest sem mexer no `vitest.config.ts`. `tsc -p tsconfig.app.json`: 2 erros, os dois antigos (`useAppointments.ts:225`, `useVehicles.ts:127`); nenhum novo.

## Desvios do plano e decisões (a outra sessão precisa saber)

1. **Código de erro `conflito`**: o plano usa `conflito` nas ações (`cadastrar_cliente_veiculo` com placa de outro cliente; segundo `registrar_checkin`), mas a lista do contrato HTTP não o inclui. Implementei `conflito` como o texto do plano manda. O MCP repassa a resposta inteira, então não quebra nada, mas a lista de códigos do contrato deveria ganhar `conflito`.
2. **`dados` como lista**: `meus_agendamentos` e `agenda_do_dia` devolvem **array** em `dados` (como o catálogo diz `[...]`), apesar de o contrato falar em "objeto". Cada item de `agenda_do_dia` leva `status` (AGENDADO/CHEGOU/NAO_COMPARECEU), para misturar os faltosos dos 3 dias anteriores.
3. **Papel `sistema`** (cron): o catálogo só o lista em `quem_sou`. Liberei também, só para leitura, `status_do_carro`, `horarios_livres`, `agenda_do_dia`, `buscar` e `ver_os`. Nenhuma ação de escrita aceita `sistema` (as que exigem ator ficam vetadas, como no plano).
4. **Caminho da foto em `anexar_foto`**: usei o formato que o app já usa (`work-orders/<os_id>/<tipo em minúsculas>/<ts>-<id curto>.<ext>`, igual ao `PhotoUpload.tsx`) e não `${tenant}/${os_id}/${uuid}`, como o plano mandou conferir. A tabela `attachments` não tem coluna de legenda: `legenda` vira um evento `NOTA_ARNALDO` na OS.
5. **Telefone gravado em `customers.phone_number`**: DDD + número, sem o `55` (11 dígitos), que é o formato que o app já assume (`PendingTasksAlert` acrescenta o 55). A busca normaliza em JS os dois lados, então telefones salvos em qualquer formato casam.
6. **`registrar_diagnostico`** a partir de CHECKIN_CONCLUIDO passa por EM_DIAGNOSTICO e chega em AGUARDANDO_ORCAMENTO (dois updates, dois eventos). Fora dessas etapas, grava o laudo e não mexe na etapa.
7. **`registrar_checkin`** só move a etapa se a OS ainda está em AGUARDANDO_CHECKIN (não rebaixa uma OS adiantada). O app faz `upsert` no check-in; aqui o segundo check-in é `conflito`, como o plano pede.
8. **Grade de agenda**: `horarios_livres` trata `ate` como dia inclusivo (máx. 14 dias, `de` + 13). `agendar`/`remarcar` recalculam a vaga naquele minuto; horário fora da grade, no passado ou lotado dá `conflito_agenda` com até 3 alternativas do dia (sem repetir o horário pedido).
9. O evento de mudança de etapa gravado pelo trigger do banco leva `actor_id = auth.uid()`, que é nulo com a service role. Por isso `mover_etapa` com `observacao` grava um evento `NOTA_ARNALDO` com o `actor_id` do ator. Sem observação, quem mudou a etapa não fica registrado no evento.

## Ambiente e riscos

- `npm ci` falha neste repo: `package-lock.json` está fora de sincronia com o `package.json`. Usei `npm install --no-package-lock`; nenhum lockfile foi alterado.
- `deno` não existe nesta máquina, então a função **não foi checada nem rodada em Deno**; só o mesmo código em Node/vitest. Riscos específicos de Deno: o Lovable precisa empacotar `../_shared/arnaldo/*` (padrão `_shared` do Supabase) e o `import` de esm.sh. Se a publicação der erro de build, o log do Lovable dirá qual.
- Esta pasta é compartilhada com a outra sessão (Parte B): os commits de `hermes/` estão intercalados com os meus em `main`. Só dei `git add` nos meus caminhos.
- Nada foi gravado nem apagado no banco de produção (não há acesso); os testes usam só o `fakeDb`.
