'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { X, Calendar, Target, Users, Clock, ImageOff, Plus, Minus, Loader2, CheckCircle, AlertCircle, Crown, Trophy } from 'lucide-react';
import { Raffle } from '@/lib/supabase';
import { getTimeRemaining, isRaffleActive } from '@/lib/dateUtils';
import { RaffleContractService } from '@/lib/raffle-contract';
import { raffle_abi } from '@/lib/raffle-abi';
import { getConfig } from '@/lib/wagmi';
import { parseContractError } from '@/lib/errors';
import { formatTokenDisplay, formatNumberWithSpaces } from '@/lib/token-utils';
import { usePoints } from '@/contexts/PointsContext';

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


interface Participant {
  wallet_address: string;
  ticket_count: number;
  points_spent: number;
  created_at: string;
  join_tx_hash?: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TARGETED_LEGACY_WINNER_RAFFLE_ID = 156;
const OLD_RAFFLE_WINNER_CONTRACT_ADDRESSES = [
  '0x5B8Ab35F6894130253bE7199F9eA66F5Dc63D956',
  '0x47a27a42525ffF2b7264b342F74216E37A831332',
];
const OLD_RAFFLE_IDS = new Set([
  98, 99, 100, 101, 102, 103, 104, 105,
  106, 107, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121,
  127, 128, 129, 132, 136, 139, 145, 150, 154,
]);
const normalizeAddress = (walletAddress?: string | null) => walletAddress?.toLowerCase() || '';
const isSameAddress = (first?: string | null, second?: string | null) =>
  Boolean(first && second && normalizeAddress(first) === normalizeAddress(second));
const hasUsableWinnerAddress = (walletAddress?: string | null) =>
  Boolean(walletAddress && normalizeAddress(walletAddress) !== ZERO_ADDRESS);

async function getOldRaffleWinner(raffleId: number): Promise<string | null> {
  for (const contractAddress of OLD_RAFFLE_WINNER_CONTRACT_ADDRESSES) {
    const raffleInfo = await RaffleContractService.getLegacyRafflePrizeInfo(
      raffleId.toString(),
      contractAddress
    );

    if (hasUsableWinnerAddress(raffleInfo?.winner)) {
      return raffleInfo!.winner;
    }
  }

  return null;
}

export default function JoinRaffleModal({ isOpen, onClose, raffle, isDarkMode = false, onSuccess }: JoinRaffleModalProps) {
  const [imageError, setImageError] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userEntry, setUserEntry] = useState<UserEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [resolvedWinner, setResolvedWinner] = useState<string | null>(null);

  // Wagmi hooks for contract interaction
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { user, loading: userLoading, refreshUserData } = usePoints();

  // Contract configuration
  const contractAddress = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS;

  // Helper function to truncate wallet address
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const winnerAddress = useMemo(() => {
    if (hasUsableWinnerAddress(resolvedWinner)) return resolvedWinner;
    if (hasUsableWinnerAddress(raffle?.winner)) return raffle?.winner || null;
    return null;
  }, [raffle?.winner, resolvedWinner]);

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (raffle?.status === 'COMPLETED' && winnerAddress) {
        if (isSameAddress(a.wallet_address, winnerAddress)) return -1;
        if (isSameAddress(b.wallet_address, winnerAddress)) return 1;
      }

