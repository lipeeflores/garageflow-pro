import { 
  LayoutDashboard, 
  Calendar, 
  Wrench, 
  Users, 
  Car, 
  FileText, 
  BarChart3, 
  Settings,
  Clock,
  Bell,
  LogOut,
  ChevronLeft,
  Menu
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Agenda", icon: Calendar, href: "/agenda" },
  { title: "Oficina", icon: Wrench, href: "/oficina", badge: 3 },
  { title: "Clientes", icon: Users, href: "/clientes" },
  { title: "Veículos", icon: Car, href: "/veiculos" },
  { title: "Ordens de Serviço", icon: FileText, href: "/ordens" },
];

const secondaryNavItems: NavItem[] = [
  { title: "Ponto Digital", icon: Clock, href: "/ponto" },
  { title: "Relatórios", icon: BarChart3, href: "/relatorios" },
  { title: "Configurações", icon: Settings, href: "/configuracoes" },
];

export function AppSidebar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo/Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                <Wrench className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-sidebar-foreground">
                  Garage Box
                </h1>
                <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
                  Pro
                </p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Principal
              </p>
            )}
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
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
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
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
              MD
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  MD Mecânica
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  Itapema - SC
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
