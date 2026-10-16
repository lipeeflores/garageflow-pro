// Recibo e entrega (PDF A4): o que foi feito, quanto foi pago, garantia. Tem valor.
import {
  esc, vazio, brl, km, dataBR, dataHoraBR, dataHoraCompletaBR, campo, topo, rodape, faixa, assinaturas, num2,
  linhaTotal, placaHtml, qtdFmt, veiculoNome, documento, CSS_A4, TEXTO_GARANTIA,
} from './base.mjs';

export function render(dados, { logoDataUri = '', fontesCss = '' } = {}) {
  const { empresa, config = {}, os, cliente = {}, veiculo = {}, itens = [], totais = {}, pagamentos = [] } = dados;

  const pago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const quitado = pago > 0 && pago + 0.005 >= (Number(totais.total) || 0);
  const selo = quitado ? '<span class="pago">PAGO</span>' : pago > 0 ? '<span class="pago parcial">PAGO PARCIAL</span>' : '';
  const cabecalho = faixa('Recibo e', 'entrega', [['OS', os.numero_fmt], ['Entrega', dataHoraBR(os.entregue_em)]],
    selo ? `<div style="margin-top:8px">${selo}</div>` : '');

  const blocoCliente = `<section><h2 class="rot">Cliente</h2><dl>${campo('Nome', cliente.nome)}${campo('CPF', cliente.cpf_cnpj)}</dl></section>`;
  const blocoVeiculo = `<section><h2 class="rot">Veículo</h2><dl>` +
    campo('Modelo', [veiculoNome(veiculo), veiculo.ano].filter(x => !vazio(x)).join(' · ')) +
    campo('Placa', veiculo.placa, { cls: 'mono' }) + campo('KM saída', km(os.km_saida), { cls: 'mono' }) + `</dl></section>`;

  const ordenados = [...itens.filter(i => i.tipo === 'PART'), ...itens.filter(i => i.tipo !== 'PART')];
  const linhas = ordenados.map(it => {
    const cod = vazio(it.codigo) ? '' : ` · ${esc(it.codigo)}`;
    return `<tr><td>${esc(it.descricao)}${cod}</td><td class="n">${esc(qtdFmt(it.quantidade))}</td><td class="n">${num2(it.total)}</td></tr>`;
  }).join('');
  const servicos = linhas
    ? `<div class="bloco"><h2 class="rot">Serviços realizados</h2><table><thead><tr><th>Descrição</th><th class="n">Qtd</th><th class="n">Total</th></tr></thead><tbody>${linhas}</tbody></table></div>`
    : '';

  const blocoPagamento = pagamentos.length
    ? pagamentos.map(p => `<dl>${campo('Forma', p.forma)}${campo('Data', dataHoraCompletaBR(p.em))}${campo('Recebido por', p.recebido_por)}</dl>`).join('')
    : '<dl>' + campo('Situação', 'Sem pagamento registrado') + '</dl>';
  const garantia = vazio(os.garantia_ate) ? '' :
    `<h2 class="rot" style="margin-top:12px">Garantia</h2><div class="queixa"><small>Válida até</small>` +
    `<b style="font-family:'Roboto Mono',monospace;font-size:15px">${esc(dataBR(os.garantia_ate))}</b>` +
    `${config.garantia_dias ? ` · ${esc(config.garantia_dias)} dias em peças e serviço` : ''}</div>`;
  const saldo = Math.max(0, (Number(totais.total) || 0) - pago);
  const quadro = `<div class="totais">${linhaTotal('Peças', totais.pecas)}${linhaTotal('Mão de obra', totais.mao_de_obra)}${linhaTotal('Desconto', totais.desconto)}` +
    `<div class="t"><span>${quitado ? 'Total pago' : 'Total'}</span><span>${brl(totais.total)}</span></div>` +
    (!quitado && pago > 0 ? `${linhaTotal('Já pago', pago)}${linhaTotal('Saldo', saldo)}` : '') + `</div>`;
  const fechamento = `<div class="bloco" style="display:grid;grid-template-columns:1.1fr .9fr;gap:20px;align-items:start">` +
    `<div><h2 class="rot">Pagamento</h2>${blocoPagamento}${garantia}</div>${quadro}</div>`;

  const sugestao = [os.proxima_revisao_km && `${km(os.proxima_revisao_km)} km`, os.proxima_revisao_data && dataBR(os.proxima_revisao_data)].filter(Boolean);
  const revisao = sugestao.length
    ? `<div class="bloco"><h2 class="rot">Próxima revisão sugerida</h2><div class="queixa escura">Revisão em ${esc(sugestao.join(' ou até '))}.</div></div>` : '';

  const corpo = `<div class="folha">${topo(empresa, logoDataUri)}${cabecalho}<div class="duplo">${blocoCliente}${blocoVeiculo}</div>` +
    `${servicos}${fechamento}${revisao}${assinaturas('MD Mecânica', 'Retirado por')}` +
    `<p class="aviso">${esc(config.texto_garantia || TEXTO_GARANTIA)}</p>` +
    `${rodape(empresa, `Obrigado pela confiança · ${empresa?.telefone ?? ''}`)}</div>`;

  return documento({ titulo: `Recibo OS ${os.numero_fmt}`, css: CSS_A4, corpo, fontesCss });
}
