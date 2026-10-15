import { formatarLocal, parseIso } from "../agenda.ts";
import { EQUIPE_E_SISTEMA, dataObrigatoria, inicioDoDiaLocal, ok, placaNorm, type Acao } from "../util.ts";

const DIA_MS = 24 * 3600_000;

const acao: Acao = {
  papeis: EQUIPE_E_SISTEMA,
  async run(args, ctx) {
    const dia = args.data === undefined || args.data === null || args.data === ""
      ? inicioDoDiaLocal(ctx.agora.getTime())
      : dataObrigatoria(args.data, "data");
    const t = ctx.tenantId;
    const doDia = ok(
      await ctx.db.from("appointments").select("*").eq("tenant_id", t).in("status", ["AGENDADO", "CHEGOU", "NAO_COMPARECEU"])
        .gte("scheduled_at", formatarLocal(dia)).lt("scheduled_at", formatarLocal(dia + DIA_MS))
        .order("scheduled_at", { ascending: true }).limit(300),
      "appointments",
    ) ?? [];
    const faltas = ok(
      await ctx.db.from("appointments").select("*").eq("tenant_id", t).eq("status", "NAO_COMPARECEU")
        .gte("scheduled_at", formatarLocal(dia - 3 * DIA_MS)).lt("scheduled_at", formatarLocal(dia))
        .order("scheduled_at", { ascending: true }).limit(300),
      "appointments",
    ) ?? [];
    const todos = [...faltas, ...doDia];

    const idsC = [...new Set(todos.map((a: any) => a.customer_id).filter(Boolean))];
    const idsV = [...new Set(todos.map((a: any) => a.vehicle_id).filter(Boolean))];
    const clientes = idsC.length ? ok(await ctx.db.from("customers").select("*").eq("tenant_id", t).in("id", idsC), "customers") : [];
    const veic = idsV.length ? ok(await ctx.db.from("vehicles").select("*").eq("tenant_id", t).in("id", idsV), "vehicles") : [];

    return todos.map((a: any) => {
      const c = (clientes ?? []).find((x: any) => x.id === a.customer_id);
      const v = (veic ?? []).find((x: any) => x.id === a.vehicle_id);
      return {
        id: a.id, inicio: formatarLocal(parseIso(String(a.scheduled_at))), status: a.status, motivo: a.reason,
        cliente: c?.full_name ?? null, telefone: c?.phone_number ?? null,
        placa: v ? placaNorm(v.plate) : null, modelo: v?.model ?? null,
      };
    });
  },
};
export default acao;
