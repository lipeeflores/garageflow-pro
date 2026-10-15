# Hermes: o lado do Arnaldo (MD Mecânica)

Tudo que roda no servidor (servidorduro) para o Arnaldo operar o garageflow. A API que ele chama
fica em `supabase/functions/arnaldo-api/` (edge function). Plano completo:
`docs/superpowers/plans/2026-10-15-arnaldo-secretario.md`.

## Onde mora cada coisa

| aqui no repo | no servidor (`/dados/hermes-agent-1/config/profiles/arnaldo-md-mecanica/`) | o que é |
|---|---|---|
| `hermes/arnaldo/SOUL.md` | `SOUL.md` | personalidade e regras de conduta |
| `hermes/arnaldo/equipe.json` | `equipe.json` | quem é quem pelo número (muralha de sigilo do plugin). **Só versionado como referência: o do servidor é o que vale** (o Lipe preenche na Parte C) |
| `hermes/arnaldo/README.md` | `README.md` | README antigo do perfil (cópia) |
| `hermes/arnaldo/skills/md-mecanica/*` | `skills/md-mecanica/*` | procedimentos: atendimento-cliente, agenda, checkin-e-os, gestao-financeiro |
| `hermes/plugins/md_arnaldo/` | `plugins/md_arnaldo/` | blindagem: papel por número, sigilo de valor, debounce, trava de saída, **chamador assinado (HMAC)** nas ferramentas, **"humano assumiu"** |
| `hermes/mcp/oficina-mcp/` | `mcp/oficina-mcp/` | MCP stdio `oficina`: cada ferramenta vira um POST na `arnaldo-api` |
| `hermes/scripts/config_oficina.py` | (roda dentro do container) | acrescenta `mcp_servers.oficina` e `compression.threshold_tokens: 60000` ao `config.yaml` |
| `hermes/scripts/deploy-arnaldo.sh` | — | instala tudo isso no perfil, com backup |
| `hermes/scripts/poda-skills-arnaldo.sh` | — | move (não apaga) as skills genéricas |

## Deploy

Do Windows, em Git Bash, na raiz do repo:

```bash
bash hermes/scripts/deploy-arnaldo.sh        # backup + copia + npm ci + config.yaml
bash hermes/scripts/poda-skills-arnaldo.sh   # tar de backup + move skills genéricas (uma vez; repetir depois de hermes update)
```

O deploy **não** reinicia gateway, **não** mexe em `.env` nem em `PAUSA` e nunca faz `rm -rf` em `skills/`.
O plugin só é recarregado no próximo reinício do gateway (Parte C). Backups: `/dados/backups/arnaldo-<carimbo>.tgz`
(SOUL, config, .env, plugins, skills/md-mecanica, mcp), `config.yaml.bak-oficina-<carimbo>` no perfil,
`skills.bak-<data>.tgz` e `skills.removidas-<data>/` no perfil.

Para voltar um deploy: extrair o `.tgz` de `/dados/backups/` por cima do perfil (`sudo tar xzf ... -C <perfil>`),
e o `config.yaml.bak-oficina-*` por cima do `config.yaml`.

## Variáveis do MCP (`.env` do perfil, **Parte C**)

| variável | para que serve |
|---|---|
| `ARNALDO_API_URL` | `https://jodyrgwdpxrjlglepzjh.supabase.co/functions/v1/arnaldo-api` |
| `ARNALDO_API_TOKEN` | segredo de serviço (cabeçalho `x-arnaldo-token`); o mesmo valor do segredo do Lovable |
| `ARNALDO_SUPABASE_ANON` | publishable key do projeto (`Authorization: Bearer`), só passa pelo gateway se `verify_jwt` for ligado |
| `ARNALDO_CALLER_SECRET` | assina o chamador (HMAC); o plugin lê `os.environ`, o mesmo valor do segredo do Lovable |
| `ARNALDO_TEST_MODE=1` | só em teste: com `--source cli`, a identidade vem de `ARNALDO_TEST_CALLER`. **Tirar antes de ir ao ar** |
| `WHATSAPP_FORWARD_OWNER_MESSAGES=true` | só depois do plugin carregado (ver abaixo) |
| `ARNALDO_ENABLE_P1=1` | só se a API tiver as ações de gestão/financeiro (precificar_itens, enviar_orcamento…). Padrão: desligado |

