import { veDinheiro } from "../roles.ts";
import { quemChama } from "../db.ts";
import { TODOS, type Acao } from "../util.ts";

const acao: Acao = {
  papeis: TODOS,
  async run(_args, ctx) {
    let nome: string | undefined;
    if (ctx.papel !== "cliente" && ctx.papel !== "sistema" && ctx.telefone) {
      nome = (await quemChama(ctx.db, ctx.tenantId, ctx.telefone)).nome ?? undefined;
    }
    return { papel: ctx.papel, ...(nome ? { nome } : {}), ve_dinheiro: veDinheiro(ctx.papel) };
  },
};
export default acao;
