'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Raffle } from '@/lib/supabase';
import { getTimeRemaining } from '@/lib/dateUtils';

interface LandingRaffleCardProps {
  raffle: Raffle;
}

function useLiveCountdown(endDate: string) {
  const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemaining(endDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(endDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return timeRemaining;
}

function getEndingSoon(endDate: string): boolean {
  const now = Date.now();
  const end = new Date(endDate).getTime();
  const diffSec = (end - now) / 1000;
  return diffSec > 0 && diffSec < 3600;
}

export function LandingRaffleCard({ raffle }: LandingRaffleCardProps) {
  const [imageError, setImageError] = useState(false);
  const timeRemaining = useLiveCountdown(raffle.end_date);
  const endingSoon = useMemo(() => getEndingSoon(raffle.end_date), [raffle.end_date]);
  const isEnded = timeRemaining === 'Ended';

  return (
    <Link href="/portal/raffles" className="group block">
      <div className="relative rounded-2xl border border-white/15 bg-[#0f0720]/80 overflow-hidden backdrop-blur-sm transition-all duration-300 hover:border-purple-500/40 hover:bg-white/[0.05] hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10">
        {/* Image area — 1:1 aspect ratio */}
        <div className="relative aspect-square overflow-hidden bg-[#0f0720]">
          {imageError || !raffle.image_url || raffle.image_url.startsWith('blob:') ? (
            <div className="w-full h-full flex items-center justify-center border-b border-white/10">
              <Trophy className="w-10 h-10 text-purple-500/40" />
            </div>
          ) : (
            <img
              src={raffle.image_url}
              alt={raffle.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}

          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0f0720]/80 to-transparent pointer-events-none" />

          {/* Status pill — top left */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${endingSoon ? 'bg-amber-400 animate-pulse' : isEnded ? 'bg-gray-500' : 'bg-green-400 animate-pulse'}`} />
            <span className={`text-xs font-semibold ${endingSoon ? 'text-amber-400' : isEnded ? 'text-gray-400' : 'text-green-400'}`}>
              {isEnded ? 'Ended' : endingSoon ? 'Ending soon' : 'Active'}
            </span>
          </div>

          {/* Points chip — top right */}
          <div className="absolute top-3 right-3 bg-purple-600/80 backdrop-blur-md rounded-full px-3 py-1.5">
            <span className="text-xs font-bold text-white">{raffle.points_per_ticket} pts</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white truncate mb-2 group-hover:text-purple-300 transition-colors">
            {raffle.title}
          </h3>

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {isEnded ? 'Ended' : 'Ends in'}
            </span>
            <span className={`font-mono tabular-nums ${endingSoon ? 'text-amber-400' : isEnded ? 'text-gray-500' : 'text-purple-300'}`}>
              {timeRemaining}
            </span>
          </div>

          {/* Ticket info row */}
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-white/8">
            <span className="text-gray-500">Tickets</span>
            <span className="text-white font-medium tabular-nums">
              {raffle.max_participants ? `${raffle.current_participants ?? 0} / ${raffle.max_participants}` : `${raffle.current_participants ?? 0} entered`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