      if (isSameAddress(a.wallet_address, address)) return -1;
      if (isSameAddress(b.wallet_address, address)) return 1;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [address, participants, raffle?.status, winnerAddress]);

  useEffect(() => {
    if (!raffle) {
      setResolvedWinner(null);
      return;
    }

    setResolvedWinner(hasUsableWinnerAddress(raffle.winner) ? raffle.winner! : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffle?.id, raffle?.winner]);

  useEffect(() => {
    if (!isOpen || !raffle || raffle.status !== 'COMPLETED' || winnerAddress) return;

    let cancelled = false;

    const loadWinner = async () => {
      try {
        let contractWinner: string | null = null;

        if (raffle.id === TARGETED_LEGACY_WINNER_RAFFLE_ID && raffle.contract_address) {
          const raffleInfo = await RaffleContractService.getRafflePrizeInfo(
            raffle.id.toString(),
            raffle.contract_address
          );
          contractWinner = raffleInfo?.winner || null;
        } else if (OLD_RAFFLE_IDS.has(raffle.id)) {
          contractWinner = await getOldRaffleWinner(raffle.id);
        } else {
          const raffleInfo = await RaffleContractService.getRafflePrizeInfo(raffle.id.toString());
          contractWinner = raffleInfo?.winner || null;
        }

        if (!cancelled && hasUsableWinnerAddress(contractWinner)) {
          setResolvedWinner(contractWinner);
        }
      } catch (error) {
        console.error('Error fetching raffle winner:', error);
      }
    };

    loadWinner();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, raffle?.id, raffle?.status, winnerAddress]);

  // Reset modal state when opened — depend only on isOpen + raffle.id to avoid
  // re-running every time the parent re-renders with a new raffle object reference
  useEffect(() => {
    if (isOpen && raffle) {
      // Use prop as initial estimate; will be corrected when userEntry loads
      const currentTickets = raffle.user_ticket_count || 0;
      const remainingTickets = raffle.max_tickets_per_user - currentTickets;
      setTicketCount(remainingTickets > 0 ? Math.min(1, remainingTickets) : 0);
      setMessage(null);
      setImageError(false);
      setUserEntry(null);
      fetchParticipants(true);
      fetchUserEntry();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, raffle?.id]);

  // Re-initialize ticketCount once we have accurate user entry data
  useEffect(() => {
    if (!raffle) return;
    if (userEntry) {
      const remaining = Math.max(0, raffle.max_tickets_per_user - userEntry.ticket_count);
      setTicketCount(remaining > 0 ? 1 : 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEntry]);

  // Polling mechanism for participants updates
  useEffect(() => {
    if (!isOpen || !raffle) return;

    // Check if raffle is still active for polling
    const isRaffleStillActive = raffle.status === 'ACTIVE' && isRaffleActive(raffle.end_date);

    if (!isRaffleStillActive) return;

    // Poll occasionally while the modal is visible. This keeps live counts useful
    // without creating a steady stream of API requests for idle tabs.
    const pollInterval = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        raffle.status === 'ACTIVE' &&
        isRaffleActive(raffle.end_date)
      ) {
        fetchParticipants(false); // Poll without loading indicator
      }
    }, 90000);

    // Cleanup interval on component unmount or when dependencies change
    return () => {
      clearInterval(pollInterval);
    };
  }, [isOpen, raffle?.id, raffle?.status]);


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
      setUserEntry(null);
    } finally {
      setLoadingEntry(false);
    }
  };

  const fetchParticipants = async (showLoading = true) => {
    if (!raffle) return;

    if (showLoading) {
      setLoadingParticipants(true);
    }

    try {
      const response = await fetch(`/api/raffles/${raffle.id}/participants`);
      const data = await response.json();

      if (data.success && data.data) {
        const fetchedParticipants = data.data as Participant[];
        setParticipants(fetchedParticipants);

        // Update raffle participant count based on actual data
        if (raffle) {
          raffle.current_participants = fetchedParticipants.length;
        }
      } else {
        setParticipants([]);
        if (raffle) {
          raffle.current_participants = 0;
        }
      }
    } catch (error) {
      // Don't clear participants on error during polling to avoid UI flicker
      if (showLoading) {
        setParticipants([]);
        if (raffle) {
          raffle.current_participants = 0;
        }
      }
    } finally {
      if (showLoading) {
        setLoadingParticipants(false);
      }
    }
  };

  // Client-side validation function
  const validateRaffleEntry = (): { isValid: boolean; error?: string } => {
    if (!raffle || !user) {
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
    if (user.points < totalCost) {
      const shortage = totalCost - user.points;
      return {
        isValid: false,
        error: `Insufficient points. You need ${totalCost.toFixed(1)} Point${totalCost !== 1 ? 's' : ''} but have ${user.points.toFixed(1)} Point${user.points !== 1 ? 's' : ''} (${shortage.toFixed(1)} short)`
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


      setMessage({
        type: 'success',
        text: 'Transaction submitted. Waiting for confirmation...'
      });

      try {
        const receipt = await waitForTransactionReceipt(getConfig(), {
          hash: txHash,
          confirmations: 1,
          timeout: 60000,
        });

        if (receipt.status !== 'success') {
          throw new Error('Transaction failed on-chain');
        }

        setMessage({
          type: 'success',
          text: 'Transaction confirmed. Recording your entry...'
        });
      } catch (confirmationError) {
        const confirmationMessage = confirmationError instanceof Error
          ? confirmationError.message.toLowerCase()
          : '';

        if (
          !confirmationMessage.includes('timeout') &&
          !confirmationMessage.includes('not found') &&
          !confirmationMessage.includes('network') &&
          !confirmationMessage.includes('fetch')
        ) {
          throw confirmationError;
        }

        setMessage({
          type: 'success',
          text: 'Transaction submitted. Verifying your entry...'
        });
      }

      // Step 2: If contract interaction succeeds, proceed with API verification
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
          // Get current user tickets using same logic as main calculation
          const userParticipant = participants.find(p => isSameAddress(p.wallet_address, address));
          const oldUserTicketCount = raffle.user_ticket_count || userParticipant?.ticket_count || 0;

          // Update the raffle object to reflect new total
          raffle.user_ticket_count = oldUserTicketCount + ticketCount;


          // Also update participant count if this is the user's first entry
          if (oldUserTicketCount === 0) {
            raffle.current_participants = (raffle.current_participants || 0) + 1;
          }
        }

        // Reset ticket count based on remaining tickets after successful purchase
        const userParticipant = participants.find(p => isSameAddress(p.wallet_address, address));
        const updatedUserTickets = raffle.user_ticket_count || userParticipant?.ticket_count || 0;
        const newRemainingTickets = raffle.max_tickets_per_user - updatedUserTickets;
        const newTicketCount = Math.min(1, newRemainingTickets);


        setTicketCount(newTicketCount);

        // Refresh detailed entry info if needed
        if (raffle.user_ticket_count && raffle.user_ticket_count > 0) {
          await fetchUserEntry();
        }

        // Refresh participants list
        await fetchParticipants(false);

        // Refresh global user points state
        try {
          await refreshUserData();
        } catch (error) {
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

  // Calculate remaining tickets dynamically based on current state
  // Priority: userEntry (fetched specifically for this user+raffle) > participants list > raffle prop
  const userParticipant = participants.find(p => isSameAddress(p.wallet_address, address));
  const currentUserTickets = userEntry?.ticket_count ?? userParticipant?.ticket_count ?? raffle?.user_ticket_count ?? 0;
  const maxPerUser = Number.isFinite(Number(raffle?.max_tickets_per_user)) ? Number(raffle?.max_tickets_per_user) : 0;
  const remainingTickets = Math.max(0, maxPerUser - currentUserTickets);

  // Safety net: enforce cap if ticketCount drifts above remainingTickets for any reason
  useEffect(() => {
    if (ticketCount > remainingTickets && remainingTickets > 0) {
      setTicketCount(remainingTickets);
    } else if (remainingTickets <= 0 && ticketCount !== 0) {
      setTicketCount(0);
    }
  }, [ticketCount, remainingTickets]);

  if (!isOpen || !raffle) return null;


  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleTicketChange = (newCount: number) => {
    if (!raffle) {
      return;
    }

    if (remainingTickets <= 0) {
      return;
    }

    const safeNewCount = Number.isFinite(newCount) ? Math.floor(newCount) : 1;
    const clamped = Math.min(Math.max(1, safeNewCount), remainingTickets);

    if (message?.type === 'error') {
      setMessage(null);
    }

    setTicketCount(clamped);
  };


  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative ${isDarkMode
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200'
        } border`}>
        {/* Modal Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-3 mb-2">
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {raffle.status === 'COMPLETED' || raffle.status === 'CANCELLED' ? 'View Raffle' : 'Join Raffle'}: {raffle.title}
                </h2>
                <div className="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                  {formatNumberWithSpaces(raffle.points_per_ticket.toFixed(1))} Points per ticket
                </div>
                {/* Prize Display - Only for ERC20 Token Raffles */}
                {raffle.prize_token_type === 'ERC20' && raffle.prize_amount && (

                  <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full ${raffle.status === 'COMPLETED'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                    : 'bg-green-100 text-green-700 border border-green-300'
                    } text-xs font-medium`}>
                    <Trophy className={`w-3 h-3 ${raffle.status === 'COMPLETED' ? 'text-yellow-600' : 'text-green-600'
                      }`} />
                    <span>
                      Win {formatNumberWithSpaces(raffle.prize_amount || 0)} Tokens{raffle.status === 'COMPLETED' && winnerAddress ? ' 🎊' : '!'}
                    </span>
                  </div>

                )}

                {/* Prize Display - For NFT Raffles */}
                {raffle.prize_token_type === 'NFT' && raffle.prize_token_id && (

                  <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full ${raffle.status === 'COMPLETED'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                    } text-xs font-medium`}>
                    <Trophy className={`w-3 h-3 ${raffle.status === 'COMPLETED' ? 'text-yellow-600' : 'text-purple-600'
                      }`} />
                    <span>
                      Win NFT #{formatNumberWithSpaces(raffle.prize_token_id || 0)}{raffle.status === 'COMPLETED' && winnerAddress ? ' 🎊' : '!'}
                    </span>
                  </div>

                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors duration-200 ${isDarkMode
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
              {(participants.length > 0 || loadingParticipants) && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Participants {!loadingParticipants && (
                        <span className="text-purple-600">({participants.length})</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {!loadingParticipants && participants.length > 0 && (
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Tickets sold <span className="text-purple-600">({participants.reduce((sum, p) => sum + p.ticket_count, 0)})</span>
                        </span>
                      )}
                      {loadingParticipants && (
                        <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <div className={`max-h-48 overflow-y-auto rounded-lg border ${isDarkMode ? 'border-gray-600 bg-gray-700/30' : 'border-gray-200 bg-gray-50'
                    } p-3 space-y-2`}>
                    {loadingParticipants && participants.length === 0 ? (
                      // Loading state - show skeleton placeholders
                      <div className="space-y-2">
                        {[1, 2, 3].map((index) => (
                          <div
                            key={`loading-${index}`}
                            className={`flex items-center justify-between p-2 rounded-lg animate-pulse ${isDarkMode ? 'bg-gray-700/50' : 'bg-white'
                              }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <div className={`h-4 w-24 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                                  }`}></div>
                              </div>
                              <div className={`mt-1 h-3 w-32 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                                }`}></div>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                              <div className={`h-6 w-16 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                                }`}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : participants.length > 0 ? (
                      // Show actual participants
                      sortedParticipants.map((participant, index) => {
                        const isWinner = raffle?.status === 'COMPLETED' && isSameAddress(participant.wallet_address, winnerAddress);
                        const isCurrentUser = isSameAddress(participant.wallet_address, address);

                        return (
                          <div
                            key={`${participant.wallet_address}-${index}`}
                            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${isWinner
                              ? isDarkMode
                                ? 'bg-gradient-to-r from-yellow-900/40 to-yellow-800/40 border border-yellow-700 ring-1 ring-yellow-600/20'
                                : 'bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-300 ring-1 ring-yellow-400/20'
                              : isCurrentUser
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
                                {isWinner && (
                                  <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                )}
                                <span className={`text-sm font-medium ${isWinner
                                  ? isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                                  : isCurrentUser
                                    ? isDarkMode ? 'text-purple-300' : 'text-purple-700'
                                    : isDarkMode ? 'text-gray-200' : 'text-gray-900'
                                  }`}>
                                  {truncateAddress(participant.wallet_address)}
                                </span>
                                {isWinner && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isDarkMode
                                    ? 'bg-yellow-800 text-yellow-200 border border-yellow-700'
                                    : 'bg-yellow-200 text-yellow-800 border border-yellow-300'
                                    }`}>
                                    Winner
                                  </span>
                                )}
                                {isCurrentUser && !isWinner && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isDarkMode
                                    ? 'bg-purple-800 text-purple-200'
                                    : 'bg-purple-200 text-purple-800'
                                    }`}>
                                    You
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                {formatNumberWithSpaces(participant.ticket_count)} ticket{participant.ticket_count > 1 ? 's' : ''} • {formatNumberWithSpaces(participant.points_spent.toFixed(1))} points
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                              {participant.join_tx_hash ? (
                                <a
                                  href={`https://explorer.inkonchain.com/tx/${participant.join_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs px-2 py-1 rounded-full transition-colors border ${isDarkMode
                                    ? 'border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white'
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                    }`}
                                >
                                  View Txn
                                </a>
                              ) : (
                                <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode
                                  ? 'bg-gray-600 text-gray-400'
                                  : 'bg-gray-200 text-gray-500'
                                  }`}>
                                  No Txn
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Empty state when not loading and no participants
                      <div className={`text-center py-4 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No participants yet
                      </div>
                    )}
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
                  <span className={`text-sm font-semibold ${raffle.status === 'COMPLETED' || raffle.status === 'CANCELLED'
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
                    {formatNumberWithSpaces(raffle.points_per_ticket.toFixed(1))} Point{raffle.points_per_ticket !== 1 ? 's' : ''}
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
                    {formatNumberWithSpaces(raffle.max_tickets_per_user)}
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
                      {formatNumberWithSpaces(raffle.current_participants || 0)} / {formatNumberWithSpaces(raffle.max_participants)}
                    </span>
                  </div>
                )}
              </div>

              {/* User's Existing Entries - Show from raffle data first, then fetch detailed info */}
              {(raffle.user_ticket_count || 0) > 0 && (
                <div className={`p-4 rounded-xl border ${isDarkMode
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
                    You have <span className="font-semibold">{formatNumberWithSpaces(raffle.user_ticket_count || 0)}</span> ticket{(raffle.user_ticket_count || 0) > 1 ? 's' : ''} in this raffle
                    {userEntry && !loadingEntry && (
                      <>
                        <br />
                        <span className="text-xs opacity-75">
                          Points spent: {formatNumberWithSpaces(userEntry.points_spent.toFixed(1))} Point{userEntry.points_spent !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Message Display */}
              {message && (
                <div className={`p-4 rounded-xl border flex items-start space-x-3 ${message.type === 'success'
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
              <div className={`p-4 rounded-xl border ${isDarkMode
                ? 'bg-gray-700/50 border-gray-600'
                : 'bg-gray-50 border-gray-200'
                }`}>
                <div className="space-y-4">
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Required Points: {formatNumberWithSpaces((raffle.points_per_ticket * ticketCount).toFixed(1))} $Point{(raffle.points_per_ticket * ticketCount) !== 1 ? 's' : ''}
                  </div>

                  {/* User Points Balance */}
                  {user && (
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Your balance: {formatNumberWithSpaces(user.points.toFixed(1))} $Point{user.points !== 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Ticket Controls - Only show if user can purchase more tickets and raffle is active */}
                  {raffle.max_tickets_per_user > 1 &&
                    raffle.status === 'ACTIVE' &&
                    remainingTickets > 0 &&
                    isRaffleActive(raffle.end_date) &&
                    !(raffle.max_participants && (raffle.current_participants || 0) >= raffle.max_participants) && (
                      <div className="space-y-2">
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Select number of tickets ({formatNumberWithSpaces(remainingTickets)} remaining):
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleTicketChange(ticketCount - 1)}
                            disabled={ticketCount <= 1 || isLoading}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors duration-200 ${ticketCount <= 1 || isLoading
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
                            step="1"
                            value={ticketCount}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              handleTicketChange(isNaN(parsed) ? 1 : parsed);
                            }}
                            onBlur={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              handleTicketChange(isNaN(parsed) ? 1 : parsed);
                            }}
                            disabled={isLoading}
                            className={`w-14 h-8 text-center border rounded-full font-medium text-sm ${isDarkMode
                              ? 'bg-gray-700 border-gray-500 text-white focus:border-purple-400'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
                              } focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50`}
                          />

                          <button
                            type="button"
                            onClick={() => {
                              handleTicketChange(Math.min(ticketCount + 1, remainingTickets));
                            }}
                            disabled={ticketCount >= remainingTickets || remainingTickets <= 0 || isLoading}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors duration-200 ${ticketCount >= remainingTickets || remainingTickets <= 0 || isLoading
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
                    {remainingTickets <= 0
                      ? `You have reached the maximum of ${formatNumberWithSpaces(raffle.max_tickets_per_user)} ticket${raffle.max_tickets_per_user > 1 ? 's' : ''} for this raffle.`
                      : raffle.user_ticket_count && raffle.user_ticket_count > 0
                        ? `You can purchase up to ${formatNumberWithSpaces(remainingTickets)} more ticket${remainingTickets > 1 ? 's' : ''} for this raffle.`
                        : `You can purchase up to ${formatNumberWithSpaces(raffle.max_tickets_per_user)} ticket${raffle.max_tickets_per_user > 1 ? 's' : ''} for this raffle.`
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
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${isDarkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                } disabled:cursor-not-allowed`}
            >
              Close
            </button>
            {/* Only show join button for active raffles */}
            {raffle.status === 'ACTIVE' && isRaffleActive(raffle.end_date) && (
              <button
                onClick={handleJoinRaffle}
                disabled={Boolean(
                  isLoading ||
                  remainingTickets <= 0 ||
                  (raffle.max_participants && (raffle.current_participants || 0) >= raffle.max_participants)
                )}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center min-w-[140px] ${remainingTickets <= 0 ||
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
                    {remainingTickets <= 0
                      ? 'Max Tickets Reached'
                      : (raffle.max_participants && (raffle.current_participants || 0) >= raffle.max_participants)
                        ? 'Max Participants Reached'
                        : `Join Raffle (${ticketCount} ticket${ticketCount > 1 ? 's' : ''})`
                    }
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
