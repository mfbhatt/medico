interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

export default function StatCard({ title, value, change, icon, trend }: StatCardProps) {
  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-600",
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <p className="text-gray-600 font-semibold text-sm">{title}</p>
        {icon && <div className="text-indigo-600">{icon}</div>}
      </div>

      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>

      {change && <p className={`text-sm font-semibold ${trendColors[trend || "neutral"]}`}>{change}</p>}
    </div>
  );
}
