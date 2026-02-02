import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Upload, X, Fuel, Gauge, Check } from "lucide-react";
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
  { id: "front", label: "Frente", required: true },
  { id: "back", label: "Traseira", required: true },
  { id: "left", label: "Lateral Esquerda", required: true },
  { id: "right", label: "Lateral Direita", required: true },
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

  const handlePhotoChange = (position: string, file: File | null) => {
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
  };

  const triggerFileInput = (position: string) => {
    fileInputRefs.current[position]?.click();
  };

  const allPhotosUploaded = photoPositions.every(pos => photos[pos.id] !== null);

  const uploadPhoto = async (file: File, position: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${workOrderId}/${position}-${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(fileName, file);

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

    try {
      // Upload all photos
      const photoUrls: Record<string, string> = {};
      for (const [position, file] of Object.entries(photos)) {
        if (file) {
          photoUrls[position] = await uploadPhoto(file, position);
        }
      }

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

      // Update work order status
      await updateWorkOrder.mutateAsync({
        id: workOrderId,
        updates: {
          workflow_step: 'CHECKIN_CONCLUIDO',
        },
      });

      queryClient.invalidateQueries({ queryKey: ['work_orders'] });

      toast({
        title: "Check-in realizado!",
        description: "O veículo foi registrado com sucesso.",
      });

      onOpenChange(false);
      
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Check-in do Veículo
          </DialogTitle>
          <DialogDescription>
            Registre o estado do veículo <strong>{vehiclePlate}</strong> na entrada da oficina.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Photos Grid */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos Obrigatórias (4)
              </FormLabel>
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
                      <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-success">
                        <img
                          src={photoPreviews[pos.id]}
                          alt={pos.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 bg-success text-success-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {pos.label}
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handlePhotoChange(pos.id, null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerFileInput(pos.id)}
                        className={cn(
                          "w-full aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors",
                          "hover:border-primary hover:bg-primary/5",
                          "border-muted-foreground/30 bg-muted/30"
                        )}
                      >
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm font-medium">{pos.label}</span>
                        <span className="text-xs text-muted-foreground">Clique para tirar foto</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!allPhotosUploaded && (
                <p className="text-sm text-destructive">
                  * Todas as 4 fotos são obrigatórias
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
                        placeholder="0"
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
                              <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${level.percent}%` }}
                                />
                              </div>
                              <span>{level.label}</span>
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
                      placeholder="Ex: Documentos, pertences, acessórios..."
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
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Avarias existentes, arranhões, amassados..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-success hover:bg-success/90"
                disabled={isSubmitting || !allPhotosUploaded}
              >
                {isSubmitting ? "Salvando..." : "Confirmar Check-in"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
