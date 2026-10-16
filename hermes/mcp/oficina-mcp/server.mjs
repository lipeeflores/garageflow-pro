#!/usr/bin/env node
// oficina-mcp — servidor MCP (stdio) que repassa as chamadas do Arnaldo à edge function arnaldo-api.
// A API decide o papel e o que cada um pode ver; este processo só repassa o `caller` (assinado pelo
// plugin md_arnaldo do Hermes) e os argumentos. Duas ferramentas rodam aqui mesmo: consultar_placa
// (curl) e gerar_documento (dados da API → HTML → Gotenberg → arquivo no cache do perfil).
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS } from './tools.mjs';
import { prepararFoto, FotoErro } from './foto.mjs';
import { gerarDocumento } from './documentos.mjs';
import { consultarPlaca } from './placa.mjs';

const API_URL = (process.env.ARNALDO_API_URL || '').replace(/\/$/, '');
const TOKEN = process.env.ARNALDO_API_TOKEN || '';
const ANON = process.env.ARNALDO_SUPABASE_ANON || '';
const TOOL_NAMES = new Set(TOOLS.map(t => t.name));

const texto = obj => ({ type: 'text', text: JSON.stringify(obj) });
const falha = (erro, mensagem) => ({ ok: false, erro, mensagem, nao_diga_que_fez: true });
const FORA_DO_AR = 'Sistema da oficina fora do ar agora. NÃO diga que foi feito.';

// Erros que são do SISTEMA (não resposta de negócio): o Hermes os trata como falha de ferramenta.
const ERROS_DE_SISTEMA = new Set(['erro_interno', 'token_invalido', 'assinatura_invalida', 'gerador_indisponivel']);

/** POST na arnaldo-api. Lança em erro de rede/timeout; resposta que não é JSON vira erro_interno. */
export async function chamarApi(acao, args, caller, { fetchImpl = fetch, apiUrl = API_URL, token = TOKEN, anon = ANON, timeoutMs = 25000 } = {}) {
  const headers = { 'content-type': 'application/json', 'x-arnaldo-token': token };
  if (anon) headers.authorization = `Bearer ${anon}`;
  const res = await fetchImpl(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ acao, args, caller }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const bruto = await res.text();
  try {
    return JSON.parse(bruto);
  } catch {
    return falha('erro_interno', `Resposta inválida do sistema da oficina (${res.status}). NÃO diga que foi feito.`);
  }
}

const resultado = corpo => ({ isError: corpo?.ok === false && ERROS_DE_SISTEMA.has(corpo.erro), content: [{ type: 'text', text: JSON.stringify(corpo) }] });

export async function forward(name, rawArgs, {
  fetchImpl = fetch, apiUrl = API_URL, token = TOKEN, anon = ANON, prepararFotoImpl = null, docDeps = {}, placaDeps = {},
} = {}) {
  if (!TOOL_NAMES.has(name)) return { isError: true, content: [texto(falha('acao_desconhecida', `Ferramenta desconhecida: ${name}`))] };
  let args = { ...(rawArgs || {}) };
  const caller = args.caller;
  delete args.caller;

  // Roda aqui, sem API: dado público do veículo, qualquer papel.
  if (name === 'consultar_placa') return resultado(await consultarPlaca(args, placaDeps));

  if (!apiUrl || !token) return { isError: true, content: [texto(falha('erro_interno', 'Sistema da oficina não configurado (API). NÃO diga que foi feito.'))] };
  const cfg = { fetchImpl, apiUrl, token, anon };

  if (name === 'gerar_documento') {
    const deps = { chamarApi: (acao, a, c) => chamarApi(acao, a, c, cfg), fetchImpl, ...docDeps };
    return resultado(await gerarDocumento(args, caller, deps));
  }

  if (name === 'anexar_foto') {
    // Só este processo enxerga o cache de imagens do perfil: lê o arquivo e manda os bytes à API.
    try {
      args = await (prepararFotoImpl || prepararFoto)(args);
    } catch (err) {
      if (err instanceof FotoErro) return { isError: false, content: [texto(falha('dados_invalidos', err.message))] };
      return { isError: true, content: [texto(falha('erro_interno', 'Não consegui ler a foto neste servidor. NÃO diga que foi anexada.'))] };
    }
  }
  try {
    // A resposta da API vai INTEIRA para o modelo (inclusive nao_diga_que_fez).
    return resultado(await chamarApi(name, args, caller, { ...cfg, timeoutMs: name === 'anexar_foto' ? 35000 : 25000 }));
  } catch {
    return { isError: true, content: [texto(falha('erro_interno', FORA_DO_AR))] };
  }
}

async function main() {
  const server = new Server({ name: 'oficina', version: '1.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async req => forward(req.params.name, req.params.arguments));
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().catch(err => {
    console.error('[oficina-mcp] fatal:', err);
    process.exit(1);
  });
}
