// Porta do Arnaldo (agente Hermes da MD Mecânica) para o banco do garageflow.
// Este é o ÚNICO arquivo que importa de esm.sh. Toda a regra mora em ../_shared/arnaldo/ (testada com vitest).
//
// Segredos (Lovable → Cloud → Secrets): ARNALDO_API_TOKEN, ARNALDO_CALLER_SECRET, ARNALDO_APP_URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { atender } from "../_shared/arnaldo/handler.ts";

const VERSAO = "a5-2026-10-15T18:05-03:00";

Deno.serve((req) =>
  atender(req, {
    env: (nome) => Deno.env.get(nome),
    db: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    versao: VERSAO,
  })
);
