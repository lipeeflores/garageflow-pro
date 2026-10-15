import { describe, it, expect, beforeEach } from "vitest";
import type { FakeDb } from "./fakeDb";
import { T, FONE_A, FONE_SIMONE, FONE_MECANICO, semear, mkCtx } from "./fixtures";
import { despachar } from "../../../supabase/functions/_shared/arnaldo/router";
import type { Ctx } from "../../../supabase/functions/_shared/arnaldo/db";
import type { Papel } from "../../../supabase/functions/_shared/arnaldo/roles";

let db: FakeDb;
const ctx = (papel: Papel, telefone: string | null, atorId: string | null = null): Ctx => mkCtx(db, papel, telefone, atorId);
const cliente = () => ctx("cliente", FONE_A);
const gestao = () => ctx("gestao", FONE_SIMONE, "u-simone");
const dono = () => ctx("dono", FONE_SIMONE, "u-simone");
const patio = () => ctx("patio", FONE_MECANICO, "u-mec");

const OS = "abcd1234-0000-4000-8000-000000000001";
function osEm(etapa: string) {
  db.rows("work_orders").push({ id: OS, tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", workflow_step: etapa, total_amount: 0, created_at: "2026-10-15T10:00:00Z" });
  db.rows("work_order_items").push(
    { id: "i1", tenant_id: T, work_order_id: OS, item_type: "SERVICE", description: "mão de obra freio", quantity: 1, created_at: "2026-10-15T10:01:00Z" },
    { id: "i2", tenant_id: T, work_order_id: OS, item_type: "PART", description: "pastilha", quantity: 2, created_at: "2026-10-15T10:02:00Z" },
  );
}
const osRow = () => db.rows("work_orders").find((o) => o.id === OS)!;

beforeEach(() => { db = semear(); });

describe("P1 é só para gestão e dono", () => {
  const CHAMADAS: [string, Record<string, unknown>][] = [
    ["precificar_itens", { os_id: OS, precos: [{ item_id: "i1", preco_unitario: 1 }] }],
    ["enviar_orcamento", { os_id: OS }],
    ["controle_qualidade", { os_id: OS, aprovado: true }],
    ["registrar_pagamento", { os_id: OS, valor: 10, forma: "PIX" }],
    ["resumo_financeiro", { de: "2026-10-01", ate: "2026-10-31" }],
    ["contas_a_pagar", { acao: "listar" }],
  ];
  it.each(CHAMADAS)("%s: pátio, cliente e sistema levam sem_permissao e nada é gravado", async (nome, args) => {
    osEm("EM_QUALIDADE");
    const antes = JSON.stringify(db.tables);
    for (const c of [patio(), cliente(), ctx("sistema", "SYSTEM")]) {
      expect(await despachar(nome, args, c)).toMatchObject({ ok: false, erro: "sem_permissao", nao_diga_que_fez: true });
    }
    expect(JSON.stringify(db.tables)).toBe(antes);
  });
});

describe("precificar_itens", () => {
  it("grava preço × quantidade e recalcula total_amount", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    const r: any = await despachar("precificar_itens", { os_id: OS, precos: [
      { item_id: "i1", preco_unitario: 150 }, { item_id: "i2", preco_unitario: 80.5, custo_unitario: 50 },
    ] }, gestao());
    expect(r).toMatchObject({ ok: true, dados: { total: 311 } });
    const p = db.rows("work_order_pricing");
    expect(p.find((x) => x.work_order_item_id === "i1")).toMatchObject({ tenant_id: T, unit_price: 150, total_price: 150, unit_cost: null });
    expect(p.find((x) => x.work_order_item_id === "i2")).toMatchObject({ unit_price: 80.5, total_price: 161, unit_cost: 50 });
    expect(osRow().total_amount).toBe(311);
  });
  it("repetir atualiza em vez de duplicar", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    await despachar("precificar_itens", { os_id: OS, precos: [{ item_id: "i2", preco_unitario: 10 }] }, gestao());
    await despachar("precificar_itens", { os_id: OS, precos: [{ item_id: "i2", preco_unitario: 20 }] }, dono());
    expect(db.rows("work_order_pricing")).toHaveLength(1);
    expect(db.rows("work_order_pricing")[0]).toMatchObject({ unit_price: 20, total_price: 40 });
    expect(osRow().total_amount).toBe(40);
  });
  it("item de outra OS, preço inválido ou lista vazia → dados_invalidos, sem gravar nada", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    db.rows("work_order_items").push({ id: "outro", tenant_id: T, work_order_id: "outra-os", item_type: "PART", description: "x", quantity: 1 });
    for (const precos of [
      [{ item_id: "outro", preco_unitario: 10 }],
      [{ item_id: "i1", preco_unitario: 10 }, { item_id: "i2", preco_unitario: -5 }],
      [{ item_id: "i1", preco_unitario: "caro" }],
      [],
    ]) {
      expect(await despachar("precificar_itens", { os_id: OS, precos }, gestao())).toMatchObject({ ok: false, erro: "dados_invalidos" });
    }
    expect(db.rows("work_order_pricing")).toHaveLength(0);
    expect(osRow().total_amount).toBe(0);
  });
  it("OS encerrada → etapa_invalida", async () => {
    osEm("FINALIZADO");
    expect(await despachar("precificar_itens", { os_id: OS, precos: [{ item_id: "i1", preco_unitario: 10 }] }, gestao())).toMatchObject({ erro: "etapa_invalida" });
  });
});

