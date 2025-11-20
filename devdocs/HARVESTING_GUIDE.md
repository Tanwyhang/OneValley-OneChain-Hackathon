# Carrot Harvesting & On-Chain Minting Guide

## Overview
The carrot harvesting system allows players to harvest mature crops, collect them in a batch, and mint them as NFTs on the blockchain.

## How It Works

### 1. Plant Carrots
- Press **E** near tilled soil to plant a carrot seed
- Carrots go through 3 growth stages:
  - **Stage 1**: Seed (0-5 seconds)
  - **Stage 2**: Growing (5-10 seconds)
  - **Stage 3**: Mature (10+ seconds) - Ready to harvest!

### 2. Harvest Carrots
- When a carrot reaches Stage 3 (fully grown), get close to it
- Press **H** to harvest the mature carrot
- The carrot will drop on the ground as a small floating item
- You can harvest multiple carrots before collecting them

### 3. Batch Collection
- Once you've harvested carrots, they will float on the ground
- A **"Collect All"** button appears at the bottom of the screen showing the count
- Press **C** or click the button to collect all harvested carrots
- All carrots will fly to the center of the screen with a satisfying animation

### 4. Mint Confirmation
After collecting, a confirmation dialog appears:
- Shows the number of carrots to mint
- Displays a preview of the carrot NFT
- Two options:
  - **Mint Now**: Proceed with minting on-chain
  - **Cancel**: Cancel the minting process

### 5. Transaction Processing
If you confirm:
- A progress dialog shows the transaction status
- "Preparing transaction..." → "Minting X carrot NFTs..."
- Transaction is processed on the blockchain

### 6. Transaction Success
Once complete, a success dialog shows:
- ✅ Transaction successful message
- Number of NFTs minted
- **Transaction Hash**: Unique blockchain transaction ID
- **Block Number**: The block where the transaction was recorded
- This information can be used to verify the transaction on a blockchain explorer

## Controls Summary
| Key | Action |
|-----|--------|
| **E** | Plant carrot on tilled soil |
| **H** | Harvest mature carrot (creates floating drop) |
| **C** | Collect all harvested carrots |

## Visual Feedback
- **Floating Animation**: Harvested carrots bob up and down on the ground
- **Collection Animation**: Carrots fly to screen center when collected
- **UI Counter**: Shows exact number of carrots ready to collect
- **Progress Indicator**: Spinning loader during transaction
- **Success Indicator**: Green checkmark when minting succeeds

## Technical Details
- All harvested carrots are tracked individually as sprites
- Floating animation uses sine wave for smooth bobbing effect
- Collection uses tweens for smooth gathering animation
- Transaction simulation provides realistic blockchain experience
- Mock transaction hashes and block numbers are generated for demonstration

## Future Enhancements
In production, this system will:
- Connect to actual OneChain SDK for real blockchain transactions
- Use player's connected wallet for signing
- Store NFT metadata on-chain
- Allow trading of minted carrot NFTs in the marketplace
- Track ownership history on the blockchain

## Tips
1. **Harvest efficiently**: Wait until multiple carrots are mature before harvesting
2. **Batch minting saves gas**: Collect many carrots at once to reduce transaction costs
3. **Watch the growth stages**: Carrots change appearance as they grow
4. **Don't rush**: The floating carrots won't disappear - take your time!

## Troubleshooting
- **Can't harvest?** Make sure the carrot is fully grown (Stage 3)
- **Button not appearing?** Harvest at least one carrot first
- **Carrots not floating?** They appear exactly where they were harvested
