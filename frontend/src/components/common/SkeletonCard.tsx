interface SkeletonCardProps {
  count?: number;
  className?: string;
}

function CardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
          <div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1.5" />
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-20" />
          </div>
        </div>
        <div className="h-5 bg-gray-100 dark:bg-gray-600 rounded-full w-16" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-600 rounded w-12 mb-1" />
          <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
        <div>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-600 rounded w-16 mb-1" />
          <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-14" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg" />
        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg" />
        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg" />
        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg" />
        <div className="col-span-2 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

export default function SkeletonCards({ count = 6, className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' }: SkeletonCardProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
