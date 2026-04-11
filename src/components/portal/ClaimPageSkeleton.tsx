'use client';

interface ClaimPageSkeletonProps {
  isDarkMode: boolean;
}

function pulse(isDarkMode: boolean) {
  return isDarkMode ? 'bg-gray-700 animate-pulse' : 'bg-gray-200 animate-pulse';
}

function TierCardSkeleton({ isDarkMode }: { isDarkMode: boolean }) {
  const p = pulse(isDarkMode);
  const cardBg = isDarkMode ? 'bg-gray-700/40 border-gray-600/40' : 'bg-gray-50 border-gray-200';
  return (
    <div className={`flex flex-col rounded-xl border p-3.5 gap-2 ${cardBg}`}>
      {/* tier label row */}
      <div className="flex items-center justify-between">
        <div className={`h-2.5 w-12 rounded ${p}`} />
        <div className={`h-4 w-7 rounded ${p}`} />
      </div>
      {/* big number */}
      <div className={`h-7 w-10 rounded ${p}`} />
      {/* sub-label */}
      <div className={`h-2.5 w-14 rounded ${p}`} />
      {/* divider */}
      <div className={`border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`} />
      {/* two info rows */}
      <div className="flex items-center justify-between">
        <div className={`h-2.5 w-8 rounded ${p}`} />
        <div className={`h-2.5 w-16 rounded ${p}`} />
      </div>
      <div className="flex items-center justify-between">
        <div className={`h-2.5 w-10 rounded ${p}`} />
        <div className={`h-2.5 w-12 rounded ${p}`} />
      </div>
    </div>
  );
}

function PanelSkeleton({ isDarkMode }: { isDarkMode: boolean }) {
  const p = pulse(isDarkMode);
  const panelBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  return (
    <div className={`rounded-2xl border ${panelBg}`}>
      <div className="p-5 flex flex-col gap-4">
        {/* Panel header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl ${p}`} />
            <div className="flex flex-col gap-1.5">
              <div className={`h-3.5 w-28 rounded ${p}`} />
              <div className={`h-3 w-36 rounded ${p}`} />
            </div>
          </div>
          <div className={`h-6 w-16 rounded-full ${p}`} />
        </div>

        {/* 3 tier cards */}
        <div className="grid grid-cols-3 gap-3">
          <TierCardSkeleton isDarkMode={isDarkMode} />
          <TierCardSkeleton isDarkMode={isDarkMode} />
          <TierCardSkeleton isDarkMode={isDarkMode} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action button */}
        <div className={`h-11 w-full rounded-xl ${p}`} />
      </div>
    </div>
  );
}

export function ClaimPageSkeleton({ isDarkMode }: ClaimPageSkeletonProps) {
  const p = pulse(isDarkMode);
  const xpBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className={`h-7 w-24 rounded ${p}`} />
          <div className={`h-4 w-56 rounded ${p}`} />
        </div>
        <div className={`h-7 w-32 rounded-full ${p}`} />
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PanelSkeleton isDarkMode={isDarkMode} />
        <PanelSkeleton isDarkMode={isDarkMode} />
      </div>

      {/* XP Bridge placeholder */}
      <div className={`rounded-2xl border p-8 ${xpBg}`}>
        <div className="flex flex-col gap-3">
          <div className={`h-5 w-40 rounded ${p}`} />
          <div className={`h-4 w-64 rounded ${p}`} />
          <div className={`h-10 w-full rounded-xl mt-2 ${p}`} />
        </div>
      </div>
    </div>
  );
}
