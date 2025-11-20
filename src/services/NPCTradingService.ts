/**
 * NPC Trading Service
 *
 * Enhances NPC trading (Herman) with blockchain-backed escrow functionality
 * using OneChain Move smart contracts.
 */

import {
  FrontendItem,
  TradeProposalFrontend,
  EscrowedItemFrontend,
  ITEM_TYPES,
  RARITY_LEVELS,
  ItemType,
  RarityLevel
} from '../types/onechain';
import { OneChainTransactionService } from './OneChainTransactionService';
import { ItemWalletService } from './ItemWalletService';
import { ItemLockingService } from './ItemLockingService';

export interface NPCItem {
  id: string;
  name: string;
  description: string;
  item_type: ItemType;
  rarity: RarityLevel;
  stats: number[];
  sprite_key: string;
  quantity: number;
  trade_value: number; // Estimated trade value
}

export interface NPCTradeState {
  npc_name: string;
  npc_items: FrontendItem[];
  selected_npc_items: string[];
  selected_player_items: string[];
  trade_confirmation_visible: boolean;
  current_trade: {
    player_items: FrontendItem[];
    npc_items: FrontendItem[];
    status: 'proposed' | 'escrowed' | 'completed' | 'cancelled';
    transaction_digest?: string;
  } | null;
  trade_history: Array<{
    timestamp: number;
    player_items: FrontendItem[];
    npc_items: FrontendItem[];
    result: 'completed' | 'cancelled';
  }>;
}

export interface NPCTradeConfig {
  name: string;
  items: NPCItem[];
  trade_ratio: number; // Player item value / NPC item value
  max_trade_slots: number;
  escrow_required: boolean;
}

type TradeBalanceSummary = {
  playerValue: number;
  npcValue: number;
  isBalanced: boolean;
  difference: number;
};

type NPCTradeHistoryEntry = {
  timestamp: number;
  player_items: FrontendItem[];
  npc_items: FrontendItem[];
  result: 'completed' | 'cancelled';
};

export class NPCTradingService {
  private oneChainService: OneChainTransactionService;
  private itemWalletService: ItemWalletService;
  private itemLockingService: ItemLockingService;
  private currentAddress: string | null = null;

  // NPC Configuration
  private hermanConfig: NPCTradeConfig = {
    name: 'Herman',
    items: [
      {
        id: 'herman_potion_health',
        name: 'Health Potion',
        description: 'Restores 50 HP',
        item_type: ITEM_TYPES.CONSUMABLE,
        rarity: RARITY_LEVELS.COMMON,
        stats: [50],
        sprite_key: 'potion_health_01',
        quantity: 10,
        trade_value: 5
      },
      {
        id: 'herman_fish',
        name: 'Fresh Fish',
        description: 'Delicious fish for cooking',
        item_type: ITEM_TYPES.RESOURCE,
        rarity: RARITY_LEVELS.COMMON,
        stats: [10],
        sprite_key: 'fish_01a',
        quantity: 20,
        trade_value: 3
      },
      {
        id: 'herman_candy',
        name: 'Magic Candy',
        description: 'Gives temporary speed boost',
        item_type: ITEM_TYPES.CONSUMABLE,
        rarity: RARITY_LEVELS.RARE,
        stats: [30],
        sprite_key: 'candy_01a',
        quantity: 5,
        trade_value: 15
      },
      {
        id: 'herman_helmet',
        name: 'Iron Helmet',
        description: 'Basic protective helmet',
        item_type: ITEM_TYPES.ARMOR,
        rarity: RARITY_LEVELS.COMMON,
        stats: [10],
        sprite_key: 'helmet_01a',
        quantity: 3,
        trade_value: 20
      }
    ],
    trade_ratio: 1.0, // 1:1 value ratio
    max_trade_slots: 5,
    escrow_required: true
  };

  constructor(
    oneChainService: OneChainTransactionService,
    itemWalletService: ItemWalletService,
    itemLockingService: ItemLockingService
  ) {
    this.oneChainService = oneChainService;
    this.itemWalletService = itemWalletService;
    this.itemLockingService = itemLockingService;
  }

