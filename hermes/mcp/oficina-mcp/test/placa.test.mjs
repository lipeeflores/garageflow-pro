import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { consultarPlaca, parsePlaca, normalizarPlaca } from '../placa.mjs';
import { forward } from '../server.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML = await fs.readFile(path.join(AQUI, 'fixtures', 'placa-SXJ6H55.html'), 'utf8');

/** curl falso: devolve `corpo` + o marcador de status que o -w do curl real escreve. */
function execFalso(corpo, status = '200') {
  const chamadas = [];
  const exec = (cmd, args, opts, cb) => { chamadas.push({ cmd, args, opts }); cb(null, `${corpo}\n__HTTP_${status}`); };
  return { exec, chamadas };
}
const dirCache = async () => fs.mkdtemp(path.join(os.tmpdir(), 'placas-'));

test('parser: HTML real salvo como fixture (sem rede)', () => {
  assert.deepEqual(parsePlaca(HTML), {
    marca: 'Land Rover', modelo: 'DEF110 PHEV X', ano: 2024, ano_fabricacao: 2024, cor: 'Preta',
    combustivel: 'Gasolina/Eletrico', motor: '1997 cc · 404 cv', municipio: 'Itapema', uf: 'SC',
  });
});

test('parser: Cloudflare, página sem a tabela e lixo → null', () => {
  assert.equal(parsePlaca('<html><title>Just a moment...</title></html>'), null);
  assert.equal(parsePlaca('<html><body>nada aqui</body></html>'), null);
  assert.equal(parsePlaca(''), null);
  assert.equal(parsePlaca(null), null);
});

test('consulta com curl (execFile), User-Agent de navegador e URL da placa normalizada', async () => {
  const { exec, chamadas } = execFalso(HTML);
  const r = await consultarPlaca({ placa: 'sxj-6h55', reason: 'x' }, { exec, dirCache: await dirCache() });
  assert.equal(r.ok, true);
  assert.equal(r.placa, 'SXJ6H55');
  assert.equal(r.marca, 'Land Rover');
  assert.equal(r.modelo, 'DEF110 PHEV X');
  assert.equal(r.ano, 2024);
  assert.equal(r.cor, 'Preta');
  assert.equal(r.uf, 'SC');
  assert.match(r.aviso, /confirme com o cliente/);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].cmd, 'curl');
  const a = chamadas[0].args;
  assert.ok(a.includes('-L') && a.includes('-s'));
  assert.equal(a[a.indexOf('-m') + 1], '20');
  assert.match(a[a.indexOf('-A') + 1], /Mozilla\/5\.0.*Chrome/);
  assert.ok(a.includes('Accept-Language: pt-BR,pt;q=0.9'));
  assert.equal(a[a.length - 1], 'https://www.tabelafipebrasil.com/placa/SXJ6H55');
});

test('cache de 30 dias: segunda consulta não chama o curl; vencido consulta de novo', async () => {
  const dir = await dirCache();
  const a = execFalso(HTML);
  await consultarPlaca({ placa: 'SXJ6H55' }, { exec: a.exec, dirCache: dir });
  const b = execFalso(HTML);
  const r2 = await consultarPlaca({ placa: 'SXJ6H55' }, { exec: b.exec, dirCache: dir });
  assert.equal(r2.ok, true);
  assert.equal(r2.de_cache, true);
  assert.equal(b.chamadas.length, 0);

  const c = execFalso(HTML);
  const daqui31Dias = () => Date.now() + 31 * 24 * 3600 * 1000;
  const r3 = await consultarPlaca({ placa: 'SXJ6H55' }, { exec: c.exec, dirCache: dir, agora: daqui31Dias });
  assert.equal(r3.ok, true);
  assert.equal(c.chamadas.length, 1);
});

test('403, Cloudflare, timeout, erro do curl e formato desconhecido → placa_indisponivel (e não vai para o cache)', async () => {
  const dir = await dirCache();
  const casos = [
    execFalso('<html>Forbidden</html>', '403').exec,
    execFalso('<html><title>Just a moment...</title></html>', '200').exec,
    execFalso('<html>pagina nova sem tabela</html>', '200').exec,
    (cmd, args, opts, cb) => cb(Object.assign(new Error('timeout'), { killed: true })),
  ];
  for (const exec of casos) {
    const r = await consultarPlaca({ placa: 'SXJ6H55' }, { exec, dirCache: dir });
    assert.equal(r.ok, false);
    assert.equal(r.erro, 'placa_indisponivel');
    assert.equal(r.nao_diga_que_fez, true);
  }
  assert.deepEqual(await fs.readdir(dir), []);
});

test('placa inválida não chama o curl', async () => {
  const { exec, chamadas } = execFalso(HTML);
  for (const placa of ['', 'ABC', '1234567', 'AB1D234', null]) {
    const r = await consultarPlaca({ placa }, { exec, dirCache: await dirCache() });
    assert.equal(r.erro, 'dados_invalidos', String(placa));
  }
  assert.equal(chamadas.length, 0);
  assert.equal(normalizarPlaca('abc-1d23'), 'ABC1D23');
});

test('pelo MCP (forward): consultar_placa roda sem API configurada e aceita o caller do plugin', async () => {
  const { exec } = execFalso(HTML);
  const r = await forward('consultar_placa', { placa: 'SXJ6H55', caller: { phone: '5547984889108' } }, {
    apiUrl: '', token: '', placaDeps: { exec, dirCache: await dirCache() },
  });
  assert.equal(r.isError, false);
  assert.equal(JSON.parse(r.content[0].text).marca, 'Land Rover');
});
