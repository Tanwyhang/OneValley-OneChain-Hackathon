import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { UIScene } from './UIScene';
import { SCENE_KEYS } from './SceneKeys';

interface ColliderShape {
    x: number;
    y: number;
    width?: number;
    height?: number;
    points?: { x: number; y: number }[];
    type: 'rectangle' | 'polygon';
    layer: string;
}

export class FarmScene extends Scene {
    // Map properties
    private map!: Phaser.Tilemaps.Tilemap;
    private tileset!: Phaser.Tilemaps.Tileset;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private farmingLayer!: Phaser.Tilemaps.TilemapLayer;
    private cropsLayer!: Phaser.Tilemaps.TilemapLayer;

    // Player-related properties
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    private shiftKey!: Phaser.Input.Keyboard.Key;
    private interactKey!: Phaser.Input.Keyboard.Key;
    private escKey!: Phaser.Input.Keyboard.Key;
    private attackKey!: Phaser.Input.Keyboard.Key;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private cutKey!: Phaser.Input.Keyboard.Key;

    // Particle properties
    private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private windTimer!: Phaser.Time.TimerEvent;

    // Farming properties
    private farmableTileIndices: Set<number> = new Set([521, 522, 523, 578, 579, 580, 635, 636, 637]);

    // Player state
    private playerSpeed: number = 150;
    private playerRunSpeed: number = 250;
    private currentDirection: string = 'down';
    private initialZoom: number = 3;
    private isAttacking: boolean = false;
    private isCutting: boolean = false;
    private treeLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private tileCollisionBodies: Map<string, Phaser.GameObjects.GameObject[]> = new Map();

    // Animals
    private chickens: Phaser.Physics.Arcade.Sprite[] = [];
    private cows: Phaser.Physics.Arcade.Sprite[] = [];
    private sheep: Phaser.Physics.Arcade.Sprite[] = [];

    // NPC
    private npc!: Phaser.Physics.Arcade.Sprite;

    // Chat system
    private isChatting: boolean = false;
    private chatBubble!: Phaser.GameObjects.Container;
    private chatBackground!: Phaser.GameObjects.Graphics;
    private chatText!: Phaser.GameObjects.Text;
    private playerInput: string = '';
    private npcResponse!: Phaser.GameObjects.Text;

    // Settings UI
    private settingsIcon!: Phaser.GameObjects.Image;
    private settingsModal!: Phaser.GameObjects.Container;
    private isNearNPC: boolean = false;

    constructor() {
        super('FarmScene');
    }

