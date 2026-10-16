import { formatarLocal, parseIso } from "../agenda.ts";
import type { Ctx } from "../db.ts";
import { EMPRESA, TIPOS_DOCUMENTO, configDocumentos, ehAvaria, foneFormatado, legendaDaFoto, type TipoDocumento } from "../documentos.ts";
import { numeroDe, osMaisRecenteDoVeiculo, osOuNula } from "../os.ts";
import {
  ErroArnaldo, TODOS, clienteDoChamador, diaLocal, invalido, ok, placaNorm, texto, veiculoDoChamador, type Acao, type Args,
} from "../util.ts";
import { ETAPAS, etapaEmPortugues } from "../workflow.ts";

const DIA_MS = 24 * 3600_000;
const TIPOS_FOTO = ["CHECKIN_PHOTO", "DIAGNOSIS_PHOTO", "EXECUTION_PHOTO", "OTHER"];
const ehDinheiro = (t: TipoDocumento) => t === "orcamento" || t === "recibo";
const quando = (v: unknown) => (v ? formatarLocal(parseIso(String(v))) : null);

/** Localiza a OS (os_id ou número, ou placa). Cliente só enxerga as próprias: "não existe" e "é de outro" dão a mesma resposta. */
async function localizarOs(ctx: Ctx, args: Args) {
  const cliente = ctx.papel === "cliente";
  const naoAchei = () =>
    new ErroArnaldo("nao_encontrado", cliente ? "Não achei essa ordem de serviço neste número." : "Não achei essa ordem de serviço.");
  const ref = texto(args, "os_id", { obrig: false, max: 64 }) ?? (args.numero !== undefined && args.numero !== null && args.numero !== "" ? String(args.numero) : undefined);

  if (ref) {
    const os = await osOuNula(ctx, ref);
    if (!os) throw naoAchei();
    if (cliente) {
      const c = await clienteDoChamador(ctx);
      if (!c || os.customer_id !== c.id) throw naoAchei();
    }
    return os;
  }
  if (args.placa) {
    const v = await veiculoDoChamador(ctx, args.placa); // cliente: só o próprio carro
    const os = await osMaisRecenteDoVeiculo(ctx, v.id);
    if (!os) throw new ErroArnaldo("nao_encontrado", "Esse carro não tem ordem de serviço.");
    return os;
  }
  throw invalido('Informe "os_id", "numero" ou "placa" da OS.');
}

const nomes = (perfis: any[], id: unknown) => (id ? perfis.find((p) => p.id === id)?.full_name ?? null : null);

