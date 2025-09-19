'use client';

import { WalletProvider } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';

interface WalletProviderWrapperProps {
  children: React.ReactNode;
}

export default function WalletProviderWrapper({ children }: WalletProviderWrapperProps) {
  return (
    <WalletProvider
      autoConnect={false}
      // Remove storageKey to prevent auto-reconnection from localStorage
      config={{
        networks: ['sui:mainnet', 'sui:devnet'],
        autoDetection: false // Disable auto-detection to prevent unwanted reconnections
      }}
    >
      {children}
    </WalletProvider>
  );
}