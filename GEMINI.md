# Project Overview

This project is a web-based game that integrates the Phaser 3 game engine with a Next.js and React frontend. The game is inspired by Stardew Valley and will include features like farming, crafting, and social interaction. The project also includes integration with the SUI blockchain for in-game currency and a marketplace.

# Tech Stack

- **Frontend:** Next.js, React
- **Game Engine:** Phaser 3
- **Blockchain:** SUI (using `@onelabs/sui` SDK), zkLogin, RWA
- **Language:** TypeScript, JavaScript
- **Package Manager:** npm

# Game MVP

## Main Reference

Stardew Valley (https://www.youtube.com/watch?v=ot7uXNQskhs)

## Core Features

- **Server Visiting / Chatting:** Allow players to visit each other's servers and chat (hardcoded for MVP).
- **Trading:** Players can trade items with each other.
- **Farming:** Players can manage their own farm to earn in-game currency.
- **Pets:** Players can tame pets to speed up farming time.
- **Resource Gathering:** Players can cut trees to gain materials for building infrastructure, houses, etc.
- **Crafting, Buying, and Selling:** Players can craft, buy, and sell outfits, items, and pets on a marketplace.

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

# Development Plan: Building a Next-Gen Blockchain Game

This plan is designed to integrate web3 features from the beginning, ensuring a seamless player experience and a robust, player-owned token economy.

- [ ] **Phase 1: Foundation & On-Chain Identity**
    - *Goal: Establish a stable project base and a frictionless onboarding process for players.*
    - [ ] **Project Scaffolding:** Initialize Git, Next.js, and Phaser project structure.
    - [ ] **Seamless Onboarding:** Implement `zkLogin` to allow players to sign up and log in with social accounts (e.g., Google, Twitch), automatically creating a secure Sui wallet in the background.
    - [ ] **Game World Entry:** Create the initial farm scene using Tiled and load it into Phaser.
    - [ ] **Player Representation:** Load the basic player sprite, implementing movement (walk, run) and idle animations.

- [ ] **Phase 2: Core Loop & First On-Chain Assets**
    - *Goal: Make the primary game activity (farming) directly result in the creation of tangible on-chain assets.*
    - [ ] **Define Game Currency:** Deploy the primary in-game currency (e.g., `$VALLEY` token) as a Fungible Token on the Sui network.
    - [ ] **Farming Mechanics:** Implement tool actions for tilling soil and watering crops.
    - [ ] **On-Chain Harvest:** When a player harvests a crop (e.g., wheat), mint it as a Fungible Token (e.g., `WHEAT_TOKEN`) directly to their wallet.
    - [ ] **Wallet-Driven UI:** Develop the first version of the player inventory that reads and displays token balances directly from the player's Sui wallet.

- [ ] **Phase 3: The Player-Owned Economy**
    - *Goal: Empower players to participate in a decentralized, peer-to-peer marketplace.*
    - [ ] **Personalized Shops:** Implement the `Sui Kiosk` standard, giving every player their own on-chain "Farmer's Stall."
    - [ ] **Marketplace Interface:** Create a UI where players can browse items being sold by others.
    - [ ] **Listing Assets:** Allow players to list their harvested produce (e.g., `WHEAT_TOKEN`) in their Kiosk for a price set in `$VALLEY` tokens.
    - [ ] **Purchasing Assets:** Enable players to buy assets from other players' Kiosks, executing the trade on-chain.

- [ ] **Phase 4: Expanding the Asset Universe (NFTs)**
    - *Goal: Introduce unique, non-fungible assets that deepen the gameplay and economy.*
    - [ ] **On-Chain Crafting:** Implement a crafting system where players can combine basic tokens (e.g., wood, stone) to mint new, unique NFTs (e.g., a `FENCE_NFT`, `FURNITURE_NFT`).
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
    - [ ] **Final Testing:** Conduct comprehensive testing on the Sui Testnet.
    - [ ] **Deployment:** Deploy all smart contracts and the front-end application to Mainnet.
    - [ ] **Post-Launch:** Plan for future content updates, new assets, and community events.
