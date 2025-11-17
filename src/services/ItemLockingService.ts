/**
 * Item Locking Service
 *
 * Handles item locking and unlocking using the lock.move module
 * for escrow-based trading functionality.
 */

import { Transaction } from '@onelabs/sui/dist/esm/transactions';
import { SuiClient } from '@onelabs/sui/dist/esm/client';
import {
  Key,
  Locked,
  FrontendItem,
  LockItemParams,
  MoveCallResult,
  TransactionOptions
} from '../types/onechain';

// Configuration
const ONEVALLEY_PACKAGE_ID = '0x...'; // Replace with actual deployed package ID
const LOCK_MODULE = `${ONEVALLEY_PACKAGE_ID}::lock`;

export interface LockResult {
  lockedItemId: string;
  keyId: string;
  transactionDigest: string;
  item: FrontendItem;
}

export interface UnlockResult {
  unlockedItemId: string;
  transactionDigest: string;
  item: FrontendItem;
}

export interface LockedItemData {
  id: string;
  original_item_id: string;
  key_id: string;
  item: FrontendItem;
  locked_at: number;
  expires_at?: number;
  trade_id?: string;
}

export interface LockingStats {
  total_locked_items: number;
  locks_by_type: Record<number, number>;
  expired_locks: number;
  active_locks: number;
}

export class ItemLockingService {
  private client: SuiClient;
  private currentAddress: string | null = null;
  private lockedItemsCache: Map<string, LockedItemData> = new Map();
  private lockExpiryTime: number = 300000; // 5 minutes default

  constructor(client: SuiClient, lockExpiryTime?: number) {
    this.client = client;
    if (lockExpiryTime) {
      this.lockExpiryTime = lockExpiryTime;
    }
  }

  /**
   * Set the current wallet address
   */
  setCurrentAddress(address: string) {
    this.currentAddress = address;
  }

