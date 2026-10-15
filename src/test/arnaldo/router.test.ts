import { describe, it, expect, beforeEach } from "vitest";
import type { FakeDb } from "./fakeDb";
import { T, AGORA, FONE_A, FONE_SIMONE, FONE_MECANICO, NAO_ACHEI, TERCA_9, semear, mkCtx } from "./fixtures";
import { despachar, ACOES } from "../../../supabase/functions/_shared/arnaldo/router";
import { quemChama, type Ctx } from "../../../supabase/functions/_shared/arnaldo/db";
import type { Papel } from "../../../supabase/functions/_shared/arnaldo/roles";

let db: FakeDb;
const ctx = (papel: Papel, telefone: string | null, atorId: string | null = null): Ctx => mkCtx(db, papel, telefone, atorId);
const cliente = (fone = FONE_A) => ctx("cliente", fone);
const gestao = () => ctx("gestao", FONE_SIMONE, "u-simone");
const patio = () => ctx("patio", FONE_MECANICO, "u-mec");

beforeEach(() => { db = semear(); });

describe("quemChama", () => {
  it("resolve papel pelo telefone, em qualquer formato salvo", async () => {
    expect(await quemChama(db, T, FONE_SIMONE)).toEqual({ papel: "gestao", atorId: "u-simone", nome: "Simone" });
    expect((await quemChama(db, T, FONE_MECANICO)).papel).toBe("patio");
  });
  it("desconhecido, perfil inativo e SYSTEM", async () => {
    expect((await quemChama(db, T, FONE_A)).papel).toBe("cliente");
    expect(await quemChama(db, T, "5547999990003")).toEqual({ papel: "cliente", atorId: null, nome: null }); // inativo
    expect(await quemChama(db, T, "SYSTEM")).toEqual({ papel: "sistema", atorId: null, nome: null });
  });
});

describe("roteador", () => {
  it("1. ação desconhecida", async () => {
    const r: any = await despachar("nao_existe", {}, cliente());
    expect(r).toMatchObject({ ok: false, erro: "acao_desconhecida", nao_diga_que_fez: true });
  });
  it("2. cliente em ação de equipe → sem_permissao", async () => {
    const r: any = await despachar("agenda_do_dia", {}, cliente());
    expect(r).toMatchObject({ ok: false, erro: "sem_permissao", nao_diga_que_fez: true });
  });
  it("9. exceção dentro da ação → erro_interno que não diz que foi feito", async () => {
    db.falhaEm["customers"] = "boom";
    const r: any = await despachar("meus_dados", {}, cliente());
    expect(r).toMatchObject({ ok: false, erro: "erro_interno", nao_diga_que_fez: true });
    expect(r.mensagem).toContain("NÃO diga que foi feito");
  });
  it("args inválidos (não objeto) → dados_invalidos", async () => {
    const r: any = await despachar("quem_sou", "lixo", cliente());
    expect(r).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });
  it("10. `reason` e `caller` nos args não quebram nenhuma ação", async () => {
    for (const [nome, a] of Object.entries(ACOES)) {
      const c = a.papeis.includes("dono") ? ctx("dono", FONE_SIMONE, "u-simone") : cliente();
      const r: any = await despachar(nome, { reason: "porque sim", caller: { phone: "x" } }, c);
      // pode falhar por falta de dados do domínio, mas nunca por exceção
      if (!r.ok) expect(["dados_invalidos", "nao_encontrado", "sem_permissao"]).toContain(r.erro);
    }
  });
  it("sistema enxerga dinheiro", async () => {
    const r: any = await despachar("quem_sou", {}, ctx("sistema", "SYSTEM"));
    expect(r).toMatchObject({ ok: true, dados: { papel: "sistema", ve_dinheiro: true } });
  });
});

