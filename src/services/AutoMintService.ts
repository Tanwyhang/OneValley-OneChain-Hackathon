/**
 * Auto Mint Service
 * 
 * Automatically mints game items as NFTs when they're first created/picked up
 */

import WalletBridgeService from './WalletBridgeService';
import { ITEM_TYPES, RARITY_LEVELS } from './OneChainMintingService';

export interface GameItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
  rarity?: number;
  stats?: number[];
  nftObjectId?: string; // Blockchain object ID after minting
}

// Map game item IDs to their NFT object IDs
const nftRegistry = new Map<string, string>();

export class AutoMintService {
  private static instance: AutoMintService;
  private mintQueue: GameItem[] = [];
  private isMinting = false;

  private constructor() {}

  static getInstance(): AutoMintService {
    if (!AutoMintService.instance) {
      AutoMintService.instance = new AutoMintService();
    }
    return AutoMintService.instance;
  }

  /**
   * Get the NFT object ID for a game item (if minted)
   */
  getNFTObjectId(gameItemId: string): string | null {
    return nftRegistry.get(gameItemId) || null;
  }

  /**
   * Check if an item has been minted as NFT
   */
  isMinted(gameItemId: string): boolean {
    return nftRegistry.has(gameItemId);
  }

  /**
   * Automatically mint an item when created/picked up
   * Non-blocking - queues the mint and returns immediately
   */
  async autoMintItem(item: GameItem): Promise<void> {
    // Skip if already minted
    if (this.isMinted(item.id)) {
      console.log(`📦 Item ${item.id} already minted as NFT`);
      return;
    }

    // Add to queue
    this.mintQueue.push(item);
    console.log(`📝 Queued ${item.name} for minting...`);

    // Process queue
    this.processMintQueue();
  }

  /**
   * Process the mint queue in background
   */
  private async processMintQueue(): Promise<void> {
    // Already processing
    if (this.isMinting || this.mintQueue.length === 0) {
      return;
    }

    this.isMinting = true;

    while (this.mintQueue.length > 0) {
      const item = this.mintQueue.shift()!;

      try {
        const walletBridge = WalletBridgeService.getInstance();
        const mintingService = walletBridge.getMintingService();

        if (!mintingService) {
          console.warn('⚠️ Minting service not available, skipping:', item.name);
          continue;
        }

        // Map game item type to blockchain type
        const itemType = this.mapItemType(item.type || 'consumable');
        const rarity = item.rarity || RARITY_LEVELS.COMMON;

        console.log(`🎨 Minting ${item.name} as NFT...`);

        const result = await mintingService.mintItem({
          itemType,
          rarity,
          name: item.name,
          description: item.description || `A ${item.name} from OneValley`,
          stats: item.stats || [10, 10],
        });

        // Store the mapping
        nftRegistry.set(item.id, result.itemObjectId);
        item.nftObjectId = result.itemObjectId;

        console.log(`✅ Minted ${item.name}!`);
        console.log(`   Game ID: ${item.id}`);
        console.log(`   NFT ID: ${result.itemObjectId}`);

        // Small delay between mints to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed to mint ${item.name}:`, error);
        // Continue with next item instead of stopping
      }
    }

    this.isMinting = false;
  }

  /**
   * Mint item synchronously (waits for completion)
   */
  async mintItemNow(item: GameItem): Promise<string | null> {
    // Return existing if already minted
    const existing = this.getNFTObjectId(item.id);
    if (existing) {
      return existing;
    }

    try {
      const walletBridge = WalletBridgeService.getInstance();
      const mintingService = walletBridge.getMintingService();

      if (!mintingService) {
        throw new Error('Minting service not available');
      }

      const itemType = this.mapItemType(item.type || 'consumable');
      const rarity = item.rarity || RARITY_LEVELS.COMMON;

      console.log(`🎨 Minting ${item.name} as NFT (blocking)...`);

      const result = await mintingService.mintItem({
        itemType,
        rarity,
        name: item.name,
        description: item.description || `A ${item.name} from OneValley`,
        stats: item.stats || [10, 10],
      });

      // Store the mapping
      nftRegistry.set(item.id, result.itemObjectId);
      item.nftObjectId = result.itemObjectId;

      console.log(`✅ Minted ${item.name}! NFT ID: ${result.itemObjectId}`);

      return result.itemObjectId;

    } catch (error) {
      console.error(`❌ Failed to mint ${item.name}:`, error);
      return null;
    }
  }

  /**
   * Register an externally minted item with the local registry
   */
  registerMintedItem(item: GameItem, nftObjectId: string): void {
    if (!nftObjectId) {
      console.warn('⚠️ Tried to register minted item without NFT object ID');
      return;
    }

    // Always store latest mapping for the supplied game item id
    nftRegistry.set(item.id, nftObjectId);

    console.log(`🔗 Registered minted item ${item.name} (${item.id}) → ${nftObjectId}`);
  }

  /**
   * Batch mint multiple items
   */
  async batchMintItems(items: GameItem[]): Promise<void> {
    console.log(`📦 Batch minting ${items.length} items...`);

    for (const item of items) {
      await this.autoMintItem(item);
    }
  }

  /**
   * Map game item type to blockchain enum
   */
  private mapItemType(gameType: string): number {
    const typeMap: Record<string, number> = {
      'weapon': ITEM_TYPES.WEAPON,
      'armor': ITEM_TYPES.ARMOR,
      'consumable': ITEM_TYPES.CONSUMABLE,
      'resource': ITEM_TYPES.RESOURCE,
      'food': ITEM_TYPES.CONSUMABLE,
      'potion': ITEM_TYPES.CONSUMABLE,
      'material': ITEM_TYPES.RESOURCE,
    };

    return typeMap[gameType.toLowerCase()] || ITEM_TYPES.CONSUMABLE;
  }

  /**
   * Get all minted items
   */
  getMintedItems(): Array<{ gameId: string; nftId: string }> {
    return Array.from(nftRegistry.entries()).map(([gameId, nftId]) => ({
      gameId,
      nftId,
    }));
  }

  /**
   * Clear the registry (for testing)
   */
  clearRegistry(): void {
    nftRegistry.clear();
  }

  /**
   * Get mint queue size
   */
  getQueueSize(): number {
    return this.mintQueue.length;
  }

  /**
   * Check if currently minting
   */
  isMintingInProgress(): boolean {
    return this.isMinting;
  }
}

export default AutoMintService;
