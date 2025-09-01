'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Target, Users, Clock, ImageOff, Plus, Minus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Raffle } from '@/lib/supabase';
import { getTimeRemaining } from '@/lib/dateUtils';

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

interface UserData {
  id: string;
  wallet_address: string;
  points: number;
  nft_count: number;
  created_at: string;
  updated_at: string;
}

export default function JoinRaffleModal({ isOpen, onClose, raffle, isDarkMode = false, onSuccess }: JoinRaffleModalProps) {
  const [imageError, setImageError] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userEntry, setUserEntry] = useState<UserEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen && raffle) {
      setTicketCount(1);
      setMessage(null);
      setImageError(false);
      fetchUserData();
      // Only fetch detailed entry info if we need points_spent details
      if (raffle.user_ticket_count && raffle.user_ticket_count > 0) {
        fetchUserEntry();
      } else {
        setUserEntry(null);
      }
    }
  }, [isOpen, raffle]);

  const fetchUserData = async () => {
    setLoadingUser(true);
    try {
      const response = await fetch('/api/user');
      const data = await response.json();
      
      if (data && !data.error) {
        setUserData(data);
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
    } finally {
      setLoadingUser(false);
    }
  };

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

  // Client-side validation function
  const validateRaffleEntry = (): { isValid: boolean; error?: string } => {
    if (!raffle || !userData) {
      return { isValid: false, error: 'Loading raffle data...' };
    }

    // Check if raffle has ended
    const now = new Date();
    const endDate = new Date(raffle.end_date);
    if (endDate <= now) {
      const timeAgo = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60));
      return { 
        isValid: false, 
        error: `This raffle ended ${timeAgo} hour${timeAgo > 1 ? 's' : ''} ago` 
      };
    }

    // Validate ticket count
    if (!Number.isInteger(ticketCount) || ticketCount <= 0) {
      return { isValid: false, error: 'Ticket count must be a positive integer' };
    }

    // Calculate costs and limits
    const totalCost = raffle.points_per_ticket * ticketCount;
    const currentTickets = raffle.user_ticket_count || 0;
    const newTotalTickets = currentTickets + ticketCount;
    const remainingTickets = raffle.max_tickets_per_user - currentTickets;

    // Check if user has enough points
    if (userData.points < totalCost) {
      const shortage = totalCost - userData.points;
      return { 
        isValid: false, 
        error: `Insufficient points. You need ${totalCost} SHELL but have ${userData.points} SHELL (${shortage} short)` 
      };
    }

    // Check remaining tickets
    if (remainingTickets <= 0) {
      return { 
        isValid: false, 
        error: 'You have already reached the maximum number of tickets for this raffle' 
      };
    }

    // Check if trying to buy too many tickets
    if (ticketCount > remainingTickets) {
      return { 
        isValid: false, 
        error: `You can only purchase ${remainingTickets} more ticket${remainingTickets > 1 ? 's' : ''} for this raffle` 
      };
    }

    // Check max tickets per user
    if (newTotalTickets > raffle.max_tickets_per_user) {
      return { 
        isValid: false, 
        error: `Maximum ${raffle.max_tickets_per_user} tickets allowed per user. You currently have ${currentTickets} tickets.` 
      };
    }

    return { isValid: true };
  };

  const handleJoinRaffle = async () => {
    if (!raffle || isLoading) return;

    // Client-side validation
    const validation = validateRaffleEntry();
    if (!validation.isValid) {
      setMessage({
        type: 'error',
        text: validation.error!
      });
      return;
    }

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
        
        // Update user points locally
        if (userData) {
          userData.points -= raffle.points_per_ticket * ticketCount;
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


  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleTicketChange = (newCount: number) => {
    if (!raffle) return;
    if (newCount < 1) return;
    
    const currentTickets = raffle.user_ticket_count || 0;
    const remainingTickets = raffle.max_tickets_per_user - currentTickets;
    
    if (newCount > remainingTickets) return;
    if (newCount > raffle.max_tickets_per_user) return;
    
    // Clear any existing validation error when user changes tickets
    if (message?.type === 'error') {
      setMessage(null);
    }
    
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

                {/* Participants */}
                {raffle.max_participants && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Participants
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {raffle.current_participants || 0} / {raffle.max_participants}
                    </span>
                  </div>
                )}
              </div>

              {/* User's Existing Entries - Show from raffle data first, then fetch detailed info */}
              {raffle.user_ticket_count > 0 && (
                <div className={`p-4 rounded-xl border ${
                  isDarkMode 
                    ? 'bg-purple-900/20 border-purple-800' 
                    : 'bg-purple-50 border-purple-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-800'}`}>
                      Your Entries
                    </span>
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-purple-200' : 'text-purple-700'}`}>
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
                  
                  {/* User Points Balance */}
                  {userData && (
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Your balance: {userData.points} $SHELL
                    </div>
                  )}
                  
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
                          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                            ticketCount <= 1 || isLoading
                              ? isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed' 
                                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              : isDarkMode
                                ? 'bg-gray-600 border-gray-500 text-white hover:bg-gray-500'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          max={remainingTickets}
                          value={ticketCount}
                          onChange={(e) => handleTicketChange(parseInt(e.target.value) || 1)}
                          disabled={isLoading}
                          className={`w-14 h-8 text-center border rounded-full font-medium text-sm ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-500 text-white focus:border-purple-400'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50`}
                        />
                        
                        <button
                          type="button"
                          onClick={() => handleTicketChange(ticketCount + 1)}
                          disabled={ticketCount >= remainingTickets || isLoading}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                            ticketCount >= remainingTickets || isLoading
                              ? isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed' 
                                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              : isDarkMode
                                ? 'bg-gray-600 border-gray-500 text-white hover:bg-gray-500'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
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