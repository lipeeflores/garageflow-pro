import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type TranscriptionPayload = {
  transcription_raw?: string;
  transcription_refined?: string;
};

const parseGatewayJson = (content: string): TranscriptionPayload => {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return {
          transcription_raw: content,
          transcription_refined: content,
        };
      }
    }

    return {
      transcription_raw: content,
      transcription_refined: content,
    };
  }
};

// 16/10/2026: saiu do AI gateway do Lovable para o Groq (grátis): Whisper transcreve, gpt-oss reescreve.
const GROQ_URL = "https://api.groq.com/openai/v1";
const STT_MODEL = "whisper-large-v3-turbo";
const LLM_MODEL = "openai/gpt-oss-120b";
// Ajuda o Whisper com os termos de oficina (mesma ideia do STT do Arnaldo).
const STT_PROMPT =
  "Parecer de mecânico da MD Mecânica. Pastilha, disco de freio, correia dentada, tensor, coxim, " +
  "amortecedor, embreagem, junta homocinética, bieleta, bandeja, terminal de direção, velas, bobina, " +
  "injetor, sonda lambda, catalisador, radiador, bomba d'água, válvula termostática, óleo, filtro.";

const groq = async (path: string, init: RequestInit, apiKey: string) => {
  const response = await fetch(`${GROQ_URL}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), "Authorization": `Bearer ${apiKey}` },
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status === 429 ? 429 : 502, `Groq: ${raw || response.statusText}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(502, "Resposta inválida da IA");
  }
};

const refinar = async (system: string, user: string, fallback: string, apiKey: string) => {
  const data = await groq("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.2,
      max_completion_tokens: 2000,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    }),
  }, apiKey);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, "Resposta vazia da IA");
  const parsed = parseGatewayJson(content);
  return parsed.transcription_refined || fallback;
};

const transcribeFromAudio = async (
  audioFile: File,
  technicalContext: string,
  apiKey: string,
) => {
  console.log(`Processing audio file: ${audioFile.name}, size: ${audioFile.size}`);

  const form = new FormData();
  form.append("file", audioFile, audioFile.name || "audio.webm");
  form.append("model", STT_MODEL);
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("prompt", technicalContext ? `${STT_PROMPT} Veículo: ${technicalContext}`.slice(0, 800) : STT_PROMPT);
  const stt = await groq("/audio/transcriptions", { method: "POST", body: form }, apiKey);
  const raw = String(stt?.text || "").trim();
  if (!raw) throw new HttpError(422, "Não deu para entender o áudio");

  const refined = await refinar(
    `Você é um assistente especializado em mecânica automotiva. Recebe a transcrição do áudio de um mecânico e cria uma versão refinada e profissional do parecer técnico para enviar ao cliente.

O parecer refinado deve:
- Usar linguagem técnica mas acessível
- Ser claro e objetivo
- Manter todas as informações técnicas importantes
- Organizar em tópicos se necessário
- Remover hesitações, repetições e linguagem informal
- Não inventar defeitos ou peças

Responda em JSON com o formato:
{
  "transcription_refined": "parecer técnico refinado para o cliente"
}`,
    technicalContext
      ? `Contexto do veículo: ${technicalContext}

Transcrição do áudio do mecânico:
${raw}`
      : `Transcrição do áudio do mecânico:
${raw}`,
    raw,
    apiKey,
  );
  return { transcription_raw: raw, transcription_refined: refined };
};

const refineTextDiagnosis = async (
  technicalReport: string,
  technicalContext: string,
  apiKey: string,
) => {
  const refined = await refinar(
    `Você é um assistente técnico automotivo. Reescreva o texto enviado por um mecânico de forma profissional e clara, mantendo o significado técnico.

Regras:
- Não invente defeitos ou peças
- Corrija ortografia, concordância e organização
- Mantenha linguagem objetiva para cliente

Responda em JSON com:
{
  "transcription_refined": "texto refinado"
}`,
    technicalContext
      ? `Contexto do veículo: ${technicalContext}

Texto do mecânico:
${technicalReport}`
      : `Texto do mecânico:
${technicalReport}`,
    technicalReport,
    apiKey,
  );

  return { transcription_raw: technicalReport, transcription_refined: refined };
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new HttpError(500, "GROQ_API_KEY not configured");
    }

    const contentType = req.headers.get("content-type") || "";
    let audioFile: File | null = null;
    let technicalContext = "";
    let technicalReport = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const candidate = formData.get("audio");

      if (candidate instanceof File) {
        audioFile = candidate;
      }

      technicalContext = (formData.get("context") as string) || "";
      technicalReport = ((formData.get("technical_report") as string) || "").trim();
    } else {
      const body = await req.json();
      technicalContext = (body?.context || "") as string;
      technicalReport = ((body?.technical_report || "") as string).trim();
    }

    if (!audioFile && !technicalReport) {
      throw new HttpError(400, "No audio or technical_report provided");
    }

    const parsed = audioFile
      ? await transcribeFromAudio(audioFile, technicalContext, GROQ_API_KEY)
      : await refineTextDiagnosis(technicalReport, technicalContext, GROQ_API_KEY);

    console.log("Transcription completed successfully");

    return new Response(
      JSON.stringify({
        transcription_raw: parsed.transcription_raw || "",
        transcription_refined: parsed.transcription_refined || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing audio:", error);
    const status = error instanceof HttpError ? error.status : 500;
    const errorMessage = error instanceof Error ? error.message : "Failed to process audio";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
