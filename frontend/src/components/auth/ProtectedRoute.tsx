import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../../hooks";
import LoadingSpinner from "../common/LoadingSpinner";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ allowedRoles, redirectTo = "/403" }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, token, loading } = useAppSelector((s) => s.auth);

  if (loading) {
    return <LoadingSpinner fullscreen />;
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
