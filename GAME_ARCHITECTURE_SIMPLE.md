# Simple Visual Guide: How the Game Works

## 🎬 The Movie Analogy

```
┌─────────────────────────────────────────┐
│         THE GAME (Like a Movie)         │
├─────────────────────────────────────────┤
│                                         │
│  Assets  = Props & Costumes            │
│  Scene   = A Scene in the Movie        │
│  Sprites = Actors                      │
│  Camera  = The Camera Filming          │
│  Loop    = Filming 60 Frames/Second    │
│                                         │
└─────────────────────────────────────────┘
```

## 🔄 The Game Loop (The Heart)

```
┌─────────────────────────────────────┐
│         GAME LOOP (60 FPS)          │
├─────────────────────────────────────┤
│                                     │
│  1. Check Input                     │
│     ↓                               │
│  2. Update Logic                    │
│     (Move player, check collisions) │
│     ↓                               │
│  3. Render Graphics                 │
│     (Draw everything)               │
│     ↓                               │
│  4. Repeat (60 times per second!)   │
│                                     │
└─────────────────────────────────────┘
```

## 🏗️ Project Structure

```
Your Project
│
├── src/
│   ├── App.tsx              → Main React component (shows menu/game)
│   ├── PhaserGame.tsx       → Bridge between React and Phaser
│   └── game/
│       ├── main.ts          → Game configuration
│       ├── EventBus.ts      → Communication system
│       └── scenes/
│           └── FarmScene.ts → The actual game scene
│
└── public/assets/
    ├── maps/                → Map files (JSON + images)
    ├── sprites/             → Character images
    └── tilesets/            → Tile images for maps
```

## 📊 Data Flow

```
User Action
    │
    ├─→ React (App.tsx)
    │       │
    │       └─→ Shows menu OR starts game
    │
    └─→ Phaser (FarmScene.ts)
            │
            ├─→ Preload: Load assets
            ├─→ Create: Build world
            └─→ Update: Game loop (60x/second)
                    │
                    ├─→ Check keys
                    ├─→ Move player
                    ├─→ Check collisions
                    ├─→ Update animations
                    └─→ Draw everything
```

## 🎮 How Player Movement Works

```
┌──────────────────────────────────────────────┐
│           PLAYER MOVEMENT FLOW               │
├──────────────────────────────────────────────┤
│                                              │
│  1. User presses "W" key                     │
│           ↓                                  │
│  2. Phaser detects key press                 │
│           ↓                                  │
│  3. handlePlayerMovement() runs              │
│           ↓                                  │
│  4. Set player velocity (move up)            │
│           ↓                                  │
│  5. Physics engine moves player              │
│           ↓                                  │
│  6. Check collisions (can't walk through tree)│
│           ↓                                  │
│  7. Update animation (play "walk-up")        │
│           ↓                                  │
│  8. Camera follows player                    │
│           ↓                                  │
│  9. Draw everything on screen                │
│           ↓                                  │
│  10. Repeat 60 times per second!             │
│                                              │
└──────────────────────────────────────────────┘
```

## 🗺️ How the Map Works

```
┌──────────────────────────────────────────────┐
│              TILEMAP SYSTEM                  │
├──────────────────────────────────────────────┤
│                                              │
│  Tileset Image (OneValley.png)              │
│  ┌────┬────┬────┬────┐                      │
│  │Grass│Dirt│Tree│House│  ← All tile images │
│  └────┴────┴────┴────┘                      │
│                                              │
│  Map JSON (farm_map.json)                   │
│  ┌─────────────────────────┐                │
│  │ [0,0] = Grass           │  ← Layout      │
│  │ [1,0] = Grass           │                │
│  │ [5,3] = Tree            │                │
│  │ [10,10] = House         │                │
│  └─────────────────────────┘                │
│                                              │
│  Result: Visual Map                         │
│  ┌─────────────────────────┐                │
│  │ 🟢🟢🟢🟢🟢🟢🟢🟢🟢 │                │
│  │ 🟢🟢🌲🟢🟢🟢🟢🟢🟢 │                │
│  │ 🟢🟢🟢🏠🟢🟢🟢🟢🟢 │                │
│  └─────────────────────────┘                │
│                                              │
└──────────────────────────────────────────────┘
```

