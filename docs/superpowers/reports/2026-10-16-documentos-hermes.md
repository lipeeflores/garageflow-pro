# Documentos da MD: Parte D2 (gerador e MCP), relatório

Executada em 15/10/2026 (noite), direto em `main`. **Nenhum gateway foi reiniciado e nenhuma mensagem foi enviada.** Os 4 documentos de exemplo
estão em `docs/superpowers/reports/documentos-exemplo/` (fora do git, no `.gitignore`): `orcamento.pdf`, `ficha_entrada.pdf`, `os_patio.png`, `recibo.pdf`,
gerados pelo **Gotenberg real** a partir das fixtures do contrato, com fotos de mentira (silhuetas em SVG).

## Commits

garageflow-pro (`main`):

| commit | o que tem |
|---|---|
| `feat(hermes): container md-gotenberg e templates dos 4 documentos da MD` | `hermes/server/md-gotenberg.sh`, `templates/*.mjs` (+ fontes e logo), fixtures, `gerar-exemplo.mjs`, `qrcode` no `package.json` |
| `feat(hermes): gerar_documento e consultar_placa no MCP oficina …` | `documentos.mjs`, `placa.mjs`, `server.mjs`, `tools.mjs`, testes; plugin: `CLIENT_TOOLS` |
| `feat(hermes): skill documentos, ajustes em checkin-e-os/atendimento-cliente, SOUL e deploy …` | skills, SOUL, README, deploy com trava |

lanchas-show (branch `fix/followups-2-toques`, sem push): `70798ed feat(vigia): inventaria md-gotenberg e as ferramentas locais do MCP oficina`, só o `inventario.yaml` (de novo por staging de blob, sem levar a edição alheia do `watchdog-isabelle`). **Não instalado no servidor.**

## O que está no ar (sem reiniciar nada)

- **Container `md-gotenberg`** (`gotenberg/gotenberg:8`, rede `docker-stacks_default`, `--restart unless-stopped`, `--memory 1g`, sem `-p`). `curl http://md-gotenberg:3000/health` de dentro do `hermes-agent-1` responde `up`. PDF (`%PDF`) e PNG (`\x89PNG`) conferidos. O script `md-gotenberg.sh` é idempotente (rodado duas vezes: a 2ª "nada a fazer").
- **MCP `oficina`: 22 ferramentas** (`mcp test oficina` conecta e lista). Novas: `gerar_documento`, `consultar_placa`, `registrar_entrega`; `registrar_checkin` aceita `tem_estepe`, `estado_estepe`, `tem_macaco`, `tem_chave_roda`, `avarias`; `os_id` aceita o número da OS (a API já aceita).
- Plugin: `consultar_placa` e `gerar_documento` em `CLIENT_TOOLS`, com teste (65 testes pytest verdes, também dentro do container).
- Skill `documentos`, ajustes em `checkin-e-os` e `atendimento-cliente`, uma frase no SOUL. `hermes skills list`: 5 `md-mecanica` + `rotinas-e-lembretes` (o Hermes recolocou a `github` de upstream, ver "Pendências").
- `consultar_placa` rodou **de verdade** de dentro do container (curl, sem 403): SXJ6H55 → Land Rover DEF110 PHEV X 2024, preta, Itapema/SC.
- `gerar_documento` rodou de verdade no container para os 4 tipos (API falsa, Gotenberg real, curl real): arquivos criados com permissão 644 e bytes mágicos certos.

## Testes

- `node --test` do MCP: 48 testes (47 passam, 1 "skipped": symlink no Windows; no container passa 100%): templates (campos, **os_patio sem `R$` nem `\d+,\d{2}`**, escape de `<script>`, orçamento sem link, limites de fotos, avarias por último, recibo parcial), `gerar_documento` com API e Gotenberg falsos (rota/campos do Gotenberg, erro da API repassado inteiro, Gotenberg fora → `gerador_indisponivel`, limpeza só dos nossos arquivos), `consultar_placa` (parser contra o HTML real salvo, curl falso, cache 30 dias, 403/Cloudflare/timeout → `placa_indisponivel`).
- No container o `node --test` precisa do glob (`sh -c 'node --test test/*.test.mjs'`): o `node 22` não aceita pasta.

## Desvios e decisões (leia)

