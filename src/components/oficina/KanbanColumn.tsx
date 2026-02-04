import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanColumnProps {
  title: string;
  icon: LucideIcon;
  color: string;
  count: number;
  children: ReactNode;
  emptyIcon?: LucideIcon;
  emptyText?: string;
}

export function KanbanColumn({
  title,
  icon: Icon,
  color,
  count,
  children,
  emptyIcon: EmptyIcon,
  emptyText = "Coluna Vazia",
}: KanbanColumnProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-lg bg-muted/30 border border-border/50">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/50">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded",
            color
          )}
        >
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-medium text-sm truncate flex-1">{title}</span>
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white",
            color
          )}
        >
          {count}
        </span>
      </div>

      {/* Cards Area */}
      <ScrollArea className="flex-1 p-2">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
            {EmptyIcon && <EmptyIcon className="h-8 w-8 mb-2" />}
            <span className="text-xs">{emptyText}</span>
          </div>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </ScrollArea>
    </div>
  );
}
