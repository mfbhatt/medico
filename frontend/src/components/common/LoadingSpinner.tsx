import { Loader } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullscreen?: boolean;
}

export default function LoadingSpinner({ size = "md", fullscreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader className={`${sizeClasses[size]} animate-spin text-indigo-600`} />
      <p className="text-gray-600 text-sm">Loading...</p>
    </div>
  );

  if (fullscreen) {
    return <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50">{spinner}</div>;
  }

  return spinner;
}
