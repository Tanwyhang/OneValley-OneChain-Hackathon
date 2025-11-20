import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { UIScene } from './UIScene';
import { SCENE_KEYS } from './SceneKeys';
import { Enemy } from '../enemies/Enemy';
import { getOpenRouterService, OpenRouterService } from '../../services/OpenRouterService';
import { ContextualActionManager } from '../managers/ContextualActionManager';
import { FloatingHintManager } from '../managers/FloatingHintManager';
import { OneChainHarvester } from '../../services/OneChainHarvester';
import WalletBridgeService from '../../services/WalletBridgeService';
import { SuiClient } from '@onelabs/sui/client';
import { ONECHAIN_NETWORK } from '../../config/contracts';
import HUDBridgeService from '../../services/HUDBridgeService';
import AutoMintService, { GameItem } from '../../services/AutoMintService';

interface Crop {
    x: number;
    y: number;
    growthStage: number; // 0: seed, 1: growing, 2: mature
    type: 'carrot';
    plantedTime: number;
}

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
    private waterKey!: Phaser.Input.Keyboard.Key;

    // Particle properties
    private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private windTimer!: Phaser.Time.TimerEvent;

    // Farming properties
    private farmableTileIndices: Set<number> = new Set([521, 522, 523, 578, 579, 580, 635, 636, 637]);
    private waterTileIndices: Set<number> = new Set([6, 60, 61, 62, 115, 116, 117, 118]); // Water tile indices

    // Crop management
    private crops: Map<string, Crop> = new Map();
    private cropGrowthTimers: Map<string, Phaser.Time.TimerEvent> = new Map();

    // Sprite-based crop system to solve overlapping issues
    private cropSprites: Map<string, Phaser.GameObjects.GameObject[]> = new Map();
    private windEffectTweens: Map<string, Phaser.Tweens.Tween[]> = new Map();

    // Harvesting system
    private droppedCarrots: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private harvestKey!: Phaser.Input.Keyboard.Key;
    private collectKey!: Phaser.Input.Keyboard.Key;
    private marketplaceKey!: Phaser.Input.Keyboard.Key;
    private harvestedCarrotCount: number = 0;
    private collectButton!: Phaser.GameObjects.Container;
    private collectButtonText!: Phaser.GameObjects.Text;
    private isHarvesting: boolean = false;
    private isCollecting: boolean = false;

    // Mint confirmation modal properties (following transaction details modal pattern)
    private mintModalContainer!: Phaser.GameObjects.Container;
    private mintModalVisible: boolean = false;
    private mintModalCreated: boolean = false;
    private mintModalOverlay!: Phaser.GameObjects.Rectangle;
    private mintModalCloseButton!: Phaser.GameObjects.GameObject;
    private pendingMintCount: number = 0;

    // Player state
    private playerSpeed: number = 150;
    private playerRunSpeed: number = 250;
    private currentDirection: string = 'down';
    private initialZoom: number = 3;
    private isAttacking: boolean = false;
    private isCutting: boolean = false;
    private isWatering: boolean = false;
    private treeLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private tileCollisionBodies: Map<string, Phaser.GameObjects.GameObject[]> = new Map();

    // Animals
    private chickens: Phaser.Physics.Arcade.Sprite[] = [];
    private cows: Phaser.Physics.Arcade.Sprite[] = [];
    private sheep: Phaser.Physics.Arcade.Sprite[] = [];

    // Enemies
    private enemies: Enemy[] = [];

    // NPC
    private npc!: Phaser.Physics.Arcade.Sprite;

    // Player health
    private playerMaxHp: number = 100;
    private playerCurrentHp: number = 100;
    private lastDamageTime: number = 0;
    private damageInvincibilityDuration: number = 1000; // 1 second invincibility after taking damage
    private isDead: boolean = false;

    // Background music
    private bgMusic?: Phaser.Sound.BaseSound;

    // Chat system
    private isChatting: boolean = false;
    private chatBubble!: Phaser.GameObjects.Container;
    private chatBackground!: Phaser.GameObjects.Graphics;

    // Transaction notification system
    private transactionNotificationQueue: Array<{
      message: string;
      type: 'success' | 'info' | 'warning';
      duration: number;
    }> = [];
    private isShowingNotification: boolean = false;
    private currentNotificationText?: Phaser.GameObjects.Text;
    private currentNotificationBackground?: Phaser.GameObjects.Graphics;
    private notificationContainer?: Phaser.GameObjects.Container;
    private chatText!: Phaser.GameObjects.Text;
    private playerInput: string = '';
    private npcResponse!: Phaser.GameObjects.Text;
    private openRouterService!: OpenRouterService;
    
    // HUD Bridge for React HUD integration
    private hudBridge!: HUDBridgeService;

    // Contextual Action System
    private contextualActionManager!: ContextualActionManager;
    private floatingHintManager!: FloatingHintManager;

    // Settings UI
    private settingsIcon!: Phaser.GameObjects.Image;
    private isNearNPC: boolean = false;

    // Marketplace
    private marketplaceIcon!: Phaser.GameObjects.Image;

    // OneChain Harvester
    private oneChainHarvester!: OneChainHarvester;
    private suiClient!: SuiClient;
    private walletBridge!: WalletBridgeService;
    private isNearMarketplace: boolean = false;

    
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

        // Load enemy sprites
        // Skeleton sprite (192x320, 6 rows x 10 columns = 32x32 per frame)
        // Rows: 1-idle down, 2-idle side, 3-idle up, 4-walk down, 5-walk side, 6-walk up
        this.load.spritesheet('skeleton', '../Cute_Fantasy_Free/Enemies/Skeleton.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Slime sprite (512x192, 3 rows x 8 columns = 64x64 per frame)
        // Row 1: frames 0-7 (0-3 idle, 4-7 unused)
        // Row 2: frames 8-15 (jumping/moving)
        // Row 3: frames 16-23 (dead animation)
        this.load.spritesheet('slime', '../Cute_Fantasy_Free/Enemies/Slime_Green.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // Load chatbox image
        this.load.image('chatbox', '../Cute_Fantasy_Free/Player/chatbox.png');

        // Load chat dialog image
        this.load.image('chatdialog', '../Cute_Fantasy_Free/Player/chatdialog.png');

        // Load settings icon
        this.load.image('settings_icon', '../Cute_Fantasy_Free/Player/player_settings.png');

        // Load heart for HP display
        this.load.image('heart', '../Cute_Fantasy_Free/Player/heart.png');

        // Load particle image
        this.load.image('firefly', 'firefly.png');

        // Load background music
        this.load.audio('bgm', 'audio/BGM-OneValley.mp3');

        this.load.setPath('assets/items');
        
        // Load test items
        this.load.image('potion_01a', 'consumables/potion_01a.png');
        this.load.image('fish_01a', 'consumables/fish_01a.png');
        this.load.image('candy_01a', 'consumables/candy_01a.png');
        this.load.image('helmet_01a', 'armors/helmet_01a.png');

        // Load marketplace items - Weapons
        const weapons = ['sword_01a', 'sword_01b', 'sword_01c', 'sword_01d', 'sword_01e', 'sword_02a', 'sword_02b', 'sword_02c', 'sword_02d', 'sword_02e', 'bow_01a', 'bow_01b', 'bow_01d', 'bow_01e', 'bow_02a', 'bow_02b', 'bow_02d', 'bow_02e', 'arrow_01a', 'arrow_01b', 'arrow_02a', 'arrow_02b', 'shield_01a', 'shield_01b', 'shield_02a', 'shield_02b', 'staff_01a', 'staff_01b', 'spellbook_01a', 'spellbook_01b'];
        weapons.forEach(item => this.load.image(item, `weapons/${item}.png`));

        // Load marketplace items - Armors
        const armors = ['helmet_01a', 'helmet_01b', 'helmet_01c', 'helmet_01d', 'helmet_01e', 'helmet_02a', 'helmet_02b', 'helmet_02c', 'helmet_02d', 'helmet_02e'];
        armors.forEach(item => {
            if (item !== 'helmet_01a') this.load.image(item, `armors/${item}.png`);
        });

        // Load marketplace items - Misc
        const misc = ['book_01a', 'book_01b', 'book_02a', 'book_02b', 'coin_01a', 'coin_01b', 'coin_02a', 'coin_02b', 'crystal_01a', 'crystal_01b', 'gem_01a', 'gem_01b', 'gift_01a', 'gift_01b', 'ingot_01a', 'ingot_01b', 'key_01a', 'key_01b', 'necklace_01a', 'necklace_01b', 'pearl_01a', 'pearl_01b', 'ring_01a', 'ring_01b', 'scroll_01a', 'scroll_01b', 'scroll_01c', 'scroll_01d', 'scroll_01e', 'scroll_01f'];
        misc.forEach(item => this.load.image(item, `misc/${item}.png`));

        // Load marketplace items - Consumables
        const consumables = ['potion_01a', 'potion_01b', 'potion_01c', 'potion_01d', 'potion_01e', 'potion_01f', 'potion_01g', 'potion_01h', 'potion_02a', 'potion_02b', 'potion_02c', 'potion_02d', 'potion_02e', 'potion_02f', 'potion_03a', 'potion_03b', 'fish_01a', 'fish_01b', 'fish_01c', 'fish_01d', 'fish_01e', 'candy_01a', 'candy_01b', 'candy_01c', 'candy_01d', 'candy_01e', 'candy_01f', 'candy_01g', 'candy_02a', 'candy_02b'];
        consumables.forEach(item => {
            if (item !== 'potion_01a' && item !== 'fish_01a' && item !== 'candy_01a') {
                this.load.image(item, `consumables/${item}.png`);
            }
        });

        // Load UI assets
        this.load.setPath('assets/ui');
        this.load.image('slot', 'slot.png');
        this.load.image('selected-slot', 'selected-slot.png');
        this.load.image('itembar', 'itembar.png');
        this.load.image('backpack', 'backpack.png');
        this.load.image('marketplace', 'marketplace-with-character.png');
        
        // Marketplace category buttons (default)
        this.load.image('btn-weapons', 'top-button-Weapons.png');
        this.load.image('btn-armors', 'top-button-Armors.png');
        this.load.image('btn-misc', 'top-button-Misc.png');
        this.load.image('btn-consumables', 'top-button-Consumables.png');
        
        // Marketplace category buttons (selected)
        this.load.image('btn-weapons-selected', 'selected-top-button-Weapons.png');
        this.load.image('btn-armors-selected', 'selected-top-button-Armors.png');
        this.load.image('btn-misc-selected', 'selected-top-button-Misc.png');
        this.load.image('btn-consumables-selected', 'selected-top-button-Consumables.png');
        
        // Buy/Sell buttons
        this.load.image('buy-button', 'buy-button.png');
        this.load.image('hover-buy-button', 'hover-buy-button.png');
        this.load.image('selected-buy-button', 'selected-buy-button.png');
        this.load.image('sell-button', 'sell-button.png');
        
        // Save button
        this.load.image('save-button', 'save-button.png');
        this.load.image('hover-save-button', 'hover-save-button.png');
        this.load.image('selected-save-button', 'selected-save-button.png');

        // Settings button
        this.load.image('settings-button', 'settings-button.png');

        // Guide button
        this.load.image('guide-button', 'guide-button.png');

        // Exit button
        this.load.image('exit-button', 'exit-button.png');

        // Guide menu image (you'll add this)
        // this.load.image('guide-menu', 'guide-menu.png');

        this.load.setPath('assets');
        // Load carrot sprites for different growth stages (use absolute paths)
        this.load.image('carrot_stage1', 'carrot-new.png');
        this.load.image('carrot_stage2', 'carrot-stage2.png');
        this.load.image('carrot_stage3', 'carrot-stage3.png');

        

        // Debug: Log when assets are loaded
        this.load.on('complete', () => {
            console.log('Assets loaded successfully');
            console.log('itembar texture exists:', this.textures.exists('itembar'));
            console.log('slot texture exists:', this.textures.exists('slot'));
            console.log('carrot_stage1 texture exists:', this.textures.exists('carrot_stage1'));
            console.log('carrot_stage2 texture exists:', this.textures.exists('carrot_stage2'));
            console.log('carrot_stage3 texture exists:', this.textures.exists('carrot_stage3'));
        });
    }

    create() {
        console.log('FarmScene create() started');

        // Initialize OpenRouter service for NPC chat
        this.openRouterService = getOpenRouterService();

        // Initialize contextual action system
        this.contextualActionManager = new ContextualActionManager(this);
        this.floatingHintManager = new FloatingHintManager(this);

        // Initialize OneChain services for real blockchain minting
        this.suiClient = new SuiClient({ url: ONECHAIN_NETWORK.RPC_URL });
        this.walletBridge = WalletBridgeService.getInstance();
        this.oneChainHarvester = this.walletBridge.getHarvester() || new OneChainHarvester(this.suiClient);
        
        // Initialize HUD Bridge for React HUD
        this.hudBridge = HUDBridgeService.getInstance();
        this.hudBridge.updatePlayerStats({
            health: this.playerCurrentHp,
            maxHealth: this.playerMaxHp,
            energy: 100,
            maxEnergy: 100,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
        });
        this.hudBridge.setGoldCount(0);
        this.hudBridge.setCurrentScene('farm');

        // Reset state variables and clear references to destroyed objects
        this.isNearNPC = false;
        this.isNearMarketplace = false;
        this.isChatting = false;
        this.isAttacking = false;
        this.isCutting = false;
        this.chickens = [];
        this.cows = [];
        this.sheep = [];
        this.enemies = [];
        this.collisionLayers = [];
        this.treeLayers = [];
        this.tileCollisionBodies = new Map();
        this.marketplaceIcon = null as any;
        this.settingsIcon = null as any;

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
        this.createEnemyAnimations();
        this.createPlayer();
        this.createChickens();
        this.createCows();
        this.createSheep();
        this.createRandomAnimals();
        this.createNPC();
        this.createEnemies();
        this.setupInputs();
        this.setupCamera();
        this.createCollectButton();
        this.createMintModal();

        // Create particles
        this.createParticles();

        // Set up physics colliders for all entities
        this.setupColliders();

        // Listen for interaction
        this.handleInteraction();

        EventBus.emit('current-scene-ready', this);

        // Set up transaction notification listeners
        this.setupTransactionNotifications();

        // Stop UIScene if it exists, then start it fresh
        if (this.scene.isActive(SCENE_KEYS.UI)) {
            this.scene.stop(SCENE_KEYS.UI);
        }
        this.scene.launch(SCENE_KEYS.UI, { parent: this });

        // Add test items and show UI after a short delay to ensure everything is loaded
        this.time.delayedCall(1000, () => {
            const uiScene = this.scene.get(SCENE_KEYS.UI) as UIScene;
            if (uiScene) {
                // Add test items to the item bar with counts
                uiScene.addItem('potion_01a', 0, 'potion', 5);
                uiScene.addItem('fish_01a', 1, 'food', 12);
                uiScene.addItem('candy_01a', 2, 'candy', 25);
                uiScene.addItem('helmet_01a', 3, 'helmet', 1);

                // Add some empty slots with just numbers
                for (let i = 4; i < 8; i++) {
                    // These will show just the slot numbers
                }

                // Show the UI after adding items
                uiScene.showUI();
            }
        });

        // Start background music
        this.bgMusic = this.sound.add('bgm', { loop: true, volume: 0.5 });
        this.bgMusic.play();
        
        // Prevent music from pausing when window loses focus
        this.sound.pauseOnBlur = false;

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
        this.checkMarketplaceProximity();
        this.updateCollectButton();
        this.updateFloatingCarrots();

        // Update contextual action system
        if (this.contextualActionManager && this.floatingHintManager) {
            const actionResult = this.contextualActionManager.update();
            this.floatingHintManager.update(actionResult.availableActions);
        }

        // Handle harvesting
        if (this.harvestKey.isDown && !this.isHarvesting) {
            this.tryHarvestCrop();
        }
    }

    private applyWindEffect(sprite: Phaser.GameObjects.Sprite, cropKey: string): void {
        // Create subtle wind sway effect with random timing for natural look
        const baseDelay = Phaser.Math.Between(0, 2000);
        const swayDuration = Phaser.Math.Between(1500, 2500);
        const swayAngle = Phaser.Math.FloatBetween(1.5, 3);
        const scaleFactor = Phaser.Math.FloatBetween(0.98, 1.02);

        // Rotation tween - subtle sway left and right
        const rotationTween = this.tweens.add({
            targets: sprite,
            angle: { from: -swayAngle, to: swayAngle },
            duration: swayDuration,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: baseDelay
        });

        // Scale tween - very subtle breathing effect
        const scaleTween = this.tweens.add({
            targets: sprite,
            scaleX: scaleFactor,
            scaleY: scaleFactor,
            duration: swayDuration * 0.8,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: baseDelay + 200
        });

        // Store tweens for cleanup
        const existingTweens = this.windEffectTweens.get(cropKey) || [];
        existingTweens.push(rotationTween, scaleTween);
        this.windEffectTweens.set(cropKey, existingTweens);
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
            this.toggleNPCInventory();
        });

        // Hover effects
        this.settingsIcon.on('pointerover', () => {
            this.settingsIcon.setScale(0.035);
        });

        this.settingsIcon.on('pointerout', () => {
            this.settingsIcon.setScale(0.03);
        });
    }

    private toggleNPCInventory(): void {
        const uiScene = this.scene.get(SCENE_KEYS.UI) as any;
        if (uiScene) {
            uiScene.toggleNPCTrade();
        }
    }


    // ===== MARKETPLACE METHODS =====

    private checkMarketplaceProximity(): void {
        if (!this.player) return;

        // Marketplace location (center of market building)
        const marketplaceX = 696;
        const marketplaceY = 320;

        const distance = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            marketplaceX, marketplaceY
        );

        const proximityRange = 100;

        if (distance < proximityRange && !this.isNearMarketplace) {
            this.isNearMarketplace = true;
            this.showMarketplaceIcon();
        } else if (distance >= proximityRange && this.isNearMarketplace) {
            this.isNearMarketplace = false;
            this.hideMarketplaceIcon();
        }
    }

    private showMarketplaceIcon(): void {
        if (!this.marketplaceIcon) {
            this.createMarketplaceIcon();
        }
        this.marketplaceIcon.setVisible(true);
    }

    private hideMarketplaceIcon(): void {
        if (this.marketplaceIcon) {
            this.marketplaceIcon.setVisible(false);
        }
    }

    private createMarketplaceIcon(): void {
        // Create marketplace icon above the building
        this.marketplaceIcon = this.add.image(696, 280, 'marketplace');
        this.marketplaceIcon.setScale(0.15); // Scale down the marketplace image
        this.marketplaceIcon.setDepth(2000);
        this.marketplaceIcon.setInteractive();
        this.marketplaceIcon.setVisible(false);

        // Click handler
        this.marketplaceIcon.on('pointerdown', () => {
            this.openMarketplace();
        });

        // Hover effects
        this.marketplaceIcon.on('pointerover', () => {
            this.marketplaceIcon.setScale(0.17);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        this.marketplaceIcon.on('pointerout', () => {
            this.marketplaceIcon.setScale(0.15);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        // Add bounce animation
        this.tweens.add({
            targets: this.marketplaceIcon,
            y: 270,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

          }

    private openMarketplace(): void {
        const uiScene = this.scene.get(SCENE_KEYS.UI) as UIScene;
        if (uiScene) {
            uiScene.showMarketplace();
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

        // Check for overlap and adjust transparency
        this.checkAndHandleBubbleOverlap();
    }

    private checkAndHandleBubbleOverlap(): void {
        const playerBubble = this.player.getData('chatBubble');
        
        // Only check if both bubbles are active and visible
        if (!playerBubble || !playerBubble.active || !this.chatBubble || !this.chatBubble.active || !this.chatBubble.visible) {
            // Reset alpha if no overlap check needed
            if (playerBubble && playerBubble.active) {
                playerBubble.setAlpha(1);
            }
            if (this.chatBubble && this.chatBubble.active) {
                this.chatBubble.setAlpha(1);
            }
            return;
        }

        // Calculate distance between bubbles
        const distance = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.npc.x, this.npc.y
        );

        // If characters are close (within 100 pixels), bubbles might overlap
        if (distance < 100) {
            // Make NPC bubble transparent so player bubble is always fully visible
            playerBubble.setAlpha(1);
            this.chatBubble.setAlpha(0.7);
        } else {
            // No overlap, restore full opacity
            playerBubble.setAlpha(1);
            this.chatBubble.setAlpha(1);
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

        // Create crops layer for backward compatibility (kept for any existing code)
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

        // Add colliders for enemies
        this.enemies.forEach(enemy => {
            if (enemy && enemy.active) {
                this.physics.add.collider(enemy, collisionGroup);
            }
        });

        // Add overlap detection between player and enemies (for damage)
        this.physics.add.overlap(this.player, this.enemies as any, this.handlePlayerEnemyCollision as any, undefined, this);

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

        // Watering animations (using player_actions sprite sheet)
        // Frame 18-19: watering face down, 20-21: face up, 22-23: face side
        this.anims.create({
            key: 'water-down',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 18, end: 19 }),
            frameRate: 8,
            repeat: 0
        });
        this.anims.create({
            key: 'water-up',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 20, end: 21 }),
            frameRate: 8,
            repeat: 0
        });
        this.anims.create({
            key: 'water-left',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 22, end: 23 }),
            frameRate: 8,
            repeat: 0
        });
        this.anims.create({
            key: 'water-right',
            frames: this.anims.generateFrameNumbers('player_actions', { start: 22, end: 23 }),
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

    private createEnemyAnimations(): void {
        // Skeleton animations (192x320, 6 rows x 10 columns, 32x32 per frame)
        // Row 1 (frames 0-9): idle face down
        this.anims.create({
            key: 'skeleton-idle-down',
            frames: this.anims.generateFrameNumbers('skeleton', { start: 0, end: 5 }),
            frameRate: 8,
            repeat: -1
        });

        // Row 2 (frames 10-19): idle face side
        this.anims.create({
            key: 'skeleton-idle-side',
            frames: this.anims.generateFrameNumbers('skeleton', { start: 6, end: 11 }),
            frameRate: 8,
            repeat: -1
        });

        // Row 3 (frames 20-29): idle face up
        this.anims.create({
            key: 'skeleton-idle-up',
            frames: this.anims.generateFrameNumbers('skeleton', { start: 12, end: 17 }),
            frameRate: 8,
            repeat: -1
        });

        // Row 4 (frames 30-39): walk face down
        this.anims.create({
            key: 'skeleton-walk-down',
            frames: this.anims.generateFrameNumbers('skeleton', { start: 18, end: 23 }),
            frameRate: 10,
            repeat: -1
        });

        // Row 5 (frames 40-49): walk face side
        this.anims.create({
            key: 'skeleton-walk-side',
            frames: this.anims.generateFrameNumbers('skeleton', { start: 24, end: 29 }),
            frameRate: 10,
            repeat: -1
        });

        // Row 6 (frames 50-59): walk face up
        this.anims.create({
            key: 'skeleton-walk-up',
            frames: this.anims.generateFrameNumbers('skeleton', { start: 30, end: 35 }),
            frameRate: 10,
            repeat: -1
        });

        // Row 7 (frames 60-63): dead (only 4 frames)
        this.anims.create({
            key: 'skeleton-dead',
            frames: this.anims.generateFrameNumbers('skeleton', { start: 36, end: 39 }),
            frameRate: 6,
            repeat: 0
        });

        // Slime animations (512x192, 3 rows x 8 columns, 64x64 per frame)
        // Frames 0-3: idle
        this.anims.create({
            key: 'slime-idle',
            frames: this.anims.generateFrameNumbers('slime', { start: 0, end: 3 }),
            frameRate: 6,
            repeat: -1
        });

        // Frames 8-15: jumping (moving)
        this.anims.create({
            key: 'slime-jump',
            frames: this.anims.generateFrameNumbers('slime', { start: 8, end: 15 }),
            frameRate: 8,
            repeat: -1
        });

        // Frames 16-23: dead
        this.anims.create({
            key: 'slime-dead',
            frames: this.anims.generateFrameNumbers('slime', { start: 16, end: 23 }),
            frameRate: 8,
            repeat: 0
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
        // Spawn chickens in left animalground areas (columns 1-7, rows 10-15 and 17-22)
        const chickenCount = Phaser.Math.Between(12, 16);

        for (let i = 0; i < chickenCount; i++) {
            let x, y;

            // Distribute between upper and lower left pens
            if (i < chickenCount / 2) {
                // Upper pen: rows 10-15 with 1-tile padding
                x = Phaser.Math.Between(32, 96);    // columns 2-6 (1-tile padding from edges)
                y = Phaser.Math.Between(176, 224); // rows 11-14 (1-tile padding from edges)
            } else {
                // Lower pen: rows 17-22 with 1-tile padding
                x = Phaser.Math.Between(32, 96);    // columns 2-6 (1-tile padding from edges)
                y = Phaser.Math.Between(288, 336); // rows 18-21 (1-tile padding from edges)
            }

            const chicken = this.physics.add.sprite(x, y, 'chicken', 0);
            chicken.setScale(1.5);
            chicken.play('chicken-idle');
            chicken.setDepth(100);

            // Add health data to chicken
            chicken.setData('health', 3);
            chicken.setData('maxHealth', 3);
            chicken.setData('fenceBounds', { minX: 32, maxX: 96, minY: 176, maxY: 336 });

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
        // Spawn cows in middle animalground areas (columns 9-15, rows 10-15 and 17-22)
        const cowCount = Phaser.Math.Between(12, 16);

        for (let i = 0; i < cowCount; i++) {
            let x, y;

            // Distribute between upper and lower middle pens
            if (i < cowCount / 2) {
                // Upper pen: rows 10-15 with 1-tile padding
                x = Phaser.Math.Between(160, 224); // columns 10-14 (1-tile padding from edges)
                y = Phaser.Math.Between(176, 224); // rows 11-14 (1-tile padding from edges)
            } else {
                // Lower pen: rows 17-22 with 1-tile padding
                x = Phaser.Math.Between(160, 224); // columns 10-14 (1-tile padding from edges)
                y = Phaser.Math.Between(288, 336); // rows 18-21 (1-tile padding from edges)
            }

            const cow = this.physics.add.sprite(x, y, 'cow', 0);
            cow.setScale(1.5);
            cow.play('cow-idle');
            cow.setDepth(100);

            // Add health data to cow
            cow.setData('health', 5);
            cow.setData('maxHealth', 5);
            cow.setData('fenceBounds', { minX: 160, maxX: 224, minY: 176, maxY: 336 });

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
        // Since chickens already use left pens and cows use middle pens,
        // distribute sheep across both left and middle pens as well
        const sheepCount = Phaser.Math.Between(12, 16);

        for (let i = 0; i < sheepCount; i++) {
            let x = 200; // Default position
            let y = 200; // Default position

            // Distribute across all 4 pens
            const penType = i % 4;

            switch (penType) {
                case 0: // Upper left pen with 1-tile padding
                    x = Phaser.Math.Between(32, 96);    // columns 2-6
                    y = Phaser.Math.Between(176, 224); // rows 11-14
                    break;
                case 1: // Lower left pen with 1-tile padding
                    x = Phaser.Math.Between(32, 96);    // columns 2-6
                    y = Phaser.Math.Between(288, 336); // rows 18-21
                    break;
                case 2: // Upper middle pen with 1-tile padding
                    x = Phaser.Math.Between(160, 224); // columns 10-14
                    y = Phaser.Math.Between(176, 224); // rows 11-14
                    break;
                case 3: // Lower middle pen with 1-tile padding
                    x = Phaser.Math.Between(160, 224); // columns 10-14
                    y = Phaser.Math.Between(288, 336); // rows 18-21
                    break;
                default: // Fallback to upper left pen with 1-tile padding
                    x = Phaser.Math.Between(32, 96);
                    y = Phaser.Math.Between(176, 224);
                    break;
            }

            const sheep = this.physics.add.sprite(x, y, 'sheep', 0);
            sheep.setScale(1.5);
            sheep.play('sheep-idle');
            sheep.setDepth(100);

            // Add health data to sheep with larger bounds to cover all pens (with padding)
            sheep.setData('health', 3);
            sheep.setData('maxHealth', 3);
            sheep.setData('fenceBounds', { minX: 32, maxX: 224, minY: 176, maxY: 336 });

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

    private createRandomAnimals(): void {
        // Spawn random animals at random positions across the map
        const totalAnimals = Phaser.Math.Between(8, 15); // Random number of animals
        const mapWidth = this.map.widthInPixels;
        const mapHeight = this.map.heightInPixels;
        
        for (let i = 0; i < totalAnimals; i++) {
            // Random position on the map (avoiding edges)
            const x = Phaser.Math.Between(100, mapWidth - 100);
            const y = Phaser.Math.Between(100, mapHeight - 100);
            
            // Randomly choose animal type: 0 = chicken, 1 = cow, 2 = sheep
            const animalType = Phaser.Math.Between(0, 2);
            
            if (animalType === 0) {
                // Create chicken
                const chicken = this.physics.add.sprite(x, y, 'chicken', 0);
                chicken.setScale(1.5);
                chicken.play('chicken-idle');
                chicken.setDepth(100);
                chicken.setData('health', 3);
                chicken.setData('maxHealth', 3);
                chicken.setData('fenceBounds', { 
                    minX: x - 100, maxX: x + 100, 
                    minY: y - 100, maxY: y + 100 
                });
                this.chickens.push(chicken);
                
                const movementTimer = this.time.addEvent({
                    delay: Phaser.Math.Between(2000, 4000),
                    callback: () => this.moveAnimalRandomly(chicken, 'chicken'),
                    loop: true
                });
                chicken.setData('movementTimer', movementTimer);
                
            } else if (animalType === 1) {
                // Create cow
                const cow = this.physics.add.sprite(x, y, 'cow', 0);
                cow.setScale(1.5);
                cow.play('cow-idle');
                cow.setDepth(100);
                cow.setData('health', 5);
                cow.setData('maxHealth', 5);
                cow.setData('fenceBounds', { 
                    minX: x - 100, maxX: x + 100, 
                    minY: y - 100, maxY: y + 100 
                });
                this.cows.push(cow);
                
                const movementTimer = this.time.addEvent({
                    delay: Phaser.Math.Between(2000, 4000),
                    callback: () => this.moveAnimalRandomly(cow, 'cow'),
                    loop: true
                });
                cow.setData('movementTimer', movementTimer);
                
            } else {
                // Create sheep
                const sheep = this.physics.add.sprite(x, y, 'sheep', 0);
                sheep.setScale(1.5);
                sheep.play('sheep-idle');
                sheep.setDepth(100);
                sheep.setData('health', 3);
                sheep.setData('maxHealth', 3);
                sheep.setData('fenceBounds', { 
                    minX: x - 100, maxX: x + 100, 
                    minY: y - 100, maxY: y + 100 
                });
                this.sheep.push(sheep);
                
                const movementTimer = this.time.addEvent({
                    delay: Phaser.Math.Between(2000, 4000),
                    callback: () => this.moveAnimalRandomly(sheep, 'sheep'),
                    loop: true
                });
                sheep.setData('movementTimer', movementTimer);
            }
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

    private createEnemies(): void {
        // Spawn some skeletons in different areas of the map
        // Skeleton 1 - Near the right side of map
        const skeleton1 = new Enemy(this, 600, 300, 'skeleton', 'skeleton', 30, 10, 50);
        this.enemies.push(skeleton1);

        // Skeleton 2 - Lower area
        const skeleton2 = new Enemy(this, 500, 500, 'skeleton', 'skeleton', 30, 10, 50);
        this.enemies.push(skeleton2);

        // Spawn some slimes
        // Slime 1 - Upper right
        const slime1 = new Enemy(this, 650, 200, 'slime', 'slime', 20, 5, 30);
        this.enemies.push(slime1);

        // Slime 2 - Lower left
        const slime2 = new Enemy(this, 250, 550, 'slime', 'slime', 20, 5, 30);
        this.enemies.push(slime2);

        // Slime 3 - Middle area
        const slime3 = new Enemy(this, 450, 350, 'slime', 'slime', 20, 5, 30);
        this.enemies.push(slime3);
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
        this.harvestKey = this.input.keyboard!.addKey('H');
        this.collectKey = this.input.keyboard!.addKey('C');
        this.marketplaceKey = this.input.keyboard!.addKey('M');

        this.escKey.on('down', () => {
            if (this.isChatting) {
                this.endChat();
            }
            // ESC key now only handles closing chat - UI modals are handled by UIScene
            // Exit to menu is handled by a dedicated button
        });

        this.spaceKey.on('down', () => this.tryStartChat());
        this.cutKey.on('down', () => this.tryCutTree());
        this.harvestKey.on('down', () => this.tryHarvestCrop());
        this.collectKey.on('down', () => this.tryCollectCarrots());
        this.marketplaceKey.on('down', () => this.openMarketplace());
       this.waterKey = this.input.keyboard!.addKey('T');
        this.waterKey.on('down', () => this.tryWater());
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
        // Check if scene is active and map exists
        if (!this.scene.isActive() || !this.map) return;
        
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
        // Don't move if dead
        if (this.isDead) {
            this.player.setVelocity(0, 0);
            return;
        }

        // Disable movement if marketplace or backpack is open
        const uiScene = this.scene.get(SCENE_KEYS.UI) as any;
        if (uiScene && (uiScene.isMarketplaceOpen() || uiScene.isBackpackOpen())) {
            this.player.setVelocity(0, 0);
            return;
        }

        // Don't move if cutting
        if (this.isCutting) {
            this.player.setVelocity(0, 0);
            return;
        }

        // Don't move if watering
        if (this.isWatering) {
            this.player.setVelocity(0, 0);
            return;
        }

        // Check if attack key is being held down
        if (this.attackKey.isDown) {
            this.handleAttack();
            return;
        }

        const left = this.wasd.left.isDown;
        const right = this.wasd.right.isDown;
        const up = this.wasd.up.isDown;
        const down = this.wasd.down.isDown;
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

    private handlePlayerEnemyCollision(
        player: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile,
        enemy: Phaser.GameObjects.GameObject | Phaser.Tilemaps.Tile
    ): void {
        // Don't take damage if already dead
        if (this.isDead) {
            return;
        }

        const enemySprite = enemy as Enemy;
        
        // Check if enemy is dead
        if (enemySprite.getIsDead()) {
            return;
        }

        // Check invincibility timer
        const currentTime = this.time.now;
        if (currentTime - this.lastDamageTime < this.damageInvincibilityDuration) {
            return;
        }

        // Apply damage to player
        const damage = enemySprite.getDamage();
        this.playerCurrentHp -= damage;
        this.lastDamageTime = currentTime;
        
        // Update React HUD
        this.hudBridge.setHealth(this.playerCurrentHp);
        this.hudBridge.notifyWarning('Damage Taken', `-${damage} HP`, 2000);

        // Flash player red
        this.player.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            this.player.clearTint();
        });

        // Update UI with player HP
        EventBus.emit('player-hp-changed', {
            current: this.playerCurrentHp,
            max: this.playerMaxHp
        });

        console.log(`Player hit! HP: ${this.playerCurrentHp}/${this.playerMaxHp}`);

        // Check if player died
        if (this.playerCurrentHp <= 0 && !this.isDead) {
            this.handlePlayerDeath();
        }

        // Knockback effect
        const knockbackSpeed = 200;
        const angle = Phaser.Math.Angle.Between(
            enemySprite.x,
            enemySprite.y,
            this.player.x,
            this.player.y
        );
        this.player.setVelocity(
            Math.cos(angle) * knockbackSpeed,
            Math.sin(angle) * knockbackSpeed
        );
    }

    private handlePlayerDeath(): void {
        console.log('Player died!');
        this.playerCurrentHp = 0;
        this.isDead = true;
        
        // Stop player movement
        this.player.setVelocity(0, 0);
        
        // Play dead animation
        this.player.play('dead', true);
        
        // Wait for death animation to complete before respawning
        this.player.once('animationcomplete', () => {
            // Respawn after animation completes
            this.isDead = false;
            this.playerCurrentHp = this.playerMaxHp;
            this.player.setPosition(400, 400); // Respawn at starting position
            this.player.play('idle-down');
            
            // Update UI
            EventBus.emit('player-hp-changed', {
                current: this.playerCurrentHp,
                max: this.playerMaxHp
            });
            
            console.log('Player respawned!');
        });
    }

    private handleInteraction(): void {
        this.interactKey.on('down', () => {
            const playerTileX = this.farmingLayer.worldToTileX(this.player.x);
            const playerTileY = this.farmingLayer.worldToTileY(this.player.y);
            const radius = 2;

            for (let y = playerTileY - radius; y <= playerTileY + radius; y++) {
                for (let x = playerTileX - radius; x <= playerTileX + radius; x++) {
                    const targetTile = this.farmingLayer.getTileAt(x, y);
                    const existingCrop = this.crops.get(`${x},${y}`);

                    // Check if the tile is tilled soil and has no crop sprite
                    if (targetTile && this.farmableTileIndices.has(targetTile.index) && !existingCrop) {
                        // Plant a carrot crop and immediately stop searching
                        this.plantCarrot(x, y);
                        return;
                    }
                }
            }
        });
    }

    private setupTransactionNotifications(): void {
        // Listen for NPC trade completion
        EventBus.on('npc-trade-completed', this.handleNPCTradeCompletedNotification.bind(this));

        // Listen for transaction details requests (to potentially show in-game hints)
        EventBus.on('show-transaction-details', this.handleTransactionDetailsRequest.bind(this));
    }

    private handleNPCTradeCompletedNotification(transaction: import('../../types/onechain').TransactionDetails): void {
        const itemCount = transaction.itemsTraded.playerItems.length + transaction.itemsTraded.npcItems.length;
        const message = `✅ Trade with Herman completed! ${itemCount} items exchanged`;

        this.showTransactionNotification(message, 'success', 3000);
    }

    private handleTransactionDetailsRequest(transaction: import('../../types/onechain').TransactionDetails): void {
        // Could show a subtle in-game hint or notification
        const message = `📄 Transaction details available: ${transaction.transactionHash.substring(0, 10)}...`;
        this.showTransactionNotification(message, 'info', 2000);
    }

    private showTransactionNotification(message: string, type: 'success' | 'info' | 'warning', duration: number): void {
        // Add to queue
        this.transactionNotificationQueue.push({
            message,
            type,
            duration
        });

        // Process queue if not already showing
        if (!this.isShowingNotification) {
            this.processNotificationQueue();
        }
    }

    private processNotificationQueue(): void {
        if (this.transactionNotificationQueue.length === 0) {
            this.isShowingNotification = false;
            return;
        }

        this.isShowingNotification = true;
        const notification = this.transactionNotificationQueue.shift()!;
        const { message, type, duration } = notification;

        // Create notification container
        this.notificationContainer = this.add.container(
            this.cameras.main.width / 2,
            100 // Position at top of screen
        );
        this.notificationContainer.setScrollFactor(0);
        this.notificationContainer.setDepth(30000);

        // Create background
        this.currentNotificationBackground = this.add.graphics();
        this.currentNotificationBackground.fillStyle(0x1a1a1a, 0.9);
        this.currentNotificationBackground.fillRoundedRect(-200, -25, 400, 50, 8);

        // Add colored border based on type
        const borderColor = type === 'success' ? 0x10b981 : type === 'warning' ? 0xf59e0b : 0x3b82f6;
        this.currentNotificationBackground.lineStyle(3, borderColor, 1);
        this.currentNotificationBackground.strokeRoundedRect(-200, -25, 400, 50, 8);

        this.notificationContainer.add(this.currentNotificationBackground);

        // Create text
        this.currentNotificationText = this.add.text(0, 0, message, {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: 350 }
        });
        this.currentNotificationText.setOrigin(0.5);
        this.notificationContainer.add(this.currentNotificationText);

        // Animate in
        this.notificationContainer.setAlpha(0);
        this.notificationContainer.setY(50);

        this.tweens.add({
            targets: this.notificationContainer,
            alpha: 1,
            y: 100,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // Wait for duration, then animate out
                this.time.delayedCall(duration, () => {
                    this.tweens.add({
                        targets: this.notificationContainer,
                        alpha: 0,
                        y: 50,
                        duration: 300,
                        ease: 'Power2',
                        onComplete: () => {
                            // Clean up
                            if (this.notificationContainer) {
                                this.notificationContainer.destroy();
                                this.notificationContainer = undefined;
                                this.currentNotificationBackground = undefined;
                                this.currentNotificationText = undefined;
                            }

                            // Process next notification
                            this.processNotificationQueue();
                        }
                    });
                });
            }
        });
    }

    private plantCarrot(tileX: number, tileY: number): void {
        const cropKey = `${tileX},${tileY}`;

        // Create the crop object
        const crop: Crop = {
            x: tileX,
            y: tileY,
            growthStage: 0,
            type: 'carrot',
            plantedTime: this.time.now
        };

        // Store the crop
        this.crops.set(cropKey, crop);

        // Calculate world position (tile center + half tile offset)
        const worldX = tileX * 16 + 8;
        const worldY = tileY * 16 + 8;

        // Create initial seed sprite (stage 0) using carrot stage 1 sprite
        console.log('Creating carrot seed sprite with key: carrot_stage1, exists:', this.textures.exists('carrot_stage1'));
        const seedSprite = this.add.sprite(worldX, worldY, 'carrot_stage1');
        seedSprite.setOrigin(0.5, 1); // Center bottom
        seedSprite.setDepth(tileY); // Z-order based on row position, same level as tiles

        // No wind effect on seed stage

        // Store sprite for this crop
        this.cropSprites.set(cropKey, [seedSprite]);

        // Start growth timer for stage 1 (after 5 seconds)
        const growthTimer1 = this.time.delayedCall(5000, () => {
            this.growCarrot(cropKey, 1);
        });

        this.cropGrowthTimers.set(cropKey + '_stage1', growthTimer1);
    }

    private growCarrot(cropKey: string, newStage: number): void {
        const crop = this.crops.get(cropKey);
        if (!crop) return;

        const existingSprites = this.cropSprites.get(cropKey);
        if (!existingSprites) return;

        crop.growthStage = newStage;

        // Clean up existing wind effect tweens
        const existingTweens = this.windEffectTweens.get(cropKey);
        if (existingTweens) {
            existingTweens.forEach(tween => {
                if (tween && tween.isPlaying()) {
                    tween.remove();
                }
            });
            this.windEffectTweens.delete(cropKey);
        }

        // Remove existing sprites and text
        existingSprites.forEach(obj => {
            if (obj && obj.active) {
                obj.destroy();
            }
        });

        // Calculate world positions for new sprites
        const worldX = crop.x * 16 + 8;
        const worldY = crop.y * 16 + 8;

        const newSprites: Phaser.GameObjects.GameObject[] = [];

        switch (newStage) {
            case 1:
                // Growing stage (5 seconds): use carrot stage 2 sprite
                const growingSprite = this.add.sprite(worldX, worldY, 'carrot_stage2');
                growingSprite.setOrigin(0.5, 1); // Center bottom
                growingSprite.setDepth(crop.y); // Same level as tiles

                // Apply wind effect to growing crop
                this.applyWindEffect(growingSprite, cropKey);

                newSprites.push(growingSprite);

                // Start timer for stage 2 (after another 5 seconds)
                const growthTimer2 = this.time.delayedCall(5000, () => {
                    this.growCarrot(cropKey, 2);
                });
                this.cropGrowthTimers.set(cropKey + '_stage2', growthTimer2);
                break;

            case 2:
                // Fully grown stage (10 seconds total): use carrot stage 3 sprite
                const matureSprite = this.add.sprite(worldX, worldY, 'carrot_stage3');
                matureSprite.setOrigin(0.5, 1); // Center bottom
                matureSprite.setDepth(crop.y); // Same level as tiles

                // Apply wind effect to mature crop
                this.applyWindEffect(matureSprite, cropKey);

                newSprites.push(matureSprite);
                break;
        }

        // Store new sprites
        this.cropSprites.set(cropKey, newSprites);
    }

    private updatePlayerAnimation(isRunning: boolean): void {
        // Don't update animation if dead or attacking
        if (this.isDead || this.isAttacking) {
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

        // Add screen shake effect
        this.cameras.main.shake(120, 0.002);

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

        // Check enemies
        this.enemies.forEach(enemy => {
            if (!enemy.active || enemy.getIsDead()) return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );

            if (distance < attackRange) {
                enemy.takeDamage(10); // Player deals 10 damage per attack
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
            this.cameras.main.shake(120, 0.002);
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

    private tryWater(): void {
        if (this.isWatering || this.isChatting || this.isCutting || this.isAttacking) return;

        // Perform watering action
        this.waterPlant();
    }

    private waterPlant(): void {
        this.isWatering = true;
        this.player.setVelocity(0, 0);

        // Switch to player_actions texture and play watering animation
        this.player.setTexture('player_actions', 0);
        const waterAnim = `water-${this.currentDirection}`;
        this.player.play(waterAnim, false);

        // Listen for animation complete
        this.player.once('animationcomplete', () => {
            this.isWatering = false;
            this.player.setTexture('player', 0);
            this.player.play(`idle-${this.currentDirection}`, true);
        });
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
        // Create chatbox indicator image beside player's head (closer to character)
        const chatboxIndicator = this.add.image(this.player.x + 5, this.player.y - 5, 'chatbox');
        chatboxIndicator.setScale(0.25); // Small indicator
        chatboxIndicator.setDepth(2000);
        this.player.setData('chatboxIndicator', chatboxIndicator);

        // Create player's chat bubble with modern rounded design
        const playerBubble = this.add.container(this.player.x, this.player.y - 35);
        playerBubble.setDepth(2000);

        // Create player bubble background (will be drawn after text is set)
        const playerBubbleGraphics = this.add.graphics();
        playerBubbleGraphics.setName('playerBubbleBackground');

        this.chatText = this.add.text(
            0,
            0,
            '',
            {
                fontSize: '11px',
                color: '#2c3e50',
                fontFamily: 'Arial, sans-serif',
                wordWrap: { width: 140 },
                resolution: 3,
                align: 'center'
            }
        );
        this.chatText.setOrigin(0.5, 0.5);

        playerBubble.add([playerBubbleGraphics, this.chatText]);
        this.player.setData('chatBubble', playerBubble);

        // Create NPC's chat bubble (hidden initially) with modern rounded design
        this.chatBubble = this.add.container(this.npc.x, this.npc.y - 50);
        this.chatBubble.setDepth(2000);
        this.chatBubble.setVisible(false);

        // Create NPC bubble background
        const npcBubbleGraphics = this.add.graphics();
        npcBubbleGraphics.setName('npcBubbleBackground');

        this.npcResponse = this.add.text(
            0,
            0,
            'Deal!',
            {
                fontSize: '11px',
                color: '#2c3e50',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                wordWrap: { width: 160 },
                resolution: 3,
                align: 'center'
            }
        );
        this.npcResponse.setOrigin(0.5, 0.5);

        this.chatBubble.add([npcBubbleGraphics, this.npcResponse]);
        
        // Draw initial NPC bubble
        this.updateChatBubbleBackground(this.chatBubble, this.npcResponse, false);
    }

    private updateChatBubbleBackground(container: Phaser.GameObjects.Container, textObj: Phaser.GameObjects.Text, isPlayer: boolean): void {
        const graphics = container.getByName(isPlayer ? 'playerBubbleBackground' : 'npcBubbleBackground') as Phaser.GameObjects.Graphics;
        if (!graphics) return;

        const padding = 12;
        
        // Force text to update its bounds
        textObj.updateText();
        
        // Get actual text dimensions
        const textWidth = textObj.width;
        const textHeight = textObj.height;
        
        const bubbleWidth = Math.max(70, textWidth + padding * 2);
        const bubbleHeight = Math.max(35, textHeight + padding * 2);

        graphics.clear();
        
        // Soft shadow
        graphics.fillStyle(0x000000, 0.15);
        graphics.fillRect(
            -bubbleWidth / 2 + 2,
            -bubbleHeight / 2 + 2,
            bubbleWidth,
            bubbleHeight
        );

        // Main bubble background
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(
            -bubbleWidth / 2,
            -bubbleHeight / 2,
            bubbleWidth,
            bubbleHeight
        );

        // Border
        graphics.lineStyle(2, 0xe0e0e0, 1);
        graphics.strokeRect(
            -bubbleWidth / 2,
            -bubbleHeight / 2,
            bubbleWidth,
            bubbleHeight
        );

        // Bubble tail (small triangle pointing to character)
        const tailSize = 8;
        const tailY = bubbleHeight / 2;
        
        graphics.fillStyle(0xffffff, 1);
        graphics.fillTriangle(
            -tailSize / 2, tailY,
            tailSize / 2, tailY,
            0, tailY + tailSize
        );
        
        // Tail border
        graphics.lineStyle(2, 0xe0e0e0, 1);
        graphics.strokeTriangle(
            -tailSize / 2, tailY,
            tailSize / 2, tailY,
            0, tailY + tailSize
        );
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
            // Update player bubble background to fit new text
            const playerBubble = this.player.getData('chatBubble');
            if (playerBubble) {
                this.updateChatBubbleBackground(playerBubble, this.chatText, true);
            }
        }
    }

    private async sendMessage(): Promise<void> {
        if (this.playerInput.trim().length === 0) return;

        const userMessage = this.playerInput.trim();

        // Show the final message in player's bubble
        this.chatText.setText(userMessage);
        
        // Update player bubble background for final message
        const playerBubble = this.player.getData('chatBubble');
        if (playerBubble) {
            this.updateChatBubbleBackground(playerBubble, this.chatText, true);
        }

        // Hide chatbox indicator (stop showing typing icon)
        const chatboxIndicator = this.player.getData('chatboxIndicator');
        if (chatboxIndicator) {
            chatboxIndicator.setVisible(false);
        }

        // Allow player to move again
        this.isChatting = false;

        // Show NPC is "thinking" with typing indicator
        this.time.delayedCall(500, async () => {
            this.chatBubble.setVisible(true);
            this.npcResponse.setText('...');
            this.updateChatBubbleBackground(this.chatBubble, this.npcResponse, false);

            try {
                // Get AI response from OpenRouter
                const aiResponse = await this.openRouterService.sendMessage(userMessage);
                
                // Update NPC response text
                this.npcResponse.setText(aiResponse);
                
                // Update NPC bubble background to fit response
                this.updateChatBubbleBackground(this.chatBubble, this.npcResponse, false);

                // Close chat after showing response
                this.time.delayedCall(5000, () => {
                    this.endChat();
                });
            } catch (error) {
                console.error('Error getting AI response:', error);
                this.npcResponse.setText('Hmm, let me think about that...');
                this.updateChatBubbleBackground(this.chatBubble, this.npcResponse, false);
                
                this.time.delayedCall(3000, () => {
                    this.endChat();
                });
            }
        });
    }

    private endChat(): void {
        this.isChatting = false;
        this.playerInput = '';

        // Hide and destroy chatbox indicator
        const chatboxIndicator = this.player.getData('chatboxIndicator');
        if (chatboxIndicator && chatboxIndicator.active) {
            chatboxIndicator.setVisible(false);
            chatboxIndicator.destroy();
            this.player.setData('chatboxIndicator', null);
        }

        // Hide and destroy player chat bubble
        const playerBubble = this.player.getData('chatBubble');
        if (playerBubble && playerBubble.active) {
            playerBubble.setVisible(false);
            playerBubble.destroy();
            this.player.setData('chatBubble', null);
        }

        // Hide and destroy NPC chat bubble
        if (this.chatBubble && this.chatBubble.active) {
            this.chatBubble.setVisible(false);
            this.chatBubble.destroy();
        }

        // Resume NPC patrol only after everything is cleaned up
        this.time.delayedCall(100, () => {
            if (this.npc && this.npc.active) {
                this.npc.setData('patrolPaused', false);
            }
        });
    }

    private exitFarm(): void {
        this.cameras.main.fadeOut(500, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Stop background music
            if (this.bgMusic) {
                this.bgMusic.stop();
            }
            // Stop UI scene
            this.scene.stop(SCENE_KEYS.UI);
            // Stop this scene and start world selection
            this.scene.stop();
            this.scene.start('WorldSelectionScene');
        });
    }

    private tryHarvestCrop(): void {
        if (this.isHarvesting || this.isChatting || this.isCutting) return;

        const playerTileX = Math.floor(this.player.x / 16);
        const playerTileY = Math.floor(this.player.y / 16);
        const radius = 2;

        // Find nearest mature carrot
        for (let y = playerTileY - radius; y <= playerTileY + radius; y++) {
            for (let x = playerTileX - radius; x <= playerTileX + radius; x++) {
                const cropKey = `${x},${y}`;
                const crop = this.crops.get(cropKey);

                if (crop && crop.growthStage === 2) {
                    this.harvestCarrot(cropKey, crop);
                    return;
                }
            }
        }
        
        // No mature carrots found nearby - show feedback
        this.showHarvestFeedback('No mature carrots nearby!');
    }

    private harvestCarrot(cropKey: string, crop: Crop): void {
        this.isHarvesting = true;

        // Get crop sprites and remove them
        const sprites = this.cropSprites.get(cropKey);
        if (sprites) {
            sprites.forEach(sprite => {
                if (sprite && sprite.active) {
                    sprite.destroy();
                }
            });
            this.cropSprites.delete(cropKey);
        }

        // Clean up wind effects
        const tweens = this.windEffectTweens.get(cropKey);
        if (tweens) {
            tweens.forEach(tween => {
                if (tween && tween.isPlaying()) {
                    tween.remove();
                }
            });
            this.windEffectTweens.delete(cropKey);
        }

        // Clean up timers
        const timer1 = this.cropGrowthTimers.get(cropKey + '_stage1');
        const timer2 = this.cropGrowthTimers.get(cropKey + '_stage2');
        if (timer1) timer1.destroy();
        if (timer2) timer2.destroy();
        this.cropGrowthTimers.delete(cropKey + '_stage1');
        this.cropGrowthTimers.delete(cropKey + '_stage2');

        // Remove crop from map
        this.crops.delete(cropKey);

        // Create floating dropped carrot
        const worldX = crop.x * 16 + 8 + Phaser.Math.Between(-4, 4);
        const worldY = crop.y * 16 + 8 + Phaser.Math.Between(-4, 4);
        
        const droppedCarrot = this.add.sprite(worldX, worldY, 'carrot_stage3');
        droppedCarrot.setScale(0.6);
        droppedCarrot.setOrigin(0.5, 1);
        droppedCarrot.setDepth(crop.y + 100);
        droppedCarrot.setData('spawnTime', this.time.now);
        droppedCarrot.setData('baseY', worldY);
        
        // Add glowing effect only
        droppedCarrot.setTint(0xffff99); // Slight yellow tint
        droppedCarrot.preFX?.addGlow(0xffd700, 4, 0, false, 0.3, 8); // Gold glow

        // Store dropped carrot
        const dropKey = `drop_${Date.now()}_${Math.random()}`;
        this.droppedCarrots.set(dropKey, droppedCarrot);
        this.harvestedCarrotCount++;
        
        // Notify HUD of harvest
        this.hudBridge.onCropHarvested('Carrot', 1);

        // Auto-mint carrot as NFT (lazy minting - background process)
        const autoMint = AutoMintService.getInstance();
        const carrotItemId = `carrot_${crop.x}_${crop.y}_${Date.now()}`;
        autoMint.autoMintItem({
            id: carrotItemId,
            name: 'Carrot',
            description: 'Freshly harvested carrot from OneValley farm',
            type: 'consumable',
            rarity: 1, // Common rarity
            stats: [5, 10], // Small health boost
        });
        droppedCarrot.setData('gameItemId', carrotItemId);

        // Play harvest animation - small pop up
        this.tweens.add({
            targets: droppedCarrot,
            y: worldY - 10,
            scale: 0.8,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: false
        });

        // Reset harvesting state
        this.time.delayedCall(300, () => {
            this.isHarvesting = false;
        });
    }

    private showHarvestFeedback(message: string): void {
        // Create floating feedback text near the player
        const headOffset = this.player.displayHeight ? this.player.displayHeight * 0.75 : 48;
        const startY = this.player.y - headOffset;
        const endY = startY - 20;

        const feedbackText = this.add.text(
            this.player.x,
            startY,
            message,
            {
                fontSize: '18px',
                color: '#ff6b6b',
                fontStyle: 'bold',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: { x: 10, y: 5 }
            }
        );
        feedbackText.setOrigin(0.5, 1);
        feedbackText.setScrollFactor(1);
        feedbackText.setDepth(this.player.depth + 5);

        const followEvent = this.time.addEvent({
            delay: 16,
            callback: () => {
                if (!feedbackText.active) {
                    followEvent.remove(false);
                    return;
                }
                feedbackText.setX(this.player.x);
            },
            loop: true
        });

        this.tweens.add({
            targets: feedbackText,
            y: endY,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                followEvent.remove(false);
                feedbackText.destroy();
            }
        });
    }

    private updateFloatingCarrots(): void {
        const currentTime = this.time.now;
        
        this.droppedCarrots.forEach((carrot, key) => {
            const spawnTime = carrot.getData('spawnTime');
            const baseY = carrot.getData('baseY');
            const elapsed = currentTime - spawnTime;
            
            // Floating animation
            const floatOffset = Math.sin(elapsed / 500) * 3;
            const newY = baseY - 10 + floatOffset;
            carrot.setY(newY);
        });
    }

    private createCollectButton(): void {
        // Create container for button
        this.collectButton = this.add.container(0, 0);
        this.collectButton.setScrollFactor(0);
        this.collectButton.setDepth(3500);
        this.collectButton.setVisible(false);

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x4a7c59, 0.9);
        bg.fillRoundedRect(-100, -20, 200, 40, 8);
        bg.lineStyle(2, 0xffffff, 0.8);
        bg.strokeRoundedRect(-100, -20, 200, 40, 8);

        // Button text
        this.collectButtonText = this.add.text(0, 0, 'Collect All (C)', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.collectButtonText.setOrigin(0.5);

        this.collectButton.add([bg, this.collectButtonText]);

        // Make interactive
        const hitArea = new Phaser.Geom.Rectangle(-100, -20, 200, 40);
        this.collectButton.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        this.collectButton.on('pointerdown', () => {
            this.tryCollectCarrots();
        });

        this.collectButton.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x5a8c69, 0.95);
            bg.fillRoundedRect(-100, -20, 200, 40, 8);
            bg.lineStyle(2, 0xffffff, 1);
            bg.strokeRoundedRect(-100, -20, 200, 40, 8);
        });

        this.collectButton.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x4a7c59, 0.9);
            bg.fillRoundedRect(-100, -20, 200, 40, 8);
            bg.lineStyle(2, 0xffffff, 0.8);
            bg.strokeRoundedRect(-100, -20, 200, 40, 8);
        });
    }

    private createMintModal(): void {
        if (this.mintModalCreated) return;
        this.mintModalCreated = true;

        // Create mint modal container (centered on screen)
        this.mintModalContainer = this.add.container(0, 0);
        this.mintModalContainer.setScrollFactor(0);
        this.mintModalContainer.setDepth(20000); // Above other UI elements
        this.mintModalContainer.setVisible(false);

        // Add dark overlay (following transaction details modal pattern)
        this.mintModalOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x0a0a0a,
            0.8
        );
        this.mintModalOverlay.setOrigin(0.5);
        this.mintModalOverlay.setScrollFactor(0);
        this.mintModalOverlay.setDepth(50);
        this.mintModalContainer.add(this.mintModalOverlay);

        // Modal dimensions and styling (make it very small)
        const modalWidth = 300; // Very small width
        const modalHeight = 200; // Very small height
        const padding = 15; // Smaller padding for compact modal
        const titleHeight = 40; // Smaller title height
        const closeButtonSize = 30; // Smaller close button

        // Create modal background
        const modalBg = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            modalWidth,
            modalHeight,
            0x2c3e50,
            0.98
        );
        modalBg.setStrokeStyle(3, 0x3498db);
        modalBg.setOrigin(0.5);
        modalBg.setScrollFactor(0);
        modalBg.setDepth(100);
        this.mintModalContainer.add(modalBg);

        // Add inner border for depth
        const innerBorder = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            modalWidth - 8,
            modalHeight - 8,
            0x34495e,
            0.4
        );
        innerBorder.setStrokeStyle(1, 0x5dade2);
        innerBorder.setOrigin(0.5);
        innerBorder.setScrollFactor(0);
        innerBorder.setDepth(101);
        this.mintModalContainer.add(innerBorder);

        // Add decorative top border
        const topBorder = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY - (modalHeight/2) + titleHeight/2,
            modalWidth - 40,
            4,
            0x2ecc71
        ).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        this.mintModalContainer.add(topBorder);

        // Title background panel
        const titlePanel = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY - (modalHeight/2) + titleHeight/2,
            modalWidth - 40,
            titleHeight,
            0x34495e,
            0.95
        ).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        titlePanel.setStrokeStyle(2, 0x5dade2);
        this.mintModalContainer.add(titlePanel);

        // Title with emoji and styling
        const title = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - (modalHeight/5) + titleHeight/2,
            '🥕 MINT CARROTS ON-CHAIN',
            {
                fontSize: '22px',
                fontFamily: 'Arial, sans-serif',
                color: '#2ecc71',
                fontStyle: 'bold',
                shadow: {
                    offsetX: 0,
                    offsetY: 2,
                    color: '#000000',
                    blur: 4,
                    stroke: true,
                    fill: true
                }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(103);
        this.mintModalContainer.add(title);

        // Close button with improved styling
        const closeBtnX = this.cameras.main.centerX + (modalWidth/2) - padding - closeButtonSize/2;
        const closeBtnY = this.cameras.main.centerY - (modalHeight/2) + titleHeight/2;

        const closeBtnBg = this.add.circle(
            closeBtnX,
            closeBtnY,
            closeButtonSize/2,
            0xe74c3c,
            0.9
        ).setInteractive().setScrollFactor(0).setDepth(104);
        closeBtnBg.setStrokeStyle(2, 0xc0392b);
        this.mintModalContainer.add(closeBtnBg);

        const closeBtn = this.add.text(
            closeBtnX,
            closeBtnY,
            '✕',
            {
                fontSize: '20px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(105);
        this.mintModalContainer.add(closeBtn);

        // Close button interactions
        [closeBtnBg, closeBtn].forEach(element => {
            element.on('pointerover', () => {
                closeBtnBg.setFillStyle(0xf39c12);
                closeBtnBg.setScale(1.1);
                this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
            });

            element.on('pointerout', () => {
                closeBtnBg.setFillStyle(0xe74c3c);
                closeBtnBg.setScale(1);
                this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
            });

            element.on('pointerdown', () => {
                this.hideMintModal();
            });
        });

        // Store close button reference
        this.mintModalCloseButton = closeBtn;

        // Create content panels
        this.createMintModalContent(modalWidth, modalHeight, padding, titleHeight);
    }

    private createMintModalContent(modalWidth: number, modalHeight: number, padding: number, titleHeight: number): void {
        // Carrot icon (smaller and compact)
        const carrotIcon = this.add.sprite(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 40,
            'carrot_stage3'
        );
        carrotIcon.setScale(0.8); // Smaller for compact modal
        carrotIcon.setScrollFactor(0);
        carrotIcon.setDepth(103);
        this.mintModalContainer.add(carrotIcon);

        // Count text (compact for small modal)
        const countText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 10,
            '0',
            {
                fontSize: '18px', // Smaller font for compact modal
                fontFamily: 'Arial, sans-serif',
                color: '#2ecc71',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(103);
        countText.setName('mintCountText');
        this.mintModalContainer.add(countText);

        // Description text (compact)
        const desc = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 15,
            'Mint as NFT?',
            {
                fontSize: '12px', // Very small font for compact modal
                fontFamily: 'Arial, sans-serif',
                color: '#ecf0f1',
                align: 'center',
                wordWrap: { width: modalWidth - 40 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(103);
        this.mintModalContainer.add(desc);

        // Confirm button (positioned at bottom of small modal)
        const confirmBtn = this.add.container(
            this.cameras.main.centerX - 40,
            this.cameras.main.centerY + 65 // Position for 200px height modal
        );
        confirmBtn.setScrollFactor(0);
        confirmBtn.setDepth(103);

        const confirmBg = this.add.rectangle(0, 0, 70, 25, 0x2ecc71);
        confirmBg.setStrokeStyle(1, 0x27ae60);
        confirmBtn.add(confirmBg);

        const confirmText = this.add.text(0, 0, 'Mint', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        confirmBtn.add(confirmText);

        confirmBtn.setInteractive(new Phaser.Geom.Rectangle(-35, -12.5, 70, 25), Phaser.Geom.Rectangle.Contains);
        confirmBtn.on('pointerdown', () => {
            this.hideMintModal();
            this.executeMintTransaction(this.pendingMintCount);
        });
        confirmBtn.on('pointerover', () => {
            confirmBg.setFillStyle(0x27ae60);
            confirmBtn.setScale(1.05);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        confirmBtn.on('pointerout', () => {
            confirmBg.setFillStyle(0x2ecc71);
            confirmBtn.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        this.mintModalContainer.add(confirmBtn);

        // Cancel button (positioned at bottom of small modal)
        const cancelBtn = this.add.container(
            this.cameras.main.centerX + 40,
            this.cameras.main.centerY + 65 // Position for 200px height modal
        );
        cancelBtn.setScrollFactor(0);
        cancelBtn.setDepth(103);

        const cancelBg = this.add.rectangle(0, 0, 70, 25, 0xe74c3c);
        cancelBg.setStrokeStyle(1, 0xc0392b);
        cancelBtn.add(cancelBg);

        const cancelText = this.add.text(0, 0, 'No', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        cancelBtn.add(cancelText);

        cancelBtn.setInteractive(new Phaser.Geom.Rectangle(-35, -12.5, 70, 25), Phaser.Geom.Rectangle.Contains);
        cancelBtn.on('pointerdown', () => {
            this.hideMintModal();
        });
        cancelBtn.on('pointerover', () => {
            cancelBg.setFillStyle(0xc0392b);
            cancelBtn.setScale(1.05);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        cancelBtn.on('pointerout', () => {
            cancelBg.setFillStyle(0xe74c3c);
            cancelBtn.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        this.mintModalContainer.add(cancelBtn);
    }

    private showMintModal(count: number): void {
        if (!this.mintModalCreated) {
            this.createMintModal();
        }

        this.pendingMintCount = count;
        this.mintModalVisible = true;
        this.mintModalContainer.setVisible(true);

        // Update the count text
        const countText = this.mintModalContainer.getByName('mintCountText') as Phaser.GameObjects.Text;
        if (countText) {
            countText.setText(`${count} Carrots`);
        }
    }

    private hideMintModal(): void {
        this.mintModalVisible = false;
        this.mintModalContainer.setVisible(false);
        this.pendingMintCount = 0;
    }

    private updateCollectButton(): void {
        if (!this.collectButton) return;

        if (this.harvestedCarrotCount > 0 && !this.mintModalVisible) {
            this.collectButton.setVisible(true);
            this.collectButtonText.setText(`Collect All (${this.harvestedCarrotCount}) - Press C`);

            // Position at bottom center of screen
            const camera = this.cameras.main;
            const x = camera.width / 2;
            const y = camera.height - 60;
            this.collectButton.setPosition(x, y);
        } else {
            this.collectButton.setVisible(false);
        }
    }

    private tryCollectCarrots(): void {
        if (this.harvestedCarrotCount === 0 || this.isCollecting || this.mintModalVisible) return;
        this.isCollecting = true;

        const count = this.harvestedCarrotCount;
        
        // Animate all carrots flying to center
        const camera = this.cameras.main;
        const targetX = camera.worldView.centerX;
        const targetY = camera.worldView.centerY;

        this.droppedCarrots.forEach((carrot, key) => {
            // Animate carrot
            this.tweens.add({
                targets: carrot,
                x: targetX,
                y: targetY,
                scale: 0.3,
                alpha: 0.5,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    carrot.destroy();
                }
            });
        });

        // Clear dropped carrots and batch mint them
        this.time.delayedCall(500, async () => {
            const carrotItems: GameItem[] = [];

            this.droppedCarrots.forEach((carrot) => {
                const gameItemId = carrot.getData('gameItemId') as string | undefined;
                const itemId = gameItemId || `carrot_${Date.now()}_${Phaser.Math.RND.uuid().slice(0, 6)}`;

                carrotItems.push({
                    id: itemId,
                    name: 'Carrot',
                    description: 'Freshly harvested carrot from OneValley farm',
                    type: 'consumable',
                    rarity: 1,
                    stats: [5, 10],
                });
            });

            this.droppedCarrots.clear();
            this.harvestedCarrotCount = 0;
            this.isCollecting = false;

            // Batch mint all collected carrots using AutoMintService
            const autoMint = AutoMintService.getInstance();

            // Queue all carrots for batch minting (background process)
            console.log(`🥕 Queueing ${carrotItems.length} carrots for auto-minting...`);
            await autoMint.batchMintItems(carrotItems);

            // Show collection notification
            this.showTransactionNotification(`Collected ${carrotItems.length} carrots! Auto-minting in background...`, 'success', 3000);
        });
    }

    // Old showMintConfirmationDialog method replaced with new modal pattern following transaction details modal
    // Removed: showTransactionProgressDialog, updateTransactionDialog, showTransactionSuccessDialog methods
    // Now using UIScene.showTransactionDetailsModal() for consistent UI

    private async executeMintTransaction(count: number): Promise<void> {
        try {
            // Show transaction notification
            this.showTransactionNotification('Initiating blockchain minting...', 'info', 3000);

            // Check wallet bridge status first
            if (!this.walletBridge.isWalletReady()) {
                const connectionStatus = this.walletBridge.getConnectionStatus();
                if (!connectionStatus.isConnected) {
                    this.showTransactionNotification('Please connect your OneChain wallet first!', 'warning', 4000);
                    return;
                }
                this.showTransactionNotification('Wallet services not ready. Please refresh the page.', 'warning', 4000);
                return;
            }

            // Check wallet balance
            try {
                const balance = await this.walletBridge.getWalletBalance();
                if (parseFloat(balance) < 0.01) { // Minimum 0.01 SUI for gas
                    this.showTransactionNotification('Insufficient balance for minting fees!', 'warning', 4000);
                    return;
                }
            } catch (balanceError) {
                console.warn('Could not check wallet balance:', balanceError);
            }

            // Create crop data for minting
            const mintBatchTimestamp = Date.now();
            const crops = Array.from({ length: count }, (_, i) => ({
                type: 'carrot' as const,
                quality: 70 + Math.floor(Math.random() * 30), // Quality 70-100
                quantity: 1,
                harvestTimestamp: mintBatchTimestamp + i,
                gameItemId: `carrot_mint_${mintBatchTimestamp}_${i}`
            }));

            // Execute real blockchain minting using wallet bridge
            const mintResult = await this.oneChainHarvester.mintHarvestedCrops(crops);

            if (mintResult.success) {
                // Register minted NFTs with auto-mint registry for downstream systems
                if (mintResult.itemIds && mintResult.itemIds.length > 0) {
                    const autoMint = AutoMintService.getInstance();
                    mintResult.itemIds.forEach((nftId, index) => {
                        const sourceCrop = crops[index];
                        const quality = sourceCrop?.quality ?? 70;
                        const rarity = quality >= 90 ? 4 : quality >= 70 ? 3 : quality >= 50 ? 2 : 1;

                        autoMint.registerMintedItem({
                            id: sourceCrop?.gameItemId || nftId,
                            name: `${sourceCrop?.type ?? 'Crop'} Harvest`,
                            description: sourceCrop?.type
                                ? `Freshly harvested ${sourceCrop.type} from OneValley`
                                : 'Minted crop from OneValley farm',
                            type: 'resource',
                            rarity,
                            stats: [quality, sourceCrop?.quantity ?? 1, 10]
                        }, nftId);
                    });
                }

                // Get UIScene and show real transaction details
                const uiScene = this.scene.get(SCENE_KEYS.UI) as UIScene;
                if (uiScene && mintResult.transactionFlow) {
                    // Convert transaction flow to display format
                    const mintTransaction = {
                        transactionHash: mintResult.transactionHash!,
                        blockNumber: mintResult.blockNumber,
                        blockConfirmation: 'confirmed',
                        gasUsed: mintResult.transactionFlow.gasUsed,
                        gasPrice: '1000 MIST',
                        gasCost: `${(mintResult.transactionFlow.gasCost / 1000000000).toFixed(6)} SUI`,
                        timestamp: Date.now(),
                        status: 'completed' as const,
                        itemsTraded: {
                            playerItems: [],
                            npcItems: [
                                {
                                    id: `minted-carrot-${Date.now()}`,
                                    name: `${count} Carrot NFT${count > 1 ? 's' : ''}`,
                                    quantity: count,
                                    spriteKey: 'carrot_stage3'
                                }
                            ]
                        },
                        transactionType: 'mint' as const,
                        price: undefined,
                        explorerUrl: this.walletBridge.getTransactionExplorerUrl(mintResult.transactionHash!)
                    };

                    console.log('Real minting transaction completed:', mintTransaction);

                    // Set the transaction and show the modal using UIScene's existing system
                    uiScene.currentTransaction = mintTransaction;
                    uiScene.showTransactionDetailsModal();

                    this.showTransactionNotification(
                        `Successfully minted ${count} Carrot NFTs on OneChain! 🎉`,
                        'success',
                        5000
                    );
                }
            } else {
                this.showTransactionNotification(
                    `Minting failed: ${mintResult.error || 'Unknown error'}`,
                    'warning',
                    4000
                );
            }
        } catch (error) {
            console.error('Error executing mint transaction:', error);
            this.showTransactionNotification(
                `Minting error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'warning',
                4000
            );
        }
    }

    destroy(): void {
        // Clean up resize event listener
        this.scale.off('resize', this.handleResize, this);
        if (this.windTimer) {
            this.windTimer.destroy();
        }

        // Stop background music
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // Clean up contextual action system
        if (this.floatingHintManager) {
            this.floatingHintManager.destroy();
        }
    }
}
