/**
 * OneChain Transaction Flow Service
 *
 * Real blockchain service that handles OneChain transaction flows for the marketplace.
 * Manages transaction execution, status updates, gas estimation, and real blockchain events.
 */

import { Transaction } from '@onelabs/sui/transactions';
import { SuiClient } from '@onelabs/sui/client';
import { Signer } from './OneChainTransactionService';
import OneChainMarketplaceService, { TransactionResult } from './OneChainMarketplaceService';

import {
  MarketplaceListing,
  MarketplaceTransaction,
  ItemMintedEvent,
  ItemTradedEvent,
  EscrowCreatedEvent,
  TradeCompletedEvent,
  EscrowCancelledEvent,
  MarketplaceEvent,
} from '@/types/onechain';

import {
  ONECHAIN_NETWORK,
  GAS_CONFIG,
  getTransactionUrl,
  formatSuiAmount
} from '@/config/contracts';

// === Transaction Types ===

export enum TransactionType {
  PURCHASE = 'purchase',
  LIST_ITEM = 'list_item',
  CANCEL_LISTING = 'cancel_listing',
  MINT_ITEM = 'mint_item',
  TRANSFER_ITEM = 'transfer_item',
  CREATE_ESCROW = 'create_escrow',
  EXECUTE_SWAP = 'execute_swap',
  CANCEL_ESCROW = 'cancel_escrow',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CONFIRMING = 'confirming',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TransactionStep {
  id: string;
  name: string;
  description: string;
  duration: number; // in milliseconds
  canFail: boolean;
  failureRate?: number; // 0-1
}

export interface TransactionFlow {
  id: string;
  type: TransactionType;
  steps: TransactionStep[];
  currentStep: number;
  status: TransactionStatus;
  startTime: number;
  endTime?: number;
  gasUsed: number;
  gasCost: number;
  blockNumber?: number;
  transactionHash: string;
  events: MarketplaceEvent[];
  error?: string;
}

export interface GasEstimate {
  gasLimit: number;
  gasPrice: number;
  totalCost: number;
  estimatedTime: number; // in milliseconds
}

// === Transaction Flow Configurations ===

const TRANSACTION_FLOWS: Record<TransactionType, TransactionStep[]> = {
  [TransactionType.PURCHASE]: [
    {
      id: 'validate',
      name: 'Validating Purchase',
      description: 'Checking item availability and buyer funds...',
      duration: 500,
      canFail: true,
      failureRate: 0.1,
    },
    {
      id: 'lock_funds',
      name: 'Locking Funds',
      description: 'Securing payment in escrow...',
      duration: 800,
      canFail: true,
      failureRate: 0.05,
    },
    {
      id: 'create_escrow',
      name: 'Creating Escrow',
      description: 'Setting up secure trade escrow...',
      duration: 600,
      canFail: false,
    },
    {
      id: 'transfer_item',
      name: 'Transferring Item',
      description: 'Moving item to buyer inventory...',
      duration: 400,
      canFail: false,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 1000,
      canFail: false,
    },
  ],

  [TransactionType.LIST_ITEM]: [
    {
      id: 'validate_ownership',
      name: 'Validating Ownership',
      description: 'Confirming you own this item...',
      duration: 300,
      canFail: true,
      failureRate: 0.05,
    },
    {
      id: 'lock_item',
      name: 'Locking Item',
      description: 'Securing item for marketplace listing...',
      duration: 500,
      canFail: true,
      failureRate: 0.03,
    },
    {
      id: 'create_listing',
      name: 'Creating Listing',
      description: 'Publishing to marketplace...',
      duration: 400,
      canFail: false,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 800,
      canFail: false,
    },
  ],

  [TransactionType.CANCEL_LISTING]: [
    {
      id: 'validate_listing',
      name: 'Validating Listing',
      description: 'Confirming listing ownership and status...',
      duration: 300,
      canFail: true,
      failureRate: 0.05,
    },
    {
      id: 'unlock_item',
      name: 'Unlocking Item',
      description: 'Releasing item from escrow...',
      duration: 400,
      canFail: false,
    },
    {
      id: 'remove_listing',
      name: 'Removing Listing',
      description: 'Delisting from marketplace...',
      duration: 300,
      canFail: false,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 600,
      canFail: false,
    },
  ],

  [TransactionType.MINT_ITEM]: [
    {
      id: 'validate_permissions',
      name: 'Validating Permissions',
      description: 'Checking minting permissions...',
      duration: 400,
      canFail: true,
      failureRate: 0.1,
    },
    {
      id: 'create_item',
      name: 'Creating Item',
      description: 'Minting new item on blockchain...',
      duration: 800,
      canFail: true,
      failureRate: 0.05,
    },
    {
      id: 'assign_owner',
      name: 'Assigning Owner',
      description: 'Transferring item to your wallet...',
      duration: 300,
      canFail: false,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 1000,
      canFail: false,
    },
  ],

  [TransactionType.TRANSFER_ITEM]: [
    {
      id: 'validate_ownership',
      name: 'Validating Ownership',
      description: 'Confirming item ownership...',
      duration: 300,
      canFail: true,
      failureRate: 0.03,
    },
    {
      id: 'transfer_ownership',
      name: 'Transferring Ownership',
      description: 'Updating blockchain ownership records...',
      duration: 600,
      canFail: true,
      failureRate: 0.02,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 800,
      canFail: false,
    },
  ],

  [TransactionType.CREATE_ESCROW]: [
    {
      id: 'validate_items',
      name: 'Validating Items',
      description: 'Checking escrow item requirements...',
      duration: 400,
      canFail: true,
      failureRate: 0.05,
    },
    {
      id: 'lock_items',
      name: 'Locking Items',
      description: 'Securing items in escrow contract...',
      duration: 600,
      canFail: true,
      failureRate: 0.03,
    },
    {
      id: 'create_escrow',
      name: 'Creating Escrow',
      description: 'Deploying escrow smart contract...',
      duration: 800,
      canFail: false,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 1000,
      canFail: false,
    },
  ],

  [TransactionType.EXECUTE_SWAP]: [
    {
      id: 'validate_escrows',
      name: 'Validating Escrows',
      description: 'Checking escrow compatibility...',
      duration: 500,
      canFail: true,
      failureRate: 0.08,
    },
    {
      id: 'execute_swap',
      name: 'Executing Swap',
      description: 'Processing atomic swap...',
      duration: 1000,
      canFail: true,
      failureRate: 0.05,
    },
    {
      id: 'transfer_items',
      name: 'Transferring Items',
      description: 'Distributing items to traders...',
      duration: 600,
      canFail: false,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 1200,
      canFail: false,
    },
  ],

  [TransactionType.CANCEL_ESCROW]: [
    {
      id: 'validate_escrow',
      name: 'Validating Escrow',
      description: 'Checking escrow status and permissions...',
      duration: 300,
      canFail: true,
      failureRate: 0.05,
    },
    {
      id: 'unlock_item',
      name: 'Unlocking Item',
      description: 'Releasing item from escrow...',
      duration: 400,
      canFail: false,
    },
    {
      id: 'destroy_escrow',
      name: 'Destroying Escrow',
      description: 'Cleaning up escrow contract...',
      duration: 300,
      canFail: false,
    },
    {
      id: 'confirm_transaction',
      name: 'Confirming Transaction',
      description: 'Finalizing blockchain transaction...',
      duration: 600,
      canFail: false,
    },
  ],
};

// === OneChain Transaction Flow Service ===

class OneChainTransactionFlow {
  private static instance: OneChainTransactionFlow;
  private activeFlows: Map<string, TransactionFlow> = new Map();
  private flowCallbacks: Map<string, (flow: TransactionFlow) => void> = new Map();
  private client: SuiClient;
  private signer: Signer | null = null;
  private marketplaceService: OneChainMarketplaceService;
  private readonly BLOCK_TIME = 2000; // 2 seconds average block time

