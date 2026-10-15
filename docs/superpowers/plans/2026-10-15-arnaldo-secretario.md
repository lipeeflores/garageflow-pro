# Arnaldo, secretário da MD Mecânica: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** ligar o Arnaldo (perfil Hermes `arnaldo-md-mecanica`, WhatsApp 47 8488-9108) ao sistema garageflow. Ele passa a atender cliente, agendar, fazer check-in, abrir e andar com a OS e dar suporte à equipe, com sigilo de valor por papel. Entrar no ar **segunda 19/10/2026 às 08h**.

**Arquitetura:** o banco do garageflow fica no Lovable Cloud (Supabase `jodyrgwdpxrjlglepzjh`, fora da conta do Lipe; não temos a service-role key). Por isso a única porta é uma **edge function `arnaldo-api` dentro deste repositório**. O Lovable publica a função, que roda com a service-role do próprio projeto. A regra de negócio fica em TypeScript puro, testado com vitest, em `supabase/functions/_shared/arnaldo/`. No servidor, um MCP Node `oficina`, igual ao `lanchas` da Isabelle, transforma cada ferramenta numa chamada HTTP à função. O plugin `md_arnaldo` carimba e assina a identidade do chamador (HMAC). A função decide o papel pelo telefone, cruzando `profiles.phone` e `user_roles`; quem não está ali é CLIENTE. A função também tira os valores em dinheiro de quem não pode vê-los.

**Tecnologia:** Deno/Supabase Edge Functions e `@supabase/supabase-js@2` no garageflow; vitest (já está no repo); Node 22 com `@modelcontextprotocol/sdk` no MCP; Python 3.11 com pytest no plugin Hermes v0.21.5.

**Referências obrigatórias:**
- Padrão a copiar (Isabelle):
  - `C:\Users\lipee\Desktop\projeto lanchas show\hermes\plugins\lanchas_isabelle\core.py`, para `sign`, `caller_envelope`, `decide_tool_call` e `resolve_identity` com modo de teste;
  - `server/isabelle/caller.ts`, para `verifyCaller`;
  - `server/isabelle/router.ts`, para `sendDomainError`;
  - o MCP do servidor em `/dados/hermes-agent-1/config/profiles/isabelle-lanchas-show/mcp/lanchas-mcp/{server.mjs,tools.mjs}`.
- Armadilhas do Hermes: `C:\Users\lipee\Documents\Claude-Code-Central\Hermes\02 Armadilhas já pagas.md`. **Ler inteiro antes da Parte B.**
- A skill `hermes-ops` (`~/.claude/skills/hermes-ops/SKILL.md`) vale para qualquer coisa no servidor.

## Restrições globais

- **Nunca iniciar conversa no WhatsApp.** O bridge Baileys perde o vínculo do aparelho se o primeiro contato partir do bot e pode banir o número. Nenhuma ferramenta desta versão manda mensagem por conta própria.
- **Sigilo de valor:** CLIENTE e PÁTIO/MECÂNICO nunca recebem campo de dinheiro (`total_amount`, `unit_price`, `unit_cost`, `total_price`, `amount`, `payments`, `bills`, `financial_entries`). A regra é aplicada **na API**. O plugin é uma segunda barreira, não a primeira.
- **Erro de ferramenta não vira "feito".** Toda falha volta como `{ "ok": false, "erro": "<codigo>", "mensagem": "<pt-BR>", "nao_diga_que_fez": true }`. É a lição de 23/09 da Isabelle.
- Toda ferramenta aceita o parâmetro opcional `reason` (string), que é ignorado. Sem isso, o modelo inventa o campo e a chamada quebra (lição da Isabelle, 177 erros/dia).
- Tenant: há um só, com slug `md-mecanica`. Ele é resolvido uma vez por requisição, pelo slug.
- Telefone canônico: só dígitos, com `55` e DDD; celular com o 9. A função de normalização é a mesma dos dois lados (TS e Python) e é testada com os mesmos casos.
- Fuso: `America/Sao_Paulo`. Datas trafegam em ISO-8601 com offset `-03:00`.
- Texto que vai para o cliente: português do Brasil, sem markdown.
- Horários proibidos para reiniciar gateway: **nenhum para o Arnaldo**. A grade de briefing é da Isabelle e não se aplica a ele. Mesmo assim, só reiniciar sem turno em andamento.
- O banco do garageflow ainda não tem dado real (Lipe, 15/10), então os testes podem gravar nele. Todo dado de teste usa o prefixo `[TESTE]` em `full_name`/`reason`/`initial_complaint` e é apagado no fim de cada tarefa.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (ou o modelo que estiver executando).
- **Ações que derrubam serviço** (reiniciar gateway, tirar o `PAUSA`, ligar `WHATSAPP_FORWARD_OWNER_MESSAGES`) **não são feitas pelo executor**. Elas ficam na Parte C, com o Opus ou o Lipe.

---

## Mapa de arquivos

**Parte A: garageflow (edge function).** Executor A, direto em `main` (o Lovable só sincroniza a branch padrão).

| arquivo | responsabilidade |
|---|---|
| `supabase/functions/arnaldo-api/index.ts` | entrada Deno: CORS, token de serviço, parse, chama o roteador; único arquivo que importa de `esm.sh` |
| `supabase/functions/_shared/arnaldo/phone.ts` | `normalizeBrPhone` |
| `supabase/functions/_shared/arnaldo/caller.ts` | `verifyCaller` (HMAC, janela de 5 min) |
| `supabase/functions/_shared/arnaldo/roles.ts` | `Papel`, `papelDeRoles`, `veDinheiro`, `podeAcao` |
| `supabase/functions/_shared/arnaldo/money.ts` | `semDinheiro(obj)`: remove os campos de dinheiro recursivamente |
| `supabase/functions/_shared/arnaldo/workflow.ts` | `ETAPAS`, `etapaEmPortugues`, `transicaoPermitida` |
| `supabase/functions/_shared/arnaldo/agenda.ts` | `regraAgenda(settings)`, `horariosLivres(...)` (pura) |
| `supabase/functions/_shared/arnaldo/router.ts` | `despachar(acao, args, ctx)`: tabela de ações, checagem de papel, envelope de erro |
| `supabase/functions/_shared/arnaldo/actions/*.ts` | uma ação por arquivo, recebendo `ctx.db` (cliente Supabase injetado) |
| `supabase/functions/_shared/arnaldo/db.ts` | interface `Db` mínima + `quemChama(db, tenantId, phone)` |
| `src/test/arnaldo/*.test.ts` | vitest das partes puras e do roteador com `Db` falso |
| `supabase/config.toml` | `[functions.arnaldo-api] verify_jwt = false` |

**Parte B: Hermes.** Executor B, em worktree da branch `arnaldo-hermes` com merge no fim; os arquivos não se sobrepõem aos da Parte A.

| arquivo | responsabilidade |
|---|---|
| `hermes/mcp/oficina-mcp/{package.json,server.mjs,tools.mjs}` | MCP stdio: lista de ferramentas + `POST` para a API |
| `hermes/plugins/md_arnaldo/{__init__.py,core.py,espera.py,plugin.yaml}` | **cópia versionada do que está no servidor**, mais: assinatura do chamador, liberação de `mcp__oficina__*`, "Simone assumiu" e modo de teste |
| `hermes/plugins/md_arnaldo/tests/` | pytest (os 16 testes que já existem mais os novos) |
| `hermes/arnaldo/SOUL.md` | SOUL reescrito, já com as ferramentas |
| `hermes/arnaldo/skills/md-mecanica/{atendimento-cliente,agenda,checkin-e-os,gestao-financeiro}/SKILL.md` | os procedimentos |
| `hermes/scripts/deploy-arnaldo.sh` | `scp` com backup, **sem `rm -rf`**, para o perfil no servidor |
| `hermes/README.md` | onde mora cada coisa e como fazer o deploy |

---

## Contrato HTTP (A e B dependem dele: não mudar sem mudar os dois)

```
POST {ARNALDO_API_URL}            # https://jodyrgwdpxrjlglepzjh.supabase.co/functions/v1/arnaldo-api
Headers:
  content-type: application/json
  authorization: Bearer {ARNALDO_SUPABASE_ANON}   # publishable key do .env do repo; só passa pelo gateway do Supabase se verify_jwt ficar ligado
  x-arnaldo-token: {ARNALDO_API_TOKEN}            # segredo de serviço; sem ele → 401
Body:
  { "acao": "<nome>", "args": { ... }, "caller": { "phone": "5547...", "session_id": "...", "ts": 1760000000000, "sig": "<hex>" } }
  caller.phone pode ser "SYSTEM" (cron). sig = HMAC-SHA256(ARNALDO_CALLER_SECRET, `${phone}|${session_id}|${ts}`) em hex minúsculo.
Respostas (sempre HTTP 200, exceto 401 de token):
  { "ok": true,  "dados": <objeto> }
  { "ok": false, "erro": "<codigo>", "mensagem": "<pt-BR para o modelo>", "nao_diga_que_fez": true }
Códigos de erro: token_invalido(401) | assinatura_invalida | acao_desconhecida | sem_permissao | nao_encontrado | dados_invalidos | conflito_agenda | etapa_invalida | erro_interno
GET {ARNALDO_API_URL}?saude=1  → { "ok": true, "versao": "<git sha curto ou data>" }  (sem token; não toca no banco)
```

