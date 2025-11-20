/**
 * OneChain Marketplace Service
 *
 * Real blockchain service that connects to OneChain contracts for marketplace functionality.
 * Handles NFT trading, listing, purchasing, and kiosk management through OneChain Move contracts.
 */

import { Transaction } from '@onelabs/sui/transactions';
import { SuiClient } from '@onelabs/sui/client';
import { Signer } from './OneChainTransactionService';

import {
  GameItem,
  Weapon,
  Armor,
  ItemType,
  RarityLevel,
  ITEM_TYPES,
  RARITY_LEVELS,
  FrontendItem,
  TradeEscrow,
  GameCustodian,
  EscrowCreatedEvent,
  ItemMintedEvent,
  ItemTradedEvent
} from '@/types/onechain';

import {
  ONECHAIN_CONTRACTS,
  ONECHAIN_MODULES,
  ONECHAIN_NETWORK,
  GAS_CONFIG,
  MARKETPLACE_CONFIG,
  EVENT_TYPES,
  OBJECT_TYPES,
  CONTRACT_FUNCTIONS,
  ERROR_CODES,
  getTransactionUrl,
  formatSuiAmount
} from '@/config/contracts';

// === Marketplace Types ===

export interface MarketplaceListing {
  id: string;
  item: FrontendItem;
  seller: string;
  price: number;
  listed_at: number;
  transaction_hash: string;
  status: 'active' | 'sold' | 'cancelled';
  buyer?: string;
  sold_at?: number;
}

export interface PlayerKiosk {
  id: string;
  owner: string;
  listed_items: MarketplaceListing[];
  sales_history: MarketplaceSale[];
  total_sales: number;
  total_revenue: number;
}

export interface MarketplaceSale {
  id: string;
  item: FrontendItem;
  seller: string;
  buyer: string;
  price: number;
  sold_at: number;
  transaction_hash: string;
  escrow_id: string;
}

export interface TransactionResult {
  success: boolean;
  transactionHash: string;
  error?: string;
  objectChanges?: any[];
  events?: any[];
  gasUsed?: number;
}

export interface MarketplaceError extends Error {
  code: typeof ERROR_CODES[keyof typeof ERROR_CODES];
  details?: any;
}

// === Real OneChain Marketplace Service ===

class OneChainMarketplaceService {
  private static instance: OneChainMarketplaceService;
  private client: SuiClient;
  private signer: Signer | null = null;
  private currentAddress: string | null = null;

  private constructor() {
    this.client = new SuiClient({ url: ONECHAIN_NETWORK.RPC_URL });
  }

  static getInstance(): OneChainMarketplaceService {
    if (!OneChainMarketplaceService.instance) {
      OneChainMarketplaceService.instance = new OneChainMarketplaceService();
    }
    return OneChainMarketplaceService.instance;
  }

  /**
   * Set the signer for transaction execution (from OneChain wallet SDK)
   */
  setSigner(signer: Signer) {
    this.signer = signer;
  }

  /**
   * Set the current wallet address for transactions
   */
  setCurrentAddress(address: string) {
    this.currentAddress = address;
  }

  /**
   * Get the current wallet address
   */
  getCurrentAddress(): string | null {
    return this.currentAddress;
  }

  /**
   * Create error with proper error code
   */
  private createError(code: typeof ERROR_CODES[keyof typeof ERROR_CODES], message: string, details?: any): MarketplaceError {
    const error = new Error(message) as MarketplaceError;
    error.code = code;
    error.details = details;
    return error;
  }

  /**
   * Execute transaction with proper error handling
   */
  private async executeTransaction(
    transaction: Transaction,
    options?: {
      showObjectChanges?: boolean;
      showEffects?: boolean;
      showEvents?: boolean;
    }
  ): Promise<TransactionResult> {
    if (!this.signer) {
      throw this.createError(ERROR_CODES.TRANSACTION_FAILED, 'No wallet signer set. Use setSigner() first.');
    }

    try {
      const result = await this.signer.signAndExecuteTransaction({
        transaction,
        options: {
          showObjectChanges: options?.showObjectChanges ?? true,
          showEffects: options?.showEffects ?? true,
          showEvents: options?.showEvents ?? true,
        }
      });

      if (result.effects?.status.status !== 'success') {
        throw this.createError(
          ERROR_CODES.TRANSACTION_FAILED,
          `Transaction failed: ${result.effects?.status.error || 'Unknown error'}`,
          result.effects
        );
      }

      return {
        success: true,
        transactionHash: result.digest,
        objectChanges: result.objectChanges,
        events: [], // Default to empty array as events not available in result
        gasUsed: 1000000 // Default gas value since not available in result
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        ERROR_CODES.TRANSACTION_FAILED,
        error instanceof Error ? error.message : 'Unknown transaction error'
      );
    }
  }

