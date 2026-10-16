# Documentos da MD: o que o Lipe cola no Lovable

Parte D1 (banco e API) do plano `2026-10-15-documentos-md.md`. Está tudo em `main`; o Lovable só aplica e publica quando o Lipe pede no chat dele. **Nada foi aplicado em produção ainda.**

## Os 3 pedidos, em ordem (copiar e colar, um por mensagem)

**1. Migração**

> Aplique a migração `supabase/migrations/20261016090000_documentos_md.sql` que chegou pelo GitHub.

**2. Telas** (só depois de a migração aplicada; o Lovable regenera o `types.ts` sozinho)

> Na tela de check-in, acrescente: Estepe (sim/não), Estado do estepe, Macaco (sim/não), Chave de roda (sim/não), Avarias (texto). Na OS, mostre o número da OS (formato 0001) e, na entrega, Km de saída, Garantia até e Próxima revisão (km e data).

**3. Função**

> Publique de novo a edge function arnaldo-api.

Depois do pedido 3, conferir:

```
curl -s "https://jodyrgwdpxrjlglepzjh.supabase.co/functions/v1/arnaldo-api?saude=1"
```

Esperado: `versao` começando com `d1-` (a `VERSAO` do `index.ts` do commit desta parte). Se continuar `a5-…`, o Lovable não publicou. Aviso: o commit da A6 (`b123d4b`, ações financeiras) também só vai ao ar nesse mesmo pedido, porque a função é publicada inteira.

## O que a migração faz (aditiva e idempotente)

Arquivo: `supabase/migrations/20261016090000_documentos_md.sql`. Pode ser aplicada duas vezes. Não tem `DROP`, `RENAME` nem `ALTER ... TYPE`.

- `work_orders`: colunas `numero`, `km_saida`, `entregue_em`, `garantia_ate`, `proxima_revisao_km`, `proxima_revisao_data`.
- `work_order_checkins`: `tem_estepe`, `estado_estepe`, `tem_macaco`, `tem_chave_roda`, `avarias` (o `customer_items` continua sendo os pertences).
- Função e trigger `work_orders_set_numero` (`BEFORE INSERT`): preenche `numero` com `max(numero)+1` do tenant, sob `pg_advisory_xact_lock` por tenant. Duas OS abertas ao mesmo tempo não repetem número.
- Backfill das OS que já existem, por `created_at, id`, por tenant. Só preenche quem está sem número e continua depois do maior número já usado, então rodar de novo não renumera.
- `UNIQUE INDEX work_orders_tenant_numero_key (tenant_id, numero)`.
- `NOTIFY pgrst, 'reload schema'` no fim, para a API enxergar as colunas novas.

`src/integrations/supabase/types.ts` ganhou **à mão** só as colunas novas (diff mínimo, 33 linhas); o Lovable vai regenerar.

## Ordem importa menos do que parece (a API se protege)

Se a função for publicada **antes** da migração:
- `registrar_checkin` com estepe/macaco/chave/avarias não falha: grava no formato antigo e coloca esses dados no texto dos pertences (`Estepe: sim (bom); Macaco: sim; …`), devolvendo um `aviso`.
- `dados_documento` e `ver_os` funcionam (as colunas novas vêm como `null`; o `numero` também, então documentos saem sem número até a migração).
- `registrar_entrega` **falha** com `erro_interno` (grava colunas que ainda não existem). Nada é gravado pela metade.

Mesmo assim, pedir na ordem 1 → 2 → 3.

## Configuração opcional (sem migração)

`tenants.settings.documentos` (JSON) sobrepõe os padrões do código, quando a Simone quiser mudar: `validade_orcamento_dias` (7), `garantia_dias` (90), `formas_pagamento` ("PIX, cartão ou dinheiro"), `texto_aprovacao`, `texto_ficha`, `texto_garantia`. Chaves desconhecidas são ignoradas.

## TODO registrado: marcar avaria nas fotos

O app ainda não marca uma foto como avaria. Regra de hoje: `fotos[].avaria = true` quando a **legenda** ou o **nome do arquivo** contém "avaria" (sem diferenciar maiúsculas). A legenda vem de `attachments.file_name`, porque a tabela não tem coluna de legenda:
- fotos do app (`CheckinDialog`): `checkin-front.jpg` → "Frente", `-back` → "Traseira", `-left` → "Lateral esq.", `-right` → "Lateral dir.";
- fotos do Arnaldo (`anexar_foto` com `legenda`): o nome passa a ser `<tipo>__<legenda>__<timestamp>.<ext>`, e a legenda sai de dentro.

Quando o Lovable puder, o ideal é uma coluna `legenda` (e `avaria boolean`) em `attachments` e um campo "Avaria" no envio de fotos do check-in. Pedido sugerido, para depois: *"Na tela de check-in, nas fotos, deixe marcar uma foto como 'Avaria' e escrever uma legenda."* Quando existir, é só trocar `legendaDaFoto`/`ehAvaria` em `_shared/arnaldo/documentos.ts`.

## Pendência do Lipe (não é do Lovable)

Preencher o telefone da Simone (98488-9113) e do Márcio (98488-9097) nos usuários deles no garageflow, com papel Admin. Sem isso a API trata os dois como cliente (e `dados_documento` de orçamento e recibo só devolve a OS do próprio veículo).
