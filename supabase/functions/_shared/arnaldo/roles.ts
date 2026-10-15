export type Papel = "cliente" | "patio" | "gestao" | "dono" | "sistema";
const ORDEM: Record<string, Papel> = { ADMIN: "dono", MANAGER: "gestao", MECHANIC: "patio", PATIO: "patio" };
const PESO: Record<Papel, number> = { cliente: 0, patio: 1, gestao: 2, dono: 3, sistema: 4 };

export function papelDeRoles(roles: string[], ativo: boolean): Papel {
  if (!ativo) return "cliente";
  let melhor: Papel = "cliente";
  for (const r of roles) {
    const p = ORDEM[r];
    if (p && PESO[p] > PESO[melhor]) melhor = p;
  }
  return melhor;
}
export const veDinheiro = (p: Papel) => p === "dono" || p === "gestao" || p === "sistema";
export const ehEquipe = (p: Papel) => p !== "cliente";
