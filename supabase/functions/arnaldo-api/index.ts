const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-arnaldo-token",
};
const VERSAO = "a0-2026-10-15";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("saude") === "1") {
    return new Response(JSON.stringify({ ok: true, versao: VERSAO }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: false, erro: "acao_desconhecida" }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
