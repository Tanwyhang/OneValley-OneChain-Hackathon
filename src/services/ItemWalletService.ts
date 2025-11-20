/**
 * Item Wallet Service
 *
 * Manages player's GameItem NFTs from OneChain blockchain,
 * handles inventory synchronization and item state management.
 */

import { SuiClient } from '@onelabs/sui/client';
import {
  FrontendItem,
  GameItem,
  Weapon,
  Armor,
  ItemType,
  RarityLevel,
  ITEM_TYPES,
  RARITY_LEVELS,
  getItemTypeString,
  getRarityString,
  getRarityColor
} from '../types/onechain';

// Configuration
const ONEVALLEY_PACKAGE_ID = '0x9d3d2c56c66134068a6be7ded289cf1915939f0b65a46483d3414a6da5f3ef89';
const ITEMS_MODULE = `${ONEVALLEY_PACKAGE_ID}::items`;

// Item sprite mapping (connect to game assets)
const ITEM_SPRITE_MAP: Record<string, string> = {
  // Weapons
  '1': 'weapon_sword_01', // Common Sword
  '2': 'weapon_sword_02', // Rare Sword
  '3': 'weapon_axe_01',   // Common Axe
  '4': 'weapon_bow_01',   // Common Bow

  // Armors
  '101': 'armor_helmet_01', // Common Helmet
  '102': 'armor_helmet_02', // Rare Helmet
  '103': 'armor_chest_01',  // Common Chest

  // Consumables
  '201': 'potion_health_01',
  '202': 'potion_mana_01',
  '203': 'food_bread_01',

  // Resources
  '301': 'resource_wood_01',
  '302': 'resource_stone_01',
  '303': 'resource_iron_01',
};

export interface InventoryFilter {
  item_type?: ItemType;
  rarity?: RarityLevel;
  search?: string;
  equipped_only?: boolean;
  tradeable_only?: boolean;
}

export interface InventoryStats {
  total_items: number;
  by_type: Record<ItemType, number>;
  by_rarity: Record<RarityLevel, number>;
  total_value: number; // Estimated value
}

export class ItemWalletService {
  private client: SuiClient;
  private currentAddress: string | null = null;
  private inventoryCache: Map<string, FrontendItem[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(client: SuiClient) {
    this.client = client;
  }

  /**
   * Set the current wallet address
   */
  setCurrentAddress(address: string) {
    this.currentAddress = address;
  }

  /**
   * Get player's inventory with caching
   */
  async getPlayerInventory(address?: string, forceRefresh = false): Promise<FrontendItem[]> {
    const playerAddress = address || this.currentAddress;
    if (!playerAddress) {
      throw new Error('No wallet address provided');
    }

    const cacheKey = playerAddress;
    const now = Date.now();

    // Check cache
    if (!forceRefresh && this.inventoryCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        return this.inventoryCache.get(cacheKey)!;
      }
    }

    try {
      // Fetch from blockchain
      const items = await this.fetchPlayerItems(playerAddress);

      // Cache results
      this.inventoryCache.set(cacheKey, items);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return items;
    } catch (error) {
      console.error('Error fetching player inventory:', error);
      // Return cached items if available, even if expired
      return this.inventoryCache.get(cacheKey) || [];
    }
  }

  /**
   * Fetch items directly from blockchain
   */
  private async fetchPlayerItems(address: string): Promise<FrontendItem[]> {
    try {
      // Get owned objects with pagination
      const allItems: FrontendItem[] = [];
      let hasNextPage = true;
      let cursor: string | null | undefined;

      while (hasNextPage) {
        const response = await this.client.getOwnedObjects({
          owner: address,
          filter: {
            MatchAny: [
              {
                StructType: `${ITEMS_MODULE}::GameItem`
              },
              {
                StructType: `${ITEMS_MODULE}::Weapon`
              },
              {
                StructType: `${ITEMS_MODULE}::Armor`
              }
            ]
          },
          options: {
            showContent: true,
            showType: true,
            showDisplay: true
          },
          cursor,
          limit: 50
        });

        if (response.data) {
          const items = await this.parseOwnedObjects(response.data);
          allItems.push(...items);
        }

        hasNextPage = response.hasNextPage;
        cursor = response.nextCursor;
      }

      return allItems;
    } catch (error) {
      console.error('Error fetching items from blockchain:', error);
      throw error;
    }
  }

