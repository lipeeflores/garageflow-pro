import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: Array<'ADMIN' | 'MANAGER' | 'MECHANIC' | 'PATIO'>;
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requiredRoles && userRole && !requiredRoles.includes(userRole.role)) {
    // Redirect mechanics to their default page (/ponto) instead of home
    if (userRole.role === 'MECHANIC' || userRole.role === 'PATIO') {
      return <Navigate to="/ponto" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
