import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const technicalContext = formData.get("context") as string || "";

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "No audio file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing audio file: ${audioFile.name}, size: ${audioFile.size}`);

    // Convert audio to base64 (chunked to avoid stack overflow)
    const arrayBuffer = await audioFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Audio = btoa(binary);
    const mimeType = audioFile.type || "audio/webm";

    // Use Lovable AI Gateway with Gemini for audio transcription
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: technicalContext 
                  ? `Contexto do veículo: ${technicalContext}\n\nTranscreva e refine o seguinte áudio do mecânico:`
                  : "Transcreva e refine o seguinte áudio do mecânico:"
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: mimeType.includes("webm") ? "webm" : mimeType.includes("mp3") ? "mp3" : "wav"
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON response
    let parsed;
    try {
      // Extract JSON from response (in case it's wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      console.log("Failed to parse JSON, using raw content");
      parsed = {
        transcription_raw: content,
        transcription_refined: content,
      };
    }

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
    const errorMessage = error instanceof Error ? error.message : "Failed to process audio";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
