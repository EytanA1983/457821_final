import { memo } from 'react';

interface SkeletonLoaderProps {
  /** Number of skeleton items to show */
  count?: number;
  /** Height of each skeleton item */
  height?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show rounded corners */
  rounded?: boolean;
}

/**
 * SkeletonLoader - Skeleton loading animation for widgets
 * 
 * Usage:
 * <SkeletonLoader count={3} height="h-12" />
 */
export const SkeletonLoader = memo(({
  count = 3,
  height = 'h-4',
  className = '',
  rounded = true,
}: SkeletonLoaderProps) => {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`
            ${height}
            bg-gray-200 dark:bg-gray-700
            animate-pulse
            ${rounded ? 'rounded' : ''}
          `}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </div>
  );
});
SkeletonLoader.displayName = 'SkeletonLoader';

/**
 * TaskSkeleton - Skeleton for task items
 */
export const TaskSkeleton = memo(({ count = 3 }: { count?: number }) => (
  <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        style={{
          animationDelay: `${index * 100}ms`,
        }}
      >
        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    ))}
  </div>
));
TaskSkeleton.displayName = 'TaskSkeleton';

/**
 * RoomCardSkeleton - Skeleton for room cards
 */
export const RoomCardSkeleton = memo(({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" role="status" aria-live="polite" aria-busy="true">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 animate-pulse"
        style={{
          animationDelay: `${index * 100}ms`,
        }}
      >
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    ))}
  </div>
));
RoomCardSkeleton.displayName = 'RoomCardSkeleton';

/**
 * CalendarEventSkeleton - Skeleton for calendar events
 */
export const CalendarEventSkeleton = memo(({ count = 5 }: { count?: number }) => (
  <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="flex items-center gap-2 bg-white/10 dark:bg-white/5 rounded-lg px-2 py-1.5 animate-pulse"
        style={{
          animationDelay: `${index * 100}ms`,
        }}
      >
        <div className="w-4 h-4 bg-white/20 dark:bg-white/10 rounded" />
        <div className="flex-1 h-4 bg-white/20 dark:bg-white/10 rounded" />
        <div className="w-12 h-3 bg-white/20 dark:bg-white/10 rounded" />
      </div>
    ))}
  </div>
));
CalendarEventSkeleton.displayName = 'CalendarEventSkeleton';

export default SkeletonLoader;
