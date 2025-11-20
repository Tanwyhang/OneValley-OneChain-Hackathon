/**
 * OneChain Harvester Service
 *
 * Real blockchain service for harvesting crops and minting NFTs on OneChain testnet.
 * Connects the farming game mechanics with OneChain Move contracts.
 */

import { SuiClient } from '@onelabs/sui/client';
import { Transaction } from '@onelabs/sui/transactions';
import { Signer } from './OneChainTransactionService';
import OneChainTransactionFlow, { TransactionType, TransactionFlow } from './OneChainTransactionFlow';

import {
  ONECHAIN_CONTRACTS,
  ONECHAIN_MODULES,
  CONTRACT_FUNCTIONS,
  ONECHAIN_NETWORK,
  GAS_CONFIG,
  getTransactionUrl
} from '@/config/contracts';

export interface CropData {
  type: 'carrot' | 'wheat' | 'corn';
  quality: number; // 1-100
  quantity: number;
  harvestTimestamp: number;
  gameItemId?: string;
}

export interface MintingResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  itemIds?: string[];
  error?: string;
  transactionFlow?: TransactionFlow;
}

export interface HarvestedItem {
  name: string;
  description: string;
  item_type: number; // 4 = RESOURCE from items.move
  rarity: number; // 1-4 based on quality
  stats: number[];
  quantity: number;
}

export class OneChainHarvester {
  private client: SuiClient;
  private signer: Signer | null = null;
  private currentAddress: string | null = null;
  private transactionFlow: OneChainTransactionFlow;

  constructor(client: SuiClient) {
    this.client = client;
    this.transactionFlow = OneChainTransactionFlow.getInstance();
  }

  /**
   * Set the signer for transaction execution (from OneChain wallet SDK)
   */
  setSigner(signer: Signer) {
    this.signer = signer;
    this.transactionFlow.setSigner(signer);
  }

  /**
   * Set the current wallet address for transactions
   */
  setCurrentAddress(address: string) {
    this.currentAddress = address;
    this.transactionFlow.setCurrentAddress(address);
  }

  /**
   * Get the current wallet address
   */
  getCurrentAddress(): string | null {
    return this.currentAddress;
  }

  /**
   * Convert harvested crops to NFT items on OneChain blockchain
   */
  async mintHarvestedCrops(crops: CropData[]): Promise<MintingResult> {
    if (!this.signer || !this.currentAddress) {
      return {
        success: false,
        error: 'No wallet connected. Please connect your OneChain wallet first.'
      };
    }

    if (crops.length === 0) {
      return {
        success: false,
        error: 'No crops to mint. Please harvest some crops first.'
      };
    }

    try {
      // Start transaction flow for minting
      const flow = await this.transactionFlow.executeTransaction(
        TransactionType.MINT_ITEM,
        {
          items: crops.map(crop => this.convertCropToItem(crop)),
          owner: this.currentAddress,
          itemCount: crops.length
        }
      );

      if (flow.status === 'completed') {
        // Extract minted item IDs from transaction events
        const itemIds = this.extractItemIdsFromEvents(flow.events);

        return {
          success: true,
          transactionHash: flow.transactionHash,
          blockNumber: flow.blockNumber,
          itemIds,
          transactionFlow: flow
        };
      } else {
        return {
          success: false,
          error: flow.error || 'Minting transaction failed'
        };
      }
    } catch (error) {
      console.error('Error minting harvested crops:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during minting'
      };
    }
  }

  /**
   * Convert crop data to blockchain item format
   */
  private convertCropToItem(crop: CropData): HarvestedItem {
    const { type, quality, quantity } = crop;

    // Determine rarity based on quality
    let rarity: number;
    if (quality >= 90) rarity = 4; // LEGENDARY
    else if (quality >= 70) rarity = 3; // EPIC
    else if (quality >= 50) rarity = 2; // RARE
    else rarity = 1; // COMMON

    // Generate stats based on crop type and quality
    const stats = this.generateCropStats(type, quality);

    // Create item name and description
    const name = `${this.capitalizeFirst(type)} ${this.getRarityName(rarity)}`;
    const description = `Harvested ${type} with quality ${quality}/100. Quantity: ${quantity}`;

    return {
      name,
      description,
      item_type: 4, // RESOURCE from items.move
      rarity,
      stats,
      quantity
    };
  }

