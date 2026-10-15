import type { Papel } from "./roles.ts";

export const ETAPAS = ["AGUARDANDO_CHECKIN","CHECKIN_CONCLUIDO","EM_DIAGNOSTICO","AGUARDANDO_ORCAMENTO","AGUARDANDO_APROVACAO","APROVADO","EM_EXECUCAO","EM_QUALIDADE","AJUSTES","PRONTO_PARA_RETIRADA","FINALIZADO","CANCELADO"] as const;

const TEXTO: Record<string, string> = {
  AGUARDANDO_CHECKIN: "aguardando a entrada na oficina", CHECKIN_CONCLUIDO: "recebido na oficina",
  EM_DIAGNOSTICO: "em avaliação", AGUARDANDO_ORCAMENTO: "orçamento sendo preparado",
  AGUARDANDO_APROVACAO: "aguardando sua aprovação do orçamento", APROVADO: "aprovado, na fila do serviço",
  EM_EXECUCAO: "em serviço", EM_QUALIDADE: "no teste final", AJUSTES: "em ajustes finais",
  PRONTO_PARA_RETIRADA: "pronto para retirada", FINALIZADO: "entregue", CANCELADO: "cancelado",
};
export const etapaEmPortugues = (e: string) => TEXTO[e] ?? e;

const PATIO = new Set(["AGUARDANDO_CHECKIN>CHECKIN_CONCLUIDO","CHECKIN_CONCLUIDO>EM_DIAGNOSTICO","EM_DIAGNOSTICO>AGUARDANDO_ORCAMENTO","APROVADO>EM_EXECUCAO","EM_EXECUCAO>EM_QUALIDADE","AJUSTES>EM_EXECUCAO"]);
const GESTAO_EXTRA = new Set(["EM_QUALIDADE>AJUSTES"]);

export function transicaoPermitida(de: string, para: string, papel: Papel): boolean {
  if (de === para || de === "FINALIZADO" || de === "CANCELADO") return false;
  if (papel === "patio") return PATIO.has(`${de}>${para}`);
  if (papel === "gestao" || papel === "dono" || papel === "sistema") {
    if (para === "CANCELADO") return true;
    if (GESTAO_EXTRA.has(`${de}>${para}`)) return true;
    const i = ETAPAS.indexOf(de as any), j = ETAPAS.indexOf(para as any);
    return i >= 0 && j > i;
  }
  return false;
}
