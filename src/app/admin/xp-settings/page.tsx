'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Gift, 
  LogOut,
  Square,
  Sun,
  X,
  MoreHorizontal,
  ExternalLink,
  Clock,
  Zap,
  Save,
  RefreshCw
} from 'lucide-react';

export default function AdminXPSettingsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { data: session } = useSession();
  const { address } = useAccount();
  const router = useRouter();
  
  // Settings state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feeUsd, setFeeUsd] = useState('0.1');
  const [minXp, setMinXp] = useState('100');
  const [conversionRate, setConversionRate] = useState('10');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const walletAddress = address || session?.address || '';

  // Fetch current settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/xp-settings');
      if (response.ok) {
        const data = await response.json();
        setFeeUsd(data.settings.feeUsd.toString());
        setMinXp(data.settings.minXp.toString());
        setConversionRate(data.settings.conversionRate.toString());
      } else {
        setMessage({ type: 'error', text: 'Failed to load settings' });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      const response = await fetch('/api/admin/xp-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeUsd: parseFloat(feeUsd),
          minXp: parseInt(minXp),
          conversionRate: parseInt(conversionRate),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        // Update local state with returned values
        if (data.settings) {
          setFeeUsd(data.settings.feeUsd.toString());
          setMinXp(data.settings.minXp.toString());
          setConversionRate(data.settings.conversionRate.toString());
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleLogout = () => signOut();
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // Calculate preview
  const previewPoints = 1000 / parseInt(conversionRate || '10');

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
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
          rounded-2xl shadow-xl border flex flex-col z-50 transition-all duration-300
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm lg:hidden ${
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
            <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 h-[145px] relative overflow-hidden">
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <h3 className="text-white text-xs font-bold">ADMIN PANEL</h3>
                  <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
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

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <button onClick={() => router.push('/admin/raffles')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  <Gift className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Raffles</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/users')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  <Users className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Users</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/sessions')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  <Clock className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Sessions</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/withdrawals')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  <Square className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Withdrawals</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/xp-settings')}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  }`}>
                  <Zap className="w-5 h-5 mr-3" /><span className="font-medium text-sm">XP Settings</span>
                </button>
              </li>
              <li>
                <a href="/portal/raffles" target="_blank" rel="noopener noreferrer"
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  <ExternalLink className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Portal</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
        
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>XP Conversion Settings</h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Configure XP to Points conversion parameters
                </p>
              </div>
              <button
                onClick={fetchSettings}
                disabled={loading}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-xl border ${
                message.type === 'success'
                  ? isDarkMode ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
                  : isDarkMode ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className={isDarkMode ? 'text-white' : 'text-gray-700'}>Loading settings...</p>
              </div>
            ) : (
              <div className={`rounded-2xl shadow-sm border p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className="space-y-6">
                  {/* Conversion Fee */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Conversion Fee (USD)
                    </label>
                    <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Amount users pay to convert XP to points
                    </p>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      value={feeUsd}
                      onChange={(e) => setFeeUsd(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                      placeholder="0.1"
                    />
                  </div>

                  {/* Minimum XP */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Minimum XP to Convert
                    </label>
                    <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Minimum XP required before users can convert
                    </p>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={minXp}
                      onChange={(e) => setMinXp(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                      placeholder="100"
                    />
                  </div>

                  {/* Conversion Rate */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Conversion Rate (XP per Point)
                    </label>
                    <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      How many XP equals 1 point (e.g., 10 means 1000 XP = 100 points)
                    </p>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={conversionRate}
                      onChange={(e) => setConversionRate(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                      placeholder="10"
                    />
                  </div>

                  {/* Preview */}
                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Preview
                    </h4>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Users will pay <span className="font-bold text-purple-500">${feeUsd} USD</span> to convert XP.
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Minimum <span className="font-bold text-purple-500">{minXp} XP</span> required.
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      1000 XP = <span className="font-bold text-purple-500">{previewPoints.toFixed(1)} points</span>
                    </p>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