  private constructor() {
    this.client = new SuiClient({ url: ONECHAIN_NETWORK.RPC_URL });
    this.marketplaceService = OneChainMarketplaceService.getInstance();
  }

  static getInstance(): OneChainTransactionFlow {
    if (!OneChainTransactionFlow.instance) {
      OneChainTransactionFlow.instance = new OneChainTransactionFlow();
    }
    return OneChainTransactionFlow.instance;
  }

  /**
   * Set the signer for transaction execution
   */
  setSigner(signer: Signer) {
    this.signer = signer;
    this.marketplaceService.setSigner(signer);
  }

  /**
   * Set the current wallet address
   */
  setCurrentAddress(address: string) {
    this.marketplaceService.setCurrentAddress(address);
  }

  // === Transaction Flow Management ===

  async executeTransaction(
    type: TransactionType,
    data: any,
    onStepUpdate?: (flow: TransactionFlow) => void,
    onComplete?: (flow: TransactionFlow) => void,
    onError?: (flow: TransactionFlow, error: string) => void
  ): Promise<TransactionFlow> {
    const flowId = `flow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const flow: TransactionFlow = {
      id: flowId,
      type,
      steps: TRANSACTION_FLOWS[type] || [],
      currentStep: 0,
      status: TransactionStatus.PENDING,
      startTime: Date.now(),
      gasUsed: 0,
      gasCost: 0,
      transactionHash: '',
      events: [],
    };

    // Store flow and register callback
    this.activeFlows.set(flowId, flow);
    if (onStepUpdate) {
      this.flowCallbacks.set(flowId, onStepUpdate);
    }

    try {
      let result: TransactionResult;

      // Execute real blockchain transaction based on type
      switch (type) {
        case TransactionType.PURCHASE:
          result = await this.executePurchaseFlow(flow, data, onStepUpdate);
          break;
        case TransactionType.LIST_ITEM:
          result = await this.executeListingFlow(flow, data, onStepUpdate);
          break;
        case TransactionType.CANCEL_LISTING:
          result = await this.executeCancelFlow(flow, data, onStepUpdate);
          break;
        case TransactionType.MINT_ITEM:
          result = await this.executeMintingFlow(flow, data, onStepUpdate);
          break;
        default:
          throw new Error(`Unsupported transaction type: ${type}`);
      }

      // Update flow with real transaction data
      flow.transactionHash = result.transactionHash;
      flow.gasUsed = result.gasUsed || 0;
      flow.gasCost = flow.gasUsed * this.getGasPrice();
      flow.events = this.convertObjectChangesToEvents(result.objectChanges || []) || [];

      flow.status = TransactionStatus.COMPLETED;
      flow.endTime = Date.now();

      onComplete?.(flow);
    } catch (error) {
      flow.status = TransactionStatus.FAILED;
      flow.endTime = Date.now();
      flow.error = error instanceof Error ? error.message : 'Transaction failed';

      onError?.(flow, flow.error);
    } finally {
      // Clean up
      this.flowCallbacks.delete(flowId);
    }

    return flow;
  }

  /**
   * Execute purchase transaction flow
   */
  private async executePurchaseFlow(
    flow: TransactionFlow,
    data: { listingId: string },
    onStepUpdate?: (flow: TransactionFlow) => void
  ): Promise<TransactionResult> {
    // Step 1: Validating Purchase
    await this.updateStep(flow, 0, 'Validating purchase and listing...', onStepUpdate);

    // Step 2: Processing Transaction
    await this.updateStep(flow, 1, 'Processing payment and transfer...', onStepUpdate);

    // Execute real purchase
    const result = await this.marketplaceService.purchaseItem(data.listingId);

    // Step 3: Confirming Transaction
    await this.updateStep(flow, 2, 'Confirming blockchain transaction...', onStepUpdate);

    // Wait for confirmation
    if (result.success) {
      await this.marketplaceService.waitForTransaction(result.transactionHash);
    }

    return result;
  }

  /**
   * Execute listing transaction flow
   */
  private async executeListingFlow(
    flow: TransactionFlow,
    data: { itemId: string; price: number },
    onStepUpdate?: (flow: TransactionFlow) => void
  ): Promise<TransactionResult> {
    // Step 1: Validating Ownership
    await this.updateStep(flow, 0, 'Validating item ownership...', onStepUpdate);

    // Step 2: Locking Item
    await this.updateStep(flow, 1, 'Locking item for marketplace...', onStepUpdate);

    // Step 3: Creating Listing
    await this.updateStep(flow, 2, 'Creating marketplace listing...', onStepUpdate);

    // Execute real listing
    const result = await this.marketplaceService.listItemForSale(data.itemId, data.price);

    // Step 4: Confirming Transaction
    await this.updateStep(flow, 3, 'Confirming blockchain transaction...', onStepUpdate);

    // Wait for confirmation
    if (result.success) {
      await this.marketplaceService.waitForTransaction(result.transactionHash);
    }

    return result;
  }

  /**
   * Execute cancel listing transaction flow
   */
  private async executeCancelFlow(
    flow: TransactionFlow,
    data: { listingId: string },
    onStepUpdate?: (flow: TransactionFlow) => void
  ): Promise<TransactionResult> {
    // Step 1: Validating Listing
    await this.updateStep(flow, 0, 'Validating listing ownership...', onStepUpdate);

    // Step 2: Unlocking Item
    await this.updateStep(flow, 1, 'Unlocking item from escrow...', onStepUpdate);

    // Step 3: Removing Listing
    await this.updateStep(flow, 2, 'Removing from marketplace...', onStepUpdate);

    // Execute real cancellation
    const result = await this.marketplaceService.cancelListing(data.listingId);

    // Step 4: Confirming Transaction
    await this.updateStep(flow, 3, 'Confirming blockchain transaction...', onStepUpdate);

    // Wait for confirmation
    if (result.success) {
      await this.marketplaceService.waitForTransaction(result.transactionHash);
    }

    return result;
  }

  /**
   * Execute minting transaction flow for harvested crops
   */
  private async executeMintingFlow(
    flow: TransactionFlow,
    data: { items: any[], owner: string, itemCount: number },
    onStepUpdate?: (flow: TransactionFlow) => void
  ): Promise<TransactionResult> {
    // Import required modules
    const { Transaction } = await import('@onelabs/sui/transactions');
    const { ONECHAIN_CONTRACTS, ONECHAIN_MODULES } = await import('@/config/contracts');

    if (!this.signer) {
      throw new Error('No wallet signer available for minting');
    }

    // Step 1: Validating Permissions
    await this.updateStep(flow, 0, 'Validating minting permissions...', onStepUpdate);

    // Step 2: Creating Items
    await this.updateStep(flow, 1, 'Minting items on blockchain...', onStepUpdate);

    // Create transaction for minting
    const tx = new Transaction();

    // Get the forge object - fetch from blockchain or use configured one
    let forgeObjectId: string;

    try {
      // Try to get the forge object from shared objects or find it on-chain
      // In a production environment, you would query the blockchain for forge objects
      forgeObjectId = ONECHAIN_CONTRACTS.ITEM_FORGE;

      // TODO: Implement real forge object fetching
      // This would involve querying the blockchain for existing forge objects
      // or finding the canonical forge object for the game

      console.log('Using forge object:', forgeObjectId);
    } catch (error) {
      console.error('Failed to get forge object, using fallback:', error);
      forgeObjectId = ONECHAIN_CONTRACTS.ITEM_FORGE;
    }

    // Mint each item
    const createdItems: any[] = [];
    for (const item of data.items) {
      const createdItem = tx.moveCall({
        target: `${ONECHAIN_MODULES.ITEMS}::create_item`,
        arguments: [
          tx.object(forgeObjectId),
          tx.pure.u8(item.item_type),
          tx.pure.u8(item.rarity),
          tx.pure.string(item.name),
          tx.pure.string(item.description),
          tx.pure.vector('u64', item.stats.map((stat: number) => tx.pure.u64(stat)))
        ]
      });
      createdItems.push(createdItem);
    }

    // Step 3: Assigning Owner
    await this.updateStep(flow, 2, 'Transferring items to your wallet...', onStepUpdate);

    // Transfer all created items to the owner
    tx.transferObjects(createdItems, data.owner);

    // Step 4: Confirming Transaction
    await this.updateStep(flow, 3, 'Finalizing blockchain transaction...', onStepUpdate);

    try {
      // Execute the transaction
      const result = await this.signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showObjectChanges: true,
          showEffects: true,
          showEvents: true
        }
      });

      if (result.effects?.status.status !== 'success') {
        throw new Error(`Transaction failed: ${result.effects?.status.error}`);
      }

      // Wait for transaction confirmation
      await this.client.waitForTransaction({
        digest: result.digest,
        options: { showEffects: true }
      });

      return {
        success: true,
        transactionHash: result.digest,
        objectChanges: result.objectChanges,
        gasUsed: 0 // Gas cost will be calculated from transaction effects
      };
    } catch (error) {
      console.error('Minting transaction failed:', error);
      throw error;
    }
  }

  /**
   * Update flow step and notify callbacks
   */
  private async updateStep(
    flow: TransactionFlow,
    stepIndex: number,
    description: string,
    onStepUpdate?: (flow: TransactionFlow) => void
  ): Promise<void> {
    flow.currentStep = stepIndex;
    flow.status = TransactionStatus.PROCESSING;

    // Update step description for better UX
    if (flow.steps[stepIndex]) {
      flow.steps[stepIndex].description = description;
    }

    onStepUpdate?.(flow);

    // Simulate minimal processing time for UX
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Convert object changes to events
   */
  private convertObjectChangesToEvents(objectChanges: any[]): MarketplaceEvent[] {
    const events: MarketplaceEvent[] = [];

    for (const change of objectChanges) {
      if (change.type === 'created' || change.type === 'mutated' || change.type === 'transferred') {
        // Create appropriate event based on object type and change type
        events.push({
          type: change.type === 'transferred' ? 'sold' : 'listed',
          timestamp: Date.now(),
          transaction_hash: '', // Will be filled by caller
        } as MarketplaceEvent);
      }
    }

    return events;
  }

  /**
   * Get current gas price from network
   */
  private getGasPrice(): number {
    // OneChain has relatively stable gas prices
    // In a real implementation, you might fetch this from the network
    return 0.001; // Base price in SUI
  }

  private async executeFlowSteps(
    flow: TransactionFlow,
    data: any,
    onStepUpdate?: (flow: TransactionFlow) => void
  ): Promise<void> {
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      flow.currentStep = i;
      flow.status = TransactionStatus.PROCESSING;

      // Notify step start
      onStepUpdate?.(flow);

      // Simulate step execution
      await this.executeStep(flow, step, data);

      // Update gas usage
      flow.gasUsed += this.calculateStepGas(step);
      flow.blockNumber = Math.floor(Date.now() / this.BLOCK_TIME);

      // Check if we're in confirmation phase
      if (i === flow.steps.length - 1) {
        flow.status = TransactionStatus.CONFIRMING;
        onStepUpdate?.(flow);
      }
    }
  }

  private async executeStep(flow: TransactionFlow, step: TransactionStep, data: any): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, step.duration));

    // Simulate random failures
    if (step.canFail && step.failureRate && Math.random() < step.failureRate) {
      throw new Error(`Step "${step.name}" failed: ${this.getRandomErrorMessage(step)}`);
    }

    // Generate blockchain events for certain steps
    this.generateStepEvents(flow, step, data);
  }

  private generateStepEvents(flow: TransactionFlow, step: TransactionStep, data: any): void {
    const timestamp = Date.now();

    switch (flow.type) {
      case TransactionType.PURCHASE:
        if (step.id === 'create_escrow') {
          flow.events.push({
            type: 'listed',
            listing_id: data.listingId,
            item_id: data.itemId,
            seller: data.seller,
            price: data.price,
            timestamp,
            transaction_hash: flow.transactionHash,
          });
        } else if (step.id === 'transfer_item') {
          flow.events.push({
            type: 'sold',
            listing_id: data.listingId,
            item_id: data.itemId,
            seller: data.seller,
            buyer: data.buyer,
            price: data.price,
            timestamp,
            transaction_hash: flow.transactionHash,
            escrow_id: `escrow_${timestamp}`,
          });
        }
        break;

      case TransactionType.LIST_ITEM:
        if (step.id === 'create_listing') {
          flow.events.push({
            type: 'listed',
            listing_id: data.listingId,
            item_id: data.itemId,
            seller: data.seller,
            price: data.price,
            timestamp,
            transaction_hash: flow.transactionHash,
          });
        }
        break;

      case TransactionType.CANCEL_LISTING:
        if (step.id === 'remove_listing') {
          flow.events.push({
            type: 'cancelled',
            listing_id: data.listingId,
            item_id: data.itemId,
            seller: data.seller,
            timestamp,
            transaction_hash: flow.transactionHash,
          });
        }
        break;

      case TransactionType.MINT_ITEM:
        if (step.id === 'create_item') {
          // Create an ItemMintedEvent with the correct properties
          const mintedEvent: ItemMintedEvent = {
            item_id: parseInt(data.itemId),
            owner: data.owner,
            item_type: data.itemType,
            rarity: data.rarity,
            name: data.name,
          };
          // Cast as any to add to the events array since TransactionFlow.events is typed as MarketplaceEvent[]
          flow.events.push(mintedEvent as any);
        }
        break;
    }
  }

  private calculateStepGas(step: TransactionStep): number {
    // Simulate gas calculation based on step complexity
    const baseGas = 21000; // Base transaction gas
    const stepMultiplier = {
      validate: 1.2,
      lock: 1.5,
      create: 2.0,
      transfer: 1.8,
      confirm: 1.1,
    }[step.id.split('_')[0]] || 1.0;

    return Math.floor(baseGas * stepMultiplier * (1 + Math.random() * 0.2));
  }

  private getRandomErrorMessage(_step: TransactionStep): string {
    const errors = [
      'Network congestion detected',
      'Insufficient gas provided',
      'Transaction validation failed',
      'Smart contract execution reverted',
      'Invalid signature',
      'Nonce mismatch',
      'Temporary blockchain node issue',
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }

  // === Gas Estimation ===

  estimateTransactionGas(type: TransactionType, _data: any): GasEstimate {
    // Use real gas configuration from contracts
    let gasLimit = GAS_CONFIG.DEFAULT_GAS_BUDGET;
    let estimatedTime = 5000; // Default 5 seconds

    switch (type) {
      case TransactionType.PURCHASE:
        gasLimit = GAS_CONFIG.DEFAULT_GAS_BUDGET;
        estimatedTime = 8000;
        break;
      case TransactionType.LIST_ITEM:
        gasLimit = GAS_CONFIG.DEFAULT_GAS_BUDGET;
        estimatedTime = 6000;
        break;
      case TransactionType.CANCEL_LISTING:
        gasLimit = GAS_CONFIG.DEFAULT_GAS_BUDGET;
        estimatedTime = 4000;
        break;
      case TransactionType.MINT_ITEM:
        gasLimit = GAS_CONFIG.DEFAULT_GAS_BUDGET;
        estimatedTime = 7000;
        break;
      default:
        gasLimit = GAS_CONFIG.DEFAULT_GAS_BUDGET;
        estimatedTime = 5000;
    }

    const gasPrice = this.getGasPrice();
    const totalCost = gasLimit * gasPrice;

    return {
      gasLimit,
      gasPrice,
      totalCost,
      estimatedTime,
    };
  }

  // === Utility Methods ===

  getActiveFlow(flowId: string): TransactionFlow | undefined {
    return this.activeFlows.get(flowId);
  }

  cancelFlow(flowId: string): boolean {
    const flow = this.activeFlows.get(flowId);
    if (!flow || flow.status === TransactionStatus.COMPLETED) {
      return false;
    }

    flow.status = TransactionStatus.CANCELLED;
    flow.endTime = Date.now();
    return true;
  }

  formatTransactionHash(hash: string): string {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  formatTransactionStatus(status: TransactionStatus): string {
    const statusMap = {
      [TransactionStatus.PENDING]: 'Pending',
      [TransactionStatus.PROCESSING]: 'Processing',
      [TransactionStatus.CONFIRMING]: 'Confirming',
      [TransactionStatus.COMPLETED]: 'Completed',
      [TransactionStatus.FAILED]: 'Failed',
      [TransactionStatus.CANCELLED]: 'Cancelled',
    };
    return statusMap[status] || 'Unknown';
  }

  getTransactionDuration(flow: TransactionFlow): number {
    const endTime = flow.endTime || Date.now();
    return endTime - flow.startTime;
  }

  formatTransactionDuration(flow: TransactionFlow): string {
    const duration = this.getTransactionDuration(flow);
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get transaction URL for blockchain explorer
   */
  getTransactionUrl(hash: string): string {
    return getTransactionUrl(hash);
  }

  /**
   * Format gas amount for display
   */
  formatGasAmount(gas: number): string {
    return formatSuiAmount(gas);
  }

  /**
   * Get transaction details from blockchain
   */
  async getTransactionDetails(hash: string) {
    try {
      return await this.marketplaceService.getTransaction(hash);
    } catch (error) {
      console.error('Error getting transaction details:', error);
      return null;
    }
  }

  /**
   * Check if transaction is confirmed
   */
  async isTransactionConfirmed(hash: string): Promise<boolean> {
    try {
      const tx = await this.client.getTransactionBlock({
        digest: hash,
        options: { showEffects: true }
      });
      return tx.effects?.status.status === 'success';
    } catch (error) {
      return false;
    }
  }

  // === React Integration Helpers ===

  createTransactionHook(type: TransactionType) {
    // This would be implemented as a custom React hook
    // For now, return the execution method directly
    return {
      execute: (data: any, callbacks?: {
        onStepUpdate?: (flow: TransactionFlow) => void;
        onComplete?: (flow: TransactionFlow) => void;
        onError?: (flow: TransactionFlow, error: string) => void;
      }) => this.executeTransaction(type, data, callbacks?.onStepUpdate, callbacks?.onComplete, callbacks?.onError)
    };
  }
}

export { OneChainTransactionFlow };
export default OneChainTransactionFlow;