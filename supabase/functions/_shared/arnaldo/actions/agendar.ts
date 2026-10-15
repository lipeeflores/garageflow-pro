import { formatarLocal } from "../agenda.ts";
import { CLIENTE_E_EQUIPE, garantirVaga, instante, ok, texto, veiculoDoChamador, type Acao } from "../util.ts";

const acao: Acao = {
  papeis: CLIENTE_E_EQUIPE,
  async run(args, ctx) {
    const motivo = texto(args, "motivo", { max: 500 })!;
    const inicioMs = instante(args.inicio, "inicio");
    const v = await veiculoDoChamador(ctx, args.placa);
    await garantirVaga(ctx, inicioMs); // confere de novo: pode ter havido corrida
    const inicio = formatarLocal(inicioMs);
    const ag = ok(
      await ctx.db.from("appointments").insert({
        tenant_id: ctx.tenantId, customer_id: v.customer_id, vehicle_id: v.id, scheduled_at: inicio,
        reason: motivo, status: "AGENDADO", created_by: ctx.atorId,
      }).select().single(),
      "appointments",
    );
    return { agendamento_id: ag.id, inicio };
  },
};
export default acao;
