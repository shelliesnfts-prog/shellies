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
  RefreshCw,
  Settings,
  AlertTriangle,
} from 'lucide-react';

interface ContractConfig {
  claimCooldown: number;
  pointsForRegularUser: number;
  pointsPerAvailableNFT: number;
  maxPointsPerClaim: number;
  pointsPerDailyStakedNFT: number;
  pointsPerWeeklyStakedNFT: number;
  pointsPerMonthlyStakedNFT: number;
  claimWithFeesCost: string;
  claimWithFeesCostEth: string;
  claimWithFeesReward: number;
  claimWithFeesCooldown: number;
  xpConversionRate: number;
  minXpToConvert: number;
  authorizedSigner: string;
}

type SectionMessage = { type: 'success' | 'error'; text: string; txs?: Record<string, string> };

export default function AdminPointsConfigPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { data: session } = useSession();
  const { address } = useAccount();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ContractConfig | null>(null);

  // Claim settings form
  const [claimCooldown, setClaimCooldown] = useState('');
  const [pointsForRegularUser, setPointsForRegularUser] = useState('');
  const [pointsPerAvailableNFT, setPointsPerAvailableNFT] = useState('');
  const [maxPointsPerClaim, setMaxPointsPerClaim] = useState('');
  const [savingClaim, setSavingClaim] = useState(false);
  const [claimMsg, setClaimMsg] = useState<SectionMessage | null>(null);

  // Staking points form
  const [pointsPerDailyStakedNFT, setPointsPerDailyStakedNFT] = useState('');
  const [pointsPerWeeklyStakedNFT, setPointsPerWeeklyStakedNFT] = useState('');
  const [pointsPerMonthlyStakedNFT, setPointsPerMonthlyStakedNFT] = useState('');
  const [savingStaking, setSavingStaking] = useState(false);
  const [stakingMsg, setStakingMsg] = useState<SectionMessage | null>(null);

  // Claim-with-fees form
  const [claimWithFeesCostEth, setClaimWithFeesCostEth] = useState('');
  const [claimWithFeesReward, setClaimWithFeesReward] = useState('');
  const [claimWithFeesCooldown, setClaimWithFeesCooldown] = useState('');
  const [savingFees, setSavingFees] = useState(false);
  const [feesMsg, setFeesMsg] = useState<SectionMessage | null>(null);

  // Advanced
  const [authorizedSigner, setAuthorizedSigner] = useState('');
  const [savingSigner, setSavingSigner] = useState(false);
  const [signerMsg, setSignerMsg] = useState<SectionMessage | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<SectionMessage | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const walletAddress = address || session?.address || '';

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/points-config');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const c: ContractConfig = data.config;
      setConfig(c);
      setClaimCooldown(c.claimCooldown.toString());
      setPointsForRegularUser(c.pointsForRegularUser.toString());
      setPointsPerAvailableNFT(c.pointsPerAvailableNFT.toString());
      setMaxPointsPerClaim(c.maxPointsPerClaim.toString());
      setPointsPerDailyStakedNFT(c.pointsPerDailyStakedNFT.toString());
      setPointsPerWeeklyStakedNFT(c.pointsPerWeeklyStakedNFT.toString());
      setPointsPerMonthlyStakedNFT(c.pointsPerMonthlyStakedNFT.toString());
      setClaimWithFeesCostEth(c.claimWithFeesCostEth);
      setClaimWithFeesReward(c.claimWithFeesReward.toString());
      setClaimWithFeesCooldown(c.claimWithFeesCooldown.toString());
      setAuthorizedSigner(c.authorizedSigner);
    } catch {
      setClaimMsg({ type: 'error', text: 'Failed to load contract config' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  function autoClear(setMsg: (m: SectionMessage | null) => void) {
    setTimeout(() => setMsg(null), 6000);
  }

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/points-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const saveClaimSettings = async () => {
    setSavingClaim(true);
    setClaimMsg(null);
    try {
      const data = await post({
        action: 'set_claim_settings',
        claimCooldown: Number(claimCooldown),
        pointsForRegularUser: Number(pointsForRegularUser),
        pointsPerAvailableNFT: Number(pointsPerAvailableNFT),
        maxPointsPerClaim: Number(maxPointsPerClaim),
      });
      if (data.success) {
        setClaimMsg({ type: 'success', text: 'Claim settings saved on-chain.', txs: data.results });
      } else {
        setClaimMsg({ type: 'error', text: data.error || 'Failed' });
      }
    } catch {
      setClaimMsg({ type: 'error', text: 'Request failed' });
    } finally {
      setSavingClaim(false);
      autoClear(setClaimMsg);
    }
  };

  const saveStakingPoints = async () => {
    setSavingStaking(true);
    setStakingMsg(null);
    try {
      const data = await post({
        action: 'set_staking_points',
        pointsPerDailyStakedNFT: Number(pointsPerDailyStakedNFT),
        pointsPerWeeklyStakedNFT: Number(pointsPerWeeklyStakedNFT),
        pointsPerMonthlyStakedNFT: Number(pointsPerMonthlyStakedNFT),
      });
      if (data.success) {
        setStakingMsg({ type: 'success', text: 'Staking points saved on-chain.', txs: data.results });
      } else {
        setStakingMsg({ type: 'error', text: data.error || 'Failed' });
      }
    } catch {
      setStakingMsg({ type: 'error', text: 'Request failed' });
    } finally {
      setSavingStaking(false);
      autoClear(setStakingMsg);
    }
  };

  const saveClaimWithFees = async () => {
    setSavingFees(true);
    setFeesMsg(null);
    try {
      const data = await post({
        action: 'set_claim_with_fees',
        claimWithFeesCostEth,
        claimWithFeesReward: Number(claimWithFeesReward),
        claimWithFeesCooldown: Number(claimWithFeesCooldown),
      });
      if (data.success) {
        setFeesMsg({ type: 'success', text: 'Claim-with-fees saved on-chain.', txs: data.results });
      } else {
        setFeesMsg({ type: 'error', text: data.error || 'Failed' });
      }
    } catch {
      setFeesMsg({ type: 'error', text: 'Request failed' });
    } finally {
      setSavingFees(false);
      autoClear(setFeesMsg);
    }
  };

  const saveAuthorizedSigner = async () => {
    setSavingSigner(true);
    setSignerMsg(null);
    try {
      const data = await post({ action: 'set_authorized_signer', authorizedSigner });
      if (data.success) {
        setSignerMsg({ type: 'success', text: `Signer updated. tx: ${data.tx}` });
      } else {
        setSignerMsg({ type: 'error', text: data.error || 'Failed' });
      }
    } catch {
      setSignerMsg({ type: 'error', text: 'Request failed' });
    } finally {
      setSavingSigner(false);
      autoClear(setSignerMsg);
    }
  };

  const handleWithdrawFees = async () => {
    setShowWithdrawConfirm(false);
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      const data = await post({ action: 'withdraw_fees' });
      if (data.success) {
        setWithdrawMsg({ type: 'success', text: `Fees withdrawn. tx: ${data.tx}` });
      } else {
        setWithdrawMsg({ type: 'error', text: data.error || 'Failed' });
      }
    } catch {
      setWithdrawMsg({ type: 'error', text: 'Request failed' });
    } finally {
      setWithdrawing(false);
      autoClear(setWithdrawMsg);
    }
  };

  const handleLogout = () => signOut();
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const labelCls = `block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const hintCls = `text-xs mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`;
  const cardCls = `rounded-2xl shadow-sm border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`;

  function SectionMsg({ msg }: { msg: SectionMessage | null }) {
    if (!msg) return null;
    const base = msg.type === 'success'
      ? isDarkMode ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
      : isDarkMode ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-700';
    return (
      <div className={`p-3 rounded-xl border text-xs space-y-1 ${base}`}>
        <p>{msg.text}</p>
        {msg.txs && Object.entries(msg.txs).map(([k, v]) => (
          <p key={k} className="font-mono truncate">{k}: {v}</p>
        ))}
      </div>
    );
  }

  function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        disabled={saving}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
      >
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save'}
      </button>
    );
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <div className="relative">
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        <div className={`
          fixed lg:relative top-4 left-4 h-[calc(100vh-2rem)] w-64
          ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          rounded-2xl shadow-xl border flex flex-col z-50 transition-all duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/shellies_icon.jpg" alt="Shellies Logo" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={toggleDarkMode} className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:shadow-md ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  <Sun className={`w-4 h-4 ${isDarkMode ? 'text-yellow-400' : 'text-gray-700'}`} />
                </button>
                <button className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm lg:hidden ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => setIsMobileMenuOpen(false)}>
                  <X className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                </button>
              </div>
            </div>
          </div>

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

          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <button onClick={() => router.push('/admin/raffles')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Gift className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Raffles</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/users')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Users className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Users</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/sessions')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Clock className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Sessions</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/withdrawals')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Square className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Withdrawals</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/xp-settings')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Zap className="w-5 h-5 mr-3" /><span className="font-medium text-sm">XP Settings</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/points-config')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}>
                  <Settings className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Points Config</span>
                </button>
              </li>
              <li>
                <a href="/portal/raffles" target="_blank" rel="noopener noreferrer" className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <ExternalLink className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Portal</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <button onClick={() => setIsMobileMenuOpen(true)} className={`fixed top-6 left-6 w-10 h-10 rounded-lg shadow-md flex items-center justify-center lg:hidden z-30 ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'}`}>
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-4">
        <main className="flex-1 p-3 lg:p-6 mt-16 lg:mt-0" style={{ marginLeft: '150px', marginRight: '150px' }}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Points Contract Config</h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Owner-only settings for the ShelliesPoints contract. Each save sends an on-chain transaction.
                </p>
              </div>
              <button onClick={fetchConfig} disabled={loading} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className={isDarkMode ? 'text-white' : 'text-gray-700'}>Loading contract config…</p>
              </div>
            ) : (
              <div className="space-y-6">

                {/* ── Claim Settings ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Claim Settings</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className={labelCls}>Claim Cooldown (seconds)</label>
                      <p className={hintCls}>Seconds between free claims</p>
                      <input type="number" min="0" value={claimCooldown} onChange={e => setClaimCooldown(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Points for Regular User</label>
                      <p className={hintCls}>Points awarded per free claim (non-NFT holder)</p>
                      <input type="number" min="0" value={pointsForRegularUser} onChange={e => setPointsForRegularUser(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Points per Available NFT</label>
                      <p className={hintCls}>Bonus points per NFT held (on top of base)</p>
                      <input type="number" min="0" value={pointsPerAvailableNFT} onChange={e => setPointsPerAvailableNFT(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Max Points per Claim</label>
                      <p className={hintCls}>Cap on total points from a single free claim</p>
                      <input type="number" min="0" value={maxPointsPerClaim} onChange={e => setMaxPointsPerClaim(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <SectionMsg msg={claimMsg} />
                  <div className="mt-4">
                    <SaveBtn saving={savingClaim} onClick={saveClaimSettings} />
                  </div>
                </div>

                {/* ── Staking Points ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Staking Points</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className={labelCls}>Points per Daily Staked NFT</label>
                      <p className={hintCls}>For each NFT staked ≥ 1 day</p>
                      <input type="number" min="0" value={pointsPerDailyStakedNFT} onChange={e => setPointsPerDailyStakedNFT(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Points per Weekly Staked NFT</label>
                      <p className={hintCls}>For each NFT staked ≥ 7 days</p>
                      <input type="number" min="0" value={pointsPerWeeklyStakedNFT} onChange={e => setPointsPerWeeklyStakedNFT(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Points per Monthly Staked NFT</label>
                      <p className={hintCls}>For each NFT staked ≥ 30 days</p>
                      <input type="number" min="0" value={pointsPerMonthlyStakedNFT} onChange={e => setPointsPerMonthlyStakedNFT(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <SectionMsg msg={stakingMsg} />
                  <div className="mt-4">
                    <SaveBtn saving={savingStaking} onClick={saveStakingPoints} />
                  </div>
                </div>

                {/* ── Claim with Fees ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Claim with Fees</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className={labelCls}>Cost (ETH)</label>
                      <p className={hintCls}>ETH amount users pay for this claim type</p>
                      <input type="number" step="0.0001" min="0" value={claimWithFeesCostEth} onChange={e => setClaimWithFeesCostEth(e.target.value)} className={inputCls} placeholder="0.001" />
                    </div>
                    <div>
                      <label className={labelCls}>Reward (points)</label>
                      <p className={hintCls}>Points awarded on a paid claim</p>
                      <input type="number" min="0" value={claimWithFeesReward} onChange={e => setClaimWithFeesReward(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Cooldown (seconds)</label>
                      <p className={hintCls}>Seconds between paid claims per user</p>
                      <input type="number" min="0" value={claimWithFeesCooldown} onChange={e => setClaimWithFeesCooldown(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <SectionMsg msg={feesMsg} />
                  <div className="mt-4">
                    <SaveBtn saving={savingFees} onClick={saveClaimWithFees} />
                  </div>
                </div>

                {/* ── Advanced ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Advanced</h2>

                  {/* Authorized signer */}
                  <div className="mb-6">
                    <label className={labelCls}>Authorized Signer</label>
                    <p className={hintCls}>Address whose private key signs XP conversion vouchers (AUTHORIZED_SIGNER_PRIVATE_KEY). Must match on-chain.</p>
                    <input
                      type="text"
                      value={authorizedSigner}
                      onChange={e => setAuthorizedSigner(e.target.value)}
                      className={inputCls}
                      placeholder="0x..."
                    />
                    <SectionMsg msg={signerMsg} />
                    <div className="mt-3">
                      <SaveBtn saving={savingSigner} onClick={saveAuthorizedSigner} />
                    </div>
                  </div>

                  {/* Withdraw fees */}
                  <div className={`border-t pt-6 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <label className={labelCls}>Withdraw Accumulated Fees</label>
                    <p className={hintCls}>Transfers all ETH collected from claimWithFees calls to the contract owner wallet.</p>
                    <SectionMsg msg={withdrawMsg} />
                    {showWithdrawConfirm ? (
                      <div className={`mt-3 p-4 rounded-xl border ${isDarkMode ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                            This will withdraw all fees to the owner wallet. Continue?
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleWithdrawFees} disabled={withdrawing} className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
                            {withdrawing ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            {withdrawing ? 'Withdrawing…' : 'Confirm'}
                          </button>
                          <button onClick={() => setShowWithdrawConfirm(false)} className={`px-4 py-2 rounded-lg text-sm font-medium ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowWithdrawConfirm(true)} className={`mt-3 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors border ${isDarkMode ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/20' : 'border-yellow-400 text-yellow-700 hover:bg-yellow-50'}`}>
                        Withdraw Fees
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
