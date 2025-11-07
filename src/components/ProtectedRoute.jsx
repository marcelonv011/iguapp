// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function ProtectedRoute({ children }) {
  const { user, loadingUser } = useAuthUser();
  const location = useLocation();

  if (loadingUser) {
    return <div className="min-h-[60vh] grid place-items-center text-muted-foreground">Cargando…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
