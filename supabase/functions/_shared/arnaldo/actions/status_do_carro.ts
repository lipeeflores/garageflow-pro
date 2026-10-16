import { etapaEmPortugues } from "../workflow.ts";
import { numeroDe } from "../os.ts";
import { CLIENTE_E_EQUIPE, ok, placaNorm, veiculoDoChamador, type Acao } from "../util.ts";

const FECHADAS = ["FINALIZADO", "CANCELADO"];

const acao: Acao = {
  papeis: [...CLIENTE_E_EQUIPE, "sistema"],
  async run(args, ctx) {
    const v = await veiculoDoChamador(ctx, args.placa);
    const oss = ok(
      await ctx.db.from("work_orders").select("*").eq("tenant_id", ctx.tenantId).eq("vehicle_id", v.id)
        .order("created_at", { ascending: false }).limit(20),
      "work_orders",
    ) ?? [];
    const os = oss.find((o: any) => !FECHADAS.includes(o.workflow_step)) ?? oss[0];
    const placa = placaNorm(v.plate);
    if (!os) return { placa, modelo: v.model, etapa: null, etapa_texto: "sem ordem de serviço aberta para este carro" };

    const dados: Record<string, unknown> = {
      ...numeroDe(os), placa, modelo: v.model, etapa: os.workflow_step, etapa_texto: etapaEmPortugues(os.workflow_step),
    };
    if (os.expected_delivery_date) dados.previsao_entrega = os.expected_delivery_date;
    if (os.workflow_step === "AGUARDANDO_APROVACAO" && ctx.appPublicUrl) {
      dados.link_orcamento = `${ctx.appPublicUrl}/orcamento/${os.id}?token=${String(os.id).slice(0, 8).toUpperCase()}`;
    }
    return dados;
  },
};
export default acao;
