// Ficha de entrada / check-in (PDF A4). Sem valor nenhum. Comprova o estado em que o carro chegou.
import {
  esc, vazio, km, dataHoraBR, campo, topo, rodape, faixa, assinaturas, fotosGrid, placaHtml, barraCombustivel,
  veiculoNome, documento, CSS_A4, TEXTO_FICHA,
} from './base.mjs';

export const MAX_FOTOS = 8;

function simNao(valor, detalhe) {
  if (valor === true) return `<b class="ok">Sim${vazio(detalhe) ? '' : ` · ${esc(detalhe)}`}</b>`;
  if (valor === false) return '<b class="nok">Não</b>';
  return '<b>—</b>';
}

export function render(dados, { logoDataUri = '', fontesCss = '' } = {}) {
  const { empresa, config = {}, os, cliente = {}, veiculo = {}, checkin = {} } = dados;

  const cabecalho = faixa('Ficha de', 'entrada', [
    ['OS', os.numero_fmt], ['Entrada', dataHoraBR(checkin.em || os.criada_em)], ['Recebido por', checkin.recebido_por],
  ]);

  const blocoCliente = `<section><h2 class="rot">Cliente</h2><dl>` +
    campo('Nome', cliente.nome) + campo('WhatsApp', cliente.telefone_fmt) + campo('CPF', cliente.cpf_cnpj) + `</dl></section>`;
  const blocoVeiculo = `<section><h2 class="rot">Veículo</h2><dl>` +
    campo('Modelo', [veiculoNome(veiculo), veiculo.ano, veiculo.cor].filter(x => !vazio(x)).join(' · ')) +
    campo('Chassi', veiculo.chassi, { cls: 'mono' }) + `</dl><div style="margin-top:8px">${placaHtml(veiculo.placa)}</div></section>`;

  const comb = barraCombustivel(checkin.combustivel);
  const macacoChave = checkin.tem_macaco === null && checkin.tem_chave_roda === null ? '<b>—</b>' :
    `<b class="${checkin.tem_macaco && checkin.tem_chave_roda ? 'ok' : 'nok'}">${checkin.tem_macaco === true ? 'Sim' : checkin.tem_macaco === false ? 'Não' : '—'} / ${checkin.tem_chave_roda === true ? 'Sim' : checkin.tem_chave_roda === false ? 'Não' : '—'}</b>`;
  const conferencia = `<div class="bloco"><h2 class="rot">Conferência</h2><div class="check">` +
    `<div><small>KM no painel</small><b class="mono" style="font-size:14px">${esc(km(checkin.km) || '—')}</b></div>` +
    `<div><small>Combustível</small>${comb || '<b>—</b>'}</div>` +
    `<div><small>Estepe</small>${simNao(checkin.tem_estepe, checkin.estado_estepe)}</div>` +
    `<div><small>Macaco / chave</small>${macacoChave}</div></div>` +
    `<dl style="margin-top:6px">${campo('Pertences', checkin.pertences)}` +
    campo('Avarias', checkin.avarias, { estilo: 'color:#b3121b' }) + campo('Observações', checkin.observacoes) + `</dl></div>`;

  const fotos = fotosGrid(dados.fotos, MAX_FOTOS, 4);
  const blocoFotos = fotos.html
    ? `<div class="bloco"><h2 class="rot">Fotos da entrada · ${fotos.total}</h2>${fotos.html}` +
      (fotos.extras > 0 ? `<div class="fotos-mais">+ ${fotos.extras} foto${fotos.extras > 1 ? 's' : ''} registrada${fotos.extras > 1 ? 's' : ''} no sistema</div>` : '') + `</div>` : '';
  const relato = vazio(os.queixa) ? '' : `<div class="bloco"><h2 class="rot">O que o cliente relatou</h2><div class="queixa">${esc(os.queixa)}</div></div>`;

  const corpo = `<div class="folha">${topo(empresa, logoDataUri)}${cabecalho}<div class="duplo">${blocoCliente}${blocoVeiculo}</div>` +
    `${conferencia}${blocoFotos}${relato}${assinaturas('Recebido por · MD Mecânica', 'Cliente')}` +
    `<p class="aviso">${esc(config.texto_ficha || TEXTO_FICHA)}</p>` +
    `${rodape(empresa, `${empresa?.telefone ?? ''} · Itapema/SC`)}</div>`;

  return documento({ titulo: `Ficha de entrada OS ${os.numero_fmt}`, css: CSS_A4, corpo, fontesCss });
}
