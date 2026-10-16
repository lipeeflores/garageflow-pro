# Documentos da MD gerados pelo Arnaldo: especificação

Data: 15/10/2026. Aprovado pelo Lipe na conversa (visual e desenho técnico). Execução: Sonnet. Revisão: Opus.

## Objetivo

Os donos da MD Mecânica (Simone, administração; Márcio, chefe de oficina) não vão operar o garageflow pelo computador. Eles conversam com o Arnaldo pelo WhatsApp, e ele preenche o sistema e **manda os documentos prontos, com a cara da MD**. São quatro:

| documento | formato | quem recebe | tem valor? |
|---|---|---|---|
| Orçamento | PDF A4 | cliente dono da OS; equipe dono/gestão | sim |
| Ficha de entrada (check-in) | PDF A4 | cliente dono da OS; equipe | não |
| OS do pátio | imagem PNG vertical (1080 px de largura) | equipe (inclusive pátio) | **nunca** |
| Recibo e entrega | PDF A4 | cliente dono da OS; dono/gestão | sim |

Mais uma ferramenta pedida junto: **consulta de placa** (marca, modelo, ano, cor, motor, cidade) para o cadastro sair completo só com a placa.

## Visual (aprovado)

- Modelos de referência: `docs/superpowers/specs/documentos-md/orcamento.mockup.html` (seguir a folha de baixo; cabeçalho **opção A**, "tudo branco") e `.../ficha-recibo-ospatio.mockup.html`. As etiquetas amarelas (`.tag`) dos mockups **não** vão para o documento final.
- Fontes Barlow, Barlow Condensed e Roboto Mono. Paleta: preto `#101012`, vermelho `#b3121b`, cromo `#c8ccd1`. **Sem fundo preto em lugar nenhum** (economia de tinta): cabeçalho branco com logo com contorno fino escuro (`filter: drop-shadow` ×3), fio vermelho/cromo de 3 px, títulos de tabela só com linha de 2 px, total com borda vermelha.
- Logo: `src/assets/logo.png` (722×345, RGBA).
- Dados fixos da empresa: MD Mecânica Multimarcas · CNPJ 05.887.728/0001-09 · (47) 8488-9108 · Rua 248, 721, Meia Praia, Itapema/SC, 88220-000 · mdmultimarcas123@hotmail.com.

## Campos novos no banco

Uma migração aditiva (nada é apagado nem renomeado):

- `work_orders.numero integer`: número sequencial por oficina (OS 0001, 0002…). Trigger `BEFORE INSERT` preenche com `max(numero)+1` do tenant, sob `pg_advisory_xact_lock` pelo tenant. Fazer backfill das OS existentes por `created_at` e criar `UNIQUE (tenant_id, numero)`. No documento aparece com 4 dígitos (`lpad`).
- `work_order_checkins`: `tem_estepe boolean`, `estado_estepe text`, `tem_macaco boolean`, `tem_chave_roda boolean`, `avarias text`. O campo `customer_items` continua sendo os pertences.
- `work_orders`: `km_saida integer`, `entregue_em timestamptz`, `garantia_ate date`, `proxima_revisao_km integer`, `proxima_revisao_data date`.
- Configuração em `tenants.settings.documentos` (JSON, sem migração; o código tem os padrões): `validade_orcamento_dias: 7`, `garantia_dias: 90`, `formas_pagamento: "PIX, cartão ou dinheiro"`, `texto_aprovacao`, `texto_ficha`, `texto_garantia`.

**Como chega ao banco:** o banco é do Lovable Cloud (sem acesso nosso). A migração vai para `supabase/migrations/` pelo GitHub, e o Lipe pede ao Lovable para aplicar. Depois o Lovable regenera o `src/integrations/supabase/types.ts`. O texto do pedido ao Lovable (aplicar a migração e pôr os campos nas telas de check-in e de OS) fica pronto em `docs/superpowers/reports/`.

## Arquitetura

```
WhatsApp ─▶ Arnaldo (Hermes) ─▶ MCP oficina ──(1) dados_documento──▶ arnaldo-api (edge function, Lovable)
                                     │                                   └─ papel do chamador decide o que sai
                                     ├─(2) monta HTML do modelo (templates/*.mjs)
                                     ├─(3) POST ─▶ gotenberg:3000 (container no servidor) ─▶ PDF/PNG
                                     └─(4) grava em <perfil>/cache/documentos/ e devolve o caminho
Arnaldo responde com "MEDIA:<caminho>" ─▶ Hermes manda o arquivo no WhatsApp (send_document / send_image_file)
```

1. **API, ação nova `dados_documento(tipo, os_id | placa | numero)`.** Devolve tudo que o modelo precisa já normalizado (empresa, cliente, veículo, check-in, URLs públicas das fotos `attachments`, diagnóstico, itens, preços, pagamento, entrega, textos da configuração). Regras de papel, aplicadas **na API**:
   - `os_patio`: qualquer equipe. **Nunca** inclui campo de dinheiro, nem para dono (o arquivo vai para o pátio).
   - `orcamento`, `recibo`: dono/gestão/sistema; cliente só da OS do **próprio** veículo. Orçamento só a partir de `AGUARDANDO_APROVACAO`; recibo só com pagamento registrado ou etapa `FINALIZADO`.
   - `ficha_entrada`: equipe; cliente só da própria OS; precisa de check-in.
   - Recusa → `sem_permissao` / `nao_encontrado` / `etapa_invalida`, com o envelope de erro de sempre.
