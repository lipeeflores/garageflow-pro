import { normalizeBrPhone } from "../phone.ts";
import { etapaEmPortugues } from "../workflow.ts";
import { numeroDe, numeroDeTexto } from "../os.ts";
import { EQUIPE_E_SISTEMA, ok, placaNorm, texto, type Acao } from "../util.ts";

const MAX = 10;

const acao: Acao = {
  papeis: EQUIPE_E_SISTEMA,
  async run(args, ctx) {
    const termo = texto(args, "termo", { max: 80 })!;
    const t = ctx.tenantId;
    const placa = placaNorm(termo);
    const digitos = termo.replace(/\D/g, "");
    const seguro = termo.replace(/[%_\\,()]/g, "");

    // veículos por placa (exata ou prefixo; vehicles.plate pode ter hífen → confere normalizado em JS)
    let veiculos: any[] = [];
    if (placa.length >= 3) {
      const rows = ok(
        await ctx.db.from("vehicles").select("*").eq("tenant_id", t).ilike("plate", `%${placa.slice(0, 3)}%${placa.slice(3)}%`).limit(50),
        "vehicles",
      ) ?? [];
      veiculos = rows.filter((v: any) => placaNorm(v.plate).startsWith(placa));
    }

    // clientes por nome (ilike) e por telefone (normalizado em JS: o campo é texto livre)
    let clientes: any[] = [];
    if (seguro.length >= 2) {
      clientes = ok(await ctx.db.from("customers").select("*").eq("tenant_id", t).ilike("full_name", `%${seguro}%`).limit(MAX), "customers") ?? [];
    }
    if (digitos.length >= 8) {
      const todos = ok(await ctx.db.from("customers").select("*").eq("tenant_id", t).limit(5000), "customers") ?? [];
      const canon = normalizeBrPhone(digitos);
      for (const c of todos) {
        const n = normalizeBrPhone(c.phone_number);
        if (n && (n === canon || n.endsWith(digitos)) && !clientes.some((x) => x.id === c.id)) clientes.push(c);
      }
    }
    clientes = clientes.slice(0, MAX);

    // veículos dos clientes achados
    if (clientes.length) {
      const deles = ok(await ctx.db.from("vehicles").select("*").eq("tenant_id", t).in("customer_id", clientes.map((c) => c.id)).limit(50), "vehicles") ?? [];
      for (const v of deles) if (!veiculos.some((x) => x.id === v.id)) veiculos.push(v);
    }
    veiculos = veiculos.slice(0, MAX);

    // OS desses veículos (mais recentes primeiro)
    let os: any[] = [];
    if (veiculos.length) {
      const rows = ok(
        await ctx.db.from("work_orders").select("*").eq("tenant_id", t).in("vehicle_id", veiculos.map((v) => v.id))
          .order("created_at", { ascending: false }).limit(MAX),
        "work_orders",
      ) ?? [];
      os = rows.map((o: any) => ({
        os_id: o.id, ...numeroDe(o), placa: placaNorm(veiculos.find((v) => v.id === o.vehicle_id)?.plate),
        etapa: o.workflow_step, etapa_texto: etapaEmPortugues(o.workflow_step), queixa: o.initial_complaint ?? null,
      }));
    }

    // OS pelo número ("OS 42", "42", "0042")
    const nOs = numeroDeTexto(termo);
    if (nOs !== null) {
      const porNumero = ok(await ctx.db.from("work_orders").select("*").eq("tenant_id", t).eq("numero", nOs).limit(1), "work_orders") ?? [];
      for (const o of porNumero) {
        if (os.some((x) => x.os_id === o.id)) continue;
        const v = ok(await ctx.db.from("vehicles").select("*").eq("tenant_id", t).eq("id", o.vehicle_id).maybeSingle(), "vehicles");
        os.unshift({
          os_id: o.id, ...numeroDe(o), placa: placaNorm(v?.plate), etapa: o.workflow_step, etapa_texto: etapaEmPortugues(o.workflow_step),
          queixa: o.initial_complaint ?? null,
        });
        if (v && !veiculos.some((x) => x.id === v.id)) veiculos.push(v);
      }
    }

    return {
      clientes: clientes.map((c) => ({ id: c.id, nome: c.full_name, telefone: c.phone_number })),
      veiculos: veiculos.map((v) => ({ id: v.id, placa: placaNorm(v.plate), marca: v.make, modelo: v.model, cliente_id: v.customer_id })),
      os,
    };
  },
};
export default acao;
