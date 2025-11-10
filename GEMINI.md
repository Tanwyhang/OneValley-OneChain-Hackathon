# Project Overview

This project is a web-based game that integrates the Phaser 3 game engine with a Next.js and React frontend. The game is inspired by Stardew Valley and will include features like farming, crafting, and social interaction. The project also includes integration with the OneChain blockchain for in-game currency and a marketplace.

# Tech Stack

- **Frontend:** Next.js, React
- **Game Engine:** Phaser 3
- **Blockchain:** OneChain (a fork of Sui, using `@onelabs/sui` SDK, `SuiGraphQLClient` for data queries), zkLogin, Swap (when user wanna swap other coin for OCT [in testnet] and NFT minted in-game items upon acquirement), OneChain Kiosks for in-game Marketplace
- **Language:** TypeScript, JavaScript
- **Package Manager:** npm

# Game Economy Model

To create a rich, player-driven economy, the game will use a dual-token model:

1.  **Primary Currency (`OCT`):** This is the main currency of the game, used for all marketplace transactions. Players use OCT to buy and sell goods from each other. It is the unit of account for the game's economy.

2.  **Secondary Resource Tokens (e.g., `WHEAT_TOKEN`, `WOOD_TOKEN`):** These are fungible tokens that represent the raw materials and crafted goods in the game. Players acquire these by performing in-game actions like farming and resource gathering. These tokens can be used for crafting or can be sold to other players on the marketplace for OCT.

# Game MVP

## Main Reference