describe("enviar_orcamento", () => {
  it("recusa a OS com item sem preço, dizendo qual", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    await despachar("precificar_itens", { os_id: OS, precos: [{ item_id: "i1", preco_unitario: 100 }] }, gestao());
    const r: any = await despachar("enviar_orcamento", { os_id: OS }, gestao());
    expect(r).toMatchObject({ ok: false, erro: "dados_invalidos", nao_diga_que_fez: true });
    expect(r.mensagem).toContain("pastilha");
    expect(osRow().workflow_step).toBe("AGUARDANDO_ORCAMENTO");
  });
  it("recusa a OS sem itens", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    db.tables.work_order_items = [];
    expect(await despachar("enviar_orcamento", { os_id: OS }, gestao())).toMatchObject({ erro: "dados_invalidos" });
  });
  it("com tudo precificado: total_amount, etapa AGUARDANDO_APROVACAO e link com token", async () => {
    osEm("AGUARDANDO_ORCAMENTO");
    await despachar("precificar_itens", { os_id: OS, precos: [{ item_id: "i1", preco_unitario: 100 }, { item_id: "i2", preco_unitario: 25 }] }, gestao());
    const r: any = await despachar("enviar_orcamento", { os_id: OS }, gestao());
    expect(r).toMatchObject({ ok: true, dados: { etapa: "AGUARDANDO_APROVACAO", total_amount: 150, link_orcamento: `https://app.example.com/orcamento/${OS}?token=ABCD1234` } });
    expect(osRow()).toMatchObject({ workflow_step: "AGUARDANDO_APROVACAO", total_amount: 150 });
  });
  it("reenviar quando já está aguardando aprovação devolve o link de novo; outras etapas → etapa_invalida", async () => {
    osEm("AGUARDANDO_APROVACAO");
    await despachar("precificar_itens", { os_id: OS, precos: [{ item_id: "i1", preco_unitario: 1 }, { item_id: "i2", preco_unitario: 1 }] }, gestao());
    expect(((await despachar("enviar_orcamento", { os_id: OS }, gestao())) as any).dados.link_orcamento).toContain("token=ABCD1234");
    osRow().workflow_step = "EM_EXECUCAO";
    expect(await despachar("enviar_orcamento", { os_id: OS }, gestao())).toMatchObject({ erro: "etapa_invalida" });
  });
});

