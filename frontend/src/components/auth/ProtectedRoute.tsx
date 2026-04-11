import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../../hooks";
import LoadingSpinner from "../common/LoadingSpinner";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ allowedRoles, redirectTo = "/403" }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, token, loading, refreshPending } = useAppSelector((s) => s.auth);

  // Show spinner while initial silent token refresh is in progress so the user
  // isn't redirected to login just because their access token expired while idle.
  if (loading || refreshPending) {
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