    preload() {
        console.log('Starting to load assets...');
        this.load.setPath('assets');
        

        // Load tileset and farm map
        this.load.image('tileset', 'tilesets/OneValley.png');
        this.load.tilemapTiledJSON('farm_map', 'maps/farm_map.json');

        // Load tileset collision data (TSX file)
        this.load.xml('tileset_collision', 'tilesets/OneValley.tsx');

        // Load merged player sprite (192x320 image, 10 columns x 6 rows)
        // Rows: idle/walk animations (rows 1-4), attack animations (rows 5-6)
        this.load.spritesheet('player', '../Cute_Fantasy_Free/Player/Player.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load player actions sprite (96x576 image, 2 columns x 12 rows)
        // Frames 6-7: cut tree left/right, 8-9: cut tree down, 10-11: cut tree up
        this.load.spritesheet('player_actions', '../Cute_Fantasy_Free/Player/Player_Actions.png', {
            frameWidth: 48,
            frameHeight: 48
        });

        // Load chicken sprite (64x64 image, 2 columns x 2 rows)
        // Row 1: idle (2 frames), Row 2: walking (2 frames)
        this.load.spritesheet('chicken', '../Cute_Fantasy_Free/Animals/Chicken/Chicken.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load cow sprite (same structure as chicken)
        this.load.spritesheet('cow', '../Cute_Fantasy_Free/Animals/Cow/Cow.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load sheep sprite (same structure as chicken)
        this.load.spritesheet('sheep', '../Cute_Fantasy_Free/Animals/Sheep/Sheep.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load NPC sprite (same size as player: 32x32)
        this.load.spritesheet('npc', '../Cute_Fantasy_Free/Player/Npc.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load chatbox image
        this.load.image('chatbox', '../Cute_Fantasy_Free/Player/chatbox.png');

        // Load chat dialog image
        this.load.image('chatdialog', '../Cute_Fantasy_Free/Player/chatdialog.png');

        // Load settings icon
        this.load.image('settings_icon', '../Cute_Fantasy_Free/Player/player_settings.png');

        // Load particle image
        this.load.image('firefly', 'firefly.png');

        // Load UI assets
        this.load.setPath('assets/ui');
        this.load.image('slot', 'slot.png');
        this.load.image('itembar', 'itembar.png');
        this.load.image('backpack', 'backpack.png');
        this.load.image('marketplace', 'marketplace.png');
        this.load.setPath('assets');

        // Debug: Log when assets are loaded
        this.load.on('complete', () => {
            console.log('Assets loaded successfully');
            console.log('itembar texture exists:', this.textures.exists('itembar'));
            console.log('slot texture exists:', this.textures.exists('slot'));
        });
    }

    create() {
        console.log('FarmScene create() started');

        // Debug: Log camera info
        console.log('Camera at create start:', {
            width: this.cameras.main.width,
            height: this.cameras.main.height,
            visible: this.cameras.main.visible
        });

        // Create the farm map
        this.createMap();

        // Create player and controls
        this.createPlayerAnimations();
        this.createChickenAnimations();
        this.createCowAnimations();
        this.createSheepAnimations();
        this.createNPCAnimations();
        this.createPlayer();
        this.createChickens();
        this.createCows();
        this.createSheep();
        this.createNPC();
        this.setupInputs();
        this.setupCamera();

        // Create particles
        this.createParticles();

        // Set up physics colliders for all entities
        this.setupColliders();

        // Listen for interaction
        this.handleInteraction();

        EventBus.emit('current-scene-ready', this);

        // Launch the UI Scene with parent reference
        this.scene.launch(SCENE_KEYS.UI, { parent: this });

        // Add test items and show UI after a short delay to ensure everything is loaded
        this.time.delayedCall(1000, () => {
            const uiScene = this.scene.get(SCENE_KEYS.UI) as UIScene;
            if (uiScene) {
                uiScene.addItem('coin', 0);
                uiScene.addItem('seed', 1);
                // Show the UI after adding items
                uiScene.showUI();
            }
        });

        // Handle window resize
        this.scale.off('resize', this.handleResize, this); // Remove any existing
        this.scale.on('resize', this.handleResize, this);
    }

    update() {
        if (!this.isChatting) {
            this.handlePlayerMovement();
        }
        this.updateNPCNamePosition();
        this.updateChatBubblePosition();
        this.checkNPCProximity();
    }


    private updateNPCNamePosition(): void {
        if (!this.npc || !this.npc.active) return;

        const nameText = this.npc.getData('nameText');
        if (nameText) {
            nameText.setPosition(this.npc.x, this.npc.y - 30);
        }

        // Update settings icon position if visible
        if (this.settingsIcon && this.settingsIcon.visible) {
            this.settingsIcon.setPosition(this.npc.x - 25, this.npc.y - 30);
        }
    }

    private checkNPCProximity(): void {
        if (!this.npc || !this.npc.active || !this.player) return;

        const distance = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.npc.x, this.npc.y
        );

        const proximityRange = 80;

        if (distance < proximityRange && !this.isNearNPC) {
            this.isNearNPC = true;
            this.showSettingsIcon();
        } else if (distance >= proximityRange && this.isNearNPC) {
            this.isNearNPC = false;
            this.hideSettingsIcon();
        }
    }

    private showSettingsIcon(): void {
        if (!this.settingsIcon) {
            this.createSettingsIcon();
        }
        this.settingsIcon.setVisible(true);
    }

    private hideSettingsIcon(): void {
        if (this.settingsIcon) {
            this.settingsIcon.setVisible(false);
        }
    }

    private createSettingsIcon(): void {
        // Create settings icon next to NPC name (left side)
        this.settingsIcon = this.add.image(this.npc.x - 25, this.npc.y - 30, 'settings_icon');
        this.settingsIcon.setScale(0.03); // Scale down from 1024x1024
        this.settingsIcon.setDepth(2000);
        this.settingsIcon.setInteractive({ useHandCursor: true });
        this.settingsIcon.setVisible(false);

        // Click handler
        this.settingsIcon.on('pointerdown', () => {
            this.openSettingsModal();
        });

        // Hover effects
        this.settingsIcon.on('pointerover', () => {
            this.settingsIcon.setScale(0.035);
        });

        this.settingsIcon.on('pointerout', () => {
            this.settingsIcon.setScale(0.03);
        });
    }

    private openSettingsModal(): void {
        if (this.settingsModal) {
            this.settingsModal.setVisible(true);
            return;
        }

        // Create modal container
        this.settingsModal = this.add.container(400, 300);
        this.settingsModal.setDepth(2000);
        this.settingsModal.setScrollFactor(0);

        // Semi-transparent background overlay
        const overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.7);
        overlay.setOrigin(0.5);
        overlay.setInteractive();

        // Modal background
        const modalBg = this.add.rectangle(0, 0, 400, 300, 0xffffff, 1);
        modalBg.setStrokeStyle(3, 0x000000);

        // Title text
        const titleText = this.add.text(0, -120, 'Settings', {
            fontSize: '24px',
            color: '#000000',
            fontStyle: 'bold',
            resolution: 3
        });
        titleText.setOrigin(0.5);

        // Close button
        const closeButton = this.add.text(180, -130, 'X', {
            fontSize: '20px',
            color: '#ff0000',
            fontStyle: 'bold',
            resolution: 3
        });
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on('pointerdown', () => {
            this.closeSettingsModal();
        });
        closeButton.on('pointerover', () => {
            closeButton.setScale(1.2);
        });
        closeButton.on('pointerout', () => {
            closeButton.setScale(1);
        });

        // Add all elements to modal
        this.settingsModal.add([overlay, modalBg, titleText, closeButton]);
    }

    private closeSettingsModal(): void {
        if (this.settingsModal) {
            this.settingsModal.setVisible(false);
        }
    }

    private updateChatBubblePosition(): void {
        if (!this.chatBubble || !this.chatBubble.active) return;

        // Update NPC bubble position (near name)
        this.chatBubble.setPosition(this.npc.x, this.npc.y - 50);

        // Update player bubble if it exists
        const playerBubble = this.player.getData('chatBubble');
        if (playerBubble && playerBubble.active) {
            playerBubble.setPosition(this.player.x, this.player.y - 50);
        }

        // Update chatbox indicator position
        const chatboxIndicator = this.player.getData('chatboxIndicator');
        if (chatboxIndicator && chatboxIndicator.active) {
            chatboxIndicator.setPosition(this.player.x + 20, this.player.y - 15);
        }
    }

    private createMap(): void {
        this.map = this.make.tilemap({ key: 'farm_map' });
        this.tileset = this.map.addTilesetImage('OneValley', 'tileset')!;
        this.collisionLayers = [];

        const createLayer = (
            name: string,
            depth: number,
            enableCustomCollision: boolean = false
        ): Phaser.Tilemaps.TilemapLayer | null => {
            const layer = this.map.createLayer(name, this.tileset, 0, 0);
            layer?.setDepth(depth);

            // Note: We're not using layer-based collision anymore
            // Custom collision shapes are extracted from the tileset
            if (enableCustomCollision && layer) {
                this.collisionLayers.push(layer);
                console.log(`Added layer for custom collision extraction: ${name}`);
            }

            return layer;
        };

        createLayer('Ground', -10);
        this.farmingLayer = createLayer('Farming Dirt + Water + Routes', -5)!;
        this.cropsLayer = this.map.createBlankLayer('Crops', this.tileset, 0, 0)!;
        this.cropsLayer.setDepth(-4);

        createLayer('Deco', 10);
        createLayer('House', 15, true);   // Houses should have collision
        createLayer('Market', 18, true);  // Markets should have collision

        // Add the missing layers from the map
        createLayer('animalground', 12, false);  // Ground for animals, usually no collision
        createLayer('fence', 25, true);          // Fences should have collision

        ['Trees A', 'Trees B', 'Trees C', 'Trees D', 'Trees E']
            .forEach((name, index) => {
                const treeLayer = createLayer(name, 20 + index, true);
                if (treeLayer) {
                    this.treeLayers.push(treeLayer);
                }
            });  // Trees should have collision

        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // Optional: Debug view to visualize collision shapes
        // You can remove this in production
        const debugGraphics = this.add.graphics().setAlpha(0.7);
        this.collisionLayers.forEach(layer => {
            if (layer) {
                layer.renderDebug(debugGraphics, {
                    tileColor: null,
                    collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
                    faceColor: new Phaser.Display.Color(40, 39, 37, 255)
                });
            }
        });
    }

    private extractTileColliders(map: Phaser.Tilemaps.Tilemap, tileset: Phaser.Tilemaps.Tileset): ColliderShape[] {
        const colliders: ColliderShape[] = [];
        const tileWidth = map.tileWidth;
        const tileHeight = map.tileHeight;

        console.log('=== DEBUG: Extracting collision data ===');
        console.log('TileWidth:', tileWidth, 'TileHeight:', tileHeight);
        console.log('Tileset firstgid:', tileset.firstgid);

        // Get the tileset XML data
        const tilesetXML = this.cache.xml.get('tileset_collision');
        if (!tilesetXML) {
            console.error('Tileset collision data not found in cache!');
            console.log('Available cache keys:', Object.keys(this.cache.xml.entries));
            return colliders;
        }

        console.log('Tileset XML loaded successfully');

        // Parse collision objects from tileset
        const tileCollisionMap: { [key: number]: any[] } = {};
        const tiles = tilesetXML.getElementsByTagName('tile');

        console.log('Found', tiles.length, 'tiles in tileset');

        let collisionTileCount = 0;
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const tileId = parseInt(tile.getAttribute('id'));
            const objectGroups = tile.getElementsByTagName('objectgroup');

            if (objectGroups.length > 0) {
                const objects = objectGroups[0].getElementsByTagName('object');
                const collisionShapes: any[] = [];

                for (let j = 0; j < objects.length; j++) {
                    const obj = objects[j];
                    console.log(`Tile ${tileId} has object:`, {
                        x: obj.getAttribute('x'),
                        y: obj.getAttribute('y'),
                        width: obj.getAttribute('width'),
                        height: obj.getAttribute('height')
                    });

                    // Check if it's a rectangle
                    if (obj.getAttribute('width') && obj.getAttribute('height')) {
                        collisionShapes.push({
                            x: parseFloat(obj.getAttribute('x') || '0'),
                            y: parseFloat(obj.getAttribute('y') || '0'),
                            width: parseFloat(obj.getAttribute('width') || '0'),
                            height: parseFloat(obj.getAttribute('height') || '0'),
                            type: 'rectangle'
                        });
                        collisionTileCount++;
                    }
                    // Check if it's a polygon
                    else if (obj.getElementsByTagName('polygon').length > 0) {
                        const polygon = obj.getElementsByTagName('polygon')[0];
                        const pointsStr = polygon.getAttribute('points');
                        if (pointsStr) {
                            const points = pointsStr.split(' ').map((point: string) => {
                                const [x, y] = point.split(',').map(Number);
                                return { x, y };
                            });
                            collisionShapes.push({
                                x: parseFloat(obj.getAttribute('x') || '0'),
                                y: parseFloat(obj.getAttribute('y') || '0'),
                                points: points,
                                type: 'polygon'
                            });
                            collisionTileCount++;
                        }
                    }
                }

                if (collisionShapes.length > 0) {
                    tileCollisionMap[tileId] = collisionShapes;
                    console.log(`Tile ${tileId} has ${collisionShapes.length} collision shapes`);
                }
            }
        }

        console.log(`Total collision tiles found: ${collisionTileCount}`);
        console.log('Tile collision map keys:', Object.keys(tileCollisionMap));

        // Scan collision layers and create colliders
        const collisionLayerNames = ['House', 'Market', 'fence', 'Trees A', 'Trees B', 'Trees C', 'Trees D', 'Trees E'];

        console.log('=== DEBUG: Scanning layers for collision tiles ===');
        let totalTilesScanned = 0;
        let matchingTilesFound = 0;

        collisionLayerNames.forEach(layerName => {
            console.log(`Scanning layer: ${layerName}`);
            const layer = map.getLayer(layerName);
            if (!layer) {
                console.log(`Layer ${layerName} not found!`);
                return;
            }

            console.log(`Layer ${layerName} found, scanning tiles...`);
            const layerData = layer.data;
            for (let row = 0; row < layerData.length; row++) {
                for (let col = 0; col < layerData[row].length; col++) {
                    const tile = layerData[row][col];
                    if (!tile || tile.index === -1) continue;

                    totalTilesScanned++;
                    const localTileId = tile.index - tileset.firstgid;

                    if (tileCollisionMap[localTileId]) {
                        matchingTilesFound++;
                        console.log(`Found collision tile at (${col}, ${row}) - Local ID: ${localTileId}, Global ID: ${tile.index}`);

                        const tileWorldX = col * tileWidth;
                        const tileWorldY = row * tileHeight;

                        tileCollisionMap[localTileId].forEach(shape => {
                            colliders.push({
                                x: tileWorldX + shape.x,
                                y: tileWorldY + shape.y,
                                width: shape.width,
                                height: shape.height,
                                points: shape.points,
                                type: shape.type,
                                layer: layerName
                            });
                        });
                    }
                }
            }
        });

        console.log(`=== SCAN RESULTS ===`);
        console.log(`Total tiles scanned: ${totalTilesScanned}`);
        console.log(`Matching tiles found: ${matchingTilesFound}`);
        console.log(`Total colliders created: ${colliders.length}`);

        console.log(`Extracted ${colliders.length} collision shapes from tileset`);
        return colliders;
    }

    private setupColliders(): void {
        console.log('Setting up custom colliders from tileset...');

        // Extract collision shapes from the tileset
        const collisionShapes = this.extractTileColliders(this.map, this.tileset);
        console.log(`Found ${collisionShapes.length} collision shapes`);

        // Create static physics group for custom collision shapes
        const collisionGroup = this.physics.add.staticGroup();

        // Create physics bodies for rectangles (Arcade Physics only supports rectangles)
        const rectangles = collisionShapes.filter(shape => shape.type === 'rectangle');

        rectangles.forEach(rect => {
            const width = rect.width || 16;
            const height = rect.height || 16;
            const body = collisionGroup.create(rect.x + width / 2, rect.y + height / 2, '__blank');
            body.setSize(width, height);
            body.setOrigin(0.5, 0.5);
            body.setVisible(false); // Hide the placeholder sprite
            body.setImmovable(true);

            // Track collision bodies by tile position for tree layers
            if (rect.layer && rect.layer.startsWith('Trees')) {
                const tileX = Math.floor(rect.x / 16);
                const tileY = Math.floor(rect.y / 16);
                const key = `${tileX}_${tileY}_${rect.layer}`;
                if (!this.tileCollisionBodies.has(key)) {
                    this.tileCollisionBodies.set(key, []);
                }
                this.tileCollisionBodies.get(key)!.push(body);
            }
        });

        // For polygons, create multiple small rectangles to approximate the shape
        const polygons = collisionShapes.filter(shape => shape.type === 'polygon');
        polygons.forEach(poly => {
            if (poly.points && poly.points.length > 0) {
                // Create a bounding box for polygons (Arcade limitation)
                const minX = Math.min(...poly.points.map((p: { x: number }) => p.x));
                const maxX = Math.max(...poly.points.map((p: { x: number }) => p.x));
                const minY = Math.min(...poly.points.map((p: { y: number }) => p.y));
                const maxY = Math.max(...poly.points.map((p: { y: number }) => p.y));

                const width = maxX - minX;
                const height = maxY - minY;

                const body = collisionGroup.create(poly.x + minX + width / 2, poly.y + minY + height / 2, '__blank');
                body.setSize(width, height);
                body.setOrigin(0.5, 0.5);
                body.setVisible(false);
                body.setImmovable(true);

                // Track collision bodies by tile position for tree layers
                if (poly.layer && poly.layer.startsWith('Trees')) {
                    const tileX = Math.floor(poly.x / 16);
                    const tileY = Math.floor(poly.y / 16);
                    const key = `${tileX}_${tileY}_${poly.layer}`;
                    if (!this.tileCollisionBodies.has(key)) {
                        this.tileCollisionBodies.set(key, []);
                    }
                    this.tileCollisionBodies.get(key)!.push(body);
                }
            }
        });

        // Add colliders with player, NPC, and chickens
        this.physics.add.collider(this.player, collisionGroup);

        if (this.npc) {
            this.physics.add.collider(this.npc, collisionGroup);
        }

        this.chickens.forEach(chicken => {
            if (chicken && chicken.active) {
                this.physics.add.collider(chicken, collisionGroup);
            }
        });

        this.cows.forEach(cow => {
            if (cow && cow.active) {
                this.physics.add.collider(cow, collisionGroup);
            }
        });

        this.sheep.forEach(sheepAnimal => {
            if (sheepAnimal && sheepAnimal.active) {
                this.physics.add.collider(sheepAnimal, collisionGroup);
            }
        });

        // Optional: Debug visualization
        if (false) { // Set to true to see collision shapes
            rectangles.forEach(rect => {
                this.add.rectangle(rect.x, rect.y, rect.width, rect.height, 0xff0000, 0.3).setOrigin(0, 0);
            });

            polygons.forEach(poly => {
                if (poly.points && poly.points.length > 0) {
                    const graphics = this.add.graphics();
                    graphics.fillStyle(0x00ff00, 0.3);
                    graphics.beginPath();
                    graphics.moveTo(poly.x + poly.points[0].x, poly.y + poly.points[0].y);
                    poly.points.forEach((point: { x: number; y: number }) => {
                        graphics.lineTo(poly.x + point.x, poly.y + point.y);
                    });
                    graphics.closePath();
                    graphics.fillPath();
                }
            });
        }

        console.log(`Created ${rectangles.length} rectangle colliders and ${polygons.length} polygon colliders`);
        console.log('Custom colliders setup complete!');
    }

    private createParticles(): void {
        this.particleEmitter = this.add.particles(
            0, 0, // x, y coordinates (will be overridden by emitZone)
            'firefly',
            {
                x: { min: 0, max: this.map.widthInPixels },
                y: { min: 0, max: this.map.heightInPixels },
                lifespan: 5000,
                speed: { min: 3, max: 15 },
                scale: { start: 0.1, end: 0 },
                alpha: { start: 1, end: 0 },
                quantity: 3,
                blendMode: 'ADD'
            }
        );

        this.windTimer = this.time.addEvent({
            delay: 5000, // 5 seconds
            callback: this.updateWind,
            callbackScope: this,
            loop: true
        });
    }

    private updateWind(): void {
        const windX = Phaser.Math.Between(-20, 20);
        const windY = Phaser.Math.Between(-20, 20);

        // Correct way to set acceleration in recent Phaser 3 versions
        this.particleEmitter.accelerationX = windX;
        this.particleEmitter.accelerationY = windY;
    }

    private createPlayerAnimations(): void {
        // Idle animations (6 frames each, looping)
        this.anims.create({
            key: 'idle-up',
            frames: this.anims.generateFrameNumbers('player', { start: 12, end: 17 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'idle-right',
            frames: this.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'idle-down',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 5 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'idle-left',
            frames: this.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
            frameRate: 6,
            repeat: -1
        });

        // Walk animations (6 frames each)
        this.anims.create({
            key: 'walk-up',
            frames: this.anims.generateFrameNumbers('player', { start: 30, end: 35 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-right',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-down',
            frames: this.anims.generateFrameNumbers('player', { start: 18, end: 23 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-left',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 8,
            repeat: -1
        });

        // Run animations (same frames as walk, faster)
        this.anims.create({
            key: 'run-up',
            frames: this.anims.generateFrameNumbers('player', { start: 30, end: 35 }),
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'run-right',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'run-down',
            frames: this.anims.generateFrameNumbers('player', { start: 18, end: 23 }),
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'run-left',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 12,
            repeat: -1
        });

        // Attack animations (4 frames each, now in merged sprite sheet)
        this.anims.create({
            key: 'attack-up',
            frames: this.anims.generateFrameNumbers('player', { start: 48, end: 51 }),
            frameRate: 10,
            repeat: 0
        });
        this.anims.create({
            key: 'attack-right',
            frames: this.anims.generateFrameNumbers('player', { start: 42, end: 45 }),
            frameRate: 10,
            repeat: 0
        });
        this.anims.create({
            key: 'attack-down',
            frames: this.anims.generateFrameNumbers('player', { start: 36, end: 39 }),
            frameRate: 10,
            repeat: 0
        });
        this.anims.create({
            key: 'attack-left',
            frames: this.anims.generateFrameNumbers('player', { start: 42, end: 45 }),
            frameRate: 10,
            repeat: 0
        });

        // Dead animation (4 frames)
        this.anims.create({
            key: 'dead',
            frames: this.anims.generateFrameNumbers('player', { start: 54, end: 57 }),
            frameRate: 6,
            repeat: 0
        });

        // Tree cutting animations (using player_actions sprite sheet)
        this.anims.create({
            key: 'cut-tree-right',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 6, end: 7 }),
            frameRate: 8,
            repeat: 0
        });
        this.anims.create({
            key: 'cut-tree-left',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 6, end: 7 }),
            frameRate: 8,
            repeat: 0
        });
        this.anims.create({
            key: 'cut-tree-down',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 8, end: 9 }),
            frameRate: 8,
            repeat: 0
        });
        this.anims.create({
            key: 'cut-tree-up',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 10, end: 11 }),
            frameRate: 8,
            repeat: 0
        });
    }

