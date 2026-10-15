const JANELA_MS = 5 * 60 * 1000;
const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signCaller(phone: string, sessionId: string, ts: number, secret: string) {
  return { phone, session_id: sessionId, ts, sig: await hmacHex(secret, `${phone}|${sessionId}|${ts}`) };
}

export async function verifyCaller(c: unknown, secret: string, nowMs = Date.now()) {
  if (!secret || !c || typeof c !== "object") return null;
  const { phone, session_id, ts, sig } = c as Record<string, unknown>;
  if (typeof phone !== "string" || typeof session_id !== "string" || typeof ts !== "number" || typeof sig !== "string") return null;
  if (Math.abs(nowMs - ts) > JANELA_MS) return null;
  const esperado = await hmacHex(secret, `${phone}|${session_id}|${ts}`);
  return iguais(esperado, sig) ? { phone, sessionId: session_id } : null;
}

export { iguais as comparacaoConstante };
