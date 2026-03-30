import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertProps {
  type: AlertType;
  title?: string;
  message: string;
  onClose?: () => void;
}

export default function Alert({ type, title, message, onClose }: AlertProps) {
  const styles = {
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
      icon: "text-green-600",
      Icon: CheckCircle,
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      icon: "text-red-600",
      Icon: AlertCircle,
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-800",
      icon: "text-yellow-600",
      Icon: AlertTriangle,
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      icon: "text-blue-600",
      Icon: Info,
    },
  };

  const style = styles[type];
  const Icon = style.Icon;

  return (
    <div className={`${style.bg} border ${style.border} ${style.text} px-4 py-4 rounded-lg flex items-start gap-3`}>
      <Icon className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <p className="text-sm mt-1">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className={`${style.text} hover:opacity-70 transition flex-shrink-0`}>
          ✕
        </button>
      )}
    </div>
  );
}
