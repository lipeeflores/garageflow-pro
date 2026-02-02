import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Clock, Wrench } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Mechanic {
  id: string;
  name: string;
  initials: string;
  score: number;
  osCompleted: number;
  avgTime: string;
  trend: number;
  position: number;
}

const mockMechanics: Mechanic[] = [
  {
    id: "1",
    name: "Carlos Silva",
    initials: "CS",
    score: 95,
    osCompleted: 24,
    avgTime: "2h 15min",
    trend: 5,
    position: 1,
  },
  {
    id: "2",
    name: "Roberto Santos",
    initials: "RS",
    score: 88,
    osCompleted: 21,
    avgTime: "2h 45min",
    trend: 2,
    position: 2,
  },
  {
    id: "3",
    name: "André Lima",
    initials: "AL",
    score: 82,
    osCompleted: 19,
    avgTime: "3h 00min",
    trend: -1,
    position: 3,
  },
  {
    id: "4",
    name: "Paulo Oliveira",
    initials: "PO",
    score: 75,
    osCompleted: 16,
    avgTime: "3h 30min",
    trend: 0,
    position: 4,
  },
];

const positionStyles = {
  1: "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-glow",
  2: "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800",
  3: "bg-gradient-to-br from-amber-600 to-amber-700 text-white",
  4: "bg-muted text-muted-foreground",
};

export function MechanicRanking() {
  return (
    <div className="space-y-4">
      {mockMechanics.map((mechanic) => (
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
              positionStyles[mechanic.position as keyof typeof positionStyles] ||
                positionStyles[4]
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {mechanic.initials}
            </div>
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
                  {mechanic.trend > 0 && "+"}
                  {mechanic.trend}% este mês
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="ml-auto flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                <span>OS</span>
              </div>
              <p className="font-display text-lg font-bold text-foreground">
                {mechanic.osCompleted}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Média</span>
              </div>
              <p className="font-display text-lg font-bold text-foreground">
                {mechanic.avgTime}
              </p>
            </div>

            <div className="w-32">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Score</span>
                <span className="font-bold text-foreground">{mechanic.score}</span>
              </div>
              <Progress
                value={mechanic.score}
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
