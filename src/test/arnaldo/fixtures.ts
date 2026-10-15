import { FakeDb } from "./fakeDb";
import type { Ctx } from "../../../supabase/functions/_shared/arnaldo/db";
import type { Papel } from "../../../supabase/functions/_shared/arnaldo/roles";

export const T = "tenant-1";
export const AGORA = new Date("2026-10-19T08:00:00-03:00"); // segunda-feira

export const FONE_A = "5547984889108"; // cliente A
export const FONE_SIMONE = "5547999990001";
export const FONE_MECANICO = "5547999990002";
export const NAO_ACHEI = "Não achei esse carro no cadastro deste número.";
export const TERCA_9 = "2026-10-20T09:00:00-03:00";

export function semear() {
  return new FakeDb(
    {
      tenants: [{ id: T, slug: "md-mecanica", settings: {} }],
      profiles: [
        { id: "u-simone", tenant_id: T, full_name: "Simone", phone: "(47) 99999-0001", is_active: true },
        { id: "u-mec", tenant_id: T, full_name: "Joao Mecanico", phone: "47 99999-0002", is_active: true },
        { id: "u-joana", tenant_id: T, full_name: "Joana Mecanica", phone: null, is_active: true },
        { id: "u-off", tenant_id: T, full_name: "Ex Gerente", phone: "47 99999-0003", is_active: false },
      ],
      user_roles: [
        { user_id: "u-simone", tenant_id: T, role: "MANAGER" },
        { user_id: "u-mec", tenant_id: T, role: "MECHANIC" },
        { user_id: "u-joana", tenant_id: T, role: "MECHANIC" },
        { user_id: "u-off", tenant_id: T, role: "MANAGER" },
      ],
      customers: [
        { id: "c-a", tenant_id: T, full_name: "Ana Cliente", phone_number: "(47) 98488-9108" },
        { id: "c-b", tenant_id: T, full_name: "Bruno Cliente", phone_number: "47911112222" },
      ],
      vehicles: [
        { id: "v-a", tenant_id: T, customer_id: "c-a", plate: "ABC-1D23", make: "Fiat", model: "Uno", year: 2015, color: "prata" },
        { id: "v-b", tenant_id: T, customer_id: "c-b", plate: "XYZ9K88", make: "VW", model: "Gol" },
      ],
      work_orders: [],
      appointments: [],
    },
    {
      customers: [["tenant_id", "phone_number"]],
      vehicles: [["tenant_id", "plate"]],
      work_order_checkins: [["work_order_id"]],
    },
  );
}

export function mkCtx(db: FakeDb, papel: Papel, telefone: string | null, atorId: string | null = null): Ctx {
  return { db, tenantId: T, papel, atorId, telefone, agora: AGORA, appPublicUrl: "https://app.example.com", tenantSettings: {} };
}
