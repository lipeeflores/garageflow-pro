import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { forward } from '../server.mjs';
import { TOOLS, TOOLS_P0, TOOLS_P1 } from '../tools.mjs';
import { prepararFoto, FotoErro } from '../foto.mjs';

const URL_API = 'https://exemplo.supabase.co/functions/v1/arnaldo-api';
const CFG = { apiUrl: URL_API, token: 'tok123', anon: 'anon456' };
const CALLER = { phone: '5547984889108', session_id: 's1', ts: 1000000, sig: 'abc' };

const resposta = (corpo, status = 200) => ({ status, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) });
const texto = r => JSON.parse(r.content[0].text);

test('manda os headers do contrato e o corpo { acao, args, caller } sem caller dentro de args', async () => {
  let visto;
  const fetchImpl = async (url, init) => { visto = { url, init }; return resposta({ ok: true, dados: { horarios: [] } }); };
  const r = await forward('horarios_livres', { de: '2026-10-20', reason: 'x', caller: CALLER }, { ...CFG, fetchImpl });
  assert.equal(visto.url, URL_API);
  assert.equal(visto.init.method, 'POST');
  assert.equal(visto.init.headers['x-arnaldo-token'], 'tok123');
  assert.equal(visto.init.headers.authorization, 'Bearer anon456');
  assert.equal(visto.init.headers['content-type'], 'application/json');
  const corpo = JSON.parse(visto.init.body);
  assert.equal(corpo.acao, 'horarios_livres');
  assert.deepEqual(corpo.caller, CALLER);
  assert.equal(corpo.args.caller, undefined);
  assert.equal(corpo.args.de, '2026-10-20');
  assert.equal(r.isError, false);
  assert.deepEqual(texto(r), { ok: true, dados: { horarios: [] } });
});

test('resposta de negócio vai inteira para o modelo e não é erro de ferramenta', async () => {
  const neg = { ok: false, erro: 'conflito_agenda', mensagem: 'Lotado. Livres: 10:00', nao_diga_que_fez: true };
  const r = await forward('agendar', { placa: 'ABC1D23' }, { ...CFG, fetchImpl: async () => resposta(neg) });
  assert.equal(r.isError, false);
  assert.deepEqual(texto(r), neg);
});

test('erro de sistema da API (erro_interno, token) marca isError', async () => {
  for (const erro of ['erro_interno', 'token_invalido', 'assinatura_invalida']) {
    const r = await forward('quem_sou', {}, { ...CFG, fetchImpl: async () => resposta({ ok: false, erro, mensagem: 'x', nao_diga_que_fez: true }, erro === 'token_invalido' ? 401 : 200) });
    assert.equal(r.isError, true, erro);
    assert.equal(texto(r).erro, erro);
  }
});

test('timeout ou falha de rede devolvem o erro padronizado', async () => {
  const timeout = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
  const rede = async () => { throw new TypeError('fetch failed'); };
  for (const fetchImpl of [timeout, rede]) {
    const r = await forward('meus_dados', {}, { ...CFG, fetchImpl });
    assert.equal(r.isError, true);
    assert.deepEqual(texto(r), {
      ok: false, erro: 'erro_interno', mensagem: 'Sistema da oficina fora do ar agora. NÃO diga que foi feito.', nao_diga_que_fez: true,
    });
  }
});

test('resposta que não é JSON (HTML de erro do gateway) vira erro_interno', async () => {
  const r = await forward('meus_dados', {}, { ...CFG, fetchImpl: async () => resposta('<html>502</html>', 502) });
  assert.equal(r.isError, true);
  assert.equal(texto(r).erro, 'erro_interno');
  assert.equal(texto(r).nao_diga_que_fez, true);
});

test('sem URL ou token não chama a API', async () => {
  let chamou = false;
  const fetchImpl = async () => { chamou = true; return resposta({ ok: true }); };
  const r = await forward('meus_dados', {}, { ...CFG, token: '', fetchImpl });
  assert.equal(chamou, false);
  assert.equal(texto(r).erro, 'erro_interno');
});

test('ferramenta desconhecida é recusada sem chamar a API', async () => {
  let chamou = false;
  const r = await forward('apagar_tudo', {}, { ...CFG, fetchImpl: async () => { chamou = true; return resposta({ ok: true }); } });
  assert.equal(chamou, false);
  assert.equal(r.isError, true);
  assert.equal(texto(r).erro, 'acao_desconhecida');
});

