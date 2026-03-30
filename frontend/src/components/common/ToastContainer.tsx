import React from "react";
import { useAppSelector } from "../../hooks";
import { Alert } from "./Alert";

export const ToastContainer: React.FC = () => {
  const toasts = useAppSelector((state) => state.ui.toasts);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <div key={toast.id} className="animate-slideIn">
          <Alert
            type={toast.type}
            message={toast.message}
            onClose={() => {
              // Toast will auto-dismiss based on duration
            }}
          />
        </div>
      ))}
    </div>
  );
};