describe("identidade e cadastro", () => {
  it("quem_sou", async () => {
    expect(await despachar("quem_sou", {}, gestao())).toMatchObject({ ok: true, dados: { papel: "gestao", ve_dinheiro: true } });
    expect(await despachar("quem_sou", {}, cliente())).toMatchObject({ ok: true, dados: { papel: "cliente", ve_dinheiro: false } });
  });
  it("meus_dados: cliente com e sem cadastro", async () => {
    const r: any = await despachar("meus_dados", {}, cliente());
    expect(r.dados.cliente.nome).toBe("Ana Cliente");
    expect(r.dados.veiculos.map((v: any) => v.placa)).toEqual(["ABC1D23"]);
    const novo: any = await despachar("meus_dados", {}, cliente("5547977776666"));
    expect(novo).toEqual({ ok: true, dados: { cliente: null, veiculos: [] } });
  });
  it("3. cliente cadastra: o telefone é SEMPRE o do chamador", async () => {
    const r: any = await despachar("cadastrar_cliente_veiculo", {
      nome: "[TESTE] Carla", placa: "dev-4e56", marca: "Honda", modelo: "Fit", ano: 2020, telefone: "47 91234-5678",
    }, cliente("5547977776666"));
    expect(r.ok).toBe(true);
    expect(r.dados.criado).toBe(true);
    const c = db.rows("customers").find((x) => x.full_name === "[TESTE] Carla")!;
    expect(c.phone_number).toBe("47977776666");
    expect(c.tenant_id).toBe(T);
    expect(db.rows("vehicles").find((v) => v.plate === "DEV4E56")).toMatchObject({ customer_id: c.id, make: "Honda", tenant_id: T });
    expect(db.rows("customers").some((x) => x.phone_number.includes("91234"))).toBe(false);
  });
  it("equipe cadastra com o telefone informado; sem telefone → dados_invalidos", async () => {
    const ok: any = await despachar("cadastrar_cliente_veiculo", { nome: "[TESTE] Davi", placa: "DAV1D00", marca: "Fiat", modelo: "Mobi", telefone: "(47) 91234-5678" }, gestao());
    expect(ok.ok).toBe(true);
    expect(db.rows("customers").find((x) => x.full_name === "[TESTE] Davi")!.phone_number).toBe("47912345678");
    const sem: any = await despachar("cadastrar_cliente_veiculo", { nome: "[TESTE] Eva", placa: "EVA1A11", marca: "Fiat", modelo: "Mobi" }, gestao());
    expect(sem).toMatchObject({ ok: false, erro: "dados_invalidos" });
  });
  it("cliente existente + placa dele já cadastrada: idempotente, criado=false", async () => {
    const r: any = await despachar("cadastrar_cliente_veiculo", { nome: "Ana", placa: "ABC1D23", marca: "Fiat", modelo: "Uno" }, cliente());
    expect(r).toMatchObject({ ok: true, dados: { cliente_id: "c-a", veiculo_id: "v-a", criado: false } });
    expect(db.rows("vehicles")).toHaveLength(2);
  });
  it("placa de OUTRO cliente → conflito e nada é alterado", async () => {
    const antes = JSON.stringify(db.tables);
    const r: any = await despachar("cadastrar_cliente_veiculo", { nome: "Ana", placa: "XYZ-9K88", marca: "VW", modelo: "Gol" }, cliente());
    expect(r).toMatchObject({ ok: false, erro: "conflito", nao_diga_que_fez: true });
    expect(JSON.stringify(db.tables)).toBe(antes);
  });
  it("campos obrigatórios e placa inválida → dados_invalidos", async () => {
    expect(await despachar("cadastrar_cliente_veiculo", { nome: "", placa: "ABC1D23", marca: "x", modelo: "y" }, cliente())).toMatchObject({ erro: "dados_invalidos" });
    expect(await despachar("cadastrar_cliente_veiculo", { nome: "Z", placa: "123", marca: "x", modelo: "y" }, cliente())).toMatchObject({ erro: "dados_invalidos" });
  });
});

