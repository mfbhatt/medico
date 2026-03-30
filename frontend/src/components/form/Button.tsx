interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: React.ReactNode;
}

export default function Button({ variant = "primary", size = "md", isLoading = false, disabled, children, className = "", ...props }: ButtonProps) {
  const baseClasses = "font-semibold rounded-lg transition inline-flex items-center justify-center gap-2";

  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:bg-gray-100",
    danger: "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400",
    outline: "border border-gray-300 hover:bg-gray-50 text-gray-900 disabled:opacity-50",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button disabled={disabled || isLoading} className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {isLoading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}
