import { describe, it, expect, beforeEach } from "vitest";
import type { FakeDb } from "./fakeDb";
import { T, FONE_A, FONE_SIMONE, FONE_MECANICO, NAO_ACHEI, semear, mkCtx } from "./fixtures";
import { despachar } from "../../../supabase/functions/_shared/arnaldo/router";
import type { Ctx } from "../../../supabase/functions/_shared/arnaldo/db";
import type { Papel } from "../../../supabase/functions/_shared/arnaldo/roles";

let db: FakeDb;
const ctx = (papel: Papel, telefone: string | null, atorId: string | null = null, settings: unknown = {}): Ctx => ({
  ...mkCtx(db, papel, telefone, atorId), tenantSettings: settings,
});
const cliente = (fone = FONE_A) => ctx("cliente", fone);
const gestao = () => ctx("gestao", FONE_SIMONE, "u-simone");
const dono = () => ctx("dono", FONE_SIMONE, "u-simone");
const patio = () => ctx("patio", FONE_MECANICO, "u-mec");
const sistema = () => ctx("sistema", "SYSTEM");

const OS = "abcd1234-0000-4000-8000-000000000042";
const osRow = () => db.rows("work_orders").find((o) => o.id === OS)!;

/** OS nº 42 do cliente A (carro ABC1D23) com check-in, fotos, diagnóstico, itens com preço e um pagamento. */
function cenario(etapa: string, extra: { pagamento?: boolean } = { pagamento: true }) {
  db.rows("work_orders").push({
    id: OS, numero: 42, tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", workflow_step: etapa, priority: "ALTA", box_location: "BOX_2",
    current_mechanic_id: "u-mec", initial_complaint: "barulho ao frear", expected_delivery_date: "2026-10-23", total_amount: 834,
    created_at: "2026-10-15T11:40:00Z",
  });
  db.rows("work_order_checkins").push({
    id: "ck1", tenant_id: T, work_order_id: OS, mechanic_id: "u-mec", km_current: 98450, fuel_level: "METADE", customer_items: "cadeirinha",
    observations: "chegou rebocado", avarias: "risco na porta", tem_estepe: true, estado_estepe: "bom", tem_macaco: true, tem_chave_roda: false,
    checked_in_at: "2026-10-15T11:40:00Z",
  });
  const foto = (id: string, nome: string, em: string, tipo = "CHECKIN_PHOTO") =>
    db.rows("attachments").push({ id, tenant_id: T, parent_type: "work_order", parent_id: OS, attachment_type: tipo, file_url: `https://f/${id}.jpg`, file_name: nome, created_at: em });
  foto("f1", "checkin_photo__Avaria porta__1760000000000.jpg", "2026-10-15T11:41:00Z"); // avaria primeiro na ordem de criação
  foto("f2", "checkin-front.jpg", "2026-10-15T11:42:00Z");
  foto("f3", "checkin-back.jpg", "2026-10-15T11:43:00Z");
  foto("f4", "audio.webm", "2026-10-15T11:44:00Z", "DIAGNOSIS_AUDIO"); // áudio não é foto
  db.rows("work_order_diagnostics").push({ id: "d1", tenant_id: T, work_order_id: OS, mechanic_id: "u-mec", technical_report: "pastilhas no fim", ended_at: "2026-10-15T13:00:00Z", created_at: "2026-10-15T12:30:00Z" });
  db.rows("work_order_items").push(
    { id: "i1", tenant_id: T, work_order_id: OS, item_type: "SERVICE", description: "troca de pastilhas", quantity: 1, created_at: "2026-10-15T13:01:00Z" },
    { id: "i2", tenant_id: T, work_order_id: OS, item_type: "PART", description: "pastilha dianteira", quantity: 2, part_code: "COBREQ N-1209", created_at: "2026-10-15T13:02:00Z" },
  );
  db.rows("work_order_pricing").push(
    { id: "p1", tenant_id: T, work_order_item_id: "i1", unit_price: 180, unit_cost: 90, total_price: 180 },
    { id: "p2", tenant_id: T, work_order_item_id: "i2", unit_price: 327, unit_cost: 200, total_price: 654 },
  );
  db.rows("work_order_events").push(
    { id: "e1", tenant_id: T, work_order_id: OS, event_type: "WORKFLOW_STEP_CHANGE", new_data: { workflow_step: "AGUARDANDO_APROVACAO" }, created_at: "2026-10-15T14:00:00Z" },
    { id: "e2", tenant_id: T, work_order_id: OS, event_type: "WORKFLOW_STEP_CHANGE", new_data: { workflow_step: "APROVADO" }, created_at: "2026-10-15T15:12:00Z" },
  );
  if (extra.pagamento) {
    db.rows("payments").push({ id: "pg1", tenant_id: T, work_order_id: OS, amount: 834, payment_method: "PIX", paid_at: "2026-10-16T20:05:00Z", processed_by: "u-simone" });
  }
}

