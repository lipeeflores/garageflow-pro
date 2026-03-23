import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function getPreferredAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

interface AudioRecorderProps {
  onTranscriptionComplete: (raw: string, refined: string, audioUrl: string) => void;
  vehicleContext?: string;
  disabled?: boolean;
}

export function AudioRecorder({ 
  onTranscriptionComplete, 
  vehicleContext,
  disabled 
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredAudioMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const playAudio = useCallback(() => {
    if (audioBlob && !isPlaying) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      
      audio.play();
      setIsPlaying(true);
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [audioBlob, isPlaying]);

  const processAudio = useCallback(async () => {
    if (!audioBlob) return;

    setIsProcessing(true);

    try {
      const mimeType = audioBlob.type || "audio/webm";
      const extension = mimeType.includes("webm")
        ? "webm"
        : mimeType.includes("mpeg") || mimeType.includes("mp3")
        ? "mp3"
        : mimeType.includes("mp4") || mimeType.includes("m4a")
        ? "m4a"
        : "wav";

      // Upload audio to storage
      const fileName = `diagnosis-${Date.now()}.${extension}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(`diagnosis-audio/${fileName}`, audioBlob, {
          contentType: audioBlob.type,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(uploadData.path);

      const audioUrl = urlData.publicUrl;

      // Send to transcription edge function
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName);
      formData.append('mime_type', mimeType);
      if (vehicleContext) {
        formData.append('context', vehicleContext);
      }

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: formData,
      });

      if (error) throw new Error(error.message || "Erro ao transcrever áudio");
      if (!data?.transcription_raw && !data?.transcription_refined) {
        throw new Error("A transcrição retornou vazia");
      }

      onTranscriptionComplete(
        data.transcription_raw || "",
        data.transcription_refined || "",
        audioUrl
      );

      setAudioBlob(null);
      setRecordingTime(0);

      toast({
        title: "Sucesso",
        description: "Áudio transcrito com sucesso",
      });

    } catch (error) {
      console.error("Error processing audio:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao processar áudio. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [audioBlob, vehicleContext, onTranscriptionComplete, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className={`h-5 w-5 ${isRecording ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
          <span className="text-sm font-medium">
            {isRecording ? 'Gravando...' : audioBlob ? 'Gravação pronta' : 'Gravar diagnóstico por voz'}
          </span>
        </div>
        <span className="text-sm font-mono text-muted-foreground">
          {formatTime(recordingTime)}
        </span>
      </div>

      <div className="flex gap-2">
        {!isRecording && !audioBlob && (
          <Button
            type="button"
            variant="outline"
            onClick={startRecording}
            disabled={disabled || isProcessing}
            className="flex-1 gap-2"
          >
            <Mic className="h-4 w-4" />
            Iniciar Gravação
          </Button>
        )}

        {isRecording && (
          <Button
            type="button"
            variant="destructive"
            onClick={stopRecording}
            className="flex-1 gap-2"
          >
            <Square className="h-4 w-4" />
            Parar Gravação
          </Button>
        )}

        {audioBlob && !isRecording && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={playAudio}
              disabled={isProcessing}
              className="gap-2"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isPlaying ? 'Pausar' : 'Ouvir'}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={startRecording}
              disabled={isProcessing}
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              Regravar
            </Button>

            <Button
              type="button"
              onClick={processAudio}
              disabled={isProcessing}
              className="flex-1 gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando com IA...
                </>
              ) : (
                'Transcrever com IA'
              )}
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Grave seu parecer técnico e a IA irá transcrever e refinar o texto automaticamente.
      </p>
    </div>
  );
}