describe("controle_qualidade", () => {
  it("aprovado → PRONTO_PARA_RETIRADA, com manager_id = ator", async () => {
    osEm("EM_QUALIDADE");
    const r: any = await despachar("controle_qualidade", { os_id: OS, aprovado: true, notas: "tudo certo" }, gestao());
    expect(r.ok).toBe(true);
    expect(db.rows("work_order_quality")[0]).toMatchObject({ tenant_id: T, work_order_id: OS, manager_id: "u-simone", status: "APROVADO", notes: "tudo certo" });
    expect(osRow().workflow_step).toBe("PRONTO_PARA_RETIRADA");
  });
  it("reprovado → AJUSTES, status DEVOLVIDO_AJUSTES", async () => {
    osEm("EM_QUALIDADE");
    await despachar("controle_qualidade", { os_id: OS, aprovado: false }, dono());
    expect(db.rows("work_order_quality")[0].status).toBe("DEVOLVIDO_AJUSTES");
    expect(osRow().workflow_step).toBe("AJUSTES");
  });
  it("fora de EM_QUALIDADE → etapa_invalida; `aprovado` não booleano → dados_invalidos; sem ator → dados_invalidos", async () => {
    osEm("EM_EXECUCAO");
    expect(await despachar("controle_qualidade", { os_id: OS, aprovado: true }, gestao())).toMatchObject({ erro: "etapa_invalida" });
    osRow().workflow_step = "EM_QUALIDADE";
    expect(await despachar("controle_qualidade", { os_id: OS, aprovado: "talvez" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("controle_qualidade", { os_id: OS, aprovado: true }, ctx("gestao", FONE_SIMONE, null))).toMatchObject({ erro: "dados_invalidos" });
    expect(db.rows("work_order_quality")).toHaveLength(0);
    expect(osRow().workflow_step).toBe("EM_QUALIDADE");
  });
});

describe("registrar_pagamento", () => {
  it("grava payments e financial_entries (RECEITA) exatamente como o app", async () => {
    osEm("PRONTO_PARA_RETIRADA");
    osRow().total_amount = 300;
    const r: any = await despachar("registrar_pagamento", { os_id: OS, valor: 100, forma: "pix" }, gestao());
    expect(r).toMatchObject({ ok: true, dados: { total_pago: 100, saldo: 200 } });
    expect(db.rows("payments")[0]).toMatchObject({ tenant_id: T, work_order_id: OS, amount: 100, payment_method: "PIX", processed_by: "u-simone", notes: null });
    expect(db.rows("payments")[0].paid_at).toBeTruthy();
    expect(db.rows("financial_entries")[0]).toMatchObject({
      tenant_id: T, work_order_id: OS, payment_id: db.rows("payments")[0].id, amount: 100, entry_type: "RECEITA", category: "Pix", description: "Pagamento OS ABCD1234",
    });
  });
  it("valor ≤ 0, não numérico ou forma inválida → dados_invalidos", async () => {
    osEm("PRONTO_PARA_RETIRADA");
    for (const a of [{ valor: 0, forma: "PIX" }, { valor: -3, forma: "PIX" }, { valor: "muito", forma: "PIX" }, { valor: 10, forma: "CHEQUE" }]) {
      expect(await despachar("registrar_pagamento", { os_id: OS, ...a }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    }
    expect(db.rows("payments")).toHaveLength(0);
  });
  it("o mesmo pagamento repetido em instantes (retentativa do modelo) → conflito, sem duplicar", async () => {
    osEm("PRONTO_PARA_RETIRADA");
    await despachar("registrar_pagamento", { os_id: OS, valor: 50, forma: "DINHEIRO" }, gestao());
    db.rows("payments")[0].paid_at = new Date(Date.UTC(2026, 9, 19, 11, 0, 0) - 30_000).toISOString(); // 30 s antes de AGORA
    const r: any = await despachar("registrar_pagamento", { os_id: OS, valor: 50, forma: "DINHEIRO" }, gestao());
    expect(r).toMatchObject({ ok: false, erro: "conflito", nao_diga_que_fez: true });
    expect(db.rows("payments")).toHaveLength(1);
    expect(db.rows("financial_entries")).toHaveLength(1);
  });
  it("se a entrada financeira falha, o pagamento é desfeito", async () => {
    osEm("PRONTO_PARA_RETIRADA");
    db.falhaEm["financial_entries"] = "boom";
    expect(await despachar("registrar_pagamento", { os_id: OS, valor: 10, forma: "PIX" }, gestao())).toMatchObject({ ok: false, erro: "erro_interno" });
    expect(db.rows("payments")).toHaveLength(0);
  });
  it("OS inexistente → nao_encontrado", async () => {
    expect(await despachar("registrar_pagamento", { os_id: "nada", valor: 10, forma: "PIX" }, gestao())).toMatchObject({ erro: "nao_encontrado" });
  });
});

describe("resumo_financeiro", () => {
  it("receita no período, por forma de pagamento, ticket médio e em andamento", async () => {
    osEm("EM_EXECUCAO");
    osRow().total_amount = 500;
    db.rows("work_orders").push(
      { id: "f1", tenant_id: T, workflow_step: "FINALIZADO", total_amount: 400, created_at: "2026-10-05T12:00:00Z" },
      { id: "f2", tenant_id: T, workflow_step: "FINALIZADO", total_amount: 200, created_at: "2026-10-06T12:00:00Z" },
      { id: "f3", tenant_id: T, workflow_step: "FINALIZADO", total_amount: 999, created_at: "2026-09-06T12:00:00Z" },
    );
    db.rows("financial_entries").push(
      { id: "e1", tenant_id: T, entry_type: "RECEITA", amount: 400, entry_date: "2026-10-05" },
      { id: "e2", tenant_id: T, entry_type: "RECEITA", amount: 200, entry_date: "2026-10-31" },
      { id: "e3", tenant_id: T, entry_type: "RECEITA", amount: 777, entry_date: "2026-09-30" },
      { id: "e4", tenant_id: T, entry_type: "DESPESA", amount: 50, entry_date: "2026-10-10" },
    );
    db.rows("payments").push(
      { id: "p1", tenant_id: T, payment_method: "PIX", amount: 400, paid_at: "2026-10-05T15:00:00-03:00" },
      { id: "p2", tenant_id: T, payment_method: "DINHEIRO", amount: 200, paid_at: "2026-10-31T23:00:00-03:00" },
      { id: "p3", tenant_id: T, payment_method: "PIX", amount: 777, paid_at: "2026-09-30T23:00:00-03:00" },
    );
    const r: any = await despachar("resumo_financeiro", { de: "2026-10-01", ate: "2026-10-31" }, gestao());
    expect(r.ok).toBe(true);
    expect(r.dados).toMatchObject({
      de: "2026-10-01", ate: "2026-10-31", receita: 600, os_finalizadas: 2, ticket_medio: 300, em_andamento: 500,
      por_forma: [{ forma: "Pix", valor: 400 }, { forma: "Dinheiro", valor: 200 }],
    });
  });
  it("período inválido ou maior que 366 dias → dados_invalidos", async () => {
    expect(await despachar("resumo_financeiro", { de: "2026-10-31", ate: "2026-10-01" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("resumo_financeiro", { de: "2024-01-01", ate: "2026-10-01" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("resumo_financeiro", { de: "x", ate: "2026-10-01" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
  });
  it("sem lançamentos: zeros, sem divisão por zero", async () => {
    const r: any = await despachar("resumo_financeiro", { de: "2026-10-01", ate: "2026-10-31" }, gestao());
    expect(r.dados).toMatchObject({ receita: 0, os_finalizadas: 0, ticket_medio: 0, em_andamento: 0, por_forma: [] });
  });
});

describe("contas_a_pagar", () => {
  it("criar → PENDENTE, FLUTUANTE por padrão, com created_by", async () => {
    const r: any = await despachar("contas_a_pagar", { acao: "criar", descricao: "[TESTE] luz", valor: 320.9, vencimento: "2026-10-25" }, gestao());
    expect(r.ok).toBe(true);
    expect(db.rows("bills")[0]).toMatchObject({
      tenant_id: T, description: "[TESTE] luz", amount: 320.9, due_date: "2026-10-25", category: "FLUTUANTE", status: "PENDENTE", created_by: "u-simone", is_recurring: false,
    });
  });
  it("criar com campos faltando ou inválidos → dados_invalidos", async () => {
    for (const a of [{ valor: 10, vencimento: "2026-10-25" }, { descricao: "x", vencimento: "2026-10-25" }, { descricao: "x", valor: 0, vencimento: "2026-10-25" }, { descricao: "x", valor: 10, vencimento: "amanhã" }]) {
      expect(await despachar("contas_a_pagar", { acao: "criar", ...a }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    }
    expect(db.rows("bills")).toHaveLength(0);
  });
  it("listar traz pendentes e vencidas por vencimento, com resumo; ignora pagas", async () => {
    db.rows("bills").push(
      { id: "b1", tenant_id: T, description: "aluguel", amount: 2000, category: "FIXA", status: "PENDENTE", due_date: "2026-10-30" },
      { id: "b2", tenant_id: T, description: "peças", amount: 500, category: "FLUTUANTE", status: "PENDENTE", due_date: "2026-10-10" },
      { id: "b3", tenant_id: T, description: "internet", amount: 100, category: "FIXA", status: "PAGO", due_date: "2026-10-05" },
    );
    const r: any = await despachar("contas_a_pagar", { acao: "listar" }, dono());
    expect(r.dados.contas.map((c: any) => c.id)).toEqual(["b2", "b1"]);
    expect(r.dados.resumo).toMatchObject({ pendente: 2000, vencido: 500 }); // hoje (AGORA) = 2026-10-19
  });
  it("pagar marca PAGO com valor e data; pagar de novo ou conta de outro tenant → erro", async () => {
    db.rows("bills").push({ id: "b1", tenant_id: T, description: "aluguel", amount: 2000, category: "FIXA", status: "PENDENTE", due_date: "2026-10-30" });
    db.rows("bills").push({ id: "bx", tenant_id: "outro", description: "x", amount: 1, category: "FIXA", status: "PENDENTE", due_date: "2026-10-30" });
    const r: any = await despachar("contas_a_pagar", { acao: "pagar", conta_id: "b1", valor: 1950 }, gestao());
    expect(r.ok).toBe(true);
    expect(db.rows("bills")[0]).toMatchObject({ status: "PAGO", paid_amount: 1950 });
    expect(db.rows("bills")[0].paid_at).toBeTruthy();
    expect(await despachar("contas_a_pagar", { acao: "pagar", conta_id: "b1" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("contas_a_pagar", { acao: "pagar", conta_id: "bx" }, gestao())).toMatchObject({ erro: "nao_encontrado" });
    expect(db.rows("bills")[1].status).toBe("PENDENTE");
  });
  it("pagar sem `valor` usa o valor da conta; acao desconhecida → dados_invalidos", async () => {
    db.rows("bills").push({ id: "b1", tenant_id: T, description: "aluguel", amount: 2000, category: "FIXA", status: "VENCIDO", due_date: "2026-10-01" });
    await despachar("contas_a_pagar", { acao: "pagar", conta_id: "b1" }, gestao());
    expect(db.rows("bills")[0]).toMatchObject({ status: "PAGO", paid_amount: 2000 });
    expect(await despachar("contas_a_pagar", { acao: "apagar" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
  });
});
