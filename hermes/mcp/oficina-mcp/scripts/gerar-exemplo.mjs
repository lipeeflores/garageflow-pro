#!/usr/bin/env node
// Gera os 4 documentos de exemplo a partir das fixtures do contrato, pelo Gotenberg REAL (sem API, sem WhatsApp).
// Uso (de dentro do container, onde md-gotenberg resolve):
//   node scripts/gerar-exemplo.mjs /tmp/documentos-exemplo
// GOTENBERG_URL muda o endereço (padrão http://md-gotenberg:3000). Com --html salva também o HTML.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TIPOS, converter, montarHtml, GOTENBERG_URL } from '../documentos.mjs';
import { carregarAssets, qrDataUri } from '../templates/assets.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(AQUI, '..', 'test', 'fixtures');
const saida = process.argv[2] || '/tmp/documentos-exemplo';
const comHtml = process.argv.includes('--html');
const gotenbergUrl = process.env.GOTENBERG_URL || GOTENBERG_URL;

// Foto de mentira (SVG em data URI) no lugar das URLs "fixture:*": o exemplo não depende de rede nem de imagem real.
function fotoFalsa(nome) {
  const avaria = nome.startsWith('avaria');
  const forma = avaria
    ? '<path d="M30 130 L270 80" stroke="#b3121b" stroke-width="8" fill="none"/>'
    : '<path d="M30 140h240v-18l-34-9-26-30H90l-34 30-26 9z" fill="#5a5d63"/><circle cx="82" cy="142" r="17" fill="#2c2d31"/><circle cx="218" cy="142" r="17" fill="#2c2d31"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 225"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#b9bcc2"/><stop offset=".55" stop-color="#e9eaed"/><stop offset="1" stop-color="#cfd2d6"/></linearGradient></defs>` +
    `<rect width="300" height="225" fill="url(#g)"/>${forma}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

await fs.mkdir(saida, { recursive: true });
const assets = carregarAssets();
for (const tipo of Object.keys(TIPOS)) {
  const dados = JSON.parse(await fs.readFile(path.join(FIXTURES, `dados-${tipo}.json`), 'utf8'));
  for (const f of dados.fotos || []) if (String(f.url).startsWith('fixture:')) f.url = fotoFalsa(f.url.slice(8));
  const qr = tipo === 'orcamento' ? await qrDataUri(dados.link_aprovacao) : '';
  const html = montarHtml(tipo, dados, { ...assets, qrDataUri: qr, agora: new Date('2026-10-15T14:00:00-03:00') });
  const bytes = await converter(tipo, html, { gotenbergUrl });
  const arquivo = path.join(saida, `${tipo}.${TIPOS[tipo].ext}`);
  await fs.writeFile(arquivo, bytes);
  if (comHtml) await fs.writeFile(path.join(saida, `${tipo}.html`), html);
  console.log(`${arquivo} ${bytes.length} bytes`);
}
