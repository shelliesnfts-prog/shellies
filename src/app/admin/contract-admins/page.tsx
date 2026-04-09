'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { useRouter } from 'next/navigation';
import { isAddress } from 'viem';
import {
  Shield,
  Users,
  Gift,
  LogOut,
  Square,
  Sun,
  X,
  MoreHorizontal,
  ExternalLink,
  Clock,
  Settings,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { raffle_abi } from '@/lib/raffle-abi';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS as `0x${string}`;

type TxState =
  | { status: 'idle' }
  | { status: 'pending'; message: string }
  | { status: 'success'; message: string; txHash: string }
  | { status: 'error'; message: string };

export default function ContractAdminsPage() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { data: session } = useSession();
  const { address } = useAccount();
  const router = useRouter();
  const publicClient = usePublicClient();

  const { writeContractAsync } = useWriteContract();

  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });
  const [removingAddress, setRemovingAddress] = useState<string | null>(null);

  const walletAddress = address || session?.address || '';

  // Read admins from contract
  const {
    data: admins,
    isLoading: adminsLoading,
    refetch: refetchAdmins,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: raffle_abi,
    functionName: 'getAllAdmins',
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const handleAddAdmin = async () => {
    const trimmed = newAdminAddress.trim();
    if (!isAddress(trimmed)) {
      setTxState({ status: 'error', message: 'Invalid Ethereum address.' });
      return;
    }
    if ((admins as string[] | undefined)?.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      setTxState({ status: 'error', message: 'Address is already an admin.' });
      return;
    }

    try {
      setTxState({ status: 'pending', message: 'Waiting for wallet confirmation...' });
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: raffle_abi,
        functionName: 'addAdmin',
        args: [trimmed as `0x${string}`],
      });

      setTxState({ status: 'pending', message: 'Transaction submitted, waiting for confirmation...' });
      await publicClient!.waitForTransactionReceipt({ hash: txHash });

      setTxState({ status: 'success', message: 'Admin added successfully.', txHash });
      setNewAdminAddress('');
      refetchAdmins();
    } catch (err: any) {
      setTxState({
        status: 'error',
        message: err?.shortMessage || err?.message || 'Transaction failed.',
      });
    }
  };

  const handleRemoveAdmin = async (adminAddr: string) => {
    if (!confirm(`Remove admin ${adminAddr}? This cannot be undone.`)) return;

    try {
      setRemovingAddress(adminAddr);
      setTxState({ status: 'pending', message: `Removing ${adminAddr.slice(0, 8)}...` });
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: raffle_abi,
        functionName: 'removeAdmin',
        args: [adminAddr as `0x${string}`],
      });

      setTxState({ status: 'pending', message: 'Waiting for confirmation...' });
      await publicClient!.waitForTransactionReceipt({ hash: txHash });

      setTxState({ status: 'success', message: 'Admin removed.', txHash });
      refetchAdmins();
    } catch (err: any) {
      setTxState({
        status: 'error',
        message: err?.shortMessage || err?.message || 'Transaction failed.',
      });
    } finally {
      setRemovingAddress(null);
    }
  };

  const handleLogout = () => signOut();
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const adminList = (admins as `0x${string}`[] | undefined) ?? [];
  const isBusy = txState.status === 'pending';

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Floating Sidebar */}
      <div className="relative">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className={`
          fixed lg:relative top-4 left-4 h-[calc(100vh-2rem)] w-64
          ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          rounded-2xl shadow-xl border
          flex flex-col z-50 transition-all duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Top Section */}
          <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/shellies_icon.jpg" alt="Shellies Logo" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleDarkMode}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md ${
                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Sun className={`w-4 h-4 ${isDarkMode ? 'text-yellow-400' : 'text-gray-700'}`} />
                </button>
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

          {/* Admin Card */}
          <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="relative group">
              <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 h-[145px] relative overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <h3 className="text-white text-xs font-bold">ADMIN PANEL</h3>
                    <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200">
                      <LogOut className="w-4 h-4 text-white/80 hover:text-white" />
                    </button>
                  </div>
                  <div className="flex items-center">
                    <p className="text-white text-sm font-bold mr-2">
                      {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No wallet'}
                    </p>
                    <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">ADMIN</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => router.push('/admin/raffles')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Gift className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Raffles</span>
                </button>
              </li>
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
              <li>
                <button
                  onClick={() => router.push('/admin/sessions')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Clock className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Sessions</span>
                </button>
              </li>
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
              <li>
                <button
                  onClick={() => router.push('/admin/points-config')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Points Config</span>
                </button>
              </li>
              {/* Active page */}
              <li>
                <button
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <Shield className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Contract Admins</span>
                </button>
              </li>
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

        {/* Mobile toggle */}
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
        <main className="flex-1 p-3 lg:p-6 mt-16 lg:mt-0" style={{ marginLeft: '150px', marginRight: '150px' }}>
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Contract Admins
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Manage on-chain admin roles on the Raffle contract
                </p>
              </div>
              <button
                onClick={() => refetchAdmins()}
                disabled={adminsLoading}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${adminsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Tx status banner */}
            {txState.status !== 'idle' && (
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                txState.status === 'pending'
                  ? isDarkMode ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : txState.status === 'success'
                  ? isDarkMode ? 'bg-green-900/20 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
                  : isDarkMode ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {txState.status === 'pending' && <RefreshCw className="w-5 h-5 animate-spin mt-0.5 shrink-0" />}
                {txState.status === 'success' && <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                {txState.status === 'error' && <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{txState.message}</p>
                  {txState.status === 'success' && txState.txHash && (
                    <p className="text-xs mt-1 font-mono break-all opacity-75">{txState.txHash}</p>
                  )}
                </div>
                {txState.status !== 'pending' && (
                  <button onClick={() => setTxState({ status: 'idle' })} className="opacity-60 hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Add Admin */}
            <div className={`rounded-2xl shadow-sm border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-base font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Add Admin
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newAdminAddress}
                  onChange={e => setNewAdminAddress(e.target.value)}
                  placeholder="0x... wallet address"
                  disabled={isBusy}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } disabled:opacity-50`}
                />
                <button
                  onClick={handleAddAdmin}
                  disabled={isBusy || !newAdminAddress.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Admin List */}
            <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Current Admins
                </h2>
                <span className={`text-xs px-2 py-1 rounded-full border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  {adminsLoading ? '...' : adminList.length}
                </span>
              </div>

              {adminsLoading ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading admins from contract...</p>
                </div>
              ) : adminList.length === 0 ? (
                <div className="text-center py-10">
                  <Shield className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No admins found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-6 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>#</th>
                      <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Wallet Address</th>
                      <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Role</th>
                      <th className={`text-left py-3 px-4 font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminList.map((adminAddr, idx) => {
                      const isSelf = walletAddress.toLowerCase() === adminAddr.toLowerCase();
                      const isLastAdmin = adminList.length === 1;
                      return (
                        <tr key={adminAddr} className={`border-b last:border-0 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                          <td className={`py-3 px-6 text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{idx + 1}</td>
                          <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {adminAddr.slice(0, 12)}...{adminAddr.slice(-8)}
                              </span>
                              <button
                                onClick={() => copyToClipboard(adminAddr)}
                                className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title="Copy address"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                ADMIN_ROLE
                              </span>
                              {isSelf && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleRemoveAdmin(adminAddr)}
                              disabled={isBusy || isLastAdmin || removingAddress === adminAddr}
                              title={isLastAdmin ? 'Cannot remove the last admin' : 'Remove admin'}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              {removingAddress === adminAddr
                                ? <RefreshCw className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />
                              }
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
