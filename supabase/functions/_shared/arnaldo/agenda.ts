// Grade de horários da oficina. Pura: só aritmética de datas, sem acesso a banco.
// Brasil não tem horário de verão desde 2019: o offset de São Paulo é fixo em -03:00.
export type RegraAgenda = {
  dias: number[];            // 0 = domingo
  abre: string;              // "HH:MM"
  fecha: string;
  sabado_fecha: string;
  almoco: [string, string];
  intervalo_min: number;
  carros_por_horario: number;
  antecedencia_min: number;
};

const PADRAO: RegraAgenda = {
  dias: [1, 2, 3, 4, 5, 6], abre: "08:00", fecha: "17:00", sabado_fecha: "12:00",
  almoco: ["12:00", "13:30"], intervalo_min: 60, carros_por_horario: 2, antecedencia_min: 120,
};

const OFFSET_MS = 3 * 3600_000;
const MIN_MS = 60_000;
const hhmm = /^\d{1,2}:\d{2}$/;

export function regraAgenda(settings: unknown): RegraAgenda {
  const r: RegraAgenda = { ...PADRAO, almoco: [...PADRAO.almoco] as [string, string], dias: [...PADRAO.dias] };
  const o = settings && typeof settings === "object" ? (settings as Record<string, unknown>).arnaldo_agenda : null;
  if (!o || typeof o !== "object") return r;
  const s = o as Record<string, unknown>;
  if (Array.isArray(s.dias) && s.dias.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)) r.dias = s.dias as number[];
  for (const k of ["abre", "fecha", "sabado_fecha"] as const) {
    if (typeof s[k] === "string" && hhmm.test(s[k] as string)) r[k] = s[k] as string;
  }
  if (Array.isArray(s.almoco) && s.almoco.length === 2 && s.almoco.every((x) => typeof x === "string" && hhmm.test(x))) {
    r.almoco = [s.almoco[0], s.almoco[1]];
  }
  for (const k of ["intervalo_min", "carros_por_horario", "antecedencia_min"] as const) {
    if (typeof s[k] === "number" && Number.isFinite(s[k]) && (s[k] as number) >= 0) r[k] = s[k] as number;
  }
  if (r.intervalo_min <= 0) r.intervalo_min = PADRAO.intervalo_min;
  return r;
}

const aMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const p2 = (n: number) => String(n).padStart(2, "0");

/** Aceita ISO com offset ou só a data (YYYY-MM-DD = meia-noite local). Devolve epoch ms. */
function parse(iso: string): number {
  const s = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00-03:00` : iso;
  return new Date(s).getTime();
}

/** epoch ms de um (data local, minutos desde 00:00) de São Paulo */
const epochLocal = (y: number, m: number, d: number, min: number) => Date.UTC(y, m, d, 0, min) + OFFSET_MS;

function formatar(ms: number): string {
  const d = new Date(ms - OFFSET_MS);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:00-03:00`;
}

export function horariosLivres(
  regra: RegraAgenda, deISO: string, ateISO: string, ocupados: string[], agoraISO: string,
): { inicio: string; vagas: number }[] {
  const de = parse(deISO), ate = parse(ateISO), agora = parse(agoraISO);
  if (![de, ate, agora].every(Number.isFinite) || ate <= de) return [];
  const minimo = agora + regra.antecedencia_min * MIN_MS;

  const contagem = new Map<number, number>();
  for (const o of ocupados) {
    const t = Math.floor(parse(o) / MIN_MS);
    if (Number.isFinite(t)) contagem.set(t, (contagem.get(t) ?? 0) + 1);
  }

  const out: { inicio: string; vagas: number }[] = [];
  const ini = new Date(de - OFFSET_MS), fim = new Date(ate - OFFSET_MS);
  let dia = Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), ini.getUTCDate());
  const ultimo = Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate());

  for (; dia <= ultimo; dia += 24 * 3600_000) {
    const dd = new Date(dia);
    if (!regra.dias.includes(dd.getUTCDay())) continue;
    const y = dd.getUTCFullYear(), m = dd.getUTCMonth(), d = dd.getUTCDate();
    const abre = aMin(regra.abre);
    const fecha = aMin(dd.getUTCDay() === 6 ? regra.sabado_fecha : regra.fecha);
    const [aIni, aFim] = [aMin(regra.almoco[0]), aMin(regra.almoco[1])];
    const tem = aFim > aIni;
    // duas grades: antes do almoço (a partir de abre) e depois (a partir do fim do almoço)
    const blocos: [number, number][] = tem ? [[abre, aIni], [aFim, fecha]] : [[abre, fecha]];
    for (const [bIni, bFim] of blocos) {
      for (let t = bIni; t < bFim; t += regra.intervalo_min) {
        if (t + regra.intervalo_min > fecha) continue;
        const ms = epochLocal(y, m, d, t);
        if (ms < de || ms >= ate || ms < minimo) continue;
        const vagas = regra.carros_por_horario - (contagem.get(ms / MIN_MS) ?? 0);
        if (vagas > 0) out.push({ inicio: formatar(ms), vagas });
      }
    }
  }
  return out;
}
