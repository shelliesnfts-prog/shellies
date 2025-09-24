'use client';

interface LeaderboardPageSkeletonProps {
  isDarkMode: boolean;
  count?: number;
}

export function LeaderboardPageSkeleton({ isDarkMode, count = 10 }: LeaderboardPageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className={`w-10 h-10 rounded-xl animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
            <div className={`h-6 sm:h-8 w-40 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
          <div className={`h-4 w-64 rounded animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
        <div className="flex items-center space-x-2">
          <div className={`h-10 w-28 rounded-xl animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
      </div>

      {/* Leaderboard Container Skeleton */}
      <div className={`rounded-2xl shadow-xl border-2 overflow-hidden ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="p-4 sm:p-6">
              <div className="flex items-center space-x-4">
                {/* Rank Badge Skeleton */}
                <div className={`flex items-center justify-center min-w-[2.5rem] h-10 rounded-xl animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`} />
                
                {/* User Info Skeleton */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl animate-pulse ${
                      isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                    }`} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className={`h-4 w-48 rounded animate-pulse ${
                        isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`} />
                      <div className={`h-3 w-24 rounded animate-pulse ${
                        isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`} />
                    </div>
                  </div>
                </div>
                
                {/* Stats Skeleton */}
                <div className="flex items-center">
                  <div className="text-center space-y-1">
                    <div className={`h-6 w-12 rounded animate-pulse ${
                      isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                    }`} />
                    <div className={`h-3 w-8 rounded animate-pulse ${
                      isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                    }`} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}