  /**
   * Set the current wallet address
   */
  setCurrentAddress(address: string) {
    this.currentAddress = address;
    this.oneChainService.setCurrentAddress(address);
    this.itemWalletService.setCurrentAddress(address);
    this.itemLockingService.setCurrentAddress(address);
  }

  /**
   * Get available NPC items as FrontendItem format
   */
  getNPCItems(npcName: string = 'Herman'): FrontendItem[] {
    const config = this.getNPCConfig(npcName);

    return config.items.map(item => ({
      id: item.id,
      item_id: parseInt(item.id.replace(/\D/g, '')) || 0,
      item_type: item.item_type,
      rarity: item.rarity,
      name: item.name,
      description: item.description,
      stats: item.stats,
      minted_by: `npc_${npcName.toLowerCase()}`,
      mint_timestamp: Date.now(),
      owner_history: [] as string[],
      sprite_key: item.sprite_key,
      stack_size: item.quantity,
      equipped: false,
      locked: false
    }));
  }

  /**
   * Get NPC configuration by name
   */
  private getNPCConfig(npcName: string): NPCTradeConfig {
    switch (npcName.toLowerCase()) {
      case 'herman':
        return this.hermanConfig;
      default:
        throw new Error(`Unknown NPC: ${npcName}`);
    }
  }

  /**
   * Calculate trade value balance
   */
  calculateTradeBalance(
    playerItemIds: string[],
    npcItemIds: string[],
    npcName: string = 'Herman'
  ): TradeBalanceSummary {
    const config = this.getNPCConfig(npcName);

    // Calculate player item values (base on rarity and stats)
    let playerValue = 0;
    playerItemIds.forEach(itemId => {
      const item = this.itemLockingService.getLockInfo(itemId);
      if (item) {
        playerValue += this.calculateItemValue(item.item);
      }
    });

    // Calculate NPC item values
    let npcValue = 0;
    const npcItems = this.getNPCItems(npcName);
    npcItemIds.forEach(itemId => {
      const npcItem = npcItems.find(item => item.id === itemId);
      if (npcItem) {
        const configItem = config.items.find(ci => ci.id === itemId);
        npcValue += configItem?.trade_value || 0;
      }
    });

    const isBalanced = Math.abs(playerValue - npcValue) <= 5; // Allow 5 value difference
    const difference = Math.abs(playerValue - npcValue);

    return {
      playerValue,
      npcValue,
      isBalanced,
      difference
    };
  }

  /**
   * Calculate individual item value
   */
  private calculateItemValue(item: FrontendItem): number {
    let baseValue = 1;

    // Rarity multiplier
    const rarityMultipliers: Record<RarityLevel, number> = {
      [RARITY_LEVELS.COMMON]: 1,
      [RARITY_LEVELS.RARE]: 5,
      [RARITY_LEVELS.EPIC]: 20,
      [RARITY_LEVELS.LEGENDARY]: 100
    };

    baseValue *= rarityMultipliers[item.rarity];

    // Item type multiplier
    const typeMultipliers: Record<ItemType, number> = {
      [ITEM_TYPES.WEAPON]: 2,
      [ITEM_TYPES.ARMOR]: 1.5,
      [ITEM_TYPES.CONSUMABLE]: 1,
      [ITEM_TYPES.RESOURCE]: 0.5
    };

    baseValue *= typeMultipliers[item.item_type];

    // Stats contribution
    const statsValue = item.stats.reduce((sum, stat) => sum + stat, 0);
    baseValue += statsValue / 10;

    return Math.round(baseValue);
  }