**Papéis** (`roles.ts`):

| `user_roles.role` do profile cujo `phone` normalizado bate | Papel | vê dinheiro |
|---|---|---|
| ADMIN | `dono` | sim |
| MANAGER | `gestao` | sim |
| MECHANIC, PATIO | `patio` | não |
| (nenhum profile ativo com esse telefone) | `cliente` | não |
| `phone == "SYSTEM"` | `sistema` | sim |

`profiles.is_active = false`, o papel é `cliente`. O ator gravado nas colunas `*_by`, `mechanic_id`, `manager_id` e `actor_id` é o `profiles.id` de quem chamou. Para cliente ou sistema é `null`, e as ações que exigem ator NOT NULL ficam proibidas para eles.

---

## Catálogo de ações

Nome = nome da ferramenta MCP. O Hermes expõe como `mcp__oficina__<nome>`.

Legenda dos papéis: C = cliente, P = pátio, G = gestão, D = dono, S = sistema.

**P0 (precisa estar pronto na segunda):**

| ação | papéis | args | o que faz | devolve |
|---|---|---|---|---|
| `quem_sou` | todos | — | resolve o papel | `{papel, nome?, ve_dinheiro}` |
| `meus_dados` | C | — | `customers` pelo telefone do chamador + `vehicles` | `{cliente?, veiculos[]}` |
| `cadastrar_cliente_veiculo` | C P G D | `nome`, `placa`, `marca`, `modelo`, `ano?`, `cor?`, `telefone?` (só equipe) | cliente: o telefone é **sempre** o do chamador (ignora `telefone`). Faz upsert do cliente por telefone e do veículo por placa (placa normalizada em maiúsculas, sem hífen). Se a placa já for de **outro** cliente, devolve `conflito` sem alterar nada | `{cliente_id, veiculo_id, criado: bool}` |
| `status_do_carro` | C P G D | `placa` | última OS não finalizada da placa (se nenhuma, a última finalizada). Cliente: só se o veículo for dele; se não for, `nao_encontrado` com a **mesma** mensagem de placa inexistente (não vazar a existência). Na etapa `AGUARDANDO_APROVACAO`, inclui `link_orcamento = ${APP_PUBLIC_URL}/orcamento/${id}?token=${id.slice(0,8).toUpperCase()}` | `{placa, modelo, etapa, etapa_texto, previsao_entrega?, link_orcamento?}` |
| `horarios_livres` | C P G D | `de` (data), `ate?` (data; máximo 14 dias) | aplica `regraAgenda(tenant.settings)` menos os `appointments` AGENDADO/CHEGOU do intervalo | `{horarios: [{inicio, vagas}]}` |
| `agendar` | C P G D | `placa`, `inicio` (ISO), `motivo` | o veículo precisa existir; cliente só agenda veículo dele. Confere vaga de novo (pode ter corrida) e grava `appointments` AGENDADO com `created_by` = ator | `{agendamento_id, inicio}` ou `conflito_agenda` |
| `meus_agendamentos` | C | — | AGENDADO futuros dos veículos do chamador | `[{id, inicio, placa, motivo}]` |
| `remarcar` | C P G D | `agendamento_id`, `novo_inicio` | cliente só o próprio. O antigo vira REMARCADO e é criado um novo AGENDADO (mantém o histórico) | `{agendamento_id}` |
| `cancelar_agendamento` | C P G D | `agendamento_id`, `motivo?` | cliente só o próprio; o status vira CANCELADO e o motivo vai para `notes` | `{ok}` |
| `agenda_do_dia` | P G D | `data?` (hoje por padrão) | `appointments` do dia, com cliente e veículo, mais os NAO_COMPARECEU dos 3 dias anteriores | `[...]` |
| `buscar` | P G D | `termo` | placa (exata/prefixo), nome (`ilike`), telefone (normalizado); até 10 resultados | `{clientes[], veiculos[], os[]}` |
| `ver_os` | P G D | `os_id` **ou** `placa` | OS + checkin + diagnósticos + itens (+ preços se `ve_dinheiro`) + últimos 10 eventos; tudo passa por `semDinheiro` quando o papel não vê dinheiro | objeto da OS |
| `abrir_os` | P G D | `placa`, `queixa`, `agendamento_id?`, `prioridade?` (BAIXA/MEDIA/ALTA), `previsao_entrega?` | `work_orders` AGUARDANDO_CHECKIN. Se houver agendamento, ele vira CHEGOU e é ligado à OS | `{os_id}` |
| `registrar_checkin` | P G D | `os_id`, `km`, `combustivel` (RESERVA/QUARTO/METADE/TRES_QUARTOS/COMPLETO), `pertences?`, `observacoes?` | insere em `work_order_checkins` (`mechanic_id` = ator) e passa a etapa para CHECKIN_CONCLUIDO | `{checkin_id}` |
| `anexar_foto` | P G D | `os_id`, `tipo` (CHECKIN_PHOTO/DIAGNOSIS_PHOTO/EXECUTION_PHOTO/OTHER), `imagem_base64`, `mime` (image/jpeg/png/webp), `legenda?` | upload no bucket `attachments` em `${tenant}/${os_id}/${uuid}.${ext}` e insert em `attachments` (`uploaded_by` = ator). Limite de 8 MB | `{anexo_id, url}` |
| `registrar_diagnostico` | P G D | `os_id`, `laudo` | insere em `work_order_diagnostics` (`mechanic_id` = ator, `ended_at` = agora) e passa a etapa para AGUARDANDO_ORCAMENTO | `{diagnostico_id}` |
| `adicionar_itens` | P G D | `os_id`, `itens: [{tipo: SERVICE\|PART, descricao, quantidade?, codigo?}]` | insere em `work_order_items` (preço é com a gestão) | `{itens: [id]}` |
| `mover_etapa` | P G D | `os_id`, `etapa`, `observacao?` | valida com `transicaoPermitida(de, para, papel)` e faz o update (o trigger grava o evento). Se houver `observacao`, insere em `work_order_events` (`event_type` = `NOTA_ARNALDO`) | `{etapa}` |
| `atribuir` | P G D | `os_id`, `mecanico?` (nome; casa com `ilike` em `profiles.full_name` ativo), `box?` (BOX_1..4/PATIO) | update de `current_mechanic_id`/`box_location`. Nome ambíguo → `dados_invalidos` listando os candidatos | `{ok}` |

**P1 (pode entrar terça; só se P0 estiver verde):**

| ação | papéis | args | o que faz |
|---|---|---|---|
| `precificar_itens` | G D | `os_id`, `precos: [{item_id, preco_unitario, custo_unitario?}]` | upsert em `work_order_pricing` (`total_price` = preço × quantidade) e recalcula `work_orders.total_amount` |
| `enviar_orcamento` | G D | `os_id` | exige todos os itens com preço; etapa → AGUARDANDO_APROVACAO; devolve `link_orcamento` (para a gestão mandar ou para o cliente receber quando perguntar) |
| `controle_qualidade` | G D | `os_id`, `aprovado: bool`, `notas?` | insere em `work_order_quality` (`manager_id` = ator) e muda a etapa para PRONTO_PARA_RETIRADA ou AJUSTES |
| `registrar_pagamento` | G D | `os_id`, `valor`, `forma` (PIX/CARTAO/DINHEIRO/MARCAR) | espelhar exatamente o que `src/hooks/usePayments.ts` grava (payments + financial_entries); ler o hook antes |
| `resumo_financeiro` | G D | `de`, `ate` | o mesmo cálculo de `src/hooks/useFinancialData.ts` |
| `contas_a_pagar` | G D | `acao: listar\|criar\|pagar`, ... | o mesmo que `src/hooks/useBills.ts` |

**Fora desta versão:** mensagem ativa para o cliente ("seu carro está pronto"), NF-e/NFS-e, cotação com autopeças, ponto e ranking.

**Transições de etapa** (`workflow.ts`). As permitidas para `patio`:
- AGUARDANDO_CHECKIN → CHECKIN_CONCLUIDO
- CHECKIN_CONCLUIDO → EM_DIAGNOSTICO
- EM_DIAGNOSTICO → AGUARDANDO_ORCAMENTO
- APROVADO → EM_EXECUCAO
- EM_EXECUCAO → EM_QUALIDADE
- AJUSTES → EM_EXECUCAO

