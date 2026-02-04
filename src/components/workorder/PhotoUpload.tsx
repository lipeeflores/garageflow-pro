import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, Loader2, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type AttachmentType = Database["public"]["Enums"]["attachment_type"];

interface PhotoUploadProps {
  workOrderId: string;
  attachmentType: AttachmentType;
  title?: string;
  maxPhotos?: number;
  disabled?: boolean;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string | null;
  created_at: string | null;
}

// Compress image before upload
async function compressImage(file: File | Blob, maxWidth = 1920): Promise<Blob> {
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

export function PhotoUpload({ 
  workOrderId, 
  attachmentType,
  title = "Fotos",
  maxPhotos = 10,
  disabled = false
}: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch existing photos
  const { data: photos, isLoading } = useQuery({
    queryKey: ['work_order_photos', workOrderId, attachmentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('id, file_url, file_name, created_at')
        .eq('parent_type', 'work_order')
        .eq('parent_id', workOrderId)
        .eq('attachment_type', attachmentType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!workOrderId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File | Blob) => {
      if (!user?.id || !profile?.tenant_id) throw new Error("Not authenticated");

      const compressedBlob = await compressImage(file);
      const fileName = `work-orders/${workOrderId}/${attachmentType.toLowerCase()}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('attachments')
        .insert({
          tenant_id: profile.tenant_id,
          parent_type: 'work_order',
          parent_id: workOrderId,
          attachment_type: attachmentType,
          file_url: publicUrl,
          file_name: `${attachmentType.toLowerCase()}-${Date.now()}.jpg`,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_order_photos', workOrderId, attachmentType] });
      toast({
        title: "Foto adicionada",
        description: "A foto foi salva com sucesso.",
      });
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: "Erro ao enviar foto",
        description: "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_order_photos', workOrderId, attachmentType] });
      setSelectedPhoto(null);
      toast({
        title: "Foto removida",
        description: "A foto foi excluída com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao remover foto",
        description: "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - (photos?.length || 0);
    if (remainingSlots <= 0) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${maxPhotos} fotos permitidas.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) continue;
      await uploadMutation.mutateAsync(file);
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Camera functions
  const startCamera = async () => {
    try {
      setShowCamera(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      setShowCamera(false);
      toast({
        title: "Erro ao acessar câmera",
        description: "Verifique as permissões do navegador.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        setIsUploading(true);
        await uploadMutation.mutateAsync(blob);
        setIsUploading(false);
      }
    }, 'image/jpeg', 0.8);
    
    stopCamera();
  };

  const canAddMore = (photos?.length || 0) < maxPhotos;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <span className="text-xs text-muted-foreground">
          {photos?.length || 0} / {maxPhotos}
        </span>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos?.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img
              src={photo.file_url}
              alt={photo.file_name || "Foto"}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </div>
        ))}

        {/* Add Photo Button */}
        {canAddMore && !disabled && (
          <div className="aspect-square">
            <Card 
              className={cn(
                "h-full border-dashed cursor-pointer hover:border-accent transition-colors",
                isUploading && "opacity-50 pointer-events-none"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="h-full flex flex-col items-center justify-center p-2">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">Adicionar</span>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {canAddMore && !disabled && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 flex-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4" />
            Galeria
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 flex-1"
            onClick={startCamera}
            disabled={isUploading}
          >
            <Camera className="h-4 w-4" />
            Câmera
          </Button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tirar Foto</DialogTitle>
            <DialogDescription>
              Posicione o item e clique em capturar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={stopCamera}>
              Cancelar
            </Button>
            <Button onClick={capturePhoto} disabled={isUploading}>
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Capturar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Preview Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Visualizar Foto</DialogTitle>
          </DialogHeader>
          
          {selectedPhoto && (
            <>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <img
                  src={selectedPhoto.file_url}
                  alt={selectedPhoto.file_name || "Foto"}
                  className="w-full h-full object-contain"
                />
              </div>

              {!disabled && (
                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => deleteMutation.mutate(selectedPhoto.id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Excluir Foto
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
