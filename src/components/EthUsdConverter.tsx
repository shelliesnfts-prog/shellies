'use client';

import { useState, useEffect } from 'react';
import { parseEther, formatEther } from 'viem';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { PriceOracle } from '@/lib/price-oracle';

interface EthUsdConverterProps {
  isDarkMode: boolean;
  onEthAmountChange: (ethAmount: bigint) => void;
  initialEthAmount?: number;
}

export default function EthUsdConverter({ 
  isDarkMode, 
  onEthAmountChange,
  initialEthAmount = 0.00001 
}: EthUsdConverterProps) {
  const [usdAmount, setUsdAmount] = useState<string>('0');
  const [ethAmount, setEthAmount] = useState<string>(initialEthAmount.toString());
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch ETH price
  const fetchEthPrice = async () => {
    setLoading(true);
    try {
      const price = await PriceOracle.getEthPrice();
      setEthPrice(price);
      
      // Calculate USD amount based on initial ETH
      if (price && initialEthAmount > 0) {
        const usd = initialEthAmount * price;
        setUsdAmount(usd.toFixed(4));
        onEthAmountChange(parseEther(initialEthAmount.toString()));
      }
    } catch (error) {
      console.error('Error fetching ETH price:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch price on mount
  useEffect(() => {
    fetchEthPrice();
  }, []);

  // Update ETH amount when USD amount changes
  const handleUsdChange = (value: string) => {
    setUsdAmount(value);
    
    const usd = parseFloat(value);
    if (ethPrice && !isNaN(usd) && usd > 0) {
      const eth = usd / ethPrice;
      setEthAmount(eth.toFixed(8));
      onEthAmountChange(parseEther(eth.toString()));
    } else {
      setEthAmount('0');
      onEthAmountChange(BigInt(0));
    }
  };

  // Update USD amount when ETH amount changes
  const handleEthChange = (value: string) => {
    setEthAmount(value);
    
    const eth = parseFloat(value);
    if (ethPrice && !isNaN(eth) && eth > 0) {
      const usd = eth * ethPrice;
      setUsdAmount(usd.toFixed(4));
      onEthAmountChange(parseEther(eth.toString()));
    } else {
      setUsdAmount('0');
      onEthAmountChange(BigInt(0));
    }
  };

  return (
    <div className={`rounded-xl p-6 border ${
      isDarkMode 
        ? 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-700/50' 
        : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          ETH/USD Converter
        </h3>
        <button
          onClick={fetchEthPrice}
          disabled={loading}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode 
              ? 'text-purple-400 hover:bg-gray-700' 
              : 'text-purple-600 hover:bg-purple-100'
          }`}
          title="Refresh ETH price"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {ethPrice && (
        <div className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Current ETH Price: ${ethPrice.toLocaleString()}
        </div>
      )}

      <div className="space-y-4">
        {/* USD Input */}
        <div>
          <label className={`block text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            USD Amount
          </label>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={usdAmount}
              onChange={(e) => handleUsdChange(e.target.value)}
              className={`w-full pl-7 pr-4 py-3 rounded-lg border transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-white focus:border-purple-500' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
              } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
              placeholder="0.04"
            />
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
        </div>

        {/* ETH Input */}
        <div>
          <label className={`block text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            ETH Amount
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.00000001"
              min="0"
              value={ethAmount}
              onChange={(e) => handleEthChange(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-white focus:border-purple-500' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
              } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
              placeholder="0.00001"
            />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>ETH</span>
          </div>
        </div>
      </div>
    </div>
  );
}
