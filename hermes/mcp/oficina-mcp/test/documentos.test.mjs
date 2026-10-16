import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gerarDocumento, converter, limparAntigos, DIR_DOCUMENTOS, TIPOS } from '../documentos.mjs';
import { forward } from '../server.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const fixture = async tipo => JSON.parse(await fs.readFile(path.join(AQUI, 'fixtures', `dados-${tipo}.json`), 'utf8'));
const CALLER = { phone: '5547999990001', session_id: 's1', ts: 1, sig: 'x' };
const AGORA = () => new Date('2026-10-16T10:15:00-03:00');

const PDF = Buffer.from('%PDF-1.7 corpo de teste');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('corpo')]);
const resp = (bytes, status = 200) => new Response(status === 200 ? bytes : 'erro', { status });

/** Gotenberg falso: grava o que recebeu e devolve PDF ou PNG conforme a rota. */
function gotenbergFalso({ status = 200, bytes = null, falhar = false } = {}) {
  const chamadas = [];
  const fetchImpl = async (url, init) => {
    if (falhar) throw new Error('ECONNREFUSED');
    const html = await init.body.get('files').text();
    chamadas.push({ url, campos: Object.fromEntries([...init.body.entries()].filter(([k]) => k !== 'files')), html, nomeArquivo: init.body.get('files').name });
    return resp(bytes ?? (url.includes('screenshot') ? PNG : PDF), status);
  };
  return { fetchImpl, chamadas };
}

async function deps(tipo, extra = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-'));
  const chamadasApi = [];
  const g = gotenbergFalso(extra.gotenberg);
  const corpo = extra.corpoApi ?? { ok: true, dados: await fixture(tipo) };
  return {
    dir, chamadasApi, g,
    deps: {
      chamarApi: async (acao, args, caller) => { chamadasApi.push({ acao, args, caller }); if (extra.apiLanca) throw new Error('rede'); return corpo; },
      fetchImpl: g.fetchImpl, gotenbergUrl: 'http://gotenberg.teste:3000', dirSaida: dir, agora: AGORA,
      assets: { logoDataUri: '', fontesCss: '' },
    },
  };
}

test('orçamento: chama a API, converte em PDF A4 e grava o arquivo com legenda e instrução de envio', async () => {
  const { dir, chamadasApi, g, deps: d } = await deps('orcamento');
  const r = await gerarDocumento({ tipo: 'orcamento', numero: 42, reason: 'x' }, CALLER, d);

  assert.equal(r.ok, true);
  assert.deepEqual(chamadasApi, [{ acao: 'dados_documento', args: { tipo: 'orcamento', numero: 42 }, caller: CALLER }]);
  assert.equal(r.caminho, path.join(dir, 'Orcamento-OS0042-MD-Mecanica.pdf'));
  assert.equal(r.nome_arquivo, 'Orcamento-OS0042-MD-Mecanica.pdf');
  assert.equal(r.legenda, 'Orçamento OS 0042 · Volkswagen Gol 1.6 MSI ABC1D23');
  assert.equal(r.como_enviar, `Escreva a mensagem ao cliente e, numa linha própria no fim, MEDIA:${r.caminho}`);
  assert.deepEqual(await fs.readFile(r.caminho), PDF);
  if (process.platform !== 'win32') assert.equal((await fs.stat(r.caminho)).mode & 0o777, 0o644);

  assert.equal(g.chamadas.length, 1);
  const c = g.chamadas[0];
  assert.equal(c.url, 'http://gotenberg.teste:3000/forms/chromium/convert/html');
  assert.equal(c.nomeArquivo, 'index.html');
  assert.deepEqual(c.campos, {
    paperWidth: '8.27', paperHeight: '11.7', marginTop: '0', marginBottom: '0', marginLeft: '0', marginRight: '0',
    printBackground: 'true', preferCssPageSize: 'true', waitDelay: '1s',
  });
  assert.match(c.html, /R\$ 834,00/);
  assert.match(c.html, /class="qr"/); // QR do link de aprovação
});

