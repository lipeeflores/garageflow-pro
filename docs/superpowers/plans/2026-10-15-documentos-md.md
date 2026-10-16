# Documentos da MD gerados pelo Arnaldo: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans` (ou `subagent-driven-development`). Passos com checkbox.

**Objetivo:** o Arnaldo gera e manda pelo WhatsApp quatro documentos (orçamento, ficha de entrada, OS do pátio, recibo) com o visual aprovado, e consulta placa para preencher o cadastro.

**Especificação (ler inteira antes):** `docs/superpowers/specs/2026-10-15-documentos-md-design.md`. Os modelos visuais estão em `docs/superpowers/specs/documentos-md/*.mockup.html`.

**Arquitetura:** a edge function `arnaldo-api` ganha `dados_documento`, `registrar_entrega` e campos novos. O MCP `oficina` ganha `gerar_documento` (templates HTML → Gotenberg → arquivo) e `consultar_placa`. O Arnaldo manda o arquivo escrevendo `MEDIA:<caminho>` na resposta.

**Tecnologia:** Supabase/Deno + vitest (API); Node 22 + `node --test` (MCP); Docker `gotenberg/gotenberg:8`; Python/pytest (plugin, se precisar).

## Restrições globais

Valem todas as do plano anterior (`2026-10-15-arnaldo-secretario.md`, seção "Restrições globais"), e mais estas:
- **`os_patio` nunca contém dinheiro**, para nenhum papel. Teste obrigatório na API **e** no template.
- Migração **aditiva** apenas: nenhum `DROP`, `RENAME` ou `ALTER ... TYPE`.
- Sem segredo no git. Sem mensagem real no WhatsApp. **Não reiniciar** gateway (fica com o Opus).
- O Lovable só publica a função e só aplica migração quando o Lipe pede no chat dele. **Não esperar** por isso: deixar o texto do pedido pronto no relatório.
- Duas sessões trabalham no mesmo checkout, em `main`: `git add` só de caminhos próprios e `git pull --rebase origin main` antes de cada push.

## Contrato novo (A e B dependem dele)

`POST acao=dados_documento`, `args: { tipo: "orcamento"|"ficha_entrada"|"os_patio"|"recibo", os_id?: string, placa?: string, numero?: number, reason?: string }`.

Resposta `ok:true`, com `dados` assim:

```json
{
  "tipo": "orcamento",
  "empresa": { "nome": "MD Mecânica Multimarcas", "cnpj": "05.887.728/0001-09", "telefone": "(47) 8488-9108",
               "endereco": "Rua 248, 721 · Meia Praia · Itapema/SC · 88220-000", "email": "mdmultimarcas123@hotmail.com" },
  "config": { "validade_orcamento_dias": 7, "garantia_dias": 90, "formas_pagamento": "PIX, cartão ou dinheiro",
              "texto_aprovacao": "...", "texto_ficha": "...", "texto_garantia": "..." },
  "os": { "id": "uuid", "numero": 42, "numero_fmt": "0042", "etapa": "AGUARDANDO_APROVACAO", "etapa_texto": "...",
          "prioridade": "ALTA", "box": "BOX_2", "mecanico": "Paulo", "previsao_entrega": "2026-10-16T15:00:00-03:00",
          "queixa": "...", "criada_em": "...", "aprovada_em": null, "entregue_em": null, "km_saida": null,
          "garantia_ate": null, "proxima_revisao_km": null, "proxima_revisao_data": null },
  "cliente": { "nome": "...", "telefone_fmt": "(47) 99999-0001", "cpf_cnpj": "...", "endereco": "..." },
  "veiculo": { "placa": "ABC1D23", "marca": "...", "modelo": "...", "ano": 2015, "cor": "...", "chassi": "..." },
  "checkin": { "km": 98450, "combustivel": "METADE", "pertences": "...", "observacoes": "...", "avarias": "...",
               "tem_estepe": true, "estado_estepe": "bom", "tem_macaco": true, "tem_chave_roda": true,
               "recebido_por": "Márcio", "em": "..." },
  "fotos": [ { "url": "https://...", "tipo": "CHECKIN_PHOTO", "legenda": "Frente", "avaria": false } ],
  "diagnosticos": [ { "laudo": "...", "mecanico": "Márcio", "em": "..." } ],
  "itens": [ { "tipo": "PART", "descricao": "...", "codigo": "COBREQ N-1209", "quantidade": 1,
               "preco_unitario": 189.0, "total": 189.0 } ],
  "totais": { "pecas": 654.0, "mao_de_obra": 180.0, "desconto": 0, "total": 834.0 },
  "pagamentos": [ { "valor": 834.0, "forma": "PIX", "em": "...", "recebido_por": "Simone" } ],
  "link_aprovacao": "https://<APP>/orcamento/<id>?token=XXXXXXXX",
  "validade_ate": "2026-10-22"
}
```

