'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { X, Calendar, Target, Users, Clock, ImageOff, Plus, Minus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Raffle } from '@/lib/supabase';
import { getTimeRemaining, isRaffleActive } from '@/lib/dateUtils';
import { RaffleContractService } from '@/lib/raffle-contract';
import { raffle_abi } from '@/lib/raffle-abi';
import { parseContractError } from '@/lib/errors';

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

interface Participant {
  wallet_address: string;
  ticket_count: number;
  points_spent: number;
  created_at: string;
  join_tx_hash?: string;
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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  
  // Wagmi hooks for contract interaction
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  // Contract configuration
  const contractAddress = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS;

  // Helper function to truncate wallet address
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen && raffle) {
      setTicketCount(1);
      setMessage(null);
      setImageError(false);
      fetchUserData();
      fetchParticipants();
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

  const fetchParticipants = async () => {
    if (!raffle) return;
    
    setLoadingParticipants(true);
    try {
      const response = await fetch(`/api/raffles/${raffle.id}/participants`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Sort participants with connected user first, then by join date
        const sortedParticipants = [...data.data].sort((a, b) => {
          if (a.wallet_address === address) return -1;
          if (b.wallet_address === address) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setParticipants(sortedParticipants);
      } else {
        setParticipants([]);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  };

  // Client-side validation function
  const validateRaffleEntry = (): { isValid: boolean; error?: string } => {
    if (!raffle || !userData) {
      return { isValid: false, error: 'Loading raffle data...' };
    }

    // Check if raffle has ended based on status
    if (raffle.status === 'COMPLETED' || raffle.status === 'CANCELLED') {
      return { 
        isValid: false, 
        error: `This raffle has ${raffle.status.toLowerCase()}` 
      };
    }

    // Check if raffle is active
    if (raffle.status !== 'ACTIVE') {
      return { 
        isValid: false, 
        error: 'This raffle is not currently accepting entries' 
      };
    }

    // Check if raffle has ended based on end_date
    if (!isRaffleActive(raffle.end_date)) {
      return {
        isValid: false,
        error: 'This raffle has ended'
      };
    }

    // Check if max participants reached
    if (raffle.max_participants && (raffle.current_participants || 0) >= raffle.max_participants) {
      return {
        isValid: false,
        error: 'This raffle has reached the maximum number of participants'
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
        error: `Insufficient points. You need ${totalCost} Point${totalCost !== 1 ? 's' : ''} but have ${userData.points} Point${userData.points !== 1 ? 's' : ''} (${shortage} short)` 
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
    if (!raffle || isLoading || !isConnected || !address) {
      setMessage({
        type: 'error',
        text: 'Please connect your wallet first'
      });
      return;
    }

    // Client-side validation
    const validation = validateRaffleEntry();
    if (!validation.isValid) {
      setMessage({
        type: 'error',
        text: validation.error!
      });
      return;
    }

    if (!contractAddress) {
      setMessage({
        type: 'error',
        text: 'Contract address not configured'
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Step 1: Sign the joinRaffle contract method first
      setMessage({
        type: 'success',
        text: 'Please sign the transaction in your wallet...'
      });

      // Get the blockchain raffle ID
      const raffleId = RaffleContractService.generateRaffleId(raffle.id);
      
      // Call the joinRaffle method on the smart contract
      const txHash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: raffle_abi,
        functionName: 'joinRaffle',
        args: [BigInt(raffleId), BigInt(ticketCount)],
      });

      console.log('Contract transaction signed:', txHash);
      
      setMessage({
        type: 'success',
        text: 'Transaction signed! Processing your entry...'
      });

      // Step 2: If contract interaction succeeds, proceed with API call
      const response = await fetch('/api/raffle-entries/enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raffleId: raffle.id,
          ticketCount: ticketCount,
          txHash: txHash // Include the transaction hash for verification
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
        
        // Refresh participants list
        await fetchParticipants();
        
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
      console.error('Error in handleJoinRaffle:', error);
      
      // Use the parseContractError function for user-friendly error messages
      const userFriendlyMessage = parseContractError(error);
      setMessage({
        type: 'error',
        text: userFriendlyMessage
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

  const remainingTickets = (raffle.user_ticket_count || 0) > 0
    ? raffle.max_tickets_per_user - (raffle.user_ticket_count || 0)
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
              
              {/* Participants List */}
              {participants.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Participants ({participants.length})
                    </h3>
                    {loadingParticipants && (
                      <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    )}
                  </div>
                  <div className={`max-h-48 overflow-y-auto rounded-lg border ${
                    isDarkMode ? 'border-gray-600 bg-gray-700/30' : 'border-gray-200 bg-gray-50'
                  } p-3 space-y-2`}>
                    {participants.map((participant, index) => (
                      <div
                        key={`${participant.wallet_address}-${index}`}
                        className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                          participant.wallet_address === address
                            ? isDarkMode 
                              ? 'bg-purple-900/40 border border-purple-700' 
                              : 'bg-purple-100 border border-purple-200'
                            : isDarkMode
                              ? 'bg-gray-700/50 hover:bg-gray-600/50'
                              : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-medium ${
                              participant.wallet_address === address
                                ? isDarkMode ? 'text-purple-300' : 'text-purple-700'
                                : isDarkMode ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              {truncateAddress(participant.wallet_address)}
                            </span>
                            {participant.wallet_address === address && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                isDarkMode 
                                  ? 'bg-purple-800 text-purple-200' 
                                  : 'bg-purple-200 text-purple-800'
                              }`}>
                                You
                              </span>
                            )}
                          </div>
                          <div className={`text-xs ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {participant.ticket_count} ticket{participant.ticket_count > 1 ? 's' : ''} • {participant.points_spent} points
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {participant.join_tx_hash ? (
                            <a
                              href={`https://explorer.inkonchain.com/tx/${participant.join_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs px-2 py-1 rounded-full transition-colors border ${
                                isDarkMode
                                  ? 'border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white'
                                  : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                              }`}
                            >
                              View Txn
                            </a>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              isDarkMode
                                ? 'bg-gray-600 text-gray-400'
                                : 'bg-gray-200 text-gray-500'
                            }`}>
                              No Txn
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                    raffle.status === 'COMPLETED' || raffle.status === 'CANCELLED'
                      ? 'text-red-500' 
                      : 'text-purple-600'
                  }`}>
                    {raffle.status === 'COMPLETED' ? 'Completed' : 
                     raffle.status === 'CANCELLED' ? 'Cancelled' :
                     raffle.status === 'ACTIVE' ? getTimeRemaining(raffle.end_date) :
                     'Not Active'}
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
                    {raffle.points_per_ticket} Point{raffle.points_per_ticket !== 1 ? 's' : ''}
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
              {(raffle.user_ticket_count || 0) > 0 && (
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
                    You have <span className="font-semibold">{raffle.user_ticket_count || 0}</span> ticket{(raffle.user_ticket_count || 0) > 1 ? 's' : ''} in this raffle
                    {userEntry && !loadingEntry && (
                      <>
                        <br />
                        <span className="text-xs opacity-75">
                          Points spent: {userEntry.points_spent} Point{userEntry.points_spent !== 1 ? 's' : ''}
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
                    Required Points: {raffle.points_per_ticket * ticketCount} $Point{(raffle.points_per_ticket * ticketCount) !== 1 ? 's' : ''}
                  </div>
                  
                  {/* User Points Balance */}
                  {userData && (
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Your balance: {userData.points} $Point{userData.points !== 1 ? 's' : ''}
                    </div>
                  )}
                  
                  {/* Ticket Controls - Only show if max tickets > 1 and raffle is active */}
                  {raffle.max_tickets_per_user > 1 && raffle.status === 'ACTIVE' && remainingTickets > 0 && (
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
                raffle.status !== 'ACTIVE' || 
                !isRaffleActive(raffle.end_date) ||
                isLoading || 
                remainingTickets <= 0 ||
                ((raffle.user_ticket_count || 0) >= raffle.max_tickets_per_user) ||
                (raffle.max_participants && (raffle.current_participants || 0) >= raffle.max_participants)
              }
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center min-w-[140px] ${
                raffle.status !== 'ACTIVE' || 
                !isRaffleActive(raffle.end_date) ||
                remainingTickets <= 0 || 
                ((raffle.user_ticket_count || 0) >= raffle.max_tickets_per_user) ||
                (raffle.max_participants && (raffle.current_participants || 0) >= raffle.max_participants)
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
                  {raffle.status === 'COMPLETED' 
                    ? 'Raffle Completed' 
                    : raffle.status === 'CANCELLED'
                      ? 'Raffle Cancelled'
                      : raffle.status !== 'ACTIVE'
                        ? 'Raffle Not Active'
                        : !isRaffleActive(raffle.end_date)
                          ? 'Raffle Ended'
                          : remainingTickets <= 0
                            ? 'Max Tickets Reached'
                            : (raffle.max_participants && (raffle.current_participants || 0) >= raffle.max_participants)
                              ? 'Max Participants Reached'
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