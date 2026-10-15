import { describe, it, expect } from "vitest";
import { transicaoPermitida, etapaEmPortugues } from "../../../supabase/functions/_shared/arnaldo/workflow";
import { regraAgenda, horariosLivres } from "../../../supabase/functions/_shared/arnaldo/agenda";

describe("transições", () => {
  it("pátio anda só nas etapas de pátio", () => {
    expect(transicaoPermitida("AGUARDANDO_CHECKIN", "CHECKIN_CONCLUIDO", "patio")).toBe(true);
    expect(transicaoPermitida("EM_EXECUCAO", "EM_QUALIDADE", "patio")).toBe(true);
    expect(transicaoPermitida("AGUARDANDO_APROVACAO", "APROVADO", "patio")).toBe(false);
    expect(transicaoPermitida("EM_QUALIDADE", "PRONTO_PARA_RETIRADA", "patio")).toBe(false);
    expect(transicaoPermitida("EM_EXECUCAO", "CANCELADO", "patio")).toBe(false);
  });
  it("gestão aprova, finaliza e cancela; ninguém volta de FINALIZADO", () => {
    expect(transicaoPermitida("AGUARDANDO_APROVACAO", "APROVADO", "gestao")).toBe(true);
    expect(transicaoPermitida("PRONTO_PARA_RETIRADA", "FINALIZADO", "dono")).toBe(true);
    expect(transicaoPermitida("EM_DIAGNOSTICO", "CANCELADO", "gestao")).toBe(true);
    expect(transicaoPermitida("FINALIZADO", "EM_EXECUCAO", "dono")).toBe(false);
    expect(transicaoPermitida("AGUARDANDO_CHECKIN", "CHECKIN_CONCLUIDO", "cliente")).toBe(false);
  });
  it("texto para cliente", () => {
    expect(etapaEmPortugues("EM_EXECUCAO")).toBe("em serviço");
    expect(etapaEmPortugues("PRONTO_PARA_RETIRADA")).toBe("pronto para retirada");
  });
});

describe("agenda", () => {
  const regra = regraAgenda(null); // padrão
  it("terça 08:00-17:00 de hora em hora, sem almoço, 2 vagas", () => {
    const h = horariosLivres(regra, "2026-10-20T00:00:00-03:00", "2026-10-20T23:59:00-03:00", [], "2026-10-19T08:00:00-03:00");
    expect(h.map((x) => x.inicio.slice(11, 16))).toEqual(["08:00", "09:00", "10:00", "11:00", "13:30", "14:30", "15:30"]);
    expect(h.every((x) => x.vagas === 2)).toBe(true);
  });
  it("ocupados descontam e lotado some", () => {
    const occ = ["2026-10-20T08:00:00-03:00", "2026-10-20T08:00:00-03:00", "2026-10-20T09:00:00-03:00"];
    const h = horariosLivres(regra, "2026-10-20T00:00:00-03:00", "2026-10-20T10:00:00-03:00", occ, "2026-10-19T08:00:00-03:00");
    expect(h).toEqual([{ inicio: "2026-10-20T09:00:00-03:00", vagas: 1 }]);
  });
  it("sábado fecha 12h, domingo fechado, antecedência de 2h", () => {
    const sab = horariosLivres(regra, "2026-10-24T00:00:00-03:00", "2026-10-25T23:59:00-03:00", [], "2026-10-19T08:00:00-03:00");
    expect(sab.map((x) => x.inicio.slice(0, 16))).toEqual(["2026-10-24T08:00", "2026-10-24T09:00", "2026-10-24T10:00", "2026-10-24T11:00"]);
    const hoje = horariosLivres(regra, "2026-10-20T00:00:00-03:00", "2026-10-20T12:00:00-03:00", [], "2026-10-20T08:30:00-03:00");
    expect(hoje[0].inicio.slice(11, 16)).toBe("11:00"); // 08:30 + 2h = 10:30 → próximo horário cheio 11:00
  });
  it("settings.arnaldo_agenda sobrepõe o padrão", () => {
    const r = regraAgenda({ arnaldo_agenda: { carros_por_horario: 1, dias: [1] } });
    expect(r.carros_por_horario).toBe(1);
    expect(r.dias).toEqual([1]);
    expect(r.abre).toBe("08:00");
  });
});