2. **Ações alteradas:**
   - `registrar_checkin` aceita os campos novos (estepe, estado, macaco, chave, avarias);
   - nova `registrar_entrega(os_id, km_saida, garantia_dias?, proxima_revisao_km?, proxima_revisao_data?)` para dono/gestão, que grava `entregue_em`, calcula `garantia_ate` e move para `FINALIZADO` se a etapa permitir;
   - toda saída de OS passa a ter `numero`;
   - `buscar`/`ver_os` aceitam "OS 42" / "42".
3. **Gerador: container `gotenberg/gotenberg:8`** (Chromium dedicado a HTML→PDF/PNG):
   - nome `md-gotenberg`, rede `docker-stacks_default` (a mesma do `hermes-agent-1`), **sem porta publicada**, `--restart unless-stopped`, `--memory 1g`;
   - PDF por `POST /forms/chromium/convert/html` (A4, margem 0, `printBackground`, `waitDelay` 1 s para as fotos);
   - PNG por `POST /forms/chromium/screenshot/html` (largura 1080);
   - entra no inventário do Vigia.
4. **MCP `oficina`, ferramentas novas:**
   - `gerar_documento(tipo, os_id | placa | numero)`: chama `dados_documento`, monta o HTML com `templates/<tipo>.mjs` (funções puras: dados → string HTML; logo e fontes embutidos em base64 para não depender de rede; o QR do orçamento aponta para o link público de aprovação, gerado com o pacote `qrcode`), converte no Gotenberg e grava em `/root/.hermes/profiles/arnaldo-md-mecanica/cache/documentos/<tipo>-OS<numero>-<timestamp>.<ext>`. Devolve `{ok, caminho, nome_arquivo, legenda}`. Arquivos com mais de 30 dias são apagados.
   - `consultar_placa(placa)`: busca em `https://www.tabelafipebrasil.com/placa/<PLACA>` **com `curl`** via `execFile` e User-Agent de navegador (o `fetch` do Node leva 403 do Cloudflare; o `curl` do container passa, testado 15/10). Extrai marca/modelo, ano/modelo, cor, combustível, motor/potência, município/UF. Faz cache em arquivo por 30 dias. Em 403, timeout ou formato desconhecido devolve `{ok:false, erro:"placa_indisponivel"}` e o Arnaldo pergunta ao cliente. Disponível para todos os papéis (é dado público do veículo).
5. **Entrega no WhatsApp:** o modelo escreve a mensagem e, numa linha própria, `MEDIA:<caminho>`; o Hermes manda o arquivo. A trava `md_arnaldo` já embrulha `send_document`/`send_image_file` (só confere a legenda). **Confirmar num teste real** que o arquivo sai e que a trava não o bloqueia.
6. **Para quem:** sempre na conversa em que foi pedido. **Fora de escopo** nesta versão: mandar para um terceiro ("manda pro João"). O Arnaldo entrega o arquivo a quem pediu, para encaminhar, e nunca inicia conversa.

## Habilidade e SOUL do Arnaldo

Skill nova `md-mecanica/documentos`:
- quando gerar cada documento: ficha logo depois do check-in, orçamento ao chegar em aguardando aprovação, OS do pátio ao aprovar ou quando o Márcio pedir, recibo na entrega;
- como mandar (`MEDIA:`);
- nunca mandar orçamento ou recibo num grupo sem `financeiro: true`, nem para pátio.

A skill `checkin-e-os` passa a pedir estepe, macaco e chave e a usar `consultar_placa` antes de pedir marca e modelo ao cliente.

## Testes

- vitest da API: cada tipo × cada papel (incluindo `os_patio` sem dinheiro mesmo para dono, e cliente pedindo documento de outra placa); `registrar_entrega`; número da OS.
- `node --test` do MCP:
  - cada template gera HTML com os campos esperados;
  - o template `os_patio` não contém `R$` nem número com vírgula decimal;
  - parser de placa com HTML salvo como fixture (sem rede);
  - `gerar_documento` com Gotenberg e API falsos.
- Ponta a ponta no servidor (Parte C): gerar os 4 documentos de uma OS `[TESTE]` de verdade e mandar **no grupo MD Gerência** (é onde o Lipe e os donos olham), conferindo o arquivo recebido. Apagar os dados de teste depois.

## Dependências do Lipe

1. Pedir ao Lovable para aplicar a migração (texto pronto no relatório).
2. Pedir ao Lovable para publicar a `arnaldo-api` de novo depois de cada mudança.
3. Preencher o telefone da Simone (98488-9113) e do Márcio (98488-9097) nos usuários deles no garageflow, com papel Admin. Sem isso a API trata os dois como cliente.
