'use client';

import { WalletProvider } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';

interface WalletProviderWrapperProps {
  children: React.ReactNode;
}

export default function WalletProviderWrapper({ children }: WalletProviderWrapperProps) {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}