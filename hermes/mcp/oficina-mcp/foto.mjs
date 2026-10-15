// anexar_foto: a foto que chega no WhatsApp fica no cache de imagens do perfil Hermes. Este MCP roda
// DENTRO do mesmo container (processo filho do gateway), então é ele quem enxerga o arquivo; a API
// (edge function, na nuvem) só recebe os bytes em base64.
// O modelo só passa o `caminho_imagem`: lemos o arquivo aqui, e só de dentro das pastas de cache.
import fs from 'node:fs/promises';
import path from 'node:path';

const PERFIL = '/root/.hermes/profiles/arnaldo-md-mecanica';
// Onde o Hermes grava a imagem recebida (confirmado em 15/10: "Using bridge-cached image: <perfil>/cache/images/img_*.jpg").
// As outras duas são os nomes antigos do cache, aceitos por segurança.
export const FOTO_DIRS_PADRAO = [`${PERFIL}/cache/images`, `${PERFIL}/image_cache`, '/root/.hermes/image_cache'];
export const FOTO_MAX_BYTES = 8 * 1024 * 1024;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export class FotoErro extends Error {}

/**
 * Troca `caminho_imagem` por `imagem_base64` + `mime`. Recusa tudo que sair das pastas permitidas:
 * `..`, caminho relativo, symlink (no arquivo ou em qualquer pasta do caminho), diretório, extensão que
 * não seja jpg/png/webp e arquivo maior que 8 MB. Qualquer `imagem_base64`/`mime` que o modelo tenha
 * mandado por conta própria é descartado: a única fonte é o arquivo do cache.
 */
export async function prepararFoto(rawArgs, { dirs = FOTO_DIRS_PADRAO } = {}) {
  const args = { ...(rawArgs || {}) };
  delete args.imagem_base64;
  delete args.mime;
  const caminho = typeof args.caminho_imagem === 'string' ? args.caminho_imagem.trim() : '';
  delete args.caminho_imagem;
  if (!caminho) throw new FotoErro('Informe o `caminho_imagem` (o arquivo da foto que chegou no WhatsApp).');
  if (caminho.includes('\0') || caminho.split(/[\\/]/).includes('..')) throw new FotoErro('Caminho inválido: só vale arquivo da pasta de imagens recebidas.');
  if (!path.isAbsolute(caminho)) throw new FotoErro('Passe o caminho completo da imagem, como o Hermes mostrou.');

  let st;
  try {
    st = await fs.lstat(caminho);
  } catch {
    throw new FotoErro('Não encontrei essa foto no cache de imagens recebidas.');
  }
  if (st.isSymbolicLink()) throw new FotoErro('Caminho inválido: link simbólico não é aceito.');
  if (!st.isFile()) throw new FotoErro('Esse caminho não é um arquivo de imagem.');
  const real = await fs.realpath(caminho);

  let dentro = false;
  for (const d of dirs) {
    try {
      if (path.dirname(real) === (await fs.realpath(d))) { dentro = true; break; }
    } catch { /* pasta inexistente: tenta a próxima */ }
  }
  if (!dentro) throw new FotoErro('Só aceito foto que está diretamente na pasta de imagens recebidas.');

  const mime = MIME[path.extname(real).toLowerCase()];
  if (!mime) throw new FotoErro('Só aceito foto em jpg, png ou webp.');
  if (st.size > FOTO_MAX_BYTES) throw new FotoErro('A foto passa de 8 MB — peça uma menor.');
  if (st.size === 0) throw new FotoErro('A foto está vazia.');

  args.imagem_base64 = (await fs.readFile(real)).toString('base64');
  args.mime = mime;
  return args;
}
