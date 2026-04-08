'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

interface CustomConnectButtonProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function CustomConnectButton({ size = 'md', className = '' }: CustomConnectButtonProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-5 py-2 text-sm rounded-lg';
      case 'md':
        return 'px-6 py-2.5 text-sm rounded-xl';
      case 'lg':
        return 'px-7 py-3.5 text-sm rounded-xl';
      case 'xl':
        return 'px-8 py-3.5 text-sm rounded-xl';
      default:
        return 'px-6 py-2.5 text-sm rounded-xl';
    }
  };

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className={`inline-flex items-center gap-2 font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors ${getSizeClasses()} ${className}`}
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={`inline-flex items-center gap-2 font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors ${getSizeClasses()} ${className}`}
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white border border-white/15 hover:border-white/30 rounded-lg transition-colors"
                    type="button"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name}
                        className="inline-block w-3.5 h-3.5 mr-1.5 rounded-full"
                      />
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className={`inline-flex items-center gap-2 font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors ${getSizeClasses()} ${className}`}
                  >
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