  /**
   * Validate trade proposal
   */
  async validateTrade(
    playerItemIds: string[],
    npcItemIds: string[],
    npcName: string = 'Herman'
  ): Promise<{
    valid: boolean;
    error?: string;
    balance?: TradeBalanceSummary;
  }> {
    if (!this.currentAddress) {
      return { valid: false, error: 'No wallet connected' };
    }

    const config = this.getNPCConfig(npcName);

    // Check slot limits
    if (playerItemIds.length > config.max_trade_slots) {
      return { valid: false, error: `Too many player items (max ${config.max_trade_slots})` };
    }

    if (npcItemIds.length > config.max_trade_slots) {
      return { valid: false, error: `Too many NPC items (max ${config.max_trade_slots})` };
    }

    // Check player owns the items
    try {
      const playerInventory = await this.itemWalletService.getPlayerInventory();
      const ownedItemIds = playerInventory.map(item => item.id);

      for (const itemId of playerItemIds) {
        if (!ownedItemIds.includes(itemId)) {
          return { valid: false, error: `Player doesn't own item: ${itemId}` };
        }

        // Check if item is not already locked
        if (this.itemLockingService.isItemLocked(itemId)) {
          return { valid: false, error: `Item is already locked: ${itemId}` };
        }
      }
    } catch (error) {
      return { valid: false, error: 'Failed to verify player inventory' };
    }

    // Check NPC has the items
    const npcItems = this.getNPCItems(npcName);
    const npcItemIdsAvailable = npcItems.map(item => item.id);

    for (const itemId of npcItemIds) {
      if (!npcItemIdsAvailable.includes(itemId)) {
        return { valid: false, error: `NPC doesn't have item: ${itemId}` };
      }
    }

    // Check trade balance
    const balance = this.calculateTradeBalance(playerItemIds, npcItemIds, npcName);
    if (!balance.isBalanced) {
      return {
        valid: false,
        error: `Trade is not balanced. Difference: ${balance.difference}`,
        balance
      };
    }

    return { valid: true, balance };
  }

