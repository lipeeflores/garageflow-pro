import { useState, useEffect } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationPermissionPrompt() {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [showDialog, setShowDialog] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);

  useEffect(() => {
    // Check if we've already prompted
    const prompted = localStorage.getItem("notification-prompted");
    if (prompted) {
      setHasPrompted(true);
      return;
    }

    // Show prompt after a short delay if permission is default
    if (isSupported && permission === "default") {
      const timer = setTimeout(() => {
        setShowDialog(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    await requestPermission();
    localStorage.setItem("notification-prompted", "true");
    setHasPrompted(true);
    setShowDialog(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("notification-prompted", "true");
    setHasPrompted(true);
    setShowDialog(false);
  };

  if (!isSupported || hasPrompted || permission !== "default") {
    return null;
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <BellRing className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center">
            Ativar Notificações?
          </DialogTitle>
          <DialogDescription className="text-center">
            Receba alertas instantâneos quando houver novos orçamentos pendentes,
            aprovações de clientes ou veículos prontos para retirada.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <span className="text-lg">📋</span>
            </div>
            <div>
              <p className="text-sm font-medium">Orçamentos Pendentes</p>
              <p className="text-xs text-muted-foreground">
                Seja notificado quando um orçamento precisar de aprovação
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
              <span className="text-lg">✅</span>
            </div>
            <div>
              <p className="text-sm font-medium">Aprovações</p>
              <p className="text-xs text-muted-foreground">
                Saiba quando o cliente aprovar o orçamento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <span className="text-lg">🚗</span>
            </div>
            <div>
              <p className="text-sm font-medium">Veículo Pronto</p>
              <p className="text-xs text-muted-foreground">
                Notificação quando o veículo estiver pronto
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleEnable} className="w-full">
            <Bell className="mr-2 h-4 w-4" />
            Ativar Notificações
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full">
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
