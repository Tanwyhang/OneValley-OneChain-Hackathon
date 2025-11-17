/**
 * OneChain Wallet Integration Hook
 *
 * React hook to integrate with OneChain wallet SDK (@onelabs/dapp-kit)
 * and provide signer functionality to our transaction services.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSignAndExecuteTransaction } from '@onelabs/dapp-kit';
import { initializeOneChainServices, setWalletSigner, setWalletAddress } from './index';

// Type for the signer from @onelabs/dapp-kit
interface DappKitSigner {
  signAndExecuteTransaction: (input: {
    transaction: any;
    options?: {
      showObjectChanges?: boolean;
      showEffects?: boolean;
      showEvents?: boolean;
    };
  }) => Promise<{
    digest: string;
    effects?: {
      status: {
        status: 'success' | 'failure';
        error?: string;
      };
    };
    objectChanges?: Array<{
      type: 'created' | 'mutated' | 'deleted' | 'transferred';
      objectId: string;
      objectType: string;
      sender?: string;
      owner?: {
        AddressOwner?: string;
      };
    }>;
  }>;
}

export interface UseOneChainWalletResult {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndExecuteTransaction: any;
}

/**
 * Hook for OneChain wallet connection and transaction signing
 */
export function useOneChainWallet(): UseOneChainWalletResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OneChain dApp-kit hook for transaction signing
  const { mutate: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();

  /**
   * Initialize OneChain services when wallet connects
   */
  const initializeServices = useCallback(async (walletAddress: string, signer: DappKitSigner) => {
    try {
      // Initialize all OneChain services
      const services = initializeOneChainServices();

      // Set wallet address for all services
      setWalletAddress(walletAddress);

      // Set signer for transaction services
      setWalletSigner(signer);

      console.log('OneChain services initialized successfully');
      return services;
    } catch (err) {
      console.error('Failed to initialize OneChain services:', err);
      throw err;
    }
  }, []);

  /**
   * Connect to OneChain wallet
   */
  const connect = useCallback(async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      // This would typically use the wallet connection modal or API
      // For now, this is a placeholder showing the pattern
      // In practice, you'd use something like:
      // const wallet = await connectWallet();
      // const address = wallet.account.address;
      // const signer = wallet.getSigner();

      // Placeholder - actual implementation depends on wallet SDK
      throw new Error('Wallet connection not implemented - requires @onelabs/dapp-kit setup');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, initializeServices]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setError(null);

    // Clear wallet from services
    setWalletAddress('');
    setWalletSigner(null as any);

    console.log('Wallet disconnected');
  }, []);

  /**
   * Handle wallet connection (would be called by wallet connection events)
   */
  const handleWalletConnected = useCallback(async (walletAddress: string, signer: DappKitSigner) => {
    try {
      await initializeServices(walletAddress, signer);
      setAddress(walletAddress);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize services';
      setError(errorMessage);
      console.error('Service initialization error:', err);
    }
  }, [initializeServices]);

  return {
    isConnected,
    isConnecting: isConnecting || isPending,
    address,
    error,
    connect,
    disconnect,
    signAndExecuteTransaction
  };
}

/**
 * Enhanced wallet hook with transaction readiness check
 */
export function useOneChainWalletReady() {
  const { isConnected, isConnecting, address, error, connect, disconnect, signAndExecuteTransaction } = useOneChainWallet();

  // Check if services are properly initialized
  const [servicesReady, setServicesReady] = useState(false);

  useEffect(() => {
    const checkServices = () => {
      try {
        const services = initializeOneChainServices();
        const txService = services.transactionService;

        // Services are ready if we have a signer set
        const ready = txService.getSigner() !== null;
        setServicesReady(ready);
      } catch (err) {
        setServicesReady(false);
      }
    };

    if (isConnected) {
      checkServices();
    } else {
      setServicesReady(false);
    }
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    isReady: isConnected && servicesReady,
    address,
    error,
    connect,
    disconnect,
    signAndExecuteTransaction
  };
}

/**
 * Hook for transaction operations with automatic error handling
 */
export function useOneChainTransactions() {
  const { isReady, address, signAndExecuteTransaction } = useOneChainWalletReady();
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const executeTransaction = useCallback(async (transaction: any, options?: any) => {
    if (!isReady) {
      throw new Error('Wallet not connected or services not ready');
    }

    setIsTransactionPending(true);
    setTransactionError(null);

    try {
      const result = await signAndExecuteTransaction({
        transaction,
        options: {
          showObjectChanges: true,
          showEffects: true,
          showEvents: true,
          ...options
        }
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setTransactionError(errorMessage);
      throw err;
    } finally {
      setIsTransactionPending(false);
    }
  }, [isReady, signAndExecuteTransaction]);

  return {
    isReady,
    address,
    isTransactionPending,
    transactionError,
    executeTransaction
  };
}