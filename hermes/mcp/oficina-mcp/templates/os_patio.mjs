// OS do pátio: imagem vertical (1080 px) para o WhatsApp do mecânico. NUNCA tem dinheiro, para nenhum papel:
// este template nem lê preço/total/pagamento, e ainda apaga valores em reais escritos à mão nos textos livres.
import { esc, vazio, km, dataHoraBR, diaHoraCurto, placaHtml, qtdFmt, veiculoNome, documento, CSS_PATIO } from './base.mjs';

const PRIORIDADE = { ALTA: 'alta', MEDIA: 'média', BAIXA: 'baixa' };
const BOX = { BOX_1: 'Box 1', BOX_2: 'Box 2', BOX_3: 'Box 3', BOX_4: 'Box 4', PATIO: 'Pátio' };

/** Texto livre (queixa, laudo, descrição) pode trazer "R$ 500" digitado por alguém: no pátio isso não aparece. */
export function semValor(texto) {
  return String(texto ?? '')
    .replace(/R\$\s*\d[\d.,]*/gi, '—')
    .replace(/\b\d[\d.,]*\s*(?:reais|contos|mil\s+reais)\b/gi, '—');
}
const t = texto => esc(semValor(texto));

export function render(dados, { logoDataUri = '', fontesCss = '' } = {}) {
  const { empresa, os, cliente = {}, veiculo = {}, checkin, itens = [], diagnosticos = [] } = dados;

  const logo = logoDataUri ? `<img src="${esc(logoDataUri)}" alt="">` : `<strong>${esc(empresa?.nome)}</strong>`;
  const cab = `<div class="cab">${logo}<div>Ordem de serviço<b>OS ${esc(os.numero_fmt)}</b></div></div>`;

  const detalheCarro = [veiculo.ano, veiculo.cor, checkin && !vazio(checkin.km) ? `${km(checkin.km)} km` : null].filter(x => !vazio(x)).join(' · ');
  const dono = vazio(cliente.nome) ? '' : `<small>Cliente: ${t(cliente.nome)}</small>`;
  const carro = `<div class="carro">${placaHtml(veiculo.placa)}<p>${t(veiculoNome(veiculo))}${detalheCarro ? `<small>${esc(detalheCarro)}</small>` : ''}${dono}</p></div>`;

  const chips = [];
  if (os.prioridade === 'ALTA') chips.push('<span class="chip alta">Prioridade alta</span>');
  else if (PRIORIDADE[os.prioridade]) chips.push(`<span class="chip">Prioridade ${PRIORIDADE[os.prioridade]}</span>`);
  if (BOX[os.box]) chips.push(`<span class="chip">${BOX[os.box]}</span>`);
  if (!vazio(os.mecanico)) chips.push(`<span class="chip">Mec: ${esc(os.mecanico)}</span>`);
  if (!vazio(os.previsao_entrega)) chips.push(`<span class="chip">Entrega ${esc(diaHoraCurto(os.previsao_entrega).replace(' às ', ' '))}</span>`);

  const qtd = it => (Number(it.quantidade) > 1 ? ` <small>× ${esc(qtdFmt(it.quantidade))}</small>` : '');
  const servicos = itens.filter(i => i.tipo === 'SERVICE');
  const pecas = itens.filter(i => i.tipo === 'PART');
  const fazer = servicos.length
    ? servicos.map(i => `<li>${t(i.descricao)}${qtd(i)}</li>`).join('')
    : diagnosticos.map(d => `<li>${t(d.laudo)}</li>`).join('');
  const blocoFazer = fazer ? `<div class="sec"><h4>O que fazer</h4><ul>${fazer}</ul></div>` : '';
  const blocoPecas = pecas.length
    ? `<div class="sec"><h4>Peças</h4><ul>${pecas.map(i => {
      const det = [i.codigo, Number(i.quantidade) > 0 ? qtdFmt(i.quantidade) : null].filter(x => !vazio(x)).join(' · ');
      return `<li>${t(i.descricao)}${det ? ` <small>${esc(det)}</small>` : ''}</li>`;
    }).join('')}</ul></div>` : '';

  const avisos = [
    !vazio(os.queixa) && `Cliente relatou: ${t(os.queixa)}`,
    checkin && !vazio(checkin.pertences) && `Pertences no carro: ${t(checkin.pertences)}`,
    checkin && !vazio(checkin.avarias) && `Avarias de entrada: ${t(checkin.avarias)}`,
  ].filter(Boolean);
  const alerta = avisos.length ? `<div class="alerta"><b>Atenção</b>${avisos.map(a => `<br>${a}`).join('')}</div>` : '';

  const pe = `<div class="pe"><span>${os.aprovada_em ? `Aprovado ${esc(dataHoraBR(os.aprovada_em))}` : esc(os.etapa_texto || '')}</span><span>Dúvida? Fala com o Arnaldo</span></div>`;

  const corpo = `<div class="cel">${cab}${carro}<div class="chips">${chips.join('')}</div>${blocoFazer}${blocoPecas}${alerta}${pe}</div>`;
  return documento({ titulo: `OS ${os.numero_fmt}`, css: CSS_PATIO, corpo, fontesCss });
}
