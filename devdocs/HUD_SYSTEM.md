# React + Phaser HUD System

## Overview

This project uses **React for HUD** and **Phaser for gameplay** — the recommended hybrid architecture for modern game development with Next.js.

### Architecture

```
┌─────────────────────────────────────┐
│         React Layer (TSX)           │
│  ┌──────────┐      ┌──────────┐   │
│  │   HUD    │      │Notifications│  │
│  └──────────┘      └──────────┘   │
│         ↕                           │
│  ┌──────────────────────────────┐  │
│  │   Zustand Store (State)      │  │
│  └──────────────────────────────┘  │
│         ↕                           │
│  ┌──────────────────────────────┐  │
│  │   HUDBridgeService           │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
         ↕
┌─────────────────────────────────────┐
│       Phaser Layer (Canvas)         │
│  ┌──────────┐      ┌──────────┐   │
│  │FarmScene │      │UIScene   │   │
│  └──────────┘      └──────────┘   │
└─────────────────────────────────────┘
```

## Features

✅ **Real-time sync** between Phaser and React
✅ **Zero performance cost** — HUD is pure React/DOM
✅ **Full React power** — hooks, state, Tailwind, animations
✅ **Type-safe** — Full TypeScript support
✅ **Zustand state** — Fast, simple state management
✅ **Toast notifications** — Auto-dismiss, stacking, animations
✅ **Easy integration** — Simple API for Phaser scenes

## Quick Start

### 1. Import HUD Bridge in Your Phaser Scene

```typescript
import HUDBridgeService from '@/services/HUDBridgeService';

export class FarmScene extends Phaser.Scene {
  private hudBridge!: HUDBridgeService;

  create() {
    // Get singleton instance
    this.hudBridge = HUDBridgeService.getInstance();

    // Initialize player stats
    this.hudBridge.updatePlayerStats({
      health: 100,
      maxHealth: 100,
      energy: 100,
      maxEnergy: 100,
      level: 1,
    });

    // Set gold
    this.hudBridge.setGoldCount(500);
  }
}
```

### 2. Update HUD from Game Events

```typescript
// Player takes damage
this.hudBridge.damagePlayer(15);

// Player heals
this.hudBridge.healPlayer(30);

// Add gold
this.hudBridge.addGold(100);

// Show notification
this.hudBridge.notifySuccess('Level Up!', 'You are now level 2');
```

## API Reference

### Player Stats

```typescript
// Update multiple stats at once
hudBridge.updatePlayerStats({
  health: 80,
  energy: 50,
  level: 2,
});

// Update specific stats
hudBridge.setHealth(health);
hudBridge.setEnergy(energy);

// Helper methods
hudBridge.damagePlayer(damage);  // Decreases health + shows notification
hudBridge.healPlayer(amount);     // Increases health + shows notification
```

### Inventory & Resources

```typescript
// Change selected slot (0-7)
hudBridge.setSelectedSlot(3);

// Update gold
hudBridge.setGoldCount(1000);
hudBridge.addGold(50);        // Add gold + show notification
hudBridge.removeGold(100);    // Remove gold (no notification)
```

### UI State

```typescript
// Toggle UI panels
hudBridge.toggleBackpack(true);      // Open backpack
hudBridge.toggleBackpack(false);     // Close backpack
hudBridge.toggleBackpack();          // Toggle

hudBridge.toggleMarketplace(true);
hudBridge.toggleSettings(true);
hudBridge.toggleGuide(true);
```

### Notifications

```typescript
// Typed notifications
hudBridge.notifySuccess('Title', 'Message', 3000);  // Green, 3s
hudBridge.notifyError('Title', 'Message', 5000);    // Red, 5s
hudBridge.notifyWarning('Title', 'Message', 4000);  // Yellow, 4s
hudBridge.notifyInfo('Title', 'Message', 3000);     // Blue, 3s

// Custom notification
hudBridge.notify({
  type: 'success',
  title: 'Achievement',
  message: 'First Harvest!',
  duration: 5000,  // undefined = persist until closed
});

// Clear all notifications
hudBridge.clearNotifications();
```

### Game Events

High-level helpers for common game events:

