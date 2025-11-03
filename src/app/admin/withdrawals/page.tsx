'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { GAME_PAYMENT_CONTRACT, GamePaymentService } from '@/lib/contracts';
import { PriceOracle } from '@/lib/price-oracle';
import EthUsdConverter from '@/components/EthUsdConverter';
import {
  Users,
  Gift,
  LogOut,
  Square,
  Sun,
  X,
  MoreHorizontal,
  ExternalLink,
  RefreshCw,
  Clock,
  Settings
} from 'lucide-react';

export default function WithdrawalsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { address } = useAccount();

  // UI state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Balance and price state
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showUpdateAmountModal, setShowUpdateAmountModal] = useState<boolean>(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState<bigint>(BigInt(0));

  // Get wallet address
  const walletAddress = address || session?.address || '';

  // Contract balance reading - disable auto-polling to prevent rate limits
  const {
    data: contractBalance,
    isLoading: balanceLoading,
    refetch: refetchBalance
  } = useReadContract({
    address: GAME_PAYMENT_CONTRACT.address,
    abi: GAME_PAYMENT_CONTRACT.abi,
    functionName: 'getBalance',
    query: {
      refetchInterval: false, // Disable automatic polling
    }
  });

  // Read current payment amount - disable auto-polling to prevent rate limits
  const {
    data: currentPaymentAmount,
    isLoading: paymentAmountLoading,
    refetch: refetchPaymentAmount
  } = useReadContract({
    address: GAME_PAYMENT_CONTRACT.address,
    abi: GAME_PAYMENT_CONTRACT.abi,
    functionName: 'getPaymentAmount',
    query: {
      refetchInterval: false, // Disable automatic polling
    }
  });

  // Withdrawal transaction
  const {
    writeContract,
    data: withdrawHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();

  // Update payment amount transaction
  const {
    writeContract: writeUpdateAmount,
    data: updateAmountHash,
    isPending: isUpdateAmountPending,
    error: updateAmountError,
  } = useWriteContract();

  // Transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isWithdrawSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  // Update amount transaction confirmation
  const {
    isLoading: isUpdateAmountConfirming,
    isSuccess: isUpdateAmountSuccess,
    error: updateAmountConfirmError,
  } = useWaitForTransactionReceipt({
    hash: updateAmountHash,
  });


  /**
   * Fetch ETH price on mount
   */
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await PriceOracle.getEthPrice();
      setEthPrice(price);
    };

    fetchPrice();
  }, []);

  // Removed auto-refresh to prevent RPC rate limiting
  // Users can manually refresh using the refresh buttons

  /**
   * Refresh balance after successful withdrawal
   */
  useEffect(() => {
    if (isWithdrawSuccess) {
      refetchBalance();
      setShowConfirmModal(false);
    }
  }, [isWithdrawSuccess, refetchBalance]);

  /**
   * Refresh payment amount after successful update
   */
  useEffect(() => {
    if (isUpdateAmountSuccess) {
      refetchPaymentAmount();
      setShowUpdateAmountModal(false);
    }
  }, [isUpdateAmountSuccess, refetchPaymentAmount]);

  /**
   * Handle withdrawal execution
   */
  const handleWithdraw = () => {
    if (!contractBalance || contractBalance === BigInt(0)) {
      return;
    }

    try {
      writeContract({
        address: GAME_PAYMENT_CONTRACT.address,
        abi: GAME_PAYMENT_CONTRACT.abi,
        functionName: 'withdraw',
      });
    } catch (error) {
      console.error('Error initiating withdrawal:', error);
    }
  };

  /**
   * Handle payment amount update
   */
  const handleUpdatePaymentAmount = () => {
    if (!newPaymentAmount || newPaymentAmount === BigInt(0)) {
      return;
    }

    try {
      writeUpdateAmount({
        address: GAME_PAYMENT_CONTRACT.address,
        abi: GAME_PAYMENT_CONTRACT.abi,
        functionName: 'updatePaymentAmount',
        args: [newPaymentAmount],
      });
    } catch (error) {
      console.error('Error updating payment amount:', error);
    }
  };

  /**
   * Calculate USD value of balance
   */
  const getUsdValue = (): string => {
    if (!contractBalance || !ethPrice) return '0.00';
    const usdValue = GamePaymentService.convertEthToUsd(contractBalance, ethPrice);
    return usdValue.toFixed(2);
  };

  /**
   * Format ETH balance
   */
  const getEthBalance = (): string => {
    if (!contractBalance) return '0.000000';
    return GamePaymentService.formatEthWithDecimals(contractBalance, 6);
  };

  const handleLogout = () => {
    signOut();
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  /**
   * Main withdrawal interface
   */
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md ${isDarkMode
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md lg:hidden ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
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
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
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
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                >
                  <Users className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Users</span>
                </button>
              </li>

              {/* Sessions */}
              <li>
                <button
                  onClick={() => router.push('/admin/sessions')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                >
                  <Clock className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Sessions</span>
                </button>
              </li>

              {/* Withdrawals */}
              <li>
                <button
                  onClick={() => router.push('/admin/withdrawals')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                >
                  <Square className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Withdrawals</span>
                </button>
              </li>

              {/* Portal Link */}
              <li>
                <a
                  href="/portal/raffles"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
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
          className={`fixed top-6 left-6 w-10 h-10 rounded-lg shadow-md flex items-center justify-center lg:hidden z-30 ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'
            }`}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4">
        {/* Content Area */}
        <main className="flex-1 p-3 lg:p-6 mt-16 lg:mt-0">
          <div className="space-y-4 max-w-7xl mx-auto">
            <div>
              <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Contract Withdrawals</h1>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Manage funds collected from game payments</p>
            </div>

            {/* Contract Info Card - Full Width */}
            <div className={`rounded-xl shadow-sm border p-4 ${isDarkMode
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
              }`}>
              <h2 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Contract Information</h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className={`block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Contract:</span>
                  <a
                    href={GamePaymentService.getContractExplorerUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-700 font-mono flex items-center gap-1"
                  >
                    {GAME_PAYMENT_CONTRACT.address.slice(0, 6)}...{GAME_PAYMENT_CONTRACT.address.slice(-4)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <span className={`block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Owner:</span>
                  <span className={`font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Payment Amount Management Card */}
              <div className={`rounded-xl shadow-sm border p-4 ${isDarkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
                }`}>
                <div className="flex justify-between items-center mb-3">
                  <h2 className={`text-sm font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Settings className="w-4 h-4" />
                    Payment Amount
                  </h2>
                  <button
                    onClick={() => refetchPaymentAmount()}
                    disabled={paymentAmountLoading}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${isDarkMode
                      ? 'text-purple-400 hover:bg-gray-700'
                      : 'text-purple-600 hover:bg-purple-100'
                      }`}
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${paymentAmountLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {paymentAmountLoading ? (
                  <div className="text-center py-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mx-auto"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`rounded-lg p-3 border ${
                      isDarkMode 
                        ? 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-700/50' 
                        : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-xs mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Current Amount
                          </p>
                          <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {currentPaymentAmount ? GamePaymentService.formatEthWithDecimals(currentPaymentAmount, 8) : '0.00000000'} ETH
                          </p>
                        </div>
                        {ethPrice && currentPaymentAmount && (
                          <p className={`text-sm font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                            ${GamePaymentService.convertEthToUsd(currentPaymentAmount, ethPrice).toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setShowUpdateAmountModal(true)}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200"
                    >
                      Update Amount
                    </button>
                  </div>
                )}
              </div>

              {/* Balance Card */}
              <div className={`rounded-xl shadow-sm border p-4 ${isDarkMode
                ? 'bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700/50'
                : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                }`}>
                <div className="flex justify-between items-center mb-3">
                  <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Contract Balance</h2>
                  <button
                    onClick={() => refetchBalance()}
                    disabled={balanceLoading}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${isDarkMode
                      ? 'text-purple-400 hover:bg-gray-700'
                      : 'text-purple-600 hover:bg-purple-100'
                      }`}
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {balanceLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {getEthBalance()} ETH
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                          ≈ ${getUsdValue()} USD
                        </div>
                      </div>
                      {ethPrice && (
                        <div className={`text-xs text-right ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          ETH: ${ethPrice.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setShowConfirmModal(true)}
                      disabled={!contractBalance || contractBalance === BigInt(0) || isWithdrawPending || isConfirming}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200"
                    >
                      {isWithdrawPending || isConfirming ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          {isWithdrawPending ? 'Initiating...' : 'Confirming...'}
                        </span>
                      ) : contractBalance === BigInt(0) ? (
                        'No Funds Available'
                      ) : (
                        'Withdraw All Funds'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Transaction Status */}
            {(withdrawError || confirmError || isWithdrawSuccess) && (
              <div className={`rounded-xl shadow-sm border p-4 ${isDarkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
                }`}>
                {withdrawError && (
                  <div className={`rounded-lg p-3 border mb-3 ${isDarkMode
                    ? 'bg-red-900/20 border-red-800'
                    : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-start gap-2">
                      <X className={`w-4 h-4 mt-0.5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                      <div>
                        <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>Withdrawal Failed</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                          {withdrawError.message.includes('User rejected')
                            ? 'Transaction was cancelled'
                            : 'Transaction failed. Please try again.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {confirmError && (
                  <div className={`rounded-lg p-3 border mb-3 ${isDarkMode
                    ? 'bg-red-900/20 border-red-800'
                    : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-start gap-2">
                      <X className={`w-4 h-4 mt-0.5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                      <div>
                        <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>Confirmation Failed</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                          Transaction confirmation failed. Please check the blockchain explorer.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isWithdrawSuccess && withdrawHash && (
                  <div className={`rounded-lg p-3 border ${isDarkMode
                    ? 'bg-green-900/20 border-green-800'
                    : 'bg-green-50 border-green-200'
                    }`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-green-700' : 'bg-green-500'
                        }`}>
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>Withdrawal Successful!</h3>
                        <p className={`text-xs mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                          Funds have been transferred to your wallet.
                        </p>
                        <a
                          href={GamePaymentService.getExplorerTxUrl(withdrawHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 text-xs font-medium"
                        >
                          View on Ink Explorer
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl border max-w-md w-full ${isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
            }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Confirm Withdrawal</h3>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You are about to withdraw <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{getEthBalance()} ETH</span> (≈ ${getUsdValue()} USD) to your wallet.
              </p>
            </div>
            <div className="p-6">
              <div className={`p-3 rounded-lg border mb-6 ${isDarkMode
                ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                <p className="text-sm flex items-start gap-2">
                  <span>⚠️</span>
                  <span>This action cannot be undone. Make sure you want to proceed.</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Payment Amount Modal */}
      {showUpdateAmountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl border max-w-md w-full ${isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
            }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Update Payment Amount</h3>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Set a new payment amount for players. Use the converter to calculate the right ETH amount based on current USD value.
              </p>
            </div>
            <div className="p-6 space-y-6">
              <EthUsdConverter 
                isDarkMode={isDarkMode}
                onEthAmountChange={setNewPaymentAmount}
                initialEthAmount={currentPaymentAmount ? Number(currentPaymentAmount) / 1e18 : 0.00001}
              />

              {isUpdateAmountPending || isUpdateAmountConfirming ? (
                <div className={`p-4 rounded-lg border ${
                  isDarkMode ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                    <span className={`text-sm ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                      {isUpdateAmountPending ? 'Waiting for signature...' : 'Confirming transaction...'}
                    </span>
                  </div>
                </div>
              ) : null}

              {updateAmountError && (
                <div className={`p-4 rounded-lg border ${
                  isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                    {updateAmountError.message.includes('User rejected') 
                      ? 'Transaction Cancelled' 
                      : updateAmountError.message.includes('circuit breaker')
                      ? 'Network Rate Limit'
                      : 'Transaction Failed'}
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    {updateAmountError.message.includes('User rejected') 
                      ? 'You cancelled the transaction in MetaMask.' 
                      : updateAmountError.message.includes('circuit breaker')
                      ? 'The RPC network is rate-limiting requests. Please wait a moment and try again.'
                      : 'Failed to update payment amount. Please try again.'}
                  </p>
                </div>
              )}

              {isUpdateAmountSuccess && updateAmountHash && (
                <div className={`p-4 rounded-lg border ${
                  isDarkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      isDarkMode ? 'bg-green-700' : 'bg-green-500'
                    }`}>
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
                        Payment amount updated successfully!
                      </p>
                      <a
                        href={GamePaymentService.getExplorerTxUrl(updateAmountHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
                      >
                        View on Ink Explorer
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpdateAmountModal(false)}
                  disabled={isUpdateAmountPending || isUpdateAmountConfirming}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePaymentAmount}
                  disabled={!newPaymentAmount || newPaymentAmount === BigInt(0) || isUpdateAmountPending || isUpdateAmountConfirming}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  {isUpdateAmountPending || isUpdateAmountConfirming ? 'Updating...' : 'Update Amount'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
