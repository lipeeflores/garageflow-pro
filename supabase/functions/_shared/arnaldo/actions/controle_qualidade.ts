import { GESTAO, ErroArnaldo, booleano, invalido, ok, texto, type Acao } from "../util.ts";
import { gravarEtapa, osDoArg } from "../os.ts";

// Espelha QualityControlDialog.tsx: insere em work_order_quality e muda a etapa.
const acao: Acao = {
  papeis: GESTAO,
  async run(args, ctx) {
    const aprovado = booleano(args, "aprovado");
    const notas = texto(args, "notas", { obrig: false, max: 1000 });
    if (!ctx.atorId) throw invalido("O controle de qualidade precisa de um gestor identificado pelo telefone.");
    const os = await osDoArg(ctx, args);
    if (os.workflow_step !== "EM_QUALIDADE") {
      throw new ErroArnaldo("etapa_invalida", `O controle de qualidade só vale para OS em "no teste final"; esta está em ${os.workflow_step}.`);
    }
    ok(
      await ctx.db.from("work_order_quality").insert({
        tenant_id: ctx.tenantId, work_order_id: os.id, manager_id: ctx.atorId,
        status: aprovado ? "APROVADO" : "DEVOLVIDO_AJUSTES", notes: notas ?? null, inspected_at: ctx.agora.toISOString(),
      }),
      "work_order_quality",
    );
    const etapa = aprovado ? "PRONTO_PARA_RETIRADA" : "AJUSTES";
    await gravarEtapa(ctx, os.id, etapa);
    return { etapa };
  },
};
export default acao;
