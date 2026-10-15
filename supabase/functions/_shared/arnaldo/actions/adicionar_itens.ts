import { EQUIPE, escolha, inteiro, invalido, ok, texto, type Acao } from "../util.ts";
import { osDoArg } from "../os.ts";

const TIPOS = ["SERVICE", "PART"] as const;
const MAX_ITENS = 30;

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const lista = args.itens;
    if (!Array.isArray(lista) || lista.length === 0) throw invalido('"itens" precisa ser uma lista com pelo menos 1 item.');
    if (lista.length > MAX_ITENS) throw invalido(`No máximo ${MAX_ITENS} itens por chamada.`);
    // valida tudo antes de gravar: um item ruim derruba o lote inteiro
    const os = await osDoArg(ctx, args);
    const linhas = lista.map((it, n) => {
      if (!it || typeof it !== "object") throw invalido(`Item ${n + 1} inválido.`);
      const a = it as Record<string, unknown>;
      try {
        return {
          tenant_id: ctx.tenantId, work_order_id: os.id,
          item_type: escolha(a, "tipo", TIPOS)!,
          description: texto(a, "descricao", { max: 300 })!,
          quantity: inteiro(a, "quantidade", { obrig: false, min: 1, max: 999 }) ?? 1,
          part_code: texto(a, "codigo", { obrig: false, max: 80 }) ?? null,
        };
      } catch (e) {
        throw invalido(`Item ${n + 1}: ${(e as Error).message}`);
      }
    });
    const criados = ok(await ctx.db.from("work_order_items").insert(linhas).select(), "work_order_items");
    return { itens: (criados ?? []).map((i: any) => i.id) };
  },
};
export default acao;
