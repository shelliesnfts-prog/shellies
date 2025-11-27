'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useRouter } from 'next/navigation';
import { RaffleContractService, type PrizeToken } from '@/lib/raffle-contract';
import { 
  Users, 
  Gift, 
  LogOut,
  Square,
  Sun,
  X,
  MoreHorizontal,
  Eye,
  EyeOff,
  Plus,
  ExternalLink
} from 'lucide-react';
import { formatDate, isRaffleActive, localDateTimeInputToUTC } from '@/lib/dateUtils';
import { parseTokenAmount, formatTokenDisplay, isValidTokenAmount } from '@/lib/token-utils';
import RaffleDeploymentModal from '@/components/RaffleDeploymentModal';
import RaffleEndingModal from '@/components/RaffleEndingModal';

export default function AdminRafflesPage() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { data: session } = useSession();
  const { address } = useAccount();
  const router = useRouter();
  const { writeContractAsync } = useWriteContract();
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRaffle, setShowCreateRaffle] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRaffles, setTotalRaffles] = useState(0);
  const [rafflesPerPage] = useState(9); // 3x3 grid
  
  const [endRaffleMessage, setEndRaffleMessage] = useState<{ type: 'success' | 'error'; text: string; txHash?: string } | null>(null);
  
  // Create Raffle Modal State
  const [raffleForm, setRaffleForm] = useState({
    title: '',
    description: '',
    image_url: '',
    points_per_ticket: '',
    max_tickets_per_user: '',
    max_participants: '',
    end_date: '',
    // Prize fields
    prize_type: 'NFT', // 'NFT' or 'ERC20'
    prize_token_address: '',
    prize_token_id: '', // For NFT
    prize_amount: '', // For ERC20
  });
  const [creatingRaffle, setCreatingRaffle] = useState(false);
  const [prizeInfo, setPrizeInfo] = useState<any>(null);
  const [validatingPrize, setValidatingPrize] = useState(false);
  const [tokenDecimals, setTokenDecimals] = useState<number>(18); // Store token decimals for conversion

  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [pendingRaffle, setPendingRaffle] = useState<any>(null);

  // Admin Raffle Ending State
  const [showEndingModal, setShowEndingModal] = useState(false);
  const [endingRaffle, setEndingRaffle] = useState<any>(null);

  // Get wallet address
  const walletAddress = address || session?.address || '';

  // Fetch raffles with pagination
  const fetchRaffles = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/raffles?page=${page}&limit=${rafflesPerPage}`);
      if (response.ok) {
        const data = await response.json();
        // Server now returns proper paginated response: { raffles: [...], total: number, page: number }
        setRaffles(data.raffles);
        setTotalRaffles(data.total);
        setCurrentPage(data.page);
      }
    } catch (error) {
      console.error('Error fetching raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Validate prize token
  const validatePrize = async () => {
    if (!raffleForm.prize_token_address || !walletAddress) {
      setPrizeInfo(null);
      return;
    }

    if (!RaffleContractService.isValidAddress(raffleForm.prize_token_address)) {
      setPrizeInfo({ error: 'Invalid token address format' });
      return;
    }

    try {
      setValidatingPrize(true);

      if (raffleForm.prize_type === 'NFT') {
        if (!raffleForm.prize_token_id) {
          setPrizeInfo({ error: 'Token ID is required for NFTs' });
          return;
        }

        const [ownsNFT, tokenURI] = await Promise.all([
          RaffleContractService.checkNFTOwnership(
            walletAddress,
            raffleForm.prize_token_address,
            raffleForm.prize_token_id
          ),
          RaffleContractService.getNFTTokenURI(
            raffleForm.prize_token_address,
            raffleForm.prize_token_id
          )
        ]);

        if (!ownsNFT) {
          setPrizeInfo({ error: 'You do not own this NFT' });
          return;
        }

        setPrizeInfo({
          type: 'NFT',
          tokenId: raffleForm.prize_token_id,
          tokenURI,
          owned: true
        });
      } else {
        if (!raffleForm.prize_amount) {
          setPrizeInfo({ error: 'Amount is required for ERC20 tokens' });
          return;
        }

        const tokenInfo = await RaffleContractService.getERC20Info(raffleForm.prize_token_address);
        if (!tokenInfo) {
          setPrizeInfo({ error: 'Failed to fetch token information' });
          return;
        }

        // Store token decimals for conversion
        setTokenDecimals(tokenInfo.decimals);

        // Convert human-readable amount to wei for balance check only
        const weiAmount = parseTokenAmount(raffleForm.prize_amount, tokenInfo.decimals);
        const hasBalance = await RaffleContractService.checkERC20Balance(
          walletAddress,
          raffleForm.prize_token_address,
          weiAmount
        );

        if (!hasBalance) {
          setPrizeInfo({ error: 'Insufficient token balance' });
          return;
        }

        setPrizeInfo({
          type: 'ERC20',
          amount: raffleForm.prize_amount,
          weiAmount: weiAmount,
          ...tokenInfo,
          hasBalance: true
        });
      }
    } catch (error) {
      console.error('Error validating prize:', error);
      setPrizeInfo({ error: 'Error validating prize token' });
    } finally {
      setValidatingPrize(false);
    }
  };

  // Create raffle with admin wallet
  const createRaffleWithAdminWallet = async () => {
    if (!raffleForm.title || !raffleForm.description || !raffleForm.points_per_ticket || 
        !raffleForm.max_tickets_per_user || !raffleForm.end_date) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate end date is in the future
    const endDate = new Date(raffleForm.end_date);
    const now = new Date();
    if (endDate <= now) {
      alert('End date must be in the future to avoid wasting gas on a transaction that will fail');
      return;
    }

    if (!raffleForm.prize_token_address) {
      alert('Please specify a prize token');
      return;
    }

    if (raffleForm.prize_type === 'NFT' && !raffleForm.prize_token_id) {
      alert('Please specify the NFT token ID');
      return;
    }

    if (raffleForm.prize_type === 'ERC20' && (!raffleForm.prize_amount || !isValidTokenAmount(raffleForm.prize_amount))) {
      alert('Please specify a valid token amount');
      return;
    }

    if (!prizeInfo || prizeInfo.error) {
      alert('Please validate the prize token first');
      return;
    }

    try {
      setCreatingRaffle(true);
      
      // Convert datetime-local value to UTC for proper storage
      const utcDateTime = localDateTimeInputToUTC(raffleForm.end_date);
      
      const response = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_admin_wallet',
          raffleData: {
            title: raffleForm.title,
            description: raffleForm.description,
            image_url: raffleForm.image_url || null,
            points_per_ticket: parseInt(raffleForm.points_per_ticket),
            max_tickets_per_user: parseInt(raffleForm.max_tickets_per_user),
            max_participants: raffleForm.max_participants ? parseInt(raffleForm.max_participants) : null,
            end_date: utcDateTime,
            prize_token_address: raffleForm.prize_token_address,
            prize_token_type: raffleForm.prize_type,
            prize_token_id: raffleForm.prize_type === 'NFT' ? raffleForm.prize_token_id : null,
            prize_amount: raffleForm.prize_type === 'ERC20' ? raffleForm.prize_amount : null,
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.flow === 'admin_wallet') {
          // Store the raffle for blockchain deployment
          setPendingRaffle(data.raffle);
          
          // Close create modal and show deployment modal
          setShowCreateRaffle(false);
          setShowDeploymentModal(true);
          
          // Reset form
          setRaffleForm({
            title: '',
            description: '',
            image_url: '',
            points_per_ticket: '',
            max_tickets_per_user: '',
            max_participants: '',
            end_date: '',
            prize_type: 'NFT',
            prize_token_address: '',
            prize_token_id: '',
            prize_amount: '',
          });
          setPrizeInfo(null);
          
        } else {
          alert(`Error: ${data.error || 'Unknown error occurred'}`);
        }
      } else {
        const errorData = await response.json();
        alert(`Error creating raffle: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating raffle with admin wallet:', error);
      alert('Error creating raffle');
    } finally {
      setCreatingRaffle(false);
    }
  };

  // Handle successful deployment
  const handleDeploymentSuccess = () => {
    setPendingRaffle(null);
    setShowDeploymentModal(false);
    fetchRaffles(currentPage); // Refresh raffle list
  };

  // Handle deployment modal close
  const handleDeploymentClose = () => {
    setShowDeploymentModal(false);
    setPendingRaffle(null);
  };

  // Admin wallet end raffle (new method)
  const endRaffleWithAdminWallet = (raffle: any) => {
    setEndingRaffle(raffle);
    setShowEndingModal(true);
  };

  // Handle successful ending
  const handleEndingSuccess = () => {
    setEndingRaffle(null);
    setShowEndingModal(false);
    fetchRaffles(currentPage); // Refresh raffle list
    setEndRaffleMessage({
      type: 'success',
      text: 'Raffle ended successfully! Winner has been selected and prize distributed.',
    });
  };

  // Handle ending modal close
  const handleEndingClose = () => {
    setShowEndingModal(false);
    setEndingRaffle(null);
  };

  // Toggle raffle visibility
  const toggleRaffleVisibility = async (raffleId: number, currentlyHidden: boolean) => {
    try {
      const response = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_visibility',
          raffleId,
          isHidden: !currentlyHidden
        })
      });

      if (response.ok) {
        fetchRaffles(currentPage); // Refresh raffle list
      }
    } catch (error) {
      console.error('Error toggling raffle visibility:', error);
    }
  };

  useEffect(() => {
    fetchRaffles(currentPage);
  }, [currentPage]);

  const handleLogout = () => {
    signOut();
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalRaffles / rafflesPerPage);

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Floating Sidebar */}
      <div className="relative">
        {/* Mobile backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed lg:relative top-4 left-4 h-[calc(100vh-2rem)] w-64
          ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          rounded-2xl shadow-xl border
          flex flex-col z-50 transition-all duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Top Section - Logo + Controls */}
          <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src="/shellies_icon.jpg"
                  alt="Shellies Logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              
              {/* Control buttons */}
              <div className="flex items-center space-x-2">
                {/* Theme toggle */}
                <button 
                  onClick={toggleDarkMode}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-gray-700" />
                  )}
                </button>
                
                {/* Close button - mobile only */}
                <button 
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md lg:hidden ${
                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Admin Card Section */}
          <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="relative group">
              {/* Admin Card with Red Gradient */}
              <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 h-[145px] relative overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105">
                {/* Shimmer overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
                
                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between">
                  {/* Top Row */}
                  <div className="flex items-start justify-between">
                    <h3 className="text-white text-xs font-bold">ADMIN PANEL</h3>
                    <button 
                      onClick={handleLogout}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                    >
                      <LogOut className="w-4 h-4 text-white/80 hover:text-white" />
                    </button>
                  </div>
                  
                  {/* Bottom Row */}
                  <div className="flex items-center">
                    <p className="text-white text-sm font-bold mr-2">
                      {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No wallet'}
                    </p>
                    <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      ADMIN
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1">
              {/* Raffles */}
              <li>
                <button
                  onClick={() => router.push('/admin/raffles')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <Gift className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Raffles</span>
                </button>
              </li>
              
              {/* Users */}
              <li>
                <button
                  onClick={() => router.push('/admin/users')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Users</span>
                </button>
              </li>
              
              {/* Withdrawals */}
              <li>
                <button
                  onClick={() => router.push('/admin/withdrawals')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Square className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Withdrawals</span>
                </button>
              </li>
              
              {/* XP Settings */}
              <li>
                <button
                  onClick={() => router.push('/admin/xp-settings')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Square className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">XP Settings</span>
                </button>
              </li>
              
              {/* Portal Link */}
              <li>
                <a
                  href="/portal/raffles"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <ExternalLink className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Portal</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
        
        {/* Mobile menu toggle button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`fixed top-6 left-6 w-10 h-10 rounded-lg shadow-md flex items-center justify-center lg:hidden z-30 ${
            isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4">
        {/* Content Area */}
        <main className="flex-1 p-3 lg:p-6 mt-16 lg:mt-0" style={{ marginLeft: '150px', marginRight: '150px' }}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Raffle Management</h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Create and manage raffle campaigns</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className={`px-3 py-1 rounded-full border ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-600 text-gray-300' 
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  <span className="text-xs font-medium">Total: {totalRaffles}</span>
                </div>
                <button
                  onClick={() => setShowCreateRaffle(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Raffle</span>
                </button>
              </div>
            </div>

            {/* End Raffle Feedback Message */}
            {endRaffleMessage && (
              <div className={`p-4 rounded-lg border flex items-start space-x-3 ${
                endRaffleMessage.type === 'success'
                  ? isDarkMode 
                    ? 'bg-green-900/20 border-green-800 text-green-300' 
                    : 'bg-green-50 border-green-200 text-green-800'
                  : isDarkMode
                    ? 'bg-red-900/20 border-red-800 text-red-300'
                    : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{endRaffleMessage.text}</span>
                    <button
                      onClick={() => setEndRaffleMessage(null)}
                      className="ml-4 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {endRaffleMessage.txHash && (
                    <div className="mt-2 text-xs opacity-75">
                      Transaction Hash: 
                      <span className="font-mono ml-1 break-all">{endRaffleMessage.txHash}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className={`${isDarkMode ? 'text-white' : 'text-gray-700'}`}>Loading raffles...</p>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {raffles.map((raffle: any) => (
                    <div key={raffle.id} className={`group rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="p-6">
                        <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{raffle.title}</h3>
                        <p className={`text-sm mb-4 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{raffle.description}</p>
                        <div className="space-y-2 text-sm">
                          <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span>Points per ticket:</span>
                            <span className="font-medium">{raffle.points_per_ticket.toFixed(1)}</span>
                          </div>
                          <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span>Max tickets:</span>
                            <span className="font-medium">{raffle.max_tickets_per_user}</span>
                          </div>
                          <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span>Max participants:</span>
                            <span className="font-medium">{raffle.max_participants || 'Unlimited'}</span>
                          </div>
                          <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span>End date:</span>
                            <span className="font-medium text-xs">{formatDate(raffle.end_date)}</span>
                          </div>
                          <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span>Prize:</span>
                            <span className="font-medium text-xs">
                              {raffle.prize_token_type === 'ERC20' && raffle.prize_amount ? 
                                `${raffle.prize_amount} tokens` : 
                                raffle.prize_token_type === 'NFT' ? 
                                  `NFT #${raffle.prize_token_id}` : 
                                  'Not set'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status:</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              raffle.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800 border-green-200' 
                                : raffle.status === 'COMPLETED'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : raffle.status === 'CANCELLED'
                                    ? 'bg-red-100 text-red-800 border-red-200'
                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                            }`}>
                              {raffle.status || 'CREATED'}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-4">
                          <button
                            onClick={() => toggleRaffleVisibility(raffle.id, raffle.is_hidden || false)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              raffle.is_hidden
                                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                            title={raffle.is_hidden ? 'Show in portal' : 'Hide from portal'}
                          >
                            {raffle.is_hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => endRaffleWithAdminWallet(raffle)}
                            disabled={
                              raffle.status === 'COMPLETED' || 
                              raffle.status === 'CANCELLED'
                            }
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              raffle.status === 'COMPLETED' || raffle.status === 'CANCELLED'
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700'
                            } text-white`}
                            title={
                              raffle.status === 'COMPLETED' 
                                ? 'Raffle already completed'
                                : raffle.status === 'CANCELLED'
                                  ? 'Raffle was cancelled'
                                  : 'End raffle using admin wallet (secure method)'
                            }
                          >
                            {raffle.status === 'COMPLETED'
                              ? 'Completed'
                              : raffle.status === 'CANCELLED'
                                ? 'Cancelled'
                                : 'End Raffle'
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={`flex justify-between items-center p-4 rounded-2xl shadow-sm border ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {raffles.length} of {totalRaffles} raffles
                      </span>
                    </div>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Create Raffle Modal */}
      {showCreateRaffle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl border w-full max-w-md ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Create New Raffle</h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Fill in the details for the new raffle</p>
              </div>
              <button
                onClick={() => setShowCreateRaffle(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                disabled={creatingRaffle}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Title *</label>
                <input
                  type="text"
                  value={raffleForm.title}
                  onChange={(e) => setRaffleForm({...raffleForm, title: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter raffle title"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Description *</label>
                <textarea
                  value={raffleForm.description}
                  onChange={(e) => setRaffleForm({...raffleForm, description: e.target.value})}
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter raffle description"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Image URL</label>
                <input
                  type="url"
                  value={raffleForm.image_url}
                  onChange={(e) => setRaffleForm({...raffleForm, image_url: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="https://example.com/image.jpg (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Points per Ticket *</label>
                  <input
                    type="number"
                    min="1"
                    value={raffleForm.points_per_ticket}
                    onChange={(e) => setRaffleForm({...raffleForm, points_per_ticket: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Max Tickets per User *</label>
                  <input
                    type="number"
                    min="1"
                    value={raffleForm.max_tickets_per_user}
                    onChange={(e) => setRaffleForm({...raffleForm, max_tickets_per_user: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="5"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Max Participants</label>
                <input
                  type="number"
                  min="1"
                  value={raffleForm.max_participants}
                  onChange={(e) => setRaffleForm({...raffleForm, max_participants: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Leave empty for unlimited"
                />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Maximum number of people who can join (optional)
                </p>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>End Date *</label>
                <input
                  type="datetime-local"
                  value={raffleForm.end_date}
                  onChange={(e) => setRaffleForm({...raffleForm, end_date: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* Prize Configuration Section */}
              <div className={`border-t pt-4 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                <h4 className={`text-md font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Prize Configuration</h4>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Prize Type *</label>
                  <select
                    value={raffleForm.prize_type}
                    onChange={(e) => {
                      setRaffleForm({...raffleForm, prize_type: e.target.value as 'NFT' | 'ERC20'});
                      setPrizeInfo(null);
                    }}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="NFT">NFT (ERC721)</option>
                    <option value="ERC20">Token (ERC20)</option>
                  </select>
                </div>

                <div className="mt-3">
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Token Contract Address *</label>
                  <input
                    type="text"
                    value={raffleForm.prize_token_address}
                    onChange={(e) => {
                      setRaffleForm({...raffleForm, prize_token_address: e.target.value});
                      setPrizeInfo(null);
                    }}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="0x..."
                  />
                </div>

                {raffleForm.prize_type === 'NFT' && (
                  <div className="mt-3">
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Token ID *</label>
                    <input
                      type="number"
                      value={raffleForm.prize_token_id}
                      onChange={(e) => {
                        setRaffleForm({...raffleForm, prize_token_id: e.target.value});
                        setPrizeInfo(null);
                      }}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      placeholder="1"
                      min="0"
                    />
                  </div>
                )}

                {raffleForm.prize_type === 'ERC20' && (
                  <div className="mt-3">
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Token Amount *
                    </label>
                    <input
                      type="text"
                      value={raffleForm.prize_amount}
                      onChange={(e) => {
                        setRaffleForm({...raffleForm, prize_amount: e.target.value});
                        setPrizeInfo(null);
                      }}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      placeholder="143 (human-readable format)"
                    />
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Enter the amount in tokens (e.g., 143), not in wei. The system will automatically convert it.
                    </p>
                  </div>
                )}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={validatePrize}
                    disabled={!raffleForm.prize_token_address || validatingPrize}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {validatingPrize ? 'Validating...' : 'Validate Prize'}
                  </button>
                </div>

                {prizeInfo && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    prizeInfo.error 
                      ? isDarkMode ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
                      : isDarkMode ? 'bg-green-900/20 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700'
                  }`}>
                    {prizeInfo.error ? (
                      <p className="text-sm">{prizeInfo.error}</p>
                    ) : (
                      <div className="text-sm space-y-1">
                        <p><strong>Type:</strong> {prizeInfo.type}</p>
                        {prizeInfo.type === 'NFT' ? (
                          <>
                            <p><strong>Token ID:</strong> {prizeInfo.tokenId}</p>
                            <p><strong>Owned:</strong> ✓ Yes</p>
                            {prizeInfo.tokenURI && (
                              <p><strong>Token URI:</strong> {prizeInfo.tokenURI.substring(0, 50)}...</p>
                            )}
                          </>
                        ) : (
                          <>
                            <p><strong>Amount:</strong> {prizeInfo.amount} {prizeInfo.symbol}</p>
                            <p><strong>Wei Amount:</strong> {prizeInfo.weiAmount}</p>
                            <p><strong>Balance:</strong> ✓ Sufficient</p>
                            {prizeInfo.name && <p><strong>Token:</strong> {prizeInfo.name}</p>}
                            <p className="text-xs opacity-75">
                              ✓ Amount will be converted to {prizeInfo.weiAmount} wei for blockchain storage
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className={`p-6 border-t flex space-x-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowCreateRaffle(false)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
                disabled={creatingRaffle}
              >
                Cancel
              </button>
              <button
                onClick={createRaffleWithAdminWallet}
                disabled={creatingRaffle}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                {creatingRaffle ? 'Creating...' : 'Create & Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Modal */}
      <RaffleDeploymentModal
        isOpen={showDeploymentModal}
        onClose={handleDeploymentClose}
        raffle={pendingRaffle}
        isDarkMode={isDarkMode}
        onSuccess={handleDeploymentSuccess}
      />

      {/* Ending Modal */}
      <RaffleEndingModal
        isOpen={showEndingModal}
        onClose={handleEndingClose}
        raffle={endingRaffle}
        isDarkMode={isDarkMode}
        onSuccess={handleEndingSuccess}
      />
    </div>
  );
}