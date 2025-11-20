/**
 * OneChain Item Display Component
 *
 * Enhanced item display component that shows full blockchain attributes
 * and detailed information about OneChain items.
 */

import React, { useState } from 'react';
import {
  ExtendedFrontendItem,
  MarketplaceListing,
  ITEM_TYPES,
  RARITY_LEVELS,
} from '@/types/onechain';
import OneChainMarketplaceService from '@/services/OneChainMarketplaceService';
import OneChainTransactionFlow, { TransactionType } from '@/services/OneChainTransactionFlow';
import OneChainPurchaseConfirmationDialog from './OneChainPurchaseConfirmationDialog';
import OneChainTransactionViewerModal from './OneChainTransactionViewerModal';

interface OneChainItemDisplayProps {
  item: ExtendedFrontendItem;
  listing?: MarketplaceListing;
  showPrice?: boolean;
  showBlockchainInfo?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  onBuy?: () => void;
  onViewDetails?: () => void;
}

export const OneChainItemDisplay: React.FC<OneChainItemDisplayProps> = ({
  item,
  listing,
  showPrice = true,
  showBlockchainInfo = true,
  size = 'medium',
  onClick,
  onBuy,
  onViewDetails,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showTransactionViewer, setShowTransactionViewer] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);

  const service = OneChainMarketplaceService.getInstance();
  const transactionFlow = OneChainTransactionFlow.getInstance();

  // Size configurations
  const sizeConfig = {
    small: {
      container: 'w-24 h-32',
      image: 'w-12 h-12',
      title: 'text-xs',
      price: 'text-xs',
    },
    medium: {
      container: 'w-32 h-40',
      image: 'w-16 h-16',
      title: 'text-sm',
      price: 'text-sm',
    },
    large: {
      container: 'w-48 h-64',
      image: 'w-24 h-24',
      title: 'text-base',
      price: 'text-base',
    },
  };

  const config = sizeConfig[size];

  const getItemIcon = () => {
    switch (item.item_type) {
      case ITEM_TYPES.WEAPON: return '⚔️';
      case ITEM_TYPES.ARMOR: return '🛡️';
      case ITEM_TYPES.CONSUMABLE: return '🧪';
      case ITEM_TYPES.RESOURCE: return '💎';
      default: return '📦';
    }
  };

  const getRarityIcon = () => {
    switch (item.rarity) {
      case RARITY_LEVELS.COMMON: return '⚪';
      case RARITY_LEVELS.RARE: return '🔵';
      case RARITY_LEVELS.EPIC: return '🟣';
      case RARITY_LEVELS.LEGENDARY: return '🟡';
      default: return '⚪';
    }
  };

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} ◈`;
  };

  const handleBuyClick = () => {
    if (listing && onBuy) {
      setShowConfirmDialog(true);
    }
  };

  const handlePurchaseConfirmation = async (listingId: string) => {
    if (!listing) return;

    setIsPurchasing(true);
    setShowConfirmDialog(false);

    try {
      // Execute the OneChain transaction flow
      const transaction = await transactionFlow.executeTransaction(
        TransactionType.PURCHASE,
        { listingId },
        // onStepUpdate callback to track progress
        (flow) => {
          console.log('Transaction progress:', flow.currentStep, flow.steps[flow.currentStep]?.name);
        },
        // onComplete callback
        (completedFlow) => {
          setCompletedTransaction(completedFlow);
          setIsPurchasing(false);
          setShowTransactionViewer(true);
        },
        // onError callback
        (flow, error) => {
          console.error('Transaction failed:', error);
          setIsPurchasing(false);
          // You could show an error notification here
        }
      );

      // Also call the original onBuy callback if provided
      if (onBuy) {
        onBuy();
      }
    } catch (error) {
      console.error('Purchase error:', error);
      setIsPurchasing(false);
      // You could show an error notification here
    }
  };

  return (
    <>
      <div
        className={`
          ${config.container}
          bg-gray-800 rounded-lg border border-gray-700
          hover:border-blue-500 transition-all duration-200
          flex flex-col items-center justify-center p-2
          relative cursor-pointer
          ${item.locked ? 'opacity-60' : ''}
        `}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Lock indicator */}
        {item.locked && (
          <div className="absolute top-1 right-1 text-yellow-500">
            🔒
          </div>
        )}

        {/* Stack count */}
        {item.stack_size && item.stack_size > 1 && (
          <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs rounded px-1">
            ×{item.stack_size}
          </div>
        )}

        {/* Item Image/Icon */}
        <div className={`${config.image} bg-gray-700 rounded-lg flex items-center justify-center mb-2`}>
          <span className="text-2xl">{getItemIcon()}</span>
        </div>

        {/* Rarity indicator */}
        <div className="flex items-center space-x-1 mb-1">
          <span className="text-sm">{getRarityIcon()}</span>
          <span
            className={`font-medium ${config.title}`}
            style={{ color: item.rarity_color }}
          >
            {item.formatted_rarity}
          </span>
        </div>

        {/* Item name */}
        <div className={`text-white font-medium ${config.title} text-center truncate w-full mb-1`}>
          {item.name}
        </div>

        {/* Item type */}
        <div className="text-gray-400 text-xs text-center truncate w-full mb-1">
          {item.formatted_item_type}
        </div>

        {/* Price */}
        {showPrice && listing && (
          <div className={`text-green-400 font-medium ${config.price} mt-auto`}>
            {formatPrice(listing.price)}
          </div>
        )}

        {/* Blockchain indicator */}
        {showBlockchainInfo && (
          <div className="absolute bottom-1 right-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(true);
              }}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              📋
            </button>
          </div>
        )}

        {/* Buy button */}
        {onBuy && listing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBuyClick();
            }}
            disabled={isPurchasing}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-xs px-2 py-1 rounded mt-2"
          >
            {isPurchasing ? 'Buying...' : 'Buy'}
          </button>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">{getItemIcon()}</span>
            <span className="text-white font-medium">{item.name}</span>
          </div>
          <div className="text-gray-400 text-xs space-y-1">
            <div>Type: {item.formatted_item_type}</div>
            <div>Rarity: <span style={{ color: item.rarity_color }}>{item.formatted_rarity}</span></div>
            {item.display_stats && item.display_stats.length > 0 && (
              <div>Stats: {item.display_stats.join(', ')}</div>
            )}
            {listing && (
              <div className="text-green-400">Price: {formatPrice(listing.price)}</div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Item Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{getItemIcon()}</span>
                  <div>
                    <h2 className="text-xl font-bold text-white">{item.name}</h2>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getRarityIcon()}</span>
                      <span
                        className="font-medium"
                        style={{ color: item.rarity_color }}
                      >
                        {item.formatted_rarity} {item.formatted_item_type}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Description */}
              <div className="mb-6">
                <h3 className="text-white font-medium mb-2">Description</h3>
                <p className="text-gray-400">{item.description}</p>
              </div>

              {/* Stats */}
              {item.display_stats && item.display_stats.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-2">Stats</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {item.display_stats.map((stat, index) => (
                      <div key={index} className="bg-gray-800 rounded px-3 py-2">
                        <span className="text-gray-400 text-sm">{stat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blockchain Information */}
              {showBlockchainInfo && (
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-2">Blockchain Information</h3>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Item ID:</span>
                      <span className="text-white">#{item.item_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contract:</span>
                      <span className="text-white font-mono text-xs">
                        {item.id.slice(0, 10)}...{item.id.slice(-8)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Minted by:</span>
                      <span className="text-white">{item.formatted_minter}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Created:</span>
                      <span className="text-white">{item.formatted_timestamp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Owners:</span>
                      <span className="text-white">{item.owner_history.length}</span>
                    </div>
                    {listing && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Listed by:</span>
                          <span className="text-white">{service.formatAddress(listing.seller)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Transaction:</span>
                          <span className="text-white font-mono text-xs">
                            {service.formatTransactionHash(listing.transaction_hash)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Ownership History */}
              {item.formatted_owners && item.formatted_owners.length > 1 && (
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-2">Ownership History</h3>
                  <div className="bg-gray-800 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <div className="space-y-1 text-sm">
                      {item.formatted_owners.map((owner, index, ownersArray) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-gray-500">#{index + 1}:</span>
                          <span className="text-white">{owner}</span>
                          {index === 0 && (
                            <span className="text-blue-400 text-xs">(Creator)</span>
                          )}
                          {index === ownersArray.length - 1 && (
                            <span className="text-green-400 text-xs">(Current)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                {onBuy && listing && (
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      handleBuyClick();
                    }}
                    disabled={isPurchasing}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white px-6 py-2 rounded transition-colors"
                  >
                    Buy for {formatPrice(listing.price)}
                  </button>
                )}
                <button
                  onClick={() => setShowDetails(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Confirmation Dialog */}
      <OneChainPurchaseConfirmationDialog
        listing={listing || null}
        item={item}
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handlePurchaseConfirmation}
        isLoading={isPurchasing}
      />

      {/* Transaction Viewer Modal */}
      <OneChainTransactionViewerModal
        transaction={completedTransaction}
        isOpen={showTransactionViewer}
        onClose={() => {
          setShowTransactionViewer(false);
          setCompletedTransaction(null);
        }}
      />
    </>
  );
};

// Marketplace Grid Component
interface OneChainMarketplaceGridProps {
  listings: MarketplaceListing[];
  onItemSelect?: (listing: MarketplaceListing) => void;
  onBuy?: (listing: MarketplaceListing) => void;
  columns?: number;
}

export const OneChainMarketplaceGrid: React.FC<OneChainMarketplaceGridProps> = ({
  listings,
  onItemSelect,
  onBuy,
  columns = 6,
}) => {
  return (
    <div
      className="grid gap-4 w-full"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {listings.map(listing => (
        <OneChainItemDisplay
          key={listing.id}
          item={{
            ...listing.item,
            listing_id: listing.id,
            listing_price: listing.price,
            listing_seller: listing.seller,
            listed_at: listing.listed_at,
            display_stats: OneChainMarketplaceService.getInstance().getItemStatsDisplay(listing.item),
            formatted_rarity: listing.item.rarity === 1 ? 'Common' :
                             listing.item.rarity === 2 ? 'Rare' :
                             listing.item.rarity === 3 ? 'Epic' : 'Legendary',
            rarity_color: listing.item.rarity === 1 ? '#9CA3AF' :
                          listing.item.rarity === 2 ? '#3B82F6' :
                          listing.item.rarity === 3 ? '#8B5CF6' : '#F59E0B',
            formatted_item_type: listing.item.item_type === 1 ? 'Weapon' :
                               listing.item.item_type === 2 ? 'Armor' :
                               listing.item.item_type === 3 ? 'Consumable' : 'Resource',
            formatted_minter: OneChainMarketplaceService.getInstance().formatAddress(listing.item.minted_by),
            formatted_owners: listing.item.owner_history.map(owner =>
              OneChainMarketplaceService.getInstance().formatAddress(owner)
            ),
            formatted_timestamp: OneChainMarketplaceService.getInstance().formatTimestamp(listing.item.mint_timestamp),
          }}
          listing={listing}
          onClick={() => onItemSelect?.(listing)}
          onBuy={() => onBuy?.(listing)}
        />
      ))}
    </div>
  );
};

export default OneChainItemDisplay;