  /**
   * Parse owned objects into FrontendItem format
   */
  private async parseOwnedObjects(objects: any[]): Promise<FrontendItem[]> {
    const items: FrontendItem[] = [];

    for (const object of objects) {
      if (!object.data?.content) continue;

      const { type, fields } = object.data.content;

      try {
        let item: FrontendItem;

        if (type.includes('GameItem')) {
          item = this.parseGameItem(object.data.objectId, fields, type);
        } else if (type.includes('Weapon')) {
          item = await this.parseWeapon(object.data.objectId, fields, type);
        } else if (type.includes('Armor')) {
          item = await this.parseArmor(object.data.objectId, fields, type);
        } else {
          continue; // Skip unknown types
        }

        // Add sprite mapping
        item.sprite_key = ITEM_SPRITE_MAP[item.item_id.toString()] || 'item_default';
        item.stack_size = 1; // NFTs don't stack by default
        item.equipped = false;
        item.locked = false;

        items.push(item);
      } catch (parseError) {
        console.error('Error parsing item:', object.data.objectId, parseError);
      }
    }

    return items;
  }

  /**
   * Parse basic GameItem
   */
  private parseGameItem(id: string, fields: any, type: string): FrontendItem {
    return {
      id,
      item_id: fields.item_id,
      item_type: fields.item_type,
      rarity: fields.rarity,
      name: fields.name,
      description: fields.description,
      stats: fields.stats || [],
      minted_by: fields.minted_by,
      mint_timestamp: fields.mint_timestamp,
      owner_history: fields.owner_history || []
    };
  }

  /**
   * Parse Weapon (extends GameItem)
   */
  private async parseWeapon(id: string, fields: any, type: string): Promise<FrontendItem> {
    const baseItem = this.parseGameItem(id + '_base', fields.base, type);

    return {
      ...baseItem,
      id,
      // Override type-specific fields
      stats: [
        ...baseItem.stats,
        fields.damage,      // Add damage to stats
        fields.max_durability // Add durability to stats
      ],
      // Additional weapon-specific data could be stored here
      name: baseItem.name,
      item_type: ITEM_TYPES.WEAPON
    };
  }

  /**
   * Parse Armor (extends GameItem)
   */
  private async parseArmor(id: string, fields: any, type: string): Promise<FrontendItem> {
    const baseItem = this.parseGameItem(id + '_base', fields.base, type);

    return {
      ...baseItem,
      id,
      // Override type-specific fields
      stats: [
        ...baseItem.stats,
        fields.defense,      // Add defense to stats
        fields.max_durability // Add durability to stats
      ],
      // Additional armor-specific data could be stored here
      name: baseItem.name,
      item_type: ITEM_TYPES.ARMOR
    };
  }

