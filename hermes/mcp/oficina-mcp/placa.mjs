// consultar_placa: marca, modelo, ano, cor, motor e município de uma placa (dado público do veículo),
// pelo tabelafipebrasil.com. O fetch do Node toma 403 do Cloudflare; o `curl` do container passa
// (testado em 15/10/2026), então a consulta é feita com curl via execFile e User-Agent de navegador.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DIR_PLACAS = '/root/.hermes/profiles/arnaldo-md-mecanica/cache/placas';
export const URL_BASE = 'https://www.tabelafipebrasil.com/placa/';
export const VALIDADE_CACHE_MS = 30 * 24 * 3600 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const falha = (erro, mensagem) => ({ ok: false, erro, mensagem, nao_diga_que_fez: true });
const INDISPONIVEL = falha('placa_indisponivel', 'Não consegui consultar essa placa agora. Pergunte marca, modelo e ano ao cliente e siga com o cadastro normal.');

export function normalizarPlaca(p) {
  return String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
const PLACA_VALIDA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/; // antiga (ABC1234) e Mercosul (ABC1D23)

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const limpar = html => html.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTIDADES[m]).replace(/\s+/g, ' ').trim();
const titulo = s => s.toLocaleLowerCase('pt-BR').replace(/(^|[\s/-])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('pt-BR'));

/**
 * Extrai os dados do HTML da página. Devolve null se o formato não for o conhecido
 * (Cloudflare "Just a moment", página sem a tabela de detalhes, etc.).
 */
export function parsePlaca(html) {
  if (!html || /Just a moment|cf-chl|Attention Required/i.test(html.slice(0, 20000))) return null;
  const tabela = /<table[^>]*fipeTablePriceDetail[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!tabela) return null;
  const campos = {};
  for (const linha of tabela[1].matchAll(/<tr>\s*<td[^>]*>\s*<b>\s*([^<:]+?)\s*:?\s*<\/b>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    campos[limpar(linha[1]).toLowerCase()] = limpar(linha[2]);
  }
  if (!campos.marca || !campos.modelo) return null;
  const numero = v => (/^\d{4}$/.test(v ?? '') ? Number(v) : null);
  const motor = [campos.cilindrada, campos.potencia].filter(Boolean).join(' · ');
  const dado = {
    marca: campos.marca,
    modelo: campos.modelo,
    ano: numero(campos['ano modelo']) ?? numero(campos.ano),
    ano_fabricacao: numero(campos.ano),
    cor: campos.cor ? titulo(campos.cor) : null,
    combustivel: campos['combustível'] || campos.combustivel ? titulo(campos['combustível'] || campos.combustivel) : null,
    motor: motor || null,
    municipio: campos.municipio || campos['município'] || null,
    uf: campos.uf || null,
  };
  return dado;
}

function curl(url, exec) {
  return new Promise((resolve, reject) => {
    exec('curl', ['-s', '-L', '-m', '20', '-A', UA, '-H', 'Accept-Language: pt-BR,pt;q=0.9', '-w', '\n__HTTP_%{http_code}', url],
      { maxBuffer: 8 * 1024 * 1024, timeout: 25000 }, (err, stdout) => (err ? reject(err) : resolve(String(stdout))));
  });
}

/** deps: { exec = execFile, dirCache = DIR_PLACAS, agora = Date.now } */
export async function consultarPlaca(rawArgs, { exec = execFile, dirCache = DIR_PLACAS, agora = Date.now } = {}) {
  const placa = normalizarPlaca(rawArgs?.placa);
  if (!PLACA_VALIDA.test(placa)) return falha('dados_invalidos', 'Placa inválida. Confira com o cliente (3 letras e 4 caracteres, ex.: ABC1D23).');

  const arquivo = path.join(dirCache, `${placa}.json`);
  try {
    const em_cache = JSON.parse(await fs.readFile(arquivo, 'utf8'));
    if (agora() - Date.parse(em_cache.consultado_em) < VALIDADE_CACHE_MS) return { ok: true, ...em_cache, de_cache: true };
  } catch { /* sem cache ou ilegível: consulta de novo */ }

  let saida;
  try {
    saida = await curl(`${URL_BASE}${placa}`, exec);
  } catch {
    return INDISPONIVEL;
  }
  const corte = saida.lastIndexOf('\n__HTTP_');
  const codigo = corte >= 0 ? saida.slice(corte + 8).trim() : '';
  const html = corte >= 0 ? saida.slice(0, corte) : saida;
  if (codigo !== '200') return INDISPONIVEL; // 403 do Cloudflare, 404, 5xx…
  const dado = parsePlaca(html);
  if (!dado) return INDISPONIVEL;

  const resultado = { placa, ...dado, fonte: 'tabelafipebrasil.com', consultado_em: new Date(agora()).toISOString() };
  try {
    await fs.mkdir(dirCache, { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(resultado), { mode: 0o644 });
  } catch { /* cache é só otimização */ }
  return { ok: true, ...resultado, aviso: 'Dado público do cadastro do veículo: confirme com o cliente antes de gravar.' };
}