const PROIBIDAS = ["preco_unitario", "total", "totais", "pagamentos", "valor", "unit_price", "total_price", "unit_cost", "total_amount", "amount", "pricing", "payments", "custo", "preco"];
function chaves(x: unknown, acc: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((i) => chaves(i, acc));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) { acc.push(k); chaves(v, acc); }
  return acc;
}

beforeEach(() => { db = semear(); });

describe("dados_documento: contrato", () => {
  it("orçamento completo, com as chaves do contrato", async () => {
    cenario("AGUARDANDO_APROVACAO", { pagamento: false });
    const r: any = await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, gestao());
    expect(r.ok).toBe(true);
    const d = r.dados;
    expect(d.tipo).toBe("orcamento");
    expect(d.empresa).toEqual({
      nome: "MD Mecânica Multimarcas", cnpj: "05.887.728/0001-09", telefone: "(47) 8488-9108",
      endereco: "Rua 248, 721 · Meia Praia · Itapema/SC · 88220-000", email: "mdmultimarcas123@hotmail.com",
    });
    expect(d.config).toMatchObject({ validade_orcamento_dias: 7, garantia_dias: 90, formas_pagamento: "PIX, cartão ou dinheiro" });
    expect(d.config.texto_aprovacao).toContain("autoriza a execução");
    expect(d.config.texto_ficha).toContain("Pertences");
    expect(d.config.texto_garantia).toContain("garantia cobre");
    expect(d.os).toMatchObject({
      id: OS, numero: 42, numero_fmt: "0042", etapa: "AGUARDANDO_APROVACAO", etapa_texto: "aguardando sua aprovação do orçamento", prioridade: "ALTA",
      box: "BOX_2", mecanico: "Joao Mecanico", previsao_entrega: "2026-10-23", queixa: "barulho ao frear",
      aprovada_em: "2026-10-15T12:12:00-03:00", entregue_em: null, km_saida: null, garantia_ate: null, proxima_revisao_km: null, proxima_revisao_data: null,
    });
    expect(d.cliente).toEqual({ nome: "Ana Cliente", telefone_fmt: "(47) 98488-9108", cpf_cnpj: null, endereco: null });
    expect(d.veiculo).toEqual({ placa: "ABC1D23", marca: "Fiat", modelo: "Uno", ano: 2015, cor: "prata", chassi: null });
    expect(d.checkin).toMatchObject({
      km: 98450, combustivel: "METADE", pertences: "cadeirinha", observacoes: "chegou rebocado", avarias: "risco na porta",
      tem_estepe: true, estado_estepe: "bom", tem_macaco: true, tem_chave_roda: false, recebido_por: "Joao Mecanico",
    });
    expect(d.diagnosticos).toEqual([{ laudo: "pastilhas no fim", mecanico: "Joao Mecanico", em: expect.any(String) }]);
    expect(d.itens).toEqual([
      { tipo: "SERVICE", descricao: "troca de pastilhas", codigo: null, quantidade: 1, preco_unitario: 180, total: 180 },
      { tipo: "PART", descricao: "pastilha dianteira", codigo: "COBREQ N-1209", quantidade: 2, preco_unitario: 327, total: 654 },
    ]);
    expect(d.totais).toEqual({ pecas: 654, mao_de_obra: 180, desconto: 0, total: 834 });
    expect(d.pagamentos).toEqual([]);
    expect(d.link_aprovacao).toBe(`https://app.example.com/orcamento/${OS}?token=ABCD1234`);
    expect(d.validade_ate).toBe("2026-10-22"); // envio em 15/10 (11:00 -03) + 7 dias
  });
  it("fotos: as que não são avaria primeiro, avarias depois; áudio fora; legenda vem do nome", async () => {
    cenario("AGUARDANDO_APROVACAO");
    const r: any = await despachar("dados_documento", { tipo: "ficha_entrada", os_id: OS }, gestao());
    expect(r.dados.fotos).toEqual([
      { url: "https://f/f2.jpg", tipo: "CHECKIN_PHOTO", legenda: "Frente", avaria: false },
      { url: "https://f/f3.jpg", tipo: "CHECKIN_PHOTO", legenda: "Traseira", avaria: false },
      { url: "https://f/f1.jpg", tipo: "CHECKIN_PHOTO", legenda: "Avaria porta", avaria: true },
    ]);
  });
  it("campos sem dado vêm como null, nunca omitidos", async () => {
    db.rows("work_orders").push({ id: OS, numero: 7, tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", workflow_step: "AGUARDANDO_APROVACAO", created_at: "2026-10-15T11:40:00Z" });
    db.rows("work_order_items").push({ id: "i1", tenant_id: T, work_order_id: OS, item_type: "SERVICE", description: "x", quantity: 1 });
    const d = ((await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, gestao())) as any).dados;
    expect(d.checkin).toBeNull();
    expect(d.os).toMatchObject({ mecanico: null, box: null, prioridade: null, previsao_entrega: null, queixa: null, aprovada_em: null });
    expect(d.cliente).toMatchObject({ telefone_fmt: "(47) 91111-2222" });
    expect(d.itens[0]).toMatchObject({ codigo: null, preco_unitario: null, total: null });
    expect(d.fotos).toEqual([]);
    expect(d.diagnosticos).toEqual([]);
  });
  it("config mescla tenants.settings.documentos com os padrões", async () => {
    cenario("AGUARDANDO_APROVACAO");
    const c = ctx("gestao", FONE_SIMONE, "u-simone", { documentos: { garantia_dias: 30, formas_pagamento: "só PIX", texto_ficha: "texto próprio", lixo: 1 } });
    const d = ((await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, c)) as any).dados;
    expect(d.config).toMatchObject({ garantia_dias: 30, formas_pagamento: "só PIX", texto_ficha: "texto próprio", validade_orcamento_dias: 7 });
    expect(d.config.lixo).toBeUndefined();
  });
  it("alvo por numero (número, '42', 'OS 42', '0042'), por os_id numérico e por placa", async () => {
    cenario("AGUARDANDO_APROVACAO");
    for (const a of [{ numero: 42 }, { numero: "0042" }, { numero: "OS 42" }, { os_id: "42" }, { os_id: "OS 0042" }, { placa: "abc-1d23" }, { os_id: OS }]) {
      const r: any = await despachar("dados_documento", { tipo: "orcamento", ...a }, gestao());
      expect(r.ok, JSON.stringify(a)).toBe(true);
      expect(r.dados.os.id).toBe(OS);
    }
    expect(await despachar("dados_documento", { tipo: "orcamento", numero: 999 }, gestao())).toMatchObject({ erro: "nao_encontrado" });
    expect(await despachar("dados_documento", { tipo: "orcamento" }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("dados_documento", { tipo: "carta", os_id: OS }, gestao())).toMatchObject({ erro: "dados_invalidos" });
  });
  it("por placa pega a OS aberta mais recente", async () => {
    cenario("AGUARDANDO_APROVACAO");
    db.rows("work_orders").push({ id: "velha", numero: 5, tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", workflow_step: "FINALIZADO", created_at: "2026-10-18T00:00:00Z" });
    const r: any = await despachar("dados_documento", { tipo: "orcamento", placa: "ABC1D23" }, gestao());
    expect(r.dados.os.id).toBe(OS);
  });
});

describe("dados_documento: papéis", () => {
  it("orçamento: gestão, dono e sistema veem; pátio → sem_permissao", async () => {
    cenario("AGUARDANDO_APROVACAO");
    for (const c of [gestao(), dono(), sistema()]) expect(((await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, c)) as any).ok).toBe(true);
    expect(await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, patio())).toMatchObject({ ok: false, erro: "sem_permissao", nao_diga_que_fez: true });
  });
  it("cliente dono da OS recebe orçamento com preços; de outra placa recebe a mesma resposta de inexistente", async () => {
    cenario("AGUARDANDO_APROVACAO");
    const meu: any = await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, cliente());
    expect(meu.ok).toBe(true);
    expect(meu.dados.totais.total).toBe(834);
    expect(meu.dados.itens[1].preco_unitario).toBe(327);
    const outroCliente = ctx("cliente", "5547911112222"); // Bruno
    const alheio: any = await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, outroCliente);
    const inexistente: any = await despachar("dados_documento", { tipo: "orcamento", os_id: "nao-existe" }, outroCliente);
    expect(alheio).toMatchObject({ ok: false, erro: "nao_encontrado" });
    expect(alheio).toEqual(inexistente);
    const porPlacaAlheia: any = await despachar("dados_documento", { tipo: "orcamento", placa: "ABC1D23" }, outroCliente);
    expect(porPlacaAlheia).toMatchObject({ ok: false, erro: "nao_encontrado", mensagem: NAO_ACHEI });
    // cliente sem cadastro nenhum
    expect(await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, cliente("5547977776666"))).toMatchObject({ erro: "nao_encontrado" });
  });
  it("orçamento antes de AGUARDANDO_APROVACAO → etapa_invalida; depois (APROVADO, EM_EXECUCAO...) vale; CANCELADO não", async () => {
    cenario("AGUARDANDO_ORCAMENTO", { pagamento: false });
    expect(await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, gestao())).toMatchObject({ erro: "etapa_invalida" });
    for (const e of ["AGUARDANDO_APROVACAO", "APROVADO", "EM_EXECUCAO", "PRONTO_PARA_RETIRADA", "FINALIZADO"]) {
      osRow().workflow_step = e;
      expect(((await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, gestao())) as any).ok, e).toBe(true);
    }
    osRow().workflow_step = "CANCELADO";
    expect(await despachar("dados_documento", { tipo: "orcamento", os_id: OS }, gestao())).toMatchObject({ erro: "etapa_invalida" });
  });
  it("recibo: sem pagamento e sem FINALIZADO → etapa_invalida; com pagamento ou FINALIZADO vale", async () => {
    cenario("PRONTO_PARA_RETIRADA", { pagamento: false });
    expect(await despachar("dados_documento", { tipo: "recibo", os_id: OS }, gestao())).toMatchObject({ erro: "etapa_invalida" });
    osRow().workflow_step = "FINALIZADO";
    expect(((await despachar("dados_documento", { tipo: "recibo", os_id: OS }, gestao())) as any).ok).toBe(true);
    osRow().workflow_step = "PRONTO_PARA_RETIRADA";
    db.rows("payments").push({ id: "pg1", tenant_id: T, work_order_id: OS, amount: 100, payment_method: "DINHEIRO", paid_at: "2026-10-16T20:05:00Z", processed_by: "u-simone" });
    const r: any = await despachar("dados_documento", { tipo: "recibo", os_id: OS }, cliente());
    expect(r.ok).toBe(true);
    expect(r.dados.pagamentos).toEqual([{ valor: 100, forma: "DINHEIRO", em: expect.any(String), recebido_por: "Simone" }]);
  });
  it("recibo: pátio → sem_permissao; cliente de outra OS → nao_encontrado", async () => {
    cenario("FINALIZADO");
    expect(await despachar("dados_documento", { tipo: "recibo", os_id: OS }, patio())).toMatchObject({ erro: "sem_permissao" });
    expect(await despachar("dados_documento", { tipo: "recibo", os_id: OS }, ctx("cliente", "5547911112222"))).toMatchObject({ erro: "nao_encontrado" });
  });
  it("ficha de entrada: equipe e cliente dono; sem check-in → nao_encontrado; sem dinheiro para ninguém", async () => {
    cenario("CHECKIN_CONCLUIDO");
    for (const c of [patio(), gestao(), dono(), sistema(), cliente()]) {
      const r: any = await despachar("dados_documento", { tipo: "ficha_entrada", os_id: OS }, c);
      expect(r.ok).toBe(true);
      expect(chaves(r.dados).filter((k) => PROIBIDAS.includes(k))).toEqual([]);
      expect(r.dados.link_aprovacao).toBeNull();
    }
    db.tables.work_order_checkins = [];
    expect(await despachar("dados_documento", { tipo: "ficha_entrada", os_id: OS }, gestao())).toMatchObject({ erro: "nao_encontrado" });
  });
  it("ficha: cliente de outra OS → nao_encontrado", async () => {
    cenario("CHECKIN_CONCLUIDO");
    expect(await despachar("dados_documento", { tipo: "ficha_entrada", os_id: OS }, ctx("cliente", "5547911112222"))).toMatchObject({ erro: "nao_encontrado" });
  });
  it("OS do pátio: nenhum campo de dinheiro, NEM para o dono; cliente → sem_permissao", async () => {
    cenario("APROVADO");
    for (const c of [patio(), gestao(), dono(), sistema()]) {
      const r: any = await despachar("dados_documento", { tipo: "os_patio", os_id: OS }, c);
      expect(r.ok).toBe(true);
      expect(chaves(r.dados).filter((k) => PROIBIDAS.includes(k))).toEqual([]);
      expect(r.dados.itens).toEqual([
        { tipo: "SERVICE", descricao: "troca de pastilhas", codigo: null, quantidade: 1 },
        { tipo: "PART", descricao: "pastilha dianteira", codigo: "COBREQ N-1209", quantidade: 2 },
      ]);
      expect(r.dados.link_aprovacao).toBeNull(); // o link do orçamento mostra os preços
      const txt = JSON.stringify(r.dados);
      for (const n of ["834", "654", "327", "180"]) expect(txt).not.toContain(`:${n}`);
    }
    expect(await despachar("dados_documento", { tipo: "os_patio", os_id: OS }, cliente())).toMatchObject({ erro: "sem_permissao" });
  });
  it("OS do pátio vale em qualquer etapa aberta (inclusive antes do orçamento)", async () => {
    cenario("EM_DIAGNOSTICO");
    expect(((await despachar("dados_documento", { tipo: "os_patio", os_id: OS }, patio())) as any).ok).toBe(true);
  });
});

