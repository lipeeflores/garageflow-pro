import { describe, it, expect } from "vitest";
import { normalizeBrPhone } from "../../../supabase/functions/_shared/arnaldo/phone";
import { verifyCaller, signCaller } from "../../../supabase/functions/_shared/arnaldo/caller";
import { papelDeRoles, veDinheiro } from "../../../supabase/functions/_shared/arnaldo/roles";
import { semDinheiro } from "../../../supabase/functions/_shared/arnaldo/money";

describe("normalizeBrPhone", () => {
  it.each([
    ["+55 (47) 98488-9108", "5547984889108"],
    ["47 8488-9108", "5547984889108"],      // celular sem o 9 → acrescenta
    ["554784889108", "5547984889108"],      // 12 dígitos com 55, sem o 9
    ["5547984889108", "5547984889108"],
    ["(47) 3368-1234", "554733681234"],     // fixo (começa com 2-5) fica com 8 dígitos
    ["5547984889108@s.whatsapp.net", "5547984889108"],
    ["", null], [null, null], ["123", null],
  ])("%s → %s", (raw, esperado) => expect(normalizeBrPhone(raw as any)).toBe(esperado));
});

describe("verifyCaller", () => {
  const segredo = "s3gr3d0";
  it("aceita envelope válido dentro de 5 min", async () => {
    const env = await signCaller("5547984889108", "sess1", 1_000_000, segredo);
    expect(await verifyCaller(env, segredo, 1_000_000 + 299_000)).toEqual({ phone: "5547984889108", sessionId: "sess1" });
  });
  it("recusa fora da janela, assinatura errada e lixo", async () => {
    const env = await signCaller("5547984889108", "sess1", 1_000_000, segredo);
    expect(await verifyCaller(env, segredo, 1_000_000 + 301_000)).toBeNull();
    expect(await verifyCaller({ ...env, phone: "5547999999999" }, segredo, 1_000_000)).toBeNull();
    expect(await verifyCaller(null, segredo, 1)).toBeNull();
    expect(await verifyCaller(env, "", 1_000_000)).toBeNull();
  });
  it("bate com a assinatura do Python (hmac sha256 hex de phone|session|ts)", async () => {
    // valor gerado com: python -c "import hmac,hashlib;print(hmac.new(b's3gr3d0',b'5547984889108|sess1|1000000',hashlib.sha256).hexdigest())"
    const env = await signCaller("5547984889108", "sess1", 1_000_000, segredo);
    expect(env.sig).toBe("11f0e64ac3ecbd039886d7218c15db06d30f53801bbccd2acd206744a9b7056e");
  });
});

describe("papéis e dinheiro", () => {
  it("mapeia roles", () => {
    expect(papelDeRoles(["ADMIN"], true)).toBe("dono");
    expect(papelDeRoles(["MANAGER"], true)).toBe("gestao");
    expect(papelDeRoles(["MECHANIC"], true)).toBe("patio");
    expect(papelDeRoles(["PATIO"], true)).toBe("patio");
    expect(papelDeRoles(["ADMIN"], false)).toBe("cliente");
    expect(papelDeRoles([], true)).toBe("cliente");
    expect(papelDeRoles(["MECHANIC", "MANAGER"], true)).toBe("gestao"); // o maior vence
  });
  it("só dono/gestao/sistema veem dinheiro", () => {
    expect(["dono", "gestao", "sistema"].every((p) => veDinheiro(p as any))).toBe(true);
    expect(["cliente", "patio"].some((p) => veDinheiro(p as any))).toBe(false);
  });
  it("semDinheiro remove campos em qualquer profundidade", () => {
    const os = { id: "1", total_amount: 900, itens: [{ descricao: "pastilha", pricing: { unit_price: 100 }, total_price: 200 }], payments: [{ amount: 1 }] };
    expect(semDinheiro(os)).toEqual({ id: "1", itens: [{ descricao: "pastilha" }] });
  });
});
