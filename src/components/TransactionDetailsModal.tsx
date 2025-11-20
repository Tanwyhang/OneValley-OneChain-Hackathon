/**
 * Transaction Details Modal Component
 *
 * Displays comprehensive blockchain transaction details for completed trades.
 * Shows transaction hash, gas fees, block confirmation, NFT transfers, and more.
 */

import React, { useState, useEffect } from 'react';
import { EventBus } from '../game/EventBus';
import { getTransactionUrl, testTransactionUrl } from '../config/contracts';

export interface TransactionDetails {
  transactionHash: string;
  blockNumber?: number;
  blockConfirmation?: string;
  gasUsed: number;
  gasPrice: string;
  gasCost: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  itemsTraded: {
    playerItems: Array<{
      id: string;
      name: string;
      quantity: number;
      spriteKey: string;
    }>;
    npcItems: Array<{
      id: string;
      name: string;
      quantity: number;
      spriteKey: string;
    }>;
  };
  nftTransfers?: Array<{
    from: string;
    to: string;
    tokenId: string;
    contractAddress: string;
  }>;
  escrowEvents?: Array<{
    type: 'locked' | 'unlocked';
    itemId: string;
    timestamp: number;
  }>;
}

interface TransactionDetailsModalProps {
  isOpen: boolean;
  transaction: TransactionDetails | null;
  onClose: () => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  transaction,
  onClose
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('items');

  if (!isOpen || !transaction) {
    return null;
  }

