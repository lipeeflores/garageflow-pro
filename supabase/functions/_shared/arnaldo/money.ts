const CAMPOS = new Set(["total_amount", "unit_price", "unit_cost", "total_price", "amount", "valor", "preco", "custo"]);
const RAMOS = new Set(["pricing", "work_order_pricing", "payments", "financial_entries", "bills"]);

export function semDinheiro<T>(x: T): T {
  if (Array.isArray(x)) return x.map(semDinheiro) as unknown as T;
  if (x && typeof x === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (CAMPOS.has(k) || RAMOS.has(k)) continue;
      out[k] = semDinheiro(v);
    }
    return out as T;
  }
  return x;
}