`gestao`/`dono`/`sistema` podem qualquer transição para frente, mais → CANCELADO, mais AGUARDANDO_APROVACAO → APROVADO (aprovação por telefone) e EM_QUALIDADE → AJUSTES|PRONTO_PARA_RETIRADA e PRONTO_PARA_RETIRADA → FINALIZADO. `cliente` não move nenhuma etapa.

**Regra de agenda padrão** (vale enquanto `tenants.settings.arnaldo_agenda` não existir; a Simone ajusta depois):

```json
{ "dias": [1,2,3,4,5,6], "abre": "08:00", "fecha": "17:00", "sabado_fecha": "12:00",
  "almoco": ["12:00","13:30"], "intervalo_min": 60, "carros_por_horario": 2, "antecedencia_min": 120 }
```

(`dias`: 0 = domingo. **Confirmar com o Lipe**. Pergunta aberta para a Parte C, sem bloquear a implementação.)

---

# PARTE A: API no garageflow (Executor A)

### Tarefa A0: provar que o Lovable publica uma edge function vinda do GitHub (fazer PRIMEIRO, hoje)

É o maior risco do plano. Se o Lovable não publicar funções empurradas pelo GitHub, o caminho muda (o Lipe pede a publicação no chat do Lovable). Por isso esta tarefa vem antes de qualquer código grande.

**Arquivos:**
- Criar: `supabase/functions/arnaldo-api/index.ts` (só a saúde)
- Modificar: `supabase/config.toml`

- [ ] **Passo 1:** criar a função mínima.

```ts
// supabase/functions/arnaldo-api/index.ts
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-arnaldo-token",
};
const VERSAO = "a0-2026-10-15";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("saude") === "1") {
    return new Response(JSON.stringify({ ok: true, versao: VERSAO }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: false, erro: "acao_desconhecida" }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
```

- [ ] **Passo 2:** no fim de `supabase/config.toml`, acrescentar:

```toml

[functions.arnaldo-api]
verify_jwt = false
```

- [ ] **Passo 3:** fazer commit e push em `main`.

```bash
git add supabase/functions/arnaldo-api/index.ts supabase/config.toml
git commit -m "feat(arnaldo-api): esqueleto com rota de saude"
git push origin main
```

- [ ] **Passo 4:** conferir a publicação, tentando a cada 60 s por até 10 min.

```bash
curl -s "https://jodyrgwdpxrjlglepzjh.supabase.co/functions/v1/arnaldo-api?saude=1"
```

Esperado: `{"ok":true,"versao":"a0-2026-10-15"}`. Se vier `401`, o `verify_jwt` foi ignorado: repetir com `-H "authorization: Bearer <VITE_SUPABASE_PUBLISHABLE_KEY do .env>"`. Se isso der 200, anotar no relatório que **o header de anon é obrigatório**; o MCP já manda. Se vier 404 depois de 10 min, **parar e avisar o Lipe** com este texto: *"Abra o projeto no Lovable e peça: 'Publique a edge function arnaldo-api que chegou pelo GitHub'. Depois me diga se https://jodyrgwdpxrjlglepzjh.supabase.co/functions/v1/arnaldo-api?saude=1 responde."* Seguir com A1–A6 mesmo assim (tudo é testável localmente).

### Tarefa A1: telefone, assinatura do chamador, papéis e sigilo de dinheiro (partes puras)

**Arquivos:**
- Criar: `supabase/functions/_shared/arnaldo/{phone.ts,caller.ts,roles.ts,money.ts}`
- Teste: `src/test/arnaldo/puros.test.ts`

**Interfaces produzidas:**
- `normalizeBrPhone(raw: string | null | undefined): string | null`
- `verifyCaller(c: unknown, secret: string, nowMs?: number): { phone: string; sessionId: string } | null`
- `type Papel = "cliente" | "patio" | "gestao" | "dono" | "sistema"`
- `papelDeRoles(roles: string[], ativo: boolean): Papel`
- `veDinheiro(p: Papel): boolean`
- `semDinheiro<T>(x: T): T`

O vitest roda em Node, e o `caller.ts` precisa funcionar tanto em Deno quanto em Node: usar `crypto.subtle` (existe nos dois) e **não** importar `node:crypto`.

- [ ] **Passo 1: teste primeiro.**

```ts
// src/test/arnaldo/puros.test.ts
import { describe, it, expect } from "vitest";
import { normalizeBrPhone } from "../../../supabase/functions/_shared/arnaldo/phone";
import { verifyCaller, signCaller } from "../../../supabase/functions/_shared/arnaldo/caller";
import { papelDeRoles, veDinheiro } from "../../../supabase/functions/_shared/arnaldo/roles";
import { semDinheiro } from "../../../supabase/functions/_shared/arnaldo/money";

describe("normalizeBrPhone", () => {
  it.each([
    ["+55 (47) 98488-9108", "5547984889108"],
    ["47 8488-9108", "5547984889108"],      // celular sem o 9 → acrescenta
    ["554784889108", "5547984889108"],      // 12 dígitos com 55, sem o 9
    ["5547984889108", "5547984889108"],
    ["(47) 3368-1234", "554733681234"],     // fixo (começa com 2-5) fica com 8 dígitos
    ["5547984889108@s.whatsapp.net", "5547984889108"],
    ["", null], [null, null], ["123", null],
  ])("%s → %s", (raw, esperado) => expect(normalizeBrPhone(raw as any)).toBe(esperado));
});

describe("verifyCaller", () => {
  const segredo = "s3gr3d0";
  it("aceita envelope válido dentro de 5 min", async () => {
    const env = await signCaller("5547984889108", "sess1", 1_000_000, segredo);
    expect(await verifyCaller(env, segredo, 1_000_000 + 299_000)).toEqual({ phone: "5547984889108", sessionId: "sess1" });
  });
  it("recusa fora da janela, assinatura errada e lixo", async () => {
    const env = await signCaller("5547984889108", "sess1", 1_000_000, segredo);
    expect(await verifyCaller(env, segredo, 1_000_000 + 301_000)).toBeNull();
    expect(await verifyCaller({ ...env, phone: "5547999999999" }, segredo, 1_000_000)).toBeNull();
    expect(await verifyCaller(null, segredo, 1)).toBeNull();
    expect(await verifyCaller(env, "", 1_000_000)).toBeNull();
  });
  it("bate com a assinatura do Python (hmac sha256 hex de phone|session|ts)", async () => {
    // valor gerado com: python -c "import hmac,hashlib;print(hmac.new(b's3gr3d0',b'5547984889108|sess1|1000000',hashlib.sha256).hexdigest())"
    const env = await signCaller("5547984889108", "sess1", 1_000_000, segredo);
    expect(env.sig).toBe("11f0e64ac3ecbd039886d7218c15db06d30f53801bbccd2acd206744a9b7056e");
  });
});

describe("papéis e dinheiro", () => {
  it("mapeia roles", () => {
    expect(papelDeRoles(["ADMIN"], true)).toBe("dono");
    expect(papelDeRoles(["MANAGER"], true)).toBe("gestao");
    expect(papelDeRoles(["MECHANIC"], true)).toBe("patio");
    expect(papelDeRoles(["PATIO"], true)).toBe("patio");
    expect(papelDeRoles(["ADMIN"], false)).toBe("cliente");
    expect(papelDeRoles([], true)).toBe("cliente");
    expect(papelDeRoles(["MECHANIC", "MANAGER"], true)).toBe("gestao"); // o maior vence
  });
  it("só dono/gestao/sistema veem dinheiro", () => {
    expect(["dono", "gestao", "sistema"].every((p) => veDinheiro(p as any))).toBe(true);
    expect(["cliente", "patio"].some((p) => veDinheiro(p as any))).toBe(false);
  });
  it("semDinheiro remove campos em qualquer profundidade", () => {
    const os = { id: "1", total_amount: 900, itens: [{ descricao: "pastilha", pricing: { unit_price: 100 }, total_price: 200 }], payments: [{ amount: 1 }] };
    expect(semDinheiro(os)).toEqual({ id: "1", itens: [{ descricao: "pastilha" }] });
  });
});
```

O vetor fixo `11f0e64ac3ecbd039886d7218c15db06d30f53801bbccd2acd206744a9b7056e` foi calculado com o comando Python do comentário. O teste em pytest da B2 usa o mesmo valor: é o que garante que os dois lados assinam igual.

- [ ] **Passo 2:** `npx vitest run src/test/arnaldo/puros.test.ts`. Esperado: FALHA (módulos não existem).

- [ ] **Passo 3: implementar.**

```ts
// supabase/functions/_shared/arnaldo/phone.ts
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).split("@")[0].replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 10) {
    const primeiro = d[2];
    if ("6789".includes(primeiro)) d = d.slice(0, 2) + "9" + d.slice(2); // celular antigo sem o 9
  }
  if (d.length !== 10 && d.length !== 11) return null;
  return "55" + d;
}
```

