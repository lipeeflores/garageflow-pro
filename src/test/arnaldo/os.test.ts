import { describe, it, expect, beforeEach } from "vitest";
import type { FakeDb } from "./fakeDb";
import { T, FONE_A, FONE_SIMONE, FONE_MECANICO, TERCA_9, semear, mkCtx } from "./fixtures";
import { despachar } from "../../../supabase/functions/_shared/arnaldo/router";
import type { Ctx } from "../../../supabase/functions/_shared/arnaldo/db";
import type { Papel } from "../../../supabase/functions/_shared/arnaldo/roles";

let db: FakeDb;
const ctx = (papel: Papel, telefone: string | null, atorId: string | null = null): Ctx => mkCtx(db, papel, telefone, atorId);
const cliente = () => ctx("cliente", FONE_A);
const gestao = () => ctx("gestao", FONE_SIMONE, "u-simone");
const patio = () => ctx("patio", FONE_MECANICO, "u-mec");
const sistema = () => ctx("sistema", "SYSTEM");

const OS = "0a1b2c3d-0000-4000-8000-000000000001";
function osEm(etapa: string, extra: Record<string, unknown> = {}) {
  db.rows("work_orders").push({
    id: OS, tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", workflow_step: etapa, initial_complaint: "barulho na roda",
    priority: "MEDIA", total_amount: 1234.5, created_at: "2026-10-15T10:00:00Z", ...extra,
  });
}
const etapaAtual = () => db.rows("work_orders").find((o) => o.id === OS)!.workflow_step;

beforeEach(() => { db = semear(); });

describe("buscar", () => {
  it("acha por placa (prefixo, com hífen no banco), nome e telefone", async () => {
    osEm("EM_EXECUCAO");
    const porPlaca: any = await despachar("buscar", { termo: "abc1" }, patio());
    expect(porPlaca.dados.veiculos.map((v: any) => v.placa)).toEqual(["ABC1D23"]);
    expect(porPlaca.dados.os.map((o: any) => o.os_id)).toEqual([OS]);
    const porNome: any = await despachar("buscar", { termo: "bruno" }, patio());
    expect(porNome.dados.clientes.map((c: any) => c.nome)).toEqual(["Bruno Cliente"]);
    expect(porNome.dados.veiculos.map((v: any) => v.placa)).toEqual(["XYZ9K88"]);
    const porFone: any = await despachar("buscar", { termo: "(47) 98488-9108" }, patio());
    expect(porFone.dados.clientes.map((c: any) => c.nome)).toEqual(["Ana Cliente"]);
  });
  it("cliente não busca", async () => {
    expect(await despachar("buscar", { termo: "abc" }, cliente())).toMatchObject({ erro: "sem_permissao" });
  });
});

describe("ver_os", () => {
  function semearItens() {
    osEm("AGUARDANDO_APROVACAO");
    db.rows("work_order_items").push({ id: "i1", tenant_id: T, work_order_id: OS, item_type: "PART", description: "pastilha", quantity: 2, part_code: "P1" });
    db.rows("work_order_pricing").push({ id: "p1", tenant_id: T, work_order_item_id: "i1", unit_price: 100, unit_cost: 60, total_price: 200 });
    db.rows("payments").push({ id: "pay", tenant_id: T, work_order_id: OS, amount: 50 });
    db.rows("work_order_events").push({ id: "e1", tenant_id: T, work_order_id: OS, event_type: "WORKFLOW_STEP_CHANGE", description: "Status alterado", created_at: "2026-10-15T11:00:00Z" });
  }
  it("8. pátio não recebe nenhum campo de dinheiro; gestão recebe", async () => {
    semearItens();
    const p: any = await despachar("ver_os", { os_id: OS }, patio());
    expect(p.ok).toBe(true);
    const txt = JSON.stringify(p);
    for (const campo of ["total_amount", "unit_price", "unit_cost", "total_price", "amount", "payments", "pricing", "1234", "100"]) {
      expect(txt).not.toContain(campo);
    }
    expect(p.dados.itens[0]).toMatchObject({ descricao: "pastilha", quantidade: 2 });
    const g: any = await despachar("ver_os", { os_id: OS }, gestao());
    expect(g.dados.total_amount).toBe(1234.5);
    expect(g.dados.itens[0].pricing).toMatchObject({ unit_price: 100, total_price: 200 });
  });
  it("7. por placa pega a OS aberta mais recente", async () => {
    db.rows("work_orders").push(
      { id: "wo-antiga", tenant_id: T, vehicle_id: "v-a", customer_id: "c-a", workflow_step: "EM_DIAGNOSTICO", created_at: "2026-09-01T10:00:00Z" },
      { id: "wo-nova", tenant_id: T, vehicle_id: "v-a", customer_id: "c-a", workflow_step: "EM_EXECUCAO", created_at: "2026-10-10T10:00:00Z" },
      { id: "wo-fechada", tenant_id: T, vehicle_id: "v-a", customer_id: "c-a", workflow_step: "FINALIZADO", created_at: "2026-10-18T10:00:00Z" },
    );
    const r: any = await despachar("ver_os", { placa: "ABC-1D23" }, patio());
    expect(r.dados.os_id).toBe("wo-nova");
  });
  it("sem os_id nem placa → dados_invalidos; OS inexistente → nao_encontrado", async () => {
    expect(await despachar("ver_os", {}, patio())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("ver_os", { os_id: "nao-existe" }, patio())).toMatchObject({ erro: "nao_encontrado" });
  });
});

