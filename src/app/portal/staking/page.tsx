'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { Trophy, Star, TrendingUp, Loader2, CheckCircle, AlertTriangle, Coins, Lock, Unlock, Shield } from 'lucide-react';
import { NFTService } from '@/lib/nft-service';
import { StakingService } from '@/lib/staking-service';
import { staking_abi } from '@/lib/staking-abi';
import { erc721Abi } from 'viem';
import { parseContractError } from '@/lib/errors';
import { useDashboard } from '@/hooks/useDashboard';

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

export default function StakingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { data: txReceipt, isLoading: isTxLoading, error: txError } = useWaitForTransactionReceipt({
    hash: transactionState.hash as `0x${string}` | undefined,
  });
  const { user, loading: dashboardLoading } = useDashboard();

  const stakingContractAddress = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
  const nftContractAddress = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS;

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

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
          setTimeout(() => {
            fetchUserData();
            setTransactionState({ type: null, status: 'idle', message: '' });
            setApprovalState({ needed: false, checking: false, tokensNeedingApproval: [] });
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
    setLoading(false);
  };

  const fetchUserData = async () => {
    if (!address) return;

    try {
      setLoading(true);
      
      // Fetch staking stats
      console.log('Fetching staking stats...');
      const stats = await StakingService.getStakingStats(address);
      setStakingStats(stats);
      
      // Add delay between calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch owned NFT token IDs
      console.log('Fetching owned NFT token IDs...');
      const ownedTokenIds = await NFTService.getOwnedTokenIds(address);
      
      // Combine owned and staked tokens with their status
      const allTokenIds = new Set([...ownedTokenIds, ...stats.stakedTokenIds]);
      const nftTokens: NFTToken[] = [];
      
      console.log(`Loading metadata for ${allTokenIds.size} NFTs...`);
      
      // Load metadata for each token (with rate limiting)
      for (const tokenId of Array.from(allTokenIds).sort((a, b) => a - b)) {
        try {
          const metadata = await NFTService.getNFTMetadata(tokenId);
          nftTokens.push({
            tokenId,
            isStaked: stats.stakedTokenIds.includes(tokenId),
            name: metadata.name,
            image: metadata.image,
            metadata
          });
          
          // Add small delay between metadata calls
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (metadataError) {
          console.error(`Failed to load metadata for token ${tokenId}:`, metadataError);
          // Add token without metadata
          nftTokens.push({
            tokenId,
            isStaked: stats.stakedTokenIds.includes(tokenId),
            name: `Shellie #${tokenId}`
          });
        }
      }

      setOwnedNFTs(nftTokens);
      setSelectedTokens([]);
      
      console.log(`Successfully loaded ${nftTokens.length} NFTs with metadata`);
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
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
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
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PortalSidebar
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4 min-h-screen">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 mt-16 lg:mt-0 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  NFT Staking
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Stake your Shellies NFTs to earn 10 points per day for each staked NFT
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* NFTs Staked */}
              <div className={`rounded-xl shadow-sm border p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      NFTs Staked
                    </p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {stakingStats.totalStaked}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'
                  }`}>
                    <Lock className={`w-5 h-5 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                  </div>
                </div>
              </div>

              {/* Available NFTs */}
              <div className={`rounded-xl shadow-sm border p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Available NFTs
                    </p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {ownedNFTs.filter(nft => !nft.isStaked).length}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDarkMode ? 'bg-green-900/20' : 'bg-green-50'
                  }`}>
                    <TrendingUp className={`w-5 h-5 ${
                      isDarkMode ? 'text-green-400' : 'text-green-600'
                    }`} />
                  </div>
                </div>
              </div>

              {/* Total Points */}
              <div className={`rounded-xl shadow-sm border p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total Points
                    </p>
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {dashboardLoading ? '...' : (user?.points || 0)}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'
                  }`}>
                    <Star className={`w-5 h-5 ${
                      isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                    }`} />
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
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => { setViewMode('owned'); setSelectedTokens([]); }}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                    viewMode === 'owned'
                      ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white')
                      : (isDarkMode ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-white text-gray-700 hover:bg-gray-50')
                  }`}
                >
                  Available NFTs ({ownedNFTs.filter(nft => !nft.isStaked).length})
                </button>
                <button
                  onClick={() => { setViewMode('staked'); setSelectedTokens([]); }}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg border-l transition-colors ${
                    viewMode === 'staked'
                      ? (isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-600 text-white border-blue-500')
                      : (isDarkMode ? 'bg-gray-800 text-gray-400 hover:text-white border-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200')
                  }`}
                >
                  Staked NFTs ({stakingStats.totalStaked})
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  disabled={loading || getFilteredNFTs().length === 0}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  {selectedTokens.length === getFilteredNFTs().length ? 'Deselect All' : 'Select All'}
                </button>
                
                {viewMode === 'owned' ? (
                  <button
                    onClick={handleStake}
                    disabled={selectedTokens.length === 0 || transactionState.status === 'pending'}
                    className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      isDarkMode
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
                    }`}
                  >
                    {transactionState.status === 'pending' && transactionState.type === 'stake' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                        Staking...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2 inline" />
                        Stake Selected ({selectedTokens.length})
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleUnstake}
                    disabled={selectedTokens.length === 0 || transactionState.status === 'pending'}
                    className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      isDarkMode
                        ? 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-700'
                        : 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-400'
                    }`}
                  >
                    {transactionState.status === 'pending' && transactionState.type === 'unstake' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                        Unstaking...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 mr-2 inline" />
                        Unstake Selected ({selectedTokens.length})
                      </>
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
                    className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all hover:scale-105 ${
                      selectedTokens.includes(nft.tokenId)
                        ? (isDarkMode ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50')
                        : (isDarkMode ? 'border-gray-600 bg-gray-800 hover:border-gray-500' : 'border-gray-200 bg-white hover:border-gray-300')
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
                    <div className={`w-full aspect-square rounded-lg mb-3 overflow-hidden ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      {nft.image ? (
                        <img 
                          src={nft.image} 
                          alt={nft.name || `Shellie #${nft.tokenId}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to placeholder on image load error
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLDivElement;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center ${nft.image ? 'hidden' : 'flex'}`}
                        style={{ display: nft.image ? 'none' : 'flex' }}
                      >
                        <Trophy className={`w-8 h-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
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
        </main>
      </div>
    </div>
  );
}