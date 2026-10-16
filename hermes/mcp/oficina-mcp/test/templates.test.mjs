import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as base from '../templates/base.mjs';
import { render as orcamento } from '../templates/orcamento.mjs';
import { render as ficha } from '../templates/ficha_entrada.mjs';
import { render as osPatio, semValor } from '../templates/os_patio.mjs';
import { render as recibo } from '../templates/recibo.mjs';
import { carregarAssets, qrDataUri } from '../templates/assets.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const fixture = nome => JSON.parse(fs.readFileSync(path.join(AQUI, 'fixtures', `dados-${nome}.json`), 'utf8'));
const AGORA = new Date('2026-10-15T14:00:00-03:00');
const RENDERS = { orcamento, ficha_entrada: ficha, os_patio: osPatio, recibo };

test('todo template traz número da OS, placa e nome do cliente (o do pátio, sem preço)', () => {
  for (const [tipo, render] of Object.entries(RENDERS)) {
    const html = render(fixture(tipo), { agora: AGORA });
    assert.match(html, /0042/, tipo);
    assert.match(html, /ABC1D23/, tipo);
    assert.match(html, /João da Silva/, tipo);
    assert.match(html, /^<!doctype html>/, tipo);
    assert.doesNotMatch(html, /logo-placa|class="tag"/, `${tipo}: sobras dos mockups`);
  }
});

test('orçamento e ficha mostram as legendas das fotos, com avarias depois das fotos normais', () => {
  for (const tipo of ['orcamento', 'ficha_entrada']) {
    const html = RENDERS[tipo](fixture(tipo), { agora: AGORA });
    assert.match(html, /Frente/, tipo);
    assert.match(html, /Painel · 98\.450 km/, tipo);
    const dados = fixture(tipo);
    dados.fotos = [dados.fotos[6], dados.fotos[0]]; // avaria antes da normal na entrada
    const ordenado = RENDERS[tipo](dados, { agora: AGORA });
    assert.ok(ordenado.indexOf('>Frente<') < ordenado.indexOf('Avaria · porta tras. dir.'), `${tipo}: avaria deve vir depois`);
  }
});

test('limites de fotos: 6 no orçamento, 8 na ficha, com o "+N" dos extras', () => {
  const o = orcamento(fixture('orcamento'), { agora: AGORA });
  assert.equal((o.match(/<div class="foto( avaria)?">/g) || []).length, 6);
  assert.match(o, /\+ 3 fotos no link do orçamento/);
  const f = ficha(fixture('ficha_entrada'), { agora: AGORA });
  assert.equal((f.match(/<div class="foto( avaria)?">/g) || []).length, 8);
  assert.match(f, /\+ 1 foto registrada no sistema/);
});

test('sem fotos a seção some', () => {
  const dados = fixture('ficha_entrada');
  dados.fotos = [];
  assert.doesNotMatch(ficha(dados), /Fotos da entrada/);
  const d2 = fixture('orcamento');
  d2.fotos = [];
  assert.doesNotMatch(orcamento(d2, { agora: AGORA }), /class="fotos/);
});

test('os_patio NÃO contém R$ nem número com vírgula decimal, nem com assets reais embutidos', () => {
  const html = osPatio(fixture('os_patio'), { ...carregarAssets() });
  assert.doesNotMatch(html, /R\$/);
  assert.doesNotMatch(html, /\d+,\d{2}/);
  assert.doesNotMatch(html, /Total|Pagamento|Valor unit/i);
});

test('os_patio ignora preço mesmo se a API mandar por engano, e apaga "R$ 500" digitado em texto livre', () => {
  const dados = fixture('orcamento'); // traz preços, totais e pagamentos
  dados.os.queixa = 'Cliente disse que o outro mecânico cobrou R$ 500,00 e 300 reais pelo freio';
  const html = osPatio(dados, {});
  assert.doesNotMatch(html, /R\$|\d+,\d{2}|834|189|420|reais/);
  assert.match(html, /Cliente relatou: Cliente disse que o outro mecânico cobrou — e — pelo freio/);
  assert.equal(semValor('R$ 1.234,56 e 2 mil reais'), '— e —');
});

test('os_patio: chips, checklist e peças', () => {
  const html = osPatio(fixture('os_patio'), {});
  assert.match(html, /chip alta">Prioridade alta/);
  assert.match(html, /Box 2/);
  assert.match(html, /Mec: Paulo/);
  assert.match(html, /Troca de pastilhas e discos dianteiros/);
  assert.match(html, /COBREQ N-1209 · 1/);
  assert.match(html, /FREMAX BD-5210 · 2/);
  assert.match(html, /Aprovado 15\/10 10:12/);
  assert.match(html, /width:1080px/);
});

test('escape: <script> no nome, na queixa e na legenda vira texto', () => {
  const sujo = '<script>alert(1)</script>';
  for (const [tipo, render] of Object.entries(RENDERS)) {
    const d = fixture(tipo);
    d.cliente.nome = sujo;
    d.os.queixa = sujo;
    d.veiculo.modelo = sujo;
    if (d.fotos?.[0]) d.fotos[0].legenda = sujo;
    if (d.checkin) d.checkin.pertences = sujo;
    const html = render(d, { agora: AGORA });
    assert.doesNotMatch(html, /<script>alert/, tipo);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, tipo);
  }
});

test('URL de foto estranha (javascript:) não vira src', () => {
  const d = fixture('ficha_entrada');
  d.fotos = [{ url: 'javascript:alert(1)', legenda: 'x', avaria: false }];
  assert.doesNotMatch(ficha(d), /javascript:/);
});

test('orçamento: valores, totais, condições e aprovação com QR', async () => {
  const d = fixture('orcamento');
  const qr = await qrDataUri(d.link_aprovacao);
  assert.match(qr, /^data:image\/png;base64,/);
  const html = orcamento(d, { agora: AGORA, qrDataUri: qr });
  for (const trecho of ['R$ 834,00', 'R$ 654,00', 'R$ 180,00', '189,00', '420,00', 'COBREQ N-1209', '15/10/2026', '22/10/2026',
    'Aguardando sua aprovação', 'PIX, cartão ou dinheiro', '90 dias em peças e serviço', 'Pronto em 16/10 às 15h', 'class="qr"', 'Márcio']) {
    assert.ok(html.includes(trecho), `faltou: ${trecho}`);
  }
  assert.match(html, /Pastilhas dianteiras no fim/);
  assert.match(html, /Peças e materiais/);
  assert.match(html, /Mão de obra/);
});

test('orçamento sem link_aprovacao não quebra: sem QR, só "aprovo"', () => {
  const d = fixture('orcamento');
  d.link_aprovacao = null;
  d.validade_ate = null;
  d.checkin = null;
  d.fotos = [];
  d.diagnosticos = [];
  d.itens = [];
  const html = orcamento(d, { agora: AGORA });
  assert.doesNotMatch(html, /class="qr"/);
  assert.match(html, /“aprovo”/);
  assert.match(html, /<h1>Orçamento/);
});

test('ficha: conferência e nenhum valor em reais', () => {
  const html = ficha(fixture('ficha_entrada'), {});
  assert.doesNotMatch(html, /R\$/);
  for (const trecho of ['98.450', 'Sim · bom', 'Sim / Sim', 'Cadeirinha infantil', 'Risco na porta traseira direita', 'Recebido por', 'Márcio', '9BWAB45U0FT000000', 'metade']) {
    assert.ok(html.includes(trecho), `faltou: ${trecho}`);
  }
  const d = fixture('ficha_entrada');
  d.checkin.tem_estepe = false;
  d.checkin.tem_macaco = null;
  d.checkin.tem_chave_roda = null;
  const html2 = ficha(d, {});
  assert.match(html2, /<b class="nok">Não<\/b>/);
});

test('recibo: pago, garantia, km de saída, revisão e totais', () => {
  const html = recibo(fixture('recibo'), {});
  for (const trecho of ['class="pago"', 'PAGO', '14/01/2027', '90 dias em peças e serviço', '98.462', 'R$ 834,00', 'Total pago', 'PIX', 'Simone',
    '16/10/2026 17:05', '16/10 17:10', '108.450 km', '15/04/2027']) {
    assert.ok(html.includes(trecho), `faltou: ${trecho}`);
  }
  assert.doesNotMatch(html, /lembra você/); // o Arnaldo não promete mensagem ativa
});

test('recibo parcial mostra saldo e não carimba PAGO', () => {
  const d = fixture('recibo');
  d.pagamentos[0].valor = 500;
  const html = recibo(d, {});
  assert.match(html, /PAGO PARCIAL/);
  assert.doesNotMatch(html, /class="pago">PAGO</);
  assert.match(html, /Saldo<\/span><span>R\$ 334,00/);
});

test('formatação BR', () => {
  assert.equal(base.brl(1234.5), 'R$ 1.234,50');
  assert.equal(base.num2(0), '0,00');
  assert.equal(base.km(98450), '98.450');
  assert.equal(base.dataBR('2026-10-22'), '22/10/2026');
  assert.equal(base.dataBR('2026-10-22T23:30:00-03:00'), '22/10/2026');
  assert.equal(base.dataBR('2026-10-23T01:30:00Z'), '22/10/2026'); // converte para Brasília
  assert.equal(base.dataHoraBR('2026-10-15T08:40:00-03:00'), '15/10 08:40');
  assert.equal(base.diaHoraCurto('2026-10-16T15:00:00-03:00'), '16/10 às 15h');
  assert.equal(base.diaHoraCurto('2026-10-16T15:30:00-03:00'), '16/10 às 15h30');
  assert.equal(base.dataBR(null), '');
  assert.equal(base.placaFmt('abc-1d23'), 'ABC1D23');
  assert.equal(base.placaFmt('abc1234'), 'ABC-1234');
  assert.equal(base.esc(null), '');
  assert.equal(base.esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

test('barra de combustível: 0 a 4 segmentos', () => {
  const on = c => (base.barraCombustivel(c).match(/<i class="on">/g) || []).length;
  assert.deepEqual(['RESERVA', 'QUARTO', 'METADE', 'TRES_QUARTOS', 'COMPLETO'].map(on), [0, 1, 2, 3, 4]);
  assert.equal(base.barraCombustivel('???'), '');
  assert.equal(base.barraCombustivel(null), '');
});

test('assets embutidos: 9 fontes e logo em base64', () => {
  const a = carregarAssets();
  assert.equal((a.fontesCss.match(/@font-face/g) || []).length, 9);
  assert.match(a.fontesCss, /font-family:'Barlow Condensed'/);
  assert.match(a.fontesCss, /font-family:'Roboto Mono'/);
  assert.match(a.logoDataUri, /^data:image\/png;base64,iVBOR/);
});