    private createChickenAnimations(): void {
        // Chicken idle animation (2 frames)
        this.anims.create({
            key: 'chicken-idle',
            frames: this.anims.generateFrameNumbers('chicken', { start: 0, end: 1 }),
            frameRate: 4,
            repeat: -1
        });

        // Chicken walking animation (2 frames)
        this.anims.create({
            key: 'chicken-walk',
            frames: this.anims.generateFrameNumbers('chicken', { start: 2, end: 3 }),
            frameRate: 6,
            repeat: -1
        });
    }

    private createCowAnimations(): void {
        // Cow idle animation (2 frames)
        this.anims.create({
            key: 'cow-idle',
            frames: this.anims.generateFrameNumbers('cow', { start: 0, end: 1 }),
            frameRate: 4,
            repeat: -1
        });

        // Cow walking animation (2 frames)
        this.anims.create({
            key: 'cow-walk',
            frames: this.anims.generateFrameNumbers('cow', { start: 2, end: 3 }),
            frameRate: 6,
            repeat: -1
        });
    }

    private createSheepAnimations(): void {
        // Sheep idle animation (2 frames)
        this.anims.create({
            key: 'sheep-idle',
            frames: this.anims.generateFrameNumbers('sheep', { start: 0, end: 1 }),
            frameRate: 4,
            repeat: -1
        });

        // Sheep walking animation (2 frames)
        this.anims.create({
            key: 'sheep-walk',
            frames: this.anims.generateFrameNumbers('sheep', { start: 2, end: 3 }),
            frameRate: 6,
            repeat: -1
        });
    }

