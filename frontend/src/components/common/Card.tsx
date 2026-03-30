interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Card({ title, subtitle, children, footer }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {(title || subtitle) && (
        <div className="border-b border-gray-200 px-6 py-4">
          {title && <h3 className="text-lg font-bold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
      )}

      <div className="p-6">{children}</div>

      {footer && <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">{footer}</div>}
    </div>
  );
}
