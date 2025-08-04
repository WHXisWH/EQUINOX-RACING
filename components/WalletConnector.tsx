import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';

export function WalletConnector() {
  const { connected, account } = useWallet();

  return (
    <div className="absolute top-4 right-4">
      <div className="flex items-center space-x-4">
        {connected && account && (
          <div className="px-4 py-2 bg-white rounded-lg shadow-md text-sm">
            <p className="font-mono text-gray-700 truncate max-w-[150px]">
              {account.address.toString()}
            </p>
          </div>
        )}
        <WalletSelector />
      </div>
    </div>
  );
}