- No `os_patio` **não existem** as chaves `itens[].preco_unitario`, `itens[].total`, `totais` e `pagamentos` (a API remove; o teste confere a **ausência**).
- Os campos sem dado vêm como `null`, nunca omitidos (exceção: os de dinheiro no `os_patio`).
- `fotos[].avaria = true` quando a legenda ou o `attachment_type` indicar avaria. O app ainda não marca isso: usar legenda que contenha "avaria" e deixar o `TODO` registrado no relatório.

`gerar_documento` (MCP) devolve `{ "ok": true, "caminho": "/root/.hermes/profiles/arnaldo-md-mecanica/cache/documentos/orcamento-OS0042-20261016T101500.pdf", "nome_arquivo": "Orcamento OS 0042 - MD Mecanica.pdf", "legenda": "Orçamento OS 0042 · VW Gol ABC1D23" }` ou o envelope de erro.

---

# PARTE D1: banco e API (sessão `arnaldo-api`)

### D1.1: migração aditiva
- Criar `supabase/migrations/20261016090000_documentos_md.sql` com:
  - as colunas da especificação;
  - a função e o trigger de `numero` (com `pg_advisory_xact_lock(hashtext(tenant_id::text))`);
  - o backfill por `created_at` (`row_number() over (partition by tenant_id order by created_at, id)`);
  - `CREATE UNIQUE INDEX ... (tenant_id, numero)`;
  - tudo com `IF NOT EXISTS` / `CREATE OR REPLACE`. **Escrever em SQL idempotente**: pode ser aplicada duas vezes.
- Atualizar `src/integrations/supabase/types.ts` à mão só com as colunas novas (o Lovable vai regenerar; mantenha o diff mínimo).
- Escrever em `docs/superpowers/reports/2026-10-16-documentos-lovable.md` o **texto exato** que o Lipe cola no Lovable:
  1. "Aplique a migração `supabase/migrations/20261016090000_documentos_md.sql` que chegou pelo GitHub."
  2. "Na tela de check-in, acrescente: Estepe (sim/não), Estado do estepe, Macaco (sim/não), Chave de roda (sim/não), Avarias (texto). Na OS, mostre o número da OS (formato 0001) e, na entrega, Km de saída, Garantia até e Próxima revisão (km e data)."
  3. "Publique de novo a edge function arnaldo-api."
- Commit: `feat(db): campos de documentos (numero da OS, estepe, entrega, garantia)`.

### D1.2: API (TDD)
- `actions/dados_documento.ts`, mais testes em `src/test/arnaldo/documentos.test.ts`. Casos obrigatórios:
  - os 4 tipos × papéis (`cliente` dono da OS, `cliente` de outra placa, `patio`, `gestao`, `dono`);
  - `os_patio` para `dono` **sem** chaves de dinheiro;
  - `orcamento` antes de `AGUARDANDO_APROVACAO` → `etapa_invalida`;
  - `recibo` sem pagamento e sem `FINALIZADO` → `etapa_invalida`;
  - `ficha_entrada` sem check-in → `nao_encontrado`;
  - `numero` aceito como alvo;
  - fotos ordenadas: as que não são avaria primeiro, avarias depois.
