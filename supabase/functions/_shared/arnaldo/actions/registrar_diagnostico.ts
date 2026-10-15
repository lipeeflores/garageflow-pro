import { EQUIPE, invalido, ok, texto, type Acao } from "../util.ts";
import { gravarEtapa, osDoArg } from "../os.ts";

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const laudo = texto(args, "laudo", { max: 4000 })!;
    if (!ctx.atorId) throw invalido("O diagnóstico precisa de um mecânico identificado pelo telefone.");
    const os = await osDoArg(ctx, args);
    const d = ok(
      await ctx.db.from("work_order_diagnostics").insert({
        tenant_id: ctx.tenantId, work_order_id: os.id, mechanic_id: ctx.atorId, technical_report: laudo,
        ended_at: ctx.agora.toISOString(),
      }).select().single(),
      "work_order_diagnostics",
    );
    // Chegando antes do fim do diagnóstico, avança passo a passo (cada passo gera seu evento no banco).
    if (os.workflow_step === "CHECKIN_CONCLUIDO") await gravarEtapa(ctx, os.id, "EM_DIAGNOSTICO");
    if (os.workflow_step === "CHECKIN_CONCLUIDO" || os.workflow_step === "EM_DIAGNOSTICO") {
      await gravarEtapa(ctx, os.id, "AGUARDANDO_ORCAMENTO");
    }
    return { diagnostico_id: d.id };
  },
};
export default acao;
