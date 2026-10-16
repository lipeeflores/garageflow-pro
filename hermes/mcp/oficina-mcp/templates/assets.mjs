// Fontes (Barlow, Barlow Condensed, Roboto Mono — OFL), logo e QR embutidos em base64: o documento
// não depende de rede para ficar com a cara da MD (só as fotos vêm de URL).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const FONTES = [
  ['Barlow', 400, 'Barlow-400'], ['Barlow', 500, 'Barlow-500'], ['Barlow', 600, 'Barlow-600'], ['Barlow', 700, 'Barlow-700'],
  ['Barlow Condensed', 500, 'BarlowCondensed-500'], ['Barlow Condensed', 600, 'BarlowCondensed-600'], ['Barlow Condensed', 700, 'BarlowCondensed-700'],
  ['Roboto Mono', 500, 'RobotoMono-500'], ['Roboto Mono', 700, 'RobotoMono-700'],
];

let cache = null;

/** { logoDataUri, fontesCss } lidos do disco uma vez por processo. */
export function carregarAssets(dir = AQUI) {
  if (cache && dir === AQUI) return cache;
  const fontesCss = FONTES.map(([familia, peso, arquivo]) => {
    const b64 = fs.readFileSync(path.join(dir, 'fontes', `${arquivo}.woff2`)).toString('base64');
    return `@font-face{font-family:'${familia}';font-style:normal;font-weight:${peso};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');
  const logoDataUri = `data:image/png;base64,${fs.readFileSync(path.join(dir, 'logo.png')).toString('base64')}`;
  const assets = { logoDataUri, fontesCss };
  if (dir === AQUI) cache = assets;
  return assets;
}

/** PNG (data URI) do QR para o link de aprovação; sem link → ''. */
export async function qrDataUri(link) {
  if (!link) return '';
  return QRCode.toDataURL(String(link), { margin: 1, width: 240, errorCorrectionLevel: 'M' });
}
