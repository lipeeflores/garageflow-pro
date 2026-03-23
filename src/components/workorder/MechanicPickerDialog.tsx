import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Wrench, User } from "lucide-react";

interface MechanicPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mechanicId: string) => void;
  loading?: boolean;
}

export function MechanicPickerDialog({ open, onOpenChange, onSelect, loading }: MechanicPickerDialogProps) {
  const { profile } = useAuth();

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics-list", profile?.tenant_id],
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
    enabled: open && !!profile?.tenant_id,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Atribuir Mecânico
          </DialogTitle>
          <DialogDescription>
            Selecione o mecânico que irá realizar o serviço
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {mechanics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum mecânico disponível
            </p>
          ) : (
            mechanics.map((mechanic) => (
              <Button
                key={mechanic.id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => onSelect(mechanic.id)}
                disabled={loading}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {mechanic.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <span className="font-medium">{mechanic.full_name}</span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