  /**
   * Get filtered inventory
   */
  async getFilteredInventory(filter: InventoryFilter): Promise<FrontendItem[]> {
    const allItems = await this.getPlayerInventory();

    return allItems.filter(item => {
      // Type filter
      if (filter.item_type && item.item_type !== filter.item_type) {
        return false;
      }

      // Rarity filter
      if (filter.rarity && item.rarity !== filter.rarity) {
        return false;
      }

      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        if (!item.name.toLowerCase().includes(searchLower) &&
            !item.description.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Equipped filter
      if (filter.equipped_only && !item.equipped) {
        return false;
      }

      // Tradeable filter
      if (filter.tradeable_only && item.locked) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(): Promise<InventoryStats> {
    const items = await this.getPlayerInventory();

    const stats: InventoryStats = {
      total_items: items.length,
      by_type: {
        [ITEM_TYPES.WEAPON]: 0,
        [ITEM_TYPES.ARMOR]: 0,
        [ITEM_TYPES.CONSUMABLE]: 0,
        [ITEM_TYPES.RESOURCE]: 0
      },
      by_rarity: {
        [RARITY_LEVELS.COMMON]: 0,
        [RARITY_LEVELS.RARE]: 0,
        [RARITY_LEVELS.EPIC]: 0,
        [RARITY_LEVELS.LEGENDARY]: 0
      },
      total_value: 0
    };

    items.forEach(item => {
      // Count by type
      if (item.item_type in stats.by_type) {
        stats.by_type[item.item_type as ItemType]++;
      }

      // Count by rarity
      if (item.rarity in stats.by_rarity) {
        stats.by_rarity[item.rarity as RarityLevel]++;
      }

      // Simple value calculation (rarity * base value)
      const rarityValue = {
        [RARITY_LEVELS.COMMON]: 1,
        [RARITY_LEVELS.RARE]: 5,
        [RARITY_LEVELS.EPIC]: 20,
        [RARITY_LEVELS.LEGENDARY]: 100
      }[item.rarity];

      stats.total_value += rarityValue;
    });

    return stats;
  }

  /**
   * Get items available for trading (not locked)
   */
  async getTradeableItems(): Promise<FrontendItem[]> {
    return this.getFilteredInventory({
      tradeable_only: true
    });
  }

  /**
   * Get items by type
   */
  async getItemsByType(itemType: ItemType): Promise<FrontendItem[]> {
    return this.getFilteredInventory({
      item_type: itemType
    });
  }

  /**
   * Get items by rarity
   */
  async getItemsByRarity(rarity: RarityLevel): Promise<FrontendItem[]> {
    return this.getFilteredInventory({
      rarity
    });
  }

  /**
   * Search items by name or description
   */
  async searchItems(query: string): Promise<FrontendItem[]> {
    return this.getFilteredInventory({
      search: query
    });
  }

  /**
   * Get specific item by ID
   */
  async getItemById(itemId: string): Promise<FrontendItem | null> {
    try {
      const object = await this.client.getObject({
        id: itemId,
        options: {
          showContent: true,
          showType: true
        }
      });

      if (!object.data?.content) return null;

      const parsedItems = await this.parseOwnedObjects([object]);
      return parsedItems[0] || null;
    } catch (error) {
      console.error('Error fetching item by ID:', itemId, error);
      return null;
    }
  }

  /**
   * Clear cache for specific address or all
   */
  clearCache(address?: string) {
    if (address) {
      this.inventoryCache.delete(address);
      this.cacheExpiry.delete(address);
    } else {
      this.inventoryCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Refresh inventory cache
   */
  async refreshInventory(address?: string): Promise<FrontendItem[]> {
    return this.getPlayerInventory(address, true);
  }

  /**
   * Format item for display
   */
  formatItemForDisplay(item: FrontendItem): {
    name: string;
    description: string;
    rarity: string;
    rarityColor: string;
    type: string;
    stats: string[];
  } {
    return {
      name: item.name,
      description: item.description,
      rarity: getRarityString(item.rarity),
      rarityColor: getRarityColor(item.rarity),
      type: getItemTypeString(item.item_type),
      stats: this.formatItemStats(item)
    };
  }

  /**
   * Format item stats for display
   */
  private formatItemStats(item: FrontendItem): string[] {
    const stats: string[] = [];

    // Common stat patterns based on item type
    if (item.item_type === ITEM_TYPES.WEAPON) {
      if (item.stats[0]) stats.push(`Damage: ${item.stats[0]}`);
      if (item.stats[1]) stats.push(`Durability: ${item.stats[1]}`);
    } else if (item.item_type === ITEM_TYPES.ARMOR) {
      if (item.stats[0]) stats.push(`Defense: ${item.stats[0]}`);
      if (item.stats[1]) stats.push(`Durability: ${item.stats[1]}`);
    }

    // Add any additional stats
    for (let i = 2; i < item.stats.length; i++) {
      stats.push(`Stat ${i + 1}: ${item.stats[i]}`);
    }

    return stats;
  }

  /**
   * Get total inventory value estimation
   */
  async getInventoryValue(): Promise<number> {
    const stats = await this.getInventoryStats();
    return stats.total_value;
  }

  /**
   * Check if item is tradeable
   */
  isItemTradeable(item: FrontendItem): boolean {
    return !item.locked && item.item_type !== ITEM_TYPES.RESOURCE; // Resources might not be tradeable
  }
}