    private createNPCAnimations(): void {
        // NPC idle animations (same structure as player)
        this.anims.create({
            key: 'npc-idle-down',
            frames: this.anims.generateFrameNumbers('npc', { start: 0, end: 5 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-idle-right',
            frames: this.anims.generateFrameNumbers('npc', { start: 6, end: 11 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-idle-up',
            frames: this.anims.generateFrameNumbers('npc', { start: 12, end: 17 }),
            frameRate: 6,
            repeat: -1
        });

        // NPC walk animations
        this.anims.create({
            key: 'npc-walk-down',
            frames: this.anims.generateFrameNumbers('npc', { start: 18, end: 23 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-walk-right',
            frames: this.anims.generateFrameNumbers('npc', { start: 24, end: 29 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-walk-up',
            frames: this.anims.generateFrameNumbers('npc', { start: 30, end: 35 }),
            frameRate: 8,
            repeat: -1
        });
    }

    private createPlayer(): void {
        // Spawn player at center of map (400, 400 for 800x800 farm map)
        this.player = this.physics.add.sprite(400, 400, 'player', 0);
        this.player.setScale(2.0);
        this.player.setCollideWorldBounds(true);
        const body = this.player.body as Phaser.Physics.Arcade.Body;

        // Make the collision body 50% smaller than the visual sprite
        // Original: 19.2 x 16, New: 9.6 x 8 (50% of original)
        body.setSize(9.6, 8);
        // Center the smaller collision box within the sprite
        body.setOffset((32 - 9.6) / 2, (32 - 8) / 2);

        this.player.play('idle-down');
        this.player.setDepth(1000);

        // Add collision with map layers (trees, houses, fences)
        // This will be called after layers are created in setupColliders()
    }

    private createChickens(): void {
        // Spawn 5-6 chickens in the first fence (top-left enclosure)
        // Fence area: x: 16-112 (tiles 1-7), y: 144-240 (tiles 9-15)
        const chickenCount = Phaser.Math.Between(6, 8);
        for (let i = 0; i < chickenCount; i++) {
            const x = Phaser.Math.Between(32, 96);
            const y = Phaser.Math.Between(160, 224);

            const chicken = this.physics.add.sprite(x, y, 'chicken', 0);
            chicken.setScale(1.5);
            chicken.play('chicken-idle');
            chicken.setDepth(100);

            // Add health data to chicken
            chicken.setData('health', 3);
            chicken.setData('maxHealth', 3);
            chicken.setData('fenceBounds', { minX: 32, maxX: 96, minY: 160, maxY: 224 });

            // Store chicken in array
            this.chickens.push(chicken);

            // Make chicken walk randomly within fence
            const movementTimer = this.time.addEvent({
                delay: Phaser.Math.Between(2000, 4000),
                callback: () => this.moveAnimalRandomly(chicken, 'chicken'),
                loop: true
            });

            // Store timer reference on chicken
            chicken.setData('movementTimer', movementTimer);
        }
    }

    private createCows(): void {
        // Spawn 5-6 cows in the second fence (top-middle enclosure)
        // Fence area: x: 144-240 (tiles 9-15), y: 144-240 (tiles 9-15)
        const cowCount = Phaser.Math.Between(6, 8);
        for (let i = 0; i < cowCount; i++) {
            const x = Phaser.Math.Between(160, 224);
            const y = Phaser.Math.Between(160, 224);

            const cow = this.physics.add.sprite(x, y, 'cow', 0);
            cow.setScale(1.5);
            cow.play('cow-idle');
            cow.setDepth(100);

            // Add health data to cow
            cow.setData('health', 5);
            cow.setData('maxHealth', 5);
            cow.setData('fenceBounds', { minX: 160, maxX: 224, minY: 160, maxY: 224 });

            // Store cow in array
            this.cows.push(cow);

            // Make cow walk randomly within fence
            const movementTimer = this.time.addEvent({
                delay: Phaser.Math.Between(2000, 4000),
                callback: () => this.moveAnimalRandomly(cow, 'cow'),
                loop: true
            });

            cow.setData('movementTimer', movementTimer);
        }
    }

    private createSheep(): void {
        // Spawn 5-6 sheep in the third fence (top-left lower enclosure)
        // Fence area: x: 16-112 (tiles 1-7), y: 256-320 (tiles 16-20)
        const sheepCount = Phaser.Math.Between(6, 8);
        for (let i = 0; i < sheepCount; i++) {
            const x = Phaser.Math.Between(32, 96);
            const y = Phaser.Math.Between(272, 304);

            const sheep = this.physics.add.sprite(x, y, 'sheep', 0);
            sheep.setScale(1.5);
            sheep.play('sheep-idle');
            sheep.setDepth(100);

            // Add health data to sheep
            sheep.setData('health', 3);
            sheep.setData('maxHealth', 3);
            sheep.setData('fenceBounds', { minX: 32, maxX: 96, minY: 272, maxY: 304 });

            // Store sheep in array
            this.sheep.push(sheep);

            // Make sheep walk randomly within fence
            const movementTimer = this.time.addEvent({
                delay: Phaser.Math.Between(2000, 4000),
                callback: () => this.moveAnimalRandomly(sheep, 'sheep'),
                loop: true
            });

            sheep.setData('movementTimer', movementTimer);
        }
    }

    private createNPC(): void {
        // Spawn NPC at position (300, 400) using npc sprite
        this.npc = this.physics.add.sprite(300, 400, 'npc', 0);
        this.npc.setScale(2.0);
        this.npc.setDepth(100);

        // Set up collision body (same as player)
        const body = this.npc.body as Phaser.Physics.Arcade.Body;
        body.setSize(19.2, 16);
        body.setOffset(6.4, 12.8);

        // Collision with map layers will be handled in setupColliders()

        // Play idle animation
        this.npc.play('npc-idle-down');

        // Store starting position for NPC
        this.npc.setData('startX', 300);
        this.npc.setData('startY', 400);

        // Add name text above NPC
        const nameText = this.add.text(this.npc.x, this.npc.y - 25, 'herman', {
            fontSize: '10px',
            color: '#ffffff',
            resolution: 3
        });
        nameText.setOrigin(0.5);
        nameText.setDepth(10);

        // Store name text reference on NPC for potential updates
        this.npc.setData('nameText', nameText);

        // Set up patrol behavior
        this.setupNPCPatrol();
    }

    private moveAnimalRandomly(animal: Phaser.Physics.Arcade.Sprite, animalType: 'chicken' | 'cow' | 'sheep'): void {
        if (!animal || !animal.active) return;

        // Get fence bounds for this animal
        const bounds = animal.getData('fenceBounds');
        if (!bounds) return;

        // Randomly decide to walk or idle
        const shouldWalk = Math.random() > 0.5;
        if (shouldWalk) {
            // Random direction
            const velocityX = Phaser.Math.Between(-50, 50);
            const velocityY = Phaser.Math.Between(-50, 50);
            animal.setVelocity(velocityX, velocityY);
            animal.play(`${animalType}-walk`, true);

            // Flip animal based on direction
            if (velocityX < 0) {
                animal.setFlipX(true);
            } else if (velocityX > 0) {
                animal.setFlipX(false);
            }

            // Stop after a short time and check bounds
            this.time.delayedCall(1000, () => {
                if (animal && animal.active) {
                    animal.setVelocity(0, 0);

                    // Keep animal within fence bounds
                    animal.x = Phaser.Math.Clamp(animal.x, bounds.minX, bounds.maxX);
                    animal.y = Phaser.Math.Clamp(animal.y, bounds.minY, bounds.maxY);

                    animal.play(`${animalType}-idle`, true);
                }
            });
        }
    }

    private setupNPCWandering(): void {
        // Make NPC wander randomly
        const wanderTimer = this.time.addEvent({
            delay: Phaser.Math.Between(2000, 5000),
            callback: () => this.moveNPCRandomly(),
            loop: true
        });

        // Store timer reference on NPC
        this.npc.setData('wanderTimer', wanderTimer);
    }

    private setupNPCPatrol(): void {
        // Start with 4 second idle, then begin patrol loop
        this.time.delayedCall(4000, () => {
            this.startNPCPatrolCycle();
        });
    }

    private startNPCPatrolCycle(): void {
        if (!this.npc || !this.npc.active) return;

        // Check if patrol is paused (during chat)
        if (this.npc.getData('patrolPaused')) {
            // Retry after a short delay
            this.time.delayedCall(500, () => {
                this.startNPCPatrolCycle();
            });
            return;
        }

        // Double check we're not in a chat
        if (this.isChatting) {
            this.time.delayedCall(500, () => {
                this.startNPCPatrolCycle();
            });
            return;
        }

        const speed = 60;
        const walkDuration = 2000; // Walk for 2 seconds
        const idleDuration = 4000; // Idle for 4 seconds in the middle

        // Step 1: Walk right
        this.npc.setFlipX(false);
        this.npc.setVelocity(speed, 0);
        this.npc.play('npc-walk-right', true);

        this.time.delayedCall(walkDuration, () => {
            if (!this.npc || !this.npc.active) return;

            // Step 2: Stop and idle
            this.npc.setVelocity(0, 0);
            this.npc.play('npc-idle-right', true);

            this.time.delayedCall(idleDuration, () => {
                if (!this.npc || !this.npc.active) return;

                // Step 3: Walk left back to starting position
                this.npc.setFlipX(true);
                this.npc.setVelocity(-speed, 0);
                this.npc.play('npc-walk-right', true); // Use walk-right animation but flipped

                this.time.delayedCall(walkDuration, () => {
                    if (!this.npc || !this.npc.active) return;

                    // Step 4: Stop at starting position and idle
                    this.npc.setVelocity(0, 0);
                    this.npc.setFlipX(false);
                    this.npc.play('npc-idle-right', true);

                    // Wait 4 seconds then loop
                    this.time.delayedCall(4000, () => {
                        this.startNPCPatrolCycle();
                    });
                });
            });
        });
    }

    private moveNPCRandomly(): void {
        if (!this.npc || !this.npc.active) return;

        // Randomly decide to walk or idle
        const shouldWalk = Math.random() > 0.6;

        if (shouldWalk) {
            // Choose a random direction
            const directions = ['up', 'down', 'left', 'right'];
            const direction = Phaser.Utils.Array.GetRandom(directions);
            this.npc.setData('direction', direction);

            const speed = 60;
            let velocityX = 0;
            let velocityY = 0;

            switch (direction) {
                case 'up':
                    velocityY = -speed;
                    break;
                case 'down':
                    velocityY = speed;
                    break;
                case 'left':
                    velocityX = -speed;
                    this.npc.setFlipX(true);
                    break;
                case 'right':
                    velocityX = speed;
                    this.npc.setFlipX(false);
                    break;
            }

            this.npc.setVelocity(velocityX, velocityY);
            this.npc.play(`npc-walk-${direction}`, true);

            // Stop after a random time
            this.time.delayedCall(Phaser.Math.Between(1000, 2500), () => {
                if (this.npc && this.npc.active) {
                    this.npc.setVelocity(0, 0);
                    const currentDirection = this.npc.getData('direction');
                    this.npc.play(`npc-idle-${currentDirection}`, true);
                }
            });
        } else {
            // Just idle
            this.npc.setVelocity(0, 0);
            const currentDirection = this.npc.getData('direction');
            this.npc.play(`npc-idle-${currentDirection}`, true);
        }
    }

    private setupInputs(): void {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            up: this.input.keyboard!.addKey('W'),
            down: this.input.keyboard!.addKey('S'),
            left: this.input.keyboard!.addKey('A'),
            right: this.input.keyboard!.addKey('D')
        };
        this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.interactKey = this.input.keyboard!.addKey('E');
        this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.attackKey = this.input.keyboard!.addKey('Q');
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.cutKey = this.input.keyboard!.addKey('R');

        this.escKey.on('down', () => {
            if (this.isChatting) {
                this.endChat();
            } else {
                this.exitFarm();
            }
        });

        this.spaceKey.on('down', () => this.tryStartChat());
        this.cutKey.on('down', () => this.tryCutTree());

        // Listen for keyboard input for chat
        this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            if (this.isChatting) {
                this.handleChatInput(event);
            }
        });
    }

    private setupCamera(): void {
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        // Set camera bounds to match map size
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        // Set initial zoom based on screen size
        this.updateCameraZoom();

        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);
    }

    private updateCameraZoom(): void {
        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;

        // Use the initialZoom property as the base zoom
        const baseZoom = this.initialZoom;

        // Ensure zoom doesn't go below 1 or above 3
        const zoom = Phaser.Math.Clamp(baseZoom, 1, 100);

        this.cameras.main.setZoom(zoom);
    }

    private handleResize(gameSize: Phaser.Structs.Size): void {
        // Update camera bounds to match new game size
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // Update zoom based on new screen size
        this.updateCameraZoom();

        // Update UI scene on resize
        const uiScene = this.scene.get(SCENE_KEYS.UI) as UIScene;
        if (uiScene) {
            // Trigger the UI scene's own resize handler
            if (uiScene.scene && typeof (uiScene as any).handleResize === 'function') {
                (uiScene as any).handleResize();
            }
            // Also update position directly to ensure it's in the right place
            uiScene.updatePosition();
        }

        // Debug log
        console.log('Window resized:', {
            width: gameSize.width,
            height: gameSize.height,
            camera: this.cameras.main ? {
                width: this.cameras.main.width,
                height: this.cameras.main.height,
                zoom: this.cameras.main.zoom
            } : 'No camera'
        });
    }

    private handlePlayerMovement(): void {
        // Don't move if cutting
        if (this.isCutting) {
            this.player.setVelocity(0, 0);
            return;
        }

        // Check if attack key is being held down
        if (this.attackKey.isDown) {
            this.handleAttack();
            return;
        }

        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;
        const isRunning = this.shiftKey.isDown;
        const speed = isRunning ? this.playerRunSpeed : this.playerSpeed;

        const velocity = new Phaser.Math.Vector2(
            Number(right) - Number(left),
            Number(down) - Number(up)
        );

        if (velocity.x < 0) {
            this.currentDirection = 'left';
        } else if (velocity.x > 0) {
            this.currentDirection = 'right';
        }

        if (velocity.y < 0) {
            this.currentDirection = 'up';
        } else if (velocity.y > 0) {
            this.currentDirection = 'down';
        }

        if (velocity.lengthSq() > 0) {
            velocity.normalize().scale(speed);
            this.player.setVelocity(velocity.x, velocity.y);
        } else {
            this.player.setVelocity(0, 0);
        }

        this.updatePlayerAnimation(isRunning);
    }

    private handleInteraction(): void {
        this.interactKey.on('down', () => {
            const playerTileX = this.farmingLayer.worldToTileX(this.player.x);
            const playerTileY = this.farmingLayer.worldToTileY(this.player.y);
            const radius = 2;

            for (let y = playerTileY - radius; y <= playerTileY + radius; y++) {
                for (let x = playerTileX - radius; x <= playerTileX + radius; x++) {
                    const targetTile = this.farmingLayer.getTileAt(x, y);
                    const cropTile = this.cropsLayer.getTileAt(x, y);

                    // Check if the tile is tilled soil and has no crop on it
                    if (targetTile && this.farmableTileIndices.has(targetTile.index) && (!cropTile || cropTile.index === -1)) {
                        // Plant a crop and immediately stop searching
                        this.cropsLayer.putTileAt(1774, x, y);
                        return;
                    }
                }
            }
        });
    }

    private updatePlayerAnimation(isRunning: boolean): void {
        // Don't update animation if attacking
        if (this.isAttacking) {
            return;
        }

        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const isMoving = body.velocity.x !== 0 || body.velocity.y !== 0;

        if (this.currentDirection === 'left') {
            this.player.setFlipX(true);
        } else {
            this.player.setFlipX(false);
        }

        if (!isMoving) {
            this.player.play(`idle-${this.currentDirection}`, true);
        } else if (isRunning) {
            this.player.play(`run-${this.currentDirection}`, true);
        } else {
            this.player.play(`walk-${this.currentDirection}`, true);
        }
    }

    private handleAttack(): void {
        // Stop player movement during attack
        this.player.setVelocity(0, 0);

        // If already attacking, just continue
        if (this.isAttacking) {
            return;
        }

        this.isAttacking = true;

        // Check for chickens in attack range
        this.checkAttackHit();

        // Play attack animation based on current direction (don't restart if already playing)
        const attackAnim = `attack-${this.currentDirection}`;
        this.player.play(attackAnim, false);

        // Listen for animation complete to loop or stop
        this.player.on('animationcomplete', this.onAttackComplete, this);
    }

    private checkAttackHit(): void {
        const attackRange = 50;

        // Check chickens
        this.chickens.forEach(chicken => {
            if (!chicken.active) return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                chicken.x, chicken.y
            );

            if (distance < attackRange) {
                this.damageAnimal(chicken, 'chicken');
            }
        });

        // Check cows
        this.cows.forEach(cow => {
            if (!cow.active) return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                cow.x, cow.y
            );

            if (distance < attackRange) {
                this.damageAnimal(cow, 'cow');
            }
        });

        // Check sheep
        this.sheep.forEach(sheepAnimal => {
            if (!sheepAnimal.active) return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                sheepAnimal.x, sheepAnimal.y
            );

            if (distance < attackRange) {
                this.damageAnimal(sheepAnimal, 'sheep');
            }
        });
    }

    private damageAnimal(animal: Phaser.Physics.Arcade.Sprite, animalType: 'chicken' | 'cow' | 'sheep'): void {
        const currentHealth = animal.getData('health');
        const newHealth = currentHealth - 1;
        animal.setData('health', newHealth);

        // Flash red when hit
        animal.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            animal.clearTint();
        });

