'use client';

interface ProfilePageSkeletonProps {
  isDarkMode: boolean;
}

export function ProfilePageSkeleton({ isDarkMode }: ProfilePageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header Section Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className={`h-6 sm:h-8 w-48 rounded animate-pulse mb-2 ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
          <div className={`h-4 w-64 rounded animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
        <div className={`h-8 w-32 rounded-full animate-pulse ${
          isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
        }`} />
      </div>

      {/* Tier Progression Motivation Section Skeleton */}
      <div className={`rounded-2xl border p-6 ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <div className={`w-5 h-5 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-5 w-48 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
            <div className={`h-4 w-64 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
          <div className={`w-12 h-12 rounded-xl animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`} />
        </div>
        
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border-2 border-dashed ${
            isDarkMode ? 'border-gray-600 bg-gray-700/20' : 'border-gray-300 bg-gray-50/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className={`h-4 w-32 rounded animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`} />
                <div className={`h-3 w-40 rounded animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`} />
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-4 rounded animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`} />
                <div className={`h-6 w-8 rounded animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className={`h-4 w-48 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-56 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
            <div className={`h-10 w-28 rounded-xl animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* NFT Holdings Card Skeleton */}
        <div className={`rounded-2xl border p-5 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
            <div className={`h-5 w-8 rounded-full animate-pulse ${
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

        {/* Available Points Card Skeleton */}
        <div className={`rounded-2xl border p-5 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
            <div className={`h-5 w-12 rounded-full animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
          <div className="space-y-1">
            <div className={`h-3 w-24 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
            <div className={`h-8 w-16 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
            <div className={`h-3 w-20 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
        </div>

        {/* Daily Claim Card Skeleton */}
        <div className={`sm:col-span-2 lg:col-span-2 rounded-2xl border p-6 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <div className={`h-5 w-28 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-48 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
            <div className={`w-10 h-10 rounded-xl animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className={`h-3 w-32 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-24 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
            <div className={`h-10 w-full rounded-lg animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`} />
          </div>
        </div>
      </div>
    </div>
  );
}