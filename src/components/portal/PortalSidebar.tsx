'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { useRouter, usePathname } from 'next/navigation';
import { usePoints } from '@/contexts/PointsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ClaimButtonWithCountdown } from '@/components/ClaimCountdown';
import { 
  Trophy, 
  Coins, 
  BarChart3, 
  User, 
  LogOut,
  TrendingUp,
  Gift,
  Square,
  Sun,
  X,
  MoreHorizontal,
  ChevronDown,
  Settings,
  HelpCircle,
  Bell,
  Shield
} from 'lucide-react';

interface PortalSidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export function PortalSidebar({ 
  isMobileMenuOpen, 
  setIsMobileMenuOpen 
}: PortalSidebarProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const { data: session } = useSession();
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user, claimStatus, loading: userLoading, claiming, executeRegularClaim, error: claimError, refreshUserData } = usePoints();

  // Get wallet address from session or wagmi
  const walletAddress = address || session?.address || '';

  const handleClaimDaily = async () => {
    const result = await executeRegularClaim();
    if (result.success) {
      await refreshUserData();
    }
  };

  const handleLogout = () => {
    signOut();
  };

  const checkAdminStatus = async () => {
    if (!walletAddress) {
      setIsAdmin(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/check');
      const data = await response.json();
      setIsAdmin(data.isAdmin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const handleAdminClick = () => {
    router.push('/admin');
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    checkAdminStatus();
  }, [walletAddress]);

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/');
  };

  return (
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
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden" style={{borderRadius: '50px'}}>
              <img
                src="/shellies_icon.jpg"
                alt="Shellies Logo"
                className="w-full h-full object-cover"
                style={{borderRadius: '50px'}}
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

        {/* Wallet Card Section */}
        <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="relative group">
            {/* Wallet Card with Purple Gradient */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-6 h-[145px] relative overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105">
              {/* Shimmer overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
              
              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-between">
                {/* Top Row */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    {/* <h3 className="text-white text-xs font-bold">
                      {userLoading ? (
                        <div className="h-3 bg-white/20 rounded animate-pulse w-12"></div>
                      ) : (
                        `$Point${(user?.points ?? 0) !== 1 ? 's' : ''}`
                      )}
                    </h3> */}
                    {walletAddress && (
                      <p className="text-white/70 text-xs mt-1 font-mono">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-2 py-1 hover:bg-white/10 rounded-lg transition-colors duration-200"
                  >
                    <span className="text-white/80 hover:text-white text-xs font-medium">Logout</span>
                  </button>
                </div>
                
                {/* Bottom Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {userLoading ? (
                      <div className="flex items-center">
                        <div className="h-4 bg-white/20 rounded animate-pulse w-8 mr-2"></div>
                        <div className="h-3 bg-white/20 rounded animate-pulse w-12"></div>
                      </div>
                    ) : (
                      <>
                        <p className="text-white text-sm font-bold mr-2">{user?.points?.toFixed(1) || '0.0'}</p>
                        <p className="text-white font-medium text-xs">Point{(user?.points ?? 0) !== 1 ? 's' : ''}</p>
                      </>
                    )}
                  </div>
                  {!userLoading && (
                    <button
                      onClick={() => handleNavigation('/portal/profile')}
                      className="relative px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 rounded-md transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 overflow-hidden group"
                    >
                      {/* Shining animation overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 transform translate-x-full group-hover:translate-x-[-200%] transition-transform duration-700 ease-out" />
                      {/* Continuous shine animation */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform animate-pulse"
                           style={{
                             animation: 'shine 2s infinite linear',
                             animationDelay: '0.5s'
                           }} />
                      <span className="relative text-white font-bold text-xs drop-shadow-sm">Claim</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-1">
            {/* Profile */}
            <li>
              <button
                onClick={() => handleNavigation('/portal/profile')}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                  isActive('/portal/profile')
                    ? 'bg-purple-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <User className="w-5 h-5 mr-3" />
                <span className="font-medium text-sm">Profile</span>
              </button>
            </li>

            {/* Staking */}
            <li>
              <button
                onClick={() => handleNavigation('/portal/staking')}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                  isActive('/portal/staking')
                    ? 'bg-purple-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Coins className="w-5 h-5 mr-3" />
                <span className="font-medium text-sm">Staking</span>
              </button>
            </li>

            {/* Raffles */}
            <li>
              <button
                onClick={() => handleNavigation('/portal/raffles')}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                  isActive('/portal/raffles')
                    ? 'bg-purple-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Gift className="w-5 h-5 mr-3" />
                <span className="font-medium text-sm">Raffles</span>
              </button>
            </li>

            {/* Leaderboard */}
            <li>
              <button
                onClick={() => handleNavigation('/portal/leaderboard')}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                  isActive('/portal/leaderboard')
                    ? 'bg-purple-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-5 h-5 mr-3" />
                <span className="font-medium text-sm">Leaderboard</span>
              </button>
            </li>

            {/* Trade */}
            <li>
              <button
                onClick={() => handleNavigation('/portal/trade')}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                  isActive('/portal/trade')
                    ? 'bg-purple-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <TrendingUp className="w-5 h-5 mr-3" />
                <span className="font-medium text-sm">Trade</span>
              </button>
            </li>
            
            {/* Admin Panel - Only show if user is admin */}
            {isAdmin && (
              <li className={`border-t pt-2 mt-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <button
                  onClick={handleAdminClick}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode
                      ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                      : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  }`}
                >
                  <Shield className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Admin Panel</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Copyright Footer */}
        <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-xs text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            © 2025 Ink Shellies Platform. All rights reserved.
          </p>
        </div>
      </div>
      
      {/* Mobile menu toggle button */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed top-6 left-6 w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center lg:hidden z-30"
      >
        <MoreHorizontal className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );
}