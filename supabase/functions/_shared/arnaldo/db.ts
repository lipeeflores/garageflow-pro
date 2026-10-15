// O roteador recebe o cliente Supabase já criado (service role); nos testes, um falso.
import { normalizeBrPhone } from "./phone.ts";
import { papelDeRoles, type Papel } from "./roles.ts";

export type Db = any; // SupabaseClient; `any` para não puxar esm.sh no vitest

export interface Ctx {
  db: Db;
  tenantId: string;
  papel: Papel;
  atorId: string | null;
  telefone: string | null;
  agora: Date;
  appPublicUrl: string;
  tenantSettings: unknown;
}

const PESO: Record<Papel, number> = { cliente: 0, patio: 1, gestao: 2, dono: 3, sistema: 4 };

/** SYSTEM → sistema. Senão cruza profiles.phone (texto livre, normalizado em JS) com user_roles. Sem match → cliente. */
export async function quemChama(
  db: Db, tenantId: string, phone: string,
): Promise<{ papel: Papel; atorId: string | null; nome: string | null }> {
  if (phone === "SYSTEM") return { papel: "sistema", atorId: null, nome: null };
  const canon = normalizeBrPhone(phone);
  const cliente = { papel: "cliente" as Papel, atorId: null, nome: null };
  if (!canon) return cliente;

  const { data: perfis, error } = await db
    .from("profiles").select("id, full_name, phone, is_active").eq("tenant_id", tenantId).limit(2000);
  if (error) throw new Error(`profiles: ${error.message}`);
  const meus = (perfis ?? []).filter((p: any) => normalizeBrPhone(p.phone) === canon);
  if (meus.length === 0) return cliente;

  const { data: roles, error: e2 } = await db
    .from("user_roles").select("user_id, role").eq("tenant_id", tenantId).in("user_id", meus.map((p: any) => p.id));
  if (e2) throw new Error(`user_roles: ${e2.message}`);

  let melhor: { papel: Papel; atorId: string | null; nome: string | null } = cliente;
  for (const p of meus) {
    const rs = (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => String(r.role));
    const papel = papelDeRoles(rs, p.is_active !== false);
    if (PESO[papel] > PESO[melhor.papel]) melhor = { papel, atorId: p.id, nome: p.full_name ?? null };
  }
  return melhor;
}
