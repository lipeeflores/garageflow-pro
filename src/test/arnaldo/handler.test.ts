import { describe, it, expect, beforeEach } from "vitest";
import { T, AGORA, FONE_A, FONE_SIMONE, semear } from "./fixtures";
import type { FakeDb } from "./fakeDb";
import { atender, type Deps } from "../../../supabase/functions/_shared/arnaldo/handler";
import { signCaller } from "../../../supabase/functions/_shared/arnaldo/caller";

const TOKEN = "token-de-servico";
const SEGREDO = "segredo-do-chamador";
const URL_API = "https://x.supabase.co/functions/v1/arnaldo-api";

let db: FakeDb;
let tocouNoBanco: boolean;
const ENV: Record<string, string> = { ARNALDO_API_TOKEN: TOKEN, ARNALDO_CALLER_SECRET: SEGREDO, ARNALDO_APP_URL: "https://app.example.com" };

function deps(over: Partial<Deps> = {}): Deps {
  return { env: (k) => ENV[k], db: () => { tocouNoBanco = true; return db; }, agora: () => AGORA, versao: "teste-1", ...over };
}

async function chamar(corpo: unknown, opts: { token?: string | null; deps?: Deps } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token !== null) headers["x-arnaldo-token"] = opts.token ?? TOKEN;
  const res = await atender(new Request(URL_API, { method: "POST", headers, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }), opts.deps ?? deps());
  return { status: res.status, json: await res.json() as any };
}

const assinar = (phone: string, ts = AGORA.getTime()) => signCaller(phone, "sess-1", ts, SEGREDO);

beforeEach(() => { db = semear(); tocouNoBanco = false; });

describe("saúde", () => {
  it("GET ?saude=1 responde a versão, sem token e sem tocar no banco", async () => {
    const res = await atender(new Request(`${URL_API}?saude=1`), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, versao: "teste-1" });
    expect(tocouNoBanco).toBe(false);
  });
  it("OPTIONS devolve CORS; GET sem saude e outros métodos → 405", async () => {
    const op = await atender(new Request(URL_API, { method: "OPTIONS" }), deps());
    expect(op.status).toBe(200);
    expect(op.headers.get("access-control-allow-headers")).toContain("x-arnaldo-token");
    expect((await atender(new Request(URL_API), deps())).status).toBe(405);
    expect((await atender(new Request(URL_API, { method: "PUT", body: "{}" }), deps())).status).toBe(405);
  });
});

describe("porta fechada", () => {
  it("POST sem token → 401 token_invalido, sem tocar no banco", async () => {
    const r = await chamar({ acao: "quem_sou" }, { token: null });
    expect(r.status).toBe(401);
    expect(r.json).toMatchObject({ ok: false, erro: "token_invalido", nao_diga_que_fez: true });
    expect(tocouNoBanco).toBe(false);
  });
  it("token errado → 401; token do servidor não configurado → 401 mesmo com cabeçalho vazio", async () => {
    expect((await chamar({ acao: "quem_sou" }, { token: "outro" })).status).toBe(401);
    const semConfig = deps({ env: (k) => (k === "ARNALDO_API_TOKEN" ? undefined : ENV[k]) });
    expect((await chamar({ acao: "quem_sou" }, { token: "", deps: semConfig })).status).toBe(401);
    expect((await chamar({ acao: "quem_sou" }, { token: "undefined", deps: semConfig })).status).toBe(401);
  });
});