O `config.yaml` referencia as três primeiras como `${ARNALDO_...}`; o `ARNALDO_CALLER_SECRET` vai para o
ambiente do gateway (o plugin roda no processo do gateway, não no MCP).

## "Humano assumiu"

Com `WHATSAPP_FORWARD_OWNER_MESSAGES=true`, o que a Simone digita pelo celular da oficina chega ao Hermes com
`metadata.whatsapp_from_owner`. O embrulho de `adapter.handle_message` (md_arnaldo `__init__.py`):

- descarta a mensagem do dono (**nunca** vira turno), registra o chat em `humano-assumiu.json` e audita `humano_assumiu` em `humano-auditoria.jsonl`;
- enquanto houver registro com menos de 4 h (`HUMANO_TTL_S`) e do mesmo dia (meia-noite de Brasília), descarta as mensagens do cliente nesse chat, audita `silencio_humano` e guarda o texto em `humano-feed.jsonl`;
- equipe (papel diferente de cliente, via `equipe.json`) nunca é silenciada; grupo não se aplica.

Não há comando para liberar. **Ligar a flag só depois de o plugin estar carregado** (`agent.log`: `arnaldo trava instalada`);
sem isso a mensagem da Simone vira turno do Arnaldo.

## Verificação (sem WhatsApp)

```bash
S="ssh -i ~/.ssh/servidor_lipe lipeeflores@100.67.51.23"
P=/root/.hermes/profiles/arnaldo-md-mecanica
# plugin (pytest, dentro do container)
$S "sudo docker exec -w $P/plugins/md_arnaldo -e PYTHONDONTWRITEBYTECODE=1 hermes-agent-1 python -m pytest -q -p no:cacheprovider"
# MCP (node --test, dentro do container)
$S "sudo docker exec -w $P/mcp/oficina-mcp hermes-agent-1 /root/.hermes/node/bin/node --test test/server.test.mjs"
# o MCP sobe e lista as 19 ferramentas (não passa pelo plugin!)
$S "sudo docker exec hermes-agent-1 hermes --profile arnaldo-md-mecanica mcp test oficina"
# skills vistas pelo Hermes (esperado: 4 md-mecanica + rotinas-e-lembretes)
$S "sudo docker exec hermes-agent-1 hermes --profile arnaldo-md-mecanica skills list"
```

Localmente (Windows): `cd hermes/plugins/md_arnaldo && python -m pytest -q` (precisa de `pip install tzdata`) e
`cd hermes/mcp/oficina-mcp && npm ci && npm test`.

`hermes mcp test` **não prova** que o plugin libera `mcp__oficina__*`: isso só se prova com um turno de verdade
(`hermes --profile arnaldo-md-mecanica chat --source cli`, com `ARNALDO_TEST_MODE=1` e `ARNALDO_TEST_CALLER`).
Não use `-q` sozinho: vira sessão `oneshot` e ignora a variável.

## Armadilhas

- Gravar `.py`/`.mjs`/`.sh` com o editor e mandar por `scp`/`tar`; heredoc no Bash do Windows estraga `\` e `\n`.
- A hora do PC pode vir em UTC: pegue carimbos do servidor (`TZ=America/Sao_Paulo date`).
- Mensagem que chega com turno em andamento pula `pre_gateway_dispatch`: filtros de entrada ficam no `adapter.handle_message`.
- O Hermes pode recolocar skills de upstream a cada `hermes update`: rodar `hermes skills list` e repetir a poda.
- O filtro de saída do plugin (`filtrar_saida`) já não trata a palavra "orçamento" como vazamento (o Arnaldo manda o link do
  orçamento ao cliente). Segue barrando número em reais, `%`, margem, lucro, faturamento e desconto para quem não vê dinheiro.
