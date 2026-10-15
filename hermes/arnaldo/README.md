# Arnaldo — perfil Hermes da MD Mecânica

Perfil `arnaldo-md-mecanica` no container `hermes-agent-1` (servidorduro).
Criado em 20/09/2026. Mesmo desenho da Isabelle (Lanchas Show), sem o sistema ligado ainda.

## Onde mora cada coisa

| o quê | onde | natureza |
|---|---|---|
| Persona, tom, regras de conversa | `SOUL.md` | prompt — tendência, não garantia |
| Modelo, toolsets, display, STT/TTS, porta do bridge | `config.yaml` | política dura (runtime) |
| Quem é quem (dono / gestão / pátio) | `equipe.json` | dado, recarrega sozinho |
| Sigilo financeiro, debounce, trava de saída, silêncio em grupo | `plugins/md_arnaldo/` | **garantia** (código) |
| Sessão do WhatsApp (Baileys) | `whatsapp/session/` | credencial — não apagar |
| Saídas barradas pela trava | `saidas-bloqueadas.jsonl` | auditoria |
| Mensagens que o debounce não conseguiu devolver | `debounce-perdidas.jsonl` | deveria ficar vazio |

Regra do ecossistema: **prompt (SOUL) = tendência; config/hook/plugin = garantia.** Regra que não pode
falhar não vai para o SOUL.

## O que o plugin garante (não depende do modelo obedecer)

- **Muralha de sigilo financeiro.** O papel vem do número (`equipe.json`), nunca do que a mensagem diz.
  Quem não é `dono` nem `gestao` recebe, em todo turno, um aviso determinístico de sigilo — e se mesmo
  assim a resposta sair com `R$`, percentual, margem, orçamento, lucro ou faturamento, o plugin **troca
  a mensagem inteira** e registra em `saidas-bloqueadas.jsonl`. Número que não está no `equipe.json` é
  tratado como CLIENTE (falha segura).
- **Debounce.** Cliente: 30s de silêncio antes de virar turno. Equipe/pátio: 4s. Teto de 3 min para quem
  não para de digitar. Foto, áudio e documento **não** entram no debounce — eles soltam o texto que
  estava esperando e seguem na hora (mídia picada ainda gera turnos separados; ver pendências).
- **Trava de saída.** Só sai no WhatsApp texto que o modelo escreveu neste turno. Erro de gateway,
  "reiniciando", aviso de provedor, enquete, edição de mensagem e localização: barrados e auditados.
- **Silêncio em grupo.** Em grupo ele só responde se for chamado pelo nome, marcado, ou respondido.
  Se o plugin falhar em grupo, o padrão é silêncio.
- **Sem ferramentas.** Só leitura (`skills_list`, `vision_analyze`…). Qualquer outra é bloqueada — ele
  ainda não tem sistema para mexer.
- **Pausa de manutenção.** `touch PAUSA` na pasta do perfil → nada chega ao modelo. Apagar o arquivo volta.
  (O Hermes não tem pausa nativa por perfil; `gateway.pause` do `start.sh` é global.)

## Parear o WhatsApp de novo

O gateway do Arnaldo só sobe se `whatsapp/session/creds.json` existir e não estiver vazio
(condição no `/dados/hermes-agent-1/config/start.sh`).

```sh
sudo docker exec -d hermes-agent-1 sh -c 'export PATH=/root/.hermes/node/bin:$PATH; node /root/.hermes/pair-tools/pair-arnaldo.js >> /root/.hermes/pair-tools/runner.log 2>&1'
# o QR mais recente vira PNG em /root/.hermes/pair-tools/arnaldo-qr.png (troca a cada ~20s)
sudo docker exec hermes-agent-1 cat /root/.hermes/pair-tools/arnaldo-qr.status
```

Depois de parear, conferir a allowlist: o `hermes whatsapp` às vezes grava a resposta "y" em
`WHATSAPP_ALLOWED_USERS`. Tem que estar `WHATSAPP_ALLOW_ALL_USERS=true` e `WHATSAPP_ALLOWED_USERS=*`
no `.env` do perfil — senão cliente nenhum fala com ele.

## Armadilhas já pagas (não repetir)

- **PATH.** Se o gateway subir sem `/root/.hermes/node/bin` no PATH, o WhatsApp cai com
  "requirements not met" e nada explica por quê. Sempre subir pelo `start.sh`. Isso deixou a Isabelle
  fora do ar por 2 dias.
- **Porta do bridge.** 3001 Manfred, 3002 Ária, 3003 Isabelle, **3004 Arnaldo**. Colidir derruba os dois.
- **Primeiro contato.** Este bridge (Baileys) **não pode** iniciar conversa com número que nunca falou
  com a oficina: o WhatsApp derruba o vínculo em segundos e pode banir o número. Arnaldo só responde.
- **Perfil não herda `.env` da máquina.** Chave nova tem que ser copiada para o `.env` do perfil.
- **YAML com regex:** usar aspas simples (aspas duplas comem a barra invertida).

## Pendências (a fazer)

1. **Números da equipe** no `equipe.json` (Simone = `gestao`, Márcio = `dono`, cada mecânico = `patio`).
   Enquanto estiver vazio, todo mundo é cliente e ninguém vê valor — inclusive a Dona Simone.
2. **Sistema da MD Mecânica**: quando existir API, entra como MCP no `config.yaml` (igual ao servidor
   `lanchas` da Isabelle) e o `decide_tool_call` do plugin passa a liberar `mcp__oficina__*` com
   assinatura de chamador. Aí valem: placa, agenda/box, OS, peças, margem, NF-e/NFS-e, lembretes.
3. **Lembrete de sexta 17h** e demais rotinas: cron do perfil (o laço `cron-tick-loop.sh` já está no
   `start.sh`), só depois que houver agenda de verdade para ler.
4. **Combo próprio no omniroute** (`hermes-arnaldo`): hoje ele usa `hermes-isabelle` emprestado.
5. **Mídia picada**: várias fotos seguidas ainda geram turnos separados.
6. **Áudio de resposta** para o pátio (`voice.auto_tts` por número) — hoje ele só escreve; entende áudio.

## Verificado em producao (20/09/2026, 18h41)

Primeira mensagem real ("Ola", do numero do Lipe): o debounce reconheceu `dono` e segurou 4s, o turno
saiu em 7,4s, e a trava **barrou** o aviso de sistema do proprio Hermes ("No home channel is set for
Whatsapp... /sethome") antes de chegar no WhatsApp. `debounce-perdidas.jsonl` vazio.

Consequencia disso: o Hermes nao tem "home channel" nesse perfil (e nao vai ter, porque o aviso e
ruido). Quando existirem crons, cada um precisa de `deliver: whatsapp:<jid>` explicito, igual aos
briefings da Isabelle — senao a entrega nao acha destino.