describe("abrir_os", () => {
  it("1. com agendamento: ele vira CHEGOU, fica ligado à OS e devolve os_id", async () => {
    db.rows("appointments").push({ id: "ag1", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: TERCA_9, status: "AGENDADO", reason: "freio" });
    const r: any = await despachar("abrir_os", { placa: "ABC1D23", queixa: "[TESTE] freio chiando", agendamento_id: "ag1" }, patio());
    expect(r.ok).toBe(true);
    const os = db.rows("work_orders").find((o) => o.id === r.dados.os_id)!;
    expect(os).toMatchObject({
      tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", appointment_id: "ag1", workflow_step: "AGUARDANDO_CHECKIN",
      initial_complaint: "[TESTE] freio chiando", created_by: "u-mec", priority: "MEDIA",
    });
    expect(db.rows("appointments")[0].status).toBe("CHEGOU");
  });
  it("sem agendamento, com prioridade e previsão", async () => {
    const r: any = await despachar("abrir_os", { placa: "XYZ9K88", queixa: "[TESTE] luz do motor", prioridade: "alta", previsao_entrega: "2026-10-23" }, gestao());
    expect(r.ok).toBe(true);
    expect(db.rows("work_orders")[0]).toMatchObject({ priority: "ALTA", expected_delivery_date: "2026-10-23", appointment_id: null });
  });
  it("agendamento de outro carro → dados_invalidos e nada é criado", async () => {
    db.rows("appointments").push({ id: "ag2", tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", scheduled_at: TERCA_9, status: "AGENDADO", reason: "x" });
    const r: any = await despachar("abrir_os", { placa: "ABC1D23", queixa: "x", agendamento_id: "ag2" }, patio());
    expect(r).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(db.rows("work_orders")).toHaveLength(0);
    expect(db.rows("appointments")[0].status).toBe("AGENDADO");
  });
  it("placa desconhecida → nao_encontrado; prioridade inválida → dados_invalidos", async () => {
    expect(await despachar("abrir_os", { placa: "QQQ0Q00", queixa: "x" }, patio())).toMatchObject({ erro: "nao_encontrado" });
    expect(await despachar("abrir_os", { placa: "ABC1D23", queixa: "x", prioridade: "URGENTE" }, patio())).toMatchObject({ erro: "dados_invalidos" });
  });
  it("cliente não abre OS", async () => {
    expect(await despachar("abrir_os", { placa: "ABC1D23", queixa: "x" }, cliente())).toMatchObject({ erro: "sem_permissao" });
  });
});

describe("registrar_checkin", () => {
  it("2. grava mechanic_id = ator e move para CHECKIN_CONCLUIDO; segundo check-in → conflito", async () => {
    osEm("AGUARDANDO_CHECKIN");
    const r: any = await despachar("registrar_checkin", { os_id: OS, km: 123456, combustivel: "metade", pertences: "macaco", observacoes: "risco na porta" }, patio());
    expect(r.ok).toBe(true);
    expect(db.rows("work_order_checkins")[0]).toMatchObject({
      tenant_id: T, work_order_id: OS, mechanic_id: "u-mec", km_current: 123456, fuel_level: "METADE", customer_items: "macaco", observations: "risco na porta",
    });
    expect(etapaAtual()).toBe("CHECKIN_CONCLUIDO");
    const de_novo: any = await despachar("registrar_checkin", { os_id: OS, km: 123500, combustivel: "METADE" }, patio());
    expect(de_novo).toMatchObject({ ok: false, erro: "conflito", nao_diga_que_fez: true });
    expect(db.rows("work_order_checkins")).toHaveLength(1);
  });
  it("combustível inválido e km negativo → dados_invalidos", async () => {
    osEm("AGUARDANDO_CHECKIN");
    expect(await despachar("registrar_checkin", { os_id: OS, km: 1, combustivel: "CHEIO" }, patio())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("registrar_checkin", { os_id: OS, km: -5, combustivel: "METADE" }, patio())).toMatchObject({ erro: "dados_invalidos" });
    expect(db.rows("work_order_checkins")).toHaveLength(0);
  });
  it("não rebaixa uma OS que já passou do check-in", async () => {
    osEm("EM_EXECUCAO");
    await despachar("registrar_checkin", { os_id: OS, km: 10, combustivel: "QUARTO" }, patio());
    expect(etapaAtual()).toBe("EM_EXECUCAO");
  });
});

describe("registrar_diagnostico", () => {
  it("grava o laudo com o mecânico e move para AGUARDANDO_ORCAMENTO", async () => {
    osEm("EM_DIAGNOSTICO");
    const r: any = await despachar("registrar_diagnostico", { os_id: OS, laudo: "[TESTE] pastilha gasta" }, patio());
    expect(r.ok).toBe(true);
    expect(db.rows("work_order_diagnostics")[0]).toMatchObject({ tenant_id: T, work_order_id: OS, mechanic_id: "u-mec", technical_report: "[TESTE] pastilha gasta" });
    expect(db.rows("work_order_diagnostics")[0].ended_at).toBeTruthy();
    expect(etapaAtual()).toBe("AGUARDANDO_ORCAMENTO");
  });
  it("de CHECKIN_CONCLUIDO passa por EM_DIAGNOSTICO e chega em AGUARDANDO_ORCAMENTO", async () => {
    osEm("CHECKIN_CONCLUIDO");
    await despachar("registrar_diagnostico", { os_id: OS, laudo: "x" }, patio());
    expect(etapaAtual()).toBe("AGUARDANDO_ORCAMENTO");
  });
  it("4. sem ator (sistema) → dados_invalidos", async () => {
    osEm("EM_DIAGNOSTICO");
    // sistema não está na lista de papéis desta ação; mesmo com um papel de equipe sem ator, a regra vale
    const semAtor = ctx("gestao", FONE_SIMONE, null);
    const r: any = await despachar("registrar_diagnostico", { os_id: OS, laudo: "x" }, semAtor);
    expect(r).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(r.mensagem).toContain("diagnóstico precisa de um mecânico");
    expect(db.rows("work_order_diagnostics")).toHaveLength(0);
    expect(await despachar("registrar_diagnostico", { os_id: OS, laudo: "x" }, sistema())).toMatchObject({ ok: false });
  });
});

describe("anexar_foto", () => {
  const PIXEL = Buffer.from("fotinha").toString("base64");
  it("sobe no bucket attachments e registra em attachments", async () => {
    osEm("AGUARDANDO_CHECKIN");
    const r: any = await despachar("anexar_foto", { os_id: OS, tipo: "CHECKIN_PHOTO", imagem_base64: PIXEL, mime: "image/jpeg" }, patio());
    expect(r.ok).toBe(true);
    expect(db.uploads).toHaveLength(1);
    expect(db.uploads[0]).toMatchObject({ bucket: "attachments", contentType: "image/jpeg" });
    expect(db.uploads[0].path).toMatch(new RegExp(`^work-orders/${OS}/checkin_photo/.+\\.jpg$`));
    expect(Buffer.from(db.uploads[0].bytes).toString()).toBe("fotinha");
    expect(db.rows("attachments")[0]).toMatchObject({
      tenant_id: T, parent_type: "work_order", parent_id: OS, attachment_type: "CHECKIN_PHOTO", uploaded_by: "u-mec", file_type: "image/jpeg",
    });
    expect(r.dados.url).toBe(db.rows("attachments")[0].file_url);
  });
  it("5. acima de 8 MB e mime fora da lista → dados_invalidos", async () => {
    osEm("AGUARDANDO_CHECKIN");
    const grande = Buffer.alloc(8 * 1024 * 1024 + 10).toString("base64");
    expect(await despachar("anexar_foto", { os_id: OS, tipo: "OTHER", imagem_base64: grande, mime: "image/png" }, patio())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("anexar_foto", { os_id: OS, tipo: "OTHER", imagem_base64: PIXEL, mime: "application/pdf" }, patio())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("anexar_foto", { os_id: OS, tipo: "TIMECLOCK_PHOTO", imagem_base64: PIXEL, mime: "image/png" }, patio())).toMatchObject({ erro: "dados_invalidos" });
    expect(db.uploads).toHaveLength(0);
    expect(db.rows("attachments")).toHaveLength(0);
  });
});

describe("adicionar_itens", () => {
  it("insere serviços e peças sem preço", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    const r: any = await despachar("adicionar_itens", { os_id: OS, itens: [
      { tipo: "SERVICE", descricao: "trocar pastilha" }, { tipo: "part", descricao: "pastilha dianteira", quantidade: 2, codigo: "PD-1" },
    ] }, patio());
    expect(r.ok).toBe(true);
    expect(r.dados.itens).toHaveLength(2);
    expect(db.rows("work_order_items")).toMatchObject([
      { tenant_id: T, work_order_id: OS, item_type: "SERVICE", description: "trocar pastilha", quantity: 1 },
      { item_type: "PART", description: "pastilha dianteira", quantity: 2, part_code: "PD-1" },
    ]);
  });
  it("um item inválido derruba o lote inteiro", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    const r: any = await despachar("adicionar_itens", { os_id: OS, itens: [{ tipo: "SERVICE", descricao: "ok" }, { tipo: "OUTRO", descricao: "x" }] }, patio());
    expect(r).toMatchObject({ erro: "dados_invalidos" });
    expect(db.rows("work_order_items")).toHaveLength(0);
    expect(await despachar("adicionar_itens", { os_id: OS, itens: [] }, patio())).toMatchObject({ erro: "dados_invalidos" });
  });
});

