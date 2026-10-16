import { configDocumentos } from "../documentos.ts";
import { GESTAO, ErroArnaldo, inteiro, invalido, ok, texto, diaLocal, type Acao } from "../util.ts";
import { numeroDe, osDoArg } from "../os.ts";

const DIA_MS = 24 * 3600_000;

function dataOpcional(v: string | undefined, campo: string): string | undefined {
  if (v === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00-03:00`))) throw invalido(`"${campo}" precisa ser uma data AAAA-MM-DD.`);
  return v;
}

/** Entrega do carro: grava km de saída, entregue_em, garantia e próxima revisão; finaliza a OS se ela estava pronta para retirada. */
const acao: Acao = {
  papeis: GESTAO,
  async run(args, ctx) {
    const kmSaida = inteiro(args, "km_saida", { min: 0, max: 5_000_000 })!;
    const garantiaDias = inteiro(args, "garantia_dias", { obrig: false, min: 0, max: 3650 }) ?? configDocumentos(ctx.tenantSettings).garantia_dias;
    const revisaoKm = inteiro(args, "proxima_revisao_km", { obrig: false, min: 0, max: 5_000_000 });
    const revisaoData = dataOpcional(texto(args, "proxima_revisao_data", { obrig: false, max: 10 }), "proxima_revisao_data");

    const os = await osDoArg(ctx, args);
    const etapa = String(os.workflow_step);
    if (etapa === "CANCELADO") throw new ErroArnaldo("etapa_invalida", "Essa OS foi cancelada; não dá para registrar entrega.");
    if (os.entregue_em) {
      throw new ErroArnaldo("conflito", "A entrega dessa OS já foi registrada. Não alterei nada; se algum dado está errado, a gestão corrige no sistema.");
    }

    const agora = ctx.agora;
    const garantiaAte = garantiaDias > 0 ? diaLocal(agora.getTime() + garantiaDias * DIA_MS) : null;
    const finalizar = etapa === "PRONTO_PARA_RETIRADA";
    const update: Record<string, unknown> = {
      entregue_em: agora.toISOString(), km_saida: kmSaida, garantia_ate: garantiaAte,
      proxima_revisao_km: revisaoKm ?? null, proxima_revisao_data: revisaoData ?? null,
    };
    if (finalizar) update.workflow_step = "FINALIZADO"; // o trigger do banco grava o evento
    ok(await ctx.db.from("work_orders").update(update).eq("tenant_id", ctx.tenantId).eq("id", os.id), "work_orders");

    return {
      ...numeroDe(os), entregue_em: agora.toISOString(), km_saida: kmSaida, garantia_ate: garantiaAte,
      proxima_revisao_km: revisaoKm ?? null, proxima_revisao_data: revisaoData ?? null,
      etapa: finalizar ? "FINALIZADO" : etapa, finalizada: finalizar,
    };
  },
};
export default acao;
