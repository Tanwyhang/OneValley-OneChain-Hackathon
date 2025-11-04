# Project Overview

This project is a web-based game that integrates the Phaser 3 game engine with a Next.js and React frontend. The game is inspired by Stardew Valley and will include features like farming, crafting, and social interaction. The project also includes integration with the SUI blockchain for in-game currency and a marketplace.

# Tech Stack

- **Frontend:** Next.js, React
- **Game Engine:** Phaser 3
- **Blockchain:** SUI (using `@onelabs/sui` SDK)
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

# Development Phases

- [ ] **Phase 1: Core Setup & Player Movement**
    - [ ] Initialize project and set up Git.
    - [ ] Create the asset directory structure.
    - [ ] Create a basic farm map with Tiled.
    - [ ] Load player sprite and implement basic movement (up, down, left, right).
    - [ ] Implement idle and walking animations.
- [ ] **Phase 2: Farming & Core Mechanics**
    - [ ] Implement the ability to use tools (hoe, watering can).
    - [ ] Implement planting seeds.
    - [ ] Implement crop growth over time.
    - [ ] Implement harvesting crops.
    - [ ] Implement a basic inventory system.
- [ ] **Phase 3: Resource Gathering & Crafting**
    - [ ] Add trees to the map.
    - [ ] Implement the ability to cut trees and gather wood.
    - [ ] Implement a basic crafting system (e.g., craft a fence from wood).
- [ ] **Phase 4: NPCs & Interaction**
    - [ ] Add a simple NPC to the map.
    - [ ] Implement basic NPC movement (e.g., walking a set path).
    - [ ] Implement a dialogue system to chat with the NPC.
- [ ] **Phase 5: Blockchain Integration & Marketplace**
    - [ ] Integrate SUI wallet connection.
    - [ ] Create an in-game currency token on SUI.
    - [ ] Implement earning currency from farming.
    - [ ] Design and implement a basic marketplace UI.
    - [ ] Implement buying/selling items on the marketplace.
- [ ] **Phase 6: Polish & Expansion**
    - [ ] Add pets.
    - [ ] Implement server visiting/chat.
    - [ ] Add more crops, items, and crafting recipes.
    - [ ] Add sound effects and background music.
    - [ ] Refine UI and overall user experience.