describe("status_do_carro", () => {
  it("4. placa de outro cliente = mesma resposta de placa inexistente", async () => {
    const outro: any = await despachar("status_do_carro", { placa: "XYZ9K88" }, cliente());
    const inexistente: any = await despachar("status_do_carro", { placa: "QQQ0Q00" }, cliente());
    expect(outro).toMatchObject({ ok: false, erro: "nao_encontrado", mensagem: NAO_ACHEI });
    expect(inexistente).toEqual(outro);
  });
  it("placa com hífen no banco é achada pela normalizada", async () => {
    db.rows("work_orders").push({ id: "wo-1", tenant_id: T, vehicle_id: "v-a", customer_id: "c-a", workflow_step: "EM_EXECUCAO", created_at: "2026-10-10T10:00:00Z", expected_delivery_date: "2026-10-22" });
    const r: any = await despachar("status_do_carro", { placa: "abc-1d23" }, cliente());
    expect(r.dados).toMatchObject({ placa: "ABC1D23", modelo: "Uno", etapa: "EM_EXECUCAO", etapa_texto: "em serviço", previsao_entrega: "2026-10-22" });
    expect(r.dados.link_orcamento).toBeUndefined();
  });
  it("5. AGUARDANDO_APROVACAO devolve link com token = 8 primeiros do id em maiúsculas, sem dinheiro", async () => {
    db.rows("work_orders").push({ id: "abcd1234-0000-4000-8000-000000000000", tenant_id: T, vehicle_id: "v-a", customer_id: "c-a", workflow_step: "AGUARDANDO_APROVACAO", total_amount: 912.5, created_at: "2026-10-10T10:00:00Z" });
    const r: any = await despachar("status_do_carro", { placa: "ABC1D23" }, cliente());
    expect(r.dados.link_orcamento).toBe("https://app.example.com/orcamento/abcd1234-0000-4000-8000-000000000000?token=ABCD1234");
    expect(JSON.stringify(r)).not.toContain("total_amount");
    expect(JSON.stringify(r)).not.toContain("912");
  });
  it("prefere a OS não finalizada; senão a última finalizada; senão sem OS", async () => {
    db.rows("work_orders").push(
      { id: "wo-old", tenant_id: T, vehicle_id: "v-a", workflow_step: "FINALIZADO", created_at: "2026-09-01T10:00:00Z" },
      { id: "wo-open", tenant_id: T, vehicle_id: "v-a", workflow_step: "EM_DIAGNOSTICO", created_at: "2026-10-01T10:00:00Z" },
      { id: "wo-new-done", tenant_id: T, vehicle_id: "v-a", workflow_step: "FINALIZADO", created_at: "2026-10-05T10:00:00Z" },
    );
    expect(((await despachar("status_do_carro", { placa: "ABC1D23" }, cliente())) as any).dados.etapa).toBe("EM_DIAGNOSTICO");
    db.tables.work_orders = db.rows("work_orders").filter((o) => o.id !== "wo-open");
    const r: any = await despachar("status_do_carro", { placa: "ABC1D23" }, cliente());
    expect(r.dados.etapa).toBe("FINALIZADO");
    db.tables.work_orders = [];
    expect(((await despachar("status_do_carro", { placa: "ABC1D23" }, cliente())) as any).dados.etapa).toBeNull();
  });
  it("equipe vê qualquer placa", async () => {
    const r: any = await despachar("status_do_carro", { placa: "XYZ9K88" }, patio());
    expect(r.ok).toBe(true);
  });
});

