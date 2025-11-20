/**
 * Example: Auto-Mint Integration
 * 
 * Shows how to automatically mint items when they're created/picked up in-game
 */

import AutoMintService from '../services/AutoMintService';
import { RARITY_LEVELS } from '../services/OneChainMintingService';

// ============================================================================
// Example 1: Auto-mint when harvesting crops
// ============================================================================

export function onCropHarvested(cropType: string, quantity: number) {
  const autoMint = AutoMintService.getInstance();

  // Queue the item for minting (non-blocking)
  autoMint.autoMintItem({
    id: `crop_${cropType}_${Date.now()}`,
    name: cropType.charAt(0).toUpperCase() + cropType.slice(1),
    description: `Fresh ${cropType} harvested from your farm`,
    type: 'resource',
    rarity: RARITY_LEVELS.COMMON,
    stats: [quantity, 0], // quantity, quality
  });

  console.log(`🌾 Harvested ${cropType}, minting as NFT...`);
}

// ============================================================================
// Example 2: Auto-mint when picking up items
// ============================================================================

export function onItemPickup(itemId: string, itemData: any) {
  const autoMint = AutoMintService.getInstance();

  // Check if already minted
  if (autoMint.isMinted(itemId)) {
    console.log(`Item ${itemId} already exists as NFT`);
    return;
  }

  // Mint in background
  autoMint.autoMintItem({
    id: itemId,
    name: itemData.name,
    description: itemData.description,
    type: itemData.type,
    rarity: itemData.rarity || RARITY_LEVELS.COMMON,
    stats: itemData.stats || [10, 10],
  });
}

// ============================================================================
// Example 3: Mint before trading (synchronous)
// ============================================================================

export async function onBeforeTrade(item: any): Promise<string | null> {
  const autoMint = AutoMintService.getInstance();

  // Check if already minted
  let nftId = autoMint.getNFTObjectId(item.id);
  
  if (nftId) {
    console.log(`Using existing NFT: ${nftId}`);
    return nftId;
  }

  // Mint now and wait for completion
  console.log(`Item not minted yet, minting before trade...`);
  nftId = await autoMint.mintItemNow(item);

  if (nftId) {
    console.log(`✅ Item minted successfully: ${nftId}`);
    return nftId;
  } else {
    console.log(`❌ Failed to mint item, using fallback`);
    return null;
  }
}

// ============================================================================
// Example 4: Batch mint all inventory items
// ============================================================================

export async function mintAllInventoryItems(inventory: any[]) {
  const autoMint = AutoMintService.getInstance();

  const itemsToMint = inventory.filter(item => !autoMint.isMinted(item.id));

  if (itemsToMint.length === 0) {
    console.log('All items already minted!');
    return;
  }

  console.log(`Minting ${itemsToMint.length} inventory items...`);
  await autoMint.batchMintItems(itemsToMint);
}

// ============================================================================
// Example 5: Check mint status
// ============================================================================

export function getMintStatus() {
  const autoMint = AutoMintService.getInstance();

  return {
    queueSize: autoMint.getQueueSize(),
    isMinting: autoMint.isMintingInProgress(),
    mintedItems: autoMint.getMintedItems(),
  };
}

// ============================================================================
// Example 6: Use in Phaser scene
// ============================================================================

export class ItemManager {
  private autoMint: AutoMintService;

  constructor() {
    this.autoMint = AutoMintService.getInstance();
  }

  // When player picks up an item
  pickupItem(itemId: string, itemData: any) {
    // Add to inventory
    this.addToInventory(itemData);

    // Auto-mint in background
    this.autoMint.autoMintItem({
      id: itemId,
      name: itemData.name,
      description: itemData.description || '',
      type: itemData.type || 'consumable',
      rarity: itemData.rarity || RARITY_LEVELS.COMMON,
      stats: itemData.stats || [0, 0],
    });

    console.log(`📦 ${itemData.name} added to inventory and queued for minting`);
  }

  // When initiating a trade
  async initiateTrade(itemId: string) {
    // Get or create NFT
    let nftId = this.autoMint.getNFTObjectId(itemId);

    if (!nftId) {
      console.log('Item not minted yet, minting now...');
      const item = this.getItemFromInventory(itemId);
      nftId = await this.autoMint.mintItemNow(item);
    }

    if (nftId) {
      // Use the NFT object ID for blockchain trading
      return this.executeTrade(nftId);
    } else {
      // Fallback to simulation mode
      return this.executeSimulatedTrade(itemId);
    }
  }

  // Helpers (implement based on your game)
  private addToInventory(itemData: any) { /* ... */ }
  private getItemFromInventory(itemId: string): any { return {}; }
  private async executeTrade(nftId: string) { /* ... */ }
  private async executeSimulatedTrade(itemId: string) { /* ... */ }
}
