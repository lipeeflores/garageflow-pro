import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "./usePushNotifications";
import { toast } from "@/hooks/use-toast";
import type { NotificationType } from "./useNotifications";

interface SendNotificationParams {
  notification_type: NotificationType;
  title: string;
  message: string;
  work_order_id?: string;
  recipient_id?: string | null;
  // Email data
  send_email?: boolean;
  recipient_email?: string;
  recipient_name?: string;
  email_data?: {
    vehicle_plate?: string;
    vehicle_info?: string;
    customer_name?: string;
    total_amount?: number;
    budget_url?: string;
  };
}

export function useSendNotification() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const { sendNotification: sendPushNotification, permission } = usePushNotifications();

  return useMutation({
    mutationFn: async (params: SendNotificationParams) => {
      if (!profile?.tenant_id) {
        throw new Error("Not authenticated");
      }

      // 1. Create notification in database
      const { data: notification, error: dbError } = await supabase
        .from("notifications")
        .insert({
          tenant_id: profile.tenant_id,
          notification_type: params.notification_type,
          title: params.title,
          message: params.message,
          work_order_id: params.work_order_id || null,
          recipient_id: params.recipient_id || null,
          is_read: false,
          is_sound_played: false,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Error creating notification:", dbError);
        throw dbError;
      }

      console.log("Notification created:", notification);

      // 2. Send push notification (if permission granted and current user is recipient)
      if (permission === "granted") {
        const shouldShowPush = !params.recipient_id || params.recipient_id === user?.id;
        if (shouldShowPush) {
          await sendPushNotification(params.notification_type, {
            work_order_id: params.work_order_id,
            vehicle_plate: params.email_data?.vehicle_plate,
            customer_name: params.email_data?.customer_name,
            total_amount: params.email_data?.total_amount,
          });
        }
      }

      // 3. Send email notification (if requested)
      if (params.send_email && params.recipient_email) {
        try {
          const { data: emailResult, error: emailError } = await supabase.functions.invoke(
            "send-notification-email",
            {
              body: {
                notification_type: params.notification_type,
                recipient_email: params.recipient_email,
                recipient_name: params.recipient_name || "Cliente",
                data: params.email_data || {},
              },
            }
          );

          if (emailError) {
            console.error("Error sending email:", emailError);
            // Don't throw - email failure shouldn't fail the whole notification
          } else {
            console.log("Email sent:", emailResult);
          }
        } catch (error) {
          console.error("Error calling email function:", error);
        }
      }

      return notification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => {
      console.error("Error sending notification:", error);
      toast({
        title: "Erro ao enviar notificação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Helper hook to notify about budget pending approval
export function useNotifyBudgetPending() {
  const sendNotification = useSendNotification();

  return async (data: {
    work_order_id: string;
    customer_name: string;
    customer_email?: string;
    vehicle_plate: string;
    vehicle_info: string;
    total_amount: number;
  }) => {
    const budgetUrl = `${window.location.origin}/orcamento/${data.work_order_id}`;

    return sendNotification.mutateAsync({
      notification_type: "ORCAMENTO_PENDENTE",
      title: "Orçamento Pendente",
      message: `Orçamento para ${data.vehicle_plate} (${data.customer_name}) aguarda aprovação`,
      work_order_id: data.work_order_id,
      send_email: !!data.customer_email,
      recipient_email: data.customer_email,
      recipient_name: data.customer_name,
      email_data: {
        vehicle_plate: data.vehicle_plate,
        vehicle_info: data.vehicle_info,
        customer_name: data.customer_name,
        total_amount: data.total_amount,
        budget_url: budgetUrl,
      },
    });
  };
}

// Helper hook to notify about budget approval
export function useNotifyBudgetApproved() {
  const sendNotification = useSendNotification();

  return async (data: {
    work_order_id: string;
    customer_name: string;
    vehicle_plate: string;
  }) => {
    return sendNotification.mutateAsync({
      notification_type: "OS_APROVADA",
      title: "Orçamento Aprovado!",
      message: `Cliente ${data.customer_name} aprovou o orçamento para ${data.vehicle_plate}`,
      work_order_id: data.work_order_id,
      recipient_id: null, // Notify all managers
      send_email: false, // Internal notification only
      email_data: {
        customer_name: data.customer_name,
        vehicle_plate: data.vehicle_plate,
      },
    });
  };
}

// Helper hook to notify about vehicle ready for pickup
export function useNotifyVehicleReady() {
  const sendNotification = useSendNotification();

  return async (data: {
    work_order_id: string;
    customer_name: string;
    customer_email?: string;
    vehicle_plate: string;
  }) => {
    return sendNotification.mutateAsync({
      notification_type: "CARRO_LIBERADO",
      title: "Veículo Pronto!",
      message: `${data.vehicle_plate} está pronto para retirada`,
      work_order_id: data.work_order_id,
      send_email: !!data.customer_email,
      recipient_email: data.customer_email,
      recipient_name: data.customer_name,
      email_data: {
        vehicle_plate: data.vehicle_plate,
        customer_name: data.customer_name,
      },
    });
  };
}