  // === Blockchain Data Methods ===

  /**
   * Convert GameItem from blockchain to FrontendItem
   */
  private convertToFrontendItem(gameItem: any, objectId: string): FrontendItem {
    return {
      id: objectId,
      item_id: gameItem.item_id || 0,
      item_type: gameItem.item_type || ITEM_TYPES.RESOURCE,
      rarity: gameItem.rarity || RARITY_LEVELS.COMMON,
      name: gameItem.name || 'Unknown Item',
      description: gameItem.description || 'An item from OneValley',
      stats: gameItem.stats || [],
      minted_by: gameItem.minted_by || '',
      mint_timestamp: gameItem.mint_timestamp || Date.now(),
      owner_history: gameItem.owner_history || [],
      sprite_key: this.generateSpriteKey(
        gameItem.item_type || ITEM_TYPES.RESOURCE,
        gameItem.name || 'Unknown',
        gameItem.rarity || RARITY_LEVELS.COMMON
      ),
      stack_size: gameItem.stack_size || 1,
      equipped: false,
      locked: false,
    };
  }

  /**
   * Generate sprite key for UI display
   */
  private generateSpriteKey(itemType: ItemType, name: string, rarity: RarityLevel): string {
    const typeMap = {
      [ITEM_TYPES.WEAPON]: 'weapons',
      [ITEM_TYPES.ARMOR]: 'armors',
      [ITEM_TYPES.CONSUMABLE]: 'consumables',
      [ITEM_TYPES.RESOURCE]: 'misc',
    };

    const raritySuffix = {
      [RARITY_LEVELS.COMMON]: 'a',
      [RARITY_LEVELS.RARE]: 'b',
      [RARITY_LEVELS.EPIC]: 'c',
      [RARITY_LEVELS.LEGENDARY]: 'd',
    };

    const baseName = name.toLowerCase().replace(/\s+/g, '_');
    const folder = typeMap[itemType];
    const suffix = raritySuffix[rarity];

    return `${baseName}_${suffix}`;
  }

