import { diaLocal, GESTAO, ErroArnaldo, dataObrigatoria, dinheiro, escolha, invalido, ok, texto, type Acao, type Args } from "../util.ts";
import { formatarLocal } from "../agenda.ts";
import { centavos } from "../financeiro.ts";

const ACOES = ["listar", "criar", "pagar"] as const;
const CATEGORIAS = ["FIXA", "FLUTUANTE"] as const;
const STATUS = ["PENDENTE", "PAGO", "VENCIDO", "CANCELADO"] as const;

const vista = (b: any) => ({
  id: b.id, descricao: b.description, valor: Number(b.amount), vencimento: b.due_date, categoria: b.category, status: b.status,
  fornecedor: b.supplier ?? null, pago_em: b.paid_at ?? null, valor_pago: b.paid_amount ?? null,
});

// Espelha useBills.ts: bills (criar), useMarkBillPaid (pagar) e useBillsSummary (resumo).
async function listar(args: Args, ctx: any) {
  const categoria = escolha(args, "categoria", CATEGORIAS, false);
  const status = escolha(args, "status", STATUS, false);
  let q = ctx.db.from("bills").select("*").eq("tenant_id", ctx.tenantId);
  q = status ? q.eq("status", status) : q.in("status", ["PENDENTE", "VENCIDO"]);
  if (categoria) q = q.eq("category", categoria);
  const contas = ok(await q.order("due_date", { ascending: true }).limit(100), "bills") ?? [];

  const hoje = diaLocal(ctx.agora.getTime());
  const resumo = { pendente: 0, vencido: 0, fixas: 0, flutuantes: 0 };
  for (const b of contas) {
    if (b.status !== "PENDENTE" && b.status !== "VENCIDO") continue;
    const v = Number(b.amount);
    if (b.status === "VENCIDO" || b.due_date < hoje) resumo.vencido += v; else resumo.pendente += v;
    if (b.category === "FIXA") resumo.fixas += v; else resumo.flutuantes += v;
  }
  for (const k of Object.keys(resumo) as (keyof typeof resumo)[]) resumo[k] = centavos(resumo[k]);
  return { contas: contas.map(vista), resumo };
}

async function criar(args: Args, ctx: any) {
  const descricao = texto(args, "descricao", { max: 200 })!;
  const valor = dinheiro(args.valor, "valor")!;
  const venc = formatarLocal(dataObrigatoria(args.vencimento, "vencimento")).slice(0, 10);
  const categoria = escolha(args, "categoria", CATEGORIAS, false) ?? "FLUTUANTE";
  const recorrente = args.recorrente === true || args.recorrente === "true";
  const diaRec = recorrente ? Number(args.dia_recorrencia ?? venc.slice(8, 10)) : null;
  if (diaRec !== null && !(Number.isInteger(diaRec) && diaRec >= 1 && diaRec <= 31)) throw invalido('"dia_recorrencia" precisa ser de 1 a 31.');
  const conta = ok(
    await ctx.db.from("bills").insert({
      tenant_id: ctx.tenantId, description: descricao, amount: valor, category: categoria, due_date: venc,
      supplier: texto(args, "fornecedor", { obrig: false, max: 120 }) ?? null,
      notes: texto(args, "observacoes", { obrig: false, max: 500 }) ?? null,
      is_recurring: recorrente, recurrence_day: diaRec, status: "PENDENTE", created_by: ctx.atorId,
    }).select().single(),
    "bills",
  );
  return { conta: vista(conta) };
}

async function pagar(args: Args, ctx: any) {
  const id = texto(args, "conta_id", { max: 64 })!;
  const conta = ok(await ctx.db.from("bills").select("*").eq("tenant_id", ctx.tenantId).eq("id", id).maybeSingle(), "bills");
  if (!conta) throw new ErroArnaldo("nao_encontrado", "Não achei essa conta a pagar.");
  if (conta.status !== "PENDENTE" && conta.status !== "VENCIDO") {
    throw invalido(`Essa conta já está ${String(conta.status).toLowerCase()}; não dá para pagar de novo.`);
  }
  const pago = dinheiro(args.valor, "valor", { obrig: false }) ?? Number(conta.amount);
  const agora = ctx.agora.toISOString();
  ok(
    await ctx.db.from("bills").update({ status: "PAGO", paid_at: agora, paid_amount: pago, updated_at: agora }).eq("tenant_id", ctx.tenantId).eq("id", id),
    "bills",
  );
  return { conta: vista({ ...conta, status: "PAGO", paid_at: agora, paid_amount: pago }) };
}

const acao: Acao = {
  papeis: GESTAO,
  async run(args, ctx) {
    const o = String(args.acao ?? "").trim().toLowerCase() as (typeof ACOES)[number];
    if (!ACOES.includes(o)) throw invalido('"acao" precisa ser listar, criar ou pagar.');
    return o === "listar" ? listar(args, ctx) : o === "criar" ? criar(args, ctx) : pagar(args, ctx);
  },
};
export default acao;
