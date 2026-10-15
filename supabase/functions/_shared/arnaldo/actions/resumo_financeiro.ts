import { formatarLocal } from "../agenda.ts";
import { GESTAO, dataObrigatoria, invalido, ok, type Acao } from "../util.ts";
import { ROTULO_FORMA_RESUMO, centavos } from "../financeiro.ts";

const DIA_MS = 24 * 3600_000;
const EM_ANDAMENTO = ["PRONTO_PARA_RETIRADA", "APROVADO", "EM_EXECUCAO", "EM_QUALIDADE"];

// Mesmo cálculo de useFinancialData.ts, para um período [de, ate] (datas inclusivas).
const acao: Acao = {
  papeis: GESTAO,
  async run(args, ctx) {
    const deMs = dataObrigatoria(args.de, "de");
    const ateMs = dataObrigatoria(args.ate, "ate");
    if (ateMs < deMs) throw invalido('"ate" não pode ser antes de "de".');
    if ((ateMs - deMs) / DIA_MS > 366) throw invalido("O período máximo é de 366 dias.");
    const de = formatarLocal(deMs).slice(0, 10), ate = formatarLocal(ateMs).slice(0, 10);
    const ini = formatarLocal(deMs), fim = formatarLocal(ateMs + DIA_MS);
    const t = ctx.tenantId;

    const receitas = ok(
      await ctx.db.from("financial_entries").select("amount").eq("tenant_id", t).eq("entry_type", "RECEITA")
        .gte("entry_date", de).lte("entry_date", ate).limit(20000),
      "financial_entries",
    ) ?? [];
    const receita = centavos(receitas.reduce((s: number, e: any) => s + Number(e.amount), 0));

    const pagamentos = ok(
      await ctx.db.from("payments").select("payment_method, amount").eq("tenant_id", t).gte("paid_at", ini).lt("paid_at", fim).limit(20000),
      "payments",
    ) ?? [];
    const porForma: Record<string, number> = {};
    for (const p of pagamentos) porForma[p.payment_method] = (porForma[p.payment_method] ?? 0) + Number(p.amount);

    const finalizadas = ok(
      await ctx.db.from("work_orders").select("id").eq("tenant_id", t).eq("workflow_step", "FINALIZADO")
        .gte("created_at", ini).lt("created_at", fim).limit(20000),
      "work_orders",
    ) ?? [];
    const andamento = ok(
      await ctx.db.from("work_orders").select("total_amount").eq("tenant_id", t).in("workflow_step", EM_ANDAMENTO).limit(20000),
      "work_orders",
    ) ?? [];

    return {
      de, ate, receita,
      por_forma: Object.entries(porForma).map(([f, v]) => ({ forma: ROTULO_FORMA_RESUMO[f] ?? f, valor: centavos(v) })),
      os_finalizadas: finalizadas.length,
      ticket_medio: finalizadas.length ? centavos(receita / finalizadas.length) : 0,
      em_andamento: centavos(andamento.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0)),
    };
  },
};
export default acao;