  const getStatusColor = (status: TransactionDetails['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-500';
      case 'confirmed':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: TransactionDetails['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'confirmed':
        return '✓';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  const copyTransactionHash = () => {
    if (transaction.transactionHash) {
      navigator.clipboard.writeText(transaction.transactionHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const openBlockchainExplorer = () => {
    // Open the transaction in OneChain blockchain explorer
    console.log('Opening transaction:', transaction.transactionHash);
    const explorerUrl = getTransactionUrl(transaction.transactionHash);
    console.log('Explorer URL:', explorerUrl);

    if (!transaction.transactionHash || transaction.transactionHash === '') {
      console.error('No transaction hash available');
      alert('No transaction hash available');
      return;
    }

    if (explorerUrl) {
      try {
        // Try multiple approaches to open the link
        const newWindow = window.open(explorerUrl, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          // Fallback for popup blockers
          console.log('Popup blocked, trying fallback');
          window.location.href = explorerUrl;
        }
      } catch (error) {
        console.error('Error opening URL:', error);
        // Copy to clipboard as fallback
        navigator.clipboard.writeText(explorerUrl);
        alert('Transaction URL copied to clipboard: ' + explorerUrl);
      }
    } else {
      console.error('No explorer URL generated');
      alert('Failed to generate transaction URL');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
      <div className="bg-gray-900 text-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <span className="text-2xl">{getStatusIcon(transaction.status)}</span>
              Transaction Details
            </h2>
            <p className="text-gray-400">
              Trade with Herman completed on {formatDate(transaction.timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Transaction Status */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Status:</span>
            <span className={`font-bold ${getStatusColor(transaction.status)}`}>
              {transaction.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Transaction Hash */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Transaction Hash</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={transaction.transactionHash}
              readOnly
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 font-mono text-sm"
            />
            <button
              onClick={copyTransactionHash}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              {copiedHash ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={openBlockchainExplorer}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              View on Explorer
            </button>
            <button
              onClick={() => {
                console.log('Test URL:', testTransactionUrl());
                window.open(testTransactionUrl(), '_blank');
              }}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              title="Test with sample transaction"
            >
              Test URL
            </button>
          </div>
        </div>

        {/* Block Information */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {transaction.blockNumber && (
            <div>
              <label className="block text-sm font-medium mb-2">Block Number</label>
              <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2">
                {transaction.blockNumber}
              </div>
            </div>
          )}
          {transaction.blockConfirmation && (
            <div>
              <label className="block text-sm font-medium mb-2">Block Confirmation</label>
              <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 font-mono text-sm">
                {transaction.blockConfirmation}
              </div>
            </div>
          )}
        </div>

        {/* Gas Information */}
        <div className="mb-6">
          <h3
            className="text-lg font-semibold mb-3 cursor-pointer flex items-center gap-2"
            onClick={() => toggleSection('gas')}
          >
            <span className="text-sm">{expandedSection === 'gas' ? '▼' : '▶'}</span>
            Gas Information
          </h3>
          {expandedSection === 'gas' && (
            <div className="grid grid-cols-3 gap-4 bg-gray-800 p-4 rounded-lg">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Gas Used</label>
                <div className="font-semibold">{transaction.gasUsed.toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Gas Price</label>
                <div className="font-semibold">{transaction.gasPrice}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Total Cost</label>
                <div className="font-semibold text-green-400">{transaction.gasCost}</div>
              </div>
            </div>
          )}
        </div>

        {/* Items Traded */}
        <div className="mb-6">
          <h3
            className="text-lg font-semibold mb-3 cursor-pointer flex items-center gap-2"
            onClick={() => toggleSection('items')}
          >
            <span className="text-sm">{expandedSection === 'items' ? '▼' : '▶'}</span>
            Items Traded
          </h3>
          {expandedSection === 'items' && (
            <div className="grid grid-cols-2 gap-4">
              {/* Player Items */}
              <div>
                <h4 className="font-semibold text-blue-400 mb-2">You Gave:</h4>
                <div className="space-y-2">
                  {transaction.itemsTraded.playerItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 bg-gray-800 p-2 rounded">
                      <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                        <span className="text-xs">📦</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-400">Quantity: {item.quantity}</div>
                      </div>
                    </div>
                  ))}
                  {transaction.itemsTraded.playerItems.length === 0 && (
                    <div className="text-gray-500 italic">No items</div>
                  )}
                </div>
              </div>

              {/* NPC Items */}
              <div>
                <h4 className="font-semibold text-green-400 mb-2">You Received:</h4>
                <div className="space-y-2">
                  {transaction.itemsTraded.npcItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 bg-gray-800 p-2 rounded">
                      <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                        <span className="text-xs">🎁</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-400">Quantity: {item.quantity}</div>
                      </div>
                    </div>
                  ))}
                  {transaction.itemsTraded.npcItems.length === 0 && (
                    <div className="text-gray-500 italic">No items</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NFT Transfers */}
        {transaction.nftTransfers && transaction.nftTransfers.length > 0 && (
          <div className="mb-6">
            <h3
              className="text-lg font-semibold mb-3 cursor-pointer flex items-center gap-2"
              onClick={() => toggleSection('nft')}
            >
              <span className="text-sm">{expandedSection === 'nft' ? '▼' : '▶'}</span>
              NFT Transfers
            </h3>
            {expandedSection === 'nft' && (
              <div className="space-y-2 bg-gray-800 p-4 rounded-lg">
                {transaction.nftTransfers.map((transfer, index) => (
                  <div key={index} className="text-sm">
                    <div className="font-medium">Token #{transfer.tokenId}</div>
                    <div className="text-gray-400">
                      From: {transfer.from.substring(0, 8)}... → To: {transfer.to.substring(0, 8)}...
                    </div>
                    <div className="text-gray-500 font-mono text-xs">
                      Contract: {transfer.contractAddress.substring(0, 16)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Escrow Events */}
        {transaction.escrowEvents && transaction.escrowEvents.length > 0 && (
          <div className="mb-6">
            <h3
              className="text-lg font-semibold mb-3 cursor-pointer flex items-center gap-2"
              onClick={() => toggleSection('escrow')}
            >
              <span className="text-sm">{expandedSection === 'escrow' ? '▼' : '▶'}</span>
              Escrow Events
            </h3>
            {expandedSection === 'escrow' && (
              <div className="space-y-2 bg-gray-800 p-4 rounded-lg">
                {transaction.escrowEvents.map((event, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div>
                      <span className={`font-medium ${
                        event.type === 'locked' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {event.type === 'locked' ? '🔒 Locked' : '🔓 Unlocked'}
                      </span>
                      <span className="text-gray-400 ml-2">Item #{event.itemId}</span>
                    </div>
                    <div className="text-gray-500">
                      {formatDate(event.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium"
          >
            Close
          </button>
          <button
            onClick={() => {
              EventBus.emit('share-transaction', transaction);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailsModal;