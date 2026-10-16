import { GESTAO, ErroArnaldo, invalido, ok, type Acao } from "../util.ts";
import { gravarEtapa, numeroDe, osDoArg } from "../os.ts";
import { totalDosItens } from "../financeiro.ts";

const acao: Acao = {
  papeis: GESTAO,
  async run(args, ctx) {
    const os = await osDoArg(ctx, args);
    const etapa = String(os.workflow_step);
    if (etapa !== "AGUARDANDO_ORCAMENTO" && etapa !== "AGUARDANDO_APROVACAO") {
      throw new ErroArnaldo("etapa_invalida", `Só dá para enviar orçamento de OS em "aguardando orçamento"; esta está em ${etapa}.`);
    }
    const { total, itens, precos } = await totalDosItens(ctx, os.id);
    if (itens.length === 0) throw invalido("Essa OS não tem nenhum item. Adicione os itens e o preço antes de enviar o orçamento.");
    // mesma regra do BudgetQuickDialog: todo item precisa de total_price > 0
    const semPreco = itens.filter((i) => !(Number(precos.find((p) => p.work_order_item_id === i.id)?.total_price) > 0));
    if (semPreco.length) {
      throw invalido(`Faltam preços nestes itens: ${semPreco.map((i) => i.description).join("; ")}. Nada foi enviado.`);
    }

    ok(await ctx.db.from("work_orders").update({ total_amount: total }).eq("tenant_id", ctx.tenantId).eq("id", os.id), "work_orders");
    if (etapa === "AGUARDANDO_ORCAMENTO") await gravarEtapa(ctx, os.id, "AGUARDANDO_APROVACAO");

    const dados: Record<string, unknown> = { ...numeroDe(os), etapa: "AGUARDANDO_APROVACAO", total_amount: total };
    if (ctx.appPublicUrl) {
      dados.link_orcamento = `${ctx.appPublicUrl}/orcamento/${os.id}?token=${String(os.id).slice(0, 8).toUpperCase()}`;
    }
    return dados;
  },
};
export default acao;
