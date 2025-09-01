'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Target, Users, Clock, ImageOff, Plus, Minus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Raffle } from '@/lib/supabase';

interface JoinRaffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  raffle: Raffle | null;
  isDarkMode?: boolean;
  onSuccess?: () => void;
}

interface UserEntry {
  ticket_count: number;
  points_spent: number;
  created_at: string;
}

export default function JoinRaffleModal({ isOpen, onClose, raffle, isDarkMode = false, onSuccess }: JoinRaffleModalProps) {
  const [imageError, setImageError] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userEntry, setUserEntry] = useState<UserEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen && raffle) {
      setTicketCount(1);
      setMessage(null);
      setImageError(false);
      // Only fetch detailed entry info if we need points_spent details
      if (raffle.user_ticket_count && raffle.user_ticket_count > 0) {
        fetchUserEntry();
      } else {
        setUserEntry(null);
      }
    }
  }, [isOpen, raffle]);

  const fetchUserEntry = async () => {
    if (!raffle) return;
    
    setLoadingEntry(true);
    try {
      const response = await fetch(`/api/raffle-entries/${raffle.id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setUserEntry(data.data);
      } else {
        setUserEntry(null);
      }
    } catch (error) {
      console.error('Error fetching user entry:', error);
      setUserEntry(null);
    } finally {
      setLoadingEntry(false);
    }
  };

  const handleJoinRaffle = async () => {
    if (!raffle || isLoading) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/raffle-entries/enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raffleId: raffle.id,
          ticketCount: ticketCount
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Successfully purchased ${ticketCount} ticket${ticketCount > 1 ? 's' : ''}!`
        });
        
        // Update raffle ticket count locally for immediate UI feedback
        if (raffle) {
          raffle.user_ticket_count = (raffle.user_ticket_count || 0) + ticketCount;
        }
        
        // Refresh detailed entry info if needed
        if (raffle.user_ticket_count && raffle.user_ticket_count > 0) {
          await fetchUserEntry();
        }
        
        // Call success callback if provided (this will refresh the main raffle list)
        if (onSuccess) {
          onSuccess();
        }
        
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setMessage({
          type: 'error',
          text: data.message || data.error || 'Failed to join raffle'
        });
      }
    } catch (error) {
      console.error('Error joining raffle:', error);
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !raffle) return null;

  // Calculate time remaining in the specified format
  const getTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    
    if (diffTime <= 0) return 'Ended';
    
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleTicketChange = (newCount: number) => {
    if (newCount < 1) return;
    if (newCount > raffle.max_tickets_per_user) return;
    if (userEntry && (userEntry.ticket_count + newCount) > raffle.max_tickets_per_user) return;
    setTicketCount(newCount);
  };

  const remainingTickets = raffle.user_ticket_count && raffle.user_ticket_count > 0
    ? raffle.max_tickets_per_user - raffle.user_ticket_count 
    : raffle.max_tickets_per_user;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      } border`}>
        {/* Modal Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-3 mb-2">
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {raffle.title}
                </h2>
                <div className="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                  {raffle.points_per_ticket} Points per ticket
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image Container */}
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl">
                {imageError || !raffle.image_url ? (
                  <div className="w-full h-96 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center rounded-xl">
                    <ImageOff className="w-16 h-16 text-gray-400" />
                  </div>
                ) : (
                  <img 
                    src={raffle.image_url} 
                    alt={raffle.title}
                    className="w-full h-96 object-cover rounded-xl"
                    onError={() => setImageError(true)}
                  />
                )}
              </div>
            </div>

            {/* Details Container */}
            <div className="space-y-6">
              {/* Description Section */}
              <div>
                <div className="flex items-center mb-3">
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Description
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {raffle.description || 'No description available.'}
                </p>
              </div>

              {/* Divider */}
              <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 gap-4">
                {/* Time Remaining */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Time Remaining
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    getTimeRemaining(raffle.end_date) === 'Ended' 
                      ? 'text-red-500' 
                      : 'text-purple-600'
                  }`}>
                    {getTimeRemaining(raffle.end_date)}
                  </span>
                </div>

                {/* Points per Ticket */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Points per Ticket
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {raffle.points_per_ticket} SHELL
                  </span>
                </div>

                {/* Max Tickets per User */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Max Tickets per User
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {raffle.max_tickets_per_user}
                  </span>
                </div>
              </div>

              {/* User's Existing Entries - Show from raffle data first, then fetch detailed info */}
              {(raffle.user_ticket_count && raffle.user_ticket_count > 0) && (
                <div className={`p-4 rounded-xl border ${
                  isDarkMode 
                    ? 'bg-blue-900/20 border-blue-800' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                      Your Entries
                    </span>
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-blue-200' : 'text-blue-700'}`}>
                    You have <span className="font-semibold">{raffle.user_ticket_count}</span> ticket{raffle.user_ticket_count > 1 ? 's' : ''} in this raffle
                    {userEntry && !loadingEntry && (
                      <>
                        <br />
                        <span className="text-xs opacity-75">
                          Points spent: {userEntry.points_spent} SHELL
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Message Display */}
              {message && (
                <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                  message.type === 'success'
                    ? isDarkMode 
                      ? 'bg-green-900/20 border-green-800 text-green-300' 
                      : 'bg-green-50 border-green-200 text-green-800'
                    : isDarkMode
                      ? 'bg-red-900/20 border-red-800 text-red-300'
                      : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs font-medium">{message.text}</span>
                </div>
              )}

              {/* Ticket Section */}
              <div className={`p-4 rounded-xl border ${
                isDarkMode 
                  ? 'bg-gray-700/50 border-gray-600' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="space-y-4">
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Required Points: {raffle.points_per_ticket * ticketCount} $SHELL
                  </div>
                  
                  {/* Ticket Controls - Only show if max tickets > 1 and raffle not ended */}
                  {raffle.max_tickets_per_user > 1 && getTimeRemaining(raffle.end_date) !== 'Ended' && remainingTickets > 0 && (
                    <div className="space-y-2">
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Select number of tickets ({remainingTickets} remaining):
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleTicketChange(ticketCount - 1)}
                          disabled={ticketCount <= 1 || isLoading}
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors duration-200 ${
                            ticketCount <= 1 || isLoading
                              ? isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed' 
                                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              : isDarkMode
                                ? 'bg-gray-600 border-gray-500 text-white hover:bg-gray-500'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          max={remainingTickets}
                          value={ticketCount}
                          onChange={(e) => handleTicketChange(parseInt(e.target.value) || 1)}
                          disabled={isLoading}
                          className={`w-16 h-10 text-center border rounded-lg font-medium text-sm ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-500 text-white focus:border-purple-400'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50`}
                        />
                        
                        <button
                          type="button"
                          onClick={() => handleTicketChange(ticketCount + 1)}
                          disabled={ticketCount >= remainingTickets || isLoading}
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors duration-200 ${
                            ticketCount >= remainingTickets || isLoading
                              ? isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed' 
                                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              : isDarkMode
                                ? 'bg-gray-600 border-gray-500 text-white hover:bg-gray-500'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {raffle.user_ticket_count && raffle.user_ticket_count > 0
                      ? `You can purchase up to ${remainingTickets} more ticket${remainingTickets > 1 ? 's' : ''} for this raffle.`
                      : `You can purchase up to ${raffle.max_tickets_per_user} ticket${raffle.max_tickets_per_user > 1 ? 's' : ''} for this raffle.`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                isDarkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
              } disabled:cursor-not-allowed`}
            >
              Close
            </button>
            <button
              onClick={handleJoinRaffle}
              disabled={
                getTimeRemaining(raffle.end_date) === 'Ended' || 
                isLoading || 
                remainingTickets <= 0 ||
                (raffle.user_ticket_count && raffle.user_ticket_count >= raffle.max_tickets_per_user)
              }
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center min-w-[140px] ${
                getTimeRemaining(raffle.end_date) === 'Ended' || 
                remainingTickets <= 0 || 
                (raffle.user_ticket_count && raffle.user_ticket_count >= raffle.max_tickets_per_user)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : isLoading
                    ? 'bg-purple-600 text-white cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md active:scale-95'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Joining...</span>
                </div>
              ) : (
                <span>
                  {getTimeRemaining(raffle.end_date) === 'Ended' 
                    ? 'Raffle Ended' 
                    : remainingTickets <= 0
                      ? 'Max Tickets Reached'
                      : `Join Raffle (${ticketCount} ticket${ticketCount > 1 ? 's' : ''})`
                  }
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}