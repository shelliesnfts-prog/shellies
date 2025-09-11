'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { Trophy, Star, TrendingUp, Loader2, CheckCircle, AlertTriangle, Coins, Lock, Unlock, Shield } from 'lucide-react';
import { NFTService } from '@/lib/nft-service';
import { StakingService } from '@/lib/staking-service';
import { ImageUtils } from '@/lib/image-utils';
import { staking_abi } from '@/lib/staking-abi';
import { erc721Abi } from 'viem';
import { parseContractError } from '@/lib/errors';
import { useDashboard } from '@/hooks/useDashboard';
import { usePoints } from '@/contexts/PointsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { StakingPageSkeleton } from '@/components/portal/StakingPageSkeleton';

interface NFTToken {
  tokenId: number;
  isStaked: boolean;
  selected?: boolean;
  name?: string;
  image?: string;
  metadata?: {
    name?: string;
    image?: string;
    description?: string;
    attributes?: any[];
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
      console.log(`Trying fallback ${currentFallbackIndex + 1}/${fallbackUrls.length} for token ${tokenId}:`, nextUrl);
      setCurrentSrc(nextUrl);
      setCurrentFallbackIndex(prev => prev + 1);
      setImageState('loading');
    } else {
      console.warn(`All image sources failed for token ${tokenId}`);
      setImageState('error');
    }
  }, [currentFallbackIndex, fallbackUrls, tokenId]);

  const handleLoad = useCallback(() => {
    setImageState('loaded');
  }, []);

  const handleError = useCallback(() => {
    console.warn(`Failed to load image for token ${tokenId}:`, currentSrc);
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
  const [stakingClaimMessage, setStakingClaimMessage] = useState<string>('');

  // Get global points context early
  const { user, claimStatus, loading: dashboardLoading, canPerformStaking, executeStakingClaim } = usePoints();

  // Countdown timer state for staking claims
  const [countdownTime, setCountdownTime] = useState(0);

  // Live countdown timer effect
  useEffect(() => {
    if (claimStatus && claimStatus.secondsUntilNextClaim > 0 && !canPerformStaking) {
      setCountdownTime(claimStatus.secondsUntilNextClaim);
      
      const timer = setInterval(() => {
        setCountdownTime(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setCountdownTime(0);
    }
  }, [claimStatus?.secondsUntilNextClaim, canPerformStaking, claimStatus]);

  // Format countdown timer
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return null;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`;
  };

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
      console.log('Transaction receipt received:', txReceipt);
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
          setTimeout(async () => {
            try {
              // Clear all relevant caches to force fresh data
              NFTService.clearOwnedTokensCache(address);
              StakingService.clearCache(address);
              
              // Clear selected tokens first
              setSelectedTokens([]);
              
              // Fetch fresh data
              await fetchUserData();
              
              // Automatically claim staking rewards if user can claim
              if (canPerformStaking && transactionState.type === 'stake') {
                try {
                  console.log('Attempting to automatically claim staking rewards...');
                  const claimResult = await executeStakingClaim();
                  
                  if (claimResult.success) {
                    setStakingClaimMessage(`🎉 Successfully claimed ${claimResult.pointsAdded} points from ${claimResult.stakedNFTCount} staked NFTs!`);
                    console.log('Auto-claim successful:', claimResult);
                    
                    // Clear message after 8 seconds
                    setTimeout(() => {
                      setStakingClaimMessage('');
                    }, 8000);
                  } else {
                    console.log('Auto-claim failed:', claimResult.error);
                    // Don't show error to user - staking was successful, claim can be done later
                  }
                } catch (error) {
                  console.error('Error during auto-claim:', error);
                  // Don't show error to user - staking was successful
                }
              }
              
              // Broadcast points update to refresh dashboard
              window.dispatchEvent(new CustomEvent('stakingUpdated', { 
                detail: { walletAddress: address }
              }));
              
              setTransactionState({ type: null, status: 'idle', message: '' });
              setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
            } catch (error) {
              console.error('Error refreshing data after transaction:', error);
              setTransactionState({ 
                type: null, 
                status: 'error', 
                message: 'Transaction succeeded but failed to refresh data. Please reload the page.' 
              });
            }
          }, 2000);
        }
      } else {
        console.error('Transaction failed with receipt:', txReceipt);
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
        console.warn('Transaction taking too long, showing timeout warning');
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
      console.error('Transaction error from useWaitForTransactionReceipt:', txError);
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
    setStakingClaimMessage('');
    setLoading(false);
  };

  const fetchUserData = async () => {
    if (!address) return;

    try {
      setLoading(true);
      
      // Fetch staking stats and NFTs in parallel for better performance
      console.log('Fetching staking stats and NFTs from explorer API...');
      
      const [stats, nftsWithMetadata] = await Promise.all([
        StakingService.getStakingStats(address),
        NFTService.getNFTsWithMetadata(address)
      ]);
      
      setStakingStats(stats);
      
      // Combine owned NFTs from explorer API with staking status
      const allTokensMap = new Map<number, NFTToken>();
      
      // Add owned NFTs from explorer API (filtered to Shellies collection only)
      for (const nft of nftsWithMetadata) {
        allTokensMap.set(nft.tokenId, {
          tokenId: nft.tokenId,
          isStaked: stats.stakedTokenIds.includes(nft.tokenId),
          name: nft.name,
          image: nft.image,
          metadata: nft.metadata
        });
      }
      
      // Add any staked tokens that weren't in the API response (edge case - transferred while staked)
      for (const stakedTokenId of stats.stakedTokenIds) {
        if (!allTokensMap.has(stakedTokenId)) {
          allTokensMap.set(stakedTokenId, {
            tokenId: stakedTokenId,
            isStaked: true,
            name: `Shellie #${stakedTokenId}`
          });
        }
      }
      
      const nftTokens = Array.from(allTokensMap.values()).sort((a, b) => a.tokenId - b.tokenId);
      
      setOwnedNFTs(nftTokens);
      setSelectedTokens([]);
      
      console.log(`✅ Loaded ${nftTokens.length} Shellies NFTs using explorer API!`);
      
    } catch (error) {
      console.error('Error fetching user data:', error);
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
      
      console.log('NFT approval check result:', approvalResult);
      return approvalResult;
    } catch (error) {
      console.error('Error checking NFT approvals:', error);
      return { approved: [], needApproval: tokenIds };
    }
  };

  const handleApproveAll = async () => {
    if (!address || !stakingContractAddress || !nftContractAddress) {
      console.error('Missing required data for approval');
      return;
    }

    console.log('🔄 Starting approval transaction...');
    
    try {
      setTransactionState({ type: 'approve', status: 'pending', message: 'Requesting approval for all NFTs...' });

      const hash = await writeContractAsync({
        address: nftContractAddress as `0x${string}`,
        abi: erc721Abi,
        functionName: 'setApprovalForAll',
        args: [stakingContractAddress as `0x${string}`, true],
      });

      console.log('✅ Approval transaction submitted!');
      console.log('Transaction hash:', hash);

      setTransactionState({
        type: 'approve',
        status: 'pending',
        message: 'Approval transaction submitted, waiting for confirmation...',
        hash
      });

    } catch (error: any) {
      console.error('❌ Approval transaction failed:', error);
      
      let errorMessage = 'Failed to approve NFTs';
      if (error?.message?.includes('User rejected')) {
        errorMessage = 'Approval was cancelled by user';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else {
        errorMessage = parseContractError(error) || error?.message?.slice(0, 100) || 'Failed to approve NFTs';
      }

      setTransactionState({ type: 'approve', status: 'error', message: errorMessage });
      
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 8000);
    }
  };

  const handleStake = async () => {
    if (!selectedTokens.length || !address || !stakingContractAddress) {
      console.error('Missing required data for staking:', { 
        selectedTokens: selectedTokens.length, 
        address, 
        stakingContractAddress 
      });
      return;
    }

    console.log('🔄 Starting stake process...');
    console.log('Selected tokens:', selectedTokens);
    console.log('User address:', address);
    console.log('Staking contract:', stakingContractAddress);

    try {
      setTransactionState({ type: 'stake', status: 'pending', message: 'Checking NFT ownership and approvals...' });

      // Check if user owns these NFTs first
      console.log('⚠️ Verifying NFT ownership before staking...');
      const ownedTokens = ownedNFTs.filter(nft => !nft.isStaked).map(nft => nft.tokenId);
      const invalidTokens = selectedTokens.filter(id => !ownedTokens.includes(id));
      
      if (invalidTokens.length > 0) {
        console.error('❌ Invalid tokens selected:', invalidTokens);
        setTransactionState({ 
          type: 'stake', 
          status: 'error', 
          message: `Invalid tokens selected: ${invalidTokens.join(', ')}` 
        });
        return;
      }

      // Check NFT approvals
      console.log('🔍 Checking NFT approvals...');
      setApprovalState({ needed: false, checking: true, tokensNeedingApproval: [] });
      
      const { approved, needApproval } = await checkNFTApprovals(selectedTokens);
      
      if (needApproval.length > 0) {
        console.log('⚠️ NFT approval required for tokens:', needApproval);
        setApprovalState({ 
          needed: true, 
          checking: false, 
          tokensNeedingApproval: needApproval 
        });
        setTransactionState({ 
          type: null, 
          status: 'error', 
          message: `Please approve the staking contract to access your NFTs first. Click "Approve All NFTs" below.` 
        });
        return;
      }

      console.log('✅ All NFTs approved, proceeding with staking...');
      setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
      
      const tokenIds = selectedTokens.map(id => BigInt(id));
      console.log('Token IDs as BigInt:', tokenIds);
      
      setTransactionState({ type: 'stake', status: 'pending', message: 'Submitting staking transaction...' });
      
      const hash = await writeContractAsync({
        address: stakingContractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'stakeBatch',
        args: [tokenIds],
      });

      console.log('✅ Staking transaction submitted successfully!');
      console.log('Transaction hash:', hash);

      setTransactionState({
        type: 'stake',
        status: 'pending',
        message: 'Staking transaction submitted, waiting for confirmation...',
        hash
      });

    } catch (error: any) {
      console.error('❌ Staking process failed:', error);
      console.error('Error details:', {
        message: error?.message,
        cause: error?.cause,
        code: error?.code,
        data: error?.data,
        stack: error?.stack?.slice(0, 500)
      });
      
      let errorMessage = 'Failed to stake tokens';
      if (error?.message?.includes('block is out of range')) {
        errorMessage = 'Blockchain sync issue. Please try again in a moment.';
      } else if (error?.message?.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled by user';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else if (error?.message?.includes('nonce')) {
        errorMessage = 'Transaction nonce issue. Please try again.';
      } else {
        errorMessage = parseContractError(error) || error?.message?.slice(0, 100) || 'Failed to stake tokens';
      }

      setTransactionState({ type: 'stake', status: 'error', message: errorMessage });
      setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
      
      setTimeout(() => {
        setTransactionState({ type: null, status: 'idle', message: '' });
      }, 10000);
    }
  };

  const handleUnstake = async () => {
    if (!selectedTokens.length || !address || !stakingContractAddress) {
      console.error('Missing required data for unstaking:', { 
        selectedTokens: selectedTokens.length, 
        address, 
        stakingContractAddress 
      });
      return;
    }

    console.log('🔄 Starting unstake transaction...');
    console.log('Selected tokens:', selectedTokens);
    console.log('User address:', address);
    console.log('Staking contract:', stakingContractAddress);

    try {
      setTransactionState({ type: 'unstake', status: 'pending', message: 'Preparing transaction...' });

      const tokenIds = selectedTokens.map(id => BigInt(id));
      console.log('Token IDs as BigInt:', tokenIds);

      // Check if user actually has these tokens staked
      console.log('⚠️ Verifying staked NFTs before unstaking...');
      const stakedTokens = ownedNFTs.filter(nft => nft.isStaked).map(nft => nft.tokenId);
      const invalidTokens = selectedTokens.filter(id => !stakedTokens.includes(id));
      
      if (invalidTokens.length > 0) {
        console.error('❌ Invalid staked tokens selected:', invalidTokens);
        setTransactionState({ 
          type: 'unstake', 
          status: 'error', 
          message: `Tokens not staked: ${invalidTokens.join(', ')}` 
        });
        return;
      }

      console.log('✅ All tokens valid for unstaking, proceeding with transaction...');
      console.log('Transaction params:', {
        address: stakingContractAddress,
        functionName: 'unstakeBatch',
        args: [tokenIds],
        abiLength: staking_abi.length
      });
      
      const hash = await writeContractAsync({
        address: stakingContractAddress as `0x${string}`,
        abi: staking_abi,
        functionName: 'unstakeBatch',
        args: [tokenIds],
      });

      console.log('✅ Unstake transaction submitted successfully!');
      console.log('Transaction hash:', hash);

      setTransactionState({
        type: 'unstake',
        status: 'pending',
        message: 'Transaction submitted, waiting for confirmation...',
        hash
      });

    } catch (error: any) {
      console.error('❌ Unstaking transaction failed:', error);
      console.error('Error details:', {
        message: error?.message,
        cause: error?.cause,
        code: error?.code,
        data: error?.data,
        stack: error?.stack?.slice(0, 500)
      });
      
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

            {/* Staking Rewards Info Section */}
            {stakingStats.totalStaked > 0 && (
              <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' 
                  : 'bg-gradient-to-br from-white to-emerald-50/30 border-emerald-200/60 shadow-sm'
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-green-500/5 to-transparent" />
                <div className="relative p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <div className={`p-2 rounded-lg ${
                            isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'
                          }`}>
                            <Coins className="w-5 h-5 text-emerald-600" />
                          </div>
                          <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Daily Staking Rewards
                          </h3>
                          <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                            canPerformStaking
                              ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                              : (isDarkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-700')
                          }`}>
                            {canPerformStaking ? 'Ready' : 'Cooldown Active'}
                          </div>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Earning <span className="font-bold text-emerald-600">{stakingStats.dailyPoints} points daily</span> from your {stakingStats.totalStaked} staked NFT{stakingStats.totalStaked !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Countdown Timer when in cooldown */}
                    {!canPerformStaking && countdownTime > 0 && (
                      <div className={`p-4 rounded-xl border-2 border-dashed ${
                        isDarkMode 
                          ? 'border-orange-600/50 bg-orange-900/20' 
                          : 'border-orange-300/60 bg-orange-50/50'
                      }`}>
                        <div className="text-center">
                          <div className={`text-sm mb-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>
                            🚫 Staking/Unstaking locked for:
                          </div>
                          <div className={`font-mono text-2xl font-bold ${
                            isDarkMode ? 'text-orange-400' : 'text-orange-600'
                          }`}>
                            {formatCountdown(countdownTime)}
                          </div>
                          <div className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Wait for cooldown to end before staking/unstaking
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Success Message */}
                    {stakingClaimMessage && (
                      <div className={`p-3 rounded-lg border ${
                        isDarkMode ? 'bg-emerald-900/20 border-emerald-700 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        <p className="text-sm font-medium">
                          {stakingClaimMessage}
                        </p>
                      </div>
                    )}

                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      💡 Rewards are automatically claimed when you stake NFTs. 24-hour cooldown applies between operations.
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* Approval Required Notice */}
            {approvalState.needed && (
              <div className={`rounded-xl shadow-sm border p-4 ${
                isDarkMode ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className={`text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-800'
                    }`}>
                      NFT Approval Required
                    </p>
                    <p className={`text-sm mb-3 ${
                      isDarkMode ? 'text-orange-300' : 'text-orange-700'
                    }`}>
                      To stake your NFTs, you need to approve the staking contract to access them. 
                      This is a one-time approval for all your NFTs.
                    </p>
                    <button
                      onClick={handleApproveAll}
                      disabled={transactionState.status === 'pending'}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        isDarkMode
                          ? 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-700'
                          : 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-400'
                      }`}
                    >
                      {transactionState.status === 'pending' && transactionState.type === 'approve' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2 inline" />
                          Approve All NFTs
                        </>
                      )}
                    </button>
                  </div>
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
                      ? 'bg-blue-600 text-white shadow-sm'
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
                    disabled={selectedTokens.length === 0 || transactionState.status === 'pending' || !canPerformStaking}
                    className={`px-6 py-2 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedTokens.length > 0 && transactionState.status !== 'pending' && canPerformStaking
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:scale-105 shadow-lg hover:shadow-blue-500/25'
                        : 'bg-gray-300 text-gray-500'
                    }`}
                    title={!canPerformStaking ? 'Staking is disabled during 24h cooldown period' : ''}
                  >
                    {transactionState.status === 'pending' && transactionState.type === 'stake' ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Staking...</span>
                      </div>
                    ) : !canPerformStaking ? (
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4" />
                        <span>Locked ({selectedTokens.length})</span>
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
                    disabled={selectedTokens.length === 0 || transactionState.status === 'pending' || !canPerformStaking}
                    className={`px-6 py-2 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedTokens.length > 0 && transactionState.status !== 'pending' && canPerformStaking
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:scale-105 shadow-lg hover:shadow-orange-500/25'
                        : 'bg-gray-300 text-gray-500'
                    }`}
                    title={!canPerformStaking ? 'Unstaking is disabled during 24h cooldown period' : ''}
                  >
                    {transactionState.status === 'pending' && transactionState.type === 'unstake' ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Unstaking...</span>
                      </div>
                    ) : !canPerformStaking ? (
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4" />
                        <span>Locked ({selectedTokens.length})</span>
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
                        ? (isDarkMode ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-500/20' : 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20')
                        : (isDarkMode ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500' : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm')
                    }`}
                  >
                    {/* Selection Indicator */}
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedTokens.includes(nft.tokenId)
                        ? 'bg-blue-500 border-blue-500'
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
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {nft.isStaked ? (
                          <>
                            <Lock className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-blue-500 font-medium">Staked</span>
                          </>
                        ) : (
                          <>
                            <Star className="w-3 h-3 text-yellow-500" />
                            <span className="text-xs text-yellow-600 font-medium">+10/day</span>
                          </>
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
    </div>
  );
}