## 🎭 How Animations Work

```
┌──────────────────────────────────────────────┐
│            ANIMATION SYSTEM                  │
├──────────────────────────────────────────────┤
│                                              │
│  Spritesheet (player_walk.png)              │
│  ┌────┬────┬────┬────┐                      │
│  │Frame│Frame│Frame│Frame│  ← All frames    │
│  │  0  │  1  │  2  │  3  │     in one image │
│  └────┴────┴────┴────┘                      │
│                                              │
│  Animation Definition                        │
│  walk-down: [Frame 0, Frame 3]              │
│  frameRate: 6 (frames per second)           │
│                                              │
│  Result: Animation                          │
│  Frame 0 → Frame 3 → Frame 0 → Frame 3...  │
│  (Looks like player is walking!)            │
│                                              │
└──────────────────────────────────────────────┘
```

## 🎥 How the Camera Works

```
┌──────────────────────────────────────────────┐
│            CAMERA SYSTEM                     │
├──────────────────────────────────────────────┤
│                                              │
│  Game World (800x800 pixels)                │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │         [Entire Map]                │    │
│  │                                     │    │
│  │            👤 Player                │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Camera View (what you see)                 │
│  ┌─────────────────┐                        │
│  │                 │                        │
│  │   [Part of Map] │  ← Only shows area    │
│  │      👤 Player  │     around player     │
│  │                 │                        │
│  └─────────────────┘                        │
│                                              │
│  Camera follows player smoothly             │
│  (Doesn't show entire map at once)          │
│                                              │
└──────────────────────────────────────────────┘
```

## 🔧 Key Phaser Concepts

### 1. Scene Lifecycle
```
preload()  → Load assets (images, sounds)
    ↓
create()   → Build game world (map, player, etc.)
    ↓
update()   → Game loop (runs 60x/second)
```

### 2. Physics System
```
Sprite (Visual)    Collision Box (Invisible)
┌──────────┐       ┌──────┐
│          │       │      │
│  Player  │  vs   │ Box  │  ← Smaller box = better collision
│          │       │      │
└──────────┘       └──────┘
```

### 3. Coordinate System
```
(0, 0) ──────────────> X (right)
  │
  │
  │
  │
  ▼
  Y (down)

Player at (400, 400) = 400 pixels right, 400 pixels down
```

## 🚀 Quick Start Checklist

- [ ] Game configuration set up (`main.ts`)
- [ ] React-Phaser bridge working (`PhaserGame.tsx`)
- [ ] Scene created (`FarmScene.ts`)
- [ ] Assets loaded (`preload()`)
- [ ] Map created (`createMap()`)
- [ ] Player created (`createPlayer()`)
- [ ] Input set up (`setupInputs()`)
- [ ] Movement working (`handlePlayerMovement()`)
- [ ] Animations working (`updatePlayerAnimation()`)
- [ ] Camera following (`setupCamera()`)
- [ ] Collisions working (physics)

## 💡 Common Patterns

### Pattern 1: Check Input
```typescript
if (key.isDown) {
    // Do something
}
```

### Pattern 2: Move Sprite
```typescript
sprite.setVelocityX(speed);  // Move horizontally
sprite.setVelocityY(speed);  // Move vertically
```

### Pattern 3: Play Animation
```typescript
sprite.play('animation-name');
```

### Pattern 4: Check Collision
```typescript
this.physics.add.collider(player, obstacle);
```

## 🎯 Next Steps

1. **Add NPCs** - Create non-player characters
2. **Add Farming** - Plant, water, harvest crops
3. **Add Inventory** - Store and use items
4. **Add Quests** - Give player tasks
5. **Add More Scenes** - Town, shop, house
6. **Add Audio** - Music and sound effects
7. **Add UI** - Health bars, inventory panel
8. **Add Interactions** - Talk to NPCs, use items

---

**Remember:** Games are just loops that check input, update state, and draw graphics. Everything else is built on top of this foundation! 🎮