describe("agenda", () => {
  it("horarios_livres lista a grade com vagas", async () => {
    const r: any = await despachar("horarios_livres", { de: "2026-10-20" }, cliente());
    expect(r.dados.horarios.map((h: any) => h.inicio.slice(11, 16))).toEqual(["08:00", "09:00", "10:00", "11:00", "13:30", "14:30", "15:30"]);
    expect(r.dados.horarios[0].vagas).toBe(2);
  });
  it("horarios_livres limita a 14 dias e valida a data", async () => {
    const r: any = await despachar("horarios_livres", { de: "2026-10-20", ate: "2026-12-30" }, cliente());
    const ultimo = r.dados.horarios.at(-1).inicio.slice(0, 10);
    expect(ultimo <= "2026-11-03").toBe(true);
    expect(await despachar("horarios_livres", { de: "ontem" }, cliente())).toMatchObject({ erro: "dados_invalidos" });
  });
  it("7. agendar válido grava AGENDADO com tenant e ator", async () => {
    const r: any = await despachar("agendar", { placa: "ABC1D23", inicio: TERCA_9, motivo: "[TESTE] barulho" }, gestao());
    expect(r.ok).toBe(true);
    expect(db.rows("appointments")[0]).toMatchObject({ status: "AGENDADO", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", reason: "[TESTE] barulho", created_by: "u-simone" });
    expect(new Date(db.rows("appointments")[0].scheduled_at).getTime()).toBe(new Date(TERCA_9).getTime());
  });
  it("7b. cliente agenda o próprio carro (created_by nulo)", async () => {
    const r: any = await despachar("agendar", { placa: "ABC1D23", inicio: TERCA_9, motivo: "[TESTE] revisão" }, cliente());
    expect(r.ok).toBe(true);
    expect(db.rows("appointments")[0].created_by).toBeNull();
  });
  it("cliente não agenda carro de outro", async () => {
    const r: any = await despachar("agendar", { placa: "XYZ9K88", inicio: TERCA_9, motivo: "x" }, cliente());
    expect(r).toMatchObject({ ok: false, erro: "nao_encontrado", mensagem: NAO_ACHEI });
    expect(db.rows("appointments")).toHaveLength(0);
  });
  it("6. horário lotado → conflito_agenda com alternativas do dia", async () => {
    for (let i = 0; i < 2; i++) db.rows("appointments").push({ id: `ap${i}`, tenant_id: T, vehicle_id: "v-b", customer_id: "c-b", scheduled_at: TERCA_9, status: "AGENDADO" });
    const r: any = await despachar("agendar", { placa: "ABC1D23", inicio: TERCA_9, motivo: "x" }, cliente());
    expect(r).toMatchObject({ ok: false, erro: "conflito_agenda", nao_diga_que_fez: true });
    expect(r.mensagem).toContain("08:00");
    expect(r.mensagem).not.toContain("09:00");
    expect(db.rows("appointments")).toHaveLength(2);
  });
  it("cancelados/remarcados não ocupam vaga", async () => {
    for (const s of ["CANCELADO", "REMARCADO", "AGENDADO"]) db.rows("appointments").push({ id: s, tenant_id: T, scheduled_at: TERCA_9, status: s });
    const r: any = await despachar("horarios_livres", { de: "2026-10-20" }, cliente());
    expect(r.dados.horarios.find((h: any) => h.inicio === TERCA_9).vagas).toBe(1);
  });
  it("horário fora da grade ou no passado → conflito_agenda", async () => {
    expect(await despachar("agendar", { placa: "ABC1D23", inicio: "2026-10-20T09:15:00-03:00", motivo: "x" }, cliente())).toMatchObject({ erro: "conflito_agenda" });
    expect(await despachar("agendar", { placa: "ABC1D23", inicio: "2026-10-18T09:00:00-03:00", motivo: "x" }, cliente())).toMatchObject({ erro: "conflito_agenda" });
  });
  it("meus_agendamentos: só AGENDADO futuros do próprio cliente", async () => {
    db.rows("appointments").push(
      { id: "a1", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: TERCA_9, status: "AGENDADO", reason: "freio" },
      { id: "a2", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: "2026-10-21T09:00:00-03:00", status: "CANCELADO", reason: "x" },
      { id: "a3", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: "2026-10-01T09:00:00-03:00", status: "AGENDADO", reason: "velho" },
      { id: "a4", tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", scheduled_at: TERCA_9, status: "AGENDADO", reason: "do outro" },
    );
    const r: any = await despachar("meus_agendamentos", {}, cliente());
    expect(r.dados).toEqual([{ id: "a1", inicio: "2026-10-20T09:00:00-03:00", placa: "ABC1D23", motivo: "freio" }]);
  });
  it("remarcar: antigo vira REMARCADO e nasce um novo AGENDADO", async () => {
    db.rows("appointments").push({ id: "a1", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: TERCA_9, status: "AGENDADO", reason: "freio" });
    const r: any = await despachar("remarcar", { agendamento_id: "a1", novo_inicio: "2026-10-21T10:00:00-03:00" }, cliente());
    expect(r.ok).toBe(true);
    expect(db.rows("appointments").find((a) => a.id === "a1")!.status).toBe("REMARCADO");
    const novo = db.rows("appointments").find((a) => a.id === r.dados.agendamento_id)!;
    expect(novo).toMatchObject({ status: "AGENDADO", reason: "freio", vehicle_id: "v-a", customer_id: "c-a" });
  });
  it("remarcar/cancelar agendamento de outro cliente → nao_encontrado", async () => {
    db.rows("appointments").push({ id: "a4", tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", scheduled_at: TERCA_9, status: "AGENDADO", reason: "x" });
    expect(await despachar("remarcar", { agendamento_id: "a4", novo_inicio: "2026-10-21T10:00:00-03:00" }, cliente())).toMatchObject({ erro: "nao_encontrado" });
    expect(await despachar("cancelar_agendamento", { agendamento_id: "a4" }, cliente())).toMatchObject({ erro: "nao_encontrado" });
    expect(db.rows("appointments")[0].status).toBe("AGENDADO");
  });
  it("remarcar para horário lotado → conflito_agenda e o antigo fica como estava", async () => {
    db.rows("appointments").push({ id: "a1", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: TERCA_9, status: "AGENDADO", reason: "x" });
    for (let i = 0; i < 2; i++) db.rows("appointments").push({ id: `o${i}`, tenant_id: T, scheduled_at: "2026-10-21T10:00:00-03:00", status: "AGENDADO" });
    expect(await despachar("remarcar", { agendamento_id: "a1", novo_inicio: "2026-10-21T10:00:00-03:00" }, cliente())).toMatchObject({ erro: "conflito_agenda" });
    expect(db.rows("appointments").find((a) => a.id === "a1")!.status).toBe("AGENDADO");
  });
  it("cancelar guarda o motivo em notes", async () => {
    db.rows("appointments").push({ id: "a1", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: TERCA_9, status: "AGENDADO", reason: "x" });
    const r: any = await despachar("cancelar_agendamento", { agendamento_id: "a1", motivo: "viajei" }, cliente());
    expect(r).toEqual({ ok: true, dados: { ok: true } });
    expect(db.rows("appointments")[0].status).toBe("CANCELADO");
    expect(db.rows("appointments")[0].notes).toContain("viajei");
  });
  it("agenda_do_dia: do dia + NAO_COMPARECEU dos 3 dias anteriores, com cliente e carro", async () => {
    db.rows("appointments").push(
      { id: "hoje", tenant_id: T, customer_id: "c-a", vehicle_id: "v-a", scheduled_at: "2026-10-19T09:00:00-03:00", status: "AGENDADO", reason: "freio" },
      { id: "amanha", tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", scheduled_at: "2026-10-20T09:00:00-03:00", status: "AGENDADO", reason: "x" },
      { id: "faltou", tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", scheduled_at: "2026-10-17T09:00:00-03:00", status: "NAO_COMPARECEU", reason: "y" },
      { id: "faltou-velho", tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", scheduled_at: "2026-10-10T09:00:00-03:00", status: "NAO_COMPARECEU", reason: "z" },
      { id: "cancel", tenant_id: T, customer_id: "c-b", vehicle_id: "v-b", scheduled_at: "2026-10-19T10:00:00-03:00", status: "CANCELADO", reason: "z" },
    );
    const r: any = await despachar("agenda_do_dia", {}, patio());
    expect(r.dados.map((a: any) => a.id)).toEqual(["faltou", "hoje"]);
    expect(r.dados[1]).toMatchObject({ cliente: "Ana Cliente", placa: "ABC1D23", modelo: "Uno", status: "AGENDADO", motivo: "freio" });
  });
});
