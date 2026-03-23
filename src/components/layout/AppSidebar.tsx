import { 
  LayoutDashboard, 
  Calendar, 
  Wrench, 
  Users, 
  Car, 
  FileText, 
  DollarSign, 
  Settings,
  Clock,
  ChevronLeft,
  Menu,
  X
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
  roles?: Array<'ADMIN' | 'MANAGER' | 'MECHANIC' | 'PATIO'>;
}

function SidebarContent({ 
  isCollapsed, 
  onNavigate 
}: { 
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const { userRole, profile } = useAuth();
  
  const { data: workOrders } = useWorkOrders({
    workflow_step: ['AGUARDANDO_ORCAMENTO', 'EM_QUALIDADE', 'AGUARDANDO_APROVACAO']
  });

  const pendingCount = workOrders?.length ?? 0;

  const mainNavItems: NavItem[] = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/", roles: ['ADMIN', 'MANAGER'] },
    { title: "Agenda", icon: Calendar, href: "/agenda" },
    { title: "Oficina", icon: Wrench, href: "/oficina", badge: pendingCount > 0 ? pendingCount : undefined },
    { title: "Clientes", icon: Users, href: "/clientes", roles: ['ADMIN', 'MANAGER'] },
    { title: "Veículos", icon: Car, href: "/veiculos", roles: ['ADMIN', 'MANAGER'] },
    { title: "Ordens de Serviço", icon: FileText, href: "/ordens", roles: ['ADMIN', 'MANAGER', 'MECHANIC'] },
  ];

  const secondaryNavItems: NavItem[] = [
    { title: "Ponto Digital", icon: Clock, href: "/ponto" },
    { title: "Financeiro", icon: DollarSign, href: "/financeiro", roles: ['ADMIN', 'MANAGER'] },
    { title: "Configurações", icon: Settings, href: "/configuracoes", roles: ['ADMIN'] },
  ];

  const filterByRole = (items: NavItem[]) => {
    if (!userRole) return items;
    return items.filter(item => {
      if (!item.roles) return true;
      return item.roles.includes(userRole.role);
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo/Header */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <Wrench className="h-4 w-4 text-accent-foreground" />
        </div>
        {!isCollapsed && (
          <div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground">
              Garage Box
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
              Pro
            </p>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Principal
            </p>
          )}
          {filterByRole(mainNavItems).map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isCollapsed && "justify-center px-2"
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="space-y-1 pt-6">
          {!isCollapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Sistema
            </p>
          )}
          {filterByRole(secondaryNavItems).map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isCollapsed && "justify-center px-2"
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer/User */}
      <div className="border-t border-sidebar-border p-3">
        <div className={cn(
          "flex items-center gap-3 rounded-lg p-2",
          isCollapsed && "justify-center"
        )}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
            {profile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {userRole?.role === 'ADMIN' ? 'Administrador' : 
                 userRole?.role === 'MANAGER' ? 'Gerente' : 
                 userRole?.role === 'PATIO' ? 'PC do Pátio' : 'Mecânico'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Desktop sidebar
function DesktopSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen bg-sidebar transition-all duration-300 ease-in-out lg:block",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="absolute right-0 top-4 z-50 translate-x-1/2">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 rounded-full border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md hover:bg-sidebar-accent"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <Menu className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>
      <SidebarContent isCollapsed={isCollapsed} />
    </aside>
  );
}

// Mobile sidebar (Sheet)
function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const location = useLocation();
  
  // Close sidebar when route changes
  useEffect(() => {
    onOpenChange(false);
  }, [location.pathname, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
        <SidebarContent isCollapsed={false} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return null; // Mobile sidebar is rendered in AppLayout
  }

  return <DesktopSidebar />;
}

export { MobileSidebar };
