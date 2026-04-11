'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { useRouter } from 'next/navigation';
import { SHELLIES_POINTS_CONTRACT } from '@/lib/shellies-points-contract';
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
  Save,
  RefreshCw,
  Settings,
  AlertTriangle,
  Check,
  Shield,
} from 'lucide-react';

interface ContractConfig {
  claimCooldown: number;
  pointsForRegularUser: number;
  pointsPerAvailableNFT: number;
  maxPointsPerClaim: number;
  pointsPerDailyStakedNFT: number;
  pointsPerWeeklyStakedNFT: number;
  pointsPerMonthlyStakedNFT: number;
  stakerTierCost: string;
  stakerTierCostEth: string;
  pointsPerStakedNFT: number;
  stakerTierCooldown: number;
  holderTierCost: string;
  holderTierCostEth: string;
  pointsPerHeldNFT: number;
  holderTierCooldown: number;
  regularTierCost: string;
  regularTierCostEth: string;
  rewardPerRegularUser: number;
  regularTierCooldown: number;
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

  // Staking points form
  const [pointsPerDailyStakedNFT, setPointsPerDailyStakedNFT] = useState('');
  const [pointsPerWeeklyStakedNFT, setPointsPerWeeklyStakedNFT] = useState('');
  const [pointsPerMonthlyStakedNFT, setPointsPerMonthlyStakedNFT] = useState('');

  // Claim-with-fees form (tiered - dynamic)
  const [stakerTierCostEth, setStakerTierCostEth] = useState('');
  const [pointsPerStakedNFT, setPointsPerStakedNFT] = useState('');
  const [stakerTierCooldown, setStakerTierCooldown] = useState('');
  const [holderTierCostEth, setHolderTierCostEth] = useState('');
  const [pointsPerHeldNFT, setPointsPerHeldNFT] = useState('');
  const [holderTierCooldown, setHolderTierCooldown] = useState('');
  const [regularTierCostEth, setRegularTierCostEth] = useState('');
  const [rewardPerRegularUser, setRewardPerRegularUser] = useState('');
  const [regularTierCooldown, setRegularTierCooldown] = useState('');

  // XP Conversion (on-chain + DB fee)
  const [xpConversionRate, setXpConversionRate] = useState('');
  const [minXpToConvert, setMinXpToConvert] = useState('');
  const [xpConversionFeeUsd, setXpConversionFeeUsd] = useState('');
  const [xpConversionFeeUsdOriginal, setXpConversionFeeUsdOriginal] = useState('');

  // Per-field saving/message state
  const [savingField, setSavingField] = useState<string | null>(null);
  const [fieldMsgs, setFieldMsgs] = useState<Record<string, SectionMessage | null>>({});

  // Advanced
  const [authorizedSigner, setAuthorizedSigner] = useState('');
  const [savingSigner, setSavingSigner] = useState(false);
  const [signerMsg, setSignerMsg] = useState<SectionMessage | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<SectionMessage | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const { writeContractAsync } = useWriteContract();
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
      // Staker tier
      setStakerTierCostEth(c.stakerTierCostEth);
      setPointsPerStakedNFT(c.pointsPerStakedNFT.toString());
      setStakerTierCooldown(c.stakerTierCooldown.toString());
      // Holder tier
      setHolderTierCostEth(c.holderTierCostEth);
      setPointsPerHeldNFT(c.pointsPerHeldNFT.toString());
      setHolderTierCooldown(c.holderTierCooldown.toString());
      // Regular tier
      setRegularTierCostEth(c.regularTierCostEth);
      setRewardPerRegularUser(c.rewardPerRegularUser.toString());
      setRegularTierCooldown(c.regularTierCooldown.toString());
      setAuthorizedSigner(c.authorizedSigner);
      setXpConversionRate(c.xpConversionRate.toString());
      setMinXpToConvert(c.minXpToConvert.toString());

