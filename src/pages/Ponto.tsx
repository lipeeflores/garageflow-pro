import { useState, useRef, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  CameraOff,
  Clock,
  LogIn,
  LogOut,
  Coffee,
  UtensilsCrossed,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Upload,
  ImagePlus,
  User,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// Compress image before upload
async function compressImage(file: File | Blob, maxWidth = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        0.8
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    
    img.src = url;
  });
}

export default function Ponto() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showFallbackDialog, setShowFallbackDialog] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);
  const [uploadedPhotoPreview, setUploadedPhotoPreview] = useState<string | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [selectedMechanicName, setSelectedMechanicName] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { profile, user, isPatio } = useAuth();
  const queryClient = useQueryClient();

  // The effective profile_id for timeclock: if PATIO, use selected mechanic; otherwise use own id
  const effectiveProfileId = isPatio ? selectedMechanicId : user?.id;

  // Fetch mechanics list for PATIO users
  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics-for-ponto", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", profile.tenant_id)
        .eq("role", "MECHANIC");

      if (!roles?.length) return [];

      const mechanicIds = roles.map(r => r.user_id);
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", mechanicIds)
        .eq("is_active", true);

      return profiles || [];
    },
    enabled: isPatio && !!profile?.tenant_id,
  });

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup uploaded photo preview URL
  useEffect(() => {
    return () => {
      if (uploadedPhotoPreview) {
        URL.revokeObjectURL(uploadedPhotoPreview);
      }
    };
  }, [uploadedPhotoPreview]);

  // Fetch today's events for effective profile
  const { data: todayEvents, isLoading } = useQuery({
    queryKey: ['timeclock_events', effectiveProfileId],
    queryFn: async () => {
      if (!effectiveProfileId || !profile?.tenant_id) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('timeclock_events')
        .select('*')
        .eq('profile_id', effectiveProfileId)
        .eq('tenant_id', profile.tenant_id)
        .gte('event_time', today.toISOString())
        .order('event_time', { ascending: true });
      
      if (error) throw error;
      return data as TimeclockEvent[];
    },
    enabled: !!effectiveProfileId && !!profile?.tenant_id,
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
    setCameraError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Seu navegador não suporta acesso à câmera");
      setShowFallbackDialog(true);
      return;
    }
    
    try {
      setIsCameraOpen(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await videoRef.current.play();
      } else {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("Video element not available");
      }
    } catch (error: unknown) {
      console.error("Camera error:", error);
      setIsCameraOpen(false);
      
      const errorName = error instanceof Error ? error.name : "";
      
      let userMessage = "Não foi possível acessar a câmera.";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        userMessage = "Permissão de câmera negada. Verifique as configurações do navegador.";
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        userMessage = "Nenhuma câmera encontrada no dispositivo.";
      } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
        userMessage = "Câmera está sendo usada por outro aplicativo.";
      } else if (errorName === "OverconstrainedError") {
        userMessage = "Câmera não suporta as configurações solicitadas.";
      } else if (errorName === "SecurityError") {
        userMessage = "Acesso à câmera bloqueado por segurança (requer HTTPS).";
      }
      
      setCameraError(userMessage);
      setShowFallbackDialog(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCapturedPhoto(null);
    setCameraError(null);
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

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    setUploadedPhoto(file);
    setUploadedPhotoPreview(URL.createObjectURL(file));
  };

  const clearUploadedPhoto = () => {
    if (uploadedPhotoPreview) {
      URL.revokeObjectURL(uploadedPhotoPreview);
    }
    setUploadedPhoto(null);
    setUploadedPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit event (with photo from camera or upload)
  const submitEvent = async (useUploadedPhoto = false) => {
    if (!nextEvent || !effectiveProfileId || !profile?.tenant_id) return;
    
    const photoSource = useUploadedPhoto ? uploadedPhoto : capturedPhoto;
    
    setIsSubmitting(true);
    
    try {
      let attachmentId: string | null = null;
      
      if (photoSource) {
        let blob: Blob;
        
        if (useUploadedPhoto && uploadedPhoto) {
          blob = await compressImage(uploadedPhoto);
        } else if (capturedPhoto) {
          const response = await fetch(capturedPhoto);
          blob = await response.blob();
        } else {
          throw new Error("No photo available");
        }
        
        const fileName = `timeclock/${effectiveProfileId}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(fileName, blob);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(fileName);
        
        const { data: attachment, error: attachmentError } = await supabase
          .from('attachments')
          .insert({
            tenant_id: profile.tenant_id,
            parent_type: 'timeclock',
            parent_id: effectiveProfileId,
            attachment_type: 'TIMECLOCK_PHOTO',
            file_url: publicUrl,
            file_name: `ponto-${nextEvent.toLowerCase()}.jpg`,
            uploaded_by: user?.id || effectiveProfileId,
          })
          .select()
          .single();
        
        if (attachmentError) throw attachmentError;
        attachmentId = attachment.id;
      }
      
      const { error: eventError } = await supabase
        .from('timeclock_events')
        .insert({
          tenant_id: profile.tenant_id,
          profile_id: effectiveProfileId,
          event_type: nextEvent,
          photo_attachment_id: attachmentId,
        });
      
      if (eventError) throw eventError;
      
      queryClient.invalidateQueries({ queryKey: ['timeclock_events'] });
      
      const mechanicLabel = isPatio && selectedMechanicName ? ` para ${selectedMechanicName}` : "";
      
      toast({
        title: "Ponto registrado!",
        description: `${eventConfig[nextEvent].label} registrada às ${format(new Date(), "HH:mm")}${mechanicLabel}${!photoSource ? " (sem foto)" : ""}`,
      });
      
      stopCamera();
      clearUploadedPhoto();
      setShowFallbackDialog(false);
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

  const handleSelectMechanic = (mechanicId: string, mechanicName: string) => {
    setSelectedMechanicId(mechanicId);
    setSelectedMechanicName(mechanicName);
  };

  const handleBackToMechanicList = () => {
    setSelectedMechanicId(null);
    setSelectedMechanicName(null);
    stopCamera();
    clearUploadedPhoto();
  };

  if (isLoading && !isPatio) {
    return (
      <AppLayout title="Ponto Digital" subtitle="Controle de jornada">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  // PATIO users: show mechanic selector first
  if (isPatio && !selectedMechanicId) {
    return (
      <AppLayout title="Ponto Digital" subtitle="Selecione o mecânico">
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
            </CardContent>
          </Card>

          {/* Mechanic Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <User className="h-5 w-5" />
                Selecione o Mecânico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mechanics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>Nenhum mecânico disponível.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {mechanics.map((mechanic) => (
                    <Button
                      key={mechanic.id}
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-4"
                      onClick={() => handleSelectMechanic(mechanic.id, mechanic.full_name)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {mechanic.full_name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <span className="font-medium text-base">{mechanic.full_name}</span>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Ponto Digital" subtitle={isPatio && selectedMechanicName ? `Registrando para: ${selectedMechanicName}` : "Controle de jornada"}>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Back button for PATIO users */}
        {isPatio && selectedMechanicId && (
          <Button
            variant="ghost"
            className="gap-2"
            onClick={handleBackToMechanicList}
          >
            <ArrowLeft className="h-4 w-4" />
            Trocar Mecânico
          </Button>
        )}

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
              {isPatio && selectedMechanicName && (
                <Badge variant="secondary" className="text-base px-4 py-1">
                  <User className="h-4 w-4 mr-2" />
                  {selectedMechanicName}
                </Badge>
              )}
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
                  {isPatio && selectedMechanicName
                    ? `${selectedMechanicName} já registrou todos os pontos de hoje.`
                    : "Você já registrou todos os pontos de hoje."}
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
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={startCamera}
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Abrir Câmera
                  </Button>
                </div>
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
                        onClick={() => submitEvent(false)}
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
                {todayEvents.map((event) => {
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
                      <div className="flex items-center gap-2">
                        {!event.photo_attachment_id && (
                          <Badge variant="outline" className="text-xs">
                            <CameraOff className="h-3 w-3 mr-1" />
                            Sem foto
                          </Badge>
                        )}
                        <CheckCircle className="h-5 w-5 text-success" />
                      </div>
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

      {/* Fallback Dialog */}
      <Dialog open={showFallbackDialog} onOpenChange={setShowFallbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Problema com a Câmera
            </DialogTitle>
            <DialogDescription>
              {cameraError ? (
                <span className="text-destructive">{cameraError}</span>
              ) : (
                "Não foi possível acessar a câmera. Faça upload de uma foto para registrar o ponto."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {uploadedPhotoPreview ? (
                <div className="space-y-3">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <img
                      src={uploadedPhotoPreview}
                      alt="Foto enviada"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearUploadedPhoto}
                      disabled={isSubmitting}
                    >
                      Remover Foto
                    </Button>
                    <Button
                      className="flex-1 bg-success hover:bg-success/90"
                      onClick={() => submitEvent(true)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Registrando..." : "Confirmar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Selecionar ou tirar foto
                    </span>
                  </div>
                </Button>
              )}
            </div>

            {!uploadedPhotoPreview && (
              <p className="text-xs text-muted-foreground text-center">
                É obrigatório enviar uma foto para registrar o ponto.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowFallbackDialog(false);
                clearUploadedPhoto();
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