  /**
   * Execute trade with NPC using escrow system
   */
  async executeTrade(
    playerItemIds: string[],
    npcItemIds: string[],
    npcName: string = 'Herman'
  ): Promise<{
    success: boolean;
    transactionDigest?: string;
    error?: string;
    tradeItems?: {
      player_items: FrontendItem[];
      npc_items: FrontendItem[];
    };
  }> {
    if (!this.currentAddress) {
      return { success: false, error: 'No wallet connected' };
    }

    const config = this.getNPCConfig(npcName);

    // First validate the trade
    const validation = await this.validateTrade(playerItemIds, npcItemIds, npcName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // Get player items for locking
      const playerInventory = await this.itemWalletService.getPlayerInventory();
      const playerItems = playerItemIds.map(id =>
        playerInventory.find(item => item.id === id)
      ).filter(Boolean) as FrontendItem[];

      const npcItems = npcItemIds.map(id =>
        this.getNPCItems(npcName).find(item => item.id === id)
      ).filter(Boolean) as FrontendItem[];

      // Step 1: Lock player items
      const lockResults = await Promise.all(
        playerItems.map(item =>
          this.itemLockingService.lockItem(item.id, item)
        )
      );

      console.log('Player items locked:', lockResults);

      // Step 2: Create mock NPC items (in real implementation, NPC would have actual NFTs)
      // For now, we'll simulate the trade by transferring NPC items to player
      // and completing the escrow

      // Step 3: Create escrow for player items
      // Note: In a full implementation, we would create escrows for both sides
      // and execute a swap. For NPC trading, we can simplify this.

      // Step 4: Execute trade (simplified for NPC)
      // Transfer NPC items to player
      const mockTransactionDigest = `npc_trade_${Date.now()}`;

      // Step 5: Unlock any remaining locked items if trade fails
      // (This would be handled in the escrow system)

      return {
        success: true,
        transactionDigest: mockTransactionDigest,
        tradeItems: {
          player_items: playerItems,
          npc_items: npcItems
        }
      };

    } catch (error) {
      console.error('Trade execution failed:', error);

      // Try to unlock any locked items
      for (const itemId of playerItemIds) {
        try {
          const lockInfo = this.itemLockingService.getLockInfo(itemId);
          if (lockInfo) {
            await this.itemLockingService.unlockItem(lockInfo.id, lockInfo.key_id);
          }
        } catch (unlockError) {
          console.error('Failed to unlock item:', itemId, unlockError);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during trade execution'
      };
    }
  }

  /**
   * Cancel trade and unlock items
   */
  async cancelTrade(playerItemIds: string[]): Promise<{
    success: boolean;
    unlockedItems: string[];
    error?: string;
  }> {
    const unlockedItems: string[] = [];
    const errors: string[] = [];

    for (const itemId of playerItemIds) {
      try {
        const lockInfo = this.itemLockingService.getLockInfo(itemId);
        if (lockInfo) {
          await this.itemLockingService.unlockItem(lockInfo.id, lockInfo.key_id);
          unlockedItems.push(itemId);
        }
      } catch (error) {
        console.error(`Failed to unlock item ${itemId}:`, error);
        errors.push(`Failed to unlock item ${itemId}`);
      }
    }

    return {
      success: errors.length === 0,
      unlockedItems,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Get trade suggestions from NPC
   */
  getTradeSuggestions(
    playerItems: FrontendItem[],
    npcName: string = 'Herman'
  ): Array<{
    player_items: string[];
    npc_items: string[];
    value_difference: number;
  }> {
    const npcItems = this.getNPCItems(npcName);
    const suggestions: Array<{
      player_items: string[];
      npc_items: string[];
      value_difference: number;
    }> = [];

    // Simple suggestion algorithm
    for (const playerItem of playerItems) {
      if (this.itemLockingService.isItemLocked(playerItem.id)) continue;

      const playerValue = this.calculateItemValue(playerItem);

      // Find matching NPC items
      for (const npcItem of npcItems) {
        const configItem = this.getNPCConfig(npcName).items.find(ci => ci.id === npcItem.id);
        const npcValue = configItem?.trade_value || 0;

        const difference = Math.abs(playerValue - npcValue);

        if (difference <= 10) { // Within reasonable range
          suggestions.push({
            player_items: [playerItem.id],
            npc_items: [npcItem.id],
            value_difference: difference
          });
        }
      }
    }

    // Sort by value difference (best matches first)
    suggestions.sort((a, b) => a.value_difference - b.value_difference);

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Get NPC configuration for UI
   */
  getNPCConfigForUI(npcName: string = 'Herman') {
    const config = this.getNPCConfig(npcName);
    return {
      name: config.name,
      max_slots: config.max_trade_slots,
      escrow_required: config.escrow_required,
      items: config.items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sprite_key: item.sprite_key,
        quantity: item.quantity,
        trade_value: item.trade_value,
        rarity: item.rarity
      }))
    };
  }

  /**
   * Check if NPC trading is available
   */
  isNPCTradingAvailable(): boolean {
    return this.currentAddress !== null;
  }

  /**
   * Get trade history with NPC
   */
  getTradeHistory(npcName: string = 'Herman'): NPCTradeHistoryEntry[] {
    // This would be stored in local storage or fetched from a backend
    const historyKey = `trade_history_${npcName.toLowerCase()}`;
    const history = localStorage.getItem(historyKey);

    if (!history) {
      return [];
    }

    try {
      const parsed = JSON.parse(history);
      return Array.isArray(parsed) ? (parsed as NPCTradeHistoryEntry[]) : [];
    } catch (error) {
      console.warn('Failed to parse NPC trade history', error);
      return [];
    }
  }

  /**
   * Save trade to history
   */
  private saveTradeToHistory(
    playerItems: FrontendItem[],
    npcItems: FrontendItem[],
    result: 'completed' | 'cancelled',
    npcName: string = 'Herman'
  ) {
    const history = this.getTradeHistory(npcName);
    const newEntry = {
      timestamp: Date.now(),
      player_items: playerItems,
      npc_items: npcItems,
      result
    };

    history.push(newEntry);

    // Keep only last 50 trades
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    const historyKey = `trade_history_${npcName.toLowerCase()}`;
    localStorage.setItem(historyKey, JSON.stringify(history));
  }

  /**
   * Get player reputation with NPC
   */
  getPlayerReputation(npcName: string = 'Herman'): {
    score: number;
    total_trades: number;
    successful_trades: number;
    cancelled_trades: number;
  } {
    const history = this.getTradeHistory(npcName);

    const totalTrades = history.length;
    const successfulTrades = history.filter(trade => trade.result === 'completed').length;
    const cancelledTrades = history.filter(trade => trade.result === 'cancelled').length;

    // Simple reputation calculation
    const baseScore = successfulTrades * 10;
    const penalty = cancelledTrades * 5;
    const score = Math.max(0, baseScore - penalty);

    return {
      score,
      total_trades: totalTrades,
      successful_trades: successfulTrades,
      cancelled_trades: cancelledTrades
    };
  }
}