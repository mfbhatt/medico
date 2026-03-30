interface BadgeProps {
  variant?: "primary" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
  size?: "sm" | "md";
}

export default function Badge({ variant = "primary", children, size = "md" }: BadgeProps) {
  const variantClasses = {
    primary: "bg-indigo-100 text-indigo-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return <span className={`inline-block rounded-full font-semibold ${variantClasses[variant]} ${sizeClasses[size]}`}>{children}</span>;
}
