# 🎮 Auto-Minting Guide for OneValley

## No Manual Minting Required! 

You have **3 automated options** for minting items as NFTs:

---

## Option 1: Lazy Minting (Recommended) ⚡

Items are automatically minted **only when needed** (e.g., before trading).

### How it works:
```typescript
import AutoMintService from './services/AutoMintService';

// In your game code:
const autoMint = AutoMintService.getInstance();

// Queue item for minting (non-blocking, happens in background)
autoMint.autoMintItem({
  id: 'candy_01a',
  name: 'Candy',
  description: 'Sweet candy',
  type: 'consumable',
  rarity: 1,
  stats: [10, 20]
});

// Later, get the NFT ID:
const nftId = autoMint.getNFTObjectId('candy_01a');
```

### When to use:
- Player picks up an item
- Item is harvested
- Item is crafted
- During gameplay (background minting)

---

## Option 2: Just-In-Time Minting 🚀

Items are minted **right before trading** (synchronous).

### How it works:
```typescript
// Before initiating a trade:
const nftId = await autoMint.mintItemNow({
  id: 'candy_01a',
  name: 'Candy',
  type: 'consumable'
});

if (nftId) {
  // Use nftId for blockchain trading
  await transactionService.lockItem(nftId);
} else {
  // Fall back to simulation mode
}
```

### When to use:
- Right before trading
- When blockchain features are required
- When you need immediate confirmation

---

## Option 3: Batch Minting 📦

Mint **all inventory items** at once (e.g., on game start).

### How it works:
```typescript
const inventory = [
  { id: 'candy_01a', name: 'Candy', type: 'consumable' },
  { id: 'sword_02b', name: 'Iron Sword', type: 'weapon' },
  { id: 'potion_03c', name: 'Health Potion', type: 'consumable' }
];

await autoMint.batchMintItems(inventory);
```

### When to use:
- On game start/login
- After major gameplay sessions
- During idle time

---

## 🎯 Quick Start Examples

### Example 1: Harvest → Auto Mint
```typescript
function onCropHarvest(cropType: string) {
  const autoMint = AutoMintService.getInstance();
  
  autoMint.autoMintItem({
    id: `crop_${cropType}_${Date.now()}`,
    name: cropType,
    type: 'resource',
    rarity: 1
  });
  
  console.log(`Harvested ${cropType}, minting in background...`);
}
```

### Example 2: Trade → Mint If Needed
```typescript
async function onTrade(itemId: string) {
  const autoMint = AutoMintService.getInstance();
  
  // Check if already minted
  let nftId = autoMint.getNFTObjectId(itemId);
  
  if (!nftId) {
    // Mint now
    const item = getItemData(itemId);
    nftId = await autoMint.mintItemNow(item);
  }
  
  if (nftId) {
    // Blockchain trade
    await executeTrade(nftId);
  } else {
    // Fallback trade
    await executeSimulatedTrade(itemId);
  }
}
```

### Example 3: Inventory → Batch Mint
```typescript
async function onGameStart(playerInventory: any[]) {
  const autoMint = AutoMintService.getInstance();
  
  // Mint all items in background
  await autoMint.batchMintItems(playerInventory);
  
  console.log('All inventory items queued for minting!');
}
```

---

## 🔍 Check Mint Status

```typescript
const autoMint = AutoMintService.getInstance();

// Check if item is minted
if (autoMint.isMinted('candy_01a')) {
  console.log('Item is on blockchain!');
}

// Get NFT object ID
const nftId = autoMint.getNFTObjectId('candy_01a');
console.log('NFT ID:', nftId);

// Check queue status
console.log('Queue size:', autoMint.getQueueSize());
console.log('Currently minting:', autoMint.isMintingInProgress());

// Get all minted items
const minted = autoMint.getMintedItems();
console.log('Minted items:', minted);
```

---

## 📝 Current Setup

Your contract is already deployed:
- **Package ID**: `0x9d3d2c56c66134068a6be7ded289cf1915939f0b65a46483d3414a6da5f3ef89`
- **ItemForge ID**: `0x836264cf0ef7e2c8a98be4d11f59ec02f4c801c1dc95a53c43482c34ec2c0e58`

The services are configured in:
- `src/services/AutoMintService.ts` - Automated minting
- `src/services/OneChainMintingService.ts` - Direct minting API
- `src/services/WalletBridgeService.ts` - Wallet integration
- `src/examples/AutoMintExamples.ts` - Code examples

---

## ✅ Recommended Flow

1. **On item creation** → Queue for auto-minting (background)
2. **On trade** → Check if minted, mint if needed (synchronous)
3. **Use NFT ID** → For blockchain operations
4. **Fallback** → Simulation mode if minting fails

This gives you the best of both worlds:
- ✅ No manual minting needed
- ✅ Automatic blockchain integration
- ✅ Graceful fallback if something fails
- ✅ Players never see the complexity

---

## 🚀 Next Steps

To integrate auto-minting into your game:

1. Import AutoMintService where you handle items
2. Call `autoMintItem()` when items are created/picked up
3. Use `getNFTObjectId()` when you need the blockchain ID
4. Trading will automatically work with both NFTs and game items

That's it! No manual minting required. 🎉
