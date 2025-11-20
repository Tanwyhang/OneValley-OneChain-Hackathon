/**
 * OneChain Test Mint Component
 *
 * Test component for verifying real blockchain minting functionality.
 * Allows manual testing of the harvesting and minting flow.
 */

import React, { useState } from 'react';
import WalletBridgeService from '@/services/WalletBridgeService';
import { CropData } from '@/services/OneChainHarvester';

const OneChainTestMint: React.FC = () => {
  const [isMinting, setIsMinting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<any>(null);

  const walletBridge = WalletBridgeService.getInstance();
  const harvester = walletBridge.getHarvester();

  const checkWalletStatus = async () => {
    try {
      const status = await harvester?.checkWalletStatus();
      setWalletStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check wallet status');
    }
  };

  const testMint = async () => {
    if (!harvester) {
      setError('Harvester not initialized');
      return;
    }

    setIsMinting(true);
    setError(null);
    setResult(null);

    try {
      // Create test crop data
      const testCrops: CropData[] = [
        {
          type: 'carrot',
          quality: 85,
          quantity: 1,
          harvestTimestamp: Date.now()
        },
        {
          type: 'carrot',
          quality: 92,
          quantity: 1,
          harvestTimestamp: Date.now() + 1000
        },
        {
          type: 'carrot',
          quality: 78,
          quantity: 1,
          harvestTimestamp: Date.now() + 2000
        }
      ];

      // Execute minting
      const mintResult = await harvester.mintHarvestedCrops(testCrops);
      setResult(mintResult);

      if (mintResult.success) {
        console.log('Minting successful:', mintResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Minting failed');
    } finally {
      setIsMinting(false);
    }
  };

  const getTransactionExplorerUrl = (hash: string) => {
    return walletBridge.getTransactionExplorerUrl(hash);
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">🥕 OneChain Test Mint</h2>

      <div className="space-y-4">
        {/* Wallet Status Section */}
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-2">Wallet Status</h3>
          <button
            onClick={checkWalletStatus}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded mr-2"
            disabled={isMinting}
          >
            Check Wallet
          </button>

          {walletStatus && (
            <div className="mt-2 text-sm">
              <p>Connected: <span className={walletStatus.connected ? 'text-green-400' : 'text-red-400'}>
                {walletStatus.connected ? 'Yes' : 'No'}
              </span></p>
              {walletStatus.address && (
                <p>Address: <span className="text-gray-400 font-mono text-xs">
                  {walletStatus.address.slice(0, 10)}...{walletStatus.address.slice(-8)}
                </span></p>
              )}
              {walletStatus.balance && (
                <p>Balance: <span className="text-green-400">{walletStatus.balance} SUI</span></p>
              )}
              {walletStatus.sufficientBalance !== undefined && (
                <p>Sufficient Balance: <span className={walletStatus.sufficientBalance ? 'text-green-400' : 'text-red-400'}>
                  {walletStatus.sufficientBalance ? 'Yes' : 'No'}
                </span></p>
              )}
            </div>
          )}
        </div>

        {/* Mint Test Section */}
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-2">Test Minting</h3>
          <p className="text-sm text-gray-400 mb-4">
            Test real blockchain minting of 3 Carrot NFTs with varying quality (78-92%)
          </p>

          <button
            onClick={testMint}
            disabled={isMinting || !walletStatus?.connected}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-semibold"
          >
            {isMinting ? '⏳ Minting...' : '🚀 Test Mint 3 Carrots'}
          </button>

          {!walletStatus?.connected && (
            <p className="text-yellow-400 text-sm mt-2">
              ⚠️ Please connect your wallet first
            </p>
          )}
        </div>

        {/* Loading State */}
        {isMinting && (
          <div className="bg-blue-900 p-4 rounded text-center">
            <div className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent mr-2"></div>
            Minting in progress... Please approve the transaction in your wallet.
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 p-4 rounded">
            <h4 className="font-semibold text-red-300">Error:</h4>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Success Result */}
        {result && result.success && (
          <div className="bg-green-900 p-4 rounded">
            <h4 className="font-semibold text-green-300">✅ Minting Successful!</h4>
            <div className="text-sm mt-2 space-y-1">
              <p>Transaction Hash:
                <a
                  href={getTransactionExplorerUrl(result.transactionHash!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline ml-2 font-mono"
                >
                  {result.transactionHash?.slice(0, 10)}...{result.transactionHash?.slice(-8)}
                </a>
              </p>
              {result.blockNumber && (
                <p>Block Number: {result.blockNumber}</p>
              )}
              {result.itemIds && result.itemIds.length > 0 && (
                <p>Minted Items: {result.itemIds.length} NFTs</p>
              )}
              {result.transactionFlow && (
                <p>Gas Used: {result.transactionFlow.gasUsed.toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {/* Failed Result */}
        {result && !result.success && (
          <div className="bg-red-900 p-4 rounded">
            <h4 className="font-semibold text-red-300">❌ Minting Failed</h4>
            <p className="text-sm">{result.error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-800 p-4 rounded text-sm text-gray-400">
          <h4 className="font-semibold text-white mb-2">Instructions:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Connect your OneChain wallet using the main app interface</li>
            <li>Click "Check Wallet" to verify connection and balance</li>
            <li>Ensure you have at least 0.01 SUI for gas fees</li>
            <li>Click "Test Mint 3 Carrots" to execute real blockchain minting</li>
            <li>Approve the transaction in your wallet when prompted</li>
            <li>View the transaction details and explorer link after completion</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default OneChainTestMint;