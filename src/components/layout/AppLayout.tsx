import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  fullWidth?: boolean;
}

export function AppLayout({ children, title, subtitle, fullWidth }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="pl-64 transition-all duration-300">
        <AppHeader title={title} subtitle={subtitle} />
        <main className={cn(
          "min-h-[calc(100vh-4rem)] p-6",
          !fullWidth && "max-w-7xl"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
