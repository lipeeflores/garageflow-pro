import { formatarLocal } from "../agenda.ts";
import {
  CLIENTE_E_EQUIPE, ErroArnaldo, clienteDoChamador, garantirVaga, instante, invalido, ok, texto, type Acao, type Args,
} from "../util.ts";
import type { Ctx } from "../db.ts";

/** Agendamento do tenant; cliente só enxerga os próprios (mesma resposta para "não existe" e "é de outro"). */
export async function agendamentoDoChamador(ctx: Ctx, args: Args) {
  const id = texto(args, "agendamento_id", { max: 64 })!;
  const ag = ok(
    await ctx.db.from("appointments").select("*").eq("tenant_id", ctx.tenantId).eq("id", id).maybeSingle(),
    "appointments",
  );
  const naoAchei = new ErroArnaldo("nao_encontrado", "Não achei esse agendamento neste número.");
  if (!ag) throw naoAchei;
  if (ctx.papel === "cliente") {
    const c = await clienteDoChamador(ctx);
    if (!c || ag.customer_id !== c.id) throw naoAchei;
  }
  if (ag.status !== "AGENDADO") {
    throw invalido(`Esse agendamento já está ${String(ag.status).toLowerCase()}; só dá para mexer em agendamento ativo.`);
  }
  return ag;
}

const acao: Acao = {
  papeis: CLIENTE_E_EQUIPE,
  async run(args, ctx) {
    const novoMs = instante(args.novo_inicio, "novo_inicio");
    const ag = await agendamentoDoChamador(ctx, args);
    await garantirVaga(ctx, novoMs);
    const novo = ok(
      await ctx.db.from("appointments").insert({
        tenant_id: ctx.tenantId, customer_id: ag.customer_id, vehicle_id: ag.vehicle_id, scheduled_at: formatarLocal(novoMs),
        reason: ag.reason, notes: ag.notes ?? null, status: "AGENDADO", created_by: ctx.atorId,
      }).select().single(),
      "appointments",
    );
    ok(
      await ctx.db.from("appointments").update({ status: "REMARCADO" }).eq("tenant_id", ctx.tenantId).eq("id", ag.id),
      "appointments",
    );
    return { agendamento_id: novo.id };
  },
};
export default acao;
