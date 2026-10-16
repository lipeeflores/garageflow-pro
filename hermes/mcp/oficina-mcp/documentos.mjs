// gerar_documento: dados da API → HTML do modelo → Gotenberg (PDF/PNG) → arquivo no cache do perfil.
// O destino é <perfil>/cache/documents (e não cache/documentos, como previa o plano): essas pastas de cache
// (images, audio, videos, documents, screenshots) são as que o Hermes entrega SEMPRE por MEDIA:<caminho>
// (gateway/platforms/base.py, validate_media_delivery_path). No modo padrão de hoje qualquer arquivo fora da lista de
// negados também passa (testado: cache/documentos entrega), mas com HERMES_MEDIA_DELIVERY_STRICT=1 só o cache vale.
import fs from 'node:fs/promises';
import path from 'node:path';

import { render as orcamento } from './templates/orcamento.mjs';
import { render as fichaEntrada } from './templates/ficha_entrada.mjs';
import { render as osPatio } from './templates/os_patio.mjs';
import { render as recibo } from './templates/recibo.mjs';
import { carregarAssets, qrDataUri } from './templates/assets.mjs';
import { placaFmt, veiculoNome } from './templates/base.mjs';

export const DIR_DOCUMENTOS = '/root/.hermes/profiles/arnaldo-md-mecanica/cache/documents';
export const GOTENBERG_URL = 'http://md-gotenberg:3000';
export const TIMEOUT_GOTENBERG_MS = 40000;
export const VALIDADE_ARQUIVO_MS = 30 * 24 * 3600 * 1000;

export const TIPOS = {
  orcamento: { ext: 'pdf', rotulo: 'Orçamento', arquivo: 'Orcamento', render: orcamento },
  ficha_entrada: { ext: 'pdf', rotulo: 'Ficha de entrada', arquivo: 'Ficha-de-entrada', render: fichaEntrada },
  os_patio: { ext: 'png', rotulo: 'OS do pátio', arquivo: 'OS-do-patio', render: osPatio },
  recibo: { ext: 'pdf', rotulo: 'Recibo', arquivo: 'Recibo', render: recibo },
};

const MAGIA = { pdf: Buffer.from('%PDF'), png: Buffer.from([0x89, 0x50, 0x4e, 0x47]) };
const NOSSOS = /^(Orcamento|Ficha-de-entrada|OS-do-patio|Recibo)-OS\d+-MD-Mecanica\.(pdf|png)$/;

const falha = (erro, mensagem) => ({ ok: false, erro, mensagem, nao_diga_que_fez: true });

/** HTML completo do tipo pedido. `assets`: { logoDataUri, fontesCss, qrDataUri?, agora? }. */
export function montarHtml(tipo, dados, assets) {
  return TIPOS[tipo].render(dados, assets);
}