test('os_patio vira PNG de 1080 px, pela rota de screenshot, e o HTML enviado não tem dinheiro', async () => {
  const { g, deps: d } = await deps('os_patio');
  const r = await gerarDocumento({ tipo: 'os_patio', placa: 'ABC1D23' }, CALLER, d);
  assert.equal(r.ok, true);
  assert.match(r.caminho, /OS-do-patio-OS0042-MD-Mecanica\.png$/);
  assert.equal(r.legenda, 'OS do pátio OS 0042 · Volkswagen Gol 1.6 MSI ABC1D23');
  const c = g.chamadas[0];
  assert.equal(c.url, 'http://gotenberg.teste:3000/forms/chromium/screenshot/html');
  assert.equal(c.campos.width, '1080');
  assert.equal(c.campos.format, 'png');
  assert.doesNotMatch(c.html, /R\$|\d+,\d{2}/);
});

test('ficha e recibo: PDF; cada um com o nome do tipo', async () => {
  for (const [tipo, nome] of [['ficha_entrada', 'Ficha-de-entrada-OS0042-MD-Mecanica.pdf'], ['recibo', 'Recibo-OS0042-MD-Mecanica.pdf']]) {
    const { deps: d } = await deps(tipo);
    const r = await gerarDocumento({ tipo, os_id: 'abc' }, CALLER, d);
    assert.equal(r.nome_arquivo, nome);
  }
});

test('erro da API é repassado inteiro e nada é gerado', async () => {
  const envelope = { ok: false, erro: 'sem_permissao', mensagem: 'Esse documento é só da gestão.', nao_diga_que_fez: true };
  const { g, dir, deps: d } = await deps('recibo', { corpoApi: envelope });
  const r = await gerarDocumento({ tipo: 'recibo', numero: 42 }, CALLER, d);
  assert.deepEqual(r, envelope);
  assert.equal(g.chamadas.length, 0);
  assert.deepEqual(await fs.readdir(dir), []);
});

test('API fora do ar → erro_interno com nao_diga_que_fez', async () => {
  const { deps: d } = await deps('orcamento', { apiLanca: true });
  const r = await gerarDocumento({ tipo: 'orcamento', numero: 42 }, CALLER, d);
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'erro_interno');
  assert.equal(r.nao_diga_que_fez, true);
});

test('Gotenberg fora, com erro ou devolvendo lixo → gerador_indisponivel, sem arquivo', async () => {
  const casos = [{ falhar: true }, { status: 500 }, { bytes: Buffer.from('<html>nao sou pdf</html>') }];
  for (const gotenberg of casos) {
    const { dir, deps: d } = await deps('orcamento', { gotenberg });
    const r = await gerarDocumento({ tipo: 'orcamento', numero: 42 }, CALLER, d);
    assert.equal(r.ok, false, JSON.stringify(gotenberg));
    assert.equal(r.erro, 'gerador_indisponivel');
    assert.equal(r.nao_diga_que_fez, true);
    assert.deepEqual(await fs.readdir(dir), []);
  }
});

test('argumentos inválidos: tipo desconhecido e sem alvo, sem chamar a API', async () => {
  const { chamadasApi, deps: d } = await deps('orcamento');
  const a = await gerarDocumento({ tipo: 'contrato', numero: 1 }, CALLER, d);
  assert.equal(a.erro, 'dados_invalidos');
  const b = await gerarDocumento({ tipo: 'orcamento' }, CALLER, d);
  assert.equal(b.erro, 'dados_invalidos');
  assert.equal(chamadasApi.length, 0);
});

