import { veDinheiro } from "../roles.ts";
import { etapaEmPortugues } from "../workflow.ts";
import { ErroArnaldo, EQUIPE_E_SISTEMA, exigirPlaca, ok, placaNorm, texto, veiculoPorPlaca, type Acao } from "../util.ts";
import { ETAPAS_FECHADAS, osPorId } from "../os.ts";

const acao: Acao = {
  papeis: EQUIPE_E_SISTEMA,
  async run(args, ctx) {
    const t = ctx.tenantId;
    let os: any;
    if (texto(args, "os_id", { obrig: false, max: 64 })) {
      os = await osPorId(ctx, String(args.os_id).trim());
    } else if (args.placa) {
      const v = await veiculoPorPlaca(ctx, exigirPlaca(args.placa));
      if (!v) throw new ErroArnaldo("nao_encontrado", "Não achei essa placa no cadastro da oficina.");
      const oss = ok(
        await ctx.db.from("work_orders").select("*").eq("tenant_id", t).eq("vehicle_id", v.id).order("created_at", { ascending: false }).limit(20),
        "work_orders",
      ) ?? [];
      os = oss.find((o: any) => !ETAPAS_FECHADAS.includes(o.workflow_step)) ?? oss[0];
      if (!os) throw new ErroArnaldo("nao_encontrado", "Esse carro não tem ordem de serviço.");
    } else {
      throw new ErroArnaldo("dados_invalidos", 'Informe "os_id" ou "placa".');
    }

    const [cli, veic, checkin, diags, itens, eventos, mecanico] = await Promise.all([
      ctx.db.from("customers").select("*").eq("tenant_id", t).eq("id", os.customer_id).maybeSingle(),
      ctx.db.from("vehicles").select("*").eq("tenant_id", t).eq("id", os.vehicle_id).maybeSingle(),
      ctx.db.from("work_order_checkins").select("*").eq("tenant_id", t).eq("work_order_id", os.id).maybeSingle(),
      ctx.db.from("work_order_diagnostics").select("*").eq("tenant_id", t).eq("work_order_id", os.id).order("created_at", { ascending: true }).limit(20),
      ctx.db.from("work_order_items").select("*").eq("tenant_id", t).eq("work_order_id", os.id).order("created_at", { ascending: true }).limit(200),
      ctx.db.from("work_order_events").select("*").eq("tenant_id", t).eq("work_order_id", os.id).order("created_at", { ascending: false }).limit(10),
      os.current_mechanic_id
        ? ctx.db.from("profiles").select("id, full_name").eq("tenant_id", t).eq("id", os.current_mechanic_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const c = ok(cli, "customers"), v = ok(veic, "vehicles"), ck = ok(checkin, "work_order_checkins");
    const itensRows = ok(itens, "work_order_items") ?? [];

    // preços só são buscados para quem vê dinheiro; `semDinheiro` ainda roda no roteador como segunda barreira
    let precos: any[] = [];
    if (veDinheiro(ctx.papel) && itensRows.length) {
      precos = ok(
        await ctx.db.from("work_order_pricing").select("*").eq("tenant_id", t).in("work_order_item_id", itensRows.map((i: any) => i.id)),
        "work_order_pricing",
      ) ?? [];
    }

    return {
      os_id: os.id,
      etapa: os.workflow_step,
      etapa_texto: etapaEmPortugues(os.workflow_step),
      queixa: os.initial_complaint ?? null,
      prioridade: os.priority ?? null,
      box: os.box_location ?? null,
      mecanico: ok(mecanico, "profiles")?.full_name ?? null,
      previsao_entrega: os.expected_delivery_date ?? null,
      criada_em: os.created_at ?? null,
      total_amount: os.total_amount ?? 0,
      cliente: c ? { id: c.id, nome: c.full_name, telefone: c.phone_number } : null,
      veiculo: v ? { id: v.id, placa: placaNorm(v.plate), marca: v.make, modelo: v.model } : null,
      checkin: ck
        ? { km: ck.km_current, combustivel: ck.fuel_level, pertences: ck.customer_items ?? null, observacoes: ck.observations ?? null, em: ck.checked_in_at ?? ck.created_at ?? null }
        : null,
      diagnosticos: (ok(diags, "work_order_diagnostics") ?? []).map((d: any) => ({
        id: d.id, laudo: d.technical_report, mecanico_id: d.mechanic_id, em: d.ended_at ?? d.created_at ?? null,
      })),
      itens: itensRows.map((i: any) => {
        const p = precos.find((x) => x.work_order_item_id === i.id);
        return {
          id: i.id, tipo: i.item_type, descricao: i.description, quantidade: i.quantity, codigo: i.part_code ?? null,
          ...(p ? { pricing: { unit_price: p.unit_price, unit_cost: p.unit_cost, total_price: p.total_price } } : {}),
        };
      }),
      eventos: (ok(eventos, "work_order_events") ?? []).map((e: any) => ({ tipo: e.event_type, descricao: e.description ?? null, em: e.created_at ?? null })),
    };
  },
};
export default acao;
