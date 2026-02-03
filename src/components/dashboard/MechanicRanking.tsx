import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Clock, Wrench, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useMechanicRanking, formatMinutes } from "@/hooks/useMechanicRanking";
import { Skeleton } from "@/components/ui/skeleton";

const positionStyles = {
  1: "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-glow",
  2: "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800",
  3: "bg-gradient-to-br from-amber-600 to-amber-700 text-white",
  default: "bg-muted text-muted-foreground",
};

export function MechanicRanking() {
  const { data: mechanics, isLoading } = useMechanicRanking();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!mechanics || mechanics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold text-foreground">Nenhum mecânico encontrado</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O ranking será exibido quando houver mecânicos e OS concluídas
        </p>
      </div>
    );
  }

  const maxScore = Math.max(...mechanics.map(m => m.score), 1);

  return (
    <div className="space-y-4">
      {mechanics.map((mechanic) => (
        <div
          key={mechanic.id}
          className={cn(
            "group flex items-center gap-4 rounded-xl border p-4 transition-all duration-200",
            mechanic.position === 1
              ? "border-accent/30 bg-accent/5"
              : "border-border bg-card hover:border-accent/20 hover:shadow-soft"
          )}
        >
          {/* Position Badge */}
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold",
              mechanic.position === 1 ? positionStyles[1] :
              mechanic.position === 2 ? positionStyles[2] :
              mechanic.position === 3 ? positionStyles[3] :
              positionStyles.default
            )}
          >
            {mechanic.position === 1 ? (
              <Trophy className="h-5 w-5" />
            ) : (
              mechanic.position
            )}
          </div>

          {/* Avatar & Name */}
          <div className="flex items-center gap-3">
            {mechanic.avatarUrl ? (
              <img 
                src={mechanic.avatarUrl} 
                alt={mechanic.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {mechanic.initials}
              </div>
            )}
            <div>
              <h4 className="font-semibold text-foreground">{mechanic.name}</h4>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <TrendingUp
                  className={cn(
                    "h-3.5 w-3.5",
                    mechanic.trend > 0 && "text-success",
                    mechanic.trend < 0 && "text-destructive"
                  )}
                />
                <span>
                  {mechanic.osCompleted} OS este mês
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="ml-auto flex items-center gap-6">
            <div className="text-center hidden sm:block">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                <span>OS</span>
              </div>
              <p className="font-display text-lg font-bold text-foreground">
                {mechanic.osCompleted}
              </p>
            </div>

            <div className="text-center hidden md:block">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Média</span>
              </div>
              <p className="font-display text-lg font-bold text-foreground">
                {formatMinutes(mechanic.avgTimeMinutes)}
              </p>
            </div>

            <div className="w-32">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Score</span>
                <span className="font-bold text-foreground">{mechanic.score}</span>
              </div>
              <Progress
                value={(mechanic.score / maxScore) * 100}
                className={cn(
                  "h-2",
                  mechanic.position === 1 && "[&>div]:bg-accent"
                )}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