const acao: Acao = {
  papeis: TODOS,
  liberaDinheiro: true,
  async run(args, ctx) {
    const tipo = String(args.tipo ?? "").trim().toLowerCase() as TipoDocumento;
    if (!TIPOS_DOCUMENTO.includes(tipo)) throw invalido(`"tipo" precisa ser um destes: ${TIPOS_DOCUMENTO.join(", ")}.`);

    // Papel decide o que sai (na API, antes de buscar qualquer coisa)
    if (tipo === "os_patio" && ctx.papel === "cliente") throw new ErroArnaldo("sem_permissao", "A OS do pátio é só para a equipe da oficina.");
    if (ehDinheiro(tipo) && ctx.papel === "patio") {
      throw new ErroArnaldo("sem_permissao", "Orçamento e recibo têm valores e são só para a gestão e o dono.");
    }

    const os = await localizarOs(ctx, args);
    const t = ctx.tenantId;
    const config = configDocumentos(ctx.tenantSettings);

    // Estado da OS exigido por cada documento
    const etapa = String(os.workflow_step);
    if (tipo === "orcamento" && (etapa === "CANCELADO" || ETAPAS.indexOf(etapa as any) < ETAPAS.indexOf("AGUARDANDO_APROVACAO"))) {
      throw new ErroArnaldo("etapa_invalida", `O orçamento só existe a partir de "aguardando aprovação"; esta OS está em ${etapa}.`);
    }

    const [cli, veic, ck, anexos, diags, itens, pgs, eventos] = await Promise.all([
      ctx.db.from("customers").select("*").eq("tenant_id", t).eq("id", os.customer_id).maybeSingle(),
      ctx.db.from("vehicles").select("*").eq("tenant_id", t).eq("id", os.vehicle_id).maybeSingle(),
      ctx.db.from("work_order_checkins").select("*").eq("tenant_id", t).eq("work_order_id", os.id).maybeSingle(),
      ctx.db.from("attachments").select("*").eq("tenant_id", t).eq("parent_type", "work_order").eq("parent_id", os.id)
        .in("attachment_type", TIPOS_FOTO).order("created_at", { ascending: true }).limit(100),
      ctx.db.from("work_order_diagnostics").select("*").eq("tenant_id", t).eq("work_order_id", os.id).order("created_at", { ascending: true }).limit(20),
      ctx.db.from("work_order_items").select("*").eq("tenant_id", t).eq("work_order_id", os.id).order("created_at", { ascending: true }).limit(500),
      ehDinheiro(tipo)
        ? ctx.db.from("payments").select("*").eq("tenant_id", t).eq("work_order_id", os.id).order("paid_at", { ascending: true }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      ctx.db.from("work_order_events").select("*").eq("tenant_id", t).eq("work_order_id", os.id).eq("event_type", "WORKFLOW_STEP_CHANGE")
        .order("created_at", { ascending: true }).limit(200),
    ]);
    const cliente = ok(cli, "customers"), veiculo = ok(veic, "vehicles"), checkin = ok(ck, "work_order_checkins");
    const pagamentosRows = ok(pgs, "payments") ?? [];
    const itensRows = ok(itens, "work_order_items") ?? [];

    if (tipo === "ficha_entrada" && !checkin) throw new ErroArnaldo("nao_encontrado", "Essa OS ainda não tem check-in registrado; a ficha de entrada depende dele.");
    if (tipo === "recibo" && pagamentosRows.length === 0 && etapa !== "FINALIZADO") {
      throw new ErroArnaldo("etapa_invalida", "O recibo só existe depois de um pagamento registrado ou da entrega (OS finalizada).");
    }

    // preços: só buscados quando o documento pode ter valores
    let precos: any[] = [];
    if (ehDinheiro(tipo) && itensRows.length) {
      precos = ok(
        await ctx.db.from("work_order_pricing").select("*").eq("tenant_id", t).in("work_order_item_id", itensRows.map((i: any) => i.id)),
        "work_order_pricing",
      ) ?? [];
    }

    const idsPerfis = [os.current_mechanic_id, checkin?.mechanic_id, ...(ok(diags, "work_order_diagnostics") ?? []).map((d: any) => d.mechanic_id), ...pagamentosRows.map((p: any) => p.processed_by)]
      .filter(Boolean);
    const perfis = idsPerfis.length
      ? ok(await ctx.db.from("profiles").select("id, full_name").eq("tenant_id", t).in("id", [...new Set(idsPerfis)]), "profiles") ?? []
      : [];

    const evs = ok(eventos, "work_order_events") ?? [];
    const ultimoPara = (passo: string) => [...evs].reverse().find((e: any) => e.new_data?.workflow_step === passo)?.created_at ?? null;

    // fotos: as que não são avaria primeiro, avarias depois (cada grupo por data)
    const fotos = (ok(anexos, "attachments") ?? []).map((a: any) => {
      const legenda = legendaDaFoto(a.file_name);
      return { url: a.file_url, tipo: a.attachment_type, legenda, avaria: ehAvaria(legenda, a.file_name) };
    });
    const fotosOrdenadas = [...fotos.filter((f: any) => !f.avaria), ...fotos.filter((f: any) => f.avaria)];

    const comDinheiro = ehDinheiro(tipo);
    const linhas = itensRows.map((i: any) => {
      const base = { tipo: i.item_type, descricao: i.description, codigo: i.part_code ?? null, quantidade: i.quantity };
      if (!comDinheiro) return base;
      const p = precos.find((x) => x.work_order_item_id === i.id);
      return { ...base, preco_unitario: p ? Number(p.unit_price) : null, total: p ? Number(p.total_price) : null };
    });

    const dados: Record<string, unknown> = {
      tipo,
      empresa: EMPRESA,
      config,
      os: {
        id: os.id, ...numeroDe(os), etapa, etapa_texto: etapaEmPortugues(etapa), prioridade: os.priority ?? null, box: os.box_location ?? null,
        mecanico: nomes(perfis, os.current_mechanic_id), previsao_entrega: os.expected_delivery_date ?? null, queixa: os.initial_complaint ?? null,
        criada_em: quando(os.created_at), aprovada_em: quando(ultimoPara("APROVADO")), entregue_em: quando(os.entregue_em),
        km_saida: os.km_saida ?? null, garantia_ate: os.garantia_ate ?? null,
        proxima_revisao_km: os.proxima_revisao_km ?? null, proxima_revisao_data: os.proxima_revisao_data ?? null,
      },
      cliente: {
        nome: cliente?.full_name ?? null, telefone_fmt: foneFormatado(cliente?.phone_number), cpf_cnpj: cliente?.cpf_cnpj ?? null, endereco: cliente?.address ?? null,
      },
      veiculo: {
        placa: veiculo ? placaNorm(veiculo.plate) : null, marca: veiculo?.make ?? null, modelo: veiculo?.model ?? null,
        ano: veiculo?.year ?? null, cor: veiculo?.color ?? null, chassi: veiculo?.chassis ?? null,
      },
      checkin: checkin
        ? {
          km: checkin.km_current ?? null, combustivel: checkin.fuel_level ?? null, pertences: checkin.customer_items ?? null,
          observacoes: checkin.observations ?? null, avarias: checkin.avarias ?? null, tem_estepe: checkin.tem_estepe ?? null,
          estado_estepe: checkin.estado_estepe ?? null, tem_macaco: checkin.tem_macaco ?? null, tem_chave_roda: checkin.tem_chave_roda ?? null,
          recebido_por: nomes(perfis, checkin.mechanic_id), em: quando(checkin.checked_in_at ?? checkin.created_at),
        }
        : null,
      fotos: fotosOrdenadas,
      diagnosticos: (ok(diags, "work_order_diagnostics") ?? []).map((d: any) => ({
        laudo: d.technical_report, mecanico: nomes(perfis, d.mechanic_id), em: quando(d.ended_at ?? d.created_at),
      })),
      itens: linhas,
      link_aprovacao: null,
      validade_ate: null,
    };

    // dinheiro: só no orçamento e no recibo. Na ficha e na OS do pátio as chaves NÃO EXISTEM (para ninguém, nem para o dono).
    if (comDinheiro) {
      const soma = (tipoItem: string) =>
        Math.round(itensRows.reduce((s: number, i: any) => {
          const p = precos.find((x) => x.work_order_item_id === i.id);
          return s + (i.item_type === tipoItem && p ? Number(p.total_price) : 0);
        }, 0) * 100) / 100;
      const pecas = soma("PART"), maoDeObra = soma("SERVICE"), desconto = 0;
      dados.totais = { pecas, mao_de_obra: maoDeObra, desconto, total: Math.round((pecas + maoDeObra - desconto) * 100) / 100 };
      dados.pagamentos = pagamentosRows.map((p: any) => ({
        valor: Number(p.amount), forma: p.payment_method, em: quando(p.paid_at), recebido_por: nomes(perfis, p.processed_by),
      }));
    }
    if (tipo === "orcamento") {
      if (ctx.appPublicUrl) dados.link_aprovacao = `${ctx.appPublicUrl}/orcamento/${os.id}?token=${String(os.id).slice(0, 8).toUpperCase()}`;
      const enviado = ultimoPara("AGUARDANDO_APROVACAO");
      const base = enviado ? parseIso(String(enviado)) : ctx.agora.getTime();
      dados.validade_ate = diaLocal(base + config.validade_orcamento_dias * DIA_MS);
    }
    return dados;
  },
};
export default acao;
