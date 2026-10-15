import { EQUIPE, escolha, invalido, ok, texto, type Acao } from "../util.ts";
import { gravarNota, osDoArg } from "../os.ts";

const TIPOS = ["CHECKIN_PHOTO", "DIAGNOSIS_PHOTO", "EXECUTION_PHOTO", "OTHER"] as const;
const MIMES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 8 * 1024 * 1024;

function bytesDeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const acao: Acao = {
  papeis: EQUIPE,
  async run(args, ctx) {
    const tipo = escolha(args, "tipo", TIPOS)!;
    const mime = String(args.mime ?? "").trim().toLowerCase();
    if (!MIMES[mime]) throw invalido(`Tipo de imagem não aceito. Use: ${Object.keys(MIMES).join(", ")}.`);
    const legenda = texto(args, "legenda", { obrig: false, max: 200 });
    const b64 = String(args.imagem_base64 ?? "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    if (!b64) throw invalido('Falta "imagem_base64".');
    const estimado = Math.floor((b64.length * 3) / 4);
    if (estimado > MAX_BYTES) throw invalido("A foto passa de 8 MB. Peça uma foto menor.");
    let bytes: Uint8Array;
    try { bytes = bytesDeBase64(b64); } catch { throw invalido("A imagem não está em base64 válido."); }
    if (bytes.length === 0 || bytes.length > MAX_BYTES) throw invalido("A foto está vazia ou passa de 8 MB.");

    const os = await osDoArg(ctx, args);
    // mesmo formato de caminho que o app usa em PhotoUpload.tsx
    const ts = Date.now();
    const path = `work-orders/${os.id}/${tipo.toLowerCase()}/${ts}-${crypto.randomUUID().slice(0, 8)}.${MIMES[mime]}`;

    const up = await ctx.db.storage.from("attachments").upload(path, bytes, { contentType: mime });
    if (up.error) throw new Error(`storage: ${up.error.message}`);
    const url: string = ctx.db.storage.from("attachments").getPublicUrl(path).data.publicUrl;

    const anexo = ok(
      await ctx.db.from("attachments").insert({
        tenant_id: ctx.tenantId, parent_type: "work_order", parent_id: os.id, attachment_type: tipo, file_url: url,
        file_name: `${tipo.toLowerCase()}-${ts}.${MIMES[mime]}`, file_type: mime, file_size: bytes.length, uploaded_by: ctx.atorId,
      }).select().single(),
      "attachments",
    );
    if (legenda) await gravarNota(ctx, os.id, `Foto: ${legenda}`);
    return { anexo_id: anexo.id, url };
  },
};
export default acao;
