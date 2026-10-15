import { GESTAO, ErroArnaldo, dinheiro, escolha, ok, type Acao } from "../util.ts";
import { osDoArg } from "../os.ts";
import { FORMAS_PAGAMENTO, ROTULO_FORMA, centavos } from "../financeiro.ts";

const JANELA_DUPLICADO_MS = 120_000;

// Espelha useCreatePayment (src/hooks/usePayments.ts): payments + financial_entries (RECEITA).
const acao: Acao = {
  papeis: GESTAO,
  async run(args, ctx) {
    const valor = dinheiro(args.valor, "valor")!;
    const forma = escolha(args, "forma", FORMAS_PAGAMENTO)!;
    const os = await osDoArg(ctx, args);
    const t = ctx.tenantId;

    // Retentativa do modelo não pode lançar o mesmo dinheiro duas vezes.
    const desde = new Date(ctx.agora.getTime() - JANELA_DUPLICADO_MS).toISOString();
    const recentes = ok(
      await ctx.db.from("payments").select("id").eq("tenant_id", t).eq("work_order_id", os.id)
        .eq("amount", valor).eq("payment_method", forma).gte("paid_at", desde).limit(1),
      "payments",
    ) ?? [];
    if (recentes.length) {
      throw new ErroArnaldo("conflito", "Já existe um pagamento igual registrado há instantes nessa OS. Não lancei outro; confira com ver_os antes de repetir.");
    }

    const pg = ok(
      await ctx.db.from("payments").insert({
        tenant_id: t, work_order_id: os.id, amount: valor, payment_method: forma, notes: null,
        processed_by: ctx.atorId, paid_at: ctx.agora.toISOString(),
      }).select().single(),
      "payments",
    );
    const entrada = await ctx.db.from("financial_entries").insert({
      tenant_id: t, work_order_id: os.id, payment_id: pg.id, amount: valor, entry_type: "RECEITA",
      category: ROTULO_FORMA[forma], description: `Pagamento OS ${String(os.id).slice(0, 8).toUpperCase()}`,
    });
    if (entrada.error) {
      await ctx.db.from("payments").delete().eq("tenant_id", t).eq("id", pg.id); // não deixa pagamento sem lançamento
      throw new Error(`financial_entries: ${entrada.error.message}`);
    }

    const todos = ok(await ctx.db.from("payments").select("amount").eq("tenant_id", t).eq("work_order_id", os.id), "payments") ?? [];
    const totalPago = centavos(todos.reduce((s: number, p: any) => s + Number(p.amount), 0));
    const totalOs = Number(os.total_amount) || 0;
    return { pagamento_id: pg.id, valor, forma, total_pago: totalPago, total_os: totalOs, saldo: centavos(totalOs - totalPago) };
  },
};
export default acao;
