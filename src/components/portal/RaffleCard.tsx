'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Trophy, ImageOff, Copy } from 'lucide-react';
import { Raffle } from '@/lib/supabase';
import { getTimeRemaining } from '@/lib/dateUtils';
import { formatTokenDisplay } from '@/lib/token-utils';

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

interface RaffleCardProps {
  raffle: Raffle;
  isDarkMode: boolean;
  onJoinClick: () => void;
}

export function RaffleCard({ raffle, isDarkMode, onJoinClick }: RaffleCardProps) {
  const [imageError, setImageError] = useState(false);
  const timeRemaining = useLiveCountdown(raffle.end_date);
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  
  const isRaffleEnded = raffle.status === 'COMPLETED' || raffle.status === 'CANCELLED';
  const isRaffleActive = raffle.status === 'ACTIVE';
  
  return (
    <div className={`group rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
        : 'bg-white border-gray-100 hover:border-gray-200'
    }`}>
      {/* Image Section */}
      <div className="relative overflow-hidden">
        {/* Points Badge - Reduced opacity */}
        <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-600/70 to-purple-700/70 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium shadow-md z-10">
          {raffle.points_per_ticket} pts
        </div>
        <div className="relative overflow-hidden rounded-t-2xl">
          {imageError || !raffle.image_url ? (
            <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <ImageOff className="w-10 h-10 text-gray-400" />
            </div>
          ) : raffle.image_url.startsWith('blob:') ? (
            <>
              <img 
                src={raffle.image_url} 
                alt={raffle.title}
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          ) : (
            <>
              <Image
                src={raffle.image_url} 
                alt={raffle.title}
                width={400}
                height={192}
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          )}
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Title and Description */}
        <div className="space-y-1">
          <h3 className={`text-base font-semibold group-hover:text-purple-700 transition-colors duration-300 line-clamp-1 ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>{raffle.title}</h3>
          
          {/* Prize Display - Prominent for Token Raffles */}
          {raffle.prize_token_type === 'ERC20' && raffle.prize_amount && (
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-4 h-4 text-green-500" />
              <span className="text-sm font-bold text-green-600">
                Win {raffle.prize_amount} Tokens! 🎉
              </span>
            </div>
          )}
          
          {/* Prize Display - For NFT Raffles */}
          {raffle.prize_token_type === 'NFT' && raffle.prize_token_id && (
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-bold text-purple-600">
                Win NFT #{raffle.prize_token_id}! 🎉
              </span>
            </div>
          )}
          
          <p className={`text-xs leading-relaxed line-clamp-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>{raffle.description}</p>
        </div>
        
        {/* Bottom Row: Status/Winner + Join Button */}
        <div className="flex items-center justify-between pt-1">
          <div className={`flex-1 mr-2 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {/* Status indicator */}
            <div className="flex items-center space-x-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isRaffleEnded ? 'bg-red-400' : isRaffleActive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
              <span className="text-xs font-medium">
                {raffle.status === 'COMPLETED' ? 'Completed' : 
                 raffle.status === 'CANCELLED' ? 'Cancelled' :
                 raffle.status === 'ACTIVE' ? timeRemaining :
                 'Not Active'}
              </span>
            </div>
            
            {/* Winner information for completed raffles */}
            {raffle.status === 'COMPLETED' && raffle.winner && (
              <div className="flex items-center space-x-1">
                <Trophy className="w-3 h-3 text-yellow-500" />
                <span className="text-xs font-medium text-yellow-600">
                  Winner: {raffle.winner.slice(0, 6)}...{raffle.winner.slice(-4)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (raffle.winner) {
                      copyToClipboard(raffle.winner);
                    }
                  }}
                  className="ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  title="Copy winner address"
                >
                  <Copy className="w-3 h-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                </button>
              </div>
            )}
            {raffle.status === 'COMPLETED' && !raffle.winner && (
              <div className="flex items-center space-x-1">
                <div className={`w-3 h-3 rounded-full ${isDarkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
                <span className="text-xs font-medium">
                  No participants
                </span>
              </div>
            )}
          </div>
          
          <button 
            className={`px-4 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 hover:shadow-md active:scale-95 ${
              isRaffleEnded
                ? 'bg-gray-500 hover:bg-gray-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            disabled={!isRaffleActive && !isRaffleEnded}
            onClick={onJoinClick}
          >
            {raffle.status === 'COMPLETED' || raffle.status === 'CANCELLED' ? 'View' :
             raffle.status === 'ACTIVE' ? 'Join' :
             'Not Active'}
          </button>
        </div>
      </div>
    </div>
  );
}