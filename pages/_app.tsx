import React from 'react';
import type { AppProps } from 'next/app';
import { AptosWalletAdapterProvider, type AvailableWallets } from '@aptos-labs/wallet-adapter-react';
import '@/styles/globals.css';
import '@aptos-labs/wallet-adapter-ant-design/dist/index.css';


const wallets: Readonly<AvailableWallets[]> = ['Petra'];

export default function App({ Component, pageProps }: AppProps) {
  return (

    <AptosWalletAdapterProvider autoConnect optInWallets={wallets}>
      <Component {...pageProps} />
    </AptosWalletAdapterProvider>
  );
}