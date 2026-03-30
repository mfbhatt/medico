import { useCallback } from "react";
import { useAppDispatch } from "./useRedux";
import { addToast, removeToast } from "../store/slices/uiSlice";

type ToastType = "success" | "error" | "warning" | "info";

export const useNotification = () => {
  const dispatch = useAppDispatch();

  const showNotification = useCallback(
    (message: string, type: ToastType = "info", duration: number = 3000) => {
      const id = `toast-${Date.now()}-${Math.random()}`;

      dispatch(
        addToast({
          id,
          message,
          type,
          duration,
        })
      );

      if (duration > 0) {
        setTimeout(() => {
          dispatch(removeToast(id));
        }, duration);
      }

      return id;
    },
    [dispatch]
  );

  const success = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, "success", duration);
    },
    [showNotification]
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, "error", duration || 5000);
    },
    [showNotification]
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, "warning", duration);
    },
    [showNotification]
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, "info", duration);
    },
    [showNotification]
  );

  const dismiss = useCallback(
    (id: string) => {
      dispatch(removeToast(id));
    },
    [dispatch]
  );

  return {
    showNotification,
    success,
    error,
    warning,
    info,
    dismiss,
  };
};