1. **Destino dos arquivos: `<perfil>/cache/documents/`, não `cache/documentos/`.** O Hermes entrega `MEDIA:` sempre de `cache/{images,audio,videos,documents,screenshots}`; as outras pastas dependem do modo de entrega. Testei `validate_media_delivery_path` no container: hoje as duas pastas entregariam (modo padrão não-estrito), mas `documents` vale também com `HERMES_MEDIA_DELIVERY_STRICT=1`. O `/root` está na lista de negados.
2. **Nome do arquivo sem timestamp**: `Orcamento-OS0042-MD-Mecanica.pdf`, `Ficha-de-entrada-OS0042-MD-Mecanica.pdf`, `OS-do-patio-OS0042-MD-Mecanica.png`, `Recibo-OS0042-MD-Mecanica.pdf`. É o nome que o cliente vê no WhatsApp; regerar sobrescreve. `nome_arquivo` é o mesmo nome (sem espaços, para o `MEDIA:` não quebrar). A limpeza de 30 dias só apaga arquivos que batem com esse padrão (a pasta é compartilhada com os documentos recebidos pelo Hermes).
3. **Resposta do `gerar_documento`** tem também `como_enviar` (a instrução do `MEDIA:` com o caminho já montado).
4. **Visual** (cabeçalho A, tudo branco, sem as etiquetas `.tag`): fiel aos mockups, com: logo com contorno (`drop-shadow` ×3), fio vermelho/cromo, títulos de tabela só com linha, total com borda vermelha, avarias em vermelho. Mantive do mockup a faixa escura translúcida da **legenda sobre cada foto** e o chip vermelho cheio "Prioridade alta" da OS do pátio (não são fundo de página). Espaçamentos foram apertados em relação ao mockup para o orçamento caber **em 1 página A4** com 6 fotos e 5 itens; com mais itens ele continua em página 2 sem cortar linha (`break-inside: avoid`).
5. **OS do pátio**: 1080 px de largura (o `.cel` do mockup ×3 com `zoom`), altura automática (o screenshot do Gotenberg pega a página inteira). Além do mockup, mostra "Cliente: nome" sob o carro (o spec pede o nome em todos) e separa por linha o aviso "Atenção". **Defesa extra**: o template apaga "R$ 500" e "300 reais" digitados à mão em texto livre (queixa, laudo, descrição), porque a API só remove os campos de dinheiro, não texto livre.
6. **Recibo**: não prometi "O Arnaldo lembra você pelo WhatsApp" (o mockup tinha): ele não manda mensagem ativa. O texto virou "Revisão em 108.450 km ou até 15/04/2027." Recibo parcial mostra "PAGO PARCIAL", já pago e saldo.
7. **Datas**: "Emissão" no orçamento é a data de geração (o contrato não tem `emitido_em`).
8. `consultar_placa` devolve `ano` = ano do modelo (e `ano_fabricacao`); não devolve o chassi (a fonte mascara: `*****2304873`).
9. As fixtures usam `fixture:frente` etc. como URL de foto; o `gerar-exemplo.mjs` troca por SVG em data URI. Em produção as fotos são URLs públicas do Supabase e o Gotenberg precisa de internet (tem; `waitDelay` de 1 s).

## ⚠ Quase-acidente no deploy (resolvido, mas o Opus precisa saber)

Entre ~21:19 e ~21:20 BRT o **meu deploy sobrescreveu `plugins/md_arnaldo/__init__.py` e `core.py` no servidor com a versão do repo, que não tinha o `responder_tudo`** que a sessão do servidor tinha posto à mão depois da minha última cópia. Percebi na conferência do backup (`/dados/backups/arnaldo-20261015-211924.tgz` guarda a versão deles), puxei os dois arquivos de volta para o repo, reaplicei só o meu `CLIENT_TOOLS` e redeploy (`212025`); conferido: `responder_tudo` presente no servidor e SHA igual ao repo. Se o gateway reiniciou nesse intervalo de ~1 min, ele carregou a versão sem `responder_tudo`: vale conferir no `agent.log`.

Correção de processo: o `deploy-arnaldo.sh` agora grava `.deploy-arnaldo.sha256` no perfil e **aborta** (exit 3, lista os arquivos) se algum arquivo de código/skill/SOUL do servidor mudou desde o último deploy; `FORCE=1` passa por cima. `equipe.json`, `.env` e `config.yaml` nunca são sobrescritos (o `config_oficina.py` só mexe em `mcp_servers.oficina` e `compression`, e foi no-op nas duas vezes).

## Pendências e para a Parte D3

1. **O gateway em execução tem o MCP `oficina` antigo.** O processo filho do MCP sobe com o gateway; o que está rodando (reiniciado antes dos meus deploys) provavelmente tem as 19 ferramentas antigas, sem `gerar_documento`/`consultar_placa`/`registrar_entrega`. O SOUL e as skills novos já estão em disco e falam dessas ferramentas. **Reiniciar o gateway** (Opus) para carregar o MCP novo; até lá o modelo pode tentar chamar uma ferramenta que ainda não existe na sessão.
2. **A trava de saída com `MEDIA:` não foi provada com WhatsApp.** Pela leitura do código a trava só confere a legenda em `send_document`/`send_image_file` e o texto que sobra depois de tirar o `MEDIA:` já está "aprovado" (o texto da resposta inteira é aprovado). Confirmar no E2E real (CLI primeiro, depois no grupo MD Gerência).
3. **Segredos no `.env`** para o MCP falar com a API: `ARNALDO_API_URL`, `ARNALDO_API_TOKEN`, `ARNALDO_SUPABASE_ANON`, `ARNALDO_CALLER_SECRET` (ver `hermes/README.md`). `consultar_placa` funciona mesmo sem eles; `gerar_documento` não.
4. **`ARNALDO_ENABLE_P1`**: as ferramentas P1 de gestão/financeiro seguem desligadas por padrão no MCP. Se a A6 estiver publicada, ligar.
5. **Fotos de avaria**: o contrato diz que `fotos[].avaria` vem da legenda ("avaria"). O app ainda não marca avaria no `attachment_type`. **TODO** (da API/Lovable): marcar avaria na foto.
6. **Skill `github` de upstream voltou** (e as pastas vazias das categorias): o Hermes recria bundled skills. Custo: 1 skill no prompt. Se incomodar, repetir `poda-skills-arnaldo.sh` (ele só roda 1 vez por dia: usa a data no nome do backup) ou ver config de skills desligadas.
7. Inventário do Vigia: o `md-gotenberg` não tem check ainda (candidato: `http://md-gotenberg:3000/health`).
8. `npm audit` do MCP: 1 vulnerabilidade alta (mesma árvore de dependências do MCP da Isabelle).