describe("mover_etapa", () => {
  it("3. pátio APROVADO→EM_EXECUCAO ok; AGUARDANDO_APROVACAO→APROVADO → etapa_invalida", async () => {
    osEm("APROVADO");
    expect(await despachar("mover_etapa", { os_id: OS, etapa: "EM_EXECUCAO" }, patio())).toEqual({ ok: true, dados: { etapa: "EM_EXECUCAO" } });
    expect(etapaAtual()).toBe("EM_EXECUCAO");
    db.tables.work_orders = [];
    osEm("AGUARDANDO_APROVACAO");
    const r: any = await despachar("mover_etapa", { os_id: OS, etapa: "APROVADO" }, patio());
    expect(r).toMatchObject({ ok: false, erro: "etapa_invalida", nao_diga_que_fez: true });
    expect(etapaAtual()).toBe("AGUARDANDO_APROVACAO");
  });
  it("gestão aprova por telefone; observação vira evento NOTA_ARNALDO", async () => {
    osEm("AGUARDANDO_APROVACAO");
    const r: any = await despachar("mover_etapa", { os_id: OS, etapa: "APROVADO", observacao: "cliente aprovou por telefone" }, gestao());
    expect(r.ok).toBe(true);
    expect(etapaAtual()).toBe("APROVADO");
    expect(db.rows("work_order_events")[0]).toMatchObject({ tenant_id: T, work_order_id: OS, event_type: "NOTA_ARNALDO", description: "cliente aprovou por telefone", actor_id: "u-simone" });
  });
  it("etapa inexistente → dados_invalidos; ninguém volta de FINALIZADO", async () => {
    osEm("FINALIZADO");
    expect(await despachar("mover_etapa", { os_id: OS, etapa: "VOANDO" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("mover_etapa", { os_id: OS, etapa: "EM_EXECUCAO" }, gestao())).toMatchObject({ erro: "etapa_invalida" });
  });
});

describe("atribuir", () => {
  it("6. nome que casa 2 perfis → dados_invalidos listando os dois", async () => {
    osEm("EM_EXECUCAO");
    const r: any = await despachar("atribuir", { os_id: OS, mecanico: "joa" }, gestao());
    expect(r).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect(r.mensagem).toContain("Joao Mecanico");
    expect(r.mensagem).toContain("Joana Mecanica");
    expect(db.rows("work_orders")[0].current_mechanic_id).toBeUndefined();
  });
  it("nome único e box; inativo não conta; nome inexistente → nao_encontrado", async () => {
    osEm("EM_EXECUCAO");
    expect(await despachar("atribuir", { os_id: OS, mecanico: "joao", box: "box_2" }, gestao())).toEqual({ ok: true, dados: { ok: true } });
    expect(db.rows("work_orders")[0]).toMatchObject({ current_mechanic_id: "u-mec", box_location: "BOX_2" });
    expect(await despachar("atribuir", { os_id: OS, mecanico: "ex gerente" }, gestao())).toMatchObject({ erro: "nao_encontrado" });
  });
  it("exige mecânico ou box; box inválido → dados_invalidos", async () => {
    osEm("EM_EXECUCAO");
    expect(await despachar("atribuir", { os_id: OS }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("atribuir", { os_id: OS, box: "BOX_9" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
  });
});
