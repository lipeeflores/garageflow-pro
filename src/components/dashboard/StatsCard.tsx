import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "accent" | "success" | "warning";
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:shadow-elevated",
        variant === "default" && "border-border bg-card",
        variant === "accent" && "border-accent/20 bg-accent/5",
        variant === "success" && "border-success/20 bg-success/5",
        variant === "warning" && "border-warning/20 bg-warning/5"
      )}
    >
      {/* Background decoration */}
      <div
        className={cn(
          "absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl transition-all duration-500 group-hover:opacity-20",
          variant === "default" && "bg-primary",
          variant === "accent" && "bg-accent",
          variant === "success" && "bg-success",
          variant === "warning" && "bg-warning"
        )}
      />

      <div className="relative">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              variant === "default" && "bg-primary/10 text-primary",
              variant === "accent" && "bg-accent/20 text-accent",
              variant === "success" && "bg-success/20 text-success",
              variant === "warning" && "bg-warning/20 text-warning"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            <span
              className={cn(
                "text-xs font-semibold",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>

        {/* Content */}
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
