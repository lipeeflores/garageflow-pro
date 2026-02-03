import { ReactNode, useState } from "react";
import { AppSidebar, MobileSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  fullWidth?: boolean;
}

export function AppLayout({ children, title, subtitle, fullWidth }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <AppSidebar />
      
      {/* Mobile Sidebar (Sheet) */}
      {isMobile && (
        <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      )}
      
      {/* Main Content Area */}
      <div className={cn(
        "transition-all duration-300",
        !isMobile && "lg:pl-64" // Only add padding on desktop
      )}>
        <AppHeader 
          title={title} 
          subtitle={subtitle} 
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className={cn(
          "min-h-[calc(100vh-4rem)] p-4 md:p-6",
          !fullWidth && "max-w-7xl"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
