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
        return 'px-6 py-3 text-lg font-semibold';
      case 'md':
        return 'px-8 py-4 text-xl font-semibold';
      case 'lg':
        return 'px-12 py-5 text-xl font-bold';
      case 'xl':
        return 'px-16 py-6 text-2xl font-bold';
      default:
        return 'px-8 py-4 text-xl font-semibold';
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
        // Note: If your app doesn't use authentication, you
        // can remove all 'authenticationStatus' checks
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className={`btn-primary ${getSizeClasses()} shadow-lg transform hover:scale-105 transition-all ${className}`}
                  >
                    🔗 Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={`btn-primary ${getSizeClasses()} shadow-lg transform hover:scale-105 transition-all bg-red-600 hover:bg-red-700 ${className}`}
                  >
                    ⚠️ Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-3">
                  <button
                    onClick={openChainModal}
                    className="btn-secondary px-4 py-2 text-sm font-medium transform hover:scale-105 transition-all"
                    type="button"
                  >
                    {chain.hasIcon && (
                      <div
                        className="inline-block w-4 h-4 mr-2"
                        style={{
                          background: chain.iconUrl ? `url(${chain.iconUrl})` : undefined,
                          backgroundSize: 'cover',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className={`btn-primary ${getSizeClasses()} shadow-lg transform hover:scale-105 transition-all ${className}`}
                  >
                    👤 {account.displayName}
                    {account.displayBalance
                      ? ` (${account.displayBalance})`
                      : ''}
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