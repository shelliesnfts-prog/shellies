'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { Trophy, Star, TrendingUp, Loader2, CheckCircle, AlertTriangle, Coins, Lock, Unlock, Shield } from 'lucide-react';
import { NFTService } from '@/lib/nft-service';
import { StakingService, LockPeriod } from '@/lib/staking-service';
import { ImageUtils } from '@/lib/image-utils';
import { staking_abi } from '@/lib/staking-abi';
import { erc721Abi } from 'viem';
import { parseContractError } from '@/lib/errors';
import { useDashboard } from '@/hooks/useDashboard';
import { usePoints } from '@/contexts/PointsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { StakingPageSkeleton } from '@/components/portal/StakingPageSkeleton';
import ApprovalStakeModal from '@/components/ApprovalStakeModal';
import StakingPeriodModal from '@/components/StakingPeriodModal';
import { StakingTimer } from '@/components/StakingTimer';

interface NFTToken {
  tokenId: number;
  isStaked: boolean;
  selected?: boolean;
  name?: string;
  image?: string;
  description?: string;
  attributes?: any[];
  metadata?: {
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
  };
  stakeInfo?: {
    lockPeriod: number;
    lockEndTime: number;
    canUnstake: boolean;
    timeRemaining: number;
  };
}

// NFT Image component with enhanced error handling and fallbacks
function NFTImage({ 
  src, 
  alt, 
  tokenId, 
  isDarkMode 
}: { 
  src?: string; 
  alt: string; 
  tokenId: number; 
  isDarkMode: boolean; 
}) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState<string | undefined>();
  const [fallbackUrls, setFallbackUrls] = useState<string[]>([]);
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);

  // Process the image URL and get fallbacks
  useEffect(() => {
    if (!src) {
      setImageState('error');
      return;
    }

    const processed = ImageUtils.processNftImageUrl(src);
    if (processed.primaryUrl) {
      setCurrentSrc(processed.primaryUrl);
      setFallbackUrls(processed.fallbackUrls);
      setCurrentFallbackIndex(0);
      setImageState('loading');
    } else {
      setImageState('error');
    }
  }, [src]);

  const tryNextFallback = useCallback(() => {
    if (currentFallbackIndex < fallbackUrls.length) {
      const nextUrl = fallbackUrls[currentFallbackIndex];
      setCurrentSrc(nextUrl);
      setCurrentFallbackIndex(prev => prev + 1);
      setImageState('loading');
    } else {
      setImageState('error');
    }
  }, [currentFallbackIndex, fallbackUrls, tokenId]);

  const handleLoad = useCallback(() => {
    setImageState('loaded');
  }, []);

  const handleError = useCallback(() => {
    tryNextFallback();
  }, [currentSrc, tokenId, tryNextFallback]);

  if (!src || imageState === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <Trophy className={`w-8 h-8 mx-auto mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          <div className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
            #{tokenId}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {imageState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className={`w-6 h-6 mx-auto mb-2 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              Loading...
            </div>
          </div>
        </div>
      )}
      {currentSrc && (
        <img 
          src={currentSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageState === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          {...ImageUtils.getImageAttributes(false)}
        />
      )}
    </>
  );
}