test('toda ferramenta aceita reason, nenhuma expõe caller, e o catálogo P0 bate com o contrato', () => {
  for (const t of [...TOOLS_P0, ...TOOLS_P1]) {
    assert.ok(t.inputSchema.properties.reason, `${t.name} sem reason`);
    assert.equal(t.inputSchema.properties.caller, undefined, `${t.name} expõe caller`);
    assert.ok(t.description.length > 40, `${t.name} sem descrição`);
    for (const obrig of t.inputSchema.required) assert.ok(t.inputSchema.properties[obrig], `${t.name}: obrigatório ${obrig} fora do schema`);
  }
  assert.deepEqual(TOOLS_P0.map(t => t.name), [
    'quem_sou', 'meus_dados', 'cadastrar_cliente_veiculo', 'status_do_carro', 'horarios_livres', 'agendar',
    'meus_agendamentos', 'remarcar', 'cancelar_agendamento', 'agenda_do_dia', 'buscar', 'ver_os', 'abrir_os',
    'registrar_checkin', 'anexar_foto', 'registrar_diagnostico', 'adicionar_itens', 'mover_etapa', 'atribuir',
  ]);
  // P1 fica desligado por padrão (a API pode não ter essas ações na segunda).
  assert.deepEqual(TOOLS.map(t => t.name), TOOLS_P0.map(t => t.name));
  const nomes = TOOLS_P0.map(t => t.name);
  assert.equal(new Set(nomes).size, nomes.length);
});

// -- anexar_foto --------------------------------------------------------------

async function pastaDeCache() {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'oficina-mcp-'));
  const cache = path.join(raiz, 'cache', 'images');
  await fs.mkdir(cache, { recursive: true });
  return { raiz, cache };
}

test('anexar_foto lê o arquivo do cache e manda imagem_base64 + mime, sem caminho_imagem', async () => {
  const { cache } = await pastaDeCache();
  const arq = path.join(cache, 'img_abc.jpg');
  await fs.writeFile(arq, Buffer.from([1, 2, 3, 4]));
  let corpo;
  const fetchImpl = async (_u, init) => { corpo = JSON.parse(init.body); return resposta({ ok: true, dados: { anexo_id: 'a1' } }); };
  const r = await forward('anexar_foto', { os_id: 'o1', tipo: 'CHECKIN_PHOTO', caminho_imagem: arq, imagem_base64: 'FORJADO', mime: 'text/html', caller: CALLER },
    { ...CFG, fetchImpl, prepararFotoImpl: a => prepararFoto(a, { dirs: [cache] }) });
  assert.equal(r.isError, false);
  assert.equal(corpo.args.caminho_imagem, undefined);
  assert.equal(corpo.args.imagem_base64, Buffer.from([1, 2, 3, 4]).toString('base64'));
  assert.equal(corpo.args.mime, 'image/jpeg');
  assert.equal(corpo.args.os_id, 'o1');
  assert.deepEqual(corpo.caller, CALLER);
});

test('anexar_foto recusa caminho fora do image_cache e não chama a API', async () => {
  const { raiz, cache } = await pastaDeCache();
  const fora = path.join(raiz, 'segredo.jpg');
  await fs.writeFile(fora, 'x');
  let chamou = false;
  const fetchImpl = async () => { chamou = true; return resposta({ ok: true }); };
  const cfg = { ...CFG, fetchImpl, prepararFotoImpl: a => prepararFoto(a, { dirs: [cache] }) };
  for (const caminho of [fora, path.join(cache, '..', 'segredo.jpg'), '/etc/passwd', 'img_abc.jpg', path.join(cache, 'nao-existe.jpg')]) {
    const r = await forward('anexar_foto', { os_id: 'o1', tipo: 'OTHER', caminho_imagem: caminho }, cfg);
    assert.equal(texto(r).ok, false, caminho);
    assert.equal(texto(r).erro, 'dados_invalidos', caminho);
  }
  assert.equal(chamou, false);
});

test('anexar_foto recusa extensão errada, arquivo grande e vazio', async () => {
  const { cache } = await pastaDeCache();
  const dirs = [cache];
  const txt = path.join(cache, 'img_x.txt');
  await fs.writeFile(txt, 'oi');
  await assert.rejects(prepararFoto({ caminho_imagem: txt }, { dirs }), FotoErro);
  const vazio = path.join(cache, 'img_v.png');
  await fs.writeFile(vazio, '');
  await assert.rejects(prepararFoto({ caminho_imagem: vazio }, { dirs }), FotoErro);
  const grande = path.join(cache, 'img_g.webp');
  await fs.writeFile(grande, Buffer.alloc(8 * 1024 * 1024 + 1));
  await assert.rejects(prepararFoto({ caminho_imagem: grande }, { dirs }), /8 MB/);
  await assert.rejects(prepararFoto({}, { dirs }), FotoErro);
});

test('anexar_foto recusa link simbólico que aponta para fora', async (t) => {
  const { raiz, cache } = await pastaDeCache();
  const fora = path.join(raiz, 'fora.jpg');
  await fs.writeFile(fora, 'x');
  const elo = path.join(cache, 'img_elo.jpg');
  try { await fs.symlink(fora, elo); } catch { t.skip('sem permissão para criar symlink neste sistema'); return; }
  await assert.rejects(prepararFoto({ caminho_imagem: elo }, { dirs: [cache] }), /simbólico/);
});
