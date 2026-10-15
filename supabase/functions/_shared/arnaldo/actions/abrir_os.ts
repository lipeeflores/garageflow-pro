import { EQUIPE, ErroArnaldo, escolha, invalido, ok, texto, veiculoDoChamador, type Acao } from "../util.ts";

const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA"] as const;

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const queixa = texto(args, "queixa", { max: 1000 })!;
    const prioridade = escolha(args, "prioridade", PRIORIDADES, false) ?? "MEDIA";
    const previsao = texto(args, "previsao_entrega", { obrig: false, max: 10 });
    if (previsao && !/^\d{4}-\d{2}-\d{2}$/.test(previsao)) throw invalido('"previsao_entrega" precisa ser uma data AAAA-MM-DD.');
    const agId = texto(args, "agendamento_id", { obrig: false, max: 64 });
    const v = await veiculoDoChamador(ctx, args.placa);

    let ag: any = null;
    if (agId) {
      ag = ok(
        await ctx.db.from("appointments").select("*").eq("tenant_id", ctx.tenantId).eq("id", agId).maybeSingle(),
        "appointments",
      );
      if (!ag) throw new ErroArnaldo("nao_encontrado", "Não achei esse agendamento.");
      if (ag.vehicle_id !== v.id) throw invalido("Esse agendamento é de outro carro, não da placa informada.");
      if (ag.status !== "AGENDADO") throw invalido(`Esse agendamento já está ${String(ag.status).toLowerCase()}.`);
    }

    const os = ok(
      await ctx.db.from("work_orders").insert({
        tenant_id: ctx.tenantId, customer_id: v.customer_id, vehicle_id: v.id, appointment_id: ag ? ag.id : null,
        workflow_step: "AGUARDANDO_CHECKIN", initial_complaint: queixa, priority: prioridade,
        expected_delivery_date: previsao ?? null, total_amount: 0, created_by: ctx.atorId,
      }).select().single(),
      "work_orders",
    );
    if (ag) {
      ok(await ctx.db.from("appointments").update({ status: "CHEGOU" }).eq("tenant_id", ctx.tenantId).eq("id", ag.id), "appointments");
    }
    return { os_id: os.id };
  },
};
export default acao;