export default function StakingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useTheme();
  const [stakingStats, setStakingStats] = useState({
    totalStaked: 0,
    dailyPoints: 0,
    stakedTokenIds: [] as number[],
    isCurrentStaker: false
  });
  const [ownedNFTs, setOwnedNFTs] = useState<NFTToken[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<number[]>([]);
  const [transactionState, setTransactionState] = useState<{
    type: 'stake' | 'unstake' | 'approve' | null;
    status: 'idle' | 'pending' | 'success' | 'error';
    message: string;
    hash?: string;
  }>({ type: null, status: 'idle', message: '' });
  const [approvalState, setApprovalState] = useState<{
    needed: boolean;
    checking: boolean;
    tokensNeedingApproval: number[];
  }>({ needed: false, checking: false, tokensNeedingApproval: [] });
  const [viewMode, setViewMode] = useState<'owned' | 'staked'>('owned');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showStakingModal, setShowStakingModal] = useState(false);

  // Get global points context early
  const { user, claimStatus, loading: dashboardLoading } = usePoints();


  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { data: txReceipt, isLoading: isTxLoading, error: txError } = useWaitForTransactionReceipt({
    hash: transactionState.hash as `0x${string}` | undefined,
  });

  const stakingContractAddress = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
  const nftContractAddress = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS;


  // Fetch user data on wallet connect
  useEffect(() => {
    if (address && isConnected) {
      fetchUserData();
    } else {
      resetData();
    }
  }, [address, isConnected]);


  // Handle transaction receipt
  useEffect(() => {
    if (txReceipt) {
      if (txReceipt.status === 'success') {
        if (transactionState.type === 'approve') {
          setTransactionState({ type: null, status: 'success', message: 'Approval confirmed! You can now stake your NFTs.' });
          // Clear approval state and success message after a moment
          setTimeout(() => {
            setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
            setTransactionState({ type: null, status: 'idle', message: '' });
          }, 3000);
        } else {
          setTransactionState(prev => ({ ...prev, status: 'success', message: 'Transaction confirmed! Refreshing data...' }));
          // Refresh data after successful stake/unstake transaction
          // Use longer delay for unstake operations to allow explorer API to catch up
          const delay = transactionState.type === 'unstake' ? 4000 : 2000;
          setTimeout(async () => {
            try {
              // Staking service no longer uses caching - always fetches fresh data
              
              // Clear selected tokens first
              setSelectedTokens([]);
              
              // Fetch fresh data with aggressive cache busting after transactions
              await fetchUserData(true);
              
              
              // Broadcast points update to refresh dashboard
              window.dispatchEvent(new CustomEvent('stakingUpdated', { 
                detail: { walletAddress: address }
              }));
              
              setTransactionState({ type: null, status: 'idle', message: '' });
              setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
            } catch (error) {
              setTransactionState({ 
                type: null, 
                status: 'error', 
                message: 'Transaction succeeded but failed to refresh data. Please reload the page.' 
              });
            }
          }, delay);
        }
      } else {
        setTransactionState(prev => ({ ...prev, status: 'error', message: 'Transaction failed on blockchain' }));
        // Clear error after 5 seconds
        setTimeout(() => {
          setTransactionState({ type: null, status: 'idle', message: '' });
        }, 5000);
      }
    }
  }, [txReceipt, transactionState.type]);

  // Handle transaction loading timeout
  useEffect(() => {
    if (transactionState.status === 'pending' && transactionState.hash) {
      const timeout = setTimeout(() => {
        setTransactionState(prev => ({ 
          ...prev, 
          message: 'Transaction is taking longer than expected. Check your wallet or block explorer.' 
        }));
      }, 30000); // 30 seconds

      return () => clearTimeout(timeout);
    }
  }, [transactionState.status, transactionState.hash]);

  // Handle transaction errors
  useEffect(() => {
    if (txError) {
      setTransactionState(prev => ({
        ...prev,
        status: 'error',
        message: 'Transaction failed to confirm. Please check your wallet.'
      }));
      // Clear error after 8 seconds
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 8000);
    }
  }, [txError]);


  const resetData = () => {
    setStakingStats({ totalStaked: 0, dailyPoints: 0, stakedTokenIds: [], isCurrentStaker: false });
    setOwnedNFTs([]);
    setSelectedTokens([]);
    setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
    setLoading(false);
  };

  const fetchUserData = async (bustCache: boolean = false) => {
    if (!address) return;

    try {
      setLoading(true);
      
      // Fetch staking stats and user's owned NFTs in parallel
      const [stats, userNftsWithMetadata] = await Promise.all([
        StakingService.getStakingStats(address),
        NFTService.getNFTsWithMetadata(address)
      ]);
      
      setStakingStats(stats);
      
      // Combine all NFTs with proper staking status
      const allTokensMap = new Map<number, NFTToken>();
      
      // Add user's owned NFTs (these are available for staking)
      for (const nft of userNftsWithMetadata) {
        allTokensMap.set(nft.tokenId, {
          tokenId: nft.tokenId,
          isStaked: false,
          name: nft.name,
          image: nft.image,
          metadata: nft.metadata
        });
      }
      
      // Fetch metadata for staked NFTs using explorer API (same as available NFTs)
      if (stats.stakedTokenIds.length > 0 && stakingContractAddress) {
        const stakedNftsWithMetadata = await NFTService.getStakedNFTsMetadata(
          stakingContractAddress,
          stats.stakedTokenIds
        );

        // Get stake info for each staked NFT
        const stakeInfoPromises = stats.stakedTokenIds.map(async (tokenId) => {
          try {
            const [stakeInfo, unstakeInfo] = await Promise.all([
              StakingService.getStakeInfo(tokenId),
              StakingService.canUnstake(tokenId)
            ]);
            return { tokenId, stakeInfo, unstakeInfo };
          } catch (error) {
            console.error(`Failed to fetch stake info for token ${tokenId}:`, error);
            return { tokenId, stakeInfo: null, unstakeInfo: { canUnstake: false, timeRemaining: 0 } };
          }
        });

        const stakeInfoResults = await Promise.all(stakeInfoPromises);
        const stakeInfoMap = new Map(
          stakeInfoResults.map(result => [result.tokenId, { stakeInfo: result.stakeInfo, unstakeInfo: result.unstakeInfo }])
        );

        // Add staked NFTs to the map with stake info
        for (const nft of stakedNftsWithMetadata) {
          const stakeData = stakeInfoMap.get(nft.tokenId);
          allTokensMap.set(nft.tokenId, {
            tokenId: nft.tokenId,
            isStaked: true,
            name: nft.name,
            image: nft.image,
            description: nft.description,
            attributes: nft.attributes,
            metadata: nft.metadata,
            stakeInfo: stakeData?.stakeInfo ? {
              lockPeriod: stakeData.stakeInfo.lockPeriod,
              lockEndTime: stakeData.stakeInfo.lockEndTime,
              canUnstake: stakeData.unstakeInfo.canUnstake,
              timeRemaining: stakeData.unstakeInfo.timeRemaining
            } : undefined
          });
        }
      }
      
      const nftTokens = Array.from(allTokensMap.values()).sort((a, b) => a.tokenId - b.tokenId);
      
      setOwnedNFTs(nftTokens);
      setSelectedTokens([]);
      
    } catch (error) {
      setTransactionState({
        type: null,
        status: 'error',
        message: 'Failed to load NFT data. Please try refreshing the page.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSelection = (tokenId: number, isSelected: boolean) => {
    if (isSelected) {
      setSelectedTokens(prev => [...prev, tokenId]);
    } else {
      setSelectedTokens(prev => prev.filter(id => id !== tokenId));
    }
  };

  const handleSelectAll = () => {
    const availableTokens = ownedNFTs.filter(nft => 
      viewMode === 'owned' ? !nft.isStaked : nft.isStaked
    ).map(nft => nft.tokenId);
    
    if (selectedTokens.length === availableTokens.length) {
      setSelectedTokens([]);
    } else {
      setSelectedTokens(availableTokens);
    }
  };

  const checkNFTApprovals = async (tokenIds: number[]): Promise<{ approved: number[]; needApproval: number[] }> => {
    if (!address || !stakingContractAddress || !nftContractAddress) {
      return { approved: [], needApproval: tokenIds };
    }

    try {
      const approvalResult = await NFTService.checkNFTsApproval(
        address,
        stakingContractAddress,
        tokenIds
      );
      
      return approvalResult;
    } catch (error) {
      return { approved: [], needApproval: tokenIds };
    }
  };


  const handleStake = async () => {
    if (!selectedTokens.length || !address || !stakingContractAddress || !nftContractAddress) {
      return;
    }

    try {
      setTransactionState({ type: 'stake', status: 'pending', message: 'Checking NFT ownership and approvals...' });

      // Check if user owns these NFTs first
      const ownedTokens = ownedNFTs.filter(nft => !nft.isStaked).map(nft => nft.tokenId);
      const invalidTokens = selectedTokens.filter(id => !ownedTokens.includes(id));

      if (invalidTokens.length > 0) {
        setTransactionState({
          type: 'stake',
          status: 'error',
          message: `Invalid tokens selected: ${invalidTokens.join(', ')}`
        });
        return;
      }

      // Check NFT approvals
      setApprovalState({ needed: false, checking: true, tokensNeedingApproval: [] });

      const { approved, needApproval } = await checkNFTApprovals(selectedTokens);

      // Clear the checking state
      setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
      setTransactionState({ type: null, status: 'idle', message: '' });

      if (needApproval.length > 0) {
        // Open the approval modal for unified flow
        setShowApprovalModal(true);
        return;
      }

      // If already approved, open the staking period selection modal
      setShowStakingModal(true);

    } catch (error: any) {
      let errorMessage = 'Failed to check approvals';
      if (error?.message?.includes('block is out of range')) {
        errorMessage = 'Blockchain sync issue. Please try again in a moment.';
      } else {
        errorMessage = parseContractError(error) || error?.message?.slice(0, 100) || 'Failed to check approvals';
      }

      setTransactionState({ type: 'stake', status: 'error', message: errorMessage });
      setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });

      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 10000);
    }
  };

  // Modal handlers for the new staking modal
  const handleStakingModalSuccess = async () => {
    // The staking modal has completed successfully
    setShowStakingModal(false);

    // Trigger the same UI refresh logic as other successful transactions
    try {
      // Clear all relevant caches to force fresh data
      if (address) {
      }

      // Clear selected tokens first
      setSelectedTokens([]);

      // Show success state temporarily
      setTransactionState({
        type: 'stake',
        status: 'success',
        message: 'Staking completed successfully! Refreshing data...'
      });

      // Fetch fresh data with cache busting
      await fetchUserData(true);

      // Broadcast points update to refresh dashboard
      if (address) {
        window.dispatchEvent(new CustomEvent('stakingUpdated', {
          detail: { walletAddress: address }
        }));
      }

      // Clear success message after showing it briefly
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 3000);

    } catch (error) {
      setTransactionState({
        type: null,
        status: 'error',
        message: 'Staking succeeded but failed to refresh data. Please reload the page.'
      });

      // Clear error after 5 seconds
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 5000);
    }
  };

  const handleStakingModalClose = () => {
    setShowStakingModal(false);
  };

  // Modal handlers
  const handleModalSuccess = async () => {
    // The modal has completed both approval and staking successfully
    setShowApprovalModal(false);

    // Trigger the same UI refresh logic as direct staking
    try {
      // Clear all relevant caches to force fresh data
      if (address) {
      }

      // Clear selected tokens first
      setSelectedTokens([]);

      // Show success state temporarily
      setTransactionState({
        type: 'stake',
        status: 'success',
        message: 'Staking completed successfully! Refreshing data...'
      });

      // Fetch fresh data with cache busting
      await fetchUserData(true);

      // Broadcast points update to refresh dashboard
      if (address) {
        window.dispatchEvent(new CustomEvent('stakingUpdated', {
          detail: { walletAddress: address }
        }));
      }

      // Clear success message after showing it briefly
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 3000);

    } catch (error) {
      setTransactionState({
        type: null,
        status: 'error',
        message: 'Staking succeeded but failed to refresh data. Please reload the page.'
      });

      // Clear error after 5 seconds
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 5000);
    }
  };

  const handleModalClose = () => {
    setShowApprovalModal(false);
  };

  const handleUnstake = async () => {
    if (!selectedTokens.length || !address || !stakingContractAddress) {
      return;
    }

    try {
      setTransactionState({ type: 'unstake', status: 'pending', message: 'Preparing transaction...' });

      const tokenIds = selectedTokens.map(id => BigInt(id));

      // Check if user actually has these tokens staked
      const stakedTokens = ownedNFTs.filter(nft => nft.isStaked).map(nft => nft.tokenId);
      const invalidTokens = selectedTokens.filter(id => !stakedTokens.includes(id));
      
      if (invalidTokens.length > 0) {
        setTransactionState({ 
          type: 'unstake', 
          status: 'error', 
          message: `Tokens not staked: ${invalidTokens.join(', ')}` 
        });
        return;
      }
      
      const hash = await writeContractAsync({
        address: stakingContractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'unstakeBatch',
        args: [tokenIds],
      });

      setTransactionState({
        type: 'unstake',
        status: 'pending',
        message: 'Transaction submitted, waiting for confirmation...',
        hash
      });

    } catch (error: any) {
      
      // Check for specific error patterns
      let errorMessage = 'Failed to unstake tokens';
      if (error?.message?.includes('block is out of range')) {
        errorMessage = 'Blockchain sync issue. Please try again in a moment.';
      } else if (error?.message?.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled by user';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else if (error?.message?.includes('nonce')) {
        errorMessage = 'Transaction nonce issue. Please try again.';
      } else {
        errorMessage = parseContractError(error) || error?.message?.slice(0, 100) || 'Failed to unstake tokens';
      }

      setTransactionState({ type: 'unstake', status: 'error', message: errorMessage });
      
      // Clear error after 10 seconds
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 10000);
    }
  };


  const getFilteredNFTs = () => {
    return ownedNFTs.filter(nft => viewMode === 'owned' ? !nft.isStaked : nft.isStaked);
  };

  if (!isConnected) {
    return (
      <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <PortalSidebar
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
          <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
            <div className="flex items-center justify-center h-64">
              <div className={`text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Please connect your wallet to view and manage your NFT staking
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      <PortalSidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
          {loading ? (
            <StakingPageSkeleton isDarkMode={isDarkMode} />
          ) : (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h1 className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent`}>
                  NFT Staking
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Stake your Shellies NFTs to earn <span className="font-semibold text-blue-600">10 points per day</span> for each staked NFT
                </p>
              </div>
              <div className={`px-4 py-2 rounded-xl border ${
                isDarkMode 
                  ? 'bg-gray-800/50 border-gray-600 text-gray-300 backdrop-blur-sm' 
                  : 'bg-white/60 border-gray-200 text-gray-600 backdrop-blur-sm shadow-sm'
              }`}>
                <span className="text-sm font-medium">
                  {loading ? '...' : `${ownedNFTs.length} Total NFTs`}
                </span>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* NFTs Staked */}
              <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500' 
                  : 'bg-gradient-to-br from-white to-blue-50/30 border-blue-200/60 hover:border-blue-300 shadow-sm'
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${
                      isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                      <Lock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'
                    }`}>
                      Staked
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      NFTs Staked
                    </h3>
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {stakingStats.totalStaked}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Earning {stakingStats.dailyPoints} pts/day
                    </p>
                  </div>
                </div>
              </div>

              {/* Available NFTs */}
              <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-green-500' 
                  : 'bg-gradient-to-br from-white to-green-50/30 border-green-200/60 hover:border-green-300 shadow-sm'
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${
                      isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                    }`}>
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-green-50 text-green-700'
                    }`}>
                      Available
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Available NFTs
                    </h3>
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {ownedNFTs.filter(nft => !nft.isStaked).length}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Ready to stake
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Points */}
              <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500' 
                  : 'bg-gradient-to-br from-white to-purple-50/30 border-purple-200/60 hover:border-purple-300 shadow-sm'
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${
                      isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                    }`}>
                      <Star className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-purple-50 text-purple-700'
                    }`}>
                      Balance
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total Points
                    </h3>
                    {dashboardLoading ? (
                      <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                    ) : (
                      <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {user?.points || 0}
                      </p>
                    )}
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Point tokens
                    </p>
                  </div>
                </div>
              </div>
            </div>

           

            {/* Transaction Status */}
            {transactionState.status !== 'idle' && (
              <div className={`rounded-xl shadow-sm border p-4 ${
                transactionState.status === 'success' 
                  ? (isDarkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200')
                  : transactionState.status === 'error'
                  ? (isDarkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200')
                  : (isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200')
              }`}>
                <div className="flex items-center gap-3">
                  {transactionState.status === 'pending' && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                  {transactionState.status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {transactionState.status === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  <p className={`text-sm font-medium ${
                    transactionState.status === 'success' 
                      ? (isDarkMode ? 'text-green-400' : 'text-green-800')
                      : transactionState.status === 'error'
                      ? (isDarkMode ? 'text-red-400' : 'text-red-800')
                      : (isDarkMode ? 'text-blue-400' : 'text-blue-800')
                  }`}>
                    {transactionState.message}
                  </p>
                </div>
              </div>
            )}


            {/* View Mode Toggle & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className={`inline-flex rounded-xl border p-1 ${
                isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'
              }`}>
                <button
                  onClick={() => { setViewMode('owned'); setSelectedTokens([]); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    viewMode === 'owned'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-white/70')
                  }`}
                >
                  Available ({ownedNFTs.filter(nft => !nft.isStaked).length})
                </button>
                <button
                  onClick={() => { setViewMode('staked'); setSelectedTokens([]); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    viewMode === 'staked'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm'
                      : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-white/70')
                  }`}
                >
                  Staked ({stakingStats.totalStaked})
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSelectAll}
                  disabled={loading || getFilteredNFTs().length === 0}
                  className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500' 
                      : 'border-gray-300 text-gray-700 hover:bg-white/70 hover:border-gray-400 hover:shadow-sm'
                  }`}
                >
                  {selectedTokens.length === getFilteredNFTs().length ? 'Deselect All' : 'Select All'}
                </button>
                
                {viewMode === 'owned' ? (
                  <button
                    onClick={handleStake}
                    disabled={selectedTokens.length === 0 || transactionState.status === 'pending'}
                    className={`px-6 py-2 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedTokens.length > 0 && transactionState.status !== 'pending'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:scale-105 shadow-lg hover:shadow-blue-500/25'
                        : 'bg-gray-300 text-gray-500'
                    }`}
                  >
                    {transactionState.status === 'pending' && transactionState.type === 'stake' ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Staking...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Lock className="w-4 h-4" />
                        <span>Stake Selected ({selectedTokens.length})</span>
                      </div>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleUnstake}
                    disabled={selectedTokens.length === 0 || transactionState.status === 'pending'}
                    className={`px-6 py-2 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedTokens.length > 0 && transactionState.status !== 'pending'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:scale-105 shadow-lg hover:shadow-orange-500/25'
                        : 'bg-gray-300 text-gray-500'
                    }`}
                  >
                    {transactionState.status === 'pending' && transactionState.type === 'unstake' ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Unstaking...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Unlock className="w-4 h-4" />
                        <span>Unstake Selected ({selectedTokens.length})</span>
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* NFT Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                <p className={`ml-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading NFTs and metadata...
                </p>
              </div>
            ) : getFilteredNFTs().length === 0 ? (
              <div className={`text-center py-12 rounded-xl border ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  {viewMode === 'owned' ? (
                    <Coins className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  ) : (
                    <Lock className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  )}
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {viewMode === 'owned' ? 'No Available NFTs' : 'No Staked NFTs'}
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {viewMode === 'owned' 
                    ? 'You don\'t have any NFTs available for staking. All your NFTs are already staked!' 
                    : 'You haven\'t staked any NFTs yet. Start earning 10 points per day by staking your Shellies!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {getFilteredNFTs().map((nft) => (
                  <div
                    key={nft.tokenId}
                    onClick={() => handleTokenSelection(nft.tokenId, !selectedTokens.includes(nft.tokenId))}
                    className={`group relative rounded-2xl border-2 p-4 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                      selectedTokens.includes(nft.tokenId)
                        ? viewMode === 'owned'
                          ? (isDarkMode ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-500/20' : 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20')
                          : (isDarkMode ? 'border-orange-500 bg-orange-900/20 shadow-lg shadow-orange-500/20' : 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-500/20')
                        : (isDarkMode ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500' : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm')
                    }`}
                  >
                    {/* Selection Indicator */}
                    <div style={{zIndex: 50}} className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedTokens.includes(nft.tokenId)
                        ? viewMode === 'owned'
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-orange-500 border-orange-500'
                        : (isDarkMode ? 'border-gray-500' : 'border-gray-300')
                    }`}>
                      {selectedTokens.includes(nft.tokenId) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>

                    {/* NFT Image */}
                    <div className={`w-full aspect-square rounded-lg mb-3 overflow-hidden relative ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      <NFTImage 
                        src={nft.image}
                        alt={nft.name || `Shellie #${nft.tokenId}`}
                        tokenId={nft.tokenId}
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    {/* Token Info */}
                    <div className="text-center">
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {nft.name || `Shellie #${nft.tokenId}`}
                      </p>
                      <div className="flex flex-col items-center gap-1 mt-1">
                        {nft.isStaked ? (
                          nft.stakeInfo && (
                            <StakingTimer
                              lockPeriod={nft.stakeInfo.lockPeriod as LockPeriod}
                              initialTimeRemaining={nft.stakeInfo.timeRemaining}
                              canUnstake={nft.stakeInfo.canUnstake}
                              isDarkMode={isDarkMode}
                            />
                          )
                        ) : (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500" />
                            <span className="text-xs text-yellow-600 font-medium">+10/day</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </main>
      </div>

      {/* Approval + Stake Modal */}
      <ApprovalStakeModal
        isOpen={showApprovalModal}
        onClose={handleModalClose}
        selectedTokens={selectedTokens}
        stakingContractAddress={stakingContractAddress || ''}
        nftContractAddress={nftContractAddress || ''}
        isDarkMode={isDarkMode}
        onSuccess={handleModalSuccess}
        userAddress={address || ''}
      />

      {/* Staking Period Selection Modal */}
      <StakingPeriodModal
        isOpen={showStakingModal}
        onClose={handleStakingModalClose}
        selectedTokens={selectedTokens}
        stakingContractAddress={stakingContractAddress || ''}
        isDarkMode={isDarkMode}
        onSuccess={handleStakingModalSuccess}
        userAddress={address || ''}
      />
    </div>
  );
}