import { clienteDoChamador, ok, placaNorm, type Acao } from "../util.ts";

const acao: Acao = {
  papeis: ["cliente"],
  async run(_args, ctx) {
    const c = await clienteDoChamador(ctx);
    if (!c) return { cliente: null, veiculos: [] };
    const veiculos = ok(
      await ctx.db.from("vehicles").select("*").eq("tenant_id", ctx.tenantId).eq("customer_id", c.id).limit(50),
      "vehicles",
    );
    return {
      cliente: { id: c.id, nome: c.full_name },
      veiculos: (veiculos ?? []).map((v: any) => ({
        id: v.id, placa: placaNorm(v.plate), marca: v.make, modelo: v.model, ano: v.year ?? null, cor: v.color ?? null,
      })),
    };
  },
};
export default acao;