```ts
// supabase/functions/_shared/arnaldo/caller.ts
const JANELA_MS = 5 * 60 * 1000;
const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signCaller(phone: string, sessionId: string, ts: number, secret: string) {
  return { phone, session_id: sessionId, ts, sig: await hmacHex(secret, `${phone}|${sessionId}|${ts}`) };
}

export async function verifyCaller(c: unknown, secret: string, nowMs = Date.now()) {
  if (!secret || !c || typeof c !== "object") return null;
  const { phone, session_id, ts, sig } = c as Record<string, unknown>;
  if (typeof phone !== "string" || typeof session_id !== "string" || typeof ts !== "number" || typeof sig !== "string") return null;
  if (Math.abs(nowMs - ts) > JANELA_MS) return null;
  const esperado = await hmacHex(secret, `${phone}|${session_id}|${ts}`);
  return iguais(esperado, sig) ? { phone, sessionId: session_id } : null;
}
```

Como `verifyCaller` é assíncrona, os testes do Passo 1 já usam `await`.

```ts
// supabase/functions/_shared/arnaldo/roles.ts
export type Papel = "cliente" | "patio" | "gestao" | "dono" | "sistema";
const ORDEM: Record<string, Papel> = { ADMIN: "dono", MANAGER: "gestao", MECHANIC: "patio", PATIO: "patio" };
const PESO: Record<Papel, number> = { cliente: 0, patio: 1, gestao: 2, dono: 3, sistema: 4 };

export function papelDeRoles(roles: string[], ativo: boolean): Papel {
  if (!ativo) return "cliente";
  let melhor: Papel = "cliente";
  for (const r of roles) {
    const p = ORDEM[r];
    if (p && PESO[p] > PESO[melhor]) melhor = p;
  }
  return melhor;
}
export const veDinheiro = (p: Papel) => p === "dono" || p === "gestao" || p === "sistema";
export const ehEquipe = (p: Papel) => p !== "cliente";
```

```ts
// supabase/functions/_shared/arnaldo/money.ts
const CAMPOS = new Set(["total_amount", "unit_price", "unit_cost", "total_price", "amount", "valor", "preco", "custo"]);
const RAMOS = new Set(["pricing", "work_order_pricing", "payments", "financial_entries", "bills"]);

export function semDinheiro<T>(x: T): T {
  if (Array.isArray(x)) return x.map(semDinheiro) as unknown as T;
  if (x && typeof x === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (CAMPOS.has(k) || RAMOS.has(k)) continue;
      out[k] = semDinheiro(v);
    }
    return out as T;
  }
  return x;
}
```

- [ ] **Passo 4:** `npx vitest run src/test/arnaldo/puros.test.ts`. Esperado: PASSA, tudo verde.
- [ ] **Passo 5:** commit `feat(arnaldo-api): telefone, assinatura, papeis e sigilo de valor`.

### Tarefa A2: etapas da OS e regra de agenda (puras)

**Arquivos:**
- Criar: `supabase/functions/_shared/arnaldo/{workflow.ts,agenda.ts}`
- Teste: `src/test/arnaldo/workflow-agenda.test.ts`

**Interfaces produzidas:**
- `ETAPAS: readonly string[]` (ordem do enum `workflow_step`)
- `etapaEmPortugues(e: string): string`
- `transicaoPermitida(de: string, para: string, papel: Papel): boolean`
- `type RegraAgenda`
- `regraAgenda(settings: unknown): RegraAgenda`
- `horariosLivres(regra, deISO: string, ateISO: string, ocupados: string[], agoraISO: string): { inicio: string; vagas: number }[]`

- [ ] **Passo 1: teste.**

```ts
import { describe, it, expect } from "vitest";
import { transicaoPermitida, etapaEmPortugues } from "../../../supabase/functions/_shared/arnaldo/workflow";
import { regraAgenda, horariosLivres } from "../../../supabase/functions/_shared/arnaldo/agenda";

describe("transições", () => {
  it("pátio anda só nas etapas de pátio", () => {
    expect(transicaoPermitida("AGUARDANDO_CHECKIN", "CHECKIN_CONCLUIDO", "patio")).toBe(true);
    expect(transicaoPermitida("EM_EXECUCAO", "EM_QUALIDADE", "patio")).toBe(true);
    expect(transicaoPermitida("AGUARDANDO_APROVACAO", "APROVADO", "patio")).toBe(false);
    expect(transicaoPermitida("EM_QUALIDADE", "PRONTO_PARA_RETIRADA", "patio")).toBe(false);
    expect(transicaoPermitida("EM_EXECUCAO", "CANCELADO", "patio")).toBe(false);
  });
  it("gestão aprova, finaliza e cancela; ninguém volta de FINALIZADO", () => {
    expect(transicaoPermitida("AGUARDANDO_APROVACAO", "APROVADO", "gestao")).toBe(true);
    expect(transicaoPermitida("PRONTO_PARA_RETIRADA", "FINALIZADO", "dono")).toBe(true);
    expect(transicaoPermitida("EM_DIAGNOSTICO", "CANCELADO", "gestao")).toBe(true);
    expect(transicaoPermitida("FINALIZADO", "EM_EXECUCAO", "dono")).toBe(false);
    expect(transicaoPermitida("AGUARDANDO_CHECKIN", "CHECKIN_CONCLUIDO", "cliente")).toBe(false);
  });
  it("texto para cliente", () => {
    expect(etapaEmPortugues("EM_EXECUCAO")).toBe("em serviço");
    expect(etapaEmPortugues("PRONTO_PARA_RETIRADA")).toBe("pronto para retirada");
  });
});

describe("agenda", () => {
  const regra = regraAgenda(null); // padrão
  it("terça 08:00-17:00 de hora em hora, sem almoço, 2 vagas", () => {
    const h = horariosLivres(regra, "2026-10-20T00:00:00-03:00", "2026-10-20T23:59:00-03:00", [], "2026-10-19T08:00:00-03:00");
    expect(h.map((x) => x.inicio.slice(11, 16))).toEqual(["08:00", "09:00", "10:00", "11:00", "13:30", "14:30", "15:30"]);
    expect(h.every((x) => x.vagas === 2)).toBe(true);
  });
  it("ocupados descontam e lotado some", () => {
    const occ = ["2026-10-20T08:00:00-03:00", "2026-10-20T08:00:00-03:00", "2026-10-20T09:00:00-03:00"];
    const h = horariosLivres(regra, "2026-10-20T00:00:00-03:00", "2026-10-20T10:00:00-03:00", occ, "2026-10-19T08:00:00-03:00");
    expect(h).toEqual([{ inicio: "2026-10-20T09:00:00-03:00", vagas: 1 }]);
  });
  it("sábado fecha 12h, domingo fechado, antecedência de 2h", () => {
    const sab = horariosLivres(regra, "2026-10-24T00:00:00-03:00", "2026-10-25T23:59:00-03:00", [], "2026-10-19T08:00:00-03:00");
    expect(sab.map((x) => x.inicio.slice(0, 16))).toEqual(["2026-10-24T08:00", "2026-10-24T09:00", "2026-10-24T10:00", "2026-10-24T11:00"]);
    const hoje = horariosLivres(regra, "2026-10-20T00:00:00-03:00", "2026-10-20T12:00:00-03:00", [], "2026-10-20T08:30:00-03:00");
    expect(hoje[0].inicio.slice(11, 16)).toBe("11:00"); // 08:30 + 2h = 10:30 → próximo horário cheio 11:00
  });
});
```

O último slot de terça é 15:30, e não 16:30, porque um serviço de 60 min precisa **terminar** até `fecha`: 16:30 + 60 = 17:30. Os slots depois do almoço começam às 13:30. Implementar exatamente assim.

- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3: implementar.**