test('limpeza: apaga só documentos NOSSOS com mais de 30 dias (a pasta é do Hermes também)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-'));
  const velho = Date.now() - 31 * 24 * 3600 * 1000;
  const mk = async (nome, mtime) => { const p = path.join(dir, nome); await fs.writeFile(p, 'x'); await fs.utimes(p, new Date(mtime), new Date(mtime)); };
  await mk('Orcamento-OS0001-MD-Mecanica.pdf', velho);
  await mk('Recibo-OS0002-MD-Mecanica.pdf', Date.now());
  await mk('doc_abc123_relatorio.pdf', velho); // arquivo do Hermes: nunca apagar
  await mk('img_antigo.jpg', velho);
  assert.equal(await limparAntigos(dir), 1);
  assert.deepEqual((await fs.readdir(dir)).sort(), ['Recibo-OS0002-MD-Mecanica.pdf', 'doc_abc123_relatorio.pdf', 'img_antigo.jpg']);
  assert.equal(await limparAntigos(path.join(dir, 'nao-existe')), 0);
});

test('o destino padrão é uma pasta de onde o Hermes aceita entregar MEDIA (cache/documents do perfil)', () => {
  assert.equal(DIR_DOCUMENTOS, '/root/.hermes/profiles/arnaldo-md-mecanica/cache/documents');
  assert.deepEqual(Object.keys(TIPOS), ['orcamento', 'ficha_entrada', 'os_patio', 'recibo']);
});

test('converter recusa resposta com tipo de arquivo errado', async () => {
  const { fetchImpl } = gotenbergFalso({ bytes: PNG });
  await assert.rejects(converter('orcamento', '<html></html>', { fetchImpl, gotenbergUrl: 'http://x' }), /inválido/);
});

test('pelo MCP (forward): gerar_documento usa o caller, os headers do contrato e devolve o resultado', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-'));
  const g = gotenbergFalso();
  let visto;
  const fetchImpl = async (url, init) => {
    if (url === 'https://api.teste/arnaldo') {
      visto = { headers: init.headers, corpo: JSON.parse(init.body) };
      return new Response(JSON.stringify({ ok: true, dados: await fixture('ficha_entrada') }), { status: 200 });
    }
    return g.fetchImpl(url, init);
  };
  const r = await forward('gerar_documento', { tipo: 'ficha_entrada', numero: 42, caller: CALLER }, {
    fetchImpl, apiUrl: 'https://api.teste/arnaldo', token: 'tok', anon: 'anon',
    docDeps: { gotenbergUrl: 'http://g:3000', dirSaida: dir, agora: AGORA, assets: { logoDataUri: '', fontesCss: '' } },
  });
  assert.equal(r.isError, false);
  const corpo = JSON.parse(r.content[0].text);
  assert.equal(corpo.ok, true);
  assert.equal(corpo.nome_arquivo, 'Ficha-de-entrada-OS0042-MD-Mecanica.pdf');
  assert.equal(visto.headers['x-arnaldo-token'], 'tok');
  assert.equal(visto.corpo.acao, 'dados_documento');
  assert.deepEqual(visto.corpo.args, { tipo: 'ficha_entrada', numero: 42 });
  assert.deepEqual(visto.corpo.caller, CALLER);
});

test('pelo MCP: gerador fora do ar marca isError; erro de negócio da API não marca', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-'));
  const base = { apiUrl: 'https://api.teste/arnaldo', token: 'tok', docDeps: { gotenbergUrl: 'http://g:3000', dirSaida: dir, agora: AGORA, assets: { logoDataUri: '', fontesCss: '' } } };
  const ok = async () => new Response(JSON.stringify({ ok: true, dados: await fixture('recibo') }), { status: 200 });
  const queda = async url => (url === base.apiUrl ? ok() : Promise.reject(new Error('gotenberg fora')));
  const r1 = await forward('gerar_documento', { tipo: 'recibo', numero: 42 }, { ...base, fetchImpl: queda });
  assert.equal(r1.isError, true);
  assert.equal(JSON.parse(r1.content[0].text).erro, 'gerador_indisponivel');

  const negocio = async () => new Response(JSON.stringify({ ok: false, erro: 'etapa_invalida', mensagem: 'Sem pagamento.', nao_diga_que_fez: true }));
  const r2 = await forward('gerar_documento', { tipo: 'recibo', numero: 42 }, { ...base, fetchImpl: negocio });
  assert.equal(r2.isError, false);
  assert.equal(JSON.parse(r2.content[0].text).erro, 'etapa_invalida');
});
