import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./useRedux";
import { setUser, setToken, logout, setLoading, setError } from "../store/slices/authSlice";
import { authService } from "../services/authService";
import { STORAGE_KEYS } from "../utils/constants";

interface LoginCredentials {
  email: string;
  password: string;
}

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, token, loading, error } = useAppSelector((state) => state.auth);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      dispatch(setLoading(true));
      dispatch(setError(null));
      try {
        const response = await authService.login(credentials);
        dispatch(setUser(response.user));
        dispatch(setToken(response.token));
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        dispatch(setError(message));
        throw err;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const logoutUser = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      await authService.logout();
      dispatch(logout());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Logout failed";
      dispatch(setError(message));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      dispatch(setLoading(true));
      dispatch(setError(null));
      try {
        await authService.requestPasswordReset(email);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        dispatch(setError(message));
        throw err;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const resetPassword = useCallback(
    async (token_: string, newPassword: string) => {
      dispatch(setLoading(true));
      dispatch(setError(null));
      try {
        await authService.resetPassword({
          token: token_,
          newPassword,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reset failed";
        dispatch(setError(message));
        throw err;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const isAuthenticated = useCallback(() => {
    return !!token && !!user;
  }, [token, user]);

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!user) return false;
      if (typeof role === "string") {
        return user.role === role;
      }
      return role.includes(user.role);
    },
    [user]
  );

  return {
    user,
    token,
    loading,
    error,
    login,
    logoutUser,
    requestPasswordReset,
    resetPassword,
    isAuthenticated,
    hasRole,
  };
};
