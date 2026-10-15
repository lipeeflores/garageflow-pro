import { formatarLocal, parseIso } from "../agenda.ts";
import { clienteDoChamador, ok, placaNorm, type Acao } from "../util.ts";

const acao: Acao = {
  papeis: ["cliente"],
  async run(_args, ctx) {
    const c = await clienteDoChamador(ctx);
    if (!c) return [];
    const ags = ok(
      await ctx.db.from("appointments").select("*").eq("tenant_id", ctx.tenantId).eq("customer_id", c.id)
        .eq("status", "AGENDADO").gte("scheduled_at", formatarLocal(ctx.agora.getTime()))
        .order("scheduled_at", { ascending: true }).limit(50),
      "appointments",
    ) ?? [];
    const ids = [...new Set(ags.map((a: any) => a.vehicle_id).filter(Boolean))];
    const veic = ids.length ? ok(await ctx.db.from("vehicles").select("*").eq("tenant_id", ctx.tenantId).in("id", ids), "vehicles") : [];
    const placaDe = (id: string) => placaNorm((veic ?? []).find((v: any) => v.id === id)?.plate);
    return ags.map((a: any) => ({
      id: a.id, inicio: formatarLocal(parseIso(String(a.scheduled_at))), placa: placaDe(a.vehicle_id), motivo: a.reason,
    }));
  },
};
export default acao;
