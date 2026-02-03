import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ("Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: "Notificações não suportadas",
        description: "Seu navegador não suporta notificações push.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        toast({
          title: "Notificações ativadas!",
          description: "Você receberá alertas sobre orçamentos, aprovações e veículos prontos.",
        });
        return true;
      } else if (result === "denied") {
        toast({
          title: "Notificações bloqueadas",
          description: "Você pode reativar nas configurações do navegador.",
          variant: "destructive",
        });
      }
      return false;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(
    async (options: PushNotificationOptions) => {
      if (!isSupported) {
        console.log("Notifications not supported");
        return null;
      }

      if (permission !== "granted") {
        console.log("Notification permission not granted");
        return null;
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || "/favicon.ico",
          tag: options.tag,
          data: options.data,
          requireInteraction: options.requireInteraction ?? false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          
          // Navigate to relevant page based on notification data
          if (options.data?.work_order_id) {
            window.location.href = `/ordens/${options.data.work_order_id}`;
          }
        };

        return notification;
      } catch (error) {
        console.error("Error showing notification:", error);
        return null;
      }
    },
    [isSupported, permission]
  );

  // Send notification based on notification type
  const sendNotification = useCallback(
    async (
      type: string,
      data: {
        work_order_id?: string;
        vehicle_plate?: string;
        customer_name?: string;
        total_amount?: number;
      }
    ) => {
      const notifications: Record<string, PushNotificationOptions> = {
        ORCAMENTO_PENDENTE: {
          title: "🔧 Orçamento Pendente",
          body: `Novo orçamento para ${data.vehicle_plate || "veículo"} aguarda aprovação`,
          tag: `budget-${data.work_order_id}`,
          data: { work_order_id: data.work_order_id },
          requireInteraction: true,
        },
        OS_APROVADA: {
          title: "✅ Orçamento Aprovado!",
          body: `Cliente ${data.customer_name || ""} aprovou o orçamento para ${data.vehicle_plate || "veículo"}`,
          tag: `approved-${data.work_order_id}`,
          data: { work_order_id: data.work_order_id },
          requireInteraction: true,
        },
        CARRO_LIBERADO: {
          title: "🚗 Veículo Pronto!",
          body: `${data.vehicle_plate || "Veículo"} está pronto para retirada`,
          tag: `ready-${data.work_order_id}`,
          data: { work_order_id: data.work_order_id },
        },
        QC_PENDENTE: {
          title: "🔍 Qualidade Pendente",
          body: `Veículo ${data.vehicle_plate || ""} aguarda inspeção de qualidade`,
          tag: `qc-${data.work_order_id}`,
          data: { work_order_id: data.work_order_id },
        },
        NOVA_OS: {
          title: "📋 Nova Ordem de Serviço",
          body: `Nova OS criada para ${data.vehicle_plate || "veículo"}`,
          tag: `new-${data.work_order_id}`,
          data: { work_order_id: data.work_order_id },
        },
      };

      const notificationConfig = notifications[type];
      if (notificationConfig) {
        return showNotification(notificationConfig);
      }
      return null;
    },
    [showNotification]
  );

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    sendNotification,
  };
}