  /**
   * Query marketplace listings from blockchain
   */
  private async queryListings(filter?: {
    category?: ItemType;
    minPrice?: number;
    maxPrice?: number;
    seller?: string;
    status?: 'active' | 'sold' | 'cancelled';
  }): Promise<MarketplaceListing[]> {
    try {
      // Query listing objects from the marketplace contract
      const listings = await this.client.queryEvents({
        query: { MoveEventType: EVENT_TYPES.ITEM_LISTED }
      });

      const results: MarketplaceListing[] = [];

      for (const event of listings.data) {
        if (event.parsedJson) {
          const listingData = event.parsedJson as any;

          // Apply filters
          if (filter?.category && listingData.item_type !== filter.category) continue;
          if (filter?.minPrice && listingData.price < filter.minPrice) continue;
          if (filter?.maxPrice && listingData.price > filter.maxPrice) continue;
          if (filter?.seller && listingData.seller !== filter.seller) continue;

          // Get item details
          let item: FrontendItem | null = null;
          try {
            const itemObject = await this.client.getObject({
              id: listingData.item_id,
              options: { showContent: true }
            });

            if (itemObject.data?.content && 'fields' in itemObject.data.content) {
              item = this.convertToFrontendItem(
                itemObject.data.content.fields,
                listingData.item_id
              );
            }
          } catch (error) {
            console.error('Error fetching item for listing:', error);
            continue;
          }

          if (item) {
            results.push({
              id: listingData.listing_id || event.id.txDigest + '_' + Math.random().toString(36).substr(2, 9),
              item,
              seller: listingData.seller,
              price: Number(listingData.price),
              listed_at: Number(listingData.listed_at) || (event.timestampMs ? Number(event.timestampMs) : Date.now()),
              transaction_hash: event.id.txDigest,
              status: 'active', // Would need to check for sold/cancelled events
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error querying listings:', error);
      return [];
    }
  }

  /**
   * Get player's owned items from blockchain
   */
  private async queryPlayerItems(address: string): Promise<FrontendItem[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: address,
        filter: {
          MatchAll: [
            {
              StructType: OBJECT_TYPES.GAME_ITEM
            }
          ]
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const items: FrontendItem[] = [];

      for (const object of objects.data) {
        if (object.data?.content && 'type' in object.data.content &&
            object.data.content.type === OBJECT_TYPES.GAME_ITEM &&
            'fields' in object.data.content) {
          const fields = object.data.content.fields as any;
          items.push(this.convertToFrontendItem(fields, object.data.objectId));
        }
      }

      return items;
    } catch (error) {
      console.error('Error fetching player items:', error);
      return [];
    }
  }

  // === Public API Methods ===

  /**
   * Fetch marketplace items from blockchain
   */
  async fetchMarketplaceItems(
    category?: ItemType,
    minPrice?: number,
    maxPrice?: number
  ): Promise<MarketplaceListing[]> {
    try {
      return await this.queryListings({
        category,
        minPrice,
        maxPrice,
        status: 'active'
      });
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
      throw this.createError(
        ERROR_CODES.NETWORK_ERROR,
        'Failed to fetch marketplace items',
        error
      );
    }
  }

  /**
   * Fetch player inventory from blockchain
   */
  async fetchPlayerInventory(playerAddress?: string): Promise<FrontendItem[]> {
    const address = playerAddress || this.currentAddress;
    if (!address) {
      throw this.createError(
        ERROR_CODES.NOT_OWNER,
        'No wallet address provided'
      );
    }

    try {
      return await this.queryPlayerItems(address);
    } catch (error) {
      console.error('Error fetching player inventory:', error);
      throw this.createError(
        ERROR_CODES.NETWORK_ERROR,
        'Failed to fetch player inventory',
        error
      );
    }
  }

  /**
   * Fetch player kiosk from blockchain
   */
  async fetchPlayerKiosk(playerAddress?: string): Promise<PlayerKiosk | null> {
    const address = playerAddress || this.currentAddress;
    if (!address) {
      throw this.createError(
        ERROR_CODES.NOT_OWNER,
        'No wallet address provided'
      );
    }

    try {
      // Query player's kiosk object
      const kiosks = await this.client.getOwnedObjects({
        owner: address,
        filter: {
          MatchAll: [
            {
              StructType: OBJECT_TYPES.KIOSK
            }
          ]
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      if (kiosks.data.length === 0) {
        return null; // No kiosk found
      }

      const kioskObject = kiosks.data[0];
      if (kioskObject.data?.content && 'fields' in kioskObject.data.content) {
        const fields = kioskObject.data.content.fields as any;

        // Get listed items for this kiosk
        const listedItems = await this.queryListings({
          seller: address,
          status: 'active'
        });

        // Get sales history
        const sales = await this.querySalesHistory(address);

        return {
          id: kioskObject.data.objectId,
          owner: address,
          listed_items: listedItems,
          sales_history: sales,
          total_sales: sales.length,
          total_revenue: sales.reduce((sum, sale) => sum + sale.price, 0),
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching player kiosk:', error);
      throw this.createError(
        ERROR_CODES.NETWORK_ERROR,
        'Failed to fetch player kiosk',
        error
      );
    }
  }

  /**
   * Query player's sales history
   */
  private async querySalesHistory(address: string): Promise<MarketplaceSale[]> {
    try {
      // Query sold events for this player
      const soldEvents = await this.client.queryEvents({
        query: { MoveEventType: EVENT_TYPES.ITEM_SOLD }
      });

      const sales: MarketplaceSale[] = [];

      for (const event of soldEvents.data) {
        if (event.parsedJson && typeof event.parsedJson === 'object' && 'seller' in event.parsedJson && (event.parsedJson as any).seller === address) {
          const saleData = event.parsedJson as any;

          // Get item details
          let item: FrontendItem | null = null;
          try {
            const itemObject = await this.client.getObject({
              id: saleData.item_id,
              options: { showContent: true }
            });

            if (itemObject.data?.content && 'fields' in itemObject.data.content) {
              item = this.convertToFrontendItem(
                itemObject.data.content.fields,
                saleData.item_id
              );
            }
          } catch (error) {
            console.error('Error fetching item for sale:', error);
            continue;
          }

          if (item) {
            sales.push({
              id: event.id.txDigest + '_' + Math.random().toString(36).substr(2, 9),
              item,
              seller: saleData.seller,
              buyer: saleData.buyer,
              price: Number(saleData.price),
              sold_at: Number(saleData.sold_at) || (event.timestampMs ? Number(event.timestampMs) : Date.now()),
              transaction_hash: event.id.txDigest,
              escrow_id: saleData.escrow_id || '',
            });
          }
        }
      }

      return sales;
    } catch (error) {
      console.error('Error querying sales history:', error);
      return [];
    }
  }

  /**
   * List an item for sale on the marketplace
   */
  async listItemForSale(
    itemId: string,
    price: number
  ): Promise<TransactionResult> {
    if (!this.currentAddress) {
      throw this.createError(
        ERROR_CODES.NOT_OWNER,
        'No wallet address connected'
      );
    }

    // Validate price
    if (price < MARKETPLACE_CONFIG.MIN_LISTING_PRICE) {
      throw this.createError(
        ERROR_CODES.INVALID_PRICE,
        `Price must be at least ${MARKETPLACE_CONFIG.MIN_LISTING_PRICE}`
      );
    }

    if (price > MARKETPLACE_CONFIG.MAX_LISTING_PRICE) {
      throw this.createError(
        ERROR_CODES.INVALID_PRICE,
        `Price cannot exceed ${MARKETPLACE_CONFIG.MAX_LISTING_PRICE}`
      );
    }

    try {
      const tx = new Transaction();

      // Calculate marketplace fee
      const marketplaceFee = Math.floor(price * MARKETPLACE_CONFIG.FEE_RATE);
      const sellerProceeds = price - marketplaceFee;

      // Call the marketplace contract to list the item
      const listing = tx.moveCall({
        target: `${ONECHAIN_MODULES.MARKETPLACE}::${CONTRACT_FUNCTIONS.LIST_ITEM}`,
        arguments: [
          tx.object(itemId),
          tx.pure.u64(price),
          tx.object(ONECHAIN_CONTRACTS.GAME_CUSTODIAN)
        ]
      });

      // Transfer the listing to the marketplace contract
      tx.transferObjects([listing], ONECHAIN_CONTRACTS.MARKETPLACE);

      // Set gas budget
      tx.setGasBudget(GAS_CONFIG.MARKETPLACE_LISTING_GAS);

      // Execute transaction
      const result = await this.executeTransaction(tx, {
        showObjectChanges: true,
        showEvents: true
      });

      return result;
    } catch (error) {
      console.error('Error listing item for sale:', error);
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        ERROR_CODES.TRANSACTION_FAILED,
        'Failed to list item for sale',
        error
      );
    }
  }

  /**
   * Purchase an item from the marketplace
   */
  async purchaseItem(listingId: string): Promise<TransactionResult> {
    if (!this.currentAddress) {
      throw this.createError(
        ERROR_CODES.NOT_OWNER,
        'No wallet address connected'
      );
    }

    try {
      const tx = new Transaction();

      // Call the marketplace contract to purchase the item
      const purchasedItem = tx.moveCall({
        target: `${ONECHAIN_MODULES.MARKETPLACE}::${CONTRACT_FUNCTIONS.PURCHASE_ITEM}`,
        arguments: [
          tx.object(listingId),
          tx.object(ONECHAIN_CONTRACTS.GAME_CUSTODIAN)
        ]
      });

      // Transfer the purchased item to the buyer
      tx.transferObjects([purchasedItem], this.currentAddress);

      // Set gas budget
      tx.setGasBudget(GAS_CONFIG.PURCHASE_GAS);

      // Execute transaction
      const result = await this.executeTransaction(tx, {
        showObjectChanges: true,
        showEvents: true
      });

      return result;
    } catch (error) {
      console.error('Error purchasing item:', error);
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        ERROR_CODES.TRANSACTION_FAILED,
        'Failed to purchase item',
        error
      );
    }
  }

  /**
   * Cancel a marketplace listing
   */
  async cancelListing(listingId: string): Promise<TransactionResult> {
    if (!this.currentAddress) {
      throw this.createError(
        ERROR_CODES.NOT_OWNER,
        'No wallet address connected'
      );
    }

    try {
      const tx = new Transaction();

      // Call the marketplace contract to cancel the listing
      const returnedItem = tx.moveCall({
        target: `${ONECHAIN_MODULES.MARKETPLACE}::${CONTRACT_FUNCTIONS.CANCEL_LISTING}`,
        arguments: [
          tx.object(listingId)
        ]
      });

      // Transfer the returned item back to the owner
      tx.transferObjects([returnedItem], this.currentAddress);

      // Set gas budget
      tx.setGasBudget(GAS_CONFIG.CANCEL_LISTING_GAS);

      // Execute transaction
      const result = await this.executeTransaction(tx, {
        showObjectChanges: true,
        showEvents: true
      });

      return result;
    } catch (error) {
      console.error('Error canceling listing:', error);
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        ERROR_CODES.TRANSACTION_FAILED,
        'Failed to cancel listing',
        error
      );
    }
  }

  // === Utility Methods ===

  /**
   * Get formatted stats display for an item
   */
  getItemStatsDisplay(item: FrontendItem): string[] {
    const stats: string[] = [];

    if (item.item_type === ITEM_TYPES.WEAPON) {
      if (item.stats.length >= 1) stats.push(`Damage: ${item.stats[0]}`);
      if (item.stats.length >= 2) stats.push(`Durability: ${item.stats[1]}`);
    } else if (item.item_type === ITEM_TYPES.ARMOR) {
      if (item.stats.length >= 1) stats.push(`Defense: ${item.stats[0]}`);
      if (item.stats.length >= 2) stats.push(`Durability: ${item.stats[1]}`);
    } else if (item.item_type === ITEM_TYPES.CONSUMABLE) {
      if (item.stats.length >= 1) stats.push(`Effect: ${item.stats[0]}`);
    } else if (item.item_type === ITEM_TYPES.RESOURCE) {
      if (item.stats.length >= 1) stats.push(`Value: ${item.stats[0]}`);
    }

    return stats;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Format transaction hash for display
   */
  formatTransactionHash(hash: string): string {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  /**
   * Get transaction URL for blockchain explorer
   */
  getTransactionUrl(digest: string): string {
    return getTransactionUrl(digest);
  }

  /**
   * Get address URL for blockchain explorer
   */
  getAddressUrl(address: string): string {
    return `${ONECHAIN_NETWORK.EXPLORER_URL}/address/${address}`;
  }

  /**
   * Get object URL for blockchain explorer
   */
  getObjectUrl(objectId: string): string {
    return `${ONECHAIN_NETWORK.EXPLORER_URL}/object/${objectId}`;
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(digest: string): Promise<void> {
    try {
      await this.client.waitForTransaction({
        digest,
        options: {
          showEffects: true
        }
      });
    } catch (error) {
      console.error('Error waiting for transaction:', error);
      throw this.createError(
        ERROR_CODES.TRANSACTION_FAILED,
        'Transaction confirmation failed',
        error
      );
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(digest: string) {
    try {
      return await this.client.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true
        }
      });
    } catch (error) {
      console.error('Error getting transaction details:', error);
      throw this.createError(
        ERROR_CODES.NETWORK_ERROR,
        'Failed to get transaction details',
        error
      );
    }
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats(): Promise<{
    totalListings: number;
    activeListings: number;
    totalVolume: number;
    totalSales: number;
  }> {
    try {
      // Get all listing events
      const [listedEvents, soldEvents] = await Promise.all([
        this.client.queryEvents({
          query: { MoveEventType: EVENT_TYPES.ITEM_LISTED }
        }),
        this.client.queryEvents({
          query: { MoveEventType: EVENT_TYPES.ITEM_SOLD }
        })
      ]);

      const totalListings = listedEvents.data.length;
      const totalSales = soldEvents.data.length;
      const totalVolume = soldEvents.data.reduce((sum, event) => {
        if (event.parsedJson && typeof event.parsedJson === 'object' && 'price' in event.parsedJson) {
          return sum + Number((event.parsedJson as any).price);
        }
        return sum;
      }, 0);

      // For active listings, we'd need to check which ones haven't been sold or cancelled
      // This is a simplified calculation
      const activeListings = Math.max(0, totalListings - totalSales);

      return {
        totalListings,
        activeListings,
        totalVolume,
        totalSales
      };
    } catch (error) {
      console.error('Error getting marketplace stats:', error);
      return {
        totalListings: 0,
        activeListings: 0,
        totalVolume: 0,
        totalSales: 0
      };
    }
  }

  /**
   * Generate a mock player address for development/testing
   */
  generateMockPlayerAddress(): string {
    // Generate a realistic OneChain address format
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '0x';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export default OneChainMarketplaceService;