- Antes de escrever o `dados_documento`, ler `src/lib/pdf/budgetReport.ts` e `workOrderReport.ts`: eles mostram como o app junta itens com `work_order_pricing` e pagamentos. Reaproveite a mesma lógica de soma.
- `registrar_checkin`: aceitar `tem_estepe`, `estado_estepe`, `tem_macaco`, `tem_chave_roda` e `avarias` (opcionais).
- `registrar_entrega` (G/D), com teste.
- `numero` em toda saída de OS. `buscar`/`ver_os` aceitam `"OS 42"`, `"42"` e `"0042"`.
- `config`: mescla de `tenants.settings.documentos` com os padrões. Textos padrão em PT-BR (copiar dos mockups: aviso do orçamento, aviso da ficha, aviso de garantia).
- Rodar `npx vitest run src/test/arnaldo` (tudo verde) e `tsc` sem erro novo. Mudar a `VERSAO` e fazer push.
- Commit: `feat(arnaldo-api): dados_documento, registrar_entrega e numero da OS`.
- Atualizar `docs/superpowers/reports/2026-10-16-arnaldo-api.md`.

---

# PARTE D2: gerador e MCP (sessão `arnaldo-hermes`)

Antes: reler `02 Armadilhas já pagas.md` e a skill `hermes-ops`.

### D2.1: container Gotenberg
- No servidor:
  ```bash
  sudo docker run -d --name md-gotenberg --network docker-stacks_default --restart unless-stopped --memory 1g gotenberg/gotenberg:8
  ```
  Sem `-p`.
- Teste de dentro do `hermes-agent-1`: `curl -s http://md-gotenberg:3000/health` responde `up`. Converter um HTML de teste para PDF e para PNG (`/forms/chromium/screenshot/html`, `width=1080`) e conferir os bytes mágicos (`%PDF`, `\x89PNG`).
- Script versionado `hermes/server/md-gotenberg.sh` (recria o container igual, idempotente).
- Entrada no inventário do Vigia: repo `projeto lanchas show`, `hermes/vigia/inventario.yaml`, commit só desse arquivo. **Não** empurrar outras mudanças desse repo.

### D2.2: templates (TDD, `node --test`)
- `hermes/mcp/oficina-mcp/templates/{base.mjs,orcamento.mjs,ficha_entrada.mjs,os_patio.mjs,recibo.mjs}`. Cada um exporta `render(dados, { logoDataUri, fontesCss, qrDataUri }) => string HTML completa`. Seguir **exatamente** o visual dos mockups (cabeçalho A, tudo branco), sem as `.tag` amarelas. A4: `@page { size: A4; margin: 0 }`, folha de 210 mm. A OS do pátio é uma página de 1080 px de largura com altura automática; usar o layout `.cel` do mockup escalado (fontes maiores).
- `base.mjs`:
  - escape de HTML em **todo** dado vindo da API (nome de cliente pode ter `<`);
  - formatação BR: moeda `R$ 1.234,56`, datas `dd/mm/aaaa`, km `98.450`;
  - placa no estilo veicular;
  - barra de combustível (RESERVA=0, QUARTO=1, METADE=2, TRES_QUARTOS=3, COMPLETO=4 de 4).
- Fontes Barlow, Barlow Condensed e Roboto Mono embutidas: baixar os `.woff2` uma vez para `templates/fontes/` (licença OFL, pode versionar) e embutir em base64 no CSS. O logo também vai em base64: copiar `src/assets/logo.png` para `templates/logo.png`.
- QR: pacote `qrcode` (`toDataURL`) com `link_aprovacao`. Se não houver link, o bloco de aprovação mostra só "responda *aprovo* para o Arnaldo".
- Fotos: no máximo 6 no orçamento e 8 na ficha, mais o texto "+N fotos no link". Quando não há fotos, a seção some.
- Testes, com dados de exemplo em `test/fixtures/dados-*.json` copiados do contrato:
  - cada template contém número da OS, placa, nome do cliente e as legendas;
  - `os_patio` **não** contém `R$` nem `/\d+,\d{2}/`;
  - escape funciona (`<script>` no nome vira texto);
  - orçamento sem `link_aprovacao` não quebra.