describe("chamador assinado", () => {
  it("sem caller, assinatura errada ou expirada → assinatura_invalida (HTTP 200)", async () => {
    const sem = await chamar({ acao: "quem_sou", args: {} });
    expect(sem).toMatchObject({ status: 200, json: { ok: false, erro: "assinatura_invalida" } });
    const falsa = { ...(await assinar(FONE_SIMONE)), phone: "5547999999999" };
    expect((await chamar({ acao: "quem_sou", caller: falsa })).json.erro).toBe("assinatura_invalida");
    const velha = await assinar(FONE_SIMONE, AGORA.getTime() - 10 * 60_000);
    expect((await chamar({ acao: "quem_sou", caller: velha })).json.erro).toBe("assinatura_invalida");
    expect(tocouNoBanco).toBe(false);
  });
  it("sem o segredo do chamador configurado, nada passa", async () => {
    const d = deps({ env: (k) => (k === "ARNALDO_CALLER_SECRET" ? undefined : ENV[k]) });
    const r = await chamar({ acao: "quem_sou", caller: await assinar(FONE_SIMONE) }, { deps: d });
    expect(r.json.erro).toBe("assinatura_invalida");
  });
});

describe("fluxo completo", () => {
  it("telefone da equipe → papel pelo banco; desconhecido → cliente; SYSTEM → sistema", async () => {
    const g = await chamar({ acao: "quem_sou", args: { reason: "x" }, caller: await assinar("5547999990001") });
    expect(g.json).toMatchObject({ ok: true, dados: { papel: "gestao", nome: "Simone", ve_dinheiro: true } });
    const c = await chamar({ acao: "quem_sou", caller: await assinar(FONE_A) });
    expect(c.json).toMatchObject({ ok: true, dados: { papel: "cliente", ve_dinheiro: false } });
    const s = await chamar({ acao: "quem_sou", caller: await assinar("SYSTEM") });
    expect(s.json).toMatchObject({ ok: true, dados: { papel: "sistema" } });
  });
  it("a identidade sai do telefone assinado, nunca dos args: cliente fingindo ser equipe leva sem_permissao", async () => {
    const r = await chamar({ acao: "agenda_do_dia", args: { papel: "dono", telefone: FONE_SIMONE }, caller: await assinar(FONE_A) });
    expect(r.json).toMatchObject({ ok: false, erro: "sem_permissao" });
  });
  it("telefone em formato cru (com 55 sem o 9) é normalizado antes de decidir o papel", async () => {
    const r = await chamar({ acao: "quem_sou", caller: await assinar("554799990001@s.whatsapp.net") });
    // 12 dígitos com 55 e sem o 9 de celular → normaliza para 5547999990001, o número da Simone
    expect(r.json.dados.papel).toBe("gestao");
  });
  it("ação desconhecida, corpo que não é JSON e tenant ausente", async () => {
    expect((await chamar({ acao: "faz_tudo", caller: await assinar(FONE_A) })).json.erro).toBe("acao_desconhecida");
    expect((await chamar("isto não é json")).json).toMatchObject({ ok: false, erro: "dados_invalidos" });
    expect((await chamar({ caller: await assinar(FONE_A) })).json.erro).toBe("acao_desconhecida");
    db.tables.tenants = [];
    const r = await chamar({ acao: "quem_sou", caller: await assinar(FONE_A) });
    expect(r.json).toMatchObject({ ok: false, erro: "erro_interno", nao_diga_que_fez: true });
  });
  it("usa o slug md-mecanica e as settings de agenda do tenant", async () => {
    db.rows("tenants")[0].settings = { arnaldo_agenda: { carros_por_horario: 5 } };
    const r = await chamar({ acao: "horarios_livres", args: { de: "2026-10-20" }, caller: await assinar(FONE_A) });
    expect(r.json.dados.horarios[0].vagas).toBe(5);
  });
  it("o tenant de outro slug é ignorado", async () => {
    db.rows("tenants").unshift({ id: "outro", slug: "outra-oficina", settings: { arnaldo_agenda: { carros_por_horario: 9 } } });
    const r = await chamar({ acao: "horarios_livres", args: { de: "2026-10-20" }, caller: await assinar(FONE_A) });
    expect(r.json.dados.horarios[0].vagas).toBe(2);
    expect(T).toBe("tenant-1");
  });
});