describe("registrar_entrega", () => {
  it("grava entrega e garantia (90 dias padrão) e finaliza uma OS pronta para retirada", async () => {
    cenario("PRONTO_PARA_RETIRADA");
    const r: any = await despachar("registrar_entrega", { os_id: OS, km_saida: 98462, proxima_revisao_km: 108450, proxima_revisao_data: "2027-04-16" }, gestao());
    expect(r).toMatchObject({ ok: true, dados: { etapa: "FINALIZADO", finalizada: true, garantia_ate: "2027-01-17", km_saida: 98462 } });
    expect(osRow()).toMatchObject({
      workflow_step: "FINALIZADO", km_saida: 98462, garantia_ate: "2027-01-17", proxima_revisao_km: 108450, proxima_revisao_data: "2027-04-16",
    });
    expect(new Date(osRow().entregue_em).getTime()).toBe(new Date("2026-10-19T08:00:00-03:00").getTime());
  });
  it("garantia_dias vem do argumento, da configuração ou zero (sem garantia)", async () => {
    cenario("PRONTO_PARA_RETIRADA");
    await despachar("registrar_entrega", { os_id: OS, km_saida: 1, garantia_dias: 30 }, dono());
    expect(osRow().garantia_ate).toBe("2026-11-18");
    db.tables.work_orders = [];
    cenario("PRONTO_PARA_RETIRADA");
    await despachar("registrar_entrega", { os_id: OS, km_saida: 1 }, ctx("dono", FONE_SIMONE, "u-simone", { documentos: { garantia_dias: 10 } }));
    expect(db.rows("work_orders").at(-1)!.garantia_ate).toBe("2026-10-29");
  });
  it("garantia_dias 0 → sem garantia (null)", async () => {
    cenario("PRONTO_PARA_RETIRADA");
    await despachar("registrar_entrega", { os_id: OS, km_saida: 5, garantia_dias: 0 }, gestao());
    expect(osRow().garantia_ate).toBeNull();
  });
  it("etapa que não é PRONTO_PARA_RETIRADA: registra a entrega e não mexe na etapa; CANCELADO → etapa_invalida", async () => {
    cenario("EM_EXECUCAO");
    const r: any = await despachar("registrar_entrega", { os_id: OS, km_saida: 10 }, gestao());
    expect(r).toMatchObject({ ok: true, dados: { etapa: "EM_EXECUCAO", finalizada: false } });
    expect(osRow().workflow_step).toBe("EM_EXECUCAO");
    db.tables.work_orders = [];
    cenario("CANCELADO");
    expect(await despachar("registrar_entrega", { os_id: OS, km_saida: 10 }, gestao())).toMatchObject({ erro: "etapa_invalida" });
  });
  it("entrega já registrada → conflito; dados ruins → dados_invalidos; pátio e cliente → sem_permissao", async () => {
    cenario("PRONTO_PARA_RETIRADA");
    expect(((await despachar("registrar_entrega", { os_id: OS, km_saida: 10 }, gestao())) as any).ok).toBe(true);
    expect(await despachar("registrar_entrega", { os_id: OS, km_saida: 11 }, gestao())).toMatchObject({ erro: "conflito", nao_diga_que_fez: true });
    expect(osRow().km_saida).toBe(10);
    db.tables.work_orders = [];
    cenario("PRONTO_PARA_RETIRADA");
    for (const a of [{ km_saida: -1 }, {}, { km_saida: 5, proxima_revisao_data: "breve" }, { km_saida: 5, garantia_dias: -3 }]) {
      expect(await despachar("registrar_entrega", { os_id: OS, ...a }, gestao())).toMatchObject({ erro: "dados_invalidos" });
    }
    expect(osRow().entregue_em).toBeUndefined();
    expect(await despachar("registrar_entrega", { os_id: OS, km_saida: 5 }, patio())).toMatchObject({ erro: "sem_permissao" });
    expect(await despachar("registrar_entrega", { os_id: OS, km_saida: 5 }, cliente())).toMatchObject({ erro: "sem_permissao" });
  });
  it("aceita o número da OS no lugar do id", async () => {
    cenario("PRONTO_PARA_RETIRADA");
    expect(((await despachar("registrar_entrega", { numero: 42, km_saida: 3 }, gestao())) as any).ok).toBe(true);
    expect(osRow().workflow_step).toBe("FINALIZADO");
  });
});