  /**
   * Generate stats for crop items based on type and quality
   */
  private generateCropStats(type: string, quality: number): number[] {
    const baseStats = {
      carrot: [10, 5, 15], // nutrition, value, freshness
      wheat: [8, 12, 10],  // nutrition, value, durability
      corn: [12, 8, 12]    // nutrition, value, versatility
    };

    const cropStats = baseStats[type as keyof typeof baseStats] || baseStats.carrot;

    // Scale stats by quality
    return cropStats.map(stat => Math.floor(stat * (quality / 100)));
  }

  /**
   * Get rarity name for display
   */
  private getRarityName(rarity: number): string {
    const rarityNames = {
      1: 'Common',
      2: 'Rare',
      3: 'Epic',
      4: 'Legendary'
    };
    return rarityNames[rarity as keyof typeof rarityNames] || 'Common';
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Extract item IDs from transaction events
   */
  private extractItemIdsFromEvents(events: any[]): string[] {
    const itemIds: string[] = [];

    for (const event of events) {
      if (event.type === 'ItemMinted' && event.item_id) {
        itemIds.push(event.item_id.toString());
      }
    }

    return itemIds;
  }

  /**
   * Get player's harvested NFT items from blockchain
   */
  async getPlayerHarvestedItems(): Promise<any[]> {
    if (!this.currentAddress) {
      throw new Error('No wallet address set');
    }

    try {
      const objects = await this.client.getOwnedObjects({
        owner: this.currentAddress,
        filter: {
          MatchAll: [
            {
              StructType: ONECHAIN_MODULES.ITEMS
            }
          ]
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const items: any[] = [];

      for (const object of objects.data) {
        if (object.data?.content && 'type' in object.data.content &&
            object.data.content.type === `${ONECHAIN_MODULES.ITEMS}::GameItem` &&
            'fields' in object.data.content) {

          const fields = object.data.content.fields as any;

          // Only include resource items (harvested crops)
          if (fields.item_type === 4) { // RESOURCE type
            items.push({
              id: object.data.objectId,
              ...fields,
              transactionUrl: object.data.previousTransaction 
                ? getTransactionUrl(object.data.previousTransaction)
                : undefined
            });
          }
        }
      }

      return items;
    } catch (error) {
      console.error('Error fetching harvested items:', error);
      return [];
    }
  }

  /**
   * Get transaction details from blockchain
   */
  async getTransactionDetails(transactionHash: string) {
    try {
      const transaction = await this.client.getTransactionBlock({
        digest: transactionHash,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true
        }
      });

      return {
        ...transaction,
        explorerUrl: getTransactionUrl(transactionHash)
      };
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      throw error;
    }
  }

  /**
   * Estimate gas cost for minting operation
   */
  async estimateMintingGas(cropCount: number): Promise<{
    gasLimit: number;
    estimatedCost: number;
    costInSui: string;
  }> {
    // Base gas cost + cost per item
    const baseGas = 2000000; // 2M gas base
    const perItemGas = 500000; // 0.5M gas per item
    const gasLimit = baseGas + (perItemGas * cropCount);

    // Estimate cost in SUI (assuming 1 SUI = 1,000,000,000 MIST)
    const estimatedCost = gasLimit * 1000; // Rough estimate
    const costInSui = (estimatedCost / 1000000000).toFixed(6);

    return {
      gasLimit,
      estimatedCost,
      costInSui
    };
  }

  /**
   * Check if wallet is connected and has sufficient balance
   */
  async checkWalletStatus(): Promise<{
    connected: boolean;
    address?: string;
    balance?: string;
    sufficientBalance?: boolean;
  }> {
    if (!this.currentAddress || !this.signer) {
      return { connected: false };
    }

    try {
      // Get wallet balance
      const balance = await this.client.getBalance({
        owner: this.currentAddress
      });

      const balanceInSui = (parseInt(balance.totalBalance) / 1000000000).toFixed(4);
      const sufficientBalance = parseInt(balance.totalBalance) > GAS_CONFIG.DEFAULT_GAS_BUDGET;

      return {
        connected: true,
        address: this.currentAddress,
        balance: balanceInSui,
        sufficientBalance
      };
    } catch (error) {
      console.error('Error checking wallet status:', error);
      return { connected: false };
    }
  }
}