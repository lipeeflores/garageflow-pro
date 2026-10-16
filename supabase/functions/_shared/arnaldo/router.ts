import type { Ctx } from "./db.ts";
import { semDinheiro } from "./money.ts";
import { veDinheiro } from "./roles.ts";
import { ErroArnaldo, type Acao } from "./util.ts";

import quem_sou from "./actions/quem_sou.ts";
import meus_dados from "./actions/meus_dados.ts";
import cadastrar_cliente_veiculo from "./actions/cadastrar_cliente_veiculo.ts";
import status_do_carro from "./actions/status_do_carro.ts";
import horarios_livres from "./actions/horarios_livres.ts";
import agendar from "./actions/agendar.ts";
import meus_agendamentos from "./actions/meus_agendamentos.ts";
import remarcar from "./actions/remarcar.ts";
import cancelar_agendamento from "./actions/cancelar_agendamento.ts";
import agenda_do_dia from "./actions/agenda_do_dia.ts";
import buscar from "./actions/buscar.ts";
import ver_os from "./actions/ver_os.ts";
import abrir_os from "./actions/abrir_os.ts";
import registrar_checkin from "./actions/registrar_checkin.ts";
import anexar_foto from "./actions/anexar_foto.ts";
import registrar_diagnostico from "./actions/registrar_diagnostico.ts";
import adicionar_itens from "./actions/adicionar_itens.ts";
import mover_etapa from "./actions/mover_etapa.ts";
import atribuir from "./actions/atribuir.ts";
import precificar_itens from "./actions/precificar_itens.ts";
import enviar_orcamento from "./actions/enviar_orcamento.ts";
import controle_qualidade from "./actions/controle_qualidade.ts";
import registrar_pagamento from "./actions/registrar_pagamento.ts";
import resumo_financeiro from "./actions/resumo_financeiro.ts";
import contas_a_pagar from "./actions/contas_a_pagar.ts";
import dados_documento from "./actions/dados_documento.ts";
import registrar_entrega from "./actions/registrar_entrega.ts";

export type Resultado =
  | { ok: true; dados: unknown }
  | { ok: false; erro: string; mensagem: string; nao_diga_que_fez: true };

export const falha = (erro: string, mensagem: string): Resultado => ({ ok: false, erro, mensagem, nao_diga_que_fez: true });

export const ACOES: Record<string, Acao> = {
  quem_sou,
  meus_dados,
  cadastrar_cliente_veiculo,
  status_do_carro,
  horarios_livres,
  agendar,
  meus_agendamentos,
  remarcar,
  cancelar_agendamento,
  agenda_do_dia,
  buscar,
  ver_os,
  abrir_os,
  registrar_checkin,
  anexar_foto,
  registrar_diagnostico,
  adicionar_itens,
  mover_etapa,
  atribuir,
  precificar_itens,
  enviar_orcamento,
  controle_qualidade,
  registrar_pagamento,
  resumo_financeiro,
  contas_a_pagar,
  dados_documento,
  registrar_entrega,
};

export async function despachar(acao: string, args: unknown, ctx: Ctx): Promise<Resultado> {
  const a = Object.prototype.hasOwnProperty.call(ACOES, acao) ? ACOES[acao] : undefined;
  if (!a) return falha("acao_desconhecida", `Não existe a ação "${String(acao)}" no sistema da oficina.`);
  if (!a.papeis.includes(ctx.papel)) return falha("sem_permissao", "Essa ação é só para a equipe da oficina.");
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return falha("dados_invalidos", "Os dados da chamada vieram em formato inválido.");
  }
  const limpo = { ...(args as Record<string, unknown>) };
  delete limpo.reason; // a ferramenta aceita `reason` e ignora (lição da Isabelle)
  delete limpo.caller;
  try {
    let dados = await a.run(limpo, ctx);
    if (!veDinheiro(ctx.papel) && !a.liberaDinheiro) dados = semDinheiro(dados); // SEMPRE, em toda ação (exceção única: dados_documento)
    return { ok: true, dados };
  } catch (e) {
    if (e instanceof ErroArnaldo) return falha(e.codigo, e.message);
    console.error(`arnaldo-api: erro em ${acao}:`, e);
    return falha(
      "erro_interno",
      "O sistema da oficina falhou agora. NÃO diga que foi feito; avise que vai verificar com a equipe.",
    );
  }
}
