/**
 * Wallet Bridge Service
 *
 * Bridges the React wallet integration with Phaser game components.
 * Provides a singleton service that can be accessed from both React and Phaser.
 */

import { OneChainHarvester } from './OneChainHarvester';
import { OneChainTransactionFlow } from './OneChainTransactionFlow';
import { OneChainTransactionService } from './OneChainTransactionService';
import OneChainMintingService from './OneChainMintingService';
import { SuiClient } from '@onelabs/sui/client';
import { ONECHAIN_NETWORK } from '@/config/contracts';

// Global signer interface that matches OneChain SDK
export interface GlobalSigner {
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

class WalletBridgeService {
  private static instance: WalletBridgeService;
  private signer: GlobalSigner | null = null;
  private currentAddress: string | null = null;
  private isConnected: boolean = false;
  private suiClient: SuiClient;
  private oneChainHarvester: OneChainHarvester | null = null;
  private transactionFlow: OneChainTransactionFlow | null = null;
  private transactionService: OneChainTransactionService | null = null;
  private mintingService: OneChainMintingService | null = null;

  // Event listeners for wallet state changes
  private connectionListeners: Array<(connected: boolean, address?: string) => void> = [];

  private constructor() {
    this.suiClient = new SuiClient({ url: ONECHAIN_NETWORK.RPC_URL });
  }

  static getInstance(): WalletBridgeService {
    if (!WalletBridgeService.instance) {
      WalletBridgeService.instance = new WalletBridgeService();
    }
    return WalletBridgeService.instance;
  }

  /**
   * Initialize the wallet bridge with signer from React wallet hook
   */
  initialize(signer: GlobalSigner, address: string): void {
    this.signer = signer;
    this.currentAddress = address;
    this.isConnected = true;

    // Initialize OneChain services with the signer
    this.initializeOneChainServices();

    // Notify listeners
    this.notifyConnectionListeners(true, address);

    console.log('WalletBridge initialized with address:', address);
  }

  /**
   * Initialize OneChain services with the connected wallet
   */
  private initializeOneChainServices(): void {
    if (!this.signer || !this.currentAddress) {
      console.warn('Cannot initialize OneChain services: no signer or address');
      return;
    }

    try {
      // Initialize harvester
      this.oneChainHarvester = new OneChainHarvester(this.suiClient);
      this.oneChainHarvester.setSigner(this.signer);
      this.oneChainHarvester.setCurrentAddress(this.currentAddress);

      // Initialize transaction flow
      this.transactionFlow = OneChainTransactionFlow.getInstance();
      this.transactionFlow.setSigner(this.signer);
      this.transactionFlow.setCurrentAddress(this.currentAddress);

      // Initialize transaction service
      this.transactionService = new OneChainTransactionService(this.suiClient);
      this.transactionService.setSigner(this.signer);
      this.transactionService.setCurrentAddress(this.currentAddress);

      // Initialize minting service
      this.mintingService = new OneChainMintingService(this.suiClient);
      this.mintingService.setSigner(this.signer);
      this.mintingService.setCurrentAddress(this.currentAddress);

      console.log('OneChain services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OneChain services:', error);
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.signer = null;
    this.currentAddress = null;
    this.isConnected = false;
    this.oneChainHarvester = null;
    this.transactionFlow = null;
    this.transactionService = null;

    // Notify listeners
    this.notifyConnectionListeners(false);

    console.log('WalletBridge disconnected');
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    address: string | null;
    signer: GlobalSigner | null;
  } {
    return {
      isConnected: this.isConnected,
      address: this.currentAddress,
      signer: this.signer
    };
  }

  /**
   * Get OneChain Harvester service (for minting harvested crops)
   */
  getHarvester(): OneChainHarvester | null {
    return this.oneChainHarvester;
  }

  /**
   * Get Transaction Flow service
   */
  getTransactionFlow(): OneChainTransactionFlow | null {
    return this.transactionFlow;
  }

  /**
   * Get Transaction Service
   */
  getTransactionService(): OneChainTransactionService | null {
    return this.transactionService;
  }

  /**
   * Get Minting Service (for creating NFT items)
   */
  getMintingService(): OneChainMintingService | null {
    return this.mintingService;
  }

  /**
   * Check if wallet is ready for transactions
   */
  isWalletReady(): boolean {
    return this.isConnected &&
           this.signer !== null &&
           this.currentAddress !== null &&
           this.oneChainHarvester !== null;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(): Promise<string> {
    if (!this.currentAddress) {
      throw new Error('No wallet connected');
    }

    try {
      const balance = await this.suiClient.getBalance({
        owner: this.currentAddress
      });

      return (parseInt(balance.totalBalance) / 1000000000).toFixed(4);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return '0';
    }
  }

  /**
   * Add connection state listener
   */
  addConnectionListener(listener: (connected: boolean, address?: string) => void): void {
    this.connectionListeners.push(listener);
  }

  /**
   * Remove connection state listener
   */
  removeConnectionListener(listener: (connected: boolean, address?: string) => void): void {
    const index = this.connectionListeners.indexOf(listener);
    if (index > -1) {
      this.connectionListeners.splice(index, 1);
    }
  }

  /**
   * Notify all connection listeners
   */
  private notifyConnectionListeners(connected: boolean, address?: string): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected, address);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  /**
   * Execute a transaction using the connected wallet
   */
  async executeTransaction(transaction: any, options?: any): Promise<any> {
    if (!this.signer) {
      throw new Error('No wallet connected');
    }

    return await this.signer.signAndExecuteTransaction({
      transaction,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
        ...options
      }
    });
  }

  /**
   * Get transaction details from blockchain
   */
  async getTransactionDetails(transactionHash: string) {
    try {
      return await this.suiClient.getTransactionBlock({
        digest: transactionHash,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true
        }
      });
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(transactionHash: string): Promise<void> {
    await this.suiClient.waitForTransaction({
      digest: transactionHash,
      options: {
        showEffects: true
      }
    });
  }

  /**
   * Get blockchain explorer URL for transaction
   */
  getTransactionExplorerUrl(transactionHash: string): string {
    return `${ONECHAIN_NETWORK.EXPLORER_URL}/tx/${transactionHash}`;
  }

  /**
   * Get address explorer URL
   */
  getAddressExplorerUrl(address: string): string {
    return `${ONECHAIN_NETWORK.EXPLORER_URL}/address/${address}`;
  }
}

export default WalletBridgeService;