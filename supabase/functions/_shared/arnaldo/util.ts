// Utilidades compartilhadas pelas ações. Sem imports de esm.sh: roda em Deno e em Node (vitest).
import type { Ctx } from "./db.ts";
import type { Papel } from "./roles.ts";
import { normalizeBrPhone } from "./phone.ts";
import { formatarLocal, horariosLivres, parseIso, regraAgenda } from "./agenda.ts";

export class ErroArnaldo extends Error {
  constructor(public codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroArnaldo";
  }
}

export type Args = Record<string, unknown>;
export type Acao = { papeis: Papel[]; run: (args: Args, ctx: Ctx) => Promise<unknown> };

export const TODOS: Papel[] = ["cliente", "patio", "gestao", "dono", "sistema"];
export const CLIENTE_E_EQUIPE: Papel[] = ["cliente", "patio", "gestao", "dono"];
export const EQUIPE: Papel[] = ["patio", "gestao", "dono"];
export const EQUIPE_E_SISTEMA: Papel[] = ["patio", "gestao", "dono", "sistema"];
export const GESTAO: Papel[] = ["gestao", "dono"];

export const NAO_ACHEI = "Não achei esse carro no cadastro deste número.";
const DIA_MS = 24 * 3600_000;
const OFFSET_MS = 3 * 3600_000;
const MIN_MS = 60_000;

export const invalido = (msg: string) => new ErroArnaldo("dados_invalidos", msg);

/** Desembrulha `{data, error}` do supabase-js; erro de banco vira exceção (→ erro_interno). */
export function ok<T = any>(res: { data: T; error: { message: string } | null }, onde: string): T {
  if (res.error) throw new Error(`${onde}: ${res.error.message}`);
  return res.data;
}

export function placaNorm(x: unknown): string {
  return String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function exigirPlaca(x: unknown): string {
  const p = placaNorm(x);
  if (p.length !== 7) throw invalido("Placa inválida: precisa ter 7 caracteres (ex.: ABC1D23).");
  return p;
}

export function texto(args: Args, campo: string, opts: { obrig?: boolean; max?: number } = {}): string | undefined {
  const { obrig = true, max = 1000 } = opts;
  const v = args[campo];
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    if (obrig) throw invalido(`Falta o campo "${campo}".`);
    return undefined;
  }
  if (typeof v !== "string" && typeof v !== "number") throw invalido(`O campo "${campo}" precisa ser texto.`);
  const s = String(v).trim();
  if (s.length > max) throw invalido(`O campo "${campo}" é longo demais (máximo ${max} caracteres).`);
  return s;
}

export function inteiro(args: Args, campo: string, opts: { obrig?: boolean; min?: number; max?: number } = {}): number | undefined {
  const { obrig = true, min = -Infinity, max = Infinity } = opts;
  const v = args[campo];
  if (v === undefined || v === null || v === "") {
    if (obrig) throw invalido(`Falta o campo "${campo}".`);
    return undefined;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw invalido(`O campo "${campo}" precisa ser um número inteiro entre ${min} e ${max}.`);
  return n;
}

/** Número (aceita "12,50"). `valorMin` é exclusivo quando `positivo`. Arredonda para centavos. */
export function dinheiro(v: unknown, campo: string, opts: { obrig?: boolean; positivo?: boolean } = {}): number | undefined {
  const { obrig = true, positivo = true } = opts;
  if (v === undefined || v === null || v === "") {
    if (obrig) throw invalido(`Falta o campo "${campo}".`);
    return undefined;
  }
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim().replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || (positivo ? n <= 0 : n < 0) || n > 10_000_000) {
    throw invalido(`O campo "${campo}" precisa ser um valor em reais ${positivo ? "maior que zero" : "válido"}.`);
  }
  return Math.round(n * 100) / 100;
}

export function booleano(args: Args, campo: string): boolean {
  const v = args[campo];
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  throw invalido(`O campo "${campo}" precisa ser true ou false.`);
}

export function escolha<T extends string>(args: Args, campo: string, validos: readonly T[], obrig = true): T | undefined {
  const v = args[campo];
  if (v === undefined || v === null || v === "") {
    if (obrig) throw invalido(`Falta o campo "${campo}" (${validos.join(", ")}).`);
    return undefined;
  }
  const s = String(v).trim().toUpperCase() as T;
  if (!validos.includes(s)) throw invalido(`Valor inválido em "${campo}". Use: ${validos.join(", ")}.`);
  return s;
}

