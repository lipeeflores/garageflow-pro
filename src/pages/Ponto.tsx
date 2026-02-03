import { useState, useRef, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera,
  Clock,
  LogIn,
  LogOut,
  Coffee,
  UtensilsCrossed,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInMinutes, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type TimeclockEventType = Database["public"]["Enums"]["timeclock_event_type"];

interface TimeclockEvent {
  id: string;
  event_type: TimeclockEventType;
  event_time: string;
  photo_attachment_id: string | null;
}

const eventConfig: Record<TimeclockEventType, { label: string; icon: typeof LogIn; color: string }> = {
  ENTRADA: { label: "Entrada", icon: LogIn, color: "text-success" },
  SAIDA_ALMOCO: { label: "Saída Almoço", icon: UtensilsCrossed, color: "text-warning" },
  RETORNO_ALMOCO: { label: "Retorno Almoço", icon: Coffee, color: "text-info" },
  SAIDA: { label: "Saída", icon: LogOut, color: "text-destructive" },
};

const eventSequence: TimeclockEventType[] = ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"];

export default function Ponto() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's events
  const { data: todayEvents, isLoading } = useQuery({
    queryKey: ['timeclock_events', user?.id],
    queryFn: async () => {
      if (!user?.id || !profile?.tenant_id) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('timeclock_events')
        .select('*')
        .eq('profile_id', user.id)
        .eq('tenant_id', profile.tenant_id)
        .gte('event_time', today.toISOString())
        .order('event_time', { ascending: true });
      
      if (error) throw error;
      return data as TimeclockEvent[];
    },
    enabled: !!user?.id && !!profile?.tenant_id,
    refetchInterval: 30000,
  });

  // Determine next expected event
  const getNextEvent = useCallback((): TimeclockEventType | null => {
    if (!todayEvents || todayEvents.length === 0) return "ENTRADA";
    
    const lastEvent = todayEvents[todayEvents.length - 1];
    const lastEventIndex = eventSequence.indexOf(lastEvent.event_type);
    
    if (lastEventIndex === eventSequence.length - 1) return null; // Day complete
    return eventSequence[lastEventIndex + 1];
  }, [todayEvents]);

  const nextEvent = getNextEvent();

  // Calculate worked hours
  const calculateWorkedTime = useCallback(() => {
    if (!todayEvents || todayEvents.length === 0) return 0;
    
    let totalMinutes = 0;
    let entryTime: Date | null = null;
    let lunchStart: Date | null = null;

    for (const event of todayEvents) {
      const eventTime = parseISO(event.event_time);
      
      switch (event.event_type) {
        case 'ENTRADA':
          entryTime = eventTime;
          break;
        case 'SAIDA_ALMOCO':
          if (entryTime) {
            totalMinutes += differenceInMinutes(eventTime, entryTime);
            entryTime = null;
          }
          lunchStart = eventTime;
          break;
        case 'RETORNO_ALMOCO':
          entryTime = eventTime;
          lunchStart = null;
          break;
        case 'SAIDA':
          if (entryTime) {
            totalMinutes += differenceInMinutes(eventTime, entryTime);
          }
          break;
      }
    }

    // If still working (entry without exit)
    if (entryTime && !lunchStart) {
      totalMinutes += differenceInMinutes(new Date(), entryTime);
    }

    return totalMinutes;
  }, [todayEvents]);

  const workedMinutes = calculateWorkedTime();
  const workedHours = Math.floor(workedMinutes / 60);
  const workedMins = workedMinutes % 60;

  // Camera functions
  const startCamera = async () => {
    try {
      // First set camera open to render the video element
      setIsCameraOpen(true);
      
      // Small delay to ensure video element is mounted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await videoRef.current.play();
      } else {
        // If video ref not available, stop the stream
        stream.getTracks().forEach(track => track.stop());
        throw new Error("Video element not available");
      }
    } catch (error) {
      console.error("Camera error:", error);
      setIsCameraOpen(false);
      toast({
        title: "Erro ao acessar câmera",
        description: "Verifique as permissões do navegador.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCapturedPhoto(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  // Submit event
  const submitEvent = async () => {
    if (!nextEvent || !capturedPhoto || !user?.id || !profile?.tenant_id) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert base64 to blob
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      
      // Upload photo
      const fileName = `timeclock/${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, blob);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(fileName);
      
      // Create attachment record
      const { data: attachment, error: attachmentError } = await supabase
        .from('attachments')
        .insert({
          tenant_id: profile.tenant_id,
          parent_type: 'timeclock',
          parent_id: user.id,
          attachment_type: 'TIMECLOCK_PHOTO',
          file_url: publicUrl,
          file_name: `ponto-${nextEvent.toLowerCase()}.jpg`,
          uploaded_by: user.id,
        })
        .select()
        .single();
      
      if (attachmentError) throw attachmentError;
      
      // Create timeclock event
      const { error: eventError } = await supabase
        .from('timeclock_events')
        .insert({
          tenant_id: profile.tenant_id,
          profile_id: user.id,
          event_type: nextEvent,
          photo_attachment_id: attachment.id,
        });
      
      if (eventError) throw eventError;
      
      queryClient.invalidateQueries({ queryKey: ['timeclock_events'] });
      
      toast({
        title: "Ponto registrado!",
        description: `${eventConfig[nextEvent].label} registrada às ${format(new Date(), "HH:mm")}`,
      });
      
      stopCamera();
    } catch (error) {
      console.error('Timeclock error:', error);
      toast({
        title: "Erro ao registrar ponto",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Ponto Digital" subtitle="Controle de jornada">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Ponto Digital" subtitle="Controle de jornada">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Current Time */}
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {format(currentTime, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <p className="font-display text-6xl font-bold tracking-tight">
              {format(currentTime, "HH:mm:ss")}
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <Badge variant="outline" className="text-base px-4 py-1">
                <Clock className="h-4 w-4 mr-2" />
                {workedHours}h {workedMins}min trabalhadas
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Camera / Action Area */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Registrar Ponto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!nextEvent ? (
              <div className="text-center py-12">
                <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                <h3 className="font-display text-xl font-semibold">Jornada Completa!</h3>
                <p className="text-muted-foreground mt-2">
                  Você já registrou todos os pontos de hoje.
                </p>
              </div>
            ) : !isCameraOpen ? (
              <div className="text-center py-8">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6",
                  "bg-accent/20 text-accent"
                )}>
                  {(() => {
                    const Icon = eventConfig[nextEvent].icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  <span className="font-medium">Próximo: {eventConfig[nextEvent].label}</span>
                </div>
                <Button
                  size="lg"
                  className="w-full max-w-xs"
                  onClick={startCamera}
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Abrir Câmera
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  {!capturedPhoto ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={capturedPhoto}
                      alt="Foto capturada"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                
                <div className="flex gap-3">
                  {!capturedPhoto ? (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={stopCamera}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1 bg-accent hover:bg-accent/90"
                        onClick={capturePhoto}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Tirar Foto
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={retakePhoto}
                        disabled={isSubmitting}
                      >
                        Tirar Novamente
                      </Button>
                      <Button
                        className="flex-1 bg-success hover:bg-success/90"
                        onClick={submitEvent}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Registrando..." : `Confirmar ${eventConfig[nextEvent].label}`}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Registros de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {todayEvents && todayEvents.length > 0 ? (
              <div className="space-y-3">
                {todayEvents.map((event, index) => {
                  const config = eventConfig[event.event_type];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                    >
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        "bg-card border"
                      )}>
                        <Icon className={cn("h-5 w-5", config.color)} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{config.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(event.event_time), "HH:mm")}
                        </p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum registro hoje.</p>
                <p className="text-sm">Registre sua entrada para começar.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
