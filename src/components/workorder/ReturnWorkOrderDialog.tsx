import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RotateCcw, User } from "lucide-react";
import { useCreateReturn } from "@/hooks/useWorkOrderReturns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

interface ReturnWorkOrderDialogProps {
  workOrderId: string;
  vehicleId: string;
  customerId: string;
  vehiclePlate: string;
  originalMechanicId?: string;
  originalMechanicName?: string;
  trigger?: React.ReactNode;
}

export function ReturnWorkOrderDialog({
  workOrderId,
  vehicleId,
  customerId,
  vehiclePlate,
  originalMechanicId,
  originalMechanicName,
  trigger,
}: ReturnWorkOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [blamedMechanicId, setBlamedMechanicId] = useState<string | undefined>(originalMechanicId);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const createReturn = useCreateReturn();

  // Fetch all mechanics for selection
  const { data: mechanics } = useQuery({
    queryKey: ['mechanics', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      
      // Get mechanic user IDs
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('role', 'MECHANIC');

      if (roleError) throw roleError;
      if (!roleData?.length) return [];

      const mechanicIds = roleData.map(r => r.user_id);

      // Get profile info for those mechanics
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('tenant_id', profile.tenant_id)
        .in('id', mechanicIds);

      if (profileError) throw profileError;
      return profileData || [];
    },
    enabled: open && !!profile?.tenant_id,
  });

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Erro",
        description: "Informe o motivo do retorno",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createReturn.mutateAsync({
        original_work_order_id: workOrderId,
        vehicle_id: vehicleId,
        customer_id: customerId,
        reason: reason.trim(),
        mechanic_blamed_id: blamedMechanicId,
        initial_complaint: `RETORNO DE GARANTIA: ${reason.trim()}`,
      });

      toast({
        title: "Retorno criado",
        description: blamedMechanicId 
          ? "OS de retorno criada e penalidade aplicada ao mecânico."
          : "OS de retorno criada com sucesso.",
      });

      setOpen(false);
      setReason("");
      
      // Navigate to the new return work order
      navigate(`/ordens/${result.workOrder.id}`);
    } catch (error) {
      console.error('Error creating return:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a OS de retorno.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full gap-2 border-destructive/50 text-destructive hover:bg-destructive/10">
            <RotateCcw className="h-4 w-4" />
            Registrar Retorno
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Registrar Retorno de Garantia
          </DialogTitle>
          <DialogDescription>
            Crie uma nova OS de retorno vinculada à OS original do veículo{" "}
            <strong>{vehiclePlate}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo do Retorno *</Label>
            <Textarea
              id="reason"
              placeholder="Descreva o problema que motivou o retorno..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Blamed Mechanic */}
          <div className="space-y-2">
            <Label htmlFor="mechanic" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Mecânico Responsável (opcional)
            </Label>
            <Select
              value={blamedMechanicId || "none"}
              onValueChange={(v) => setBlamedMechanicId(v === "none" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mecânico..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {originalMechanicId && originalMechanicName && (
                  <SelectItem value={originalMechanicId}>
                    {originalMechanicName} (original)
                  </SelectItem>
                )}
                {mechanics?.filter(m => m.id !== originalMechanicId).map((mechanic) => (
                  <SelectItem key={mechanic.id} value={mechanic.id}>
                    {mechanic.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se selecionado, uma penalidade de <Badge variant="destructive" className="text-xs">-10 pts</Badge> será aplicada ao ranking.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createReturn.isPending || !reason.trim()}
            className="gap-2 bg-destructive hover:bg-destructive/90"
          >
            {createReturn.isPending ? (
              "Criando..."
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Criar OS de Retorno
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
