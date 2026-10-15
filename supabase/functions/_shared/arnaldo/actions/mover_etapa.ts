import { ETAPAS, etapaEmPortugues, transicaoPermitida } from "../workflow.ts";
import { EQUIPE, ErroArnaldo, escolha, texto, type Acao } from "../util.ts";
import { gravarEtapa, gravarNota, osDoArg } from "../os.ts";

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const para = escolha(args, "etapa", ETAPAS)!;
    const observacao = texto(args, "observacao", { obrig: false, max: 500 });
    const os = await osDoArg(ctx, args);
    const de = String(os.workflow_step);
    if (!transicaoPermitida(de, para, ctx.papel)) {
      throw new ErroArnaldo(
        "etapa_invalida",
        `Não dá para mudar a OS de "${etapaEmPortugues(de)}" para "${etapaEmPortugues(para)}" com esse acesso. A etapa continua ${de}.`,
      );
    }
    await gravarEtapa(ctx, os.id, para); // o trigger do banco grava o evento
    if (observacao) await gravarNota(ctx, os.id, observacao);
    return { etapa: para };
  },
};
export default acao;
