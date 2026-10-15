#!/usr/bin/env node
// oficina-mcp — servidor MCP (stdio) que repassa as chamadas do Arnaldo à edge function arnaldo-api.
// A API decide o papel e o que cada um pode ver; este processo só repassa o `caller` (assinado pelo
// plugin md_arnaldo do Hermes) e os argumentos.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS } from './tools.mjs';
import { prepararFoto, FotoErro } from './foto.mjs';

const API_URL = (process.env.ARNALDO_API_URL || '').replace(/\/$/, '');
const TOKEN = process.env.ARNALDO_API_TOKEN || '';
const ANON = process.env.ARNALDO_SUPABASE_ANON || '';
const TOOL_NAMES = new Set(TOOLS.map(t => t.name));

const texto = obj => ({ type: 'text', text: JSON.stringify(obj) });
const falha = (erro, mensagem) => ({ ok: false, erro, mensagem, nao_diga_que_fez: true });
const FORA_DO_AR = 'Sistema da oficina fora do ar agora. NÃO diga que foi feito.';

// Erros que são do SISTEMA (não resposta de negócio): o Hermes os trata como falha de ferramenta.
const ERROS_DE_SISTEMA = new Set(['erro_interno', 'token_invalido', 'assinatura_invalida']);

export async function forward(name, rawArgs, { fetchImpl = fetch, apiUrl = API_URL, token = TOKEN, anon = ANON, prepararFotoImpl = null } = {}) {
  if (!TOOL_NAMES.has(name)) return { isError: true, content: [texto(falha('acao_desconhecida', `Ferramenta desconhecida: ${name}`))] };
  if (!apiUrl || !token) return { isError: true, content: [texto(falha('erro_interno', 'Sistema da oficina não configurado (API). NÃO diga que foi feito.'))] };
  let args = { ...(rawArgs || {}) };
  const caller = args.caller;
  delete args.caller;
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
    const headers = { 'content-type': 'application/json', 'x-arnaldo-token': token };
    if (anon) headers.authorization = `Bearer ${anon}`;
    const res = await fetchImpl(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ acao: name, args, caller }),
      signal: AbortSignal.timeout(name === 'anexar_foto' ? 35000 : 25000),
    });
    const bruto = await res.text();
    let corpo;
    try {
      corpo = JSON.parse(bruto);
    } catch {
      return { isError: true, content: [texto(falha('erro_interno', `Resposta inválida do sistema da oficina (${res.status}). NÃO diga que foi feito.`))] };
    }
    const isError = corpo?.ok === false && ERROS_DE_SISTEMA.has(corpo.erro);
    // A resposta da API vai INTEIRA para o modelo (inclusive nao_diga_que_fez).
    return { isError, content: [{ type: 'text', text: JSON.stringify(corpo) }] };
  } catch (err) {
    return { isError: true, content: [texto(falha('erro_interno', FORA_DO_AR))] };
  }
}

async function main() {
  const server = new Server({ name: 'oficina', version: '1.0.0' }, { capabilities: { tools: {} } });
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