describe("número da OS", () => {
  it("abrir_os devolve o número sequencial por oficina", async () => {
    const a: any = await despachar("abrir_os", { placa: "ABC1D23", queixa: "x" }, patio());
    const b: any = await despachar("abrir_os", { placa: "XYZ9K88", queixa: "y" }, patio());
    expect(a.dados).toMatchObject({ numero: 1, numero_fmt: "0001" });
    expect(b.dados).toMatchObject({ numero: 2, numero_fmt: "0002" });
  });
  it("status_do_carro, ver_os e buscar trazem o número", async () => {
    cenario("EM_EXECUCAO");
    expect(((await despachar("status_do_carro", { placa: "ABC1D23" }, cliente())) as any).dados).toMatchObject({ numero: 42, numero_fmt: "0042" });
    expect(((await despachar("ver_os", { os_id: OS }, patio())) as any).dados).toMatchObject({ numero: 42, numero_fmt: "0042" });
    expect(((await despachar("buscar", { termo: "abc1" }, patio())) as any).dados.os[0]).toMatchObject({ os_id: OS, numero: 42, numero_fmt: "0042" });
  });
  it("buscar e ver_os aceitam 'OS 42', '42' e '0042'", async () => {
    cenario("EM_EXECUCAO");
    for (const termo of ["OS 42", "os42", "42", "0042", "OS-0042"]) {
      const r: any = await despachar("buscar", { termo }, patio());
      expect(r.dados.os.map((o: any) => o.os_id), termo).toEqual([OS]);
    }
    for (const id of ["42", "OS 42", "0042"]) {
      expect(((await despachar("ver_os", { os_id: id }, patio())) as any).dados.os_id, id).toBe(OS);
    }
    expect(((await despachar("ver_os", { numero: 42 }, gestao())) as any).dados.os_id).toBe(OS);
    expect(await despachar("ver_os", { os_id: "43" }, patio())).toMatchObject({ erro: "nao_encontrado" });
  });
  it("ver_os traz entrega e check-in novo; pátio continua sem dinheiro", async () => {
    cenario("FINALIZADO");
    Object.assign(osRow(), { entregue_em: "2026-10-16T20:10:00Z", km_saida: 98462, garantia_ate: "2027-01-17" });
    const r: any = await despachar("ver_os", { os_id: OS }, patio());
    expect(r.dados).toMatchObject({ km_saida: 98462, garantia_ate: "2027-01-17" });
    expect(r.dados.checkin).toMatchObject({ tem_estepe: true, estado_estepe: "bom", tem_macaco: true, tem_chave_roda: false, avarias: "risco na porta" });
    expect(chaves(r.dados).filter((k) => ["total_amount", "pricing", "unit_price"].includes(k))).toEqual([]);
  });
});

