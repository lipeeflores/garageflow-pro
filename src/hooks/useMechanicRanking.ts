import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "@/hooks/use-toast";

export interface MechanicRankingData {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  score: number;
  osCompleted: number;
  avgTimeMinutes: number;
  totalWorkMinutes: number;
  laborValue: number;
  returnPenalties: number;
  punctualityPenalties: number;
  position: number;
  trend: number;
}

export function useMechanicRanking(month?: Date) {
  const { profile } = useAuth();
  const targetMonth = month || new Date();
  const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['mechanic_ranking', profile?.tenant_id, monthStart],
    queryFn: async (): Promise<MechanicRankingData[]> => {
      if (!profile?.tenant_id) return [];

      // First check if we have pre-calculated ranking_scores for this month
      const { data: rankingScores } = await supabase
        .from('ranking_scores')
        .select(`
          id,
          profile_id,
          score,
          completed_os_count,
          avg_time_per_os_minutes,
          total_work_time_minutes,
          generated_labor_value,
          return_penalty_points,
          punctuality_penalty_points
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('month', monthStart)
        .lte('month', monthEnd);

      // Get mechanic profiles
      const { data: mechanics } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          avatar_url
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true);

      // Get mechanic role user IDs
      const { data: mechanicRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('role', 'MECHANIC');

      const mechanicUserIds = new Set(mechanicRoles?.map(r => r.user_id) || []);
      const mechanicProfiles = mechanics?.filter(m => mechanicUserIds.has(m.id)) || [];

      if (rankingScores && rankingScores.length > 0) {
        // Use pre-calculated scores
        const scoreMap = new Map(rankingScores.map(s => [s.profile_id, s]));
        
        const ranked = mechanicProfiles
          .map(mechanic => {
            const score = scoreMap.get(mechanic.id);
            const nameParts = mechanic.full_name.split(' ');
            const initials = nameParts.length > 1 
              ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
              : mechanic.full_name.substring(0, 2).toUpperCase();

            return {
              id: mechanic.id,
              name: mechanic.full_name,
              initials,
              avatarUrl: mechanic.avatar_url,
              score: score?.score || 0,
              osCompleted: score?.completed_os_count || 0,
              avgTimeMinutes: score?.avg_time_per_os_minutes || 0,
              totalWorkMinutes: score?.total_work_time_minutes || 0,
              laborValue: score?.generated_labor_value || 0,
              returnPenalties: score?.return_penalty_points || 0,
              punctualityPenalties: score?.punctuality_penalty_points || 0,
              position: 0,
              trend: 0,
            };
          })
          .sort((a, b) => b.score - a.score)
          .map((m, idx) => ({ ...m, position: idx + 1 }));

        return ranked;
      }

      // Calculate ranking from raw data if no pre-calculated scores
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('id, current_mechanic_id, workflow_step, total_amount, created_at')
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('profile_id, start_time, end_time, entry_type')
        .eq('tenant_id', profile.tenant_id)
        .gte('start_time', monthStart);

      const { data: penalties } = await supabase
        .from('ranking_penalties')
        .select('profile_id, penalty_points, reason')
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', monthStart);

      // Calculate metrics per mechanic
      const mechanicStats = new Map<string, {
        osCompleted: number;
        totalMinutes: number;
        laborValue: number;
        returnPenalties: number;
        punctualityPenalties: number;
      }>();

      // Initialize stats for all mechanics
      mechanicProfiles.forEach(m => {
        mechanicStats.set(m.id, {
          osCompleted: 0,
          totalMinutes: 0,
          laborValue: 0,
          returnPenalties: 0,
          punctualityPenalties: 0,
        });
      });

      // Count completed OS per mechanic
      workOrders?.forEach(wo => {
        if (wo.current_mechanic_id && wo.workflow_step === 'FINALIZADO') {
          const stats = mechanicStats.get(wo.current_mechanic_id);
          if (stats) {
            stats.osCompleted += 1;
            stats.laborValue += wo.total_amount || 0;
          }
        }
      });

      // Sum time entries
      timeEntries?.forEach(te => {
        if (te.end_time) {
          const stats = mechanicStats.get(te.profile_id);
          if (stats) {
            const start = new Date(te.start_time).getTime();
            const end = new Date(te.end_time).getTime();
            stats.totalMinutes += (end - start) / 60000;
          }
        }
      });

      // Sum penalties
      penalties?.forEach(p => {
        const stats = mechanicStats.get(p.profile_id);
        if (stats) {
          if (p.reason?.toLowerCase().includes('retorno') || p.reason?.toLowerCase().includes('retrabalho')) {
            stats.returnPenalties += p.penalty_points;
          } else {
            stats.punctualityPenalties += p.penalty_points;
          }
        }
      });

      // Calculate scores and build ranking
      const ranked = mechanicProfiles
        .map(mechanic => {
          const stats = mechanicStats.get(mechanic.id) || {
            osCompleted: 0,
            totalMinutes: 0,
            laborValue: 0,
            returnPenalties: 0,
            punctualityPenalties: 0,
          };

          const nameParts = mechanic.full_name.split(' ');
          const initials = nameParts.length > 1 
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : mechanic.full_name.substring(0, 2).toUpperCase();

          const avgTime = stats.osCompleted > 0 
            ? stats.totalMinutes / stats.osCompleted 
            : 0;

          // Score calculation: 
          // Base: 10 points per completed OS
          // Bonus: labor value / 100
          // Penalty: -5 per return, -2 per punctuality issue
          const score = Math.max(0, 
            (stats.osCompleted * 10) + 
            (stats.laborValue / 100) - 
            (stats.returnPenalties * 5) - 
            (stats.punctualityPenalties * 2)
          );

          return {
            id: mechanic.id,
            name: mechanic.full_name,
            initials,
            avatarUrl: mechanic.avatar_url,
            score: Math.round(score),
            osCompleted: stats.osCompleted,
            avgTimeMinutes: Math.round(avgTime),
            totalWorkMinutes: Math.round(stats.totalMinutes),
            laborValue: stats.laborValue,
            returnPenalties: stats.returnPenalties,
            punctualityPenalties: stats.punctualityPenalties,
            position: 0,
            trend: 0,
          };
        })
        .sort((a, b) => b.score - a.score)
        .map((m, idx) => ({ ...m, position: idx + 1 }));

      return ranked;
    },
    enabled: !!profile?.tenant_id,
    refetchInterval: 60000, // Refresh every minute
  });
}

// Hook to trigger ranking recalculation via edge function
export function useRecalculateRanking() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (month?: Date) => {
      const targetMonth = month || new Date();
      const monthStr = format(targetMonth, 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('calculate-monthly-ranking', {
        body: { month: monthStr },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mechanic_ranking'] });
      toast({
        title: "Ranking atualizado",
        description: `${data.mechanics_processed} mecânicos processados para ${data.month}`,
      });
    },
    onError: (error: Error) => {
      console.error("Error recalculating ranking:", error);
      toast({
        title: "Erro ao recalcular ranking",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Helper to format minutes as "Xh Ymin"
export function formatMinutes(minutes: number): string {
  if (minutes === 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${mins}min`;
}
