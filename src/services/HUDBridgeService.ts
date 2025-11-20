/**
 * HUD Bridge Service
 *
 * Bridge between Phaser game and React HUD store.
 * Allows Phaser scenes to update React HUD in real-time.
 */

import { useGameHUDStore } from '@/stores/GameHUDStore';
import type { PlayerStats, GameNotification } from '@/stores/GameHUDStore';

class HUDBridgeService {
  private static instance: HUDBridgeService;

  private constructor() {}

  static getInstance(): HUDBridgeService {
    if (!HUDBridgeService.instance) {
      HUDBridgeService.instance = new HUDBridgeService();
    }
    return HUDBridgeService.instance;
  }

  // === Player Stats ===

  updatePlayerStats(stats: Partial<PlayerStats>) {
    useGameHUDStore.getState().updatePlayerStats(stats);
  }

  setHealth(health: number) {
    useGameHUDStore.getState().setHealth(health);
  }

  setEnergy(energy: number) {
    useGameHUDStore.getState().setEnergy(energy);
  }

  damagePlayer(damage: number) {
    const currentHealth = useGameHUDStore.getState().playerStats.health;
    this.setHealth(currentHealth - damage);
    
    // Show damage notification
    this.notify({
      type: 'warning',
      title: 'Damage Taken',
      message: `-${damage} HP`,
      duration: 2000,
    });
  }

  healPlayer(amount: number) {
    const currentHealth = useGameHUDStore.getState().playerStats.health;
    this.setHealth(currentHealth + amount);
    
    // Show heal notification
    this.notify({
      type: 'success',
      title: 'Healed',
      message: `+${amount} HP`,
      duration: 2000,
    });
  }

  // === Inventory ===

  setSelectedSlot(slot: number) {
    useGameHUDStore.getState().setSelectedSlot(slot);
  }

  setGoldCount(count: number) {
    useGameHUDStore.getState().setGoldCount(count);
  }

  addGold(amount: number) {
    const currentGold = useGameHUDStore.getState().goldCount;
    this.setGoldCount(currentGold + amount);
    
    if (amount > 0) {
      this.notify({
        type: 'success',
        title: 'Gold Gained',
        message: `+${amount} gold`,
        duration: 2000,
      });
    }
  }

  removeGold(amount: number) {
    const currentGold = useGameHUDStore.getState().goldCount;
    this.setGoldCount(Math.max(0, currentGold - amount));
  }

  // === UI State ===

  toggleBackpack(open?: boolean) {
    useGameHUDStore.getState().toggleBackpack(open);
  }

  toggleMarketplace(open?: boolean) {
    useGameHUDStore.getState().toggleMarketplace(open);
  }

  toggleSettings(open?: boolean) {
    useGameHUDStore.getState().toggleSettings(open);
  }

  toggleGuide(open?: boolean) {
    useGameHUDStore.getState().toggleGuide(open);
  }

  // === Notifications ===

  notify(notification: Omit<GameNotification, 'id' | 'timestamp'>) {
    useGameHUDStore.getState().addNotification(notification);
  }

  notifySuccess(title: string, message: string, duration = 3000) {
    this.notify({ type: 'success', title, message, duration });
  }

  notifyError(title: string, message: string, duration = 5000) {
    this.notify({ type: 'error', title, message, duration });
  }

  notifyWarning(title: string, message: string, duration = 4000) {
    this.notify({ type: 'warning', title, message, duration });
  }

  notifyInfo(title: string, message: string, duration = 3000) {
    this.notify({ type: 'info', title, message, duration });
  }

  clearNotifications() {
    useGameHUDStore.getState().clearNotifications();
  }

  // === Scene Management ===

  setCurrentScene(scene: string) {
    useGameHUDStore.getState().setCurrentScene(scene);
  }

  // === Common Game Events ===

  onItemPickup(itemName: string, quantity = 1) {
    this.notifySuccess(
      'Item Acquired',
      `${itemName}${quantity > 1 ? ` x${quantity}` : ''}`,
      2000
    );
  }

  onLevelUp(newLevel: number) {
    const { maxHealth, maxEnergy } = useGameHUDStore.getState().playerStats;
    
    this.updatePlayerStats({
      level: newLevel,
      health: maxHealth, // Full heal on level up
      energy: maxEnergy, // Full energy on level up
    });

    this.notifySuccess(
      'Level Up!',
      `You are now level ${newLevel}`,
      4000
    );
  }

  onQuestComplete(questName: string, reward?: { gold?: number; exp?: number }) {
    this.notifySuccess('Quest Complete', questName, 4000);
    
    if (reward?.gold) {
      this.addGold(reward.gold);
    }
    
    if (reward?.exp) {
      const { experience, experienceToNextLevel } = useGameHUDStore.getState().playerStats;
      const newExp = experience + reward.exp;
      
      if (newExp >= experienceToNextLevel) {
        const { level } = useGameHUDStore.getState().playerStats;
        this.onLevelUp(level + 1);
      } else {
        this.updatePlayerStats({ experience: newExp });
      }
    }
  }

  onCropHarvested(cropType: string, quantity: number) {
    this.notifySuccess(
      'Harvest Complete',
      `${quantity}x ${cropType}`,
      2000
    );
  }

  onNFTMinted(itemName: string, transactionHash: string) {
    this.notifySuccess(
      'NFT Minted',
      `${itemName} minted successfully!`,
      5000
    );
  }

  onMarketplacePurchase(itemName: string, price: number) {
    this.notifySuccess(
      'Purchase Complete',
      `Bought ${itemName} for ${price} gold`,
      3000
    );
    this.removeGold(price);
  }

  onMarketplaceSale(itemName: string, price: number) {
    this.notifySuccess(
      'Sale Complete',
      `Sold ${itemName} for ${price} gold`,
      3000
    );
    this.addGold(price);
  }

  // === Reset ===

  reset() {
    useGameHUDStore.getState().resetHUD();
  }
}

export default HUDBridgeService;