### D2.3: `gerar_documento` e `consultar_placa` no MCP
- `gerar_documento`:
  - `tipo` + um de `os_id`/`placa`/`numero` → chama a API (`dados_documento`, mesmo `caller` assinado de sempre);
  - render;
  - `POST` multipart para `http://md-gotenberg:3000` (PDF: `/forms/chromium/convert/html` com `paperWidth=8.27`, `paperHeight=11.7`, margens 0, `printBackground=true`, `waitDelay=1s`; PNG: `/forms/chromium/screenshot/html`, `width=1080`, `format=png`), timeout de 40 s;
  - grava em `cache/documentos/` com permissão 644;
  - apaga arquivos com mais de 30 dias.
  - Erro da API → repassa o envelope inteiro. Gotenberg fora → `{ok:false, erro:"gerador_indisponivel", nao_diga_que_fez:true}`.
- `consultar_placa`:
  - `execFile("curl", ["-s","-L","-m","20","-A", UA, "-H","Accept-Language: pt-BR,pt;q=0.9", url])`;
  - parse do HTML para marca/modelo, ano/modelo, cor, combustível, motor/potência e município/UF. Salvar **um** HTML real como fixture em `test/fixtures/placa-SXJ6H55.html` e escrever o parser contra ele;
  - cache em `cache/placas/<PLACA>.json` por 30 dias;
  - 403 ou "Just a moment" → `placa_indisponivel`.
  - Disponível para todos os papéis: **acrescentar ao `CLIENT_TOOLS` do plugin** `md_arnaldo` (mais o teste no pytest). `gerar_documento` também entra no `CLIENT_TOOLS`, porque o cliente pede o próprio orçamento ou recibo e a API decide.
- Os schemas no `tools.mjs` levam `description` dizendo quando usar e que a resposta deve terminar com `MEDIA:<caminho>` numa linha própria.
- Testes `node --test` com fetch, Gotenberg e curl falsos.

### D2.4: skill e deploy (sem reiniciar)
- Skill nova `hermes/arnaldo/skills/md-mecanica/documentos/SKILL.md`, conforme a especificação. Atualizar `checkin-e-os` (pedir estepe, macaco e chave; usar `consultar_placa` antes de perguntar o modelo) e `atendimento-cliente` (cliente com placa nova: `consultar_placa` e depois confirmar com ele).
- SOUL: uma frase só, "Documentos da oficina (orçamento, ficha, OS, recibo) você gera com `gerar_documento` e manda com `MEDIA:` — veja a skill documentos".
- Deploy pelo `deploy-arnaldo.sh`, que deve incluir `templates/` e rodar `npm ci` no container. Instala **sem reiniciar**.
- Verificação no servidor, sem WhatsApp: rodar o `server.mjs` em modo de teste (ou um script `node scripts/gerar-exemplo.mjs`) que gera os 4 documentos **a partir das fixtures** pelo Gotenberg real e salva em `/tmp`. Copiar os 4 arquivos para `C:\Users\lipee\Desktop\garageflow-pro\docs\superpowers\reports\documentos-exemplo\` (fora do git: acrescentar ao `.gitignore`) para o Opus conferir o visual.
- Commit e push. Relatório em `docs/superpowers/reports/2026-10-16-documentos-hermes.md`.

---

# PARTE D3: ligar (Opus + Lipe)
1. O Lipe aplica a migração e publica a função (texto da D1.1), e preenche os telefones da Simone e do Márcio no garageflow.
2. O Opus confere o visual dos 4 exemplos, reinicia o gateway do Arnaldo e roda o E2E com uma OS `[TESTE]` (ARNALDO_TEST_CALLER = Márcio): check-in → ficha → itens → orçamento → OS do pátio → pagamento → recibo. Confere que `MEDIA:` vira arquivo, primeiro numa sessão de CLI (o arquivo é gerado) e depois **no grupo MD Gerência**, avisando o Lipe antes.
3. Demonstração pro Márcio: ele pede pelo WhatsApp, no grupo, uma ficha de entrada de um carro real.