```typescript
// Item pickup
hudBridge.onItemPickup('Golden Carrot', 5);

// Level up
hudBridge.onLevelUp(2);  // Auto heals + shows notification

// Quest complete
hudBridge.onQuestComplete('First Harvest', {
  gold: 100,
  exp: 50,
});

// Crop harvested
hudBridge.onCropHarvested('Carrot', 10);

// NFT minted
hudBridge.onNFTMinted('Golden Sword', '0x123...');

// Marketplace
hudBridge.onMarketplacePurchase('Iron Sword', 500);
hudBridge.onMarketplaceSale('Wooden Shield', 300);
```

## Component Structure

### GameHUD Component

Located at: `src/components/GameHUD.tsx`

Displays:
- ❤️ Health bar (top-left)
- ⚡ Energy bar (top-left)
- 🎚️ Level (top-left)
- 💰 Gold count (top-right)
- 👛 Wallet address (top-right)
- 🎒 Backpack indicator (when open)
- 🎮 Selected slot (bottom-center)

### GameNotifications Component

Located at: `src/components/GameNotifications.tsx`

Features:
- Auto-stacking notifications (top-right)
- Auto-dismiss with configurable duration
- Manual close button
- Type-based icons and colors
- Smooth animations (slide-in-from-right)

### GameHUDStore (Zustand)

Located at: `src/stores/GameHUDStore.ts`

State includes:
- Player stats (health, energy, level, exp)
- Inventory state (selected slot, gold)
- UI state (backpack, marketplace, settings, guide open)
- Notifications array
- Current scene

### HUDBridgeService

Located at: `src/services/HUDBridgeService.ts`

Singleton service that provides Phaser → React bridge.

## Styling

All HUD components use Tailwind CSS with:
- `pointer-events-none` on container (clicks pass through to game)
- `pointer-events-auto` on interactive elements
- `backdrop-blur-sm` for glass effect
- `bg-black/70` for semi-transparent backgrounds
- Smooth transitions and animations

## Performance

✅ **Zero overhead** — React renders only when state changes
✅ **No canvas rendering** — HUD is pure DOM
✅ **Efficient updates** — Zustand only re-renders affected components
✅ **Auto-cleanup** — Notifications auto-remove after duration

## Integration Examples

See `src/examples/HUDIntegrationExample.ts` for comprehensive examples of:
- Combat system integration
- Inventory management
- Crop harvesting
- NFT minting
- Marketplace transactions
- Quest system
- Custom notifications

## Customization

### Change HUD Position

Edit `src/components/GameHUD.tsx`:

```tsx
<div className="absolute top-4 left-4">  {/* Change position */}
  {/* Health bar */}
</div>
```

### Change Colors

Edit Tailwind classes:

```tsx
<div className="bg-gradient-to-r from-red-500 to-red-400">  {/* Change gradient */}
```

### Add New HUD Elements

1. Add state to `GameHUDStore.ts`
2. Add UI to `GameHUD.tsx`
3. Add helper methods to `HUDBridgeService.ts`

## Best Practices

✅ **DO**: Use HUDBridge for all Phaser → React updates
✅ **DO**: Keep HUD simple and performant
✅ **DO**: Use notifications for temporary messages
✅ **DO**: Use Zustand selectors to prevent unnecessary re-renders

❌ **DON'T**: Directly access Zustand store from Phaser (use HUDBridge)
❌ **DON'T**: Put complex UI in Phaser (use React instead)
❌ **DON'T**: Spam notifications (use debouncing for frequent events)

## Troubleshooting

### HUD not updating?

Check that you're using `HUDBridgeService.getInstance()` correctly:

```typescript
const hudBridge = HUDBridgeService.getInstance();
hudBridge.setHealth(50);  // Should update immediately
```

### Notifications not showing?

Make sure `<GameNotifications />` is in your `App.tsx`:

```tsx
<div className="game-container relative">
  <PhaserGame ref={phaserRef} />
  <GameHUD />
  <GameNotifications />  {/* Must be included */}
</div>
```

### Clicks passing through?

Ensure container has `pointer-events-none` and interactive elements have `pointer-events-auto`:

```tsx
<div className="pointer-events-none">
  <button className="pointer-events-auto">Click me</button>
</div>
```

## Next Steps

- [ ] Add health bar animations (shake on damage)
- [ ] Add combo counter
- [ ] Add minimap overlay
- [ ] Add boss health bar
- [ ] Add skill cooldown indicators
- [ ] Add day/night cycle indicator
- [ ] Add weather overlay