/** Cliente (customers) cujo telefone normalizado é igual ao canônico. `phone_number` é texto livre. */
export async function clientePorTelefone(ctx: Ctx, canon: string | null) {
  if (!canon) return null;
  const rapido = ok(
    await ctx.db.from("customers").select("*").eq("tenant_id", ctx.tenantId).in("phone_number", [canon, canon.slice(2)]).limit(1),
    "customers",
  );
  if (rapido && rapido.length) return rapido[0];
  const todos = ok(await ctx.db.from("customers").select("*").eq("tenant_id", ctx.tenantId).limit(5000), "customers");
  return (todos ?? []).find((c: any) => normalizeBrPhone(c.phone_number) === canon) ?? null;
}

/** O cliente do telefone de quem chamou (para papel cliente). */
export const clienteDoChamador = (ctx: Ctx) => clientePorTelefone(ctx, normalizeBrPhone(ctx.telefone));

/** vehicles.plate pode ter hífen: busca por ilike e confere a igualdade normalizada em JS. */
export async function veiculoPorPlaca(ctx: Ctx, placa: string) {
  const p = placaNorm(placa);
  const rows = ok(
    await ctx.db.from("vehicles").select("*").eq("tenant_id", ctx.tenantId).ilike("plate", `%${p.slice(0, 3)}%${p.slice(3)}%`).limit(20),
    "vehicles",
  );
  return (rows ?? []).find((v: any) => placaNorm(v.plate) === p) ?? null;
}

/**
 * Veículo para o chamador. Cliente só enxerga o dele; "não existe" e "é de outro" dão a MESMA resposta,
 * para não vazar a existência de placas.
 */
export async function veiculoDoChamador(ctx: Ctx, placaBruta: unknown) {
  const placa = exigirPlaca(placaBruta);
  const v = await veiculoPorPlaca(ctx, placa);
  if (ctx.papel === "cliente") {
    const c = v ? await clienteDoChamador(ctx) : null;
    if (!v || !c || v.customer_id !== c.id) throw new ErroArnaldo("nao_encontrado", NAO_ACHEI);
    return v;
  }
  if (!v) throw new ErroArnaldo("nao_encontrado", "Não achei essa placa no cadastro da oficina.");
  return v;
}

// ---------- datas locais (São Paulo, offset fixo -03:00) ----------
export const inicioDoDiaLocal = (ms: number) => Math.floor((ms - OFFSET_MS) / DIA_MS) * DIA_MS + OFFSET_MS;
export const diaLocal = (ms: number) => formatarLocal(ms).slice(0, 10);

export function dataObrigatoria(v: unknown, campo: string): number {
  const s = typeof v === "string" ? v.trim().slice(0, 10) : "";
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseIso(s) : NaN;
  if (!Number.isFinite(ms)) throw invalido(`O campo "${campo}" precisa ser uma data no formato AAAA-MM-DD.`);
  return ms;
}

export function instante(v: unknown, campo: string): number {
  const s = typeof v === "string" ? v.trim() : "";
  const ms = s ? parseIso(s) : NaN;
  if (!Number.isFinite(ms)) throw invalido(`O campo "${campo}" precisa ser data e hora ISO (ex.: 2026-10-20T09:00:00-03:00).`);
  return Math.floor(ms / MIN_MS) * MIN_MS;
}

// ---------- agenda ----------
export async function ocupadosEntre(ctx: Ctx, deMs: number, ateMs: number): Promise<string[]> {
  const rows = ok(
    await ctx.db.from("appointments").select("scheduled_at")
      .eq("tenant_id", ctx.tenantId).in("status", ["AGENDADO", "CHEGOU"])
      .gte("scheduled_at", formatarLocal(deMs)).lt("scheduled_at", formatarLocal(ateMs)).limit(5000),
    "appointments",
  );
  return (rows ?? []).map((r: any) => String(r.scheduled_at));
}

/** Confere a vaga naquele minuto; se não houver, `conflito_agenda` listando até 3 horários livres do mesmo dia. */
export async function garantirVaga(ctx: Ctx, inicioMs: number): Promise<void> {
  const regra = regraAgenda(ctx.tenantSettings);
  const agora = formatarLocal(ctx.agora.getTime());
  const ocup = await ocupadosEntre(ctx, inicioMs, inicioMs + MIN_MS);
  if (horariosLivres(regra, formatarLocal(inicioMs), formatarLocal(inicioMs + MIN_MS), ocup, agora).length > 0) return;

  const d0 = inicioDoDiaLocal(inicioMs);
  const ocupDia = await ocupadosEntre(ctx, d0, d0 + DIA_MS);
  const alt = horariosLivres(regra, formatarLocal(d0), formatarLocal(d0 + DIA_MS), ocupDia, agora).slice(0, 3);
  const lista = alt.map((h) => h.inicio.slice(11, 16)).join(", ");
  throw new ErroArnaldo(
    "conflito_agenda",
    alt.length ? `Esse horário não está disponível. Horários livres no mesmo dia: ${lista}.` : "Esse horário não está disponível e não há outros horários livres nesse dia.",
  );
}