        if (newHealth <= 0) {
            // Animal dies
            animal.setVelocity(0, 0);
            animal.setAlpha(0.5);

            // Cancel the movement timer to prevent callbacks on destroyed object
            const movementTimer = animal.getData('movementTimer');
            if (movementTimer) {
                movementTimer.destroy();
            }

            // Fade out and destroy
            this.tweens.add({
                targets: animal,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    animal.destroy();
                }
            });
        }
    }

    private onAttackComplete(): void {
        // If Q is still being held, play the attack animation again (loop)
        if (this.attackKey.isDown) {
            // Check for hits on each attack cycle
            this.checkAttackHit();
            const attackAnim = `attack-${this.currentDirection}`;
            this.player.play(attackAnim, true);
        } else {
            // Q released, stop attacking
            this.isAttacking = false;
            this.player.off('animationcomplete', this.onAttackComplete, this);
            // Switch back to normal player texture
            this.player.setTexture('player', 0);
            this.player.play(`idle-${this.currentDirection}`, true);
        }
    }

    private tryStartChat(): void {
        if (this.isChatting) return;

        // Check if player is near NPC
        const distance = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.npc.x, this.npc.y
        );

        if (distance < 80) {
            this.startChat();
        }
    }

    private tryCutTree(): void {
        if (this.isCutting || this.isChatting) return;

        // Check if player is near a tree
        const nearestTree = this.findNearestTree();

        if (nearestTree) {
            this.cutTree(nearestTree);
        }
    }

    private findNearestTree(): { x: number; y: number; direction: string; tile: Phaser.Tilemaps.Tile; layer: Phaser.Tilemaps.TilemapLayer } | null {
        const checkRadius = 48; // Proximity radius to detect trees
        const playerTileX = Math.floor(this.player.x / 16);
        const playerTileY = Math.floor(this.player.y / 16);

        let nearestTree: { x: number; y: number; direction: string; tile: Phaser.Tilemaps.Tile; layer: Phaser.Tilemaps.TilemapLayer } | null = null;
        let nearestDistance = Infinity;

        // Check all tree layers for nearby trees
        this.treeLayers.forEach(layer => {
            // Check tiles around the player
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const tileX = playerTileX + dx;
                    const tileY = playerTileY + dy;
                    const tile = layer.getTileAt(tileX, tileY);

                    if (tile && tile.index !== -1) {
                        const tileWorldX = tileX * 16 + 8;
                        const tileWorldY = tileY * 16 + 8;
                        const distance = Phaser.Math.Distance.Between(
                            this.player.x, this.player.y,
                            tileWorldX, tileWorldY
                        );

                        if (distance < checkRadius && distance < nearestDistance) {
                            nearestDistance = distance;

                            // Determine direction to face the tree
                            const deltaX = tileWorldX - this.player.x;
                            const deltaY = tileWorldY - this.player.y;

                            let direction = 'down';
                            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                                direction = deltaX > 0 ? 'right' : 'left';
                            } else {
                                direction = deltaY > 0 ? 'down' : 'up';
                            }

                            nearestTree = { x: tileWorldX, y: tileWorldY, direction, tile, layer };
                        }
                    }
                }
            }
        });

        return nearestTree;
    }

    private cutTree(tree: { x: number; y: number; direction: string; tile: Phaser.Tilemaps.Tile; layer: Phaser.Tilemaps.TilemapLayer }): void {
        this.isCutting = true;
        this.player.setVelocity(0, 0);

        // Face the tree
        this.currentDirection = tree.direction;

        // Get or initialize hit count for this tree group
        // We'll track the entire tree by storing data on the tile we're hitting
        let hitCount = tree.tile.properties.hitCount || 0;
        hitCount++;

        // Store hit count
        tree.tile.properties.hitCount = hitCount;

        // Switch to player_actions texture and play cutting animation
        this.player.setTexture('player_actions', 0);
        const cutAnim = `cut-tree-${tree.direction}`;
        this.player.play(cutAnim, false);

        // Listen for animation complete
        this.player.once('animationcomplete', () => {
            this.isCutting = false;
            this.player.setTexture('player', 0);
            this.player.play(`idle-${this.currentDirection}`, true);

            // Check if tree should be removed
            if (hitCount >= 5) {
                // Remove all connected tiles that form this tree
                this.removeConnectedTreeTiles(tree.tile, tree.layer);
            }
        });
    }

    private removeConnectedTreeTiles(startTile: Phaser.Tilemaps.Tile, layer: Phaser.Tilemaps.TilemapLayer): void {
        const tilesToRemove: Set<string> = new Set();
        const toCheck: Phaser.Tilemaps.Tile[] = [startTile];
        const checked: Set<string> = new Set();

        // Flood fill to find all connected tiles
        while (toCheck.length > 0) {
            const tile = toCheck.pop()!;
            const key = `${tile.x}_${tile.y}`;

            if (checked.has(key)) continue;
            checked.add(key);

            if (tile && tile.index !== -1) {
                tilesToRemove.add(key);

                // Check all 8 adjacent tiles (including diagonals for tree canopy)
                const directions = [
                    [-1, -1], [0, -1], [1, -1],
                    [-1, 0], [1, 0],
                    [-1, 1], [0, 1], [1, 1]
                ];

                directions.forEach(([dx, dy]) => {
                    const adjacentTile = layer.getTileAt(tile.x + dx, tile.y + dy);
                    if (adjacentTile && adjacentTile.index !== -1 && !checked.has(`${adjacentTile.x}_${adjacentTile.y}`)) {
                        toCheck.push(adjacentTile);
                    }
                });
            }
        }

        // Remove all tiles in the tree and their collision bodies
        tilesToRemove.forEach(key => {
            const [x, y] = key.split('_').map(Number);
            layer.removeTileAt(x, y);

            // Remove associated collision bodies
            const collisionKey = `${x}_${y}_${layer.layer.name}`;
            const bodies = this.tileCollisionBodies.get(collisionKey);
            if (bodies) {
                bodies.forEach(body => {
                    if (body && body.active) {
                        body.destroy();
                    }
                });
                this.tileCollisionBodies.delete(collisionKey);
            }
        });
    }

    private startChat(): void {
        this.isChatting = true;
        this.playerInput = '';

        // Stop NPC movement and pause patrol
        this.npc.setVelocity(0, 0);
        this.npc.setData('patrolPaused', true);
        const currentDirection = this.npc.getData('direction') || 'right';
        this.npc.play(`npc-idle-${currentDirection}`, true);

        // Stop player movement
        this.player.setVelocity(0, 0);

        // Create chat bubble
        this.createChatBubble();
    }

    private createChatBubble(): void {
        const bubbleWidth = 100;
        const bubbleHeight = 30;
        const bubblePadding = 6;

        // Create chatbox indicator image beside player's head (closer to character)
        const chatboxIndicator = this.add.image(this.player.x + 5, this.player.y - 5, 'chatbox');
        chatboxIndicator.setScale(0.25); // Small indicator
        chatboxIndicator.setDepth(2000);
        this.player.setData('chatboxIndicator', chatboxIndicator);

        // Create player's chat bubble with chatdialog image
        const playerBubble = this.add.container(this.player.x, this.player.y - 10);
        playerBubble.setDepth(2000);

        // Add chatdialog image
        const chatDialogImage = this.add.image(0, -20, 'chatdialog');
        chatDialogImage.setScale(0.15); // Scale down from 905x276

        this.chatText = this.add.text(
            0,
            -20,
            '',
            {
                fontSize: '10px',
                color: '#000000',
                wordWrap: { width: 120 },
                resolution: 3
            }
        );
        this.chatText.setOrigin(0.5, 0.5);

        playerBubble.add([chatDialogImage, this.chatText]);
        this.player.setData('chatBubble', playerBubble);

        // Create NPC's chat bubble (hidden initially)
        this.chatBubble = this.add.container(this.npc.x, this.npc.y - 50);
        this.chatBubble.setDepth(2000);
        this.chatBubble.setVisible(false);

        // Add chatdialog image for NPC
        const npcDialogImage = this.add.image(0, -20, 'chatdialog');
        npcDialogImage.setScale(0.15); // Scale down from 905x276

        this.npcResponse = this.add.text(
            0,
            -20,
            'Deal!',
            {
                fontSize: '10px',
                color: '#000000',
                fontStyle: 'bold',
                wordWrap: { width: 120 },
                resolution: 3
            }
        );
        this.npcResponse.setOrigin(0.5, 0.5);

        this.chatBubble.add([npcDialogImage, this.npcResponse]);
    }

    private handleChatInput(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            // Send message and get NPC response
            this.sendMessage();
        } else if (event.key === 'Backspace') {
            this.playerInput = this.playerInput.slice(0, -1);
            this.updateChatText();
        } else if (event.key === 'Escape') {
            // Handled by escKey listener
            return;
        } else if (event.key.length === 1 && this.playerInput.length < 50) {
            // Add character to input
            this.playerInput += event.key;
            this.updateChatText();
        }
    }

    private updateChatText(): void {
        if (this.chatText) {
            this.chatText.setText(this.playerInput + '|');
        }
    }

    private sendMessage(): void {
        if (this.playerInput.trim().length === 0) return;

        // Show the final message in player's bubble
        this.chatText.setText(this.playerInput);

        // Hide chatbox indicator (stop showing typing icon)
        const chatboxIndicator = this.player.getData('chatboxIndicator');
        if (chatboxIndicator) {
            chatboxIndicator.setVisible(false);
        }

        // Allow player to move again
        this.isChatting = false;

        // NPC responds with "Deal!"
        this.time.delayedCall(500, () => {
            this.chatBubble.setVisible(true);

            // Close chat after showing response (this will hide both bubbles)
            this.time.delayedCall(2000, () => {
                this.endChat();
            });
        });
    }

    private endChat(): void {
        this.isChatting = false;
        this.playerInput = '';

        // Destroy chatbox indicator
        const chatboxIndicator = this.player.getData('chatboxIndicator');
        if (chatboxIndicator) {
            chatboxIndicator.destroy();
            this.player.setData('chatboxIndicator', null);
        }

        // Destroy player chat bubble
        const playerBubble = this.player.getData('chatBubble');
        if (playerBubble) {
            playerBubble.destroy();
            this.player.setData('chatBubble', null);
        }

        // Destroy NPC chat bubble
        if (this.chatBubble) {
            this.chatBubble.destroy();
        }

        // Resume NPC patrol only after everything is cleaned up
        this.time.delayedCall(100, () => {
            this.npc.setData('patrolPaused', false);
        });
    }

    private exitFarm(): void {
        this.cameras.main.fadeOut(500, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('WorldSelectionScene');
        });
    }

    destroy(): void {
        // Clean up resize event listener
        this.scale.off('resize', this.handleResize, this);
        this.windTimer.destroy();
    }
}
