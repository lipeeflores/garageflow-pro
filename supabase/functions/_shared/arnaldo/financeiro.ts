// Apoio das ações de gestão/financeiro (A6). Espelha os hooks do app: useWorkOrderItems, usePayments, useFinancialData, useBills.
import type { Ctx } from "./db.ts";
import { ErroArnaldo, ok } from "./util.ts";

export const FORMAS_PAGAMENTO = ["PIX", "CARTAO", "DINHEIRO", "MARCAR"] as const;
// Mesmos rótulos de paymentMethodLabels em src/hooks/usePayments.ts
export const ROTULO_FORMA: Record<string, string> = { PIX: "Pix", CARTAO: "Cartão", DINHEIRO: "Dinheiro", MARCAR: "Marcar (Fiado)" };
// useFinancialData.usePaymentMethodStats mostra "Fiado" nos gráficos
export const ROTULO_FORMA_RESUMO: Record<string, string> = { PIX: "Pix", CARTAO: "Cartão", DINHEIRO: "Dinheiro", MARCAR: "Fiado" };

export const centavos = (n: number) => Math.round(n * 100) / 100;

export async function itensDaOs(ctx: Ctx, osId: string): Promise<any[]> {
  return ok(
    await ctx.db.from("work_order_items").select("*").eq("tenant_id", ctx.tenantId).eq("work_order_id", osId)
      .order("created_at", { ascending: true }).limit(500),
    "work_order_items",
  ) ?? [];
}

export async function precosDosItens(ctx: Ctx, itemIds: string[]): Promise<any[]> {
  if (!itemIds.length) return [];
  return ok(
    await ctx.db.from("work_order_pricing").select("*").eq("tenant_id", ctx.tenantId).in("work_order_item_id", itemIds),
    "work_order_pricing",
  ) ?? [];
}

/** Soma dos total_price dos itens da OS (o mesmo total que o BudgetQuickDialog grava em work_orders.total_amount). */
export async function totalDosItens(ctx: Ctx, osId: string): Promise<{ total: number; itens: any[]; precos: any[] }> {
  const itens = await itensDaOs(ctx, osId);
  const precos = await precosDosItens(ctx, itens.map((i) => i.id));
  const total = centavos(precos.reduce((s, p) => s + (Number(p.total_price) || 0), 0));
  return { total, itens, precos };
}

export function exigirOsAberta(os: any) {
  if (os.workflow_step === "FINALIZADO" || os.workflow_step === "CANCELADO") {
    throw new ErroArnaldo("etapa_invalida", `Essa OS já está ${String(os.workflow_step).toLowerCase()}; não dá para mexer nela por aqui.`);
  }
}
