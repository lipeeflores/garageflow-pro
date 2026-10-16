// Peças comuns dos documentos da MD: escape, formatação BR, CSS e blocos de HTML.
// Visual aprovado em docs/superpowers/specs/documentos-md/*.mockup.html (cabeçalho opção A, tudo branco,
// sem fundo preto, sem as etiquetas amarelas dos mockups). Funções puras: dados → string.

// ── escape e formatação ────────────────────────────────────────────────────

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa TUDO que vem da API/banco (o nome de um cliente pode ter `<`). null/undefined → ''. */
export function esc(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/[&<>"']/g, c => ESCAPES[c]);
}

/** URL aceitável em src: só http(s) e data:image. Qualquer outra coisa vira ''. */
export function urlSegura(url) {
  const u = String(url ?? '').trim();
  return /^(https?:\/\/|data:image\/)/i.test(u) ? esc(u) : '';
}

export function vazio(valor) {
  return valor === null || valor === undefined || String(valor).trim() === '';
}

const fmtMoeda = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 1234.5 → "1.234,50" */
export function num2(n) {
  return fmtMoeda.format(Number(n) || 0);
}
/** 1234.5 → "R$ 1.234,50" */
export function brl(n) {
  return `R$ ${num2(n)}`;
}
/** 98450 → "98.450" */
export function km(n) {
  return vazio(n) ? '' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(n));
}

