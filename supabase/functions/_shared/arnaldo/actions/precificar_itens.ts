import { GESTAO, dinheiro, invalido, ok, type Acao } from "../util.ts";
import { osDoArg } from "../os.ts";
import { centavos, exigirOsAberta, itensDaOs, totalDosItens } from "../financeiro.ts";

const MAX = 50;

const acao: Acao = {
  papeis: GESTAO,
  async run(args, ctx) {
    const lista = args.precos;
    if (!Array.isArray(lista) || lista.length === 0) throw invalido('"precos" precisa ser uma lista com pelo menos 1 item.');
    if (lista.length > MAX) throw invalido(`No máximo ${MAX} preços por chamada.`);
    const os = await osDoArg(ctx, args);
    exigirOsAberta(os);
    const itens = await itensDaOs(ctx, os.id);

    // valida tudo antes de gravar: um preço ruim derruba o lote
    const linhas = lista.map((p, n) => {
      const a = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const item = itens.find((i) => i.id === String(a.item_id ?? ""));
      if (!item) throw invalido(`Preço ${n + 1}: o item "${String(a.item_id ?? "")}" não é desta OS. Use os ids que vêm de ver_os.`);
      try {
        const preco = dinheiro(a.preco_unitario, "preco_unitario")!;
        const custo = dinheiro(a.custo_unitario, "custo_unitario", { obrig: false, positivo: false });
        return { item, preco, custo };
      } catch (e) {
        throw invalido(`Preço ${n + 1} (${item.description}): ${(e as Error).message}`);
      }
    });

    for (const { item, preco, custo } of linhas) {
      const dados = { unit_price: preco, total_price: centavos(preco * Number(item.quantity)), unit_cost: custo ?? null };
      const existente = ok(
        await ctx.db.from("work_order_pricing").select("id").eq("tenant_id", ctx.tenantId).eq("work_order_item_id", item.id).maybeSingle(),
        "work_order_pricing",
      );
      if (existente) {
        ok(
          await ctx.db.from("work_order_pricing").update({ ...dados, updated_at: ctx.agora.toISOString() }).eq("id", existente.id),
          "work_order_pricing",
        );
      } else {
        ok(
          await ctx.db.from("work_order_pricing").insert({ ...dados, work_order_item_id: item.id, tenant_id: ctx.tenantId }),
          "work_order_pricing",
        );
      }
    }

    const { total } = await totalDosItens(ctx, os.id);
    ok(await ctx.db.from("work_orders").update({ total_amount: total }).eq("tenant_id", ctx.tenantId).eq("id", os.id), "work_orders");
    return { itens_precificados: linhas.length, total };
  },
};
export default acao;
