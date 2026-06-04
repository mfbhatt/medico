interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export default function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  const widths = ['60%', '80%', '70%', '50%', '65%', '75%', '55%', '85%', '45%', '90%', '60%', '70%', '80%', '50%'];
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                style={{ width: widths[(i * columns + j) % widths.length] }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
