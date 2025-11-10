# How This 2D RPG Was Built: A Beginner's Guide

## Overview
This guide explains how a 2D farming RPG game was created using code. Think of it like building a house: you start with the foundation, add walls, then rooms, and finally decorate it.

---

## Part 1: The Big Picture - What Makes a 2D Game Work?

### Think of a Game Like a Movie
- **Assets** = Props and costumes (images, sounds)
- **Scene** = A scene in the movie (the farm, the town)
- **Sprites** = Actors (the player, NPCs)
- **Game Loop** = The camera that keeps filming (60 times per second)
- **Physics** = Gravity and collisions (can't walk through walls)

### The Game Loop (The Heart of Every Game)
Every frame (60 times per second), the game:
1. **Checks inputs** - Are you pressing keys?
2. **Updates logic** - Move the player, check collisions
3. **Renders graphics** - Draw everything on screen

This happens so fast it looks like smooth animation!

---

## Part 2: The Foundation - Setting Up the Game Engine

### Step 1: Install Phaser (The Game Engine)
```json
// package.json
"phaser": "^3.90.0"
```
**What is Phaser?** It's like a toolkit that gives us tools to:
- Draw graphics on screen
- Handle keyboard/mouse input
- Detect collisions
- Play animations
- Load images and sounds

### Step 2: Create the Game Configuration (`src/game/main.ts`)

```typescript
const config = {
    type: AUTO,              // Use WebGL (fast graphics) or Canvas (fallback)
    parent: 'game-container', // Where to put the game on the webpage
    backgroundColor: '#000000', // Black background
    scale: {
        mode: Phaser.Scale.RESIZE,  // Resize game to fit screen
        autoCenter: Phaser.Scale.CENTER_BOTH  // Center it
    },
    physics: {
        default: 'arcade',   // Simple physics engine
        arcade: {
            gravity: { x: 0, y: 0 },  // No gravity (top-down game)
            debug: false  // Set to true to see collision boxes
        }
    },
    scene: [FarmScene]  // Start with the farm scene
};
```

**What does this do?**
- Creates a game "window" on your webpage
- Sets up physics (collisions, movement)
- Tells the game which scene to load first

**Think of it like:** Setting up a movie set before filming starts.

---

## Part 3: Connecting React (Web Page) to Phaser (Game)

### The Problem
- **React** = Creates web pages (menus, buttons)
- **Phaser** = Creates games (sprites, animations)
- They need to talk to each other!

### The Solution: PhaserGame Component (`src/PhaserGame.tsx`)

```typescript
export const PhaserGame = forwardRef(function PhaserGame() {
    const game = useRef<Phaser.Game | null>(null);
    
    useLayoutEffect(() => {
        // When React component mounts, create the Phaser game
        game.current = StartGame("game-container");
    }, []);
    
    return <div id="game-container"></div>;  // This is where the game appears
});
```

**What does this do?**
- Creates a `<div>` on the webpage
- Starts the Phaser game inside that div
- Acts as a bridge between React and Phaser

**Think of it like:** A translator between two languages.

### The App Component (`src/App.tsx`)

```typescript
function App() {
    const [gameStarted, setGameStarted] = useState(false);
    
    return (
        <div>
            {!gameStarted ? (
                <button onClick={() => setGameStarted(true)}>
                    Start Game
                </button>
            ) : (
                <PhaserGame />  // Show the game!
            )}
        </div>
    );
}
```

**What does this do?**
- Shows a menu first
- When you click "Start Game", it shows the Phaser game
- Controls what the user sees

**Think of it like:** A remote control for your TV - it decides what channel to show.

---

## Part 4: The Game Scene - Where the Magic Happens

### What is a Scene?
A scene is like a level or area in the game. Think of it like:
- Scene 1: Main Menu
- Scene 2: Farm (where you play)
- Scene 3: Town
- Scene 4: Shop

### The Farm Scene (`src/game/scenes/FarmScene.ts`)

A Phaser Scene has 3 main functions that run in order:

#### 1. `preload()` - Load All Your Assets
```typescript
preload() {
    // Tell Phaser where to find images
    this.load.setPath('assets');
    
    // Load the tileset (the "paint" for the map)
    this.load.image('tileset', 'tilesets/OneValley.png');
    
    // Load the map layout (the "blueprint")
    this.load.tilemapTiledJSON('farm_map', 'maps/farm_map.json');
    
    // Load the player sprite (the character)
    this.load.spritesheet('player', 'sprites/player/player_walk.png', {
        frameWidth: 125,
        frameHeight: 250
    });
}
```

**What does this do?**
- Downloads all images and files needed for the game
- Creates a "spritesheet" - multiple images in one file (like a flipbook)

**Think of it like:** Getting all your props and costumes ready before filming.

**What is a Spritesheet?**
Imagine a flipbook. Each page is a frame of animation. A spritesheet puts all those frames in one image:

```
[Frame 0] [Frame 1] [Frame 2] [Frame 3]
[Frame 4] [Frame 5] [Frame 6] [Frame 7]
```

#### 2. `create()` - Set Up the Game World
```typescript
create() {
    this.createMap();           // Draw the farm map
    this.createPlayerAnimations(); // Set up walking animations
    this.createPlayer();        // Place the player on the map
    this.setupInputs();         // Listen for keyboard input
    this.setupCamera();         // Make camera follow player
}
```

**What does this do?**
- Builds the game world
- Places the player
- Sets up controls
- Configures the camera

**Think of it like:** Building the set, placing actors, and setting up cameras.

#### 3. `update()` - The Game Loop (Runs 60 Times Per Second!)
```typescript
update() {
    this.handlePlayerMovement();  // Check keys, move player
}
```

**What does this do?**
- Checks if you're pressing keys
- Moves the player
- Updates animations
- Happens 60 times per second!

**Think of it like:** The camera that keeps filming, capturing every moment.

---

## Part 5: Building the Map (The Game World)

### What is a Tilemap?
Think of a tilemap like LEGO blocks:
- You have different types of blocks (grass, dirt, water, trees)
- You arrange them on a grid to create a map
- Each block is called a "tile"

### How Maps Are Made
1. **Tileset Image** (`OneValley.png`) - Contains all the tile images
   - Like a sheet of stickers with different terrain types

2. **Map JSON File** (`farm_map.json`) - Contains the layout
   - Like instructions: "Put grass at position (0,0), tree at (5,3)"
   - Created with a tool called "Tiled" (a map editor)

### Creating the Map in Code

```typescript
private createMap(): void {
    // 1. Load the map layout
    this.map = this.make.tilemap({ key: 'farm_map' });
    
    // 2. Load the tileset (the images)
    this.tileset = this.map.addTilesetImage('OneValley', 'tileset');
    
    // 3. Create layers (like layers in Photoshop)
    const groundLayer = this.map.createLayer('Ground', this.tileset, 0, 0);
    const treesLayer = this.map.createLayer('Trees', this.tileset, 0, 0);
    const houseLayer = this.map.createLayer('House', this.tileset, 0, 0);
    
    // 4. Set collision (player can't walk through trees/houses)
    treesLayer.setCollisionByExclusion([-1]);
    houseLayer.setCollisionByExclusion([-1]);
    
    // 5. Set world bounds (can't walk off the map)
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
}
```

**Why Layers?**
Think of layers like transparent sheets stacked on top of each other:
- **Ground Layer** (bottom) - Grass, dirt
- **Trees Layer** (middle) - Trees, rocks
- **House Layer** (top) - Buildings

This way, the player can walk behind trees but in front of the ground!

**What is Collision?**
Collision means "bumping into things." When the player tries to walk through a tree, the physics engine stops them.

---

## Part 6: Creating the Player

### Step 1: Create the Player Sprite

```typescript
private createPlayer(): void {
    // Spawn player at position (400, 400) on the map
    this.player = this.physics.add.sprite(400, 400, 'player', 0);
    
    // Make player smaller (scale it down)
    this.player.setScale(0.30);
    
    // Don't let player walk off the map
    this.player.setCollideWorldBounds(true);
    
    // Make collision box smaller than sprite (so player doesn't look like they're floating)
    this.player.body!.setSize(this.player.width * 0.6, this.player.height * 0.5);
    this.player.body!.setOffset(this.player.width * 0.2, this.player.height * 0.4);
    
    // Start with idle animation facing down
    this.player.play('idle-down');
    
    // Add collision with trees and houses
    this.collisionLayers.forEach(layer => {
        this.physics.add.collider(this.player, layer);
    });
}
```

**What is a Sprite?**
A sprite is a 2D image that can move around. Like a character in a cartoon.

**What is a Collision Box?**
The collision box is invisible. It's smaller than the sprite so the player doesn't look like they're floating when walking near walls.

```
Sprite (visual)        Collision Box (invisible)
┌─────────────┐        ┌───────┐
│             │        │       │
│   Player    │   vs   │  Box  │
│             │        │       │
└─────────────┘        └───────┘
```

### Step 2: Create Animations

```typescript
private createPlayerAnimations(): void {
    // Walk Down Animation
    this.anims.create({
        key: 'walk-down',           // Name of animation
        frames: [
            { key: 'player', frame: 0 },  // Frame 0 from spritesheet
            { key: 'player', frame: 3 }   // Frame 3 from spritesheet
        ],
        frameRate: 6,               // Show 6 frames per second
        repeat: -1                  // Loop forever
    });
    
    // Walk Up Animation
    this.anims.create({
        key: 'walk-up',
        frames: [{ key: 'player', frame: 1 }, { key: 'player', frame: 5 }],
        frameRate: 6,
        repeat: -1
    });
    
    // ... more animations for left, right, running, etc.
}
```

**What is an Animation?**
An animation is like a flipbook. You show frame 0, then frame 3, then frame 0 again, really fast. It looks like the player is walking!

**Why Different Animations?**
- `walk-down` - Player walking down (frames 0, 3)
- `walk-up` - Player walking up (frames 1, 5)
- `walk-left` - Player walking left (frames 2, 6, flipped horizontally)
- `walk-right` - Player walking right (frames 2, 6)

---

## Part 7: Player Movement (The Controls)

### Step 1: Set Up Input Listeners

```typescript
private setupInputs(): void {
    // Listen for arrow keys
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    // Listen for WASD keys
    this.wasd = {
        up: this.input.keyboard!.addKey('W'),
        down: this.input.keyboard!.addKey('S'),
        left: this.input.keyboard!.addKey('A'),
        right: this.input.keyboard!.addKey('D')
    };
    
    // Listen for Shift key (for running)
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
}
```

**What does this do?**
- Tells Phaser to watch for specific keys
- When you press a key, Phaser knows about it

### Step 2: Handle Movement (Runs Every Frame!)

```typescript
private handlePlayerMovement(): void {
    // Check which keys are being pressed
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const isRunning = this.shiftKey.isDown;
    
    // Set speed (faster if running)
    const speed = isRunning ? this.playerRunSpeed : this.playerSpeed;
    
    // Stop the player first
    this.player.setVelocity(0, 0);
    
    // Move player based on keys pressed
    if (left) {
        this.player.setVelocityX(-speed);  // Move left (negative X)
        this.currentDirection = 'left';
    } else if (right) {
        this.player.setVelocityX(speed);   // Move right (positive X)
        this.currentDirection = 'right';
    }
    
    if (up) {
        this.player.setVelocityY(-speed);  // Move up (negative Y)
        this.currentDirection = 'up';
    } else if (down) {
        this.player.setVelocityY(speed);   // Move down (positive Y)
        this.currentDirection = 'down';
    }
    
    // If moving diagonally, slow down (so diagonal movement isn't faster)
    if (this.player.body!.velocity.x !== 0 && this.player.body!.velocity.y !== 0) {
        this.player.setVelocity(
            this.player.body!.velocity.x * 0.7071,  // 0.7071 = 1/√2
            this.player.body!.velocity.y * 0.7071
        );
    }
    
    // Update animation based on movement
    this.updatePlayerAnimation(isRunning);
}
```

**What is Velocity?**
Velocity is speed + direction. Like:
- `setVelocityX(150)` = Move 150 pixels per second to the right
- `setVelocityX(-150)` = Move 150 pixels per second to the left

**Why Slow Down Diagonal Movement?**
If you move up and right at the same time, you'd move faster (like the diagonal of a square). We multiply by 0.7071 to keep the speed the same.

**Coordinate System:**
```
(0, 0) ──────────────> X (right)
  │
  │
  │
  │
  ▼
  Y (down)
```

### Step 3: Update Animations

```typescript
private updatePlayerAnimation(isRunning: boolean): void {
    const isMoving = this.player.body!.velocity.x !== 0 || this.player.body!.velocity.y !== 0;
    
    // Flip sprite horizontally if facing left
    if (this.currentDirection === 'left') {
        this.player.setFlipX(true);   // Mirror the sprite
    } else {
        this.player.setFlipX(false);
    }
    
    // Play appropriate animation
    if (!isMoving) {
        this.player.play(`idle-${this.currentDirection}`, true);  // Standing still
    } else if (isRunning) {
        this.player.play(`run-${this.currentDirection}`, true);   // Running
    } else {
        this.player.play(`walk-${this.currentDirection}`, true);  // Walking
    }
}
```

**What does this do?**
- Checks if player is moving
- Plays the right animation (idle, walk, run)
- Flips the sprite if facing left (saves memory - don't need separate left sprite!)

---

## Part 8: The Camera (Following the Player)

### Setting Up the Camera

```typescript
private setupCamera(): void {
    // Make camera follow the player smoothly
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    
    // Don't let camera go outside the map
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    
    // Set zoom level based on screen size
    this.updateCameraZoom();
}
```

**What does `startFollow` do?**
- Makes the camera "glue" to the player
- The `0.1, 0.1` values make it smooth (not jerky)
- Lower values = smoother, higher values = snappier

**What are Camera Bounds?**
- Prevents the camera from showing areas outside the map
- Like putting a frame around a picture

**What is Zoom?**
- Zoom level adjusts how much of the map you see
- Zoom 1 = normal size
- Zoom 2 = zoomed in (see less)
- Zoom 0.5 = zoomed out (see more)

---

## Part 9: How Everything Works Together

### The Complete Flow

1. **User opens webpage** → React loads
2. **User clicks "Start Game"** → React shows `<PhaserGame />`
3. **PhaserGame component mounts** → Creates Phaser game instance
4. **Game starts** → Loads `FarmScene`
5. **Scene.preload() runs** → Downloads all assets (images, maps)
6. **Scene.create() runs** → Builds map, creates player, sets up controls
7. **Scene.update() runs (60 times/second)** → Checks keys, moves player, updates animations
8. **Camera follows player** → Screen scrolls as player moves
9. **Physics engine checks collisions** → Player can't walk through trees

### The Game Loop in Detail

```
Frame 1 (0.016 seconds):
  - Check keys: W is pressed
  - Move player up
  - Play "walk-up" animation
  - Camera follows player
  - Draw everything on screen

Frame 2 (0.032 seconds):
  - Check keys: W is still pressed
  - Move player up more
  - Continue "walk-up" animation
  - Camera follows player
  - Draw everything on screen

... (repeats 60 times per second)
```

---

## Part 10: Key Concepts Summary

### 1. **Sprites**
- 2D images that can move
- Like characters or objects in the game

### 2. **Spritesheets**
- Multiple images in one file
- Used for animations (like a flipbook)

### 3. **Tilemaps**
- Grid-based maps made of tiles
- Efficient way to create large game worlds

### 4. **Scenes**
- Different areas/levels in the game
- Each scene has its own `preload()`, `create()`, and `update()`

### 5. **Physics**
- Handles movement, gravity, collisions
- Arcade physics = simple and fast

### 6. **Animations**
- Sequence of frames shown quickly
- Creates the illusion of movement

### 7. **Camera**
- What the player sees on screen
- Can follow the player, zoom, pan

### 8. **Game Loop**
- Runs 60 times per second
- Updates game state, then draws everything

---

## Part 11: Common Patterns in Game Development

### Pattern 1: State Management
```typescript
private currentDirection: string = 'down';
private playerSpeed: number = 150;
```
**Why?** Store information about the game state (where player is, what they're doing)

### Pattern 2: Separation of Concerns
- `createMap()` - Handles map creation
- `createPlayer()` - Handles player creation
- `handlePlayerMovement()` - Handles movement
**Why?** Easier to understand and maintain

### Pattern 3: Event-Driven Communication
```typescript
EventBus.emit('current-scene-ready', this);
```
**Why?** React and Phaser can talk to each other without direct dependencies

---

## Part 12: Next Steps - What Could Be Added?

### 1. **NPCs (Non-Player Characters)**
- Create sprites for villagers
- Add dialogue system
- Make them walk around

### 2. **Farming System**
- Plant seeds
- Water crops
- Harvest crops
- Grow over time

### 3. **Inventory System**
- Store items
- Use items
- Display inventory UI

### 4. **Quest System**
- Give player tasks
- Track progress
- Reward completion

### 5. **More Scenes**
- Town scene
- Shop scene
- House interior scene

### 6. **Audio**
- Background music
- Sound effects (footsteps, farming sounds)
- Play audio files in Phaser

---

## Part 13: Debugging Tips

### 1. Enable Physics Debug
```typescript
arcade: {
    debug: true  // See collision boxes
}
```

### 2. Check Console
- Open browser console (F12)
- Look for errors
- Use `console.log()` to debug

### 3. Common Issues
- **Player not moving?** Check if keys are being detected
- **Player walking through walls?** Check collision layers
- **Animation not playing?** Check animation keys match
- **Camera not following?** Check camera bounds

---

## Conclusion

Building a 2D game is like:
1. **Setting up the stage** (game configuration)
2. **Loading props** (assets)
3. **Placing actors** (sprites)
4. **Building the set** (map)
5. **Filming continuously** (game loop)
6. **Following the action** (camera)

The key is understanding that games run in a loop:
- Check input
- Update game state
- Draw everything
- Repeat 60 times per second

Everything else is built on top of this foundation!

---

## Additional Resources

- **Phaser Documentation:** https://newdocs.phaser.io
- **Phaser Examples:** https://labs.phaser.io
- **Tiled Map Editor:** https://www.mapeditor.org (for creating maps)
- **Aseprite:** https://www.aseprite.org (for creating sprites)

Happy game development! 🎮

