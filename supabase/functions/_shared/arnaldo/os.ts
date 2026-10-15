// Acesso comum às OS (work_orders) pelas ações da equipe.
import type { Ctx } from "./db.ts";
import { ErroArnaldo, ok, texto, type Args } from "./util.ts";

export const ETAPAS_FECHADAS = ["FINALIZADO", "CANCELADO"];

export async function osPorId(ctx: Ctx, osId: string) {
  const os = ok(
    await ctx.db.from("work_orders").select("*").eq("tenant_id", ctx.tenantId).eq("id", osId).maybeSingle(),
    "work_orders",
  );
  if (!os) throw new ErroArnaldo("nao_encontrado", "Não achei essa ordem de serviço.");
  return os;
}

export const osDoArg = (ctx: Ctx, args: Args) => osPorId(ctx, texto(args, "os_id", { max: 64 })!);

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
