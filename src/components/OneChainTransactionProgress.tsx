/**
 * OneChain Transaction Progress Component
 *
 * React component that displays real-time progress of OneChain transactions
 * with detailed step information and blockchain status.
 */

import React, { useState, useEffect } from 'react';
import OneChainTransactionFlow from '@/services/OneChainTransactionFlow';
import {
  TransactionFlow,
  TransactionStatus,
  TransactionType,
} from '@/services/OneChainTransactionFlow';

interface OneChainTransactionProgressProps {
  flow: TransactionFlow | null;
  onClose?: () => void;
  showDetails?: boolean;
}

export const OneChainTransactionProgress: React.FC<OneChainTransactionProgressProps> = ({
  flow,
  onClose,
  showDetails = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!flow) return null;

  const getStepIcon = (step: any, index: number) => {
    const isCurrentStep = index === flow.currentStep;
    const isCompleted = index < flow.currentStep;
    const isFailed = flow.status === TransactionStatus.FAILED && index === flow.currentStep;

    if (isFailed) return '❌';
    if (isCompleted) return '✅';
    if (isCurrentStep) return '⏳';
    return '⭕';
  };

  const getStepStatus = (step: any, index: number) => {
    const isCurrentStep = index === flow.currentStep;
    const isCompleted = index < flow.currentStep;
    const isFailed = flow.status === TransactionStatus.FAILED && index === flow.currentStep;

    if (isFailed) return 'error';
    if (isCompleted) return 'completed';
    if (isCurrentStep) return 'active';
    return 'pending';
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'active': return 'text-blue-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-500';
    }
  };

  const getProgressPercentage = () => {
    return (flow.currentStep / flow.steps.length) * 100;
  };

  const formatTransactionType = (type: TransactionType) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                {formatTransactionType(flow.type)}
              </h3>
              <p className="text-gray-400 text-sm">
                {OneChainTransactionFlow.getInstance().formatTransactionStatus(flow.status)}
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4">
          <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {flow.steps.map((step, index) => {
              const stepStatus = getStepStatus(step, index);
              const stepColor = getStepColor(stepStatus);

              return (
                <div
                  key={step.id}
                  className={`
                    flex items-start space-x-3 p-3 rounded-lg transition-colors
                    ${stepStatus === 'active' ? 'bg-gray-800 border border-blue-500' : ''}
                    ${stepStatus === 'completed' ? 'bg-gray-800' : ''}
                    ${stepStatus === 'error' ? 'bg-gray-800 border border-red-500' : ''}
                    ${stepStatus === 'pending' ? 'opacity-50' : ''}
                  `}
                >
                  <div className={`text-xl ${stepColor}`}>
                    {getStepIcon(step, index)}
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${stepColor}`}>
                      {step.name}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transaction Details */}
          {(expanded || showDetails) && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Transaction Hash:</span>
                  <span className="text-white font-mono">
                    {OneChainTransactionFlow.getInstance().formatTransactionHash(flow.transactionHash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gas Used:</span>
                  <span className="text-white">{flow.gasUsed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gas Cost:</span>
                  <span className="text-white">{flow.gasCost.toFixed(4)} ◈</span>
                </div>
                {flow.blockNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Block:</span>
                    <span className="text-white">#{flow.blockNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white">
                    {OneChainTransactionFlow.getInstance().formatTransactionDuration(flow)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {flow.error && (
            <div className="mt-4 p-3 bg-red-900 bg-opacity-25 border border-red-600 text-red-400 rounded-lg">
              <div className="font-medium mb-1">Transaction Failed</div>
              <div className="text-sm">{flow.error}</div>
            </div>
          )}

          {/* Success Message */}
          {flow.status === TransactionStatus.COMPLETED && (
            <div className="mt-4 p-3 bg-green-900 bg-opacity-25 border border-green-600 text-green-400 rounded-lg">
              <div className="font-medium">Transaction Completed Successfully!</div>
              {flow.events.length > 0 && (
                <div className="text-sm mt-1">
                  {flow.events.length} blockchain events generated
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex space-x-3">
            {!showDetails && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                {expanded ? 'Hide Details' : 'Show Details'}
              </button>
            )}
            {flow.status === TransactionStatus.COMPLETED && onClose && (
              <button
                onClick={onClose}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
              >
                Done
              </button>
            )}
            {flow.status === TransactionStatus.FAILED && onClose && (
              <button
                onClick={onClose}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Transaction Queue Component for Multiple Transactions
interface OneChainTransactionQueueProps {
  transactions: TransactionFlow[];
  onCancel?: (transactionId: string) => void;
  onClear?: () => void;
}

export const OneChainTransactionQueue: React.FC<OneChainTransactionQueueProps> = ({
  transactions,
  onCancel,
  onClear,
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionFlow | null>(null);

  const isCompleted = (flow: TransactionFlow) =>
    flow.status === TransactionStatus.COMPLETED || flow.status === TransactionStatus.FAILED;

  const activeTransactions = transactions.filter(flow => !isCompleted(flow));
  const completedTransactions = transactions.filter(flow => isCompleted(flow));

  return (
    <>
      <div className="fixed bottom-4 right-4 w-80 bg-gray-900 rounded-lg shadow-xl border border-gray-700 z-40">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">Transactions</h4>
            {transactions.length > 0 && onClear && (
              <button
                onClick={onClear}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Transaction List */}
        <div className="max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No active transactions
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {/* Active Transactions */}
              {activeTransactions.map(flow => (
                <div
                  key={flow.id}
                  className="p-3 hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => setSelectedTransaction(flow)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium">
                      {flow.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className="text-blue-400 text-xs">
                      {Math.floor((flow.currentStep / flow.steps.length) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(flow.currentStep / flow.steps.length) * 100}%` }}
                      />
                    </div>
                    {onCancel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel(flow.id);
                        }}
                        className="text-red-400 hover:text-red-300 text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {flow.currentStep < flow.steps.length && (
                    <div className="text-gray-400 text-xs mt-1">
                      {flow.steps[flow.currentStep].name}
                    </div>
                  )}
                </div>
              ))}

              {/* Completed Transactions */}
              {completedTransactions.map(flow => (
                <div
                  key={flow.id}
                  className="p-3 hover:bg-gray-800 cursor-pointer transition-colors opacity-75"
                  onClick={() => setSelectedTransaction(flow)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">
                      {flow.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className={`text-xs ${
                      flow.status === TransactionStatus.COMPLETED ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {flow.status === TransactionStatus.COMPLETED ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    {OneChainTransactionFlow.getInstance().formatTransactionDuration(flow)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Transaction Detail Modal */}
      {selectedTransaction && (
        <OneChainTransactionProgress
          flow={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          showDetails={true}
        />
      )}
    </>
  );
};

export default OneChainTransactionProgress;