// Orçamento de serviços (PDF A4). Cabeçalho branco (opção A). Tem valor: só sai para dono/gestão ou
// para o cliente dono da OS (quem decide é a API).
import {
  esc, vazio, brl, km, dataBR, dataHoraBR, diaHoraCurto, campo, topo, rodape, faixa, assinaturas, fotosGrid,
  tabelaItens, linhaTotal, placaHtml, barraCombustivel, veiculoNome, documento, CSS_A4, TEXTO_APROVACAO,
} from './base.mjs';

export const MAX_FOTOS = 6;

export function render(dados, { logoDataUri = '', fontesCss = '', qrDataUri = '', agora = new Date() } = {}) {
  const { empresa, config = {}, os, cliente = {}, veiculo = {}, checkin, itens = [], totais = {}, diagnosticos = [] } = dados;
  const pecas = itens.filter(i => i.tipo === 'PART');
  const servicos = itens.filter(i => i.tipo === 'SERVICE');
  const aguardando = os.etapa === 'AGUARDANDO_APROVACAO';

  const status = `<span class="status">${esc(aguardando ? 'Aguardando sua aprovação' : os.etapa_texto)}</span>`;
  const cabecalho = faixa('Orçamento', 'de serviços', [
    ['Nº', `OS ${os.numero_fmt}`], ['Emissão', dataBR(agora)], ['Validade', dataBR(dados.validade_ate)],
  ], status);

  const blocoCliente = `<section><h2 class="rot">Cliente</h2><dl>` +
    campo('Nome', cliente.nome) + campo('WhatsApp', cliente.telefone_fmt) + campo('CPF/CNPJ', cliente.cpf_cnpj) +
    campo('Endereço', cliente.endereco) + `</dl></section>`;

  const comb = checkin && barraCombustivel(checkin.combustivel);
  const blocoVeiculo = `<section><h2 class="rot">Veículo</h2><dl>` +
    campo('Marca/Modelo', veiculoNome(veiculo)) +
    campo('Ano/Cor', [veiculo.ano, veiculo.cor].filter(x => !vazio(x)).join(' · ')) +
    campo('KM entrada', checkin && km(checkin.km), { cls: 'mono' }) + `</dl>` +
    `<div class="linha-placa">${placaHtml(veiculo.placa)}` +
    (comb ? `<div><div class="comb">Combustível</div>${comb}</div>` : '') + `</div></section>`;

  // Entrada do veículo: relato, diagnóstico, pertences/avarias e fotos.
  const diag = diagnosticos.map(d =>
    `<div class="queixa escura"><small>Diagnóstico do mecânico${vazio(d.mecanico) ? '' : ` · ${esc(d.mecanico)}`}</small>${esc(d.laudo)}</div>`).join('');
  const relato = vazio(os.queixa) ? '' :
    `<div class="queixa"><small>O que o cliente relatou${vazio(os.criada_em) ? '' : ` · ${esc(dataHoraBR(os.criada_em).replace(' ', ' às '))}`}</small>${esc(os.queixa)}</div>`;
  const detalhes = checkin ? `<dl style="margin-top:6px">${campo('Pertences', checkin.pertences)}${campo('Avarias', checkin.avarias)}</dl>` : '';
  const fotos = fotosGrid(dados.fotos, MAX_FOTOS, 3);
  const colunaFotos = fotos.html
    ? `<div>${fotos.html}${fotos.extras > 0 ? `<div class="fotos-mais">+ ${fotos.extras} foto${fotos.extras > 1 ? 's' : ''} no link do orçamento</div>` : ''}</div>` : '';
  const textoEntrada = relato + diag + detalhes;
  const blocoEntrada = textoEntrada || colunaFotos
    ? `<div class="bloco"><h2 class="rot">Entrada do veículo</h2><div class="entrada${colunaFotos ? '' : ' so-texto'}"><div>${textoEntrada}</div>${colunaFotos}</div></div>`
    : '';

  const condicoes = `<h2 class="rot">Condições</h2><dl>` +
    campo('Prazo', os.previsao_entrega && `Pronto em ${diaHoraCurto(os.previsao_entrega)} (após aprovação)`) +
    campo('Pagamento', config.formas_pagamento) +
    campo('Garantia', config.garantia_dias && `${config.garantia_dias} dias em peças e serviço`) +
    campo('Responsável', os.mecanico || checkin?.recebido_por) + `</dl>`;
  const quadroTotais = `<div class="totais">${linhaTotal('Peças e materiais', totais.pecas)}${linhaTotal('Mão de obra', totais.mao_de_obra)}` +
    `${linhaTotal('Desconto', totais.desconto)}<div class="t"><span>Total</span><span>${brl(totais.total)}</span></div></div>`;

  const telefone = empresa?.telefone ? ` no WhatsApp ${esc(empresa.telefone)}` : '';
  const aprovar = `<div class="aprovar">` +
    (qrDataUri && dados.link_aprovacao ? `<img class="qr" src="${esc(qrDataUri)}" alt="QR code de aprovação">` : '') +
    `<div><b class="tit">Aprovar este orçamento</b><p>` +
    (qrDataUri && dados.link_aprovacao ? 'Aponte a câmera para o código ou responda ' : 'Responda ') +
    `<b>“aprovo”</b> para o Arnaldo${telefone}.` +
    (dados.link_aprovacao ? ' O link também mostra todas as fotos.' : '') + `</p></div></div>`;

  const corpo = `<div class="folha">${topo(empresa, logoDataUri)}${cabecalho}<div class="duplo">${blocoCliente}${blocoVeiculo}</div>` +
    `${blocoEntrada}${tabelaItens('Peças e materiais', 'Descrição', pecas)}${tabelaItens('Mão de obra', 'Serviço', servicos)}` +
    `<div class="fech"><div>${condicoes}</div>${quadroTotais}</div>${aprovar}` +
    `${assinaturas('Responsável técnico · MD Mecânica', 'Assinatura do cliente')}` +
    `<p class="aviso">${esc(config.texto_aprovacao || TEXTO_APROVACAO)}</p>` +
    `${rodape(empresa, `${empresa?.telefone ?? ''} · Meia Praia · Itapema/SC`)}</div>`;

  return documento({ titulo: `Orçamento OS ${os.numero_fmt}`, css: CSS_A4, corpo, fontesCss });
}
