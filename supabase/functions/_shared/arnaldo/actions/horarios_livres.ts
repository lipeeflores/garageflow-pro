import { formatarLocal, horariosLivres, regraAgenda } from "../agenda.ts";
import { CLIENTE_E_EQUIPE, dataObrigatoria, ocupadosEntre, type Acao } from "../util.ts";

const DIA_MS = 24 * 3600_000;
const MAX_DIAS = 14;

const acao: Acao = {
  papeis: [...CLIENTE_E_EQUIPE, "sistema"],
  async run(args, ctx) {
    const de = dataObrigatoria(args.de, "de");
    let ate = args.ate === undefined || args.ate === null || args.ate === "" ? de : dataObrigatoria(args.ate, "ate");
    if (ate < de) ate = de;
    ate = Math.min(ate, de + (MAX_DIAS - 1) * DIA_MS);
    const fim = ate + DIA_MS; // `ate` é um dia inclusivo
    const ocupados = await ocupadosEntre(ctx, de, fim);
    const horarios = horariosLivres(
      regraAgenda(ctx.tenantSettings), formatarLocal(de), formatarLocal(fim), ocupados, formatarLocal(ctx.agora.getTime()),
    );
    return { horarios };
  },
};
export default acao;
