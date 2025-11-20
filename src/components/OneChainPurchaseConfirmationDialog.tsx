/**
 * OneChain Purchase Confirmation Dialog Component
 *
 * Comprehensive confirmation dialog for purchasing items from the OneChain marketplace.
 * Shows detailed item information, pricing breakdown, gas estimation, and wallet balance.
 */

import React, { useState, useEffect } from 'react';
import { MarketplaceListing, ExtendedFrontendItem } from '@/types/onechain';
import OneChainTransactionFlow, { TransactionType, GasEstimate } from '@/services/OneChainTransactionFlow';
import OneChainMarketplaceService from '@/services/OneChainMarketplaceService';

interface OneChainPurchaseConfirmationDialogProps {
  listing: MarketplaceListing | null;
  item: ExtendedFrontendItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (listingId: string) => Promise<void>;
  isLoading?: boolean;
}

export const OneChainPurchaseConfirmationDialog: React.FC<OneChainPurchaseConfirmationDialogProps> = ({
  listing,
  item,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [walletBalance, setWalletBalance] = useState<{ MIST: number; ONE: number }>({ MIST: 0, ONE: 0 });
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transactionFlow = OneChainTransactionFlow.getInstance();
  const marketplaceService = OneChainMarketplaceService.getInstance();

  // Calculate gas estimate and wallet balance when dialog opens
  useEffect(() => {
    if (isOpen && listing) {
      calculateCosts();
    }
  }, [isOpen, listing]);

  const calculateCosts = async () => {
    if (!listing) return;

    setIsCalculating(true);
    setError(null);

    try {
      // Get gas estimate
      const estimate = transactionFlow.estimateTransactionGas(TransactionType.PURCHASE, {
        listingId: listing.id,
      });
      setGasEstimate(estimate);

      // Get mock wallet balance (in real implementation, this would come from wallet)
      const mockBalance = {
        MIST: 10000000000, // 10,000 MIST
        ONE: 1000.5, // 1,000.5 ONE tokens
      };
      setWalletBalance(mockBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate transaction costs');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleConfirm = async () => {
    if (!listing) return;

    try {
      await onConfirm(listing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    }
  };

  const canAfford = () => {
    if (!listing || !gasEstimate) return false;

    const totalCost = listing.price + gasEstimate.totalCost;
    return walletBalance.MIST >= totalCost;
  };

  const formatAmount = (amount: number, symbol: string) => {
    return `${amount.toLocaleString()} ${symbol}`;
  };

  const formatAddress = (address: string) => {
    return marketplaceService.formatAddress(address);
  };

  const getItemIcon = (itemType: number) => {
    switch (itemType) {
      case 1: return '⚔️'; // Weapon
      case 2: return '🛡️'; // Armor
      case 3: return '🧪'; // Consumable
      case 4: return '💎'; // Resource
      default: return '📦';
    }
  };

  const getRarityColor = (rarity: number) => {
    switch (rarity) {
      case 1: return '#9CA3AF'; // Common - gray
      case 2: return '#3B82F6'; // Rare - blue
      case 3: return '#8B5CF6'; // Epic - purple
      case 4: return '#F59E0B'; // Legendary - orange
      default: return '#9CA3AF';
    }
  };

  if (!isOpen || !listing || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Confirm Purchase</h2>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Item Details */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Item Details</h3>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">{getItemIcon(item.item_type)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-white font-medium text-lg">{item.name}</span>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getRarityColor(item.rarity)}20`,
                        color: getRarityColor(item.rarity)
                      }}
                    >
                      {item.formatted_rarity}
                    </span>
                  </div>
                  <div className="text-gray-400 text-sm mb-2">{item.formatted_item_type}</div>
                  {item.display_stats && item.display_stats.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.display_stats.slice(0, 3).map((stat, index) => (
                        <span key={index} className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
                          {stat}
                        </span>
                      ))}
                      {item.display_stats.length > 3 && (
                        <span className="text-gray-500 text-xs">+{item.display_stats.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Transaction Details</h3>
            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Seller:</span>
                <span className="text-white font-mono text-sm">{formatAddress(listing.seller)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Item Price:</span>
                <span className="text-green-400 font-medium">{formatAmount(listing.price, 'MIST')}</span>
              </div>

              {isCalculating ? (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Gas Estimation:</span>
                  <span className="text-yellow-400 text-sm">Calculating...</span>
                </div>
              ) : gasEstimate ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Estimated Gas:</span>
                    <span className="text-blue-400">{formatAmount(gasEstimate.gasLimit, 'gas units')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Gas Cost:</span>
                    <span className="text-blue-400">{formatAmount(gasEstimate.totalCost, 'MIST')}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">Total Cost:</span>
                      <span className="text-green-400 font-medium text-lg">
                        {formatAmount(listing.price + gasEstimate.totalCost, 'MIST')}
                      </span>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="border-t border-gray-700 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Estimated Time:</span>
                  <span className="text-gray-300 text-sm">
                    {gasEstimate ? `${Math.ceil(gasEstimate.estimatedTime / 1000)}s` : 'Calculating...'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Your Wallet</h3>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">MIST Balance</div>
                  <div className={`font-medium ${canAfford() ? 'text-green-400' : 'text-red-400'}`}>
                    {formatAmount(walletBalance.MIST, 'MIST')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">ONE Balance</div>
                  <div className="text-blue-400 font-medium">
                    {formatAmount(walletBalance.ONE, 'ONE')}
                  </div>
                </div>
              </div>
              {!canAfford() && gasEstimate && (
                <div className="mt-3 text-red-400 text-sm">
                  ⚠️ Insufficient MIST balance. You need {formatAmount((listing.price + gasEstimate.totalCost) - walletBalance.MIST, 'MIST')} more.
                </div>
              )}
            </div>
          </div>

          {/* Transaction Hash Preview */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Transaction Information</h3>
            <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Transaction Type:</span>
                <span className="text-white">Marketplace Purchase</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network:</span>
                <span className="text-white">OneChain Mainnet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Smart Contract:</span>
                <span className="text-white font-mono text-xs">OneChain Marketplace</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800 px-6 py-4 border-t border-gray-700">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:opacity-50 text-white px-6 py-3 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || isCalculating || !canAfford()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white px-6 py-3 rounded transition-colors font-medium"
            >
              {isLoading ? 'Processing...' : 'Confirm Purchase'}
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-400 text-center">
            By confirming this transaction, you agree to purchase this item from the marketplace.
            The transaction cannot be reversed once executed.
          </div>
        </div>
      </div>
    </div>
  );
};

export default OneChainPurchaseConfirmationDialog;