```ts
// supabase/functions/_shared/arnaldo/workflow.ts
import type { Papel } from "./roles.ts";
export const ETAPAS = ["AGUARDANDO_CHECKIN","CHECKIN_CONCLUIDO","EM_DIAGNOSTICO","AGUARDANDO_ORCAMENTO","AGUARDANDO_APROVACAO","APROVADO","EM_EXECUCAO","EM_QUALIDADE","AJUSTES","PRONTO_PARA_RETIRADA","FINALIZADO","CANCELADO"] as const;
const TEXTO: Record<string, string> = {
  AGUARDANDO_CHECKIN: "aguardando a entrada na oficina", CHECKIN_CONCLUIDO: "recebido na oficina",
  EM_DIAGNOSTICO: "em avaliação", AGUARDANDO_ORCAMENTO: "orçamento sendo preparado",
  AGUARDANDO_APROVACAO: "aguardando sua aprovação do orçamento", APROVADO: "aprovado, na fila do serviço",
  EM_EXECUCAO: "em serviço", EM_QUALIDADE: "no teste final", AJUSTES: "em ajustes finais",
  PRONTO_PARA_RETIRADA: "pronto para retirada", FINALIZADO: "entregue", CANCELADO: "cancelado",
};
export const etapaEmPortugues = (e: string) => TEXTO[e] ?? e;
const PATIO = new Set(["AGUARDANDO_CHECKIN>CHECKIN_CONCLUIDO","CHECKIN_CONCLUIDO>EM_DIAGNOSTICO","EM_DIAGNOSTICO>AGUARDANDO_ORCAMENTO","APROVADO>EM_EXECUCAO","EM_EXECUCAO>EM_QUALIDADE","AJUSTES>EM_EXECUCAO"]);
const GESTAO_EXTRA = new Set(["EM_QUALIDADE>AJUSTES"]);
export function transicaoPermitida(de: string, para: string, papel: Papel): boolean {
  if (de === para || de === "FINALIZADO" || de === "CANCELADO") return false;
  if (papel === "patio") return PATIO.has(`${de}>${para}`);
  if (papel === "gestao" || papel === "dono" || papel === "sistema") {
    if (para === "CANCELADO") return true;
    if (GESTAO_EXTRA.has(`${de}>${para}`)) return true;
    const i = ETAPAS.indexOf(de as any), j = ETAPAS.indexOf(para as any);
    return i >= 0 && j > i && para !== "CANCELADO";
  }
  return false;
}
```

Em `agenda.ts`, implementar `regraAgenda` (mescla do padrão da seção "Regra de agenda" com `settings?.arnaldo_agenda`) e `horariosLivres`:
- percorrer cada dia de `de` a `ate`, só os dias em `regra.dias`;
- gerar slots a partir de `abre` a cada `intervalo_min`;
- descartar o slot que comece dentro de `[almoco[0], almoco[1])`;
- depois de `almoco[1]`, recomeçar a grade **a partir de `almoco[1]`**;
- descartar o slot cujo `inicio + intervalo_min` passe de `fecha` (no sábado, `sabado_fecha`) e o slot cujo início seja menor que `agora + antecedencia_min`;
- só entram slots com `de <= inicio < ate`;
- `vagas = carros_por_horario − (ocupados com o mesmo início, comparado ao minuto)`; omitir o slot quando vagas ≤ 0;
- formatar a saída sempre como `YYYY-MM-DDTHH:MM:00-03:00`, fazendo a aritmética em minutos locais de São Paulo (Brasil não tem horário de verão desde 2019: offset fixo `-03:00`).

- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(arnaldo-api): etapas da OS e grade de agenda`.

### Tarefa A3: roteador, identidade e ações de cliente e agenda (P0)

**Arquivos:**
- Criar: `supabase/functions/_shared/arnaldo/{db.ts,router.ts}`
- Criar: `supabase/functions/_shared/arnaldo/actions/{quem_sou,meus_dados,cadastrar_cliente_veiculo,status_do_carro,horarios_livres,agendar,meus_agendamentos,remarcar,cancelar_agendamento,agenda_do_dia}.ts`
- Teste: `src/test/arnaldo/router.test.ts`

**Interfaces:**

```ts
// db.ts — o roteador recebe o cliente Supabase já criado (service role); nos testes, um falso
import type { Papel } from "./roles.ts";
export type Db = any; // SupabaseClient; manter `any` aqui para não puxar esm.sh no vitest
export interface Ctx {
  db: Db; tenantId: string; papel: Papel; atorId: string | null; telefone: string | null;
  agora: Date; appPublicUrl: string; tenantSettings: unknown;
}
export async function quemChama(db: Db, tenantId: string, phone: string): Promise<{ papel: Papel; atorId: string | null; nome: string | null }>
// SYSTEM → sistema. Senão: select id, full_name, phone, is_active from profiles where tenant_id = tenantId.
// Normalizar `phone` de cada profile em JS (o campo é texto livre) e comparar.
// Se bater: select role from user_roles where user_id = id and tenant_id = tenantId → papelDeRoles.
```

```ts
// router.ts
export type Resultado = { ok: true; dados: unknown } | { ok: false; erro: string; mensagem: string; nao_diga_que_fez: true };
export const falha = (erro: string, mensagem: string): Resultado => ({ ok: false, erro, mensagem, nao_diga_que_fez: true });
type Acao = { papeis: Papel[]; run: (args: Record<string, unknown>, ctx: Ctx) => Promise<unknown> };
export const ACOES: Record<string, Acao> = { /* uma entrada por ação do catálogo */ };
export async function despachar(acao: string, args: unknown, ctx: Ctx): Promise<Resultado>
// 1) ACOES[acao] não existe → falha("acao_desconhecida", ...)
// 2) ctx.papel fora de papeis → falha("sem_permissao", "Essa ação é só para a equipe da oficina.")
// 3) args: tira `reason` e `caller`
// 4) chama run, embrulhado em try/catch. Erros de domínio são lançados como `new ErroArnaldo(codigo, mensagem)`
//    e viram falha(codigo, mensagem). Qualquer outro erro → falha("erro_interno", "O sistema da oficina falhou agora.
//    NÃO diga que foi feito; avise que vai verificar com a equipe.") e console.error.
// 5) se !veDinheiro(ctx.papel) → dados = semDinheiro(dados)   ← SEMPRE, em toda ação
```

Comportamento de cada ação: a tabela P0 do catálogo é a especificação. Detalhes que costumam escorregar:
- **Placa:** `placa.toUpperCase().replace(/[^A-Z0-9]/g, "")`. A comparação no banco usa a mesma normalização (`vehicles.plate` pode ter hífen): buscar por `ilike` com o padrão `%${p[0..2]}%${p[3..]}%`, filtrar em JS por igualdade normalizada e devolver `nao_encontrado` se nada bater.
- **Cliente sem cadastro** em `meus_dados`: devolver `{ cliente: null, veiculos: [] }`, **não** um erro.
- **`status_do_carro` para cliente:** a mensagem de `nao_encontrado` é idêntica para "placa não existe" e "placa de outro cliente": `"Não achei esse carro no cadastro deste número."`
- **`agendar`/`remarcar`:** antes de gravar, recalcular `horariosLivres` só para aquele minuto. Se não houver vaga, devolver `conflito_agenda` com `mensagem` listando até 3 horários livres no mesmo dia.
- Toda query filtra por `tenant_id = ctx.tenantId`.

- [ ] **Passo 1: teste do roteador com `Db` falso.** Escrever um `fakeDb` mínimo que implemente a cadeia `from(t).select().eq().ilike().in().gte().lte().order().limit().single()/.maybeSingle()` sobre arrays em memória, mais `insert(...).select().single()` e `update(...).eq()`. Esse helper fica em `src/test/arnaldo/fakeDb.ts`. Casos obrigatórios:
  1. ação desconhecida → `acao_desconhecida`;
  2. cliente chamando `agenda_do_dia` → `sem_permissao`;
  3. cliente `cadastrar_cliente_veiculo` com `telefone` de outra pessoa → grava com o telefone **do chamador**;
  4. cliente `status_do_carro` de uma placa de outro cliente → `nao_encontrado` com a mesma mensagem de placa inexistente;
  5. `status_do_carro` em AGUARDANDO_APROVACAO devolve `link_orcamento` com token = 8 primeiros caracteres do id em maiúsculas, e **sem** `total_amount` para cliente;
  6. `agendar` num horário lotado → `conflito_agenda`;
  7. `agendar` válido grava `appointments` com `status: "AGENDADO"` e `tenant_id`;
  8. patio `ver_os` (A4) sem campos de dinheiro; gestao com;
  9. exceção qualquer dentro de `run` → `erro_interno` com `nao_diga_que_fez: true`;
  10. `reason` nos args não quebra nenhuma ação.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar `db.ts`, `router.ts` e as 10 ações (um arquivo cada, cada um exportando `default { papeis, run }`).
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(arnaldo-api): roteador e acoes de cliente/agenda`.

### Tarefa A4: ações da OS para a equipe (P0)

**Arquivos:**
- Criar: `actions/{buscar,ver_os,abrir_os,registrar_checkin,anexar_foto,registrar_diagnostico,adicionar_itens,mover_etapa,atribuir}.ts` e registrar em `ACOES`
- Teste: acrescentar em `src/test/arnaldo/router.test.ts`

Casos de teste obrigatórios:
1. `abrir_os` com `agendamento_id` marca o agendamento como CHEGOU e devolve `os_id`;
2. `registrar_checkin` grava `mechanic_id` = `ctx.atorId` e move para CHECKIN_CONCLUIDO; um segundo check-in na mesma OS → `conflito` (UNIQUE);
3. `mover_etapa` patio APROVADO→EM_EXECUCAO ok, patio AGUARDANDO_APROVACAO→APROVADO → `etapa_invalida`;
4. `registrar_diagnostico` sem `atorId` (sistema) → `dados_invalidos` ("diagnóstico precisa de um mecânico");
5. `anexar_foto` acima de 8 MB → `dados_invalidos`; mime fora da lista → `dados_invalidos`;
6. `atribuir` com nome que casa 2 profiles → `dados_invalidos` com os dois nomes;
7. `ver_os` por placa pega a OS aberta mais recente.