/** HTML → bytes (PDF A4 ou PNG de 1080 px) pelo Gotenberg. Lança Error se der qualquer problema. */
export async function converter(tipo, html, { fetchImpl = fetch, gotenbergUrl = GOTENBERG_URL, timeoutMs = TIMEOUT_GOTENBERG_MS } = {}) {
  const { ext } = TIPOS[tipo];
  const form = new FormData();
  form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
  let rota;
  if (ext === 'pdf') {
    rota = '/forms/chromium/convert/html';
    for (const [k, v] of Object.entries({
      paperWidth: '8.27', paperHeight: '11.7', marginTop: '0', marginBottom: '0', marginLeft: '0', marginRight: '0',
      printBackground: 'true', preferCssPageSize: 'true', waitDelay: '1s',
    })) form.append(k, v);
  } else {
    rota = '/forms/chromium/screenshot/html';
    for (const [k, v] of Object.entries({ width: '1080', format: 'png', waitDelay: '1s' })) form.append(k, v);
  }
  const res = await fetchImpl(`${gotenbergUrl.replace(/\/$/, '')}${rota}`, { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`gotenberg respondeu ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.subarray(0, MAGIA[ext].length).equals(MAGIA[ext])) throw new Error('gotenberg devolveu arquivo inválido');
  return bytes;
}

/** Apaga só os documentos que ESTE módulo gerou, com mais de 30 dias (a pasta é compartilhada com o Hermes). */
export async function limparAntigos(dir, agora = Date.now()) {
  let nomes = [];
  try { nomes = await fs.readdir(dir); } catch { return 0; }
  let apagados = 0;
  for (const nome of nomes) {
    if (!NOSSOS.test(nome)) continue;
    try {
      const st = await fs.stat(path.join(dir, nome));
      if (agora - st.mtimeMs > VALIDADE_ARQUIVO_MS) { await fs.unlink(path.join(dir, nome)); apagados++; }
    } catch { /* outro processo apagou */ }
  }
  return apagados;
}

/**
 * deps: { chamarApi(acao, args, caller) → corpo da API, fetchImpl, gotenbergUrl, dirSaida, agora(): Date,
 *         assets: {logoDataUri, fontesCss}, qr(link) → data URI }
 */
export async function gerarDocumento(rawArgs, caller, deps) {
  const args = rawArgs || {};
  const tipo = String(args.tipo ?? '');
  if (!TIPOS[tipo]) return falha('dados_invalidos', `Tipo de documento inválido. Use: ${Object.keys(TIPOS).join(', ')}.`);
  const alvo = {};
  if (args.os_id) alvo.os_id = String(args.os_id);
  if (args.placa) alvo.placa = String(args.placa);
  if (args.numero !== undefined && args.numero !== null && args.numero !== '') alvo.numero = args.numero;
  if (!Object.keys(alvo).length) return falha('dados_invalidos', 'Informe a OS por os_id, por placa ou pelo número da OS.');

  let corpo;
  try {
    corpo = await deps.chamarApi('dados_documento', { tipo, ...alvo }, caller);
  } catch {
    return falha('erro_interno', 'Sistema da oficina fora do ar agora. NÃO diga que o documento foi gerado.');
  }
  if (!corpo || corpo.ok !== true) return corpo && typeof corpo === 'object' ? corpo : falha('erro_interno', 'Resposta inválida do sistema da oficina. NÃO diga que o documento foi gerado.');

  const dados = corpo.dados;
  const agora = (deps.agora ? deps.agora() : new Date());
  let bytes;
  try {
    const qr = tipo === 'orcamento' ? await (deps.qr || qrDataUri)(dados.link_aprovacao) : '';
    const assets = { ...(deps.assets || carregarAssets()), qrDataUri: qr, agora };
    bytes = await converter(tipo, montarHtml(tipo, dados, assets), deps);
  } catch (err) {
    return falha('gerador_indisponivel', 'Não consegui gerar o documento agora. NÃO diga que foi gerado; avise que vai pedir ajuda à equipe.');
  }

  const { ext, rotulo, arquivo } = TIPOS[tipo];
  const dir = deps.dirSaida || DIR_DOCUMENTOS;
  const nomeArquivo = `${arquivo}-OS${dados.os.numero_fmt}-MD-Mecanica.${ext}`;
  const caminho = path.join(dir, nomeArquivo);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(caminho, bytes, { mode: 0o644 });
    await fs.chmod(caminho, 0o644);
    await limparAntigos(dir, agora.getTime());
  } catch {
    return falha('erro_interno', 'Não consegui salvar o documento neste servidor. NÃO diga que foi gerado.');
  }

  const carro = [veiculoNome(dados.veiculo), placaFmt(dados.veiculo?.placa)].filter(Boolean).join(' ');
  return {
    ok: true,
    caminho,
    nome_arquivo: nomeArquivo,
    legenda: `${rotulo} OS ${dados.os.numero_fmt} · ${carro}`,
    como_enviar: `Escreva a mensagem ao cliente e, numa linha própria no fim, MEDIA:${caminho}`,
  };
}
