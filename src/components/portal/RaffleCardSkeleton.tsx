'use client';

interface RaffleCardSkeletonProps {
  isDarkMode: boolean;
}

export function RaffleCardSkeleton({ isDarkMode }: RaffleCardSkeletonProps) {
  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-100'
    }`}>
      {/* Image Section Skeleton */}
      <div className="relative">
        {/* Points Badge Skeleton */}
        <div className="absolute top-3 right-3 z-10">
          <div className={`h-6 w-12 rounded-full animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
        
        {/* Image Skeleton */}
        <div className={`w-full h-48 animate-pulse ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
        }`} />
      </div>
      
      {/* Content Section Skeleton */}
      <div className="p-4 space-y-3">
        {/* Title Skeleton */}
        <div className="space-y-2">
          <div className={`h-4 w-3/4 rounded animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
          
          {/* Prize/Trophy line skeleton */}
          <div className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
            <div className={`h-3 w-24 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
          
          {/* Description Lines Skeleton */}
          <div className="space-y-1">
            <div className={`h-3 w-full rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
            <div className={`h-3 w-2/3 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
        </div>
        
        {/* Bottom Row Skeleton */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex-1 mr-2 space-y-1">
            {/* Status indicator skeleton */}
            <div className="flex items-center space-x-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`} />
              <div className={`h-3 w-16 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
          </div>
          
          {/* Button Skeleton */}
          <div className={`h-7 w-12 rounded-lg animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
      </div>
    </div>
  );
}

interface RaffleSkeletonGridProps {
  isDarkMode: boolean;
  count?: number;
}

export function RaffleSkeletonGrid({ isDarkMode, count = 6 }: RaffleSkeletonGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <RaffleCardSkeleton key={index} isDarkMode={isDarkMode} />
      ))}
    </div>
  );
}