describe("registrar_checkin com estepe, macaco, chave e avarias", () => {
  const OSX = "0a1b2c3d-0000-4000-8000-0000000000aa";
  beforeEach(() => {
    db.rows("work_orders").push({ id: OSX, numero: 1, tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", workflow_step: "AGUARDANDO_CHECKIN", created_at: "2026-10-15T10:00:00Z" });
  });
  const base = { os_id: OSX, km: 1000, combustivel: "METADE" };
  it("grava os campos novos", async () => {
    const r: any = await despachar("registrar_checkin", { ...base, tem_estepe: true, estado_estepe: "meia-vida", tem_macaco: "sim", tem_chave_roda: false, avarias: "amassado no paralama" }, patio());
    expect(r.ok).toBe(true);
    expect(db.rows("work_order_checkins")[0]).toMatchObject({ tem_estepe: true, estado_estepe: "meia-vida", tem_macaco: true, tem_chave_roda: false, avarias: "amassado no paralama" });
  });
  it("sem os campos novos grava como antes (nulos)", async () => {
    await despachar("registrar_checkin", base, patio());
    expect(db.rows("work_order_checkins")[0]).toMatchObject({ km_current: 1000 });
    expect(db.rows("work_order_checkins")[0].tem_estepe ?? null).toBeNull();
  });
  it("valor ruim em tem_estepe → dados_invalidos e nada gravado", async () => {
    expect(await despachar("registrar_checkin", { ...base, tem_estepe: "talvez" }, patio())).toMatchObject({ erro: "dados_invalidos" });
    expect(db.rows("work_order_checkins")).toHaveLength(0);
  });
  it("migração ainda não aplicada: grava o check-in antigo e põe estepe/macaco/chave/avarias nos pertences", async () => {
    db.colunasInexistentes["work_order_checkins"] = ["tem_estepe", "estado_estepe", "tem_macaco", "tem_chave_roda", "avarias"];
    const r: any = await despachar("registrar_checkin", { ...base, pertences: "cadeirinha", tem_estepe: true, estado_estepe: "bom", tem_macaco: true, tem_chave_roda: false, avarias: "risco" }, patio());
    expect(r.ok).toBe(true);
    const ck = db.rows("work_order_checkins")[0];
    expect(ck.customer_items).toContain("cadeirinha");
    expect(ck.customer_items).toMatch(/estepe: sim \(bom\)/i);
    expect(ck.customer_items).toMatch(/macaco: sim/i);
    expect(ck.customer_items).toMatch(/chave de roda: não/i);
    expect(ck.customer_items).toMatch(/avarias: risco/i);
    expect(db.rows("work_orders")[0].workflow_step).toBe("CHECKIN_CONCLUIDO");
  });
});

describe("anexar_foto com legenda", () => {
  it("a legenda vai no nome do arquivo (de onde dados_documento a lê)", async () => {
    cenario("CHECKIN_CONCLUIDO");
    const b64 = Buffer.from("x").toString("base64");
    await despachar("anexar_foto", { os_id: OS, tipo: "CHECKIN_PHOTO", imagem_base64: b64, mime: "image/png", legenda: "Avaria na porta" }, patio());
    const novo = db.rows("attachments").at(-1)!;
    expect(novo.file_name).toMatch(/^checkin_photo__Avaria na porta__\d+\.png$/);
    const r: any = await despachar("dados_documento", { tipo: "ficha_entrada", os_id: OS }, gestao());
    expect(r.dados.fotos.at(-1)).toMatchObject({ legenda: "Avaria na porta", avaria: true });
  });
});