      // Load DB-only fee setting
      try {
        const feeRes = await fetch('/api/admin/xp-settings');
        if (feeRes.ok) {
          const feeData = await feeRes.json();
          const feeVal = feeData.settings?.feeUsd?.toString() ?? '0.1';
          setXpConversionFeeUsd(feeVal);
          setXpConversionFeeUsdOriginal(feeVal);
        }
      } catch {
        console.warn('Failed to load XP fee setting');
      }
    } catch {
      setFieldMsgs({ global: { type: 'error', text: 'Failed to load contract config' } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  function autoClear(setMsg: (m: SectionMessage | null) => void) {
    setTimeout(() => setMsg(null), 6000);
  }

  function isDirty(value: string, contractValue: string | number) {
    return value !== contractValue.toString();
  }

  const saveField = async (
    fieldKey: string,
    functionName: string,
    args: unknown[],
  ) => {
    if (!address) {
      setFieldMsgs(prev => ({ ...prev, [fieldKey]: { type: 'error', text: 'Wallet not connected' } }));
      return;
    }
    setSavingField(fieldKey);
    setFieldMsgs(prev => ({ ...prev, [fieldKey]: null }));
    try {
      await writeContractAsync({ ...SHELLIES_POINTS_CONTRACT, functionName, args } as Parameters<typeof writeContractAsync>[0]);
      setFieldMsgs(prev => ({ ...prev, [fieldKey]: { type: 'success', text: 'Saved' } }));
      await fetchConfig();
      setTimeout(() => setFieldMsgs(prev => ({ ...prev, [fieldKey]: null })), 4000);
    } catch (e) {
      setFieldMsgs(prev => ({ ...prev, [fieldKey]: { type: 'error', text: e instanceof Error ? e.message : 'Transaction failed' } }));
      setTimeout(() => setFieldMsgs(prev => ({ ...prev, [fieldKey]: null })), 6000);
    } finally {
      setSavingField(null);
    }
  };

  const saveDbField = async (fieldKey: string, dbKey: string, value: string) => {
    setSavingField(fieldKey);
    setFieldMsgs(prev => ({ ...prev, [fieldKey]: null }));
    try {
      const res = await fetch('/api/admin/xp-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [dbKey]: value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setFieldMsgs(prev => ({ ...prev, [fieldKey]: { type: 'success', text: 'Saved' } }));
      setTimeout(() => setFieldMsgs(prev => ({ ...prev, [fieldKey]: null })), 4000);
    } catch (e) {
      setFieldMsgs(prev => ({ ...prev, [fieldKey]: { type: 'error', text: e instanceof Error ? e.message : 'Save failed' } }));
      setTimeout(() => setFieldMsgs(prev => ({ ...prev, [fieldKey]: null })), 6000);
    } finally {
      setSavingField(null);
    }
  };

  const saveAuthorizedSigner = async () => {
    if (!address) { setSignerMsg({ type: 'error', text: 'Wallet not connected' }); return; }
    if (!authorizedSigner || !/^0x[0-9a-fA-F]{40}$/.test(authorizedSigner)) {
      setSignerMsg({ type: 'error', text: 'Invalid Ethereum address' });
      return;
    }
    setSavingSigner(true);
    setSignerMsg(null);
    try {
      const tx = await writeContractAsync({ ...SHELLIES_POINTS_CONTRACT, functionName: 'setAuthorizedSigner', args: [authorizedSigner as `0x${string}`] });
      setSignerMsg({ type: 'success', text: `Signer updated. tx: ${tx}` });
    } catch (e) {
      setSignerMsg({ type: 'error', text: e instanceof Error ? e.message : 'Transaction failed' });
    } finally {
      setSavingSigner(false);
      autoClear(setSignerMsg);
    }
  };

  const handleWithdrawFees = async () => {
    if (!address) { setWithdrawMsg({ type: 'error', text: 'Wallet not connected' }); return; }
    setShowWithdrawConfirm(false);
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      const tx = await writeContractAsync({ ...SHELLIES_POINTS_CONTRACT, functionName: 'withdrawFees', args: [] });
      setWithdrawMsg({ type: 'success', text: `Fees withdrawn. tx: ${tx}` });
    } catch (e) {
      setWithdrawMsg({ type: 'error', text: e instanceof Error ? e.message : 'Transaction failed' });
    } finally {
      setWithdrawing(false);
      autoClear(setWithdrawMsg);
    }
  };

  const handleLogout = () => signOut();
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const inputCls = `w-full px-4 py-3 pr-12 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
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

  function FieldMsg({ fieldKey }: { fieldKey: string }) {
    const msg = fieldMsgs[fieldKey];
    if (!msg) return null;
    return (
      <p className={`text-xs mt-1 ${msg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
        {msg.text}
      </p>
    );
  }

  function FieldInput({
    fieldKey,
    label,
    hint,
    value,
    contractValue,
    onChange,
    onSave,
    type = 'number',
    step,
    placeholder,
  }: {
    fieldKey: string;
    label: string;
    hint: string;
    value: string;
    contractValue: string | number;
    onChange: (v: string) => void;
    onSave: () => void;
    type?: string;
    step?: string;
    placeholder?: string;
  }) {
    const dirty = isDirty(value, contractValue);
    const saving = savingField === fieldKey;
    const anyFieldSaving = savingField !== null;

    return (
      <div>
        <label className={labelCls}>{label}</label>
        <p className={hintCls}>{hint}</p>
        <div className="relative">
          <input
            type={type}
            min={type === 'number' ? '0' : undefined}
            step={step}
            value={value}
            onChange={e => onChange(e.target.value)}
            className={inputCls}
            placeholder={placeholder}
          />
          <button
            onClick={onSave}
            disabled={!dirty || anyFieldSaving}
            title={!dirty ? 'No changes' : 'Save this field'}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors
              ${dirty && !anyFieldSaving
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-600'
              }`}
          >
            {saving
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />
            }
          </button>
        </div>
        <FieldMsg fieldKey={fieldKey} />
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
                <button onClick={() => router.push('/admin/points-config')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}>
                  <Settings className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Points Config</span>
                </button>
              </li>
              <li>
                <button onClick={() => router.push('/admin/contract-admins')} className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Shield className="w-5 h-5 mr-3" /><span className="font-medium text-sm">Contract Admins</span>
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
                  Owner-only settings for the ShelliesPoints contract. Each field sends its own on-chain transaction.
                </p>
              </div>
              <button onClick={fetchConfig} disabled={loading} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_infinite]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>Loading config...</p>
              </div>
            ) : (
              <div className="space-y-6">

                {/* ── Claim Settings ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Claim Settings</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldInput
                      fieldKey="claimCooldown"
                      label="Claim Cooldown (seconds)"
                      hint="Seconds between free claims"
                      value={claimCooldown}
                      contractValue={config?.claimCooldown ?? 0}
                      onChange={setClaimCooldown}
                      onSave={() => saveField('claimCooldown', 'setClaimCooldown', [BigInt(claimCooldown)])}
                    />
                    <FieldInput
                      fieldKey="pointsForRegularUser"
                      label="Points for Regular User"
                      hint="Points awarded per free claim (non-NFT holder)"
                      value={pointsForRegularUser}
                      contractValue={config?.pointsForRegularUser ?? 0}
                      onChange={setPointsForRegularUser}
                      onSave={() => saveField('pointsForRegularUser', 'setPointsForRegularUser', [BigInt(pointsForRegularUser)])}
                    />
                    <FieldInput
                      fieldKey="pointsPerAvailableNFT"
                      label="Points per Available NFT"
                      hint="Bonus points per NFT held (on top of base)"
                      value={pointsPerAvailableNFT}
                      contractValue={config?.pointsPerAvailableNFT ?? 0}
                      onChange={setPointsPerAvailableNFT}
                      onSave={() => saveField('pointsPerAvailableNFT', 'setPointsPerAvailableNFT', [BigInt(pointsPerAvailableNFT)])}
                    />
                    <FieldInput
                      fieldKey="maxPointsPerClaim"
                      label="Max Points per Claim"
                      hint="Cap on total points from a single free claim"
                      value={maxPointsPerClaim}
                      contractValue={config?.maxPointsPerClaim ?? 0}
                      onChange={setMaxPointsPerClaim}
                      onSave={() => saveField('maxPointsPerClaim', 'setMaxPointsPerClaim', [BigInt(maxPointsPerClaim)])}
                    />
                  </div>
                </div>

                {/* ── Staking Points ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Staking Points</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FieldInput
                      fieldKey="pointsPerDailyStakedNFT"
                      label="Points per Daily Staked NFT"
                      hint="For each NFT staked ≥ 1 day"
                      value={pointsPerDailyStakedNFT}
                      contractValue={config?.pointsPerDailyStakedNFT ?? 0}
                      onChange={setPointsPerDailyStakedNFT}
                      onSave={() => saveField('pointsPerDailyStakedNFT', 'setPointsPerDailyStakedNFT', [BigInt(pointsPerDailyStakedNFT)])}
                    />
                    <FieldInput
                      fieldKey="pointsPerWeeklyStakedNFT"
                      label="Points per Weekly Staked NFT"
                      hint="For each NFT staked ≥ 7 days"
                      value={pointsPerWeeklyStakedNFT}
                      contractValue={config?.pointsPerWeeklyStakedNFT ?? 0}
                      onChange={setPointsPerWeeklyStakedNFT}
                      onSave={() => saveField('pointsPerWeeklyStakedNFT', 'setPointsPerWeeklyStakedNFT', [BigInt(pointsPerWeeklyStakedNFT)])}
                    />
                    <FieldInput
                      fieldKey="pointsPerMonthlyStakedNFT"
                      label="Points per Monthly Staked NFT"
                      hint="For each NFT staked ≥ 30 days"
                      value={pointsPerMonthlyStakedNFT}
                      contractValue={config?.pointsPerMonthlyStakedNFT ?? 0}
                      onChange={setPointsPerMonthlyStakedNFT}
                      onSave={() => saveField('pointsPerMonthlyStakedNFT', 'setPointsPerMonthlyStakedNFT', [BigInt(pointsPerMonthlyStakedNFT)])}
                    />
                  </div>
                </div>

                {/* ── Staker Tier ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Staker Tier</h2>
                  <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Users with ≥1 NFT staked</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FieldInput
                      fieldKey="stakerTierCostEth"
                      label="Cost (ETH)"
                      hint="ETH amount stakers pay"
                      value={stakerTierCostEth}
                      contractValue={config?.stakerTierCostEth ?? '0'}
                      onChange={setStakerTierCostEth}
                      onSave={() => saveField('stakerTierCostEth', 'setStakerTierCost', [parseEther(stakerTierCostEth)])}
                      type="number"
                      step="0.0001"
                      placeholder="0.001"
                    />
                    <FieldInput
                      fieldKey="pointsPerStakedNFT"
                      label="Points per Staked NFT"
                      hint="Points per staked NFT (combined)"
                      value={pointsPerStakedNFT}
                      contractValue={config?.pointsPerStakedNFT ?? 0}
                      onChange={setPointsPerStakedNFT}
                      onSave={() => saveField('pointsPerStakedNFT', 'setPointsPerStakedNFT', [BigInt(pointsPerStakedNFT)])}
                    />
                    <FieldInput
                      fieldKey="stakerTierCooldown"
                      label="Cooldown (seconds)"
                      hint="Seconds between claims for stakers"
                      value={stakerTierCooldown}
                      contractValue={config?.stakerTierCooldown ?? 0}
                      onChange={setStakerTierCooldown}
                      onSave={() => saveField('stakerTierCooldown', 'setStakerTierCooldown', [BigInt(stakerTierCooldown)])}
                    />
                  </div>
                </div>

                {/* ── Holder Tier ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Holder Tier</h2>
                  <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Users with ≥1 NFT in wallet (not staked)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FieldInput
                      fieldKey="holderTierCostEth"
                      label="Cost (ETH)"
                      hint="ETH amount holders pay"
                      value={holderTierCostEth}
                      contractValue={config?.holderTierCostEth ?? '0'}
                      onChange={setHolderTierCostEth}
                      onSave={() => saveField('holderTierCostEth', 'setHolderTierCost', [parseEther(holderTierCostEth)])}
                      type="number"
                      step="0.0001"
                      placeholder="0.001"
                    />
                    <FieldInput
                      fieldKey="pointsPerHeldNFT"
                      label="Points per Held NFT"
                      hint="Points per NFT held in wallet"
                      value={pointsPerHeldNFT}
                      contractValue={config?.pointsPerHeldNFT ?? 0}
                      onChange={setPointsPerHeldNFT}
                      onSave={() => saveField('pointsPerHeldNFT', 'setPointsPerHeldNFT', [BigInt(pointsPerHeldNFT)])}
                    />
                    <FieldInput
                      fieldKey="holderTierCooldown"
                      label="Cooldown (seconds)"
                      hint="Seconds between claims for holders"
                      value={holderTierCooldown}
                      contractValue={config?.holderTierCooldown ?? 0}
                      onChange={setHolderTierCooldown}
                      onSave={() => saveField('holderTierCooldown', 'setHolderTierCooldown', [BigInt(holderTierCooldown)])}
                    />
                  </div>
                </div>

                {/* ── Regular Tier ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Regular Tier</h2>
                  <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Users with no Shellies NFTs</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FieldInput
                      fieldKey="regularTierCostEth"
                      label="Cost (ETH)"
                      hint="ETH amount regular users pay"
                      value={regularTierCostEth}
                      contractValue={config?.regularTierCostEth ?? '0'}
                      onChange={setRegularTierCostEth}
                      onSave={() => saveField('regularTierCostEth', 'setRegularTierCost', [parseEther(regularTierCostEth)])}
                      type="number"
                      step="0.0001"
                      placeholder="0.001"
                    />
                    <FieldInput
                      fieldKey="rewardPerRegularUser"
                      label="Reward (points)"
                      hint="Fixed points for regular users"
                      value={rewardPerRegularUser}
                      contractValue={config?.rewardPerRegularUser ?? 0}
                      onChange={setRewardPerRegularUser}
                      onSave={() => saveField('rewardPerRegularUser', 'setRewardPerRegularUser', [BigInt(rewardPerRegularUser)])}
                    />
                    <FieldInput
                      fieldKey="regularTierCooldown"
                      label="Cooldown (seconds)"
                      hint="Seconds between claims for regular users"
                      value={regularTierCooldown}
                      contractValue={config?.regularTierCooldown ?? 0}
                      onChange={setRegularTierCooldown}
                      onSave={() => saveField('regularTierCooldown', 'setRegularTierCooldown', [BigInt(regularTierCooldown)])}
                    />
                  </div>
                </div>

                {/* ── XP Conversion (On-Chain) ── */}
                <div className={cardCls}>
                  <h2 className={`text-base font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>XP Conversion (On-Chain)</h2>
                  <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Controls how game XP converts to ShelliesPoints tokens on-chain</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FieldInput
                      fieldKey="xpConversionRate"
                      label="XP Conversion Rate"
                      hint="XP per point (e.g. 2 means 100 XP = 50 pts)"
                      value={xpConversionRate}
                      contractValue={config?.xpConversionRate ?? 0}
                      onChange={setXpConversionRate}
                      onSave={() => saveField('xpConversionRate', 'setXpConversionRate', [BigInt(xpConversionRate)])}
                    />
                    <FieldInput
                      fieldKey="minXpToConvert"
                      label="Minimum XP to Convert"
                      hint="Minimum XP required to perform a conversion"
                      value={minXpToConvert}
                      contractValue={config?.minXpToConvert ?? 0}
                      onChange={setMinXpToConvert}
                      onSave={() => saveField('minXpToConvert', 'setMinXpToConvert', [BigInt(minXpToConvert)])}
                    />
                    <FieldInput
                      fieldKey="xpConversionFeeUsd"
                      label="Conversion Fee (USD)"
                      hint="Fee users pay to convert XP (saved to DB)"
                      value={xpConversionFeeUsd}
                      contractValue={xpConversionFeeUsdOriginal}
                      onChange={setXpConversionFeeUsd}
                      onSave={() => {
                        saveDbField('xpConversionFeeUsd', 'feeUsd', xpConversionFeeUsd);
                        setXpConversionFeeUsdOriginal(xpConversionFeeUsd);
                      }}
                      type="number"
                      step="0.01"
                      placeholder="0.10"
                    />
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
                      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
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
