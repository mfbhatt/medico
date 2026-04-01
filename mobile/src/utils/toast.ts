export type ToastType = 'error' | 'success' | 'info' | 'warning';

interface ToastHandler {
  show: (message: string, type: ToastType, duration: number) => void;
}

let _handler: ToastHandler | null = null;

export const toastRef = {
  register: (handler: ToastHandler) => { _handler = handler; },
  unregister: () => { _handler = null; },
};

export const toast = {
  show:    (message: string, type: ToastType = 'info', duration = 3000) => _handler?.show(message, type, duration),
  error:   (message: string) => _handler?.show(message, 'error', 4500),
  success: (message: string) => _handler?.show(message, 'success', 3000),
  warning: (message: string) => _handler?.show(message, 'warning', 3500),
  info:    (message: string) => _handler?.show(message, 'info', 3000),
};
