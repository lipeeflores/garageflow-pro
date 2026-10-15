// Atendimento HTTP da arnaldo-api, sem importar nada de Deno/esm.sh: o index.ts injeta as dependências.
import { comparacaoConstante, verifyCaller } from "./caller.ts";
import { quemChama, type Ctx, type Db } from "./db.ts";
import { normalizeBrPhone } from "./phone.ts";
import { despachar, falha } from "./router.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-arnaldo-token",
};
const SLUG = "md-mecanica";

export interface Deps {
  env: (nome: string) => string | undefined;
  db: () => Db;
  agora?: () => Date;
  versao: string;
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export async function atender(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("saude") === "1") {
    return json({ ok: true, versao: deps.versao }); // sem token e sem tocar no banco
  }
  if (req.method !== "POST") return json(falha("acao_desconhecida", "Use POST."), 405);

  // Porta de serviço: sem o segredo configurado no servidor ou sem o cabeçalho certo, ninguém entra.
  const esperado = deps.env("ARNALDO_API_TOKEN") ?? "";
  const recebido = req.headers.get("x-arnaldo-token") ?? "";
  if (!esperado || !recebido || !comparacaoConstante(esperado, recebido)) {
    return json(falha("token_invalido", "Token de serviço ausente ou inválido."), 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(falha("dados_invalidos", "O corpo da chamada não é um JSON válido."));
  }
  if (!body || typeof body !== "object") return json(falha("dados_invalidos", "O corpo da chamada não é um JSON válido."));

  const agora = deps.agora?.() ?? new Date();
  const who = await verifyCaller(body.caller, deps.env("ARNALDO_CALLER_SECRET") ?? "", agora.getTime());
  if (!who) return json(falha("assinatura_invalida", "Não consegui confirmar quem está falando. Não foi feito nada."));

  try {
    const db = deps.db();
    const { data: tenant, error } = await db.from("tenants").select("id, settings").eq("slug", SLUG).maybeSingle();
    if (error || !tenant) throw new Error(`tenant ${SLUG}: ${error?.message ?? "não encontrado"}`);

    const telefone = who.phone === "SYSTEM" ? "SYSTEM" : (normalizeBrPhone(who.phone) ?? who.phone);
    const { papel, atorId } = await quemChama(db, tenant.id, telefone);
    const ctx: Ctx = {
      db, tenantId: tenant.id, papel, atorId, telefone: telefone === "SYSTEM" ? null : telefone, agora,
      appPublicUrl: (deps.env("ARNALDO_APP_URL") ?? "").replace(/\/+$/, ""), tenantSettings: tenant.settings,
    };
    const acao = typeof body.acao === "string" ? body.acao : "";
    return json(await despachar(acao, body.args ?? {}, ctx));
  } catch (e) {
    console.error("arnaldo-api: falha geral:", e);
    return json(falha("erro_interno", "O sistema da oficina falhou agora. NÃO diga que foi feito; avise que vai verificar com a equipe."));
  }
}
