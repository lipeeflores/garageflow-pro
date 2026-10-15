import { CLIENTE_E_EQUIPE, ok, texto, type Acao } from "../util.ts";
import { agendamentoDoChamador } from "./remarcar.ts";

const acao: Acao = {
  papeis: CLIENTE_E_EQUIPE,
  async run(args, ctx) {
    const motivo = texto(args, "motivo", { obrig: false, max: 300 });
    const ag = await agendamentoDoChamador(ctx, args);
    const notes = motivo ? [ag.notes, `Cancelado: ${motivo}`].filter(Boolean).join("\n") : ag.notes ?? null;
    ok(
      await ctx.db.from("appointments").update({ status: "CANCELADO", notes }).eq("tenant_id", ctx.tenantId).eq("id", ag.id),
      "appointments",
    );
    return { ok: true };
  },
};
export default acao;
