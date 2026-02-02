import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CheckCircle2, 
  ClipboardCheck, 
  Wrench, 
  FileText, 
  Clock,
  AlertCircle,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkOrderEvents, type WorkOrderEvent } from "@/hooks/useWorkOrderEvents";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkOrderTimelineProps {
  workOrderId: string;
}

const eventIcons: Record<string, React.ReactNode> = {
  WORKFLOW_STEP_CHANGE: <Clock className="h-4 w-4" />,
  CHECKIN_COMPLETED: <ClipboardCheck className="h-4 w-4" />,
  DIAGNOSIS_STARTED: <Wrench className="h-4 w-4" />,
  DIAGNOSIS_COMPLETED: <CheckCircle2 className="h-4 w-4" />,
  QUOTE_SENT: <FileText className="h-4 w-4" />,
  QUOTE_APPROVED: <CheckCircle2 className="h-4 w-4" />,
  QUALITY_APPROVED: <CheckCircle2 className="h-4 w-4" />,
  QUALITY_REJECTED: <AlertCircle className="h-4 w-4" />,
};

const eventColors: Record<string, string> = {
  WORKFLOW_STEP_CHANGE: "bg-primary/20 text-primary",
  CHECKIN_COMPLETED: "bg-info/20 text-info",
  DIAGNOSIS_STARTED: "bg-warning/20 text-warning",
  DIAGNOSIS_COMPLETED: "bg-success/20 text-success",
  QUOTE_SENT: "bg-accent/20 text-accent",
  QUOTE_APPROVED: "bg-success/20 text-success",
  QUALITY_APPROVED: "bg-success/20 text-success",
  QUALITY_REJECTED: "bg-destructive/20 text-destructive",
};

export function WorkOrderTimeline({ workOrderId }: WorkOrderTimelineProps) {
  const { data: events, isLoading } = useWorkOrderEvents(workOrderId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum evento registrado ainda
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 h-full w-0.5 bg-border" />
      
      {events.map((event, index) => (
        <div key={event.id} className="relative flex gap-4 pl-2">
          {/* Icon */}
          <div 
            className={cn(
              "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
              eventColors[event.event_type] || "bg-muted text-muted-foreground"
            )}
          >
            {eventIcons[event.event_type] || <Clock className="h-4 w-4" />}
          </div>
          
          {/* Content */}
          <div className="flex-1 pb-4">
            <p className="text-sm font-medium">
              {event.description || event.event_type}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {event.actor && (
                <>
                  <User className="h-3 w-3" />
                  <span>{event.actor.full_name}</span>
                  <span>•</span>
                </>
              )}
              <span>
                {event.created_at && format(
                  new Date(event.created_at), 
                  "dd/MM/yyyy 'às' HH:mm",
                  { locale: ptBR }
                )}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
