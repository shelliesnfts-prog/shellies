'use client';

interface StakingPageSkeletonProps {
  isDarkMode: boolean;
}

export function StakingPageSkeleton({ isDarkMode }: StakingPageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className={`h-6 sm:h-8 w-48 rounded animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
          <div className={`h-4 w-72 rounded animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
        <div className={`h-10 w-32 rounded-xl animate-pulse ${
          isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
        }`} />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3].map((index) => (
          <div key={index} className={`rounded-2xl border p-5 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-6 w-16 rounded-full animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
            <div className="space-y-1">
              <div className={`h-3 w-20 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-8 w-12 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-16 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
          </div>
        ))}
      </div>

      {/* View Mode Toggle & Actions Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className={`h-12 w-64 rounded-xl animate-pulse ${
          isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
        }`} />
        <div className="flex gap-3">
          <div className={`h-10 w-24 rounded-xl animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
          <div className={`h-10 w-32 rounded-xl animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
      </div>

      {/* NFT Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className={`relative rounded-2xl border-2 p-4 ${
            isDarkMode ? 'border-gray-600 bg-gray-800/50' : 'border-gray-200 bg-white'
          }`}>
            {/* Selection Indicator Skeleton */}
            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />

            {/* NFT Image Skeleton */}
            <div className={`w-full aspect-square rounded-lg mb-3 animate-pulse ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`} />

            {/* Token Info Skeleton */}
            <div className="text-center space-y-1">
              <div className={`h-4 w-3/4 mx-auto rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-1/2 mx-auto rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}