Para `anexar_foto`: `db.storage.from("attachments").upload(path, bytes, { contentType: mime })`, depois `getPublicUrl(path)` (o bucket é público, conforme a migração `20260202125809`), e por fim insert em `attachments`. **Antes de escrever**, ler a definição de `attachments` (linha 213 de `supabase/migrations/20260202125709_*.sql`) e o `src/components/workorder/PhotoUpload.tsx` para usar os mesmos nomes de coluna e o mesmo formato de caminho que o app já usa.

- [ ] Passos 1–5 no mesmo ciclo TDD (teste → falha → implementação → passa → commit `feat(arnaldo-api): acoes de OS para a equipe`).

### Tarefa A5: `index.ts` de verdade e publicação

**Arquivos:**
- Modificar: `supabase/functions/arnaldo-api/index.ts`

- [ ] **Passo 1:** acrescentar ao esqueleto da A0:
  - para requisições que não são de saúde: exigir `POST`;
  - `x-arnaldo-token === Deno.env.get("ARNALDO_API_TOKEN")`, comparado em tempo constante; se faltar ou divergir → **401** `token_invalido`;
  - `body = await req.json()`;
  - `who = await verifyCaller(body.caller, Deno.env.get("ARNALDO_CALLER_SECRET") ?? "")`; se null → `assinatura_invalida`;
  - `db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (import de `https://esm.sh/@supabase/supabase-js@2`, igual ao `get-public-budget`);
  - `tenant` = select id, settings from tenants where slug = 'md-mecanica' (single);
  - `{papel, atorId} = await quemChama(db, tenant.id, normalizeBrPhone(who.phone) ?? who.phone)`;
  - `ctx` com `appPublicUrl = Deno.env.get("ARNALDO_APP_URL") ?? ""`;
  - `return json(await despachar(body.acao, body.args ?? {}, ctx))`;
  - imports **relativos** com extensão `.ts` (`../_shared/arnaldo/router.ts`), que é o que o Deno exige. Conferir se o vitest aceita imports com `.ts`; se não aceitar, acrescentar `allowImportingTsExtensions` ou `resolve.extensions` no `vitest.config.ts` e registrar isso no commit.
- [ ] **Passo 2:** `npx vitest run src/test/arnaldo` passa inteiro e `npx tsc --noEmit -p tsconfig.app.json` não piora (comparar a contagem de erros antes e depois; o projeto Lovable pode já ter erros).
- [ ] **Passo 3:** trocar `VERSAO` pela data e hora do commit, fazer commit e push em `main`, e repetir o curl de saúde até aparecer a versão nova.
- [ ] **Passo 4:** com o token **ainda não configurado** no Lovable, `POST` sem token → 401. É a prova de que a porta está fechada.
- [ ] **Passo 5:** escrever no relatório (`docs/superpowers/reports/2026-10-16-arnaldo-api.md`) os 3 segredos que **o Lipe precisa criar no Lovable** (Cloud → Secrets):
  - `ARNALDO_API_TOKEN`: 48 caracteres aleatórios;
  - `ARNALDO_CALLER_SECRET`: 48 aleatórios;
  - `ARNALDO_APP_URL`: a URL publicada do app, sem barra no fim.

  Gerar os dois aleatórios com `openssl rand -hex 24` e **não** colocar os valores no relatório nem no git: entregar ao Lipe pelo chat e gravar no servidor só na Parte C.

### Tarefa A6: P1, gestão e financeiro (só se a A5 estiver no ar e verde)

**Arquivos:**
- Criar: `actions/{precificar_itens,enviar_orcamento,controle_qualidade,registrar_pagamento,resumo_financeiro,contas_a_pagar}.ts`

Antes de cada ação de dinheiro, **ler o hook equivalente** e gravar exatamente as mesmas linhas que ele grava:
- `src/hooks/useWorkOrderItems.ts` (pricing);
- `usePayments.ts`;
- `useFinancialData.ts`;
- `useBills.ts`;
- `QualityControlDialog.tsx`.

Testes: cada uma recusa `patio`/`cliente` com `sem_permissao`, e `enviar_orcamento` recusa a OS com item sem preço. Commit `feat(arnaldo-api): acoes de gestao e financeiro`.

---

# PARTE B: Hermes (Executor B)

Antes de começar: ler `02 Armadilhas já pagas.md` e a skill `hermes-ops`. Acesso ao servidor: `ssh -i ~/.ssh/servidor_lipe lipeeflores@100.67.51.23` (Tailscale; o IP da LAN `192.168.0.50` só funciona em casa). O perfil fica em `/dados/hermes-agent-1/config/profiles/arnaldo-md-mecanica/` (dono root, usar `sudo`). O `hermes` só existe dentro do container: `sudo docker exec hermes-agent-1 hermes --profile arnaldo-md-mecanica ...`.

**O que o executor B NÃO faz:**
- reiniciar o gateway;
- apagar o `PAUSA`;
- ligar `WHATSAPP_FORWARD_OWNER_MESSAGES`;
- mandar qualquer mensagem pelo WhatsApp.

Tudo isso é da Parte C.

### Tarefa B1: versionar o plugin que já está no servidor

- [ ] Copiar `plugins/md_arnaldo/` do servidor para `hermes/plugins/md_arnaldo/`, sem `__pycache__` e `.pytest_cache`:

```bash
ssh -i ~/.ssh/servidor_lipe lipeeflores@100.67.51.23 'sudo tar -C /dados/hermes-agent-1/config/profiles/arnaldo-md-mecanica/plugins -czf - --exclude=__pycache__ --exclude=.pytest_cache md_arnaldo' | tar -C hermes/plugins -xzf -
```

- [ ] Fazer o mesmo com `SOUL.md`, `README.md` e `equipe.json`, que vão para `hermes/arnaldo/`.
- [ ] Rodar os testes que já existem: `cd hermes/plugins/md_arnaldo && python -m pytest -q`. Esperado: 16 passando. Se o pytest não estiver no Windows, rodar dentro do container: `sudo docker exec -w /root/.hermes/profiles/arnaldo-md-mecanica/plugins/md_arnaldo hermes-agent-1 python -m pytest -q`.
- [ ] Commit `chore(hermes): versiona o plugin md_arnaldo como esta no servidor`.

### Tarefa B2: plugin, ferramentas `oficina` com chamador assinado e modo de teste

**Arquivos:**
- Modificar: `hermes/plugins/md_arnaldo/core.py` (`decide_tool_call`, `resolve_identity`), `__init__.py` (`on_pre_tool_call`)
- Teste: `hermes/plugins/md_arnaldo/tests/test_oficina.py`

**Interfaces:**
- `sign(phone, session_id, ts, secret) -> str` e `caller_envelope(phone, session_id, secret, now_ms=None) -> dict`: **copiar literalmente** de `lanchas_isabelle/core.py` (linhas 270–278).
- `TOOL_PREFIX = "mcp__oficina__"`
- `CLIENT_TOOLS = {"quem_sou","meus_dados","cadastrar_cliente_veiculo","status_do_carro","horarios_livres","agendar","meus_agendamentos","remarcar","cancelar_agendamento"}`
- `decide_tool_call(tool_name, args, session_id, identity, papel, secret, now_ms=None) -> dict`:
  - `SAFE_BUILTINS` (o que já existe hoje) → allow;
  - identidade desconhecida → block;
  - tool fora do prefixo e fora de `SAFE_BUILTINS` → block;
  - prefixo + `papel == "cliente"` + nome fora de `CLIENT_TOOLS` → block "Essa ação é só para a equipe da oficina.";
  - sem `secret` → block;
  - senão, `modify` com `args["caller"] = caller_envelope(identity, session_id, secret)` (descartando qualquer `caller` que o modelo tenha mandado).

  A API decide o papel de novo de forma independente. O bloqueio aqui só economiza uma ida à API e dá uma mensagem melhor.
- Modo de teste igual ao da Isabelle: com `ARNALDO_TEST_MODE=1` e `source == "cli"`, a identidade vem de `ARNALDO_TEST_CALLER`. Usar `--source cli` no `hermes chat`; `-q` sozinho vira sessão `oneshot` e ignora a variável (armadilha de 07/10).

- [ ] **Teste primeiro** (`test_oficina.py`):
  - cliente → `mcp__oficina__agendar` = modify com `caller.phone` do cliente e `sig` = HMAC conferido;
  - cliente → `mcp__oficina__abrir_os` = block;
  - patio → `mcp__oficina__abrir_os` = modify;
  - `caller` injetado pelo modelo é substituído;
  - `terminal` = block para qualquer papel;
  - identidade None = block;
  - o envelope bate com o vetor fixo: `sign("5547984889108","sess1",1000000,"s3gr3d0") == "11f0e64ac3ecbd039886d7218c15db06d30f53801bbccd2acd206744a9b7056e"` (o mesmo do teste A1).
- [ ] Rodar e ver falhar; implementar; rodar todos os testes do plugin e ver passar; commit `feat(md_arnaldo): ferramentas da oficina com chamador assinado`.

### Tarefa B3: "a Simone assumiu", com o Arnaldo saindo da conversa quando alguém da oficina digita pelo celular

**Contexto verificado no código do Hermes v0.21.5:**
- com `WHATSAPP_FORWARD_OWNER_MESSAGES=true` no `.env` do perfil, o bridge (`/opt/hermes-agent/scripts/whatsapp-bridge/bridge.js`, ~linha 549) repassa as mensagens `fromMe` digitadas no celular. O eco do que o próprio bot enviou fica de fora, porque é filtrado por `recentlySentIds`;
- o adapter (`plugins/platforms/whatsapp/adapter.py:864`) marca essas mensagens com `event.metadata["whatsapp_from_owner"] = True`;
- **sem tratamento no plugin, essas mensagens viram turno do agente**, como se o cliente tivesse escrito o que a Simone digitou. Por isso a flag só pode ser ligada **depois** que este código estiver instalado (Parte C);
- **armadilha de 13/10:** mensagem que chega com turno em andamento entra na fila e **não passa por `pre_gateway_dispatch`**. Então o filtro tem de ficar no **`adapter.handle_message`** (embrulho), que é o mesmo ponto onde o plugin já embrulha o adapter (`_guard_adapter`). Ler `_guard_adapter` e `_guard_future_adapters` em `__init__.py` e seguir o mesmo padrão.

**Arquivos:**
- Modificar: `hermes/plugins/md_arnaldo/core.py` (funções puras), `__init__.py` (embrulho e estado)
- Teste: `hermes/plugins/md_arnaldo/tests/test_humano_assumiu.py`

**Interfaces (puras, em `core.py`):**
- `HUMANO_TTL_S = 4 * 3600`
- `registrar_humano(estado: dict, chat_id: str, agora: float) -> dict`: grava `estado[chat_id] = agora`
- `humano_no_controle(estado: dict, chat_id: str, agora: float, inicio_do_dia_local: float) -> bool`: verdadeiro se houver registro com `agora - t < HUMANO_TTL_S` **e** `t >= inicio_do_dia_local` (vale no máximo até a virada do dia)

O estado persiste em `<perfil>/humano-assumiu.json` (gravação atômica: arquivo tmp + `os.replace`), para sobreviver a reinício.

**Comportamento no embrulho de `adapter.handle_message(event)`:**
1. `event.metadata.get("whatsapp_from_owner")`: `registrar_humano` (cada mensagem dela renova as 4 h), auditar `humano_assumiu` e **descartar**. **Nunca** deixar uma mensagem do dono virar turno. Não existe comando de liberar: qualquer coisa que a Simone digite naquele chat chega ao cliente, então a conversa volta para o Arnaldo sozinha depois de 4 h sem ela digitar ou na virada do dia.
2. Mensagem normal de cliente com `humano_no_controle` → descartar sem resposta, auditar `silencio_humano` e gravar em `<perfil>/humano-feed.jsonl` (chat, hora, texto), para a Simone ter o histórico.
3. Equipe (papel diferente de cliente, via `equipe.json`) nunca entra no "humano no controle": a Simone falando **com o Arnaldo** pelo número dela é outra conversa.
4. Em grupo não se aplica: o bridge já descarta `fromMe` em grupo.

**Testes:**
- registrar e consultar dentro e fora das 4 h;
- registro de ontem não vale hoje;
- cada mensagem dela renova o prazo;
- o embrulho com evento `whatsapp_from_owner` **não** chama o `handle_message` original;
- cliente em chat com humano não chama o original;
- equipe passa;
- estado gravado e relido do arquivo.

Commit `feat(md_arnaldo): Arnaldo sai da conversa quando a oficina digita pelo celular`.

### Tarefa B4: MCP `oficina`

**Arquivos:**
- Criar: `hermes/mcp/oficina-mcp/package.json`, `server.mjs`, `tools.mjs`

- [ ] Ler e copiar a estrutura de `/dados/hermes-agent-1/config/profiles/isabelle-lanchas-show/mcp/lanchas-mcp/server.mjs` e `tools.mjs` (`scp` para olhar), usando a **mesma versão** de `@modelcontextprotocol/sdk` do `package.json` dela.
- [ ] `tools.mjs`: uma entrada por ação do catálogo (P0, mais P1 se a A6 existir), com `description` em português dizendo **quando** usar e **o que não fazer**. Exemplo para `status_do_carro`: "Use quando alguém perguntar como está o carro. Para cliente, só funciona com carro do próprio número. Nunca invente etapa ou prazo." Os `inputSchema` em JSON Schema batem com os args do catálogo, e **toda** ferramenta tem `reason: {type: "string"}` opcional. O `caller` **não** aparece no schema: o plugin injeta.
- [ ] `server.mjs`: em cada chamada, `POST process.env.ARNALDO_API_URL` com os headers do contrato (`x-arnaldo-token: ARNALDO_API_TOKEN`, `authorization: Bearer ARNALDO_SUPABASE_ANON`) e o body `{acao, args: <args sem caller>, caller: args.caller}`, com timeout de 25 s. A resposta da API vai **inteira** como texto JSON para o modelo. Em erro de rede ou timeout, devolve `{"ok":false,"erro":"erro_interno","mensagem":"Sistema da oficina fora do ar agora. NÃO diga que foi feito.","nao_diga_que_fez":true}`.
- [ ] **`anexar_foto` especial:** o schema recebe `caminho_imagem` (o caminho local que o Hermes mostra para a imagem recebida no WhatsApp). O MCP lê o arquivo **só** se o `realpath` estiver dentro de `/root/.hermes/profiles/arnaldo-md-mecanica/image_cache/` ou de `/root/.hermes/image_cache/` e se o tamanho for até 8 MB, converte para base64 e manda `imagem_base64` + `mime` (pela extensão). Qualquer outro caminho → `dados_invalidos`. Antes de fechar o schema, confirmar onde as imagens recebidas ficam salvas: olhar `image_cache/` no perfil e uma linha `vision_analyze` no `logs/agent.log`.
- [ ] Teste com `node --test` (`hermes/mcp/oficina-mcp/test/server.test.mjs`): com `fetch` falso, conferir headers, body sem `caller` dentro de `args`, timeout → erro padronizado e caminho fora do `image_cache` recusado.
- [ ] Commit `feat(hermes): MCP oficina`.

### Tarefa B5: SOUL, skills, config e deploy (sem ligar nada)

**Arquivos:**
- Modificar: `hermes/arnaldo/SOUL.md`
- Criar: `hermes/arnaldo/skills/md-mecanica/{atendimento-cliente,agenda,checkin-e-os,gestao-financeiro}/SKILL.md`, `hermes/scripts/deploy-arnaldo.sh`, `hermes/README.md`

**SOUL.md:**
- **remover** a seção "O que você AINDA não consegue fazer" e as frases "Hoje você não tem sistema ligado";
- **acrescentar** a seção "O sistema da oficina", com estas regras (são princípios; o passo a passo fica nas skills):
  - o sistema é a fonte da verdade. Placa, etapa, horário livre e OS só valem se vierem de uma ferramenta nesta conversa;
  - só diga "agendei", "abri a OS" ou "registrei" depois de a ferramenta responder `ok: true`. Se vier `ok: false` ou `nao_diga_que_fez`, conte com honestidade que não conseguiu e que vai chamar a Dona Simone;
  - antes de agendar, sempre consulte `horarios_livres` e ofereça no máximo 3 opções. Confirme dia e hora com o cliente **antes** de chamar `agendar`;
  - cliente novo: pegue nome, placa, marca e modelo e chame `cadastrar_cliente_veiculo` antes de agendar. O telefone é o do WhatsApp; não pergunte;
  - orçamento: você nunca diz valor. Se a OS estiver aguardando aprovação, mande o `link_orcamento` que a ferramenta devolveu, dizendo que lá aparece o orçamento e dá pra aprovar;
  - check-in: siga a skill `checkin-e-os`. Foto que chegar durante o check-in vai com `anexar_foto` (tipo CHECKIN_PHOTO);
  - você não manda mensagem por conta própria. Se o cliente pedir para ser avisado, diga que a equipe avisa ou que ele pode perguntar aqui a qualquer hora;
