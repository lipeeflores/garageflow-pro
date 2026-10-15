import { EQUIPE, ErroArnaldo, escolha, invalido, ok, texto, type Acao } from "../util.ts";
import { osDoArg } from "../os.ts";

const BOXES = ["BOX_1", "BOX_2", "BOX_3", "BOX_4", "PATIO"] as const;

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const nome = texto(args, "mecanico", { obrig: false, max: 80 });
    const box = escolha(args, "box", BOXES, false);
    if (!nome && !box) throw invalido('Informe o mecânico ("mecanico") e/ou o box ("box").');
    const os = await osDoArg(ctx, args);

    const update: Record<string, unknown> = {};
    if (box) update.box_location = box;
    if (nome) {
      const termo = nome.replace(/[%_\\,()]/g, "");
      const achados = ok(
        await ctx.db.from("profiles").select("id, full_name").eq("tenant_id", ctx.tenantId).eq("is_active", true)
          .ilike("full_name", `%${termo}%`).limit(10),
        "profiles",
      ) ?? [];
      const exato = achados.filter((p: any) => String(p.full_name).toLowerCase() === nome.toLowerCase());
      const escolhidos = exato.length === 1 ? exato : achados;
      if (escolhidos.length === 0) throw new ErroArnaldo("nao_encontrado", `Não achei nenhum funcionário ativo com o nome "${nome}".`);
      if (escolhidos.length > 1) {
        throw invalido(`Mais de um funcionário combina com "${nome}": ${escolhidos.map((p: any) => p.full_name).join(", ")}. Pergunte qual deles.`);
      }
      update.current_mechanic_id = escolhidos[0].id;
    }
    ok(await ctx.db.from("work_orders").update(update).eq("tenant_id", ctx.tenantId).eq("id", os.id), "work_orders");
    return { ok: true };
  },
};
export default acao;
