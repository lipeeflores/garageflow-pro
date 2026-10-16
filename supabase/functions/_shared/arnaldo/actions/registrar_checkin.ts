import { EQUIPE, ErroArnaldo, escolha, inteiro, simNao, texto, type Acao } from "../util.ts";
import { gravarEtapa, osDoArg } from "../os.ts";

const COMBUSTIVEL = ["RESERVA", "QUARTO", "METADE", "TRES_QUARTOS", "COMPLETO"] as const;
const COLUNAS_NOVAS = ["tem_estepe", "estado_estepe", "tem_macaco", "tem_chave_roda", "avarias"];

const sn = (v: boolean) => (v ? "sim" : "não");

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const km = inteiro(args, "km", { min: 0, max: 5_000_000 })!;
    const combustivel = escolha(args, "combustivel", COMBUSTIVEL)!;
    const pertences = texto(args, "pertences", { obrig: false, max: 500 });
    const observacoes = texto(args, "observacoes", { obrig: false, max: 1000 });
    const temEstepe = simNao(args, "tem_estepe");
    const estadoEstepe = texto(args, "estado_estepe", { obrig: false, max: 100 });
    const temMacaco = simNao(args, "tem_macaco");
    const temChave = simNao(args, "tem_chave_roda");
    const avarias = texto(args, "avarias", { obrig: false, max: 1000 });
    const os = await osDoArg(ctx, args);

    const ja = await ctx.db.from("work_order_checkins").select("id").eq("tenant_id", ctx.tenantId).eq("work_order_id", os.id).maybeSingle();
    if (ja.error) throw new Error(`work_order_checkins: ${ja.error.message}`);
    const jaExiste = () => new ErroArnaldo("conflito", "Essa OS já tem check-in registrado. Não gravei outro.");
    if (ja.data) throw jaExiste();

    const base = {
      tenant_id: ctx.tenantId, work_order_id: os.id, mechanic_id: ctx.atorId, km_current: km, fuel_level: combustivel,
      customer_items: pertences ?? null, observations: observacoes ?? null,
    };
    const novas: Record<string, unknown> = {};
    if (temEstepe !== undefined) novas.tem_estepe = temEstepe;
    if (estadoEstepe !== undefined) novas.estado_estepe = estadoEstepe;
    if (temMacaco !== undefined) novas.tem_macaco = temMacaco;
    if (temChave !== undefined) novas.tem_chave_roda = temChave;
    if (avarias !== undefined) novas.avarias = avarias;

    let legado = false;
    let r = await ctx.db.from("work_order_checkins").insert({ ...base, ...novas }).select().single();
    // Migração dos documentos ainda não aplicada no banco: grava o check-in no formato antigo,
    // com estepe/macaco/chave/avarias no texto dos pertences, em vez de falhar.
    if (r.error && Object.keys(novas).length && (r.error.code === "PGRST204" || r.error.code === "42703" || /column|schema cache/i.test(r.error.message ?? ""))) {
      const extra = [
        temEstepe !== undefined ? `Estepe: ${sn(temEstepe)}${estadoEstepe ? ` (${estadoEstepe})` : ""}` : estadoEstepe ? `Estado do estepe: ${estadoEstepe}` : null,
        temMacaco !== undefined ? `Macaco: ${sn(temMacaco)}` : null,
        temChave !== undefined ? `Chave de roda: ${sn(temChave)}` : null,
        avarias ? `Avarias: ${avarias}` : null,
      ].filter(Boolean);
      const itens = [pertences, ...extra].filter(Boolean).join("; ");
      legado = true;
      r = await ctx.db.from("work_order_checkins").insert({ ...base, customer_items: itens || null }).select().single();
    }
    if (r.error?.code === "23505") throw jaExiste(); // UNIQUE(work_order_id): corrida entre duas chamadas
    if (r.error) throw new Error(`work_order_checkins: ${r.error.message}`);

    if (os.workflow_step === "AGUARDANDO_CHECKIN") await gravarEtapa(ctx, os.id, "CHECKIN_CONCLUIDO");
    return { checkin_id: r.data.id, ...(legado ? { aviso: "Estepe, macaco, chave e avarias foram gravados no texto dos pertences." } : {}) };
  },
};
export default acao;