  /**
   * Lock an item for trading
   */
  async lockItem(
    itemId: string,
    item: FrontendItem,
    options?: TransactionOptions
  ): Promise<LockResult> {
    if (!this.currentAddress) {
      throw new Error('No wallet address set');
    }

    // Check if item is already locked
    if (this.lockedItemsCache.has(itemId)) {
      throw new Error('Item is already locked');
    }

    const tx = new Transaction();
    tx.setSender(this.currentAddress);

    // Set gas budget if provided
    if (options?.gasBudget) {
      tx.setGasBudget(options.gasBudget);
    }

    // Call the lock function
    const [lockedItem, key] = tx.moveCall({
      target: `${LOCK_MODULE}::lock`,
      arguments: [tx.object(itemId)],
      typeArguments: [] // Type will be inferred from the item
    });

    // Execute transaction
    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
        ...options
      }
    });

    if (result.effects?.status.status !== 'success') {
      const errorMsg = result.effects?.status.error || 'Unknown error';
      throw new Error(`Lock transaction failed: ${errorMsg}`);
    }

    // Extract created object IDs
    const objectChanges = result.objectChanges || [];
    const lockedItemChange = objectChanges.find(change =>
      change.type === 'created' &&
      (change.objectType.includes('Locked') ||
       change.objectType.includes(`${ONEVALLEY_PACKAGE_ID}::lock::Locked`))
    );

    const keyChange = objectChanges.find(change =>
      change.type === 'created' &&
      (change.objectType.includes('Key') ||
       change.objectType.includes(`${ONEVALLEY_PACKAGE_ID}::lock::Key`))
    );

    if (!lockedItemChange || !keyChange) {
      throw new Error('Could not extract locked item or key IDs from transaction');
    }

    const lockData: LockedItemData = {
      id: lockedItemChange.objectId,
      original_item_id: itemId,
      key_id: keyChange.objectId,
      item: { ...item, locked: true },
      locked_at: Date.now(),
      expires_at: Date.now() + this.lockExpiryTime
    };

    // Cache the lock data
    this.lockedItemsCache.set(itemId, lockData);
    this.lockedItemsCache.set(lockedItemChange.objectId, lockData);

    return {
      lockedItemId: lockedItemChange.objectId,
      keyId: keyChange.objectId,
      transactionDigest: result.digest,
      item: lockData.item
    };
  }

  /**
   * Unlock an item (typically used when a trade is cancelled)
   */
  async unlockItem(
    lockedItemId: string,
    keyId: string,
    options?: TransactionOptions
  ): Promise<UnlockResult> {
    if (!this.currentAddress) {
      throw new Error('No wallet address set');
    }

    const tx = new Transaction();
    tx.setSender(this.currentAddress);

    if (options?.gasBudget) {
      tx.setGasBudget(options.gasBudget);
    }

    // Call the unlock function
    const unlockedItem = tx.moveCall({
      target: `${LOCK_MODULE}::unlock`,
      arguments: [
        tx.object(lockedItemId),
        tx.object(keyId)
      ]
    });

    // Transfer the unlocked item back to the owner
    tx.transferObjects([unlockedItem], this.currentAddress);

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true,
        ...options
      }
    });

    if (result.effects?.status.status !== 'success') {
      const errorMsg = result.effects?.status.error || 'Unknown error';
      throw new Error(`Unlock transaction failed: ${errorMsg}`);
    }

    // Get original item data from cache
    const lockData = this.lockedItemsCache.get(lockedItemId);
    if (!lockData) {
      throw new Error('Lock data not found for item');
    }

    // Remove from cache
    this.lockedItemsCache.delete(lockedItemId);
    this.lockedItemsCache.delete(lockData.original_item_id);

    const unlockedItemData = {
      ...lockData.item,
      locked: false
    };

    return {
      unlockedItemId: lockData.original_item_id,
      transactionDigest: result.digest,
      item: unlockedItemData
    };
  }

  /**
   * Get lock information for an item
   */
  getLockInfo(itemId: string): LockedItemData | null {
    return this.lockedItemsCache.get(itemId) || null;
  }

  /**
   * Get all locked items for current user
   */
  getLockedItems(): LockedItemData[] {
    return Array.from(this.lockedItemsCache.values()).filter(
      lock => lock.item.locked
    );
  }

  /**
   * Check if an item is locked
   */
  isItemLocked(itemId: string): boolean {
    const lockData = this.lockedItemsCache.get(itemId);
    return lockData ? lockData.item.locked : false;
  }

  /**
   * Get key ID for a locked item
   */
  getKeyIdForItem(itemId: string): string | null {
    const lockData = this.lockedItemsCache.get(itemId);
    return lockData ? lockData.key_id : null;
  }

  /**
   * Set expiry time for locks
   */
  setLockExpiryTime(expiryTime: number) {
    this.lockExpiryTime = expiryTime;
  }

  /**
   * Get locks that are about to expire
   */
  getExpiringLocks(withinMinutes: number = 5): LockedItemData[] {
    const now = Date.now();
    const threshold = now + (withinMinutes * 60 * 1000);

    return Array.from(this.lockedItemsCache.values()).filter(
      lock => lock.expires_at && lock.expires_at <= threshold
    );
  }

  /**
   * Clean up expired locks
   */
  cleanupExpiredLocks(): LockedItemData[] {
    const now = Date.now();
    const expiredLocks: LockedItemData[] = [];

    for (const [key, lock] of this.lockedItemsCache.entries()) {
      if (lock.expires_at && lock.expires_at <= now) {
        expiredLocks.push(lock);
        this.lockedItemsCache.delete(key);
      }
    }

    return expiredLocks;
  }

  /**
   * Get locking statistics
   */
  getLockingStats(): LockingStats {
    const lockedItems = Array.from(this.lockedItemsCache.values());
    const now = Date.now();

    const stats: LockingStats = {
      total_locked_items: lockedItems.length,
      locks_by_type: {},
      expired_locks: 0,
      active_locks: 0
    };

    lockedItems.forEach(lock => {
      // Count by type
      const itemType = lock.item.item_type;
      stats.locks_by_type[itemType] = (stats.locks_by_type[itemType] || 0) + 1;

      // Check if expired
      if (lock.expires_at && lock.expires_at <= now) {
        stats.expired_locks++;
      } else {
        stats.active_locks++;
      }
    });

    return stats;
  }

  /**
   * Batch lock multiple items
   */
  async batchLockItems(
    itemsToLock: Array<{ itemId: string; item: FrontendItem }>,
    options?: TransactionOptions
  ): Promise<LockResult[]> {
    if (!this.currentAddress) {
      throw new Error('No wallet address set');
    }

    const results: LockResult[] = [];

    for (const { itemId, item } of itemsToLock) {
      try {
        const result = await this.lockItem(itemId, item, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to lock item ${itemId}:`, error);
        // Continue with other items, but note the failure
        throw error; // Or you could collect all errors and throw at the end
      }
    }

    return results;
  }

  /**
   * Validate lock parameters
   */
  validateLockParams(params: LockItemParams): { valid: boolean; error?: string } {
    if (!params.itemId) {
      return { valid: false, error: 'Item ID is required' };
    }

    if (this.isItemLocked(params.itemId)) {
      return { valid: false, error: 'Item is already locked' };
    }

    return { valid: true };
  }

  /**
   * Get locked item by key ID
   */
  getLockedItemByKey(keyId: string): LockedItemData | null {
    for (const lock of this.lockedItemsCache.values()) {
      if (lock.key_id === keyId) {
        return lock;
      }
    }
    return null;
  }

  /**
   * Clear locking cache
   */
  clearCache() {
    this.lockedItemsCache.clear();
  }

  /**
   * Refresh locking data from blockchain
   */
  async refreshLockData(): Promise<void> {
    if (!this.currentAddress) {
      throw new Error('No wallet address set');
    }

    try {
      // Get all locked objects owned by current address
      const lockedObjects = await this.client.getOwnedObjects({
        owner: this.currentAddress,
        filter: {
          StructType: `${LOCK_MODULE}::Locked`
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      // Clear cache and rebuild
      this.lockedItemsCache.clear();

      for (const object of lockedObjects.data) {
        if (object.data?.content) {
          // Parse locked object and add to cache
          // This would need to extract the original item data
          // For now, we'll skip detailed parsing
          console.log('Found locked object:', object.data.objectId);
        }
      }
    } catch (error) {
      console.error('Error refreshing lock data:', error);
    }
  }

  /**
   * Monitor lock expiration (call this periodically)
   */
  startExpirationMonitor(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      const expiredLocks = this.cleanupExpiredLocks();
      if (expiredLocks.length > 0) {
        console.log(`Cleaned up ${expiredLocks.length} expired locks`);
        // Emit event or notify UI about expired locks
        this.notifyExpiredLocks(expiredLocks);
      }
    }, intervalMs);
  }

  /**
   * Notify about expired locks
   */
  private notifyExpiredLocks(expiredLocks: LockedItemData[]) {
    // This could emit an event, update state, or call a callback
    // For now, we'll just log it
    expiredLocks.forEach(lock => {
      console.log(`Lock expired for item: ${lock.item.name}`);
    });
  }

  /**
   * Estimate gas cost for locking
   */
  async estimateLockGasCost(itemId: string): Promise<number> {
    // This would simulate the transaction to get gas estimate
    // For now, return a reasonable default
    return 1000000; // 0.001 SUI in Mists
  }

  /**
   * Validate that key matches lock
   */
  async validateKeyForLock(lockedItemId: string, keyId: string): Promise<boolean> {
    try {
      // Get the locked object
      const lockedObject = await this.client.getObject({
        id: lockedItemId,
        options: {
          showContent: true
        }
      });

      if (!lockedObject.data?.content) {
        return false;
      }

      const fields = (lockedObject.data.content.fields as any);
      return fields.key === keyId;
    } catch (error) {
      console.error('Error validating key for lock:', error);
      return false;
    }
  }
}