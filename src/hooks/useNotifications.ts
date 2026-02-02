import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export type NotificationType = 
  | 'ORCAMENTO_PENDENTE'
  | 'QC_PENDENTE'
  | 'OS_APROVADA'
  | 'CARRO_LIBERADO'
  | 'ATRASO_AGENDAMENTO'
  | 'LEMBRETE_AGENDAMENTO'
  | 'DIAGNOSTICO_INICIADO'
  | 'NOVA_OS';

export interface Notification {
  id: string;
  tenant_id: string;
  recipient_id: string | null;
  notification_type: NotificationType;
  title: string;
  message: string;
  work_order_id: string | null;
  is_read: boolean;
  is_sound_played: boolean;
  created_at: string;
}

export function useNotifications() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!profile?.tenant_id || !user?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!profile?.tenant_id && !!user?.id,
  });

  // Real-time subscription
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.tenant_id, queryClient]);

  return query;
}

export function useUnreadCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter(n => !n.is_read).length ?? 0;
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id || !user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('tenant_id', profile.tenant_id)
        .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
