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

const normalizeAudioFormat = (mimeType: string, fileName: string) => {
  const source = `${mimeType}|${fileName}`.toLowerCase();

  if (source.includes("webm")) return "webm";
  if (source.includes("wav")) return "wav";
  if (source.includes("mp3") || source.includes("mpeg")) return "mp3";
  if (source.includes("mp4") || source.includes("m4a") || source.includes("aac")) return "mp4";
  if (source.includes("ogg") || source.includes("oga")) return "ogg";

  return "webm";
};

const callAiGateway = async (body: Record<string, unknown>, apiKey: string) => {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new HttpError(response.status, `AI Gateway error: ${raw || response.statusText}`);
  }

  let parsedResponse: any;
  try {
    parsedResponse = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "Resposta inválida do AI Gateway");
  }

  const content = parsedResponse?.choices?.[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "Resposta vazia do AI Gateway");
  }

  return parseGatewayJson(content);
};

const transcribeFromAudio = async (
  audioFile: File,
  technicalContext: string,
  apiKey: string,
) => {
  console.log(`Processing audio file: ${audioFile.name}, size: ${audioFile.size}`);

  const arrayBuffer = await audioFile.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  const base64Audio = btoa(binary);
  const mimeType = audioFile.type || "audio/webm";
  const audioFormat = normalizeAudioFormat(mimeType, audioFile.name);

  return callAiGateway(
    {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um assistente especializado em mecânica automotiva. Sua tarefa é:
1. Transcrever fielmente o áudio do mecânico
2. Em seguida, criar uma versão refinada e profissional do parecer técnico para enviar ao cliente

O parecer refinado deve:
- Usar linguagem técnica mas acessível
- Ser claro e objetivo
- Manter todas as informações técnicas importantes
- Organizar em tópicos se necessário
- Remover hesitações, repetições e linguagem informal

Responda em JSON com o formato:
{
  "transcription_raw": "transcrição literal do áudio",
  "transcription_refined": "parecer técnico refinado para o cliente"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: technicalContext
                ? `Contexto do veículo: ${technicalContext}\n\nTranscreva e refine o seguinte áudio do mecânico:`
                : "Transcreva e refine o seguinte áudio do mecânico:",
            },
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format: audioFormat,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    },
    apiKey,
  );
};

const refineTextDiagnosis = async (
  technicalReport: string,
  technicalContext: string,
  apiKey: string,
) => {
  const result = await callAiGateway(
    {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um assistente técnico automotivo. Reescreva o texto enviado por um mecânico de forma profissional e clara, mantendo o significado técnico.

Regras:
- Não invente defeitos ou peças
- Corrija ortografia, concordância e organização
- Mantenha linguagem objetiva para cliente

Responda em JSON com:
{
  "transcription_raw": "texto original",
  "transcription_refined": "texto refinado"
}`,
        },
        {
          role: "user",
          content: technicalContext
            ? `Contexto do veículo: ${technicalContext}\n\nTexto do mecânico:\n${technicalReport}`
            : `Texto do mecânico:\n${technicalReport}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    },
    apiKey,
  );

  return {
    transcription_raw: result.transcription_raw || technicalReport,
    transcription_refined: result.transcription_refined || technicalReport,
  };
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new HttpError(500, "LOVABLE_API_KEY not configured");
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
      ? await transcribeFromAudio(audioFile, technicalContext, LOVABLE_API_KEY)
      : await refineTextDiagnosis(technicalReport, technicalContext, LOVABLE_API_KEY);

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