- manter as seções de sigilo, tom, pátio, segurança e honestidade sobre ser IA.

**Skills** (cada uma com `---\nname: ...\ndescription: ...\n---` no padrão das skills `lanchas-show` da Isabelle; abrir uma para copiar o formato):
- `atendimento-cliente`: fluxo de abertura → identificar (`meus_dados`) → defeito → agendar ou status;
- `agenda`: `horarios_livres` → oferecer → confirmar → `agendar`; remarcar e cancelar; equipe pedindo "o que tem hoje" → `agenda_do_dia`;
- `checkin-e-os`: os 7 passos de check-in que já estão no SOUL atual, agora com `abrir_os` → `registrar_checkin` → `anexar_foto`; diagnóstico; itens; mover etapa; atribuir mecânico/box; a regra de conferir combo de peças (já está no SOUL);
- `gestao-financeiro`: só equipe G/D; precificar → enviar_orcamento; qualidade; pagamento; resumo; contas.

**`deploy-arnaldo.sh`** (rodar do Windows, em Git Bash):
- variáveis: `HOST=lipeeflores@100.67.51.23`, `KEY=~/.ssh/servidor_lipe`, `P=/dados/hermes-agent-1/config/profiles/arnaldo-md-mecanica`;
- `TS=$(date +%Y%m%d-%H%M%S)`;
- no servidor: `sudo tar czf /dados/backups/arnaldo-$TS.tgz -C $P SOUL.md config.yaml .env plugins skills/md-mecanica 2>/dev/null || true`;
- enviar por `scp` para `/tmp/arnaldo-deploy-$TS/` e copiar com `sudo cp -r`:
  - `SOUL.md`;
  - `plugins/md_arnaldo/*` (sem `tests` e sem cache);
  - `mcp/oficina-mcp` em `$P/mcp/oficina-mcp`, rodando `npm ci --omit=dev` **dentro do container** com o node do Hermes: `sudo docker exec -w /root/.hermes/profiles/arnaldo-md-mecanica/mcp/oficina-mcp hermes-agent-1 sh -c 'PATH=/root/.hermes/node/bin:$PATH npm ci --omit=dev'`;
  - `skills/md-mecanica`;
- **nunca** `rm -rf` em `skills/` (lição de 20/09).

**Config:** script Python que **não** reinicia nada, com backup antes (`config.yaml.bak-oficina-$TS`), `yaml.safe_load` antes e depois, e escrita atômica. Ele:
- acrescenta em `config.yaml`:
  ```yaml
  mcp_servers:
    oficina:
      command: /root/.hermes/node/bin/node
      args: [/root/.hermes/profiles/arnaldo-md-mecanica/mcp/oficina-mcp/server.mjs]
      env:
        ARNALDO_API_URL: ${ARNALDO_API_URL}
        ARNALDO_API_TOKEN: ${ARNALDO_API_TOKEN}
        ARNALDO_SUPABASE_ANON: ${ARNALDO_SUPABASE_ANON}
      timeout: 40
      connect_timeout: 30
  ```
- muda `compression.threshold_tokens: 140000` para `60000` (lição da Isabelle);
- **não** mexe em `.env` nem em `PAUSA`.

**Poda de skills:** o perfil tem 98 `SKILL.md` genéricas (apple, github, mlops…) que só gastam token. Mover (não apagar) tudo que não for `md-mecanica` para `skills.removidas-20261016/` e gerar o tar de backup `skills.bak-20261016.tgz` antes. É o mesmo procedimento feito na Isabelle em 24/09.

**Verificação sem WhatsApp** (com `PAUSA` ainda presente):
- os testes do plugin passam dentro do container;
- `sudo docker exec hermes-agent-1 hermes --profile arnaldo-md-mecanica mcp test oficina` lista as ferramentas. Isso **não prova** que o plugin libera; esse teste é da Parte C, com turno de verdade;
- registrar no README os comandos de verificação.

**Inventário do Vigia:** acrescentar o MCP `oficina` e a saúde da `arnaldo-api` em `C:\Users\lipee\Desktop\projeto lanchas show\hermes\vigia\inventario.yaml`, seguindo o formato das entradas da Isabelle (regra permanente de 24/09). Commit **no repo lanchas-show**: `feat(vigia): inventaria arnaldo/oficina`.

Commit no garageflow: `feat(hermes): SOUL, skills e deploy do Arnaldo com o sistema`. Fazer merge da `arnaldo-hermes` em `main` e push.

---

# PARTE C: Ligar (Opus + Lipe, sábado e domingo)

**O Lipe faz (ninguém mais consegue):**
1. **Lovable → Cloud → Secrets:** criar `ARNALDO_API_TOKEN`, `ARNALDO_CALLER_SECRET` e `ARNALDO_APP_URL`.
2. **No garageflow (Configurações → Usuários):** criar usuário para a Simone (MANAGER), o Márcio (ADMIN) e cada mecânico (MECHANIC/PATIO), **com o telefone de WhatsApp preenchido no perfil**. Sem isso, a API trata todos como cliente.
3. Mandar os mesmos números para o `equipe.json`. É a muralha de texto do plugin; os números têm de bater com o passo 2.
4. Confirmar a regra de agenda (dias, horário, carros por horário).
5. Explicar à Simone: quando ela responde um cliente pelo celular, o Arnaldo sai daquela conversa até ela ficar 4 h sem digitar ali, ou até a virada do dia. Não precisa de comando. Se ela quiser outro prazo, é uma constante (`HUMANO_TTL_S`).
6. Cada pessoa da equipe manda um "oi" para o número da oficina antes de segunda (primeiro contato sempre parte do humano).

**O Opus faz (a sequência importa):**
1. Gravar no `.env` do perfil (com backup): `ARNALDO_API_URL`, `ARNALDO_API_TOKEN`, `ARNALDO_SUPABASE_ANON`, `ARNALDO_CALLER_SECRET`, `ARNALDO_TEST_MODE=1`.
2. Reiniciar o gateway do Arnaldo: `kill -TERM` no PID achado por `/proc/*/cmdline` **dentro** do container (armadilha de 13/10). Conferir `✓ whatsapp connected` e o plugin carregado no `agent.log` depois desse horário. O `PAUSA` **continua**.
3. Fazer o E2E por `hermes --profile arnaldo-md-mecanica chat --source cli`, com `ARNALDO_TEST_CALLER` variando, sem WhatsApp. Roteiro:
   - cliente novo cadastra, consulta horário e agenda;
   - cliente pergunta o status de uma placa de outro cliente;
   - pátio abre OS a partir do agendamento, faz check-in e move etapa;
   - pátio pergunta o valor (tem de negar);
   - gestão precifica e envia orçamento;
   - cliente pergunta o status e recebe o link;
   - tudo com `[TESTE]`, apagado no fim.
4. Ligar `WHATSAPP_FORWARD_OWNER_MESSAGES=true` e reiniciar. Com o `PAUSA` ainda ativo, pedir ao Lipe que digite algo pelo celular da oficina numa conversa de teste. Esperado: `humano_assumiu` na auditoria, **nenhum turno no agent.log**.
5. **Domingo à noite:** Lipe testa de ponta a ponta pelo WhatsApp, com o celular dele como cliente (antes, tirar o número dele do `equipe.json`, ou usar um segundo aparelho), com o `PAUSA` retirado só durante o teste.
6. **Segunda às 07h45:** tirar `ARNALDO_TEST_MODE`, apagar o `PAUSA` e acompanhar `gateway.log` e `agent.log` durante a primeira hora. Atualizar a memória `arnaldo-md-mecanica` e criar `Hermes/Incidentes/2026-10-19 Arnaldo no ar.md`.

**Plano de volta:** `touch PAUSA` cala tudo na hora. Desligar `WHATSAPP_FORWARD_OWNER_MESSAGES` e reiniciar volta ao estado de antes.

---

## Riscos conhecidos

| risco | sinal | o que fazer |
|---|---|---|
| Lovable não publica função vinda do GitHub | 404 na A0 | Lipe pede a publicação no chat do Lovable; se nem assim, conversar sobre migrar o banco para o Supabase do Lipe (não cabe até segunda) |
| Lovable sobrescreve `supabase/config.toml` e liga o `verify_jwt` | 401 sem anon | o MCP já manda `authorization: Bearer <anon>` |
| `profiles.phone` vazio ou em formato estranho | equipe vira cliente | a normalização em JS cobre formatos; o passo 2 do Lipe preenche |
| A Simone digita no celular e o Arnaldo responde junto | dois atendentes na mesma conversa | a B3 resolve; testar na C4 antes de segunda |
| Modelo do combo `hermes-negocio` lento ou 429 | turnos de 60 s ou mais | olhar `call_logs` do omniroute (armadilha de 13/10) |
| Cliente manda várias fotos em sequência | vários turnos | conhecido; fica para depois de segunda |