Stardew Valley (https://www.youtube.com/watch?v=ot7uXNQskhs)

## Core Features

- **Server Visiting / Chatting:** Allow players to visit each other's servers and chat (hardcoded for MVP).
- **Trading:** Players can trade items with each other.
- **Farming:** Players can manage their own farm to earn in-game currency.
- **Pets:** Players can tame pets to speed up farming time.
- **Resource Gathering:** Players can cut trees to gain materials for building infrastructure, houses, etc.
- **Crafting, Buying, and Selling:** Players can craft, buy, and sell outfits, items, and pets on a marketplace. (OneChain Kiosks)

# Template Project Structure

| Path                          | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| `src/pages/_document.tsx`     | A basic Next.js component entry point. It is used to define the `<html>` and `<body>` tags and other globally shared UI. |
| `src`                         | Contains the Next.js client source code.                                   |
| `src/styles/globals.css`      | Some simple global CSS rules to help with page layout. You can enable Tailwind CSS here. |
| `src/page/_app.tsx`           | The main Next.js component.                                                |
| `src/App.tsx`                 | Middleware component used to run Phaser in client mode.                    |
| `src/PhaserGame.tsx`          | The React component that initializes the Phaser Game and serves as a bridge between React and Phaser. |
| `src/game/EventBus.ts`        | A simple event bus to communicate between React and Phaser.                |
| `src/game`                    | Contains the game source code.                                             |
| `src/game/main.tsx`           | The main game entry point. This contains the game configuration and starts the game. |
| `src/game/scenes/`            | The Phaser Scenes are in this folder.                                      |
| `public/favicon.png`          | The default favicon for the project.                                       |
| `public/assets`               | Contains the static assets used by the game.                               |


# Asset Structure

```
/public/assets
│
├── /tilesets
│   ├── ground.png               # Grass, dirt, sand tiles (32x32)
│   ├── water_anim.png           # 6-frame looping water animation
│   ├── path.png                 # Cobblestone and wood paths
│   ├── crops.png                # Base crop tiles (stages)
│   ├── buildings.png            # Barns, houses, fences, gates
│   └── decorations.png          # Trees, bushes, rocks, signs
│
├── /maps
│   ├── farm_map.json            # Tiled map JSON (exported from Tiled)
│   ├── town_map.json
│   ├── market_map.json
│   └── interiors/
│       ├── player_house.json
│       └── shop.json
│
├── /sprites
│   ├── /player
│   │   ├── player_idle.png          # 4 frames × 4 directions (breathing loop)
│   │   ├── player_walk.png          # 8 frames × 4 directions (standard walk)
│   │   ├── player_run.png           # 8 frames × 4 directions (faster motion)
│   │   ├── player_hoe.png           # 6 frames (one-shot dig)
│   │   ├── player_water.png         # 6 frames (one-shot pour)
│   │   ├── player_sickle.png        # 5 frames (one-shot harvest)
│   │   ├── player_sleep.png         # 3 frames (loop)
│   │   └── player_emotes.png        # 4 frames (icons above head)
│   │
│   ├── /npcs
│   │   ├── villager_male.png        # 8 frames (idle + walk)
│   │   ├── villager_female.png
│   │   ├── merchant.png
│   │   └── animals/
│   │       ├── chicken.png          # 4 frames (idle + peck)
│   │       ├── cow.png              # 4 frames (idle + walk)
│   │       ├── sheep.png            # 4 frames
│   │       └── cat.png              # 6 frames (walk + sit + sleep)
│   │
│   ├── /crops
│   │   ├── wheat.png                # 4 stages (8×8 per tile)
│   │   ├── tomato.png               # 6 stages (+ fruit frames)
│   │   ├── carrot.png               # 4 stages
│   │   ├── pumpkin.png              # 5 stages
│   │   └── golden_tomato.png        # Rare crop (6 stages + sparkle)
│   │
│   ├── /items
│   │   ├── tools.png                # hoe, axe, sickle, watering can
│   │   ├── seeds.png                # wheat_seed, tomato_seed, etc.
│   │   ├── produce.png              # harvested goods
│   │   ├── materials.png            # wood, stone, iron, fiber
│   │   ├── potions.png              # stamina, growth, luck
│   │   └── currency.png             # coins, tokens, web3 items
│   │
│   ├── /effects
│   │   ├── dust.png                 # 6 frames (for walk or hoe)
│   │   ├── sparkle.png              # 5 frames (glow)
│   │   ├── splash.png               # 5 frames (watering)
│   │   ├── leaf_fall.png            # 6 frames (ambient)
│   │   └── rain_drop.png            # 3 frames
│   │
│   ├── /ui
│   │   ├── toolbar.png
│   │   ├── inventory_panel.png
│   │   ├── dialogue_box.png
│   │   ├── buttons/
│   │   │   ├── buy.png
│   │   │   ├── sell.png
│   │   │   ├── trade.png
│   │   │   └── close.png
│   │   └── icons/
│   │       ├── heart.png
│   │       ├── energy.png
│   │       └── coin.png
│   │
│   └── /meta
│       ├── animations.json          # defines frame sequences + timing
│       ├── atlas.json               # texture atlas definitions
│       └── manifest.json            # preloader manifest (Phaser Loader)
│
└── /audio
    ├── bg_farm.mp3
    ├── bg_town.mp3
    ├── step_grass.wav
    ├── hoe_swing.wav
    ├── plant_seed.wav
    ├── harvest.wav
    ├── trade_success.wav
    └── rain_ambient.mp3
```

## Token Details: OCT

### 🧩 What You Have

```json
{
  "objectId": "0x014c53c494e72099d8b496e1966a358c5543b1c23cb09321348d8bed61821fc5",
  "version": "150",
  "digest": "FVkmnFFnQVkfGorjHyh2rZgP3YvCo8MuDZk7JRRCMsDX",
  "type": "0x2::coin::Coin<0x2::oct::OCT>",
  "content": {
    "fields": {
      "balance": "1000000000",
      "id": {
        "id": "0x014c53c494e72099d8b496e1966a358c5543b1c23cb09321348d8bed61821fc5"
      }
    }
  }
}
```

### 💰 Breakdown

| Field                            | Meaning                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `objectId`                       | The on-chain ID of this **coin object**.                                              |
| `type`                           | The **Move type** — tells you what coin this is.                                      |
| `balance`                        | The **amount** of tokens this object holds (in base units).                           |
| `0x2::coin::Coin<0x2::oct::OCT>` | Means this is an **OCT token object**, not SUI.                                       |
| `balance: "1000000000"`          | Means you own **1,000,000,000 base units** of OCT (the decimals depend on the token). |

### 🧾 Coin Type

Your **coinType** is:

```
0x2::oct::OCT
```

That’s what you’ll use when calling balance queries or doing transfers.

For example:

```ts
const balance = await client.getBalance({
  owner: '0x343d0fa835cd723704ee9fe0aa7adc9956cf59f2161102fa601645b0c6727992',
  coinType: '0x2::oct::OCT',
});
```

This will return:

```json
{
  "coinType": "0x2::oct::OCT",
  "totalBalance": "1000000000",
  "coinObjectCount": 1
}
```

### ⚙️ Next Steps You Can Do

1. **Check balance total:**

   ```ts
   await client.getAllBalances({ owner: 'your_wallet_address' });
   ```

2. **List all coin objects for that coinType:**

   ```ts
   await client.getCoins({
     owner: 'your_wallet_address',
     coinType: '0x2::oct::OCT'
   });
   ```

3. **Transfer some OCT tokens:**

   ```ts
   const tx = new Transaction();
   tx.transferObjects(
     ['0x014c53c494e72099d8b496e1966a358c5543b1c23cb09321348d8bed61821fc5'], // coin object IDs
     '0xRECIPIENT_ADDRESS'
   );
   await signAndExecuteTransaction({ tx });
   ```

### 🧠 Summary

✅ Your test token exists.
✅ It’s an **OCT token**.
✅ You have **1,000,000,000 units** in that coin object.
✅ You can now query or transfer it using its coinType:

```
0x2::oct::OCT
```


# Development Plan: Building a Next-Gen Blockchain Game

This plan is designed to integrate web3 features from the beginning, ensuring a seamless player experience and a robust, player-owned token economy.

- [x] **Phase 1: Foundation & On-Chain Identity**
    - *Goal: Establish a stable project base and a frictionless onboarding process for players.*
    - [x] **Project Scaffolding:** Initialize Git, Next.js, and Phaser project structure.
    - [x] **Main Menu Scene:** Design and implement a main menu UI within the React application.
    - [x] **Seamless Onboarding:** Integrate `zkLogin` into the main menu. The primary action will be a "Connect & Play" button (using Google, Twitch, etc.).
    - [x] **Gated Game Entry:** The Phaser game component will only be rendered *after* a successful zkLogin connection and wallet session are established.
    - [x] **Game World & Player:** Create the initial farm scene and load the player sprite with basic movement and animations.

- [ ] **Phase 2: Core Loop & First On-Chain Assets**
    - *Goal: Implement the core game loop where players acquire on-chain **Resource Tokens** through gameplay.*
    - [ ] **Farming Mechanics:** Implement tool actions for planting and watering crops.
    - [ ] **On-Chain Resources:** When a player harvests a crop (e.g., wheat), mint it as a **Resource Token** (`WHEAT_TOKEN`) directly to their wallet.
    - [ ] **Wallet-Driven UI:** Develop the first version of the player inventory that reads and displays token balances directly from the player's OneChain wallet using `SuiGraphQLClient`.

- [ ] **Phase 3: The Player-Owned Economy**
    - *Goal: Empower players to trade their **Resource Tokens** for the **Primary Currency (OCT)** in a decentralized marketplace.*
    - [ ] **Personalized Shops:** Implement the `OneChain Kiosk` standard, giving every player their own on-chain "Farmer's Stall."
    - [ ] **Marketplace Interface:** Create a UI where players can browse items being sold by others using `SuiGraphQLClient`.
    - [ ] **Listing Assets:** Allow players to list their harvested **Resource Tokens** (e.g., `WHEAT_TOKEN`) in their Kiosk for a price set in OCT tokens.
    - [ ] **Purchasing Assets:** Enable players to buy assets from other players' Kiosks, executing the trade on-chain.

- [ ] **Phase 4: Expanding the Asset Universe (NFTs)**
    - *Goal: Introduce unique, non-fungible assets that deepen the gameplay and economy.*
    - [ ] **On-Chain Crafting:** Implement a crafting system where players can combine **Resource Tokens** (e.g., `WOOD_TOKEN`, `STONE_TOKEN`) to mint new, unique NFTs (e.g., a `FENCE_NFT`, `FURNITURE_NFT`).
    - [ ] **Unique Collectibles:** Design and introduce rare items like special tools, cosmetic outfits, and pets as NFTs with distinct properties.
    - [ ] **Quest Rewards:** Implement an NPC and quest system where completing a quest rewards the player with a specific NFT or a bundle of tokens.

- [ ] **Phase 5: Social Layer & Advanced Trading**
    - *Goal: Foster community and enable more complex economic interactions.*
    - [ ] **World Exploration:** Allow players to visit the farms of other players (initially hardcoded).
    - [ ] **Player Communication:** Implement a basic in-game chat system.
    - [ ] **Direct Trading:** Build a UI for direct player-to-player atomic swaps, allowing them to trade any combination of NFTs and tokens securely without relying on the public marketplace.

- [ ] **Phase 6: Polish, Mainnet Launch, and Live-Ops**
    - *Goal: Refine the experience and prepare for public launch.*
    - [ ] **Sensory Feedback:** Integrate sound effects and background music.
    - [ ] **UI/UX Refinement:** Polish all user interfaces and game controls based on playtesting.
    - [ ] **Final Testing:** Conduct comprehensive testing on the OneChain Testnet.
    - [ ] **Deployment:** Deploy all smart contracts and the front-end application to Mainnet.
    - [ ] **Post-Launch:** Plan for future content updates, new assets, and community events.
