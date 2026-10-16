// Cliente Supabase falso, em memória, só com o que as ações do arnaldo-api usam.
// Cadeia: from(t).select().eq().neq().ilike().in().is().gt().gte().lt().lte().order().limit().single()/.maybeSingle()
//         from(t).insert(r|[r]).select().single()   from(t).update(p).eq()...   from(t).delete().eq()...
// Joins (select("a, b(c)")) não são suportados: as ações fazem consultas separadas.
type Row = Record<string, any>;
type Res = { data: any; error: any };

const ISO = /^\d{4}-\d{2}-\d{2}T/;
function cmp(a: any, b: any): number {
  if (typeof a === "string" && typeof b === "string" && ISO.test(a) && ISO.test(b)) return new Date(a).getTime() - new Date(b).getTime();
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  uniques: Record<string, string[][]> = {};
  uploads: { bucket: string; path: string; bytes: Uint8Array; contentType?: string }[] = [];
  falhaEm: Record<string, string> = {}; // tabela → mensagem: força erro de banco
  colunasInexistentes: Record<string, string[]> = {}; // tabela → colunas que ainda não existem (migração não aplicada)
  private seq = 0;

  constructor(seed: Record<string, Row[]> = {}, uniques: Record<string, string[][]> = {}) {
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map((r) => ({ ...r }));
    this.uniques = uniques;
  }

  novoId() {
    this.seq += 1;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
  }

  rows(t: string): Row[] {
    return (this.tables[t] ??= []);
  }

  from(t: string) {
    return new Builder(this, t);
  }

  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, bytes: Uint8Array, opts?: { contentType?: string }) => {
        this.uploads.push({ bucket, path, bytes, contentType: opts?.contentType });
        return { data: { path }, error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://fake.storage/${bucket}/${path}` } }),
    }),
  };
}

class Builder implements PromiseLike<Res> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filtros: ((r: Row) => boolean)[] = [];
  private payload: any = null;
  private retorna = false;
  private ordem: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private modo: "many" | "single" | "maybe" = "many";

  constructor(private db: FakeDb, private t: string) {}

  select(_cols?: string, _opts?: unknown) { this.retorna = true; return this; }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: any) { this.filtros.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filtros.push((r) => r[c] !== v); return this; }
  is(c: string, v: any) { this.filtros.push((r) => (r[c] ?? null) === v); return this; }
  in(c: string, vs: any[]) { this.filtros.push((r) => vs.includes(r[c])); return this; }
  gt(c: string, v: any) { this.filtros.push((r) => r[c] != null && cmp(r[c], v) > 0); return this; }
  gte(c: string, v: any) { this.filtros.push((r) => r[c] != null && cmp(r[c], v) >= 0); return this; }
  lt(c: string, v: any) { this.filtros.push((r) => r[c] != null && cmp(r[c], v) < 0); return this; }
  lte(c: string, v: any) { this.filtros.push((r) => r[c] != null && cmp(r[c], v) <= 0); return this; }
  ilike(c: string, padrao: string) {
    const re = new RegExp("^" + padrao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i");
    this.filtros.push((r) => typeof r[c] === "string" && re.test(r[c]));
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) { this.ordem.push({ col, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.modo = "single"; return this; }
  maybeSingle() { this.modo = "maybe"; return this; }

  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, err?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.executar()).then(ok, err);
  }

  private executar(): Res {
    const falha = this.db.falhaEm[this.t];
    if (falha) return { data: null, error: { message: falha } };
    const todas = this.db.rows(this.t);
    let alvo: Row[] = [];

    const ausentes = this.db.colunasInexistentes[this.t] ?? [];
    const alvoPayload = this.op === "insert" || this.op === "update" ? (Array.isArray(this.payload) ? this.payload : [this.payload]) : [];
    for (const r of alvoPayload) {
      const faltando = Object.keys(r).find((k) => ausentes.includes(k));
      if (faltando) return { data: null, error: { code: "PGRST204", message: `Could not find the '${faltando}' column of '${this.t}' in the schema cache` } };
    }

    if (this.op === "insert") {
      const novos: Row[] = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({
        id: this.db.novoId(), created_at: new Date().toISOString(), ...r,
      }));
      if (this.t === "work_orders") {
        // o trigger do banco preenche o número sequencial por oficina
        for (const n of novos) {
          if (n.numero == null) {
            const doTenant = [...todas, ...novos.filter((x: Row) => x !== n && x.numero != null)].filter((r) => r.tenant_id === n.tenant_id);
            n.numero = Math.max(0, ...doTenant.map((r) => Number(r.numero) || 0)) + 1;
          }
        }
      }
      for (const n of novos) {
        for (const cols of this.db.uniques[this.t] ?? []) {
          if (todas.some((r) => cols.every((c) => r[c] !== undefined && r[c] === n[c]))) {
            return { data: null, error: { code: "23505", message: `duplicate key (${cols.join(",")})` } };
          }
        }
      }
      todas.push(...novos);
      alvo = novos;
    } else {
      alvo = todas.filter((r) => this.filtros.every((f) => f(r)));
      if (this.op === "update") for (const r of alvo) Object.assign(r, this.payload);
      if (this.op === "delete") this.db.tables[this.t] = todas.filter((r) => !alvo.includes(r));
    }

    if (this.op !== "select" && !this.retorna) return { data: null, error: null };

    let out = alvo.map((r) => ({ ...r }));
    for (const o of [...this.ordem].reverse()) {
      out.sort((a, b) => (cmp(a[o.col], b[o.col]) || 0) * (o.asc ? 1 : -1));
    }
    if (this.lim != null) out = out.slice(0, this.lim);

    if (this.modo === "single") {
      return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: "PGRST116", message: `${out.length} linhas` } };
    }
    if (this.modo === "maybe") {
      return out.length <= 1 ? { data: out[0] ?? null, error: null } : { data: null, error: { code: "PGRST116", message: "mais de uma linha" } };
    }
    return { data: out, error: null };
  }
}
