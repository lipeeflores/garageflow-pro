// Acesso comum às OS (work_orders) pelas ações da equipe.
import type { Ctx } from "./db.ts";
import { ErroArnaldo, ok, texto, type Args } from "./util.ts";

export const ETAPAS_FECHADAS = ["FINALIZADO", "CANCELADO"];

/** "OS 42", "os42", "OS-0042", "#42", "42", "0042" (ou o número 42) → 42. Qualquer outra coisa → null. */
export function numeroDeTexto(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const m = /^(?:os)?[\s#.:-]*(\d{1,6})$/i.exec(v.trim());
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Número da OS com 4 dígitos (0042), como aparece nos documentos. */
export const numeroFmt = (n: unknown): string | null => (n === null || n === undefined || n === "" ? null : String(n).padStart(4, "0"));

/** `{numero, numero_fmt}` para colar em qualquer saída de OS. */
export const numeroDe = (os: any) => ({ numero: os?.numero ?? null, numero_fmt: numeroFmt(os?.numero) });

/** OS por id (uuid) ou por número ("42", "OS 42", 42). Devolve null se não existir. */
export async function osOuNula(ctx: Ctx, ref: unknown) {
  const numero = numeroDeTexto(ref);
  let q = ctx.db.from("work_orders").select("*").eq("tenant_id", ctx.tenantId);
  q = numero !== null ? q.eq("numero", numero) : q.eq("id", String(ref ?? "").trim());
  return ok(await q.maybeSingle(), "work_orders");
}

export async function osPorId(ctx: Ctx, ref: string) {
  const os = await osOuNula(ctx, ref);
  if (!os) throw new ErroArnaldo("nao_encontrado", "Não achei essa ordem de serviço.");
  return os;
}

/** Alvo da ação: `os_id` (id ou número) ou `numero`. */
export function osDoArg(ctx: Ctx, args: Args) {
  const id = texto(args, "os_id", { obrig: false, max: 64 });
  if (id) return osPorId(ctx, id);
  if (args.numero !== undefined && args.numero !== null && args.numero !== "") return osPorId(ctx, String(args.numero));
  return osPorId(ctx, texto(args, "os_id", { max: 64 })!); // dá o erro padrão "Falta o campo os_id"
}

/** A OS aberta mais recente do veículo (senão a última de todas); null se o carro nunca teve OS. */
export async function osMaisRecenteDoVeiculo(ctx: Ctx, veiculoId: string) {
  const oss = ok(
    await ctx.db.from("work_orders").select("*").eq("tenant_id", ctx.tenantId).eq("vehicle_id", veiculoId)
      .order("created_at", { ascending: false }).limit(20),
    "work_orders",
  ) ?? [];
  return oss.find((o: any) => !ETAPAS_FECHADAS.includes(o.workflow_step)) ?? oss[0] ?? null;
}

/** Atualiza a etapa; o trigger do banco grava o evento WORKFLOW_STEP_CHANGE. */
export async function gravarEtapa(ctx: Ctx, osId: string, etapa: string) {
  ok(
    await ctx.db.from("work_orders").update({ workflow_step: etapa }).eq("tenant_id", ctx.tenantId).eq("id", osId),
    "work_orders",
  );
}

export async function gravarNota(ctx: Ctx, osId: string, descricao: string) {
  ok(
    await ctx.db.from("work_order_events").insert({
      tenant_id: ctx.tenantId, work_order_id: osId, event_type: "NOTA_ARNALDO", description: descricao, actor_id: ctx.atorId,
    }),
    "work_order_events",
  );
}
