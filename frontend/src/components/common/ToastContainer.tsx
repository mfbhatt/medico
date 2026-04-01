import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks";
import { removeToast } from "../../store/slices/uiSlice";
import Alert from "./Alert";

function AutoDismissToast({
  id: _id,
  type,
  message,
  duration,
  onDismiss,
}: {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="animate-slideIn pointer-events-auto">
      <Alert type={type} message={message} onClose={onDismiss} />
    </div>
  );
}

export const ToastContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((state) => state.ui.toasts);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <AutoDismissToast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration ?? 4000}
          onDismiss={() => dispatch(removeToast(toast.id))}
        />
      ))}
    </div>
  );
};
