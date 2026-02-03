import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Upload, X, Fuel, Gauge, Check, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateWorkOrder } from "@/hooks/useWorkOrders";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const fuelLevels = [
  { value: "RESERVA", label: "Reserva", percent: 0 },
  { value: "QUARTO", label: "1/4", percent: 25 },
  { value: "METADE", label: "1/2", percent: 50 },
  { value: "TRES_QUARTOS", label: "3/4", percent: 75 },
  { value: "COMPLETO", label: "Completo", percent: 100 },
] as const;

const photoPositions = [
  { id: "front", label: "Frente", icon: "🚗", description: "Vista frontal do veículo" },
  { id: "back", label: "Traseira", icon: "🚙", description: "Vista traseira do veículo" },
  { id: "left", label: "Lateral Esq.", icon: "⬅️", description: "Lado do motorista" },
  { id: "right", label: "Lateral Dir.", icon: "➡️", description: "Lado do passageiro" },
] as const;

const formSchema = z.object({
  km_current: z.coerce.number().min(0, "KM deve ser maior que 0"),
  fuel_level: z.enum(["RESERVA", "QUARTO", "METADE", "TRES_QUARTOS", "COMPLETO"]),
  observations: z.string().optional(),
  customer_items: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CheckinDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workOrderId: string;
  vehiclePlate: string;
  trigger?: React.ReactNode;
}

// Compress image before upload
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function CheckinDialog({ 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange, 
  workOrderId, 
  vehiclePlate,
  trigger 
}: CheckinDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? controlledOnOpenChange : setInternalOpen;
  
  const [photos, setPhotos] = useState<Record<string, File | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  });
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUpload, setCurrentUpload] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const updateWorkOrder = useUpdateWorkOrder();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      km_current: 0,
      fuel_level: "METADE",
      observations: "",
      customer_items: "",
    },
  });

  const handlePhotoChange = useCallback((position: string, file: File | null) => {
    setPhotos(prev => ({ ...prev, [position]: file }));
    
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => ({ ...prev, [position]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setPhotoPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[position];
        return newPreviews;
      });
    }
  }, []);

  const triggerFileInput = (position: string) => {
    fileInputRefs.current[position]?.click();
  };

  const photosCount = Object.values(photos).filter(Boolean).length;
  const allPhotosUploaded = photosCount === 4;

  const uploadPhoto = async (file: File, position: string): Promise<string> => {
    setCurrentUpload(position);
    
    // Compress image before upload
    const compressedBlob = await compressImage(file);
    const compressedFile = new File([compressedBlob], `${position}.jpg`, { type: 'image/jpeg' });
    
    const fileName = `${workOrderId}/${position}-${Date.now()}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(fileName, compressedFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const onSubmit = async (data: FormData) => {
    if (!allPhotosUploaded) {
      toast({
        title: "Fotos obrigatórias",
        description: "Por favor, tire as 4 fotos obrigatórias do veículo.",
        variant: "destructive",
      });
      return;
    }

    if (!profile?.tenant_id) {
      toast({
        title: "Erro",
        description: "Tenant não encontrado",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Upload all photos with progress
      const photoUrls: Record<string, string> = {};
      const photoEntries = Object.entries(photos).filter(([, file]) => file !== null);
      
      for (let i = 0; i < photoEntries.length; i++) {
        const [position, file] = photoEntries[i];
        if (file) {
          photoUrls[position] = await uploadPhoto(file, position);
          setUploadProgress(((i + 1) / photoEntries.length) * 50);
        }
      }

      setCurrentUpload(null);
      setUploadProgress(60);

      // Create check-in record
      const { error: checkinError } = await supabase
        .from('work_order_checkins')
        .insert({
          work_order_id: workOrderId,
          tenant_id: profile.tenant_id,
          km_current: data.km_current,
          fuel_level: data.fuel_level,
          observations: data.observations || null,
          customer_items: data.customer_items || null,
          mechanic_id: user?.id,
        });

      if (checkinError) throw checkinError;

      setUploadProgress(75);

      // Create attachment records for photos
      for (const [position, url] of Object.entries(photoUrls)) {
        await supabase
          .from('attachments')
          .insert({
            tenant_id: profile.tenant_id,
            parent_id: workOrderId,
            parent_type: 'work_order',
            attachment_type: 'CHECKIN_PHOTO',
            file_url: url,
            file_name: `checkin-${position}.jpg`,
            uploaded_by: user?.id,
          });
      }

      setUploadProgress(90);

      // Update work order status
      await updateWorkOrder.mutateAsync({
        id: workOrderId,
        updates: {
          workflow_step: 'CHECKIN_CONCLUIDO',
        },
      });

      setUploadProgress(100);

      queryClient.invalidateQueries({ queryKey: ['work_orders'] });

      toast({
        title: "Check-in realizado! ✅",
        description: "O veículo foi registrado com sucesso e está pronto para diagnóstico.",
      });

      onOpenChange?.(false);
      
      // Reset form
      form.reset();
      setPhotos({ front: null, back: null, left: null, right: null });
      setPhotoPreviews({});
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: "Erro no check-in",
        description: "Ocorreu um erro ao realizar o check-in. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
      setCurrentUpload(null);
    }
  };

  const resetDialog = useCallback(() => {
    form.reset();
    setPhotos({ front: null, back: null, left: null, right: null });
    setPhotoPreviews({});
    setUploadProgress(0);
    setCurrentUpload(null);
  }, [form]);

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetDialog();
      onOpenChange?.(newOpen);
    }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera className="h-5 w-5 text-accent" />
            Check-in do Veículo
          </DialogTitle>
          <DialogDescription>
            Registre o estado do veículo <strong className="text-foreground">{vehiclePlate}</strong> na entrada da oficina.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Photos Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Fotos Obrigatórias
                </FormLabel>
                <span className={cn(
                  "text-sm font-medium",
                  allPhotosUploaded ? "text-green-600" : "text-muted-foreground"
                )}>
                  {photosCount}/4 fotos
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {photoPositions.map((pos) => (
                  <div key={pos.id} className="relative">
                    <input
                      ref={el => fileInputRefs.current[pos.id] = el}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoChange(pos.id, e.target.files?.[0] || null)}
                    />
                    
                    {photoPreviews[pos.id] ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-green-500 shadow-lg">
                        <img
                          src={photoPreviews[pos.id]}
                          alt={pos.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                          <Check className="h-3 w-3" />
                          {pos.label}
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg"
                          onClick={() => handlePhotoChange(pos.id, null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {currentUpload === pos.id && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerFileInput(pos.id)}
                        className={cn(
                          "w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all",
                          "hover:border-accent hover:bg-accent/5 hover:scale-[1.02]",
                          "border-muted-foreground/30 bg-muted/20"
                        )}
                      >
                        <span className="text-2xl">{pos.icon}</span>
                        <span className="text-sm font-semibold">{pos.label}</span>
                        <span className="text-[10px] text-muted-foreground">{pos.description}</span>
                        <div className="flex items-center gap-1 mt-1 text-xs text-accent">
                          <Camera className="h-3 w-3" />
                          <span>Tirar foto</span>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {!allPhotosUploaded && (
                <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg flex items-center gap-2">
                  <Camera className="h-4 w-4 shrink-0" />
                  Tire as {4 - photosCount} foto(s) restante(s) para continuar
                </p>
              )}
            </div>

            {/* KM and Fuel */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="km_current"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      KM Atual
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 45000"
                        className="text-lg font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fuel_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Fuel className="h-4 w-4" />
                      Nível de Combustível
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fuelLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    level.percent <= 25 ? "bg-red-500" :
                                    level.percent <= 50 ? "bg-amber-500" :
                                    "bg-green-500"
                                  )}
                                  style={{ width: `${level.percent}%` }}
                                />
                              </div>
                              <span className="font-medium">{level.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Customer Items */}
            <FormField
              control={form.control}
              name="customer_items"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Itens do Cliente no Veículo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Documentos no porta-luvas, bolsa no banco traseiro, chave reserva..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Observations */}
            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (Avarias Existentes)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Arranhão na porta dianteira esquerda, amassado no para-lama traseiro direito..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Upload Progress */}
            {isSubmitting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {uploadProgress < 50 ? `Enviando fotos...` :
                     uploadProgress < 75 ? 'Salvando check-in...' :
                     uploadProgress < 100 ? 'Atualizando OS...' :
                     'Concluído!'}
                  </span>
                  <span className="font-medium">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={cn(
                  "gap-2",
                  allPhotosUploaded 
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                disabled={isSubmitting || !allPhotosUploaded}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirmar Check-in
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
