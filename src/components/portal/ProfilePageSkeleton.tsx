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

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* NFT Holdings Card Skeleton */}
        <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
        }`}>
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-5 h-5" />
              </div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-6 h-3" />
              </div>
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
        </div>

        {/* Day Lock Card Skeleton */}
        <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-yellow-50/30 border-yellow-200/60'
        }`}>
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-5 h-5" />
              </div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-8 h-3" />
              </div>
            </div>
            <div className="space-y-1">
              <div className={`h-3 w-16 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-8 w-14 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-20 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
          </div>
        </div>

        {/* Week Lock Card Skeleton */}
        <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-blue-50/30 border-blue-200/60'
        }`}>
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-5 h-5" />
              </div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-10 h-3" />
              </div>
            </div>
            <div className="space-y-1">
              <div className={`h-3 w-18 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-8 w-14 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-22 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
          </div>
        </div>

        {/* Month Lock Card Skeleton */}
        <div className={`h-fit group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-green-50/30 border-green-200/60'
        }`}>
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-5 h-5" />
              </div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-12 h-3" />
              </div>
            </div>
            <div className="space-y-1">
              <div className={`h-3 w-20 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-8 w-14 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-3 w-24 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
          </div>
        </div>

        {/* Unified Daily Claim Card Skeleton */}
        <div className="sm:col-span-2 col-span-1">
          <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
            isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
          }`}>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-transparent" />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className={`h-5 w-28 rounded animate-pulse mb-1 ${
                    isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`} />
                  <div className={`h-3 w-48 rounded animate-pulse ${
                    isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`} />
                </div>
                <div className={`p-2.5 rounded-xl animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`}>
                  <div className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`h-3 w-32 rounded animate-pulse ${
                      isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                    }`} />
                    <div className="flex items-center space-x-1">
                      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`} />
                      <div className={`h-3 w-20 rounded animate-pulse ${
                        isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`} />
                    </div>
                  </div>
                  <div className={`h-3 w-64 rounded animate-pulse ${
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

        {/* XP Bridge Card Skeleton */}
        <div className="sm:col-span-2 col-span-1 h-full">
          <div className={`h-full group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
            isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
          }`}>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-transparent" />
            <div className="relative p-6 h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className={`h-5 w-28 rounded animate-pulse mb-1 ${
                    isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`} />
                  <div className={`h-3 w-48 rounded animate-pulse ${
                    isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`} />
                </div>
                <div className={`p-2.5 rounded-xl animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`}>
                  <div className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`h-3 w-48 rounded animate-pulse ${
                      isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                    }`} />
                    <div className="flex items-center space-x-1">
                      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`} />
                      <div className={`h-3 w-24 rounded animate-pulse ${
                        isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`} />
                    </div>
                  </div>
                  <div className={`h-3 w-40 rounded animate-pulse ${
                    isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`} />
                </div>
                <div className={`h-12 w-full rounded-xl animate-pulse ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Actions Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Staking Page Link Skeleton */}
        <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          isDarkMode ? 'bg-gradient-to-br from-blue-900/40 to-blue-800/40 border-blue-700/50' : 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200'
        }`}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-6 h-6" />
              </div>
              <div className={`w-5 h-5 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
            <div className="space-y-2">
              <div className={`h-6 w-32 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-4 w-full rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-4 w-3/4 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full mt-3 animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-3 h-3" />
                <div className="w-20 h-3" />
              </div>
            </div>
          </div>
        </div>

        {/* NFT Explorer Link Skeleton */}
        <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          isDarkMode ? 'bg-gradient-to-br from-purple-900/40 to-pink-800/40 border-purple-700/50' : 'bg-gradient-to-br from-purple-50 to-pink-100/50 border-purple-200'
        }`}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-6 h-6" />
              </div>
              <div className={`w-5 h-5 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
            </div>
            <div className="space-y-2">
              <div className={`h-6 w-36 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-4 w-full rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`h-4 w-4/5 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`} />
              <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full mt-3 animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}>
                <div className="w-3 h-3" />
                <div className="w-24 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}