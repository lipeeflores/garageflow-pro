import { EQUIPE, ErroArnaldo, escolha, inteiro, texto, type Acao } from "../util.ts";
import { gravarEtapa, osDoArg } from "../os.ts";

const COMBUSTIVEL = ["RESERVA", "QUARTO", "METADE", "TRES_QUARTOS", "COMPLETO"] as const;

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const km = inteiro(args, "km", { min: 0, max: 5_000_000 })!;
    const combustivel = escolha(args, "combustivel", COMBUSTIVEL)!;
    const pertences = texto(args, "pertences", { obrig: false, max: 500 });
    const observacoes = texto(args, "observacoes", { obrig: false, max: 1000 });
    const os = await osDoArg(ctx, args);

    const ja = await ctx.db.from("work_order_checkins").select("id").eq("tenant_id", ctx.tenantId).eq("work_order_id", os.id).maybeSingle();
    if (ja.error) throw new Error(`work_order_checkins: ${ja.error.message}`);
    const jaExiste = () => new ErroArnaldo("conflito", "Essa OS já tem check-in registrado. Não gravei outro.");
    if (ja.data) throw jaExiste();

    const r = await ctx.db.from("work_order_checkins").insert({
      tenant_id: ctx.tenantId, work_order_id: os.id, mechanic_id: ctx.atorId, km_current: km, fuel_level: combustivel,
      customer_items: pertences ?? null, observations: observacoes ?? null,
    }).select().single();
    if (r.error?.code === "23505") throw jaExiste(); // UNIQUE(work_order_id): corrida entre duas chamadas
    if (r.error) throw new Error(`work_order_checkins: ${r.error.message}`);

    if (os.workflow_step === "AGUARDANDO_CHECKIN") await gravarEtapa(ctx, os.id, "CHECKIN_CONCLUIDO");
    return { checkin_id: r.data.id };
  },
};
export default acao;
