import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkOrders, type WorkflowStep } from "@/hooks/useWorkOrders";
import { useTodayAndMissedAppointments } from "@/hooks/useAppointments";
import { useMechanicRanking, formatMinutes } from "@/hooks/useMechanicRanking";
import { useSoundAlerts } from "@/hooks/useSoundAlerts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Car,
  Clock,
  Calendar,
  Trophy,
  Wrench,
  CheckCircle2,
  Timer,
  AlertCircle,
  Wifi,
  Volume2,
  VolumeX,
  Bell,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface WorkflowColumn {
  id: WorkflowStep;
  title: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const workflowColumns: WorkflowColumn[] = [
  { id: "AGUARDANDO_CHECKIN", title: "Aguardando", color: "bg-yellow-500", icon: Clock },
  { id: "EM_DIAGNOSTICO", title: "Diagnóstico", color: "bg-blue-500", icon: AlertCircle },
  { id: "AGUARDANDO_APROVACAO", title: "Orçamento", color: "bg-orange-500", icon: Timer },
  { id: "EM_EXECUCAO", title: "Execução", color: "bg-purple-500", icon: Wrench },
  { id: "EM_QUALIDADE", title: "Qualidade", color: "bg-cyan-500", icon: CheckCircle2 },
  { id: "PRONTO_PARA_RETIRADA", title: "Pronto", color: "bg-green-500", icon: Car },
];

function CurrentTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <div className="text-5xl font-bold font-display tracking-tight">
        {format(time, "HH:mm")}
      </div>
      <div className="text-lg text-muted-foreground capitalize">
        {format(time, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </div>
    </div>
  );
}

interface OSQueueProps {
  highlightedOS: Set<string>;
}

function OSQueue({ highlightedOS }: OSQueueProps) {
  const { data: workOrders, isLoading } = useWorkOrders({
    workflow_step: workflowColumns.map(c => c.id),
  });

  const getOrdersByStep = (step: WorkflowStep) => {
    return workOrders?.filter(wo => wo.workflow_step === step) || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const topColumns = workflowColumns.slice(0, 3);
  const bottomColumns = workflowColumns.slice(3, 6);

  const renderColumn = (column: WorkflowColumn) => {
    const orders = getOrdersByStep(column.id);
    const Icon = column.icon;
    
    return (
      <div
        key={column.id}
        className="flex flex-col rounded-xl bg-card/50 backdrop-blur border border-border/50"
      >
        {/* Column Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", column.color)}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold">{column.title}</h3>
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-auto text-sm font-bold px-3 py-1",
                orders.length > 0 && "bg-accent text-accent-foreground"
              )}
            >
              {orders.length}
            </Badge>
          </div>
        </div>

        {/* Cards */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                Vazio
              </div>
            ) : (
              orders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className={cn(
                    "p-4 rounded-lg bg-background border transition-all",
                    order.priority === "ALTA" 
                      ? "border-destructive/50 animate-pulse-slow" 
                      : "border-border/50",
                    highlightedOS.has(order.id) && "ring-2 ring-accent animate-pulse"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl font-bold">
                      {order.vehicle?.plate || "---"}
                    </span>
                    {order.priority === "ALTA" && (
                      <span className="text-lg">🔴</span>
                    )}
                    {highlightedOS.has(order.id) && (
                      <Bell className="h-5 w-5 text-accent animate-bounce" />
                    )}
                  </div>
                  <div className="mt-2 text-base text-muted-foreground">
                    {order.vehicle?.make} {order.vehicle?.model}
                  </div>
                  {order.mechanic && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {order.mechanic.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {order.mechanic.full_name.split(" ")[0]}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
            {orders.length > 6 && (
              <div className="text-center text-sm text-muted-foreground py-2">
                +{orders.length - 6} mais
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="grid grid-rows-2 gap-4 h-full">
      {/* Top Row - 3 columns */}
      <div className="grid grid-cols-3 gap-4">
        {topColumns.map(renderColumn)}
      </div>
      {/* Bottom Row - 3 columns */}
      <div className="grid grid-cols-3 gap-4">
        {bottomColumns.map(renderColumn)}
      </div>
    </div>
  );
}

function TodayAgenda() {
  const { data, isLoading } = useTodayAndMissedAppointments();

  const todayAppointments = data?.today?.filter(a => 
    a.status === "AGENDADO" || a.status === "CHEGOU"
  ) || [];
  const missedAppointments = data?.missed || [];
  const allItems = [...todayAppointments, ...missedAppointments].slice(0, 6);

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>;
  }

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Calendar className="h-8 w-8 mb-2 opacity-50" />
        <span className="text-sm">Sem agendamentos pendentes</span>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-2">
      {allItems.map((appointment) => {
        const isNoShow = appointment.status === "NAO_COMPARECEU";
        const isLate = appointment.status === "AGENDADO" && new Date(appointment.scheduled_at) < now;
        const isArrived = appointment.status === "CHEGOU";

        return (
          <div
            key={appointment.id}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg border",
              isNoShow
                ? "bg-red-500/10 border-red-500/50"
                : isLate
                ? "bg-yellow-500/10 border-yellow-500/50"
                : isArrived
                ? "bg-green-500/10 border-green-500/50"
                : "bg-background/50 border-border/50"
            )}
          >
            <div className="text-center min-w-[50px]">
              <div className="text-lg font-bold font-display">
                {format(new Date(appointment.scheduled_at), "HH:mm")}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {appointment.vehicle?.plate || "---"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {appointment.customer?.full_name}
              </div>
            </div>
            {isNoShow ? (
              <Badge variant="destructive" className="text-[10px] shrink-0">
                Remarcar
              </Badge>
            ) : isLate ? (
              <Badge className="text-[10px] shrink-0 bg-yellow-600 hover:bg-yellow-700">
                Atrasado
              </Badge>
            ) : isArrived ? (
              <Badge className="text-[10px] shrink-0 bg-green-600 hover:bg-green-700">
                Chegou
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {appointment.vehicle?.make}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MechanicLeaderboard() {
  const { data: ranking, isLoading } = useMechanicRanking();

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>;
  }

  if (!ranking || ranking.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Trophy className="h-8 w-8 mb-2 opacity-50" />
        <span className="text-sm">Sem dados de ranking</span>
      </div>
    );
  }

  const topMechanics = ranking.slice(0, 5);

  return (
    <div className="space-y-2">
      {topMechanics.map((mechanic, idx) => (
        <div
          key={mechanic.id}
          className={cn(
            "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
            idx === 0 
              ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30" 
              : idx === 1 
              ? "bg-gradient-to-r from-gray-400/10 to-gray-500/10 border-gray-400/30"
              : idx === 2
              ? "bg-gradient-to-r from-amber-600/10 to-amber-700/10 border-amber-600/30"
              : "bg-background/50 border-border/50"
          )}
        >
          <div className={cn(
            "flex items-center justify-center h-8 w-8 rounded-full font-bold text-sm",
            idx === 0 ? "bg-yellow-500 text-yellow-950" :
            idx === 1 ? "bg-gray-400 text-gray-900" :
            idx === 2 ? "bg-amber-600 text-amber-950" :
            "bg-muted text-muted-foreground"
          )}>
            {idx + 1}
          </div>
          <Avatar className="h-8 w-8">
            <AvatarImage src={mechanic.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">{mechanic.initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">
              {mechanic.name.split(" ")[0]}
            </div>
            <div className="text-xs text-muted-foreground">
              {mechanic.osCompleted} OS • {formatMinutes(mechanic.avgTimeMinutes)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-display text-accent">
              {mechanic.score}
            </div>
            <div className="text-[10px] text-muted-foreground">pts</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkshopTV() {
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [highlightedOS, setHighlightedOS] = useState<Set<string>>(new Set());
  const { playSound, testSounds } = useSoundAlerts();
  const knownOSIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enable sound on first interaction (browser autoplay policy)
  const enableSound = useCallback(() => {
    if (soundEnabled) {
      playSound("notification");
      toast.success("Alertas sonoros ativados!");
    }
  }, [soundEnabled, playSound]);

  // Highlight an OS temporarily
  const highlightOS = useCallback((osId: string) => {
    setHighlightedOS(prev => new Set(prev).add(osId));
    setTimeout(() => {
      setHighlightedOS(prev => {
        const next = new Set(prev);
        next.delete(osId);
        return next;
      });
    }, 10000); // Remove highlight after 10 seconds
  }, []);

  // Real-time subscription for work_orders changes
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const channel = supabase
      .channel('tv-work-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'work_orders',
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          console.log('New work order:', payload);
          
          // Skip sound on first load
          if (isFirstLoad.current) return;
          
          const newOS = payload.new as any;
          
          if (soundEnabled) {
            playSound("new_os");
          }
          
          highlightOS(newOS.id);
          setLastUpdate(new Date());
          
          toast.info("Nova OS recebida!", {
            description: `Placa: ${newOS.vehicle_id?.slice(0, 8) || "---"}`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'work_orders',
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          console.log('Work order updated:', payload);
          
          // Skip sound on first load
          if (isFirstLoad.current) return;
          
          const oldOS = payload.old as any;
          const newOS = payload.new as any;
          
          // Check for specific transitions
          if (oldOS.workflow_step !== newOS.workflow_step) {
            // Budget approved (AGUARDANDO_APROVACAO -> APROVADO)
            if (oldOS.workflow_step === 'AGUARDANDO_APROVACAO' && newOS.workflow_step === 'APROVADO') {
              if (soundEnabled) {
                playSound("approved");
              }
              highlightOS(newOS.id);
              toast.success("Orçamento aprovado!", {
                description: "Cliente aprovou o serviço",
              });
            }
            
            // Ready for pickup
            if (newOS.workflow_step === 'PRONTO_PARA_RETIRADA') {
              if (soundEnabled) {
                playSound("ready");
              }
              highlightOS(newOS.id);
              toast.success("Veículo pronto!", {
                description: "Pronto para retirada",
              });
            }
            
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // Mark first load as complete after a short delay
          setTimeout(() => {
            isFirstLoad.current = false;
          }, 2000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.tenant_id, soundEnabled, playSound, highlightOS]);

  return (
    <div className="dark min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Garage Box Pro</h1>
              <p className="text-sm text-muted-foreground">Painel da Oficina</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-8">
            <div className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              isOnline ? "bg-green-500" : "bg-red-500"
            )} />
            <Wifi className={cn(
              "h-4 w-4",
              isOnline ? "text-green-500" : "text-red-500"
            )} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) {
                enableSound();
              }
            }}
            className={cn(
              "gap-2",
              soundEnabled ? "text-accent" : "text-muted-foreground"
            )}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundEnabled ? "Som Ativo" : "Mudo"}
          </Button>
          <CurrentTime />
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        {/* OS Queue - Takes 9 columns */}
        <div className="col-span-9">
          <Card className="h-full border-border/50 bg-card/30 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="h-5 w-5 text-accent" />
                Fila de Serviços
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-60px)]">
              <OSQueue highlightedOS={highlightedOS} />
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Takes 3 columns */}
        <div className="col-span-3 space-y-4">
          {/* Today's Agenda */}
          <Card className="border-border/50 bg-card/30 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-accent" />
                Próximos Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TodayAgenda />
            </CardContent>
          </Card>

          {/* Mechanic Leaderboard */}
          <Card className="flex-1 border-border/50 bg-card/30 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Ranking do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MechanicLeaderboard />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-slate-900/90 backdrop-blur border-t border-slate-700/50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Realtime: Ativo</span>
          <span>•</span>
          <span>Última atualização: {format(lastUpdate, "HH:mm:ss")}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            testSounds();
            toast.info("Testando todos os sons...");
          }}
          className="text-xs text-slate-400 hover:text-slate-50"
        >
          <Volume2 className="h-3.5 w-3.5 mr-1" />
          Testar Sons
        </Button>
      </footer>
    </div>
  );
}
