'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { RaffleContractService, type PrizeToken } from '@/lib/raffle-contract';
import { 
  Users, 
  Gift, 
  ListChecks,
  LogOut,
  Square,
  Sun,
  X,
  MoreHorizontal,
  ChevronDown,
  Settings,
  HelpCircle,
  Bell,
  ImageOff,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  Plus,
  Copy,
  Edit
} from 'lucide-react';
import { formatDate, isRaffleActive, localDateTimeInputToUTC } from '@/lib/dateUtils';
import RaffleDeploymentModal from '@/components/RaffleDeploymentModal';
import RaffleEndingModal from '@/components/RaffleEndingModal';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { data: session } = useSession();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [users, setUsers] = useState([]);
  const [raffles, setRaffles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showCreateRaffle, setShowCreateRaffle] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [updatePoints, setUpdatePoints] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'active' | 'blocked'>('active');
  
  // End Raffle State (Legacy)
  const [legacyEndingRaffleId, setLegacyEndingRaffleId] = useState<string | null>(null);
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

  // Admin Wallet Flow State
  const [useAdminWallet, setUseAdminWallet] = useState(true);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [pendingRaffle, setPendingRaffle] = useState<any>(null);

  // Admin Raffle Ending State
  const [showEndingModal, setShowEndingModal] = useState(false);
  const [endingRaffle, setEndingRaffle] = useState<any>(null);

  // Get wallet address
  const walletAddress = address || session?.address || '';

  // Fetch users
  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users?page=${page}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setTotalUsers(data.total);
        setCurrentPage(data.page);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch raffles
  const fetchRaffles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/raffles');
      if (response.ok) {
        const data = await response.json();
        setRaffles(data);
      }
    } catch (error) {
      console.error('Error fetching raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch entries
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/entries');
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Toggle user block
  const toggleUserBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_block',
          userId,
          blocked: !currentBlocked
        })
      });

      if (response.ok) {
        fetchUsers(currentPage);
      }
    } catch (error) {
      console.error('Error toggling user block:', error);
    }
  };

  // Copy wallet address to clipboard
  const copyWalletAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      // You could add a toast notification here
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  // Open update modal
  const openUpdateModal = (user: any) => {
    setSelectedUser(user);
    setUpdatePoints(user.points.toString());
    setUpdateStatus(user.points < 0 ? 'blocked' : 'active');
    setShowUpdateModal(true);
  };

  // Update user
  const updateUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          userId: selectedUser.id,
          points: parseInt(updatePoints) || 0,
          status: updateStatus
        })
      });

      if (response.ok) {
        fetchUsers(currentPage);
        setShowUpdateModal(false);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          userId
        })
      });

      if (response.ok) {
        fetchUsers(currentPage);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
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

        const [hasBalance, tokenInfo] = await Promise.all([
          RaffleContractService.checkERC20Balance(
            walletAddress,
            raffleForm.prize_token_address,
            raffleForm.prize_amount
          ),
          RaffleContractService.getERC20Info(raffleForm.prize_token_address)
        ]);

        if (!hasBalance) {
          setPrizeInfo({ error: 'Insufficient token balance' });
          return;
        }

        setPrizeInfo({
          type: 'ERC20',
          amount: raffleForm.prize_amount,
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

  // Create raffle
  const createRaffle = async () => {
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

    if (raffleForm.prize_type === 'ERC20' && !raffleForm.prize_amount) {
      alert('Please specify the token amount');
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
          action: 'create',
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
        
        // Show appropriate success/error message based on blockchain status
        if (data.blockchainStatus === 'success') {
          alert(`Raffle created successfully! 

Database ID: ${data.id}
✅ Blockchain transactions completed!

Transaction hashes:
${data.transactionHashes ? data.transactionHashes.join('\n') : 'N/A'}

The raffle is now live and accepting entries!`);
        } else if (data.blockchainStatus === 'failed') {
          alert(`Raffle saved to database but blockchain interaction failed!

Database ID: ${data.id}
❌ Blockchain Error: ${data.blockchainError}

Please check the server logs and retry the blockchain deployment manually.`);
        } else {
          alert(`Raffle created successfully! Database ID: ${data.id}`);
        }
        
        
        fetchRaffles();
        setShowCreateRaffle(false);
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
        const errorData = await response.json();
        const rollbackMsg = errorData.rollbackStatus === 'success' 
          ? '\n✅ Database has been cleaned up.' 
          : errorData.rollbackStatus === 'failed' 
          ? '\n❌ Warning: Database cleanup failed - manual cleanup may be needed.' 
          : '';
        
        alert(`Error creating raffle: ${errorData.error || 'Unknown error'}

Details: ${errorData.details || 'No additional details'}${rollbackMsg}`);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      alert('Error creating raffle');
    } finally {
      setCreatingRaffle(false);
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

    if (raffleForm.prize_type === 'ERC20' && !raffleForm.prize_amount) {
      alert('Please specify the token amount');
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
    fetchRaffles(); // Refresh raffle list
  };

  // Handle deployment modal close
  const handleDeploymentClose = () => {
    setShowDeploymentModal(false);
    setPendingRaffle(null);
  };

  // End raffle early (legacy server method - deprecated)
  const endRaffleEarlyLegacy = async (raffleId: string) => {
    console.warn('🚨 Using deprecated server wallet ending method');
    
    if (!confirm('⚠️ You are using the deprecated server wallet ending method.\n\nFor better security, consider using the new Admin Wallet ending method.\n\nDo you want to continue with the server wallet method?')) {
      return;
    }

    setLegacyEndingRaffleId(raffleId);
    setEndRaffleMessage(null);

    try {
      const response = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end_early',
          raffleId
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEndRaffleMessage({
          type: 'success',
          text: 'Raffle ended successfully! Winner has been selected and prize distributed.',
          txHash: data.txHash
        });
        fetchRaffles();
      } else {
        setEndRaffleMessage({
          type: 'error',
          text: data.error || 'Failed to end raffle. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error ending raffle:', error);
      setEndRaffleMessage({
        type: 'error',
        text: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setLegacyEndingRaffleId(null);
    }
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
    fetchRaffles(); // Refresh raffle list
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

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'raffles') {
      fetchRaffles();
    } else if (activeTab === 'entries') {
      fetchEntries();
    }
  }, [activeTab]);

  const handleLogout = () => {
    signOut();
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };


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
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <Square className={`w-6 h-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
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
              {/* Users */}
              <li>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'users' 
                      ? isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      : isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Users</span>
                </button>
              </li>
              
              {/* Raffles */}
              <li>
                <button
                  onClick={() => setActiveTab('raffles')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'raffles' 
                      ? isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      : isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Gift className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Raffles</span>
                </button>
              </li>
              
              {/* Entries */}
              <li>
                <button
                  onClick={() => setActiveTab('entries')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === 'entries' 
                      ? isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      : isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <ListChecks className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Entries</span>
                </button>
              </li>
              
              {/* More Dropdown */}
              <li className="relative">
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isMoreOpen 
                      ? isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      : isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <MoreHorizontal className="w-5 h-5 mr-3" />
                  <span className="font-medium flex-1 text-sm">More</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown content */}
                {isMoreOpen && (
                  <div className="mt-2 ml-8 space-y-1 border-l-2 border-gray-100 pl-4">
                    <button className={`w-full flex items-center px-3 py-2 rounded-md text-left transition-all duration-200 ${
                      isDarkMode ? 'text-gray-500 hover:bg-gray-700 hover:text-gray-400' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}>
                      <Settings className="w-4 h-4 mr-3" />
                      <span className="text-xs font-medium">Settings</span>
                    </button>
                    <button className={`w-full flex items-center px-3 py-2 rounded-md text-left transition-all duration-200 ${
                      isDarkMode ? 'text-gray-500 hover:bg-gray-700 hover:text-gray-400' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}>
                      <Bell className="w-4 h-4 mr-3" />
                      <span className="text-xs font-medium">Notifications</span>
                    </button>
                    <button className={`w-full flex items-center px-3 py-2 rounded-md text-left transition-all duration-200 ${
                      isDarkMode ? 'text-gray-500 hover:bg-gray-700 hover:text-gray-400' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}>
                      <HelpCircle className="w-4 h-4 mr-3" />
                      <span className="text-xs font-medium">Help & Support</span>
                    </button>
                  </div>
                )}
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
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User Management</h1>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Manage user accounts, points, and permissions</p>
                </div>
                <div className={`px-3 py-1 rounded-full border ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-600 text-gray-300' 
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  <span className="text-xs font-medium">Total: {totalUsers}</span>
                </div>
              </div>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className={`${isDarkMode ? 'text-white' : 'text-gray-700'}`}>Loading users...</p>
                </div>
              ) : (
                <div className={`rounded-2xl shadow-sm border overflow-hidden ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Wallet Address</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Points</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Created</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Status</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user: any) => (
                          <tr key={user.id} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                            <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm">
                                  {user.wallet_address.slice(0, 12)}...{user.wallet_address.slice(-8)}
                                </span>
                                <button
                                  onClick={() => copyWalletAddress(user.wallet_address)}
                                  className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                  title="Copy wallet address"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-purple-600 font-medium">{user.points}</td>
                            <td className={`py-3 px-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.points < 0 
                                  ? 'bg-red-100 text-red-800 border border-red-200' 
                                  : 'bg-green-100 text-green-800 border border-green-200'
                              }`}>
                                {user.points < 0 ? 'Blocked' : 'Active'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => openUpdateModal(user)}
                                  className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                                  title="Update user"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteUser(user.id)}
                                  className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  <div className={`flex justify-between items-center p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <button
                      onClick={() => fetchUsers(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Previous
                    </button>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Page {currentPage}</span>
                    <button
                      onClick={() => fetchUsers(currentPage + 1)}
                      disabled={users.length < 20}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'raffles' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Raffle Management</h1>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Create and manage raffle campaigns</p>
                </div>
                <button
                  onClick={() => setShowCreateRaffle(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Raffle</span>
                </button>
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
                            <span className="font-medium">{raffle.points_per_ticket}</span>
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
                          {raffle.status !== 'COMPLETED' && raffle.status !== 'CANCELLED' && (
                            <button
                              onClick={() => endRaffleEarlyLegacy(raffle.id)}
                              disabled={legacyEndingRaffleId === raffle.id}
                              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                                legacyEndingRaffleId === raffle.id 
                                  ? 'bg-gray-400 cursor-not-allowed border-gray-400'
                                  : isDarkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600'
                                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
                              }`}
                              title="Use legacy server wallet method (deprecated)"
                            >
                              {legacyEndingRaffleId === raffle.id ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Ending...</span>
                                </div>
                              ) : (
                                'Legacy'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'entries' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Raffle Entries</h1>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>View all raffle entries and participants</p>
                </div>
              </div>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className={`${isDarkMode ? 'text-white' : 'text-gray-700'}`}>Loading entries...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12">
                  <ListChecks className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <h3 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No entries found</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No raffle entries have been submitted yet</p>
                </div>
              ) : (
                <div className={`rounded-2xl shadow-sm border overflow-hidden ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>User</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Raffle</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Tickets</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Points Spent</th>
                          <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Entry Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry: any) => (
                          <tr key={entry.id} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                            <td className={`py-3 px-4 font-mono text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                              {entry.user?.wallet_address?.slice(0, 12)}...{entry.user?.wallet_address?.slice(-8)}
                            </td>
                            <td className={`py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                              {entry.raffle?.title}
                            </td>
                            <td className="py-3 px-4 text-purple-600 font-medium">{entry.tickets_purchased || 1}</td>
                            <td className="py-3 px-4 text-blue-600 font-medium">{entry.points_spent || entry.raffle?.points_per_ticket}</td>
                            <td className={`py-3 px-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {new Date(entry.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Update User Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-xl border max-w-md w-full mx-4 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Update User</h3>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Update user points and status</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Points</label>
                <input
                  type="number"
                  value={updatePoints}
                  onChange={(e) => setUpdatePoints(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter points"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Status</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as 'active' | 'blocked')}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
            <div className={`p-6 border-t flex space-x-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowUpdateModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={updateUser}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

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
                
                {/* Deployment Method Selection */}
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Deployment Method *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deploymentMethod"
                        checked={useAdminWallet}
                        onChange={() => setUseAdminWallet(true)}
                        className="mr-3 text-purple-600"
                      />
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Admin Wallet (Default)
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Recommended</span>
                        </span>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Deploy directly from your wallet - more secure, you keep control of prizes.
                          Process: Create → Approve Token → Deploy → Activate
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deploymentMethod"
                        checked={!useAdminWallet}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const confirmed = confirm(
                              'Server Wallet deployment is deprecated and will be removed in future versions.\n\n' +
                              'This method requires the server to own your prizes and has security limitations.\n\n' +
                              'Are you sure you want to use the legacy server wallet method?\n\n' +
                              'We recommend using Admin Wallet deployment for better security and control.'
                            );
                            if (confirmed) {
                              setUseAdminWallet(false);
                            }
                          }
                        }}
                        className="mr-3 text-purple-600"
                      />
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Server Wallet (Legacy)
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Removed</span>
                        </span>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Server wallet deployment has been permanently removed for security reasons
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

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
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Amount *</label>
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
                      placeholder="100"
                    />
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
                            <p><strong>Balance:</strong> ✓ Sufficient</p>
                            {prizeInfo.name && <p><strong>Token:</strong> {prizeInfo.name}</p>}
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
                onClick={useAdminWallet ? createRaffleWithAdminWallet : createRaffle}
                disabled={creatingRaffle}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                {creatingRaffle 
                  ? useAdminWallet 
                    ? 'Creating...' 
                    : 'Creating...' 
                  : useAdminWallet 
                    ? 'Create & Deploy' 
                    : 'Create Raffle'
                }
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