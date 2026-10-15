# Arnaldo: Parte B (Hermes), relatório

Executada em 15/10/2026 (tarde), direto em `main`. O Arnaldo **continua calado**: `PAUSA` intacto, gateway não reiniciado,
`.env` e `WHATSAPP_FORWARD_OWNER_MESSAGES` não tocados, nenhuma mensagem enviada, nenhum outro perfil alterado.

## Commits

garageflow-pro (`main`):

| tarefa | commit |
|---|---|
| B1 versiona o plugin como está no servidor | `chore(hermes): versiona o plugin md_arnaldo como esta no servidor` |
| B2 ferramentas `oficina` com chamador assinado | `feat(md_arnaldo): ferramentas da oficina com chamador assinado` |
| B3 humano assumiu | `feat(md_arnaldo): Arnaldo sai da conversa quando a oficina digita pelo celular` |
| B4 MCP `oficina` | `feat(hermes): MCP oficina` |
| B5 SOUL, skills, config, deploy, README | `feat(hermes): SOUL, skills e deploy do Arnaldo com o sistema` |

lanchas-show (branch `fix/followups-2-toques`, **não** empurrada): `5e9d065 feat(vigia): inventaria arnaldo/oficina`, só o
`hermes/vigia/inventario.yaml`. O arquivo tinha edições não commitadas de outra sessão (entrada `watchdog-isabelle`); o commit
levou só a minha parte (staged por blob), a edição alheia continua no working tree, intacta.

## O que foi instalado no servidor (perfil `arnaldo-md-mecanica`)

SHA-256 conferido igual ao do repo em `core.py`, `__init__.py`, `SOUL.md`, `server.mjs`, `tools.mjs`.

- `SOUL.md` novo (sem a seção "AINDA não consegue" e sem "não tem sistema ligado"; com a seção "O sistema da oficina").
- `plugins/md_arnaldo/` (inclui `tests/`, como já era no servidor, para o pytest rodar no lugar).
- `mcp/oficina-mcp/` com `node_modules` (`npm ci --omit=dev` no node do Hermes; `npm audit` aponta 1 vulnerabilidade alta, mesma árvore de dependências do MCP da Isabelle).
- `skills/md-mecanica/{atendimento-cliente,agenda,checkin-e-os,gestao-financeiro}`.
- `config.yaml`: `mcp_servers.oficina` + `compression.threshold_tokens` 140000 → 60000 (única diferença além disso: nenhuma; validado com `yaml.safe_load` antes e depois e comparação estrutural).
- Poda: 98 → 4 skills do Arnaldo + `productivity/rotinas-e-lembretes` (ver desvio 2).

### Backups criados

| o quê | onde |
|---|---|
| SOUL, config.yaml, .env, plugins | `/dados/backups/arnaldo-20261015-175952.tgz` |
| config.yaml | `<perfil>/config.yaml.bak-oficina-20261015-175956` |
| skills (antes da poda) | `<perfil>/skills.bak-20261015.tgz` (2 MB) |
| skills movidas (não apagadas) | `<perfil>/skills.removidas-20261015/` |

## Verificado

- **pytest do plugin dentro do container: 58 passed** (os 30 antigos + `test_oficina.py` + `test_humano_assumiu.py`). Localmente também 58.
- **`node --test` do MCP dentro do container: 12/12** (inclui recusa de symlink, que no Windows foi "skipped").
- **`hermes --profile arnaldo-md-mecanica mcp test oficina`: conectou (1,0 s) e listou as 19 ferramentas P0.**
- `hermes ... skills list`: 5 skills locais, todas enabled.
- O plugin importa e `register()` instala os 5 ganchos num Python do container, e `decide_tool_call` devolve `modify` para cliente em `agendar`.
- Vetor HMAC fixo `11f0e64a…056e` testado em pytest (B2), igual ao vitest da A1 (a outra sessão).
- Gateway intocado: no `gateway.log` as mensagens reais de clientes seguem sendo puladas pelo `PAUSA` (ex.: 17:56).

## Desvios do plano (e por quê)

1. **Branch/worktree**: instrução do Opus; tudo direto em `main`.
2. **Poda**: o plano diz "mover tudo que não for md-mecanica". Mantive `productivity/rotinas-e-lembretes`, que não é de upstream (skill própria, ver memória "Rotinas auto-ajustáveis"). O resto de `productivity` foi movido. Datas de backup usam a data do servidor (15/10), não 16/10.
3. **Filtro de saída do plugin (`filtrar_saida`)**: a palavra "orçamento" sozinha estava na lista de vazamento de dinheiro. Com o novo fluxo o Arnaldo precisa dizer "seu orçamento está aguardando aprovação, o link é este" ao cliente; o filtro trocaria essa resposta por "Valor quem passa é a Dona Simone". Tirei só a palavra "orçamento" (número em reais, `%`, margem, lucro, faturamento e desconto continuam barrados) e ajustei o teste antigo.
4. **Teste antigo** `test_ferramentas_bloqueadas_por_enquanto` trocado, porque a assinatura de `decide_tool_call` mudou como o plano manda.
5. **Pasta do cache de imagens**: o plano diz `image_cache/`; a imagem recebida cai em `<perfil>/cache/images/img_*.jpg` (confirmado no `gateway.log`: "Using bridge-cached image"). O MCP aceita essa pasta e, por segurança, também `<perfil>/image_cache` e `/root/.hermes/image_cache`. O argumento da ferramenta é `caminho_imagem` (como no catálogo).
6. **P1 (gestão/financeiro)**: as 6 ferramentas existem em `tools.mjs`, mas **só entram com `ARNALDO_ENABLE_P1=1`** (padrão desligado), porque a API pode não ter essas ações na segunda; ferramenta que a API não conhece só daria `acao_desconhecida`. A skill `gestao-financeiro` avisa o modelo disso.
7. **Auditoria do "humano assumiu"**: grava em `humano-auditoria.jsonl` (tipos `humano_assumiu` e `silencio_humano`), não em `saidas-bloqueadas.jsonl`, que é de saída bloqueada. Além do log `arnaldo humano_assumiu: chat=…` no `agent.log`.
8. **`isError` do MCP**: só `erro_interno`, `token_invalido` e `assinatura_invalida` (e rede/timeout) marcam falha de ferramenta; resposta de negócio (`conflito_agenda`, `sem_permissao`…) vai ao modelo como resposta normal, inteira.

## Para a Parte C (nada disso foi feito)

1. Lipe/Opus: criar os segredos no Lovable (`ARNALDO_API_TOKEN`, `ARNALDO_CALLER_SECRET`, `ARNALDO_APP_URL`) e confirmar com a outra sessão que a `arnaldo-api` responde a `?saude=1`.
2. Gravar no `.env` do perfil (com backup): `ARNALDO_API_URL`, `ARNALDO_API_TOKEN`, `ARNALDO_SUPABASE_ANON`, `ARNALDO_CALLER_SECRET` (os mesmos valores do Lovable) e `ARNALDO_TEST_MODE=1`. Sem `ARNALDO_CALLER_SECRET` o plugin **bloqueia** toda ferramenta `oficina` ("sem configuração de segurança").
3. Reiniciar o gateway (`kill -TERM` do PID achado por `/proc/*/cmdline` no container) e conferir `✓ whatsapp connected`, `arnaldo trava instalada` e o plugin no `agent.log` depois do horário do reinício. O `PAUSA` continua.
4. E2E por `hermes --profile arnaldo-md-mecanica chat --source cli` com `ARNALDO_TEST_CALLER` variando (roteiro do plano), tudo com `[TESTE]`. Foi aí que se prova que o plugin libera `mcp__oficina__*`.
5. Só então ligar `WHATSAPP_FORWARD_OWNER_MESSAGES=true`, reiniciar e fazer a Simone/o Lipe digitar numa conversa de teste: esperado `humano_assumiu` em `humano-auditoria.jsonl` e **nenhum turno** no `agent.log`.
6. Preencher `equipe.json` no servidor (Simone e Márcio estão com `telefone` vazio; só o Lipe está preenchido) com os mesmos números dos perfis do garageflow.
7. Reinstalar o inventário do Vigia no servidor (scp para `/root/.hermes/profiles/vigia/inventario.yaml`). Não foi instalado: o arquivo no working tree do repo lanchas-show tem também a edição não commitada do `watchdog-isabelle`, de outra sessão. O check novo `arnaldo_api_saude` só alarma com 5xx/sem resposta, então é seguro mesmo antes de a API estar publicada.
8. Segunda 07h45: tirar `ARNALDO_TEST_MODE`, apagar o `PAUSA`, acompanhar `gateway.log`/`agent.log`.
9. Decisão do Lipe: com o `PAUSA` ativo o plugin descarta mensagens de cliente, mas o código de PAUSA (como já era) não cobre a mensagem em fila de turno em andamento — hoje irrelevante (nenhum turno roda enquanto pausado), mas vale cobrir no embrulho de `handle_message` se um dia houver turno com PAUSA ligado no meio.

## Limitações conhecidas

- O embrulho "humano assumiu" foi testado com adapter falso (pytest). O caminho real (`whatsapp_from_owner` vindo do bridge, `source.chat_id` do cliente) segue o código do Hermes v0.21.5 lido em `adapter.py:864`/`bridge.js`, mas só o passo 5 acima prova de ponta a ponta.
- Chat com `@lid` que não resolve para telefone: a chave do estado é o próprio `chat_id`, consistente entre a mensagem do dono e a do cliente no mesmo chat.
- Skills de upstream podem voltar com `hermes update` (já aconteceu na Isabelle): conferir `hermes skills list` e repetir `poda-skills-arnaldo.sh`.
