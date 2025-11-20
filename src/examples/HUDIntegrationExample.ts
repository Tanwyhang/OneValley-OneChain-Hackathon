/**
 * Example: Phaser Scene Integration with React HUD
 *
 * This file demonstrates how to use HUDBridgeService from Phaser scenes
 * to update the React HUD overlay in real-time.
 */

import HUDBridgeService from '@/services/HUDBridgeService';

// Example usage in FarmScene or any Phaser scene

export class ExampleSceneWithHUD extends Phaser.Scene {
  private hudBridge!: HUDBridgeService;
  private player!: Phaser.Physics.Arcade.Sprite;

  create() {
    // Get HUD bridge instance
    this.hudBridge = HUDBridgeService.getInstance();

    // Initialize player stats
    this.hudBridge.updatePlayerStats({
      health: 100,
      maxHealth: 100,
      energy: 100,
      maxEnergy: 100,
      level: 1,
      experience: 0,
      experienceToNextLevel: 100,
    });

    // Set initial gold
    this.hudBridge.setGoldCount(500);

    // Set scene name
    this.hudBridge.setCurrentScene('farm');

    // Example: Listen for inventory slot changes
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const key = parseInt(event.key);
      if (!isNaN(key) && key >= 1 && key <= 8) {
        this.hudBridge.setSelectedSlot(key - 1);
      }

      // Toggle backpack with B key
      if (event.key === 'b') {
        this.hudBridge.toggleBackpack();
      }
    });

    // Example: Player takes damage
    this.setupExampleDamage();

    // Example: Collect gold
    this.setupExampleGoldCollection();

    // Example: Harvest crops
    this.setupExampleHarvest();
  }

  private setupExampleDamage() {
    // Simulate taking damage every 10 seconds
    this.time.addEvent({
      delay: 10000,
      callback: () => {
        this.hudBridge.damagePlayer(10);
      },
      loop: true,
    });
  }

  private setupExampleGoldCollection() {
    // When player collects gold
    this.input.keyboard?.on('keydown-G', () => {
      this.hudBridge.addGold(Math.floor(Math.random() * 50) + 10);
    });
  }

  private setupExampleHarvest() {
    // When player harvests (press H)
    this.input.keyboard?.on('keydown-H', () => {
      this.hudBridge.onCropHarvested('Carrot', 5);
    });
  }

  update() {
    // Example: Update energy based on player movement
    // Note: In real implementation, you'd track current energy in the scene
    // or retrieve it from the store directly using useGameHUDStore.getState()
  }
}

// ==========================================
// Integration Examples for Existing Scenes
// ==========================================

/**
 * Example 1: Integrate into FarmScene.ts
 */
export function integrateHUDIntoFarmScene() {
  // In FarmScene.create():
  /*
  import HUDBridgeService from '@/services/HUDBridgeService';
  
  create() {
    const hudBridge = HUDBridgeService.getInstance();
    
    // Initialize player stats when scene starts
    hudBridge.updatePlayerStats({
      health: 100,
      maxHealth: 100,
      energy: 100,
      maxEnergy: 100,
      level: 1,
      experience: 0,
      experienceToNextLevel: 100,
    });
    
    hudBridge.setGoldCount(0);
    hudBridge.setCurrentScene('farm');
    
    // ... rest of your scene setup
  }
  */
}

/**
 * Example 2: Player Combat
 */
export function examplePlayerCombat() {
  /*
  // When player is hit by enemy
  const damage = 15;
  hudBridge.damagePlayer(damage);
  
  // When player uses health potion
  const healAmount = 30;
  hudBridge.healPlayer(healAmount);
  */
}

/**
 * Example 3: Inventory Management
 */
export function exampleInventoryManagement() {
  /*
  // When player selects different inventory slot
  this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
    const key = parseInt(event.key);
    if (!isNaN(key) && key >= 1 && key <= 8) {
      hudBridge.setSelectedSlot(key - 1);
    }
  });
  
  // When player toggles backpack
  this.input.keyboard.on('keydown-B', () => {
    hudBridge.toggleBackpack();
  });
  */
}

/**
 * Example 4: Crop Harvesting
 */
export function exampleCropHarvesting() {
  /*
  // When player harvests crops
  const cropType = 'Carrot';
  const quantity = 5;
  hudBridge.onCropHarvested(cropType, quantity);
  
  // Optionally show item pickup notification
  hudBridge.onItemPickup(cropType, quantity);
  */
}

/**
 * Example 5: NFT Minting
 */
export function exampleNFTMinting() {
  /*
  // After successful NFT mint
  const itemName = 'Golden Carrot';
  const txHash = '0x123...';
  hudBridge.onNFTMinted(itemName, txHash);
  */
}

/**
 * Example 6: Marketplace Transactions
 */
export function exampleMarketplace() {
  /*
  // When player buys item
  const itemName = 'Iron Sword';
  const price = 500;
  hudBridge.onMarketplacePurchase(itemName, price);
  
  // When player sells item
  hudBridge.onMarketplaceSale(itemName, price);
  */
}

/**
 * Example 7: Level Up System
 */
export function exampleLevelUp() {
  /*
  // When player gains experience
  const expGained = 50;
  const currentExp = useGameHUDStore.getState().playerStats.experience;
  const expToNextLevel = useGameHUDStore.getState().playerStats.experienceToNextLevel;
  
  if (currentExp + expGained >= expToNextLevel) {
    const newLevel = useGameHUDStore.getState().playerStats.level + 1;
    hudBridge.onLevelUp(newLevel);
  } else {
    hudBridge.updatePlayerStats({ 
      experience: currentExp + expGained 
    });
  }
  */
}

/**
 * Example 8: Quest System
 */
export function exampleQuests() {
  /*
  // When quest is completed
  hudBridge.onQuestComplete('Harvest 10 Carrots', {
    gold: 100,
    exp: 50
  });
  */
}

/**
 * Example 9: Custom Notifications
 */
export function exampleNotifications() {
  /*
  // Success notification
  hudBridge.notifySuccess('Achievement Unlocked', 'First Harvest!');
  
  // Error notification
  hudBridge.notifyError('Not Enough Gold', 'You need 500 gold for this item');
  
  // Warning notification
  hudBridge.notifyWarning('Low Health', 'Your health is below 20%');
  
  // Info notification
  hudBridge.notifyInfo('Tip', 'Press B to open your backpack');
  */
}