const TZ = 'America/Sao_Paulo';
function partes(data, opcoes) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  const mapa = {};
  for (const p of new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...opcoes }).formatToParts(d)) mapa[p.type] = p.value;
  return mapa;
}
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-22" ou ISO com hora → "22/10/2026" (data pura não sofre conversão de fuso) */
export function dataBR(valor) {
  if (vazio(valor)) return '';
  const m = SO_DATA.exec(String(valor));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const p = partes(valor, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return p ? `${p.day}/${p.month}/${p.year}` : '';
}
/** ISO → "15/10 08:40" */
export function dataHoraBR(valor) {
  const p = vazio(valor) ? null : partes(valor, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return p ? `${p.day}/${p.month} ${p.hour}:${p.minute}` : '';
}
/** ISO → "15/10/2026 08:40" */
export function dataHoraCompletaBR(valor) {
  const p = vazio(valor) ? null : partes(valor, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : '';
}
/** ISO → "16/10 às 15h" (ou "15h30") */
export function diaHoraCurto(valor) {
  const p = vazio(valor) ? null : partes(valor, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (!p) return '';
  const hora = p.minute === '00' ? `${Number(p.hour)}h` : `${Number(p.hour)}h${p.minute}`;
  return `${p.day}/${p.month} às ${hora}`;
}

// ── campos do domínio ──────────────────────────────────────────────────────

const COMBUSTIVEL = { RESERVA: [0, 'reserva'], QUARTO: [1, '1/4'], METADE: [2, 'metade'], TRES_QUARTOS: [3, '3/4'], COMPLETO: [4, 'cheio'] };

/** Barra de 4 segmentos + texto. Combustível desconhecido → ''. */
export function barraCombustivel(c) {
  const item = COMBUSTIVEL[String(c ?? '').toUpperCase()];
  if (!item) return '';
  const [n, texto] = item;
  const segmentos = [0, 1, 2, 3].map(i => `<i${i < n ? ' class="on"' : ''}></i>`).join('');
  return `<div class="barra">${segmentos}</div><div class="comb" style="margin-top:2px">${esc(texto)}</div>`;
}

/** ABC1D23 (Mercosul) fica como está; ABC1234 (antiga) ganha hífen. */
export function placaFmt(p) {
  const s = String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d{4}$/.test(s) ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
}

export function placaHtml(p) {
  return `<div class="placa"><div class="tarja">Brasil</div><div class="num">${esc(placaFmt(p))}</div></div>`;
}

export function qtdFmt(q) {
  const n = Number(q);
  return Number.isFinite(n) && n > 0 ? String(n).replace('.', ',') : '1';
}

export function veiculoNome(v) {
  return [v?.marca, v?.modelo].filter(x => !vazio(x)).join(' ');
}

export const TEXTO_APROVACAO =
  'A aprovação (assinada, pelo link ou pelo WhatsApp) autoriza a execução dos serviços acima. Peças e serviços fora deste orçamento são comunicados antes e dependem de nova aprovação. Valores válidos até a data de validade.';
export const TEXTO_FICHA =
  'O cliente confere que o veículo foi entregue nas condições acima. A MD não se responsabiliza por objetos não listados em "Pertences".';
export const TEXTO_GARANTIA =
  'A garantia cobre defeito das peças e do serviço listados. Não cobre mau uso, acidente ou serviço feito por terceiros no mesmo item.';

// ── blocos de HTML ─────────────────────────────────────────────────────────

/** Uma linha rótulo/valor; some quando o valor é vazio. `cls` vai no <dd>. `bruto`: valor já é HTML seguro. */
export function campo(rotulo, valor, { cls = '', estilo = '', bruto = false } = {}) {
  if (vazio(valor)) return '';
  const conteudo = bruto ? valor : esc(valor);
  const c = cls ? ` class="${cls}"` : '';
  const e = estilo ? ` style="${estilo}"` : '';
  return `<div class="campo"><dt>${esc(rotulo)}</dt><dd${c}${e}>${conteudo}</dd></div>`;
}

export function topo(empresa, logoDataUri) {
  const e = empresa || {};
  const logo = logoDataUri ? `<img class="logo-contorno" src="${urlSegura(logoDataUri)}" alt="${esc(e.nome)}">` : `<strong class="logo-texto">${esc(e.nome)}</strong>`;
  const linhas = [e.endereco && String(e.endereco).split(' · 88')[0], [e.telefone, e.email].filter(Boolean).join(' · '), e.cnpj && `CNPJ ${e.cnpj}`]
    .filter(Boolean).map(esc).join('<br>');
  return `<header class="topo">${logo}<div class="of"><strong>${esc(e.nome)}</strong>${linhas}</div></header><div class="cromada"></div>`;
}

export function rodape(empresa, direita) {
  const e = empresa || {};
  return `<footer class="rodape"><b>${esc(e.nome)}</b><span>${esc(direita)}</span></footer>`;
}

export function faixa(linha1, linha2, selos, extra = '') {
  const blocos = selos.filter(([, v]) => !vazio(v)).map(([r, v]) => `<div>${esc(r)} <b>${esc(v)}</b></div>`).join('');
  return `<div class="faixa"><div><h1>${esc(linha1)}<br><span>${esc(linha2)}</span></h1></div>` +
    `<div style="text-align:right"><div class="selo">${blocos}</div>${extra}</div></div>`;
}

export function assinaturas(esquerda, direita) {
  return `<div class="assin"><div>${esc(esquerda)}</div><div>${esc(direita)}</div></div>`;
}

/**
 * Grade de fotos. Avarias vão para o fim (a API já ordena; aqui garantimos). Devolve { html, extras }.
 * `colunas` só afeta o CSS (classe), `max` limita quantas aparecem.
 */
export function fotosGrid(fotos, max, colunas = 3) {
  const lista = (fotos || []).filter(f => urlSegura(f?.url) || f?.url);
  const ordenadas = [...lista.filter(f => !f.avaria), ...lista.filter(f => f.avaria)];
  const mostradas = ordenadas.slice(0, max);
  const extras = ordenadas.length - mostradas.length;
  const itens = mostradas.map(f => {
    const src = urlSegura(f.url);
    const img = src ? `<img src="${src}" alt="">` : '';
    const legenda = vazio(f.legenda) ? '' : `<span>${esc(f.legenda)}</span>`;
    return `<div class="foto${f.avaria ? ' avaria' : ''}">${img}${legenda}</div>`;
  }).join('');
  return { html: mostradas.length ? `<div class="fotos c${colunas}">${itens}</div>` : '', extras, total: ordenadas.length };
}

/** Tabela de itens (peças ou serviços). Sem itens → ''. */
export function tabelaItens(titulo, rotuloColuna, itens) {
  if (!itens?.length) return '';
  const linhas = itens.map((it, i) => {
    const cod = vazio(it.codigo) ? '' : ` <small>· ${esc(it.codigo)}</small>`;
    return `<tr><td class="c">${String(i + 1).padStart(2, '0')}</td><td>${esc(it.descricao)}${cod}</td>` +
      `<td class="n">${esc(qtdFmt(it.quantidade))}</td><td class="n">${num2(it.preco_unitario)}</td><td class="n">${num2(it.total)}</td></tr>`;
  }).join('');
  return `<div class="bloco"><h2 class="rot">${esc(titulo)}</h2><table><thead><tr><th class="c">#</th><th>${esc(rotuloColuna)}</th>` +
    `<th class="n">Qtd</th><th class="n">Valor unit.</th><th class="n">Total</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

export function linhaTotal(rotulo, valor) {
  return `<div class="l"><span>${esc(rotulo)}</span><span>${brl(valor)}</span></div>`;
}

/** Documento HTML completo. */
export function documento({ titulo, css, corpo, fontesCss = '' }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>` +
    `<style>${fontesCss}\n${css}</style></head><body>${corpo}</body></html>`;
}

// ── CSS (do mockup aprovado, sem o prefixo .v2/.d e sem as .tag) ───────────

export const CSS_VARS = ':root{--preto:#101012;--vermelho:#b3121b;--cromo:#c8ccd1;--tinta:#26262a;--cinza:#7b7b83;--linha:#dcdce1}';

export const CSS_A4 = `${CSS_VARS}
@page { size: A4; margin: 0 }
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:'Barlow',Arial,sans-serif;color:var(--tinta);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.folha{width:210mm;margin:0 auto;background:#fff}
.mono{font-family:'Roboto Mono',monospace}
.topo{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 22px 9px}
.topo .of{text-align:right;font-size:11px;line-height:1.55;color:#4a4a52}
.topo .of strong{display:block;font-family:'Barlow Condensed',sans-serif;font-size:17px;letter-spacing:1.4px;text-transform:uppercase;color:var(--preto)}
.cromada{height:3px;background:linear-gradient(90deg,var(--vermelho) 0 62%,var(--cromo) 62% 100%)}
.logo-contorno{width:170px;filter:drop-shadow(0 0 .6px #000) drop-shadow(0 0 .6px #000) drop-shadow(0 0 .4px #000)}
.faixa{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:9px 22px 8px;border-bottom:1px solid var(--linha)}
h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:34px;line-height:.92;letter-spacing:2px;text-transform:uppercase;color:var(--preto)}
h1 span{color:var(--vermelho)}
.selo{display:flex;gap:20px;justify-content:flex-end}
.selo div{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza)}
.selo b{display:block;font-family:'Roboto Mono',monospace;font-size:13.5px;color:var(--preto);margin-top:3px}
.status{display:inline-block;margin-top:6px;border:1.5px solid var(--vermelho);color:var(--vermelho);font-family:'Barlow Condensed',sans-serif;letter-spacing:1.4px;text-transform:uppercase;font-size:11px;padding:2px 8px;border-radius:3px}
.pago{border:2.5px solid #1d7a3a;color:#1d7a3a;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:3px;font-size:22px;padding:2px 14px;transform:rotate(-6deg);display:inline-block}
.pago.parcial{border-color:var(--vermelho);color:var(--vermelho);font-size:17px}
.duplo{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--linha);break-inside:avoid}
.duplo>section{padding:9px 22px}
.duplo>section+section{border-left:1px solid var(--linha)}
h2.rot{margin:0 0 6px;font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:2.2px;text-transform:uppercase;color:var(--preto);font-weight:700;display:flex;align-items:center;gap:8px}
h2.rot::before{content:"";width:11px;height:11px;background:var(--vermelho);flex:none}
.campo{display:flex;gap:8px;font-size:12px;padding:2.5px 0;border-bottom:1px dotted #ccc}
.campo dt{color:var(--cinza);min-width:84px;text-transform:uppercase;font-size:9.5px;letter-spacing:.8px;padding-top:2px}
.campo dd{margin:0;flex:1;font-weight:500}
dl{margin:0}
.linha-placa{display:flex;gap:14px;align-items:flex-end;margin-top:8px}
.placa{border:2px solid var(--preto);border-radius:5px;overflow:hidden;width:150px;display:inline-block}
.placa .tarja{background:#fff;border-bottom:2px solid var(--preto);color:var(--preto);font-size:8px;letter-spacing:2.6px;text-transform:uppercase;text-align:center;padding:1px 0;font-family:'Barlow Condensed',sans-serif;font-weight:700}
.placa .num{font-family:'Roboto Mono',monospace;font-weight:700;font-size:21px;letter-spacing:3px;text-align:center;padding:4px 0 5px;color:var(--preto)}
.comb{font-size:9.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--cinza)}
.barra{display:flex;gap:2px;margin-top:3px}
.barra i{width:18px;height:8px;border:1px solid var(--preto)}
.barra i.on{background:var(--preto)}
.bloco{padding:9px 22px 3px;break-inside:avoid}
.entrada{display:grid;grid-template-columns:1.25fr 1fr;gap:18px}
.entrada.so-texto{grid-template-columns:1fr}
.queixa{border:1px solid var(--linha);border-left:4px solid var(--vermelho);padding:8px 11px;font-size:12px;margin-bottom:6px}
.queixa.escura{border-left-color:var(--tinta)}
.queixa small{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--cinza);margin-bottom:3px}
.fotos{display:grid;gap:5px}
.fotos.c3{grid-template-columns:repeat(3,1fr)}
.fotos.c4{grid-template-columns:repeat(4,1fr);gap:6px}
.foto{position:relative;aspect-ratio:3/2;background:linear-gradient(160deg,#b9bcc2,#e9eaed 55%,#cfd2d6);border:1px solid #bbb;overflow:hidden}
.foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.foto span{position:absolute;left:0;right:0;bottom:0;background:rgba(16,16,18,.78);color:#fff;font-size:8.5px;letter-spacing:.6px;text-transform:uppercase;padding:2px 4px;font-family:'Barlow Condensed',sans-serif}
.foto.avaria{border:2px solid var(--vermelho)}
.foto.avaria span{background:var(--vermelho)}
.fotos-mais{font-size:10px;color:var(--cinza);margin-top:4px}
.check{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.check>div{border:1px solid var(--linha);padding:6px 8px;font-size:11.5px}
.check small{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--cinza)}
.check b{font-family:'Barlow Condensed',sans-serif;font-size:15px;letter-spacing:.5px}
.ok{color:#1d7a3a}.nok{color:var(--vermelho)}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{border-bottom:2px solid var(--preto);color:var(--preto);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;padding:5px 8px;text-align:left}
th.n,td.n{text-align:right;white-space:nowrap}
th.c,td.c{text-align:center;width:30px}
tbody td{padding:3.5px 8px;border-bottom:1px solid var(--linha)}
tbody tr{break-inside:avoid}
tbody td.n{font-family:'Roboto Mono',monospace;font-size:11.5px}
tbody td.c{color:var(--cinza);font-family:'Roboto Mono',monospace;font-size:10.5px}
td small{color:var(--cinza);font-family:'Roboto Mono',monospace;font-size:9.5px}
.fech{display:grid;grid-template-columns:1.15fr .85fr;gap:20px;padding:8px 22px 8px;align-items:start;break-inside:avoid}
.totais{border:1px solid var(--linha)}
.totais .l{display:flex;justify-content:space-between;padding:4px 12px;font-size:12px;border-bottom:1px solid var(--linha)}
.totais .l span:last-child{font-family:'Roboto Mono',monospace}
.totais .t{border-top:2.5px solid var(--vermelho);padding:7px 12px;display:flex;justify-content:space-between;align-items:baseline}
.totais .t span:first-child{font-family:'Barlow Condensed',sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:14px;font-weight:700;color:var(--vermelho)}
.totais .t span:last-child{font-family:'Roboto Mono',monospace;font-weight:700;font-size:20px;color:var(--preto)}
.aprovar{display:flex;gap:12px;align-items:center;margin:0 22px 6px;border:1.5px dashed var(--vermelho);padding:7px 12px;break-inside:avoid}
.qr{width:64px;height:64px;flex:none}
.aprovar b.tit{font-family:'Barlow Condensed',sans-serif;letter-spacing:1.4px;text-transform:uppercase;font-size:14px;color:var(--vermelho)}
.aprovar p{margin:2px 0 0;font-size:11.5px}
.aprovar p b{font-size:12px}
.assin{display:grid;grid-template-columns:1fr 1fr;gap:34px;padding:16px 22px 3px;break-inside:avoid}
.assin div{border-top:1.5px solid var(--preto);padding-top:5px;text-align:center;font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--cinza)}
.aviso{padding:4px 22px 8px;font-size:10px;color:var(--cinza);line-height:1.5;margin:0}
.rodape{border-top:3px solid var(--vermelho);padding:6px 22px;display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:#4a4a52}
.rodape b{color:var(--preto);font-family:'Barlow Condensed',sans-serif;letter-spacing:2px}
`;

// OS do pátio: imagem de celular. Layout .cel do mockup (360 px) ampliado 3× para 1080 px de largura.
export const CSS_PATIO = `${CSS_VARS}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{width:1080px;font-family:'Barlow',Arial,sans-serif;color:var(--tinta)}
.mono{font-family:'Roboto Mono',monospace}
.cel{width:360px;zoom:3;background:#fff}
.cel .cab{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:3px solid var(--vermelho)}
.cel .cab img{width:92px;filter:drop-shadow(0 0 .6px #000) drop-shadow(0 0 .6px #000)}
.cel .cab div{text-align:right;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:1.5px;font-size:12px;color:var(--cinza)}
.cel .cab div b{display:block;font-size:22px;color:var(--preto);letter-spacing:1px}
.cel .carro{padding:10px 14px;display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--linha)}
.cel .placa{border:2px solid var(--preto);border-radius:5px;overflow:hidden;width:130px;flex:none}
.cel .placa .tarja{border-bottom:2px solid var(--preto);font-size:8px;letter-spacing:2.6px;text-transform:uppercase;text-align:center;padding:1px 0;font-family:'Barlow Condensed',sans-serif;font-weight:700}
.cel .placa .num{font-family:'Roboto Mono',monospace;font-weight:700;font-size:19px;letter-spacing:3px;text-align:center;padding:4px 0 5px;color:var(--preto)}
.cel .carro p{margin:0;font-size:14px;font-weight:600;line-height:1.25}
.cel .carro p small{display:block;font-weight:400;color:var(--cinza);font-size:12px}
.cel .chips{display:flex;gap:6px;padding:10px 14px;flex-wrap:wrap}
.cel .chip{border:1.5px solid var(--preto);border-radius:4px;padding:4px 8px;font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:.8px;text-transform:uppercase}
.cel .chip.alta{border-color:var(--vermelho);background:var(--vermelho);color:#fff}
.cel .sec{padding:6px 14px 10px}
.cel h4{margin:0 0 6px;font-family:'Barlow Condensed',sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:14px;display:flex;gap:7px;align-items:center}
.cel h4::before{content:"";width:10px;height:10px;background:var(--vermelho)}
.cel ul{margin:0;padding:0;list-style:none}
.cel li{font-size:15px;padding:6px 0 6px 26px;border-bottom:1px solid var(--linha);position:relative;line-height:1.25}
.cel li::before{content:"";position:absolute;left:0;top:7px;width:15px;height:15px;border:2px solid var(--preto);border-radius:3px}
.cel li small{color:var(--cinza);font-family:'Roboto Mono',monospace;font-size:11.5px}
.cel .alerta{margin:4px 14px 12px;border-left:4px solid var(--vermelho);background:#fff3f3;padding:8px 10px;font-size:13.5px}
.cel .pe{background:#f4f4f5;padding:8px 14px;font-size:11.5px;color:#4a4a52;display:flex;justify-content:space-between}
`;
