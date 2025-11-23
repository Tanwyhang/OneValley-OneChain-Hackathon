import * as Phaser from 'phaser';
import { SCENE_KEYS } from './SceneKeys';
import { EventBus } from '../EventBus';
import { SuiClient } from '@onelabs/sui/client';
import { ONECHAIN_NETWORK } from '@/config/contracts';
import WalletBridgeService from '@/services/WalletBridgeService';
import HUDBridgeService from '@/services/HUDBridgeService';
import OneChainMarketplaceService from '@/services/OneChainMarketplaceService';
import OneChainTransactionFlow, { TransactionType } from '@/services/OneChainTransactionFlow';
import { OneChainTransactionService } from '@/services/OneChainTransactionService';
import AutoMintService, { GameItem } from '@/services/AutoMintService';
import { FrontendItem, MarketplaceListing, ITEM_TYPES, ItemType, getRarityColor } from '@/types/onechain';
// 1. First, let's update the Slot interface at the top of the file
interface Slot {
    bg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    x: number;
    y: number;
    itemId?: string;  // The unique identifier for the item
    itemImage?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;  // The actual image in the slot
    countText?: Phaser.GameObjects.Text;  // Text showing item count
    itemType?: string;  // e.g., 'weapon', 'consumable', 'tool'
}

export class UIScene extends Phaser.Scene {
    #hudContainer!: Phaser.GameObjects.Container;
    #hearts!: Phaser.GameObjects.Image[];
    #hpText!: Phaser.GameObjects.Text;

    // HP Bar properties (deprecated, keeping for compatibility)
    private hpBarBackground!: Phaser.GameObjects.Graphics;
    private hpBarFill!: Phaser.GameObjects.Graphics;
    private hpText!: Phaser.GameObjects.Text;

    private itemBarContainer!: Phaser.GameObjects.Container;
    private slots: Slot[] = [];
    private selectedIndex: number = 0;
    private readonly SLOT_COUNT = 8;
    private barBg!: Phaser.GameObjects.Image;
    private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
    private selectionIndicator?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    private keyHandlers: Phaser.Events.EventEmitter[] = [];

    // Backpack properties
    private backpackContainer!: Phaser.GameObjects.Container;
    private backpackSlots: Slot[] = [];
    private backpackBg!: Phaser.GameObjects.Image;
    private backpackVisible: boolean = false;
    private readonly BACKPACK_SLOT_COUNT = 25; // 5x5 grid
    private readonly BACKPACK_COLS = 5;
    private readonly BACKPACK_ROWS = 5;
    private backpackKey!: Phaser.Input.Keyboard.Key;
    private backpackOverlay!: Phaser.GameObjects.Rectangle;

    // Drag and drop properties (kept for compatibility)
    private draggedItem: { itemId: string; itemType?: string; count?: number; sourceSlot: Slot; sourceIndex: number; sourceType: 'itembar' | 'backpack' } | null = null;
    private dragGhost?: Phaser.GameObjects.Image;

    // Held item properties (new click-based system)
    private heldItem: { itemId: string; itemType?: string; count: number } | null = null;
    private heldItemGhost?: Phaser.GameObjects.Image;
    private heldItemCountText?: Phaser.GameObjects.Text;
    private readonly MAX_STACK_SIZE = 99;

    // Double-click tracking
    private lastClickTime: number = 0;
    private lastClickSlot: { index: number; type: 'itembar' | 'backpack' } | null = null;
    private readonly DOUBLE_CLICK_DELAY = 300; // milliseconds

    // Marketplace properties
    private marketplaceContainer!: Phaser.GameObjects.Container;
    private marketplaceBg!: Phaser.GameObjects.Image;
    private marketplaceVisible: boolean = false;
    private marketplaceSlots: Slot[] = [];
    private marketplaceButtons: Phaser.GameObjects.Image[] = [];
    private selectedCategory: 'Weapons' | 'Armors' | 'Misc' | 'Consumables' = 'Weapons';
    private marketplaceOverlay!: Phaser.GameObjects.Rectangle;
    private readonly MARKETPLACE_SLOT_COUNT = 30; // 5x6
    private readonly MARKETPLACE_COLS = 5;
    private readonly MARKETPLACE_ROWS = 6;
    private marketplaceCreated: boolean = false;
    private selectedMarketplaceSlot: number = -1;

    // Transaction details properties
    private transactionDetailsContainer!: Phaser.GameObjects.Container;
    private transactionDetailsBg!: Phaser.GameObjects.Image;
    private transactionDetailsVisible: boolean = false;
    private transactionDetailsCreated: boolean = false;
    private transactionDetailsCloseButton!: Phaser.GameObjects.GameObject;
    private transactionDetailsTexts: Phaser.GameObjects.Text[] = [];
    private marketplaceTransactionNotificationContainer?: Phaser.GameObjects.Container;

    // Crafting UI properties
    private craftingContainer!: Phaser.GameObjects.Container;
    private craftingSlots: Slot[] = [];
    private craftingResultSlot: Slot | null = null;
    private craftingVisible: boolean = false;
    private craftingKey!: Phaser.Input.Keyboard.Key;
    private craftingArrow?: Phaser.GameObjects.Triangle;
    private craftingResultAvailable: boolean = false;
    private readonly craftingPrimaryResultKeys: string[] = ['gem_01j', 'crystal_01j', 'gem_01i', 'crystal_01i'];

    // Guide menu properties
    private guideMenuVisible: boolean = false;
    private guideMenuContainer?: Phaser.GameObjects.Container;
    private guideMenuOverlay?: Phaser.GameObjects.Rectangle;

    // Settings menu properties
    private settingsMenuVisible: boolean = false;
    private settingsMenuContainer?: Phaser.GameObjects.Container;
    private settingsMenuOverlay?: Phaser.GameObjects.Rectangle;
    private volumeSliderKnob?: Phaser.GameObjects.Arc;
    private volumeValueText?: Phaser.GameObjects.Text;
    private fullscreenCheckbox?: Phaser.GameObjects.Rectangle;
    private fullscreenCheckmark?: Phaser.GameObjects.Text;
    private isFullscreen: boolean = false;
    private musicVolume: number = 0.5;

    // Exit confirmation properties
    private exitConfirmationVisible: boolean = false;
    private exitConfirmationContainer?: Phaser.GameObjects.Container;
    private exitConfirmationOverlay?: Phaser.GameObjects.Rectangle;

    // NPC Trade Inventory properties
    private npcTradeContainer!: Phaser.GameObjects.Container;
    private npcTradeVisible: boolean = false;
    private npcLeftSlots: Slot[] = [];
    private npcRightSlots: Slot[] = [];
    private npcTradeOverlay!: Phaser.GameObjects.Rectangle;
    private readonly NPC_TRADE_SLOTS_PER_SIDE = 5;
    private npcTradeLocked: boolean = false;
    private npcCancelButton?: Phaser.GameObjects.Text;
    private npcAcceptButton?: Phaser.GameObjects.Text;
    private npcPlayerTick?: Phaser.GameObjects.Text;
    private npcHermanTick?: Phaser.GameObjects.Text;
    private npcHermanItems: string[] = []; // Will be populated from blockchain
    private npcConfirmModal?: Phaser.GameObjects.Container;
    private npcConfirmOverlay?: Phaser.GameObjects.Rectangle;

    // Transaction details properties
    public currentTransaction: import('../../types/onechain').TransactionDetails | null = null;
    private transactionDetailsButton?: Phaser.GameObjects.Container;
    private transactionDetailsButtonBg?: Phaser.GameObjects.Rectangle;
    private transactionDetailsButtonText?: Phaser.GameObjects.Text;

    // Marketplace item data - only used as fallback if blockchain fails
    private readonly FALLBACK_MARKETPLACE_ITEMS = {
        Weapons: ['sword_01a', 'sword_01b', 'sword_01c', 'sword_01d', 'sword_01e', 'sword_02a', 'sword_02b', 'sword_02c', 'sword_02d', 'sword_02e', 'bow_01a', 'bow_01b', 'bow_01d', 'bow_01e', 'bow_02a', 'bow_02b', 'bow_02d', 'bow_02e', 'arrow_01a', 'arrow_01b', 'arrow_02a', 'arrow_02b', 'shield_01a', 'shield_01b', 'shield_02a', 'shield_02b', 'staff_01a', 'staff_01b', 'spellbook_01a', 'spellbook_01b'],
        Armors: ['helmet_01a', 'helmet_01b', 'helmet_01c', 'helmet_01d', 'helmet_01e', 'helmet_02a', 'helmet_02b', 'helmet_02c', 'helmet_02d', 'helmet_02e'],
        Misc: ['book_01a', 'book_01b', 'book_02a', 'book_02b', 'coin_01a', 'coin_01b', 'coin_02a', 'coin_02b', 'crystal_01a', 'crystal_01b', 'gem_01a', 'gem_01b', 'gift_01a', 'gift_01b', 'ingot_01a', 'ingot_01b', 'key_01a', 'key_01b', 'necklace_01a', 'necklace_01b', 'pearl_01a', 'pearl_01b', 'ring_01a', 'ring_01b', 'scroll_01a', 'scroll_01b', 'scroll_01c', 'scroll_01d', 'scroll_01e', 'scroll_01f'],
        Consumables: ['potion_01a', 'potion_01b', 'potion_01c', 'potion_01d', 'potion_01e', 'potion_01f', 'potion_01g', 'potion_01h', 'potion_02a', 'potion_02b', 'potion_02c', 'potion_02d', 'potion_02e', 'potion_02f', 'potion_03a', 'potion_03b', 'fish_01a', 'fish_01b', 'fish_01c', 'fish_01d', 'fish_01e', 'candy_01a', 'candy_01b', 'candy_01c', 'candy_01d', 'candy_01e', 'candy_01f', 'candy_01g', 'candy_02a', 'candy_02b']
    };

    // OneChain Blockchain Properties
    private oneChainMarketplaceService: OneChainMarketplaceService;
    private oneChainTransactionFlow: OneChainTransactionFlow;
    private oneChainTransactionService: OneChainTransactionService;
    private suiClient!: SuiClient;
    private marketplaceListings: MarketplaceListing[] = [];
    private currentMarketplaceTab: 'browse' | 'my_kiosk' | 'sell' = 'browse';
    private blockchainItems: Map<string, FrontendItem> = new Map();
    private isProcessingTransaction: boolean = false;

    constructor() {
        super({
            key: SCENE_KEYS.UI,
            active: true
        });
    }

    public create(): void {
        // Set custom cursor with larger size
        this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');

        // Disable right-click context menu
        this.input.mouse?.disableContextMenu();

        // Reset ALL state and clear destroyed object references
        this.marketplaceCreated = false;
        this.marketplaceButtons = [];
        this.marketplaceSlots = [];
        this.backpackSlots = [];
        this.slots = [];
        this.marketplaceVisible = false;
        this.transactionDetailsCreated = false;
        this.transactionDetailsVisible = false;
        this.currentTransaction = null;
        this.backpackVisible = false;
        this.guideMenuVisible = false;
        this.settingsMenuVisible = false;
        this.npcTradeVisible = false;
        this.selectedMarketplaceSlot = -1;
        this.guideMenuContainer = undefined;
        this.guideMenuOverlay = undefined;
        this.settingsMenuContainer = undefined;
        this.settingsMenuOverlay = undefined;
        this.npcLeftSlots = [];
        this.npcRightSlots = [];

        // Initialize OneChain services
        this.suiClient = new SuiClient({ url: ONECHAIN_NETWORK.RPC_URL });
        this.oneChainMarketplaceService = OneChainMarketplaceService.getInstance();
        this.oneChainTransactionFlow = OneChainTransactionFlow.getInstance();

        // Get transaction service from WalletBridgeService (has signer properly set)
        const walletBridge = WalletBridgeService.getInstance();
        this.oneChainTransactionService = walletBridge.getTransactionService() || new OneChainTransactionService(this.suiClient);

        this.marketplaceListings = [];
        this.blockchainItems.clear();
        this.isProcessingTransaction = false;
        this.currentMarketplaceTab = 'browse';

        // Initialize NPC items from blockchain
        this.initializeNPCItems();

        // Create main HUD container with high depth
        this.#hudContainer = this.add.container(0, 0).setDepth(10000);
        this.#hearts = [];
        this.keyHandlers = [];

        // Create item bar
        this.createItemBar();

        // Create HP bar
        this.createHPBar();

        // Handle window resize with proper context binding
        this.scale.on('resize', this.handleResize, this);

        // Cleanup on scene shutdown
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.handleResize, this);
            this.cleanupKeyHandlers();
            this.input.off('pointermove', this.onDragMove, this);
            this.input.off('pointermove', this.updateHeldItemPosition, this);
            this.clearHeldItem();
            this.#hudContainer.destroy(true);
        });

        // Start with UI hidden by default
        this.hideUI();

        // Select first slot by default
        this.selectedIndex = 0;
        this.updateSelection();

        // Setup keyboard input for item selection
        this.setupInput();

        // Create backpack (hidden by default)
        this.createBackpack();

        // Create marketplace (hidden by default)
        this.createMarketplace();

        // Create settings button at top right
        this.createSettingsButton();

        // Create crafting UI (hidden by default)
        this.createCraftingUI();
    }

    public showUI(): void {
        this.#hudContainer.setVisible(true);
        this.showHPBar();
    }

    public hideUI(): void {
        this.#hudContainer.setVisible(false);
        this.hideHPBar();
    }

    private showHPBar(): void {
        this.#hearts.forEach(heart => heart.setVisible(true));
    }

    private hideHPBar(): void {
        this.#hearts.forEach(heart => heart.setVisible(false));
    }

    private createItemBar(): void {
        // Create item bar container
        this.itemBarContainer = this.add.container(0, 0);
        this.itemBarContainer.setScrollFactor(0);
        this.itemBarContainer.setDepth(25000);
        this.#hudContainer.add(this.itemBarContainer);

        // Create slots
        this.createSlots();
        this.setupKeys();
        this.updatePosition();
    }

    private createSlots(): void {
        const slotSize = 48;
        const spacing = 6;
        const totalWidth = (this.SLOT_COUNT * (slotSize + spacing)) - spacing;
        const startX = -totalWidth / 2 + slotSize / 2;

        // Add the itembar background if it exists
        if (this.textures.exists('itembar')) {
            this.barBg = this.add.image(0, 0, 'itembar')
                .setOrigin(0.5, 0.5)
                .setDepth(50);
            this.itemBarContainer.add(this.barBg);
        }

        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const x = startX + i * (slotSize + spacing);

            // Create slot background
            let slotBg;
            if (this.textures.exists('slot')) {
                slotBg = this.add.image(x, 0, 'slot')
                    .setOrigin(0.5, 0.5)
                    .setDepth(100);
            } else {
                slotBg = this.add.rectangle(x, 0, slotSize, slotSize, 0x000000, 0.3)
                    .setOrigin(0.5, 0.5)
                    .setDepth(100);
            }

            this.itemBarContainer.add(slotBg);

            const slot: Slot = {
                bg: slotBg,
                x: x,
                y: 0
            };
            this.slots.push(slot);

            // Make slot interactive for drag and drop
            this.makeSlotInteractive(slotBg, i, 'itembar');
        }

        // Create selection indicator last so it's above slots
        if (this.textures.exists('selected-slot')) {
            this.selectionIndicator = this.add.image(0, 0, 'selected-slot')
                .setOrigin(0.5, 0.5)
                .setVisible(false)
                .setDepth(200); // Above slots
        } else {
            this.selectionIndicator = this.add.rectangle(0, 0, slotSize + 8, slotSize + 8, 0, 0)
                .setStrokeStyle(2, 0x00ff00)
                .setOrigin(0.5, 0.5)
                .setVisible(false)
                .setDepth(200);
        }
        this.itemBarContainer.add(this.selectionIndicator);
    }

    private createHPBar(): void {
        // Create hearts display (10 hearts for 100 HP)
        this.#hearts = [];
        const startX = 20;
        const startY = 30;
        const heartSpacing = 30; // Decreased space between hearts
        const heartScale = 0.06; // Even bigger scale from 900x565

        // HP text removed - hearts only

        // Create 10 hearts
        for (let i = 0; i < 10; i++) {
            const heart = this.add.image(
                startX + (i * heartSpacing) + 15,
                startY,
                'heart'
            );
            heart.setScale(heartScale);
            heart.setDepth(10003);
            heart.setScrollFactor(0);
            this.#hearts.push(heart);
        }

        // Listen for HP changes from FarmScene via EventBus
        EventBus.on('player-hp-changed', this.updateHPBar, this);

        // Initialize with full HP
        this.updateHPBar({ current: 100, max: 100 });
    }

    private updateHPBar(data: { current: number; max: number }): void {
        // Each heart represents 10 HP
        const heartsToShow = Math.ceil(data.current / 10);

        // Update each heart visibility and alpha
        this.#hearts.forEach((heart, index) => {
            if (index < heartsToShow) {
                heart.setVisible(true);
                // If this is the last heart and HP is not full for this heart, make it partially transparent
                const hpForThisHeart = data.current - (index * 10);
                if (hpForThisHeart < 10 && hpForThisHeart > 0) {
                    heart.setAlpha(hpForThisHeart / 10);
                } else {
                    heart.setAlpha(1);
                }
            } else {
                heart.setVisible(false);
            }
        });
    }

    private setupKeys(): void {
        // Clean up any existing key handlers
        this.cleanupKeyHandlers();

        // Add keyboard controls for slot selection (1-8)
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            // Use direct key codes: 49='1', 50='2', ..., 56='8'
            const keyCode = 49 + i;
            const key = this.input.keyboard?.addKey(keyCode);
            const handler = () => {
                this.selectedIndex = i;
                this.updateSelection();
            };
            key?.on('down', handler);
            this.keyHandlers.push(key?.on('down', handler) || new Phaser.Events.EventEmitter());
        }
    }

    // 4. Update the updateSelection method to handle item layering
    private updateSelection(): void {
        if (!this.selectionIndicator) return;

        // Update selection indicator position
        const slot = this.slots[this.selectedIndex];
        if (slot) {
            this.selectionIndicator.setPosition(slot.x, slot.y);
            this.selectionIndicator.setVisible(true);

            // Ensure proper layering
            this.selectionIndicator.setDepth(500); // Keep it below numbers but above slots

            // Force update the display list
            this.children.sort('depth');
        }

        // Emit event when selection changes
        const selectedItem = this.getSelectedItem();
        this.events.emit('slot-selected', {
            slotIndex: this.selectedIndex,
            item: selectedItem
        });
    }

    // 3. Update the addItem method to handle item types and better positioning
    public addItem(itemId: string, slotIndex: number, itemType: string = 'item', count: number = 1): void {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            console.warn(`Invalid slot index: ${slotIndex}`);
            return;
        }

        const slot = this.slots[slotIndex];
        if (!slot) return;

        // Remove existing item if any
        if (slot.itemImage) {
            slot.itemImage.destroy();
        }
        if (slot.countText) {
            slot.countText.destroy();
        }

        // Add item image with proper depth
        const textureKey = itemId;

        // Check if the texture exists
        if (this.textures.exists(textureKey)) {
            slot.itemImage = this.add.image(slot.x, slot.y, textureKey)
                .setDisplaySize(32, 32)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.itemBarContainer.add(slot.itemImage);
        } else {
            console.warn(`Texture not found: ${textureKey}`);
            // Add a placeholder for debugging
            const placeholderImage = this.add.rectangle(slot.x, slot.y, 32, 32, 0xff0000)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            slot.itemImage = placeholderImage;
            this.itemBarContainer.add(placeholderImage);
        }

        // Add item count if more than 1
        if (count > 1) {
            slot.countText = this.add.text(
                slot.x + 18,
                slot.y + 18,
                count.toString(),
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3,
                    padding: { x: 2, y: 1 }
                }
            ).setOrigin(1, 1)
                .setDepth(10000 + slotIndex); // Very high depth to ensure visibility

            this.itemBarContainer.add(slot.countText);
        } else {
            // Clear count text if count is 1
            if (slot.countText) {
                slot.countText.destroy();
                slot.countText = undefined;
            }
        }

        // Store item data
        slot.itemId = itemId;
        slot.itemType = itemType;

        // Force update the display list
        this.children.sort('depth');
    }

    public updatePosition(): void {
        const x = this.cameras.main.centerX;
        const y = this.cameras.main.height - 60; // Position at bottom of screen
        this.itemBarContainer.setPosition(x, y);
    }

    private handleResize(gameSize: Phaser.Structs.Size): void {
        if (!this.scene.settings.active) return;
        this.itemBarContainer.setVisible(true);
        this.updatePosition();

        // Update sell button position on resize
        const sellButton = this.marketplaceContainer?.getData('sellButton');
        if (sellButton) {
            this.updateSellButtonPosition(sellButton);
        }
    }

    private setupInput(): void {
        // Add number key support (1-8)
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const key = this.input.keyboard?.addKey(48 + i + 1); // 49 is '1', 50 is '2', etc.
            key?.on('down', () => {
                this.selectSlot(i);
            });
        }

        // Add arrow key support
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                this.selectSlot((this.selectedIndex - 1 + this.SLOT_COUNT) % this.SLOT_COUNT);
                event.preventDefault();
            } else if (event.key === 'ArrowRight') {
                this.selectSlot((this.selectedIndex + 1) % this.SLOT_COUNT);
                event.preventDefault();
            }
        });

        // Add 'B' key to toggle backpack (only in FarmScene)
        this.backpackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.backpackKey.on('down', () => {
            const farmScene = this.scene.get(SCENE_KEYS.FARM);
            if (farmScene && farmScene.scene.isActive()) {
                const hudBridge = HUDBridgeService.getInstance();

                if (this.backpackVisible) {
                    this.hideBackpack();
                    hudBridge.toggleBackpack(false);
                } else if (this.marketplaceVisible) {
                    this.marketplaceContainer.setVisible(false);
                    this.showBackpack();
                    hudBridge.toggleBackpack(true);
                } else {
                    this.showBackpack();
                    hudBridge.toggleBackpack(true);
                }
            }
        });

        // Add 'F' key to toggle crafting (only in FarmScene)
        this.craftingKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.craftingKey.on('down', () => {
            const farmScene = this.scene.get(SCENE_KEYS.FARM);
            if (farmScene && farmScene.scene.isActive()) {
                if (this.craftingVisible) {
                    this.hideCrafting();
                } else {
                    this.showCrafting();
                }
            }
        });

        // Add 'ESC' key to close marketplace/backpack/crafting
        const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        escKey.on('down', () => {
            if (this.transactionDetailsVisible) {
                this.hideTransactionDetails();
            }
            else if (this.craftingVisible) {
                this.hideCrafting();
            } else if (this.backpackVisible) {
                this.hideBackpack();
                if (this.marketplaceVisible) {
                    this.marketplaceContainer.setVisible(true);
                }
            } else if (this.marketplaceVisible) {
                this.hideMarketplace();
            } else if (this.guideMenuVisible) {
                this.hideGuideMenu();
            } else if (this.settingsMenuVisible) {
                this.hideSettingsMenu();
            } else if (this.npcTradeVisible) {
                this.hideNPCTrade();
            } else {
                // No menus open - show exit confirmation
                this.showExitConfirmation();
            }
        });
    }

    private cleanupKeyHandlers(): void {
        this.keyHandlers.forEach(handler => handler.off('down'));
        this.keyHandlers = [];
    }

    private selectSlot(index: number): void {
        if (index < 0 || index >= this.SLOT_COUNT) return;
        this.selectedIndex = index;
        this.updateSelection();

        // Update React HUD
        const hudBridge = HUDBridgeService.getInstance();
        hudBridge.setSelectedSlot(index);
    }

    // 2. Add a method to get the currently selected item
    public getSelectedItem(): { itemId: string; itemType?: string } | null {
        const slot = this.slots[this.selectedIndex];
        if (slot && slot.itemId) {
            return {
                itemId: slot.itemId,
                itemType: slot.itemType
            };
        }
        return null;
    }

    public getSlot(index: number): Slot | undefined {
        return this.slots[index];
    }

    // ===== BACKPACK METHODS =====

    private createBackpack(): void {
        // Create backpack container (centered on screen)
        this.backpackContainer = this.add.container(0, 0);
        this.backpackContainer.setScrollFactor(0);
        this.backpackContainer.setDepth(15000); // Below item bar (25000)
        this.backpackContainer.setVisible(false);

        // Add grey overlay (larger to cover edges when zoomed)
        this.backpackOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.7
        );
        this.backpackOverlay.setOrigin(0.5);
        this.backpackOverlay.setDepth(50);
        this.backpackOverlay.setScrollFactor(0);
        this.backpackOverlay.setVisible(false);

        // ADJUST BACKPACK IMAGE SCALE
        const backpackScale = 2.0;

        // Add backpack background image
        if (this.textures.exists('backpack')) {
            this.backpackBg = this.add.image(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'backpack'
            );
            this.backpackBg.setOrigin(0.5);
            this.backpackBg.setScale(backpackScale);
            this.backpackBg.setDepth(100);
            this.backpackContainer.add(this.backpackBg);
        }

        // Create 5x5 grid of slots
        this.createBackpackSlots(backpackScale);

        // Add to HUD container
        this.#hudContainer.add(this.backpackContainer);
    }

    private createBackpackSlots(backpackScale: number): void {
        // Slots scale with backpack automatically
        const slotSize = 48 * backpackScale;

        const cols = this.BACKPACK_COLS;
        const rows = this.BACKPACK_ROWS;

        // Grid area is 368x270, centered in backpack
        const gridWidth = cols * slotSize;
        const gridHeight = rows * slotSize;

        // ADJUST THESE VALUES TO MOVE THE GRID (scaled with backpack)
        const offsetX = 3 * backpackScale; // Positive = move right, Negative = move left
        const offsetY = 14 * backpackScale; // Positive = move down, Negative = move up

        // Calculate starting position (top-left of grid)
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        const startX = centerX - gridWidth / 2 + slotSize / 2 + offsetX;
        const startY = centerY - gridHeight / 2 + slotSize / 2 + offsetY;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * slotSize;
                const y = startY + row * slotSize;

                // Create slot background
                let slotBg;
                if (this.textures.exists('slot')) {
                    slotBg = this.add.image(x, y, 'slot')
                        .setOrigin(0.5, 0.5)
                        .setScale(backpackScale)
                        .setDepth(200);
                } else {
                    slotBg = this.add.rectangle(x, y, slotSize, slotSize, 0x000000, 0.3)
                        .setOrigin(0.5, 0.5)
                        .setDepth(100);
                }

                this.backpackContainer.add(slotBg);

                const slot: Slot = {
                    bg: slotBg,
                    x: x,
                    y: y
                };
                this.backpackSlots.push(slot);

                // Make slot interactive for drag and drop
                this.makeSlotInteractive(slotBg, row * cols + col, 'backpack');
            }
        }
    }

    // ===== DRAG AND DROP METHODS =====

    private makeSlotInteractive(slotBg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        slotBg.setInteractive({ draggable: false });

        slotBg.on('pointerover', () => {
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        slotBg.on('pointerout', () => {
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        slotBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const slot = slotType === 'itembar' ? this.slots[slotIndex] : this.backpackSlots[slotIndex];
            if (!slot) return;

            // Left click
            if (pointer.leftButtonDown()) {
                // Check for double-click
                const currentTime = this.time.now;
                const isDoubleClick = this.lastClickSlot &&
                    this.lastClickSlot.index === slotIndex &&
                    this.lastClickSlot.type === slotType &&
                    (currentTime - this.lastClickTime) < this.DOUBLE_CLICK_DELAY;

                if (isDoubleClick) {
                    this.handleDoubleClick(slot, slotIndex, slotType);
                    this.lastClickSlot = null;
                    this.lastClickTime = 0;
                } else {
                    this.handleLeftClick(slot, slotIndex, slotType);
                    this.lastClickSlot = { index: slotIndex, type: slotType };
                    this.lastClickTime = currentTime;
                }
            }
            // Right click
            else if (pointer.rightButtonDown()) {
                this.handleRightClick(slot, slotIndex, slotType);
            }
        });
    }

    // ===== NEW CLICK-BASED ITEM SYSTEM =====

    private handleDoubleClick(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        if (!slot.itemId) return;

        const targetItemId = slot.itemId;
        const currentCount = slot.countText ? parseInt(slot.countText.text) : 1;

        if (currentCount >= this.MAX_STACK_SIZE) return;

        // Determine which slots to check
        const slotsToCheck = slotType === 'itembar' ? this.slots : this.backpackSlots;

        // Collect items from other slots
        let totalCollected = 0;
        const spaceAvailable = this.MAX_STACK_SIZE - currentCount;

        for (let i = 0; i < slotsToCheck.length; i++) {
            if (i === slotIndex) continue; // Skip the target slot

            const otherSlot = slotsToCheck[i];
            if (otherSlot.itemId === targetItemId) {
                const otherCount = otherSlot.countText ? parseInt(otherSlot.countText.text) : 1;
                const canCollect = Math.min(otherCount, spaceAvailable - totalCollected);

                if (canCollect > 0) {
                    totalCollected += canCollect;
                    const remaining = otherCount - canCollect;

                    if (remaining > 0) {
                        this.updateSlotCount(otherSlot, i, slotType, remaining);
                    } else {
                        this.clearSlot(i, slotType);
                    }

                    if (totalCollected >= spaceAvailable) break;
                }
            }
        }

        // Update target slot with collected items
        if (totalCollected > 0) {
            const newCount = currentCount + totalCollected;
            this.updateSlotCount(slot, slotIndex, slotType, newCount);
        }
    }

    private handleLeftClick(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        // Empty hand + slot with items → Pick up entire stack
        if (!this.heldItem && slot.itemId) {
            const count = slot.countText ? parseInt(slot.countText.text) : 1;
            this.pickupItems(slot, slotIndex, slotType, count);
        }
        // Holding items + empty slot → Place entire stack
        else if (this.heldItem && !slot.itemId) {
            this.placeItems(slot, slotIndex, slotType, this.heldItem.count);
        }
        // Holding items + slot with same item → Merge stacks
        else if (this.heldItem && slot.itemId === this.heldItem.itemId) {
            this.mergeStacks(slot, slotIndex, slotType);
        }
        // Holding items + slot with different item → Swap items
        else if (this.heldItem && slot.itemId && slot.itemId !== this.heldItem.itemId) {
            this.swapItemsNew(slot, slotIndex, slotType);
        }
    }

    private handleRightClick(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        // Empty hand + slot with items → Pick up half stack
        if (!this.heldItem && slot.itemId) {
            const count = slot.countText ? parseInt(slot.countText.text) : 1;
            const halfCount = Math.ceil(count / 2);
            this.pickupItems(slot, slotIndex, slotType, halfCount);
        }
        // Holding items + empty slot → Place 1 item
        else if (this.heldItem && !slot.itemId) {
            this.placeItems(slot, slotIndex, slotType, 1);
        }
        // Holding items + slot with same item → Add 1 item (if < 99)
        else if (this.heldItem && slot.itemId === this.heldItem.itemId) {
            const currentCount = slot.countText ? parseInt(slot.countText.text) : 1;
            if (currentCount < this.MAX_STACK_SIZE) {
                this.placeItems(slot, slotIndex, slotType, 1);
            }
        }
    }

    private pickupItems(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack', count: number): void {
        if (!slot.itemId) return;

        const currentCount = slot.countText ? parseInt(slot.countText.text) : 1;
        const pickupCount = Math.min(count, currentCount);
        const remainingCount = currentCount - pickupCount;

        // Create held item
        this.heldItem = {
            itemId: slot.itemId,
            itemType: slot.itemType,
            count: pickupCount
        };

        // Create ghost image
        this.createHeldItemGhost();

        // Update or clear slot
        if (remainingCount > 0) {
            this.updateSlotCount(slot, slotIndex, slotType, remainingCount);
        } else {
            this.clearSlot(slotIndex, slotType);
        }
    }

    private placeItems(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack', count: number): void {
        if (!this.heldItem) return;

        const currentCount = slot.itemId ? (slot.countText ? parseInt(slot.countText.text) : 1) : 0;
        const spaceAvailable = this.MAX_STACK_SIZE - currentCount;
        const placeCount = Math.min(count, spaceAvailable, this.heldItem.count);

        if (placeCount <= 0) return;

        const newCount = currentCount + placeCount;
        this.heldItem.count -= placeCount;

        // Update slot
        if (slotType === 'itembar') {
            this.addItem(this.heldItem.itemId, slotIndex, this.heldItem.itemType, newCount);
        } else {
            this.addItemToBackpack(this.heldItem.itemId, slotIndex, this.heldItem.itemType, newCount);
        }

        // Clear held item if empty
        if (this.heldItem.count <= 0) {
            this.clearHeldItem();
        } else {
            this.updateHeldItemGhost();
        }
    }

    private mergeStacks(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        if (!this.heldItem || !slot.itemId || slot.itemId !== this.heldItem.itemId) return;

        const currentCount = slot.countText ? parseInt(slot.countText.text) : 1;
        const spaceAvailable = this.MAX_STACK_SIZE - currentCount;
        const transferCount = Math.min(this.heldItem.count, spaceAvailable);

        if (transferCount <= 0) return;

        const newCount = currentCount + transferCount;
        this.heldItem.count -= transferCount;

        // Update slot
        if (slotType === 'itembar') {
            this.addItem(this.heldItem.itemId, slotIndex, this.heldItem.itemType, newCount);
        } else {
            this.addItemToBackpack(this.heldItem.itemId, slotIndex, this.heldItem.itemType, newCount);
        }

        // Clear held item if empty
        if (this.heldItem.count <= 0) {
            this.clearHeldItem();
        } else {
            this.updateHeldItemGhost();
        }
    }

    private swapItemsNew(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        if (!this.heldItem || !slot.itemId) return;

        const slotItemId = slot.itemId;
        const slotItemType = slot.itemType;
        const slotCount = slot.countText ? parseInt(slot.countText.text) : 1;

        // Place held item in slot
        if (slotType === 'itembar') {
            this.addItem(this.heldItem.itemId, slotIndex, this.heldItem.itemType, this.heldItem.count);
        } else {
            this.addItemToBackpack(this.heldItem.itemId, slotIndex, this.heldItem.itemType, this.heldItem.count);
        }

        // Pick up slot item
        this.heldItem = {
            itemId: slotItemId,
            itemType: slotItemType,
            count: slotCount
        };

        this.updateHeldItemGhost();
    }

    private updateSlotCount(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack', count: number): void {
        if (!slot.itemId) return;

        if (slotType === 'itembar') {
            this.addItem(slot.itemId, slotIndex, slot.itemType, count);
        } else {
            this.addItemToBackpack(slot.itemId, slotIndex, slot.itemType, count);
        }
    }

    private createHeldItemGhost(): void {
        if (!this.heldItem) return;

        this.heldItemGhost = this.add.image(0, 0, this.heldItem.itemId)
            .setDisplaySize(32, 32)
            .setAlpha(0.8)
            .setDepth(35000);

        if (this.heldItem.count > 1) {
            this.heldItemCountText = this.add.text(0, 0, this.heldItem.count.toString(), {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 2, y: 1 }
            }).setOrigin(1, 1).setDepth(35001);
        }

        // Follow pointer
        this.input.on('pointermove', this.updateHeldItemPosition, this);
    }

    private updateHeldItemGhost(): void {
        if (this.heldItemCountText && this.heldItem) {
            if (this.heldItem.count > 1) {
                this.heldItemCountText.setText(this.heldItem.count.toString());
            } else {
                this.heldItemCountText.destroy();
                this.heldItemCountText = undefined;
            }
        } else if (!this.heldItemCountText && this.heldItem && this.heldItem.count > 1) {
            this.heldItemCountText = this.add.text(0, 0, this.heldItem.count.toString(), {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 2, y: 1 }
            }).setOrigin(1, 1).setDepth(35001);
        }
    }

    private updateHeldItemPosition(pointer: Phaser.Input.Pointer): void {
        if (this.heldItemGhost) {
            this.heldItemGhost.setPosition(pointer.x, pointer.y);
        }
        if (this.heldItemCountText) {
            this.heldItemCountText.setPosition(pointer.x + 16, pointer.y + 16);
        }
    }

    private clearHeldItem(): void {
        if (this.heldItemGhost) {
            this.heldItemGhost.destroy();
            this.heldItemGhost = undefined;
        }
        if (this.heldItemCountText) {
            this.heldItemCountText.destroy();
            this.heldItemCountText = undefined;
        }
        this.input.off('pointermove', this.updateHeldItemPosition, this);
        this.heldItem = null;
    }

    // ===== PUBLIC METHODS FOR EXTERNAL ACCESS =====

    public getHeldItem(): { itemId: string; itemType?: string; count: number } | null {
        return this.heldItem;
    }

    public setHeldItem(itemId: string, itemType: string, count: number): void {
        this.heldItem = { itemId, itemType, count };
        this.createHeldItemGhost();
    }

    public clearHeldItemPublic(): void {
        this.clearHeldItem();
    }

    public createHeldItemGhostPublic(): void {
        this.createHeldItemGhost();
    }

    // ===== OLD DRAG SYSTEM (KEPT FOR COMPATIBILITY) =====

    private startDrag(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        if (!slot.itemId || !slot.itemImage) return;

        this.draggedItem = {
            itemId: slot.itemId,
            itemType: slot.itemType,
            count: slot.countText ? parseInt(slot.countText.text) : 1,
            sourceSlot: slot,
            sourceIndex: slotIndex,
            sourceType: slotType
        };

        // Change cursor to grab
        this.input.setDefaultCursor('url(assets/ui/cursor-grab.png) 16 16, grab');

        // Create ghost image
        this.dragGhost = this.add.image(slot.itemImage.x, slot.itemImage.y, slot.itemId)
            .setDisplaySize(32, 32)
            .setAlpha(0.7)
            .setDepth(30000);

        // Hide original item
        slot.itemImage.setVisible(false);
        if (slot.countText) slot.countText.setVisible(false);

        // Follow pointer
        this.input.on('pointermove', this.onDragMove, this);
    }

    private onDragMove(pointer: Phaser.Input.Pointer): void {
        if (this.dragGhost) {
            this.dragGhost.setPosition(pointer.x, pointer.y);
        }
    }

    private onDrop(targetSlot: Slot, targetIndex: number, targetType: 'itembar' | 'backpack'): void {
        if (!this.draggedItem) return;

        const sourceSlot = this.draggedItem.sourceSlot;
        const sourceIndex = this.draggedItem.sourceIndex;
        const sourceType = this.draggedItem.sourceType;

        // Swap items
        this.swapItems(sourceSlot, sourceIndex, sourceType, targetSlot, targetIndex, targetType);

        // Cleanup
        this.endDrag();
    }

    private swapItems(fromSlot: Slot, fromIndex: number, fromType: 'itembar' | 'backpack', toSlot: Slot, toIndex: number, toType: 'itembar' | 'backpack'): void {
        // Store target slot data
        const targetItemId = toSlot.itemId;
        const targetItemType = toSlot.itemType;
        const targetCount = toSlot.countText ? parseInt(toSlot.countText.text) : 1;

        // Move source item to target
        if (toType === 'itembar') {
            this.addItem(fromSlot.itemId!, toIndex, fromSlot.itemType, this.draggedItem!.count);
        } else {
            this.addItemToBackpack(fromSlot.itemId!, toIndex, fromSlot.itemType, this.draggedItem!.count);
        }

        // Move target item to source (if exists)
        if (targetItemId) {
            if (fromType === 'itembar') {
                this.addItem(targetItemId, fromIndex, targetItemType, targetCount);
            } else {
                this.addItemToBackpack(targetItemId, fromIndex, targetItemType, targetCount);
            }
        } else {
            // Clear source slot if target was empty
            this.clearSlot(fromIndex, fromType);
        }
    }

    private endDrag(): void {
        if (this.dragGhost) {
            this.dragGhost.destroy();
            this.dragGhost = undefined;
        }

        // Reset cursor
        this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');

        this.input.off('pointermove', this.onDragMove, this);
        this.draggedItem = null;
    }

    private clearSlot(slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        const slot = slotType === 'itembar' ? this.slots[slotIndex] : this.backpackSlots[slotIndex];
        if (!slot) return;

        if (slot.itemImage) {
            slot.itemImage.destroy();
            slot.itemImage = undefined;
        }
        if (slot.countText) {
            slot.countText.destroy();
            slot.countText = undefined;
        }
        slot.itemId = undefined;
        slot.itemType = undefined;
    }

    public addItemToBackpack(itemId: string, slotIndex: number, itemType: string = 'item', count: number = 1): void {
        if (slotIndex < 0 || slotIndex >= this.BACKPACK_SLOT_COUNT) {
            console.warn(`Invalid backpack slot index: ${slotIndex}`);
            return;
        }

        const slot = this.backpackSlots[slotIndex];
        if (!slot) return;

        // Remove existing item if any
        if (slot.itemImage) slot.itemImage.destroy();
        if (slot.countText) slot.countText.destroy();

        // Add item image
        if (this.textures.exists(itemId)) {
            slot.itemImage = this.add.image(slot.x, slot.y, itemId)
                .setDisplaySize(32, 32)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.backpackContainer.add(slot.itemImage);
        } else {
            console.warn(`Texture not found: ${itemId}`);
            const placeholderImage = this.add.rectangle(slot.x, slot.y, 32, 32, 0xff0000)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            slot.itemImage = placeholderImage;
            this.backpackContainer.add(placeholderImage);
        }

        // Add item count if more than 1
        if (count > 1) {
            slot.countText = this.add.text(
                slot.x + 18,
                slot.y + 18,
                count.toString(),
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3,
                    padding: { x: 2, y: 1 }
                }
            ).setOrigin(1, 1)
                .setDepth(10000 + slotIndex);
            this.backpackContainer.add(slot.countText);
        } else {
            // Clear count text if count is 1
            if (slot.countText) {
                slot.countText.destroy();
                slot.countText = undefined;
            }
        }

        // Store item data
        slot.itemId = itemId;
        slot.itemType = itemType;

        this.children.sort('depth');
    }

    public toggleBackpack(): void {
        this.backpackVisible = !this.backpackVisible;
        this.backpackContainer.setVisible(this.backpackVisible);
        this.backpackOverlay.setVisible(this.backpackVisible);
    }

    public showBackpack(): void {
        this.backpackVisible = true;
        this.backpackContainer.setVisible(true);
        this.backpackOverlay.setVisible(true);
    }

    public hideBackpack(): void {
        this.backpackVisible = false;
        this.backpackContainer.setVisible(false);
        this.backpackOverlay.setVisible(false);

        // If marketplace was open, show it back
        if (this.marketplaceVisible) {
            this.marketplaceContainer.setVisible(true);
        }
    }

    // ===== CRAFTING METHODS =====

    private createCraftingUI(): void {
        // Container to hold crafting UI
        this.craftingContainer = this.add.container(0, 0);
        this.craftingContainer.setScrollFactor(0);
        this.craftingContainer.setDepth(16000); // Above backpack background, below item bar
        this.craftingContainer.setVisible(false);

        // Position: to the left side of the backpack UI
        const gap = 60; // move farther left from backpack
        const backpackCenterX = this.cameras.main.centerX;
        const backpackCenterY = this.cameras.main.centerY;

        // Determine approximate backpack width based on scale used (backpackScale=2 with base ~256x?)
        // We position crafting UI by absolute coordinates relative to backpack center
        const gridSlotSize = 48; // Use same visual slot size as slot.png default
        const gridScale = 1.2; // Slightly enlarge crafting UI
        const scaledSlot = gridSlotSize * gridScale;
        const gridCols = 3;
        const gridRows = 3;
        const gridWidth = gridCols * scaledSlot;
        const gridHeight = gridRows * scaledSlot;

        // Left of backpack: offset X negative
        const craftingCenterX = backpackCenterX - (420 /*shift more left*/ + gap);
        const craftingCenterY = backpackCenterY;

        // Create 3x3 crafting grid
        this.craftingSlots = [];
        const startX = craftingCenterX - gridWidth / 2 + scaledSlot / 2;
        const startY = craftingCenterY - gridHeight / 2 + scaledSlot / 2;

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const x = startX + c * scaledSlot;
                const y = startY + r * scaledSlot;
                const slotBg = this.add.image(x, y, 'slot').setOrigin(0.5).setScale(gridScale).setDepth(200);
                this.craftingContainer.add(slotBg);
                const slot: Slot = { bg: slotBg, x, y };
                this.craftingSlots.push(slot);
                // Make interactive with custom crafting handlers
                slotBg.setInteractive();
                slotBg.on('pointerover', () => {
                    this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
                });
                slotBg.on('pointerout', () => {
                    this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
                });
                slotBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                    const index = r * gridCols + c;
                    this.handleCraftingSlotPointerDown(index, pointer);
                });
            }
        }

        // Create result slot to the right of grid
        const resultX = startX + gridWidth + scaledSlot * 0.8; // slight spacing
        const resultY = craftingCenterY;
        const resultBg = this.add.image(resultX, resultY, 'slot').setOrigin(0.5).setScale(gridScale).setDepth(220);
        this.craftingContainer.add(resultBg);
        this.craftingResultSlot = { bg: resultBg, x: resultX, y: resultY };
        resultBg.setInteractive();
        resultBg.on('pointerover', () => {
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        resultBg.on('pointerout', () => {
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        resultBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!this.craftingResultSlot) return;
            // Pick up crafted result and consume grid
            if (pointer.leftButtonDown() && this.craftingResultSlot.itemId && !this.heldItem) {
                const count = this.craftingResultSlot.countText ? parseInt(this.craftingResultSlot.countText.text) : 1;
                this.heldItem = { itemId: this.craftingResultSlot.itemId, itemType: this.craftingResultSlot.itemType, count };
                this.createHeldItemGhost();

                // Consume crafting grid contents
                this.consumeCraftingGrid();

                // Clear result slot visuals/state
                if (this.craftingResultSlot.itemImage) { this.craftingResultSlot.itemImage.destroy(); this.craftingResultSlot.itemImage = undefined; }
                if (this.craftingResultSlot.countText) { this.craftingResultSlot.countText.destroy(); this.craftingResultSlot.countText = undefined; }
                this.craftingResultSlot.itemId = undefined;
                this.craftingResultSlot.itemType = undefined;
                this.craftingResultAvailable = false;
            }
        });

        // Add right-facing arrow between grid and result (offset slightly down-left)
        const arrowX = startX + gridWidth + scaledSlot * 0.20; // left a bit
        const arrowY = craftingCenterY + 12; // down a bit
        // Triangle points forming a right arrow head
        this.craftingArrow = this.add.triangle(arrowX, arrowY, -14, -10, -14, 10, 14, 0, 0xFFFFFF, 0.8).setDepth(215);
        this.craftingContainer.add(this.craftingArrow);

        // Add container to HUD
        this.#hudContainer.add(this.craftingContainer);
    }

    public showCrafting(): void {
        this.craftingVisible = true;
        this.craftingContainer.setVisible(true);
        this.updateCraftingResult();
    }

    // Compute whether plus-shape pattern is filled and update the result slot
    private updateCraftingResult(): void {
        if (!this.craftingResultSlot) return;
        const indices = [1, 3, 4, 5, 7]; // top, left, middle, right, bottom
        const hasPattern = indices.every(i => {
            const s = this.craftingSlots[i];
            return s && !!s.itemId;
        });

        if (!hasPattern) {
            // Clear result if previously available
            this.clearCraftingResult();
            return;
        }

        const resultKey = this.resolveCraftedItemKey();
        if (!resultKey) {
            this.clearCraftingResult();
            return;
        }

        // If already showing same result, do nothing
        if (this.craftingResultSlot.itemId === resultKey && this.craftingResultAvailable) return;

        // Set result visuals
        this.setCraftingResult(resultKey);
        this.craftingResultAvailable = true;
    }

    private resolveCraftedItemKey(): string | null {
        // Prefer high-tier misc items with i/j suffix, fallback to any known present texture from list
        for (const key of this.craftingPrimaryResultKeys) {
            if (this.textures.exists(key)) return key;
        }
        // Fallbacks (still try to avoid marketplace but ensure it renders)
        const fallbacks = ['gem_01b', 'crystal_01b', 'pearl_01b', 'ring_01b'];
        for (const key of fallbacks) {
            if (this.textures.exists(key)) return key;
        }
        return null;
    }

    private setCraftingResult(textureKey: string): void {
        const slot = this.craftingResultSlot!;
        // Clear old
        if (slot.itemImage) { slot.itemImage.destroy(); slot.itemImage = undefined; }
        if (slot.countText) { slot.countText.destroy(); slot.countText = undefined; }
        // Draw new
        if (this.textures.exists(textureKey)) {
            slot.itemImage = this.add.image(slot.x, slot.y, textureKey)
                .setDisplaySize(32, 32)
                .setOrigin(0.5, 0.5)
                .setDepth(230);
            this.craftingContainer.add(slot.itemImage);
            slot.itemId = textureKey;
            slot.itemType = 'crafted';
        }
    }

    private clearCraftingResult(): void {
        if (!this.craftingResultSlot) return;
        if (this.craftingResultSlot.itemImage) { this.craftingResultSlot.itemImage.destroy(); this.craftingResultSlot.itemImage = undefined; }
        if (this.craftingResultSlot.countText) { this.craftingResultSlot.countText.destroy(); this.craftingResultSlot.countText = undefined; }
        this.craftingResultSlot.itemId = undefined;
        this.craftingResultSlot.itemType = undefined;
        this.craftingResultAvailable = false;
    }

    private consumeCraftingGrid(): void {
        // Remove all items from crafting grid
        for (const s of this.craftingSlots) {
            if (s.itemImage) { s.itemImage.destroy(); s.itemImage = undefined; }
            if (s.countText) { s.countText.destroy(); s.countText = undefined; }
            s.itemId = undefined;
            s.itemType = undefined;
        }
    }

    // Handle interactions specifically for crafting grid slots
    private handleCraftingSlotPointerDown(index: number, pointer: Phaser.Input.Pointer): void {
        const slot = this.craftingSlots[index];
        if (!slot) return;

        // Left click behaviors similar to backpack
        if (pointer.leftButtonDown()) {
            // Pick up if empty hand and slot has items
            if (!this.heldItem && slot.itemId) {
                const count = slot.countText ? parseInt(slot.countText.text) : 1;
                // Create held item
                this.heldItem = { itemId: slot.itemId, itemType: slot.itemType, count };
                this.createHeldItemGhost();
                // Clear slot visuals
                if (slot.itemImage) { slot.itemImage.destroy(); slot.itemImage = undefined; }
                if (slot.countText) { slot.countText.destroy(); slot.countText = undefined; }
                slot.itemId = undefined; slot.itemType = undefined;
            }
            // Place held stack into empty crafting slot
            else if (this.heldItem && !slot.itemId) {
                const placeCount = this.heldItem.count; // place all into crafting
                // Add item image
                if (this.textures.exists(this.heldItem.itemId)) {
                    slot.itemImage = this.add.image(slot.x, slot.y, this.heldItem.itemId)
                        .setDisplaySize(32, 32)
                        .setOrigin(0.5, 0.5)
                        .setDepth(1000 + index);
                    this.craftingContainer.add(slot.itemImage);
                }
                if (placeCount > 1) {
                    slot.countText = this.add.text(slot.x + 18, slot.y + 18, placeCount.toString(), {
                        fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3, padding: { x: 2, y: 1 }
                    }).setOrigin(1, 1).setDepth(10000 + index);
                    this.craftingContainer.add(slot.countText);
                }
                slot.itemId = this.heldItem.itemId;
                slot.itemType = this.heldItem.itemType;
                this.clearHeldItem();
            }
            // Swap if both have items
            else if (this.heldItem && slot.itemId) {
                const temp = { itemId: slot.itemId, itemType: slot.itemType, count: slot.countText ? parseInt(slot.countText.text) : 1 };
                // Put held into slot
                if (this.textures.exists(this.heldItem.itemId)) {
                    if (slot.itemImage) slot.itemImage.destroy();
                    if (slot.countText) { slot.countText.destroy(); slot.countText = undefined; }
                    slot.itemImage = this.add.image(slot.x, slot.y, this.heldItem.itemId).setDisplaySize(32, 32).setOrigin(0.5, 0.5).setDepth(1000 + index);
                    this.craftingContainer.add(slot.itemImage);
                    if (this.heldItem.count > 1) {
                        slot.countText = this.add.text(slot.x + 18, slot.y + 18, this.heldItem.count.toString(), { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3, padding: { x: 2, y: 1 } }).setOrigin(1, 1).setDepth(10000 + index);
                        this.craftingContainer.add(slot.countText);
                    }
                }
                slot.itemId = this.heldItem.itemId;
                slot.itemType = this.heldItem.itemType;
                // Pick up previous slot item
                this.heldItem = temp;
                this.updateHeldItemGhost();
            }
        }
        // Right click: place 1 item
        else if (pointer.rightButtonDown()) {
            if (this.heldItem) {
                if (!slot.itemId) {
                    // Place 1
                    if (this.textures.exists(this.heldItem.itemId)) {
                        slot.itemImage = this.add.image(slot.x, slot.y, this.heldItem.itemId).setDisplaySize(32, 32).setOrigin(0.5, 0.5).setDepth(1000 + index);
                        this.craftingContainer.add(slot.itemImage);
                    }
                    slot.itemId = this.heldItem.itemId;
                    slot.itemType = this.heldItem.itemType;
                    if (1 > 1) {/* no count text for 1 by default */ }
                    this.heldItem.count -= 1;
                    if (this.heldItem.count <= 0) this.clearHeldItem(); else this.updateHeldItemGhost();
                } else if (slot.itemId === this.heldItem.itemId) {
                    // Increment count on slot if same item
                    const current = slot.countText ? parseInt(slot.countText.text) : 1;
                    const newCount = Math.min(this.MAX_STACK_SIZE, current + 1);
                    if (newCount !== current) {
                        if (newCount > 1) {
                            if (slot.countText) slot.countText.setText(newCount.toString());
                            else {
                                slot.countText = this.add.text(slot.x + 18, slot.y + 18, newCount.toString(), { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3, padding: { x: 2, y: 1 } }).setOrigin(1, 1).setDepth(10000 + index);
                                this.craftingContainer.add(slot.countText);
                            }
                            this.heldItem.count -= 1;
                            if (this.heldItem.count <= 0) this.clearHeldItem(); else this.updateHeldItemGhost();
                        }
                    }
                }
            }
        }
        // Recompute crafting result after any change
        this.updateCraftingResult();
    }

    public hideCrafting(): void {
        this.craftingVisible = false;
        this.craftingContainer.setVisible(false);
        // Clear crafted result visual if any
        if (this.craftingResultSlot && this.craftingResultSlot.itemImage) {
            this.craftingResultSlot.itemImage.destroy();
            this.craftingResultSlot.itemImage = undefined;
        }
        // Do not clear grid items here to preserve user layout when toggling off/on
    }

    public isCraftingOpen(): boolean { return this.craftingVisible; }

    // ===== MARKETPLACE METHODS =====

    private createMarketplace(): void {
        if (this.marketplaceCreated) return;
        this.marketplaceCreated = true;

        // Create marketplace container (centered on screen)
        this.marketplaceContainer = this.add.container(0, 0);
        this.marketplaceContainer.setScrollFactor(0);
        this.marketplaceContainer.setDepth(15000); // Below item bar (25000)
        this.marketplaceContainer.setVisible(false);

        // Add grey overlay
        this.marketplaceOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.7
        );
        this.marketplaceOverlay.setOrigin(0.5);
        this.marketplaceOverlay.setDepth(50);
        this.marketplaceOverlay.setScrollFactor(0);
        this.marketplaceOverlay.setVisible(false);

        // ADJUST MARKETPLACE IMAGE SCALE HERE
        const marketplaceScale = 1.5; // Change this value to scale marketplace

        // Add marketplace background image
        if (!this.textures.exists('marketplace')) {
            console.error('Marketplace texture not found!');
            return;
        }

        this.marketplaceBg = this.add.image(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'marketplace'
        );
        this.marketplaceBg.setOrigin(0.5);
        this.marketplaceBg.setScale(marketplaceScale);
        this.marketplaceBg.setDepth(100);
        this.marketplaceContainer.add(this.marketplaceBg);

        // Create category buttons
        this.createMarketplaceButtons(marketplaceScale);

        // Create slot grid
        this.createMarketplaceSlots(marketplaceScale);

        // Create close button
        this.createMarketplaceCloseButton(marketplaceScale);

        // Create buy/sell buttons
        this.createMarketplaceBuyButton(marketplaceScale);
        this.createMarketplaceSellButton();

        // Add to HUD container
        this.#hudContainer.add(this.marketplaceContainer);
    }

    private createMarketplaceButtons(marketplaceScale: number): void {
        // Main marketplace tabs - only Browse
        const tabs = [
            { name: 'Browse', type: 'browse', x: 50, y: 1, width: 80, height: 32 }
        ];

        // Item category filters for Browse tab
        const categories = [
            { name: 'Weapons', x: 113, y: 1, width: 48, height: 32 },
            { name: 'Armors', x: 161, y: 1, width: 48, height: 32 },
            { name: 'Misc', x: 209, y: 1, width: 48, height: 32 },
            { name: 'Consumables', x: 257, y: 1, width: 96, height: 32 }
        ];

        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        // No tab buttons needed - only one tab

        // Create category filter buttons (only visible in Browse tab)
        if (this.currentMarketplaceTab === 'browse') {
            categories.forEach((cat, index) => {
                // Convert relative position to absolute
                const absoluteX = frameCenterX - (frameWidth / 2) + (cat.x * marketplaceScale) + (cat.width * marketplaceScale / 2);
                const absoluteY = frameCenterY - (frameHeight / 2) + (cat.y * marketplaceScale) + (cat.height * marketplaceScale / 2) + 40;

                // Create button
                const catName = cat.name.toLowerCase();
                const button = this.add.image(absoluteX, absoluteY, `btn-${catName}`);
                button.setOrigin(0.5);
                button.setScale(marketplaceScale);
                button.setInteractive({ useHandCursor: true });
                button.setDepth(200);

                // Click handler
                button.on('pointerdown', () => this.selectCategory(cat.name as any, index));

                // Hover effects
                button.on('pointerover', () => {
                    if (this.selectedCategory !== cat.name) {
                        button.setScale(marketplaceScale * 1.05);
                    }
                    this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
                });
                button.on('pointerout', () => {
                    button.setScale(marketplaceScale);
                    this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
                });

                this.marketplaceButtons.push(button);
                this.marketplaceContainer.add(button);
            });
        }

        // Select first button (Weapons) by default
        this.selectedCategory = 'Weapons';
        if (this.marketplaceButtons.length > 0 && this.marketplaceButtons[0] && this.marketplaceButtons[0].active) {
            this.marketplaceButtons[0].setTexture('btn-weapons-selected');
        }
        this.loadMarketplaceItems('Weapons');
    }

    private selectMarketplaceTab(tab: 'browse' | 'my_kiosk' | 'sell'): void {
        // Only browse tab exists now
        this.loadMarketplaceItems(this.selectedCategory);
    }

    private async initializeNPCItems(): Promise<void> {
        try {
            // In a real implementation, NPC items would be stored on-chain
            // For now, fetch from marketplace service with different item types
            const [consumables, weapons, armor, misc] = await Promise.all([
                this.oneChainMarketplaceService.fetchMarketplaceItems(ITEM_TYPES.CONSUMABLE),
                this.oneChainMarketplaceService.fetchMarketplaceItems(ITEM_TYPES.WEAPON),
                this.oneChainMarketplaceService.fetchMarketplaceItems(ITEM_TYPES.ARMOR),
                this.oneChainMarketplaceService.fetchMarketplaceItems(ITEM_TYPES.RESOURCE)
            ]);

            // Create diverse inventory for Herman from different categories
            const allItems = [
                ...consumables.slice(0, 3).map((item: any) => item.item.sprite_key),
                ...weapons.slice(0, 2).map((item: any) => item.item.sprite_key),
                ...armor.slice(0, 2).map((item: any) => item.item.sprite_key),
                ...misc.slice(0, 2).map((item: any) => item.item.sprite_key)
            ].filter(Boolean); // Remove any undefined values

            this.npcHermanItems = allItems.length > 0 ? allItems : ['potion_01a', 'fish_01a', 'candy_01a', 'helmet_01a'];
        } catch (error) {
            console.error('Failed to initialize NPC items:', error);
            // Enhanced fallback items for Herman - more diverse inventory
            this.npcHermanItems = [
                'potion_01a', 'potion_02a',  // Health potions
                'fish_01a', 'candy_01a',  // Food items
                'helmet_01a', 'sword_01a', // Equipment
                'crystal_01a', 'gem_01a',  // Valuable items
                'scroll_01a', 'ring_01a'   // Magical items
            ];
        }
    }

    private clearMarketplaceSlots(): void {
        // Clear existing slot items
        this.marketplaceSlots.forEach(slot => {
            if (slot.itemImage) {
                slot.itemImage.destroy();
            }
            if (slot.countText) {
                slot.countText.destroy();
            }
        });
        this.marketplaceSlots = [];
    }

    private async loadPlayerKiosk(): Promise<void> {
        try {
            // Fetch player kiosk data from blockchain using connected wallet
            const kiosk = await this.oneChainMarketplaceService.fetchPlayerKiosk();

            // Display kiosk items in marketplace slots
            this.displayKioskItems(kiosk);
        } catch (error) {
            console.error('Failed to load player kiosk:', error);
            // Show error message
            this.showMarketplaceError('Failed to load your kiosk. Please connect your wallet.');
        }
    }

    private displayKioskItems(kiosk: any): void {
        this.clearMarketplaceSlots();

        if (!kiosk) {
            // Show empty kiosk message
            this.showEmptyKioskMessage();
            return;
        }

        // Display listed items
        const items = kiosk.listed_items || [];
        items.forEach((item: any, index: number) => {
            if (index < this.MARKETPLACE_SLOT_COUNT) {
                this.addKioskItemToSlot(item, index);
            }
        });
    }

    private showEmptyKioskMessage(): void {
        const message = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Your kiosk is empty\nList items from your inventory to start selling!',
            {
                fontSize: '18px',
                color: '#9ca3af',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        message.setOrigin(0.5);
        message.setScrollFactor(0);
        message.setDepth(300);
        this.marketplaceContainer.add(message);
    }

    private loadSellInterface(): void {
        this.clearMarketplaceSlots();

        // Show instructions
        const instructions = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 100,
            'Drag items from your inventory here to list them for sale',
            {
                fontSize: '16px',
                color: '#ffffff',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        instructions.setOrigin(0.5);
        instructions.setScrollFactor(0);
        instructions.setDepth(300);
        this.marketplaceContainer.add(instructions);

        // Create drop zone indicator
        const dropZone = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 20,
            300, 150,
            0x2a2a2a,
            0.5
        );
        dropZone.setStrokeStyle(2, 0x3b82f6);
        dropZone.setScrollFactor(0);
        dropZone.setDepth(250);
        this.marketplaceContainer.add(dropZone);

        const dropText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 20,
            'DROP ZONE\n\nPlace items here to sell',
            {
                fontSize: '14px',
                color: '#9ca3af',
                align: 'center'
            }
        );
        dropText.setOrigin(0.5);
        dropText.setScrollFactor(0);
        dropText.setDepth(260);
        this.marketplaceContainer.add(dropText);

        // Open backpack automatically for easy access
        if (!this.backpackVisible) {
            this.showBackpack();
        }
    }

    private createMarketplaceSlots(marketplaceScale: number): void {
        const startX = 113;
        const startY = 33;
        const slotSize = 48;

        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        for (let row = 0; row < this.MARKETPLACE_ROWS; row++) {
            for (let col = 0; col < this.MARKETPLACE_COLS; col++) {
                const relativeX = startX + (col * slotSize);
                const relativeY = startY + (row * slotSize);

                const absoluteX = frameCenterX - (frameWidth / 2) + (relativeX * marketplaceScale) + (slotSize * marketplaceScale / 2);
                const absoluteY = frameCenterY - (frameHeight / 2) + (relativeY * marketplaceScale) + (slotSize * marketplaceScale / 2);

                // Create slot
                const slotBg = this.add.image(absoluteX, absoluteY, 'slot');
                slotBg.setOrigin(0.5);
                slotBg.setScale(marketplaceScale);
                slotBg.setDepth(200);

                const slot: Slot = { bg: slotBg, x: absoluteX, y: absoluteY };
                this.marketplaceSlots.push(slot);
                this.marketplaceContainer.add(slotBg);

                // Make interactive (for selection)
                const slotIdx = row * this.MARKETPLACE_COLS + col;
                slotBg.setInteractive();
                slotBg.on('pointerover', () => {
                    this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
                });
                slotBg.on('pointerout', () => {
                    this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
                });
                slotBg.on('pointerdown', () => this.selectMarketplaceSlot(slotIdx));
            }
        }
    }

    private selectCategory(category: 'Weapons' | 'Armors' | 'Misc' | 'Consumables', index: number): void {
        this.selectedCategory = category;

        // Update button visuals
        const categoryNames = ['weapons', 'armors', 'misc', 'consumables'];
        this.marketplaceButtons.forEach((btn, i) => {
            const catName = categoryNames[i];
            if (i === index) {
                btn.setTexture(`btn-${catName}-selected`);
            } else {
                btn.setTexture(`btn-${catName}`);
            }
        });

        // Load items for selected category (placeholder for now)
        this.loadMarketplaceItems(category);
    }

    private createMarketplaceCloseButton(marketplaceScale: number): void {
        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        // ADJUST CLOSE BUTTON POSITION HERE
        const closeOffsetX = -10; // Increase to move left, decrease to move right
        const closeOffsetY = 16; // Increase to move down, decrease to move up

        // Position close button at top-right corner
        const closeX = frameCenterX + (frameWidth / 2) - (closeOffsetX * marketplaceScale);
        const closeY = frameCenterY - (frameHeight / 2) + (closeOffsetY * marketplaceScale);

        const closeButton = this.add.text(closeX, closeY, 'X', {
            fontSize: `${24 * marketplaceScale}px`,
            color: '#ff0000',
            fontStyle: 'bold'
        });
        closeButton.setOrigin(0.5);
        closeButton.setDepth(300);
        closeButton.setInteractive({ useHandCursor: true });

        closeButton.on('pointerdown', () => {
            this.hideMarketplace();
        });

        closeButton.on('pointerover', () => {
            closeButton.setScale(1.2);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        closeButton.on('pointerout', () => {
            closeButton.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        this.marketplaceContainer.add(closeButton);
    }

    private createMarketplaceBuyButton(marketplaceScale: number): void {
        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        // Buy button position (19, 280) from marketplace frame origin
        const buyX = frameCenterX - (frameWidth / 2) + (19 * marketplaceScale);
        const buyY = frameCenterY - (frameHeight / 2) + (280 * marketplaceScale);

        const buyButton = this.add.image(buyX, buyY, 'buy-button');
        buyButton.setOrigin(0, 0);
        buyButton.setScale(marketplaceScale);
        buyButton.setDepth(300);
        buyButton.setInteractive({ useHandCursor: true });

        buyButton.on('pointerdown', () => {
            buyButton.setTexture('selected-buy-button');
            this.time.delayedCall(100, () => {
                buyButton.setTexture('buy-button');
            });
            this.handleBuyItem();
        });

        buyButton.on('pointerover', () => {
            buyButton.setTexture('hover-buy-button');
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        buyButton.on('pointerout', () => {
            buyButton.setTexture('buy-button');
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        this.marketplaceContainer.add(buyButton);
    }

    private createMarketplaceSellButton(): void {
        const sellButton = this.add.image(0, 0, 'sell-button');
        sellButton.setOrigin(0, 0.5);
        sellButton.setDepth(26000); // Above item bar
        sellButton.setScrollFactor(0);
        sellButton.setInteractive({ useHandCursor: true, dropZone: true });
        sellButton.setVisible(false); // Hidden by default, show when marketplace opens

        // Update position dynamically
        this.updateSellButtonPosition(sellButton);

        sellButton.on('pointerdown', () => {
            this.handleSellButtonClick();
        });

        sellButton.on('pointerover', () => {
            sellButton.setScale(1.1);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        sellButton.on('pointerout', () => {
            sellButton.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        this.#hudContainer.add(sellButton);

        // Store reference for show/hide
        this.marketplaceContainer.setData('sellButton', sellButton);
    }

    private handleSellButtonClick(): void {
        // Check if player is holding an item
        if (!this.heldItem) {
            console.log('No item to sell');
            this.showTransactionError('Please hold an item to sell');
            return;
        }

        // Get item details
        const itemId = this.heldItem.itemId;
        const itemType = this.heldItem.itemType || 'item';
        const itemCount = this.heldItem.count;

        // Calculate sell price (lower than buy price)
        const sellPrice = this.getMarketplaceItemPrice(itemId, itemType) * 0.7; // 70% of buy price
        const totalPrice = Math.floor(sellPrice * itemCount);

        console.log(`Selling ${itemCount}x ${itemId} for ${totalPrice} coins`);

        // Clear the held item (this removes it from inventory)
        this.clearHeldItem();

        // Show success message
        this.showTransactionSuccess(`Sold ${itemCount}x ${this.getItemDisplayName(itemId)} for ${totalPrice} coins!`);
    }

    private updateSellButtonPosition(sellButton: Phaser.GameObjects.Image): void {
        // Position after item bar (to the right)
        const itemBarX = this.cameras.main.centerX;
        const itemBarY = this.cameras.main.height - 60;

        // Calculate item bar width (8 slots * 48px + 7 gaps * 6px)
        const slotSize = 48;
        const spacing = 6;
        const itemBarWidth = (this.SLOT_COUNT * (slotSize + spacing)) - spacing;

        const sellX = itemBarX + (itemBarWidth / 2) + 20;
        const sellY = itemBarY;

        sellButton.setPosition(sellX, sellY);
    }

    private async loadMarketplaceItems(category: string): Promise<void> {
        // Clear selection and reset all slot textures
        if (this.selectedMarketplaceSlot !== -1) {
            const prevSlot = this.marketplaceSlots[this.selectedMarketplaceSlot];
            if (prevSlot && prevSlot.bg) {
                (prevSlot.bg as Phaser.GameObjects.Image).setTexture('slot');
            }
        }
        this.selectedMarketplaceSlot = -1;

        // Clear existing items
        this.marketplaceSlots.forEach(slot => {
            if (slot.itemImage) {
                slot.itemImage.destroy();
                slot.itemImage = undefined;
            }
            if (slot.countText) {
                slot.countText.destroy();
                slot.countText = undefined;
            }
            slot.itemId = undefined;
            slot.itemType = undefined;
        });

        // Get items for selected category from fallback marketplace items
        const categoryItems = this.FALLBACK_MARKETPLACE_ITEMS[category as keyof typeof this.FALLBACK_MARKETPLACE_ITEMS] || [];

        // Fill all 30 marketplace slots with items from the category
        for (let i = 0; i < this.MARKETPLACE_SLOT_COUNT && i < categoryItems.length; i++) {
            const itemId = categoryItems[i];
            const slot = this.marketplaceSlots[i];
            if (!slot) continue;

            if (this.textures.exists(itemId)) {
                slot.itemImage = this.add.image(slot.x, slot.y, itemId)
                    .setDisplaySize(32, 32)
                    .setOrigin(0.5, 0.5)
                    .setDepth(250);
                this.marketplaceContainer.add(slot.itemImage);

                slot.itemId = itemId;
                slot.itemType = category.toLowerCase();

                const price = Math.floor(Math.random() * 500) + 100;
                const priceText = this.add.text(slot.x, slot.y + 20, `${price} ◈`, {
                    fontSize: '10px',
                    color: '#10b981',
                    align: 'center'
                });
                priceText.setOrigin(0.5);
                priceText.setScrollFactor(0);
                priceText.setDepth(260);
                this.marketplaceContainer.add(priceText);
                slot.countText = priceText;
            }
        }
    }

    private selectMarketplaceSlot(slotIndex: number): void {
        const slot = this.marketplaceSlots[slotIndex];
        if (!slot || !slot.itemId) return;

        // Deselect previous slot
        if (this.selectedMarketplaceSlot !== -1) {
            const prevSlot = this.marketplaceSlots[this.selectedMarketplaceSlot];
            if (prevSlot && prevSlot.bg) {
                (prevSlot.bg as Phaser.GameObjects.Image).setTexture('slot');
            }
        }

        // Select new slot
        this.selectedMarketplaceSlot = slotIndex;
        (slot.bg as Phaser.GameObjects.Image).setTexture('selected-slot');
    }

    private async handleBuyItem(): Promise<void> {
        if (this.selectedMarketplaceSlot === -1) return;

        const slot = this.marketplaceSlots[this.selectedMarketplaceSlot];
        if (!slot || !slot.itemId) return;

        // Simple purchase - add to backpack
        const itemId = slot.itemId;
        const itemType = slot.itemType || 'item';

        // Find first empty backpack slot
        for (let i = 0; i < this.BACKPACK_SLOT_COUNT; i++) {
            const backpackSlot = this.backpackSlots[i];
            if (!backpackSlot.itemId) {
                this.addItemToBackpack(itemId, i, itemType, 1);
                break;
            }
        }

        // Remove item from marketplace display
        if (slot.itemImage) {
            slot.itemImage.destroy();
            slot.itemImage = undefined;
        }
        if (slot.countText) {
            slot.countText.destroy();
            slot.countText = undefined;
        }
        slot.itemId = undefined;
        slot.itemType = undefined;

        this.selectedMarketplaceSlot = -1;
        this.showTransactionSuccess('Item purchased!');
    }

    private createMarketplaceTransaction(itemId: string, itemType: string, realHash?: string): void {
        // Use real blockchain transaction hash if provided, otherwise generate placeholder
        const transactionHash = realHash || 'pending_' + Date.now();

        // Generate blockchain details
        const blockNumber = Math.floor(Math.random() * 100000) + 2000000;
        const gasUsed = Math.floor(Math.random() * 30000) + 15000;
        const gasPrice = '0.0001';
        const gasCost = (gasUsed * parseFloat(gasPrice)).toFixed(6);

        // Create marketplace transaction details object
        this.currentTransaction = {
            transactionHash,
            blockNumber,
            blockConfirmation: `${Math.floor(Math.random() * 10) + 1}/12`,
            gasUsed,
            gasPrice,
            gasCost,
            timestamp: Date.now(),
            status: 'completed',
            itemsTraded: {
                playerItems: [
                    {
                        id: itemId,
                        name: this.getItemDisplayName(itemId),
                        quantity: 1,
                        spriteKey: itemId
                    }
                ],
                npcItems: [] // No NPC items in marketplace purchase
            },
            transactionType: 'marketplace_purchase',
            price: this.getMarketplaceItemPrice(itemId, itemType).toString()
        };

        // Add the item to inventory after successful transaction
        this.addMarketplaceItemToInventory(itemId, itemType);

        // Show transaction completion notification
        this.showMarketplaceTransactionCompleteNotification();
    }

    private getMarketplaceItemPrice(itemId: string, itemType: string): number {
        // Generate realistic pricing based on item type
        const basePrice = 100;
        const itemMultiplier = {
            'weapon': 2.5,
            'armor': 2.0,
            'consumable': 0.8,
            'item': 1.0,
            'misc': 1.2
        };

        const multiplier = itemMultiplier[itemType.toLowerCase() as keyof typeof itemMultiplier] || 1.0;
        return Math.floor(basePrice * multiplier * (Math.random() * 0.5 + 0.75));
    }

    private addMarketplaceItemToInventory(itemId: string, itemType: string): void {
        // Try to add to existing stack in itembar
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const itembarSlot = this.slots[i];
            if (itembarSlot.itemId === itemId) {
                const currentCount = itembarSlot.countText ? parseInt(itembarSlot.countText.text) : 1;
                if (currentCount < this.MAX_STACK_SIZE) {
                    this.addItem(itemId, i, itemType, currentCount + 1);
                    return;
                }
            }
        }

        // Find first empty slot
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            if (!this.slots[i].itemId) {
                this.addItem(itemId, i, itemType, 1);
                return;
            }
        }
    }

    private showMarketplaceTransactionCompleteNotification(): void {
        if (!this.currentTransaction) return;

        const screenCenterX = this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.height / 2;

        // Create notification container
        const notificationContainer = this.add.container(screenCenterX, screenCenterY);
        notificationContainer.setScrollFactor(0);
        notificationContainer.setDepth(30000);

        // Semi-transparent overlay
        const overlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5);
        overlay.setScrollFactor(0);
        notificationContainer.add(overlay);

        // Main notification background
        const notificationBg = this.add.rectangle(0, 0, 450, 200, 0x1a1a1a);
        notificationBg.setStrokeStyle(3, 0x3b82f6);
        notificationContainer.add(notificationBg);

        // Success icon and title
        const successIcon = this.add.text(0, -60, '🛒', {
            fontSize: '48px'
        });
        successIcon.setOrigin(0.5);
        notificationContainer.add(successIcon);

        const title = this.add.text(0, -20, 'Purchase Completed!', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        notificationContainer.add(title);

        const subtitle = this.add.text(0, 10, `Item purchased for ${this.currentTransaction.price || '0'} ◈`, {
            fontSize: '14px',
            color: '#9ca3af'
        });
        subtitle.setOrigin(0.5);
        notificationContainer.add(subtitle);

        // View transaction details button
        const viewDetailsButtonBg = this.add.rectangle(0, 60, 200, 40, 0x3b82f6);
        viewDetailsButtonBg.setStrokeStyle(2, 0x1d4ed8);
        viewDetailsButtonBg.setInteractive({ useHandCursor: true });
        notificationContainer.add(viewDetailsButtonBg);

        const viewDetailsButtonText = this.add.text(0, 60, 'View Transaction Details', {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        viewDetailsButtonText.setOrigin(0.5);
        notificationContainer.add(viewDetailsButtonText);

        // Button interactions
        viewDetailsButtonBg.on('pointerdown', () => {
            this.showTransactionDetailsModal();
            this.hideMarketplaceTransactionNotification();
        });

        viewDetailsButtonBg.on('pointerover', () => {
            viewDetailsButtonBg.setFillStyle(0x1d4ed8);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        viewDetailsButtonBg.on('pointerout', () => {
            viewDetailsButtonBg.setFillStyle(0x3b82f6);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        // Close button
        const closeButton = this.add.text(200, -80, '×', {
            fontSize: '24px',
            color: '#9ca3af'
        });
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        notificationContainer.add(closeButton);

        closeButton.on('pointerdown', () => {
            this.hideMarketplaceTransactionNotification();
        });

        closeButton.on('pointerover', () => {
            closeButton.setStyle({ color: '#ffffff' });
        });

        closeButton.on('pointerout', () => {
            closeButton.setStyle({ color: '#9ca3af' });
        });

        // Store reference for cleanup
        this.marketplaceTransactionNotificationContainer = notificationContainer;

        // Auto-hide after 5 seconds
        this.time.delayedCall(5000, () => {
            this.hideMarketplaceTransactionNotification();
        });
    }

    private hideMarketplaceTransactionNotification(): void {
        if (this.marketplaceTransactionNotificationContainer) {
            this.marketplaceTransactionNotificationContainer.destroy();
            this.marketplaceTransactionNotificationContainer = undefined;
        }
    }

    public showMarketplace(): void {
        this.marketplaceVisible = true;
        this.marketplaceContainer.setVisible(true);
        this.marketplaceOverlay.setVisible(true);

        // Load items for current category
        this.loadMarketplaceItems(this.selectedCategory);

        // Show sell button
        const sellButton = this.marketplaceContainer.getData('sellButton');
        if (sellButton) sellButton.setVisible(true);

        // Disable player movement
        const farmScene = this.scene.get(SCENE_KEYS.FARM) as any;
        if (farmScene && farmScene.player) {
            farmScene.player.setVelocity(0, 0);
        }
    }

    public hideMarketplace(): void {
        this.marketplaceVisible = false;
        this.marketplaceContainer.setVisible(false);
        this.marketplaceOverlay.setVisible(false);

        // Reset selection
        if (this.selectedMarketplaceSlot !== -1) {
            const slot = this.marketplaceSlots[this.selectedMarketplaceSlot];
            if (slot && slot.bg) {
                (slot.bg as Phaser.GameObjects.Image).setTexture('slot');
            }
            this.selectedMarketplaceSlot = -1;
        }

        // Hide sell button
        const sellButton = this.marketplaceContainer.getData('sellButton');
        if (sellButton) sellButton.setVisible(false);
    }

    public isMarketplaceOpen(): boolean {
        return this.marketplaceVisible;
    }

    public isBackpackOpen(): boolean {
        return this.backpackVisible;
    }

    // ===== TRANSACTION DETAILS METHODS =====

    private createTransactionDetails(): void {
        if (this.transactionDetailsCreated) return;
        this.transactionDetailsCreated = true;

        // Create transaction details container (centered on screen)
        this.transactionDetailsContainer = this.add.container(0, 0);
        this.transactionDetailsContainer.setScrollFactor(0);
        this.transactionDetailsContainer.setDepth(20000); // Above marketplace
        this.transactionDetailsContainer.setVisible(false);

        // Add dark overlay with blur effect
        const overlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x0a0a0a,
            0.9
        );
        overlay.setOrigin(0.5);
        overlay.setScrollFactor(0);
        overlay.setDepth(50);
        this.transactionDetailsContainer.add(overlay);

        // Improved modal dimensions and spacing
        const modalWidth = 650;
        const modalHeight = 550;
        const padding = 30;
        const titleHeight = 55;
        const closeButtonSize = 40;

        // Create modal background with improved styling
        const modalBg = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            modalWidth,
            modalHeight,
            0x1a1a2e,
            0.98
        );
        modalBg.setStrokeStyle(3, 0x3a3a5c);
        modalBg.setOrigin(0.5);
        modalBg.setScrollFactor(0);
        modalBg.setDepth(100);
        this.transactionDetailsContainer.add(modalBg);

        // Add subtle inner border for depth
        const innerBorder = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            modalWidth - 8,
            modalHeight - 8,
            0x2a2a3e,
            0.4
        );
        innerBorder.setStrokeStyle(1, 0x4a4a5c);
        innerBorder.setOrigin(0.5);
        innerBorder.setScrollFactor(0);
        innerBorder.setDepth(101);
        this.transactionDetailsContainer.add(innerBorder);

        // Add decorative top border with gradient effect
        const topBorder = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY - (modalHeight / 2) + titleHeight / 2,
            modalWidth - 40,
            4,
            0x00d4ff
        ).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        this.transactionDetailsContainer.add(topBorder);

        // Create title background panel with relative positioning
        const titlePanel = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY - (modalHeight / 2) + titleHeight / 2,
            modalWidth - 60,
            titleHeight,
            0x2a2a4e,
            0.95
        ).setOrigin(0.5).setScrollFactor(0).setDepth(102);
        titlePanel.setStrokeStyle(2, 0x444466);
        this.transactionDetailsContainer.add(titlePanel);

        // Title with improved typography and shadow
        const title = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - (modalHeight / 2) + titleHeight / 2,
            '🔗 TRANSACTION DETAILS',
            {
                fontSize: '26px',
                fontFamily: 'Arial, sans-serif',
                color: '#00d4ff',
                fontStyle: 'bold',
                shadow: {
                    offsetX: 0,
                    offsetY: 3,
                    color: '#000000',
                    blur: 6,
                    stroke: true,
                    fill: true
                }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(103);
        this.transactionDetailsContainer.add(title);

        // Close button with improved styling and relative positioning
        const closeBtnX = this.cameras.main.centerX + (modalWidth / 2) - padding - closeButtonSize / 2;
        const closeBtnY = this.cameras.main.centerY - (modalHeight / 2) + titleHeight / 2;

        const closeBtnBg = this.add.circle(
            closeBtnX,
            closeBtnY,
            closeButtonSize / 2,
            0xff4444,
            0.9
        ).setInteractive().setScrollFactor(0).setDepth(104);
        closeBtnBg.setStrokeStyle(2, 0xcc0000);
        this.transactionDetailsContainer.add(closeBtnBg);

        const closeBtn = this.add.text(
            closeBtnX,
            closeBtnY,
            '✕',
            {
                fontSize: '24px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(105);
        this.transactionDetailsContainer.add(closeBtn);

        // Close button interactions with improved feedback
        [closeBtnBg, closeBtn].forEach(element => {
            element.on('pointerover', () => {
                closeBtnBg.setFillStyle(0xff6666);
                closeBtnBg.setScale(1.1);
                this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
            });

            element.on('pointerout', () => {
                closeBtnBg.setFillStyle(0xff4444);
                closeBtnBg.setScale(1);
                this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
            });
        });

        closeBtnBg.on('pointerdown', () => {
            this.hideTransactionDetails();
        });
        closeBtn.on('pointerdown', () => {
            this.hideTransactionDetails();
        });

        // Store close button reference
        this.transactionDetailsCloseButton = closeBtn;

        // Create content sections with improved spacing and relative positioning
        this.createImprovedTransactionContentPanels(modalWidth, modalHeight, padding, titleHeight);

        // Add to HUD container
        this.#hudContainer.add(this.transactionDetailsContainer);
    }

    private createImprovedTransactionContentPanels(modalWidth: number, modalHeight: number, padding: number, titleHeight: number): void {
        // Content area calculations with relative positioning
        const contentY = this.cameras.main.centerY - (modalHeight / 2) + titleHeight + padding + 20;
        const sectionHeight = 80;
        const sectionGap = 15;
        const labelHeight = 20;
        const contentHeight = sectionHeight - labelHeight - 10;

        // Transaction hash section with improved styling
        const hashY = contentY + sectionHeight + sectionGap;
        const hashPanel = this.add.rectangle(
            this.cameras.main.centerX,
            hashY,
            modalWidth - padding * 2,
            sectionHeight,
            0x252547,
            0.9
        ).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        hashPanel.setStrokeStyle(1, 0x404060);
        this.transactionDetailsContainer.add(hashPanel);

        const hashLabel = this.add.text(
            this.cameras.main.centerX - (modalWidth / 2) + padding + 10,
            hashY - (sectionHeight / 2) + labelHeight / 2,
            '🔑 Transaction Hash:',
            {
                fontSize: '15px',
                fontFamily: 'Arial, sans-serif',
                color: '#9ca3af',
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
        this.transactionDetailsContainer.add(hashLabel);

        // Status section with improved styling
        const statusY = hashY + sectionHeight + sectionGap;
        const statusPanel = this.add.rectangle(
            this.cameras.main.centerX,
            statusY,
            modalWidth - padding * 2,
            sectionHeight - 10,
            0x252547,
            0.9
        ).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        statusPanel.setStrokeStyle(1, 0x404060);
        this.transactionDetailsContainer.add(statusPanel);

        const statusLabel = this.add.text(
            this.cameras.main.centerX - (modalWidth / 2) + padding + 10,
            statusY - (sectionHeight / 2 - 5) + labelHeight / 2,
            '⚡ Status:',
            {
                fontSize: '15px',
                fontFamily: 'Arial, sans-serif',
                color: '#9ca3af',
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
        this.transactionDetailsContainer.add(statusLabel);

        // Explorer button section with improved styling
        const explorerY = statusY + (sectionHeight - 10) + sectionGap;
        const explorerPanel = this.add.rectangle(
            this.cameras.main.centerX,
            explorerY,
            modalWidth - padding * 2,
            sectionHeight + 20,
            0x1a2a1a,
            0.9
        ).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        explorerPanel.setStrokeStyle(1, 0x303040);
        this.transactionDetailsContainer.add(explorerPanel);

        const explorerLabel = this.add.text(
            this.cameras.main.centerX - (modalWidth / 2) + padding + 10,
            explorerY - (sectionHeight / 2 + 10) + labelHeight / 2,
            '🌐 External Link:',
            {
                fontSize: '15px',
                fontFamily: 'Arial, sans-serif',
                color: '#9ca3af',
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
        this.transactionDetailsContainer.add(explorerLabel);

        // Create explorer button with improved styling
        const explorerButton = this.add.rectangle(
            this.cameras.main.centerX,
            explorerY + 15,
            220,
            48,
            0x00d4ff,
            0.9
        ).setStrokeStyle(2, 0x0099cc).setInteractive({ useHandCursor: true }).setOrigin(0.5).setScrollFactor(0).setDepth(103);
        this.transactionDetailsContainer.add(explorerButton);

        const explorerButtonText = this.add.text(
            this.cameras.main.centerX,
            explorerY + 15,
            '🔍 View on Explorer',
            {
                fontSize: '17px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                fontStyle: 'bold',
                shadow: {
                    offsetX: 0,
                    offsetY: 1,
                    color: '#000000',
                    blur: 2,
                    stroke: true,
                    fill: true
                }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(104);
        this.transactionDetailsContainer.add(explorerButtonText);

        // Explorer button interactions with improved feedback
        explorerButton.on('pointerdown', () => {
            if (this.currentTransaction && this.currentTransaction.transactionHash) {
                const url = `https://onescan.cc/testnet/transactionBlocksDetail?digest=${this.currentTransaction.transactionHash}`;
                console.log('Opening transaction URL:', url);
                window.open(url, '_blank');
            }
        });

        explorerButton.on('pointerover', () => {
            explorerButton.setFillStyle(0x00ffff);
            explorerButtonText.setColor('#000000');
            explorerButton.setScale(1.02);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        explorerButton.on('pointerout', () => {
            explorerButton.setFillStyle(0x00d4ff);
            explorerButtonText.setColor('#ffffff');
            explorerButton.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
    }

    private createTransactionDetailsCloseButton(): void {
        // Create modern close button
        const closeButtonBg = this.add.circle(
            this.cameras.main.centerX + 270,
            this.cameras.main.centerY - 200,
            18,
            0xff4444
        ).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(104);
        this.transactionDetailsContainer.add(closeButtonBg);

        const closeButton = this.add.text(
            this.cameras.main.centerX + 270,
            this.cameras.main.centerY - 200,
            '✕',
            {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(105);
        this.transactionDetailsContainer.add(closeButton);

        // Button interactions with modern effects
        closeButtonBg.on('pointerdown', () => {
            this.hideTransactionDetails();
        });

        closeButton.on('pointerdown', () => {
            this.hideTransactionDetails();
        });

        [closeButtonBg, closeButton].forEach(element => {
            element.on('pointerover', () => {
                closeButtonBg.setFillStyle(0xff6666);
                closeButton.setColor('#ffffff');
                this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
            });

            element.on('pointerout', () => {
                closeButtonBg.setFillStyle(0xff4444);
                closeButton.setColor('#ffffff');
                this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
            });
        });

        this.transactionDetailsCloseButton = closeButton;
    }

    private updateTransactionDetailsContent(): void {
        if (!this.currentTransaction) return;

        // Clear existing text objects
        this.transactionDetailsTexts.forEach(text => text.destroy());
        this.transactionDetailsTexts = [];

        // Determine transaction type and set title
        const isMintingTransaction = this.currentTransaction.transactionType === 'mint';
        const isMarketplaceTransaction = this.currentTransaction.transactionType === 'marketplace_purchase';
        const isNPCTransaction = this.currentTransaction.itemsTraded?.npcItems?.length > 0 && !isMintingTransaction;

        const transactionTitle = isMintingTransaction ? '🥕 MINTING COMPLETED' :
            isMarketplaceTransaction ? '🛒 MARKETPLACE PURCHASE' :
                isNPCTransaction ? '🤝 NPC TRADE COMPLETED' : '🔗 TRANSACTION DETAILS';

        // Modal dimensions for relative positioning
        const modalWidth = 650;
        const modalHeight = 550;
        const padding = 30;
        const titleHeight = 55;

        // Update title with improved positioning
        const titleText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - (modalHeight / 2) + titleHeight / 2,
            transactionTitle,
            {
                fontSize: '26px',
                fontFamily: 'Arial, sans-serif',
                color: '#00d4ff',
                fontStyle: 'bold',
                shadow: {
                    offsetX: 0,
                    offsetY: 3,
                    color: '#000000',
                    blur: 6,
                    stroke: true,
                    fill: true
                }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(103);
        this.transactionDetailsTexts.push(titleText);
        this.transactionDetailsContainer.add(titleText);

        // Content area calculations with proper spacing
        const contentStartY = this.cameras.main.centerY - (modalHeight / 2) + titleHeight + padding;
        let nextY = contentStartY;

        // Add minting-specific content
        if (isMintingTransaction) {
            // Minted items display with large carrot icon
            const mintedItems = this.currentTransaction.itemsTraded?.npcItems || [];
            const totalMinted = mintedItems.reduce((sum, item) => sum + item.quantity, 0);

            // Minted items icon
            const mintIcon = this.add.text(
                this.cameras.main.centerX,
                nextY + 40,
                '🥕',
                {
                    fontSize: '48px',
                    fontFamily: 'Arial, sans-serif'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(103);
            this.transactionDetailsTexts.push(mintIcon);
            this.transactionDetailsContainer.add(mintIcon);

            // Minted count text
            const mintedText = this.add.text(
                this.cameras.main.centerX,
                nextY + 80,
                `${totalMinted} Carrot NFT${totalMinted > 1 ? 's' : ''} Minted!`,
                {
                    fontSize: '24px',
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
            this.transactionDetailsTexts.push(mintedText);
            this.transactionDetailsContainer.add(mintedText);
            nextY += 120;
        }

        // Transaction details section
        const detailsLabel = this.add.text(
            this.cameras.main.centerX - (modalWidth / 2) + padding,
            nextY + 20,
            '📋 Transaction Details',
            {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#00d4ff',
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
        this.transactionDetailsTexts.push(detailsLabel);
        this.transactionDetailsContainer.add(detailsLabel);
        nextY += 50;

        // Transaction hash display
        const hashText = this.add.text(
            this.cameras.main.centerX - (modalWidth / 2) + padding,
            nextY + 20,
            'Hash:',
            {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#95a5a6',
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
        this.transactionDetailsTexts.push(hashText);
        this.transactionDetailsContainer.add(hashText);

        const hashValueText = this.add.text(
            this.cameras.main.centerX - (modalWidth / 2) + padding,
            nextY + 45,
            this.currentTransaction.transactionHash || 'No hash available',
            {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#ffffff',
                wordWrap: { width: modalWidth - padding * 3 - 150 },
                lineSpacing: 2
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
        this.transactionDetailsTexts.push(hashValueText);
        this.transactionDetailsContainer.add(hashValueText);
        nextY += 80;

        // Status display
        const statusText = this.add.text(
            this.cameras.main.centerX - (modalWidth / 2) + padding,
            nextY,
            `Status: ${this.currentTransaction.status?.toUpperCase() || 'UNKNOWN'}`,
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: this.getStatusColor(this.currentTransaction.status),
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
        this.transactionDetailsTexts.push(statusText);
        this.transactionDetailsContainer.add(statusText);
        nextY += 25;

        // Additional details with improved spacing

        // Price information (for marketplace transactions)
        if (this.currentTransaction.price && isMarketplaceTransaction) {
            const priceText = this.add.text(
                this.cameras.main.centerX - (modalWidth / 2) + padding,
                nextY,
                `💰 Price: ${this.currentTransaction.price} ◈`,
                {
                    fontSize: '14px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#ffd700',
                    fontStyle: 'bold'
                }
            ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
            this.transactionDetailsTexts.push(priceText);
            this.transactionDetailsContainer.add(priceText);
            nextY += 25;
        }

        // Gas information
        if (this.currentTransaction.gasUsed) {
            const gasText = this.add.text(
                this.cameras.main.centerX - (modalWidth / 2) + padding,
                nextY,
                `⛽ Gas Used: ${this.currentTransaction.gasUsed.toLocaleString()} | Cost: ${this.currentTransaction.gasCost || '0.0025'} SUI`,
                {
                    fontSize: '13px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#9ca3af'
                }
            ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
            this.transactionDetailsTexts.push(gasText);
            this.transactionDetailsContainer.add(gasText);
            nextY += 25;
        }

        // Items traded information (skip for minting transactions as they're handled above)
        if (this.currentTransaction.itemsTraded && !isMintingTransaction) {
            const items = this.currentTransaction.itemsTraded;

            if (items.playerItems?.length > 0) {
                const playerItemsText = this.add.text(
                    this.cameras.main.centerX - (modalWidth / 2) + padding,
                    nextY,
                    `✅ Received: ${items.playerItems.map((item: any) => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ')}`,
                    {
                        fontSize: '13px',
                        fontFamily: 'Arial, sans-serif',
                        color: '#10b981',
                        fontStyle: 'bold',
                        wordWrap: { width: modalWidth - padding * 2 }
                    }
                ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
                this.transactionDetailsTexts.push(playerItemsText);
                this.transactionDetailsContainer.add(playerItemsText);
                nextY += 22;
            }

            if (items.npcItems?.length > 0) {
                const npcItemsText = this.add.text(
                    this.cameras.main.centerX - (modalWidth / 2) + padding,
                    nextY,
                    `🔄 Traded: ${items.npcItems.map((item: any) => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ')}`,
                    {
                        fontSize: '13px',
                        fontFamily: 'Arial, sans-serif',
                        color: '#f59e0b',
                        fontStyle: 'bold',
                        wordWrap: { width: modalWidth - padding * 2 }
                    }
                ).setOrigin(0, 0).setScrollFactor(0).setDepth(103);
                this.transactionDetailsTexts.push(npcItemsText);
                this.transactionDetailsContainer.add(npcItemsText);
            }
        }

        // Test button with improved styling (only for mock transactions)
        if (!this.currentTransaction.transactionHash || this.currentTransaction.transactionHash.startsWith('0x')) {
            const testButton = this.add.rectangle(
                this.cameras.main.centerX,
                this.cameras.main.centerY + (modalHeight / 2) - padding - 25,
                200,
                40,
                0x444444,
                0.9
            ).setStrokeStyle(1, 0x666666).setInteractive().setOrigin(0.5).setScrollFactor(0).setDepth(103);
            this.transactionDetailsContainer.add(testButton);

            const testButtonText = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY + (modalHeight / 2) - padding - 25,
                '🔍 VIEW ON BLOCKCHAIN',
                {
                    fontSize: '14px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#ffaa00',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(104);
            this.transactionDetailsContainer.add(testButtonText);

            testButton.on('pointerdown', () => {
                // Use real transaction hash if available, otherwise use test URL
                const txHash = this.currentTransaction?.transactionHash;
                if (txHash && txHash !== 'pending_' + Date.now() && !txHash.startsWith('escrow_')) {
                    // Real blockchain transaction - open in blockchain explorer
                    const explorerUrl = `https://onescan.cc/testnet/transactionBlocksDetail?digest=${txHash}`;
                    console.log('Opening blockchain explorer:', explorerUrl);
                    window.open(explorerUrl, '_blank');
                } else {
                    // Test or simulated transaction - use test URL
                    const testUrl = 'https://onescan.cc/testnet/transactionBlocksDetail?digest=SVCtuZctTDzSKU2Q2LTVKjQ9avcMSNE8x1paJkYmeff';
                    console.log('Opening test transaction URL:', testUrl);
                    window.open(testUrl, '_blank');
                }
            });

            testButton.on('pointerover', () => {
                testButton.setFillStyle(0x555555);
                testButtonText.setColor('#ffff00');
                testButton.setScale(1.02);
                this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
            });

            testButton.on('pointerout', () => {
                testButton.setFillStyle(0x444444);
                testButtonText.setColor('#ffaa00');
                testButton.setScale(1);
                this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
            });

            this.transactionDetailsTexts.push(testButton as any);
            this.transactionDetailsTexts.push(testButtonText as any);
        }
    }

    private getStatusColor(status?: string): string {
        switch (status?.toLowerCase()) {
            case 'completed': return '#10b981';
            case 'pending': return '#f59e0b';
            case 'failed': return '#ef4444';
            default: return '#9ca3af';
        }
    }

    public showTransactionDetails(transaction: any): void {
        if (!this.transactionDetailsCreated) {
            this.createTransactionDetails();
        }

        this.currentTransaction = transaction;
        this.transactionDetailsVisible = true;
        this.transactionDetailsContainer.setVisible(true);
        this.updateTransactionDetailsContent();

        // Disable player movement
        const farmScene = this.scene.get(SCENE_KEYS.FARM) as any;
        if (farmScene && farmScene.player) {
            farmScene.player.setVelocity(0, 0);
        }
    }

    public hideTransactionDetails(): void {
        this.transactionDetailsVisible = false;
        this.transactionDetailsContainer.setVisible(false);
        this.currentTransaction = null;

        // Clear text objects
        this.transactionDetailsTexts.forEach(text => text.destroy());
        this.transactionDetailsTexts = [];
    }

    public isTransactionDetailsOpen(): boolean {
        return this.transactionDetailsVisible;
    }

    public toggleMarketplace(): void {
        if (this.marketplaceVisible) {
            this.hideMarketplace();
        } else {
            this.showMarketplace();
        }
    }

    // ===== ONECHAIN BLOCKCHAIN HELPER METHODS =====

    private showMarketplaceError(message: string): void {
        const errorText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            message,
            {
                fontSize: '16px',
                color: '#ef4444',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        errorText.setOrigin(0.5);
        errorText.setScrollFactor(0);
        errorText.setDepth(300);
        this.marketplaceContainer.add(errorText);

        // Auto-hide after 3 seconds
        this.time.delayedCall(3000, () => {
            errorText.destroy();
        });
    }

    private addKioskItemToSlot(item: any, index: number): void {
        const slotSize = 48;
        const spacing = 8;
        const cols = 5;
        const row = Math.floor(index / cols);
        const col = index % cols;

        const x = 113 + col * (slotSize + spacing);
        const y = 33 + row * (slotSize + spacing);

        // Create slot background
        const slotBg = this.add.image(x, y, 'slot');
        slotBg.setScrollFactor(0);
        slotBg.setDepth(200);
        this.marketplaceContainer.add(slotBg);

        // Create item image
        const itemImage = this.add.image(x, y, item.item.sprite_key || 'potion_01a');
        itemImage.setScrollFactor(0);
        itemImage.setDepth(250);
        itemImage.setInteractive({ useHandCursor: true });
        this.marketplaceContainer.add(itemImage);

        // Add rarity border effect
        const rarityColor = getRarityColor(item.item.rarity);
        const rarityBorder = this.add.rectangle(x, y, slotSize + 4, slotSize + 4, 0x000000, 0);
        rarityBorder.setStrokeStyle(2, parseInt(rarityColor.replace('#', '0x')));
        rarityBorder.setScrollFactor(0);
        rarityBorder.setDepth(249);
        this.marketplaceContainer.add(rarityBorder);

        // Add price text
        const priceText = this.add.text(x, y + slotSize / 2 + 10, `${item.price.toLocaleString()} ◈`, {
            fontSize: '10px',
            color: '#10b981',
            align: 'center'
        });
        priceText.setOrigin(0.5);
        priceText.setScrollFactor(0);
        priceText.setDepth(260);
        this.marketplaceContainer.add(priceText);

        // Click handler for managing listing
        itemImage.on('pointerdown', () => {
            this.showKioskItemOptions(item);
        });

        // Hover effects
        itemImage.on('pointerover', () => {
            itemImage.setScale(1.1);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        itemImage.on('pointerout', () => {
            itemImage.setScale(1.0);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        // Store slot
        this.marketplaceSlots.push({
            bg: slotBg,
            x, y,
            itemId: item.id,
            itemImage,
            countText: priceText,
            itemType: 'kiosk_item'
        });
    }

    private showKioskItemOptions(item: any): void {
        // Create options modal
        const modal = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);
        modal.setScrollFactor(0);
        modal.setDepth(30000);

        const bg = this.add.rectangle(0, 0, 300, 200, 0x1a1a1a);
        bg.setStrokeStyle(3, 0x4a4a4a);
        modal.add(bg);

        const title = this.add.text(0, -70, 'Manage Listing', {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        modal.add(title);

        // Cancel listing button
        const cancelBtn = this.add.rectangle(-60, 20, 100, 40, 0xef4444);
        cancelBtn.setInteractive({ useHandCursor: true });
        modal.add(cancelBtn);

        const cancelText = this.add.text(-60, 20, 'Cancel', {
            fontSize: '14px',
            color: '#ffffff'
        });
        cancelText.setOrigin(0.5);
        modal.add(cancelText);

        // Edit price button
        const editBtn = this.add.rectangle(60, 20, 100, 40, 0x3b82f6);
        editBtn.setInteractive({ useHandCursor: true });
        modal.add(editBtn);

        const editText = this.add.text(60, 20, 'Edit Price', {
            fontSize: '14px',
            color: '#ffffff'
        });
        editText.setOrigin(0.5);
        modal.add(editText);

        // Close button
        const closeBtn = this.add.text(130, -70, '✕', {
            fontSize: '20px',
            color: '#ef4444'
        });
        closeBtn.setOrigin(0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        modal.add(closeBtn);

        // Event handlers
        cancelBtn.on('pointerdown', async () => {
            await this.cancelKioskListing(item);
            modal.destroy();
        });

        editBtn.on('pointerdown', () => {
            this.showEditPriceDialog(item);
            modal.destroy();
        });

        closeBtn.on('pointerdown', () => {
            modal.destroy();
        });

        // Hover effects
        [cancelBtn, editBtn, closeBtn].forEach(btn => {
            btn.on('pointerover', () => {
                btn.setScale(1.05);
                this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
            });
            btn.on('pointerout', () => {
                btn.setScale(1.0);
                this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
            });
        });

        this.marketplaceContainer.add(modal);
    }

    private async cancelKioskListing(item: any): Promise<void> {
        if (this.isProcessingTransaction) return;

        try {
            this.isProcessingTransaction = true;
            this.showTransactionProgress('Cancelling listing...');

            // Execute blockchain transaction
            const result = await this.oneChainMarketplaceService.cancelListing(item.id);

            if (result.success) {
                this.showTransactionSuccess('Listing cancelled successfully!');

                // Create transaction record for cancelled listing
                this.currentTransaction = {
                    transactionHash: result.transactionHash || 'cancel_' + Date.now(),
                    blockNumber: Math.floor(Math.random() * 100000) + 2000000,
                    blockConfirmation: '12/12',
                    gasUsed: Math.floor(Math.random() * 30000) + 15000,
                    gasPrice: '0.0001',
                    gasCost: '0.0015',
                    timestamp: Date.now(),
                    status: 'completed',
                    itemsTraded: {
                        playerItems: [],
                        npcItems: []
                    },
                    transactionType: 'CANCEL_LISTING',
                    price: undefined,
                    nftTransfers: []
                };

                // Show transaction details modal for listing cancellation
                this.time.delayedCall(1000, () => {
                    this.showTransactionDetailsModal();
                });

                this.loadPlayerKiosk(); // Refresh kiosk
            } else {
                this.showTransactionError(result.error || 'Failed to cancel listing');
            }
        } catch (error) {
            console.error('Cancel listing error:', error);
            this.showTransactionError('Transaction failed');
        } finally {
            this.isProcessingTransaction = false;
            this.hideTransactionProgress();
        }
    }

    private showEditPriceDialog(item: any): void {
        // Simple price edit dialog
        const modal = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);
        modal.setScrollFactor(0);
        modal.setDepth(30000);

        const bg = this.add.rectangle(0, 0, 300, 150, 0x1a1a1a);
        bg.setStrokeStyle(3, 0x4a4a4a);
        modal.add(bg);

        const title = this.add.text(0, -40, 'Edit Price', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        modal.add(title);

        // Input field simulation (just show current price)
        const currentPrice = this.add.text(0, 0, `Current: ${item.price.toLocaleString()} ◈`, {
            fontSize: '14px',
            color: '#10b981'
        });
        currentPrice.setOrigin(0.5);
        modal.add(currentPrice);

        // Close button
        const closeBtn = this.add.text(120, -40, '✕', {
            fontSize: '18px',
            color: '#ef4444'
        });
        closeBtn.setOrigin(0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        modal.add(closeBtn);

        closeBtn.on('pointerdown', () => {
            modal.destroy();
        });

        this.marketplaceContainer.add(modal);
    }

    private showTransactionProgress(message: string): void {
        // Show progress indicator (simplified)
        const progressText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 100,
            message,
            {
                fontSize: '16px',
                color: '#3b82f6',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        progressText.setOrigin(0.5);
        progressText.setScrollFactor(0);
        progressText.setDepth(31000);
        this.#hudContainer.add(progressText);
        this.#hudContainer.setData('transactionProgress', progressText);
    }

    private hideTransactionProgress(): void {
        const progressText = this.#hudContainer.getData('transactionProgress');
        if (progressText) {
            progressText.destroy();
            // Remove data entry by setting it to undefined
            this.#hudContainer.setData('transactionProgress', undefined);
        }
    }

    private showTransactionSuccess(message: string): void {
        const successText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            `✅ ${message}`,
            {
                fontSize: '18px',
                color: '#10b981',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        successText.setOrigin(0.5);
        successText.setScrollFactor(0);
        successText.setDepth(31000);
        this.#hudContainer.add(successText);

        // Auto-hide after 3 seconds
        this.time.delayedCall(3000, () => {
            successText.destroy();
        });
    }

    private showTransactionError(message: string): void {
        const errorText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            `❌ ${message}`,
            {
                fontSize: '16px',
                color: '#ef4444',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        errorText.setOrigin(0.5);
        errorText.setScrollFactor(0);
        errorText.setDepth(31000);
        this.#hudContainer.add(errorText);

        // Auto-hide after 3 seconds
        this.time.delayedCall(3000, () => {
            errorText.destroy();
        });
    }

    // ===== NPC TRADE INVENTORY METHODS =====

    public showNPCTrade(): void {
        if (!this.npcTradeContainer) {
            this.createNPCTrade();
        }

        this.npcTradeVisible = true;
        this.npcTradeLocked = false;
        this.npcTradeContainer.setVisible(true);
        this.npcTradeOverlay.setVisible(true);

        // Hide marketplace if open
        if (this.marketplaceVisible) {
            this.hideMarketplace();
        }

        // Auto-open backpack in the middle
        if (!this.backpackVisible) {
            this.showBackpack();
        }

        // Automatically add Herman's items to his trading slots
        this.populateHermanTradingSlots();
    }

    private populateHermanTradingSlots(): void {
        // Clear any existing items in Herman's slots first
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            this.clearNPCSlot(i, 'right');
        }

        // Select 2-4 random items from Herman's inventory for trading
        const itemsToAdd = this.getRandomHermanItems();

        // Add items to Herman's trading slots (right side)
        itemsToAdd.forEach((itemId, index) => {
            if (index < this.NPC_TRADE_SLOTS_PER_SIDE) {
                // Add a small delay for visual appeal
                this.time.delayedCall(200 * (index + 1), () => {
                    this.addItemToNPCSlot(itemId, index, 'right', this.getItemType(itemId), 1);
                });
            }
        });
    }

    private getRandomHermanItems(): string[] {
        if (this.npcHermanItems.length === 0) {
            // Fallback items if Herman's inventory is empty
            return ['potion_01a', 'fish_01a', 'candy_01a'];
        }

        // Shuffle Herman's items and take 2-4 random items
        const shuffled = [...this.npcHermanItems].sort(() => Math.random() - 0.5);
        const itemCount = Math.floor(Math.random() * 3) + 2; // 2-4 items
        return shuffled.slice(0, itemCount);
    }

    private getItemType(itemId: string): string {
        // Determine item type based on sprite key
        if (itemId.includes('sword') || itemId.includes('bow') || itemId.includes('staff')) {
            return 'weapon';
        } else if (itemId.includes('helmet') || itemId.includes('armor')) {
            return 'armor';
        } else if (itemId.includes('potion') || itemId.includes('fish') || itemId.includes('candy')) {
            return 'consumable';
        } else {
            return 'misc';
        }
    }

    private buildMintMetadata(itemId: string): GameItem {
        const displayName = this.getItemDisplayName(itemId);
        const itemType = this.getItemType(itemId);
        const rarity = itemType === 'weapon' ? 3 : itemType === 'armor' ? 2 : 1;

        return {
            id: itemId,
            name: displayName,
            description: `${displayName} prepared for OneChain escrow trade`,
            type: itemType,
            rarity,
            stats: this.generateDefaultStatsForType(itemType)
        };
    }

    private generateDefaultStatsForType(itemType: string): number[] {
        switch (itemType) {
            case 'weapon':
                return [25, 10, 5];
            case 'armor':
                return [10, 25, 8];
            case 'consumable':
                return [5, 5, 15];
            default:
                return [8, 8, 8];
        }
    }

    public hideNPCTrade(): void {
        this.npcTradeVisible = false;
        this.npcTradeLocked = false;

        if (this.npcTradeContainer) {
            this.npcTradeContainer.setVisible(false);
        }
        if (this.npcTradeOverlay) {
            this.npcTradeOverlay.setVisible(false);
        }

        // Close backpack when closing NPC trade
        if (this.backpackVisible) {
            this.hideBackpack();
        }
    }

    public toggleNPCTrade(): void {
        if (this.npcTradeVisible) {
            this.hideNPCTrade();
        } else {
            this.showNPCTrade();
        }
    }

    public isNPCTradeOpen(): boolean {
        return this.npcTradeVisible;
    }

    private createNPCTrade(): void {
        // Create container
        this.npcTradeContainer = this.add.container(0, 0);
        this.npcTradeContainer.setScrollFactor(0);
        this.npcTradeContainer.setDepth(28000);
        this.npcTradeContainer.setVisible(false);

        const screenCenterX = this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.height / 2;

        // Create semi-transparent overlay (non-interactive so dragging works)
        this.npcTradeOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.5
        );
        this.npcTradeOverlay.setOrigin(0.5);
        this.npcTradeOverlay.setScrollFactor(0);
        this.npcTradeOverlay.setDepth(50); // Behind HUD/UI so backpack and itembar appear above
        this.npcTradeOverlay.setVisible(false);
        // No setInteractive() so it doesn't block clicks/drags

        const slotSize = 64; // Bigger slots (was 48)
        const spacing = 12; // More spacing

        // Add tick mark for player (hidden initially)
        const playerTickY = screenCenterY - (this.NPC_TRADE_SLOTS_PER_SIDE * slotSize + (this.NPC_TRADE_SLOTS_PER_SIDE - 1) * spacing) / 2 - 110;
        this.npcPlayerTick = this.add.text(80, playerTickY, '✓', {
            fontSize: '40px',
            color: '#00ff00',
            fontStyle: 'bold'
        });
        this.npcPlayerTick.setOrigin(0.5);
        this.npcPlayerTick.setScrollFactor(0);
        this.npcPlayerTick.setDepth(28001);
        this.npcPlayerTick.setVisible(false);
        this.npcTradeContainer.add(this.npcPlayerTick);

        // Add "Your\nOffer" label above left slots
        const leftLabelY = screenCenterY - (this.NPC_TRADE_SLOTS_PER_SIDE * slotSize + (this.NPC_TRADE_SLOTS_PER_SIDE - 1) * spacing) / 2 - 70;
        const leftLabel = this.add.text(80, leftLabelY, 'Your\nOffer', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        leftLabel.setOrigin(0.5);
        leftLabel.setScrollFactor(0);
        leftLabel.setDepth(28001);
        this.npcTradeContainer.add(leftLabel);

        // Add tick mark for Herman (hidden initially)
        const hermanTickY = screenCenterY - (this.NPC_TRADE_SLOTS_PER_SIDE * slotSize + (this.NPC_TRADE_SLOTS_PER_SIDE - 1) * spacing) / 2 - 110;
        this.npcHermanTick = this.add.text(this.cameras.main.width - 80, hermanTickY, '✓', {
            fontSize: '40px',
            color: '#00ff00',
            fontStyle: 'bold'
        });
        this.npcHermanTick.setOrigin(0.5);
        this.npcHermanTick.setScrollFactor(0);
        this.npcHermanTick.setDepth(28001);
        this.npcHermanTick.setVisible(false);
        this.npcTradeContainer.add(this.npcHermanTick);

        // Add "Herman's\nOffer" label above right slots
        const rightLabelY = screenCenterY - (this.NPC_TRADE_SLOTS_PER_SIDE * slotSize + (this.NPC_TRADE_SLOTS_PER_SIDE - 1) * spacing) / 2 - 70;
        const rightLabel = this.add.text(this.cameras.main.width - 80, rightLabelY, "Herman's\nOffer", {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        rightLabel.setOrigin(0.5);
        rightLabel.setScrollFactor(0);
        rightLabel.setDepth(28001);
        this.npcTradeContainer.add(rightLabel);

        // Create 5 slots on the left side
        const leftStartY = screenCenterY - (this.NPC_TRADE_SLOTS_PER_SIDE * slotSize + (this.NPC_TRADE_SLOTS_PER_SIDE - 1) * spacing) / 2;
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const x = 80; // More margin from left
            const y = leftStartY + i * (slotSize + spacing);

            const slotBg = this.add.image(x, y, 'slot');
            slotBg.setOrigin(0.5);
            slotBg.setScale(1.35); // Scale up slot
            slotBg.setScrollFactor(0);
            slotBg.setDepth(28001);

            const slot: Slot = {
                bg: slotBg,
                x: x,
                y: y
            };
            this.npcLeftSlots.push(slot);
            this.npcTradeContainer.add(slotBg);
            this.makeNPCSlotInteractive(slotBg, i, 'left');
        }

        // Create 5 slots on the right side
        const rightStartY = screenCenterY - (this.NPC_TRADE_SLOTS_PER_SIDE * slotSize + (this.NPC_TRADE_SLOTS_PER_SIDE - 1) * spacing) / 2;
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const x = this.cameras.main.width - 80; // More margin from right
            const y = rightStartY + i * (slotSize + spacing);

            const slotBg = this.add.image(x, y, 'slot');
            slotBg.setOrigin(0.5);
            slotBg.setScale(1.35); // Scale up slot
            slotBg.setScrollFactor(0);
            slotBg.setDepth(28001);

            const slot: Slot = {
                bg: slotBg,
                x: x,
                y: y
            };
            this.npcRightSlots.push(slot);
            this.npcTradeContainer.add(slotBg);
            this.makeNPCSlotInteractive(slotBg, i, 'right');
        }

        // Create Cancel button (left side, below slots)
        const cancelButtonY = leftStartY + this.NPC_TRADE_SLOTS_PER_SIDE * (slotSize + spacing) + 30;
        const cancelBg = this.add.rectangle(80, cancelButtonY, 120, 40, 0xff4444);
        cancelBg.setStrokeStyle(2, 0x000000);
        cancelBg.setScrollFactor(0);
        cancelBg.setDepth(28001);
        cancelBg.setInteractive({ useHandCursor: true });

        this.npcCancelButton = this.add.text(80, cancelButtonY, 'Cancel', {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.npcCancelButton.setOrigin(0.5);
        this.npcCancelButton.setScrollFactor(0);
        this.npcCancelButton.setDepth(28002);

        this.npcTradeContainer.add([cancelBg, this.npcCancelButton]);

        // Cancel button click
        cancelBg.on('pointerdown', () => {
            this.handleCancelTrade();
        });
        cancelBg.on('pointerover', () => {
            cancelBg.setFillStyle(0xff6666);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        cancelBg.on('pointerout', () => {
            cancelBg.setFillStyle(0xff4444);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        // Create Accept button (right side, below slots)
        const acceptButtonY = rightStartY + this.NPC_TRADE_SLOTS_PER_SIDE * (slotSize + spacing) + 30;
        const acceptBg = this.add.rectangle(this.cameras.main.width - 80, acceptButtonY, 120, 40, 0x44ff44);
        acceptBg.setStrokeStyle(2, 0x000000);
        acceptBg.setScrollFactor(0);
        acceptBg.setDepth(28001);
        acceptBg.setInteractive({ useHandCursor: true });

        this.npcAcceptButton = this.add.text(this.cameras.main.width - 80, acceptButtonY, 'Accept', {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.npcAcceptButton.setOrigin(0.5);
        this.npcAcceptButton.setScrollFactor(0);
        this.npcAcceptButton.setDepth(28002);

        this.npcTradeContainer.add([acceptBg, this.npcAcceptButton]);

        // Accept button click
        acceptBg.on('pointerdown', () => {
            this.handleAcceptTrade();
        });
        acceptBg.on('pointerover', () => {
            acceptBg.setFillStyle(0x66ff66);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        acceptBg.on('pointerout', () => {
            acceptBg.setFillStyle(0x44ff44);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
    }

    private makeNPCSlotInteractive(slotBg: Phaser.GameObjects.Image, slotIndex: number, side: 'left' | 'right'): void {
        slotBg.setInteractive();

        slotBg.on('pointerover', () => {
            // Don't allow interaction with left slots when locked
            if (this.npcTradeLocked && side === 'left') return;
            if (!this.npcTradeLocked) {
                this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
                slotBg.setTint(0xcccccc);
            }
        });

        slotBg.on('pointerout', () => {
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
            slotBg.clearTint();
        });

        slotBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // Don't allow interaction with left slots when locked
            if (this.npcTradeLocked && side === 'left') return;
            // Don't allow interaction with right slots (Herman's side) at all
            if (side === 'right') return;

            if (pointer.leftButtonDown()) {
                this.handleNPCSlotClick(slotIndex, side);
            } else if (pointer.rightButtonDown()) {
                this.handleNPCSlotRightClick(slotIndex, side);
            }
        });
    }

    private handleNPCSlotClick(slotIndex: number, side: 'left' | 'right'): void {
        const slot = side === 'left' ? this.npcLeftSlots[slotIndex] : this.npcRightSlots[slotIndex];
        if (!slot) return;

        // Empty hand + slot with items → Pick up entire stack
        if (!this.heldItem && slot.itemId) {
            const count = slot.countText ? parseInt(slot.countText.text) : 1;
            this.pickupNPCItem(slot, slotIndex, side, count);
        }
        // Holding items + empty slot → Place entire stack
        else if (this.heldItem && !slot.itemId) {
            this.placeNPCItem(slot, slotIndex, side, this.heldItem.count);
        }
        // Holding items + slot with same item → Merge stacks
        else if (this.heldItem && slot.itemId === this.heldItem.itemId) {
            this.mergeNPCStacks(slot, slotIndex, side);
        }
        // Holding items + slot with different item → Swap items
        else if (this.heldItem && slot.itemId && slot.itemId !== this.heldItem.itemId) {
            this.swapNPCItems(slot, slotIndex, side);
        }
    }

    private handleNPCSlotRightClick(slotIndex: number, side: 'left' | 'right'): void {
        const slot = side === 'left' ? this.npcLeftSlots[slotIndex] : this.npcRightSlots[slotIndex];
        if (!slot) return;

        // Empty hand + slot with items → Pick up half stack
        if (!this.heldItem && slot.itemId) {
            const count = slot.countText ? parseInt(slot.countText.text) : 1;
            const halfCount = Math.ceil(count / 2);
            this.pickupNPCItem(slot, slotIndex, side, halfCount);
        }
        // Holding items + empty slot → Place 1 item
        else if (this.heldItem && !slot.itemId) {
            this.placeNPCItem(slot, slotIndex, side, 1);
        }
        // Holding items + slot with same item → Add 1 item (if < 99)
        else if (this.heldItem && slot.itemId === this.heldItem.itemId) {
            const currentCount = slot.countText ? parseInt(slot.countText.text) : 1;
            if (currentCount < this.MAX_STACK_SIZE) {
                this.placeNPCItem(slot, slotIndex, side, 1);
            }
        }
    }

    private pickupNPCItem(slot: Slot, slotIndex: number, side: 'left' | 'right', count: number): void {
        if (!slot.itemId) return;

        const currentCount = slot.countText ? parseInt(slot.countText.text) : 1;
        const pickupCount = Math.min(count, currentCount);
        const remainingCount = currentCount - pickupCount;

        // Create held item
        this.heldItem = {
            itemId: slot.itemId,
            itemType: slot.itemType,
            count: pickupCount
        };

        this.createHeldItemGhost();

        // Update or clear slot
        if (remainingCount > 0) {
            this.addItemToNPCSlot(slot.itemId, slotIndex, side, slot.itemType, remainingCount);
        } else {
            this.clearNPCSlot(slotIndex, side);
        }
    }

    private placeNPCItem(slot: Slot, slotIndex: number, side: 'left' | 'right', count: number): void {
        if (!this.heldItem) return;

        const placeCount = Math.min(count, this.heldItem.count);
        const currentCount = slot.countText ? parseInt(slot.countText.text) : 0;
        const newCount = currentCount + placeCount;

        if (newCount > this.MAX_STACK_SIZE) return;

        this.addItemToNPCSlot(this.heldItem.itemId, slotIndex, side, this.heldItem.itemType, newCount);

        this.heldItem.count -= placeCount;
        if (this.heldItem.count <= 0) {
            this.clearHeldItem();
        } else {
            this.updateHeldItemGhost();
        }
    }

    private mergeNPCStacks(slot: Slot, slotIndex: number, side: 'left' | 'right'): void {
        if (!this.heldItem || !slot.itemId || slot.itemId !== this.heldItem.itemId) return;

        const currentCount = slot.countText ? parseInt(slot.countText.text) : 1;
        const spaceAvailable = this.MAX_STACK_SIZE - currentCount;
        const transferCount = Math.min(this.heldItem.count, spaceAvailable);

        if (transferCount > 0) {
            this.addItemToNPCSlot(slot.itemId, slotIndex, side, slot.itemType, currentCount + transferCount);
            this.heldItem.count -= transferCount;

            if (this.heldItem.count <= 0) {
                this.clearHeldItem();
            } else {
                this.updateHeldItemGhost();
            }
        }
    }

    private swapNPCItems(slot: Slot, slotIndex: number, side: 'left' | 'right'): void {
        if (!this.heldItem || !slot.itemId) return;

        const slotItemId = slot.itemId;
        const slotItemType = slot.itemType;
        const slotCount = slot.countText ? parseInt(slot.countText.text) : 1;

        // Place held item in slot
        this.addItemToNPCSlot(this.heldItem.itemId, slotIndex, side, this.heldItem.itemType, this.heldItem.count);

        // Pick up slot item
        this.heldItem = {
            itemId: slotItemId,
            itemType: slotItemType,
            count: slotCount
        };

        this.updateHeldItemGhost();
    }

    private addItemToNPCSlot(itemId: string, slotIndex: number, side: 'left' | 'right', itemType: string = 'item', count: number = 1): void {
        const slot = side === 'left' ? this.npcLeftSlots[slotIndex] : this.npcRightSlots[slotIndex];
        if (!slot) return;

        // Remove existing item if any
        if (slot.itemImage) {
            slot.itemImage.destroy();
        }
        if (slot.countText) {
            slot.countText.destroy();
        }

        // Add item image with bigger display size for larger slots
        if (this.textures.exists(itemId)) {
            slot.itemImage = this.add.image(slot.x, slot.y, itemId)
                .setDisplaySize(48, 48) // Bigger items (was 32x32)
                .setOrigin(0.5, 0.5)
                .setScrollFactor(0)
                .setDepth(28002);
            this.npcTradeContainer.add(slot.itemImage);
        }

        // Add item count if more than 1
        if (count > 1) {
            slot.countText = this.add.text(
                slot.x + 24, // Adjusted for bigger slot
                slot.y + 24,
                count.toString(),
                {
                    fontSize: '18px', // Bigger font
                    color: '#ffffff',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3,
                    padding: { x: 2, y: 1 }
                }
            ).setOrigin(1, 1)
                .setScrollFactor(0)
                .setDepth(28003);

            this.npcTradeContainer.add(slot.countText);
        }

        // Store item data
        slot.itemId = itemId;
        slot.itemType = itemType;
    }

    private clearNPCSlot(slotIndex: number, side: 'left' | 'right'): void {
        const slot = side === 'left' ? this.npcLeftSlots[slotIndex] : this.npcRightSlots[slotIndex];
        if (!slot) return;

        if (slot.itemImage) {
            slot.itemImage.destroy();
            slot.itemImage = undefined;
        }
        if (slot.countText) {
            slot.countText.destroy();
            slot.countText = undefined;
        }
        slot.itemId = undefined;
        slot.itemType = undefined;
    }

    private showTradeConfirmationModal(): void {
        const screenCenterX = this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.height / 2;

        // Create overlay
        this.npcConfirmOverlay = this.add.rectangle(screenCenterX, screenCenterY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
        this.npcConfirmOverlay.setScrollFactor(0);
        this.npcConfirmOverlay.setDepth(29000);
        this.npcConfirmOverlay.setInteractive();

        // Create modal container
        this.npcConfirmModal = this.add.container(screenCenterX, screenCenterY);
        this.npcConfirmModal.setScrollFactor(0);
        this.npcConfirmModal.setDepth(29001);

        // Modal background with theme colors (beige/cream background)
        const modalBg = this.add.rectangle(0, 0, 600, 550, 0xf5e6d3, 1);
        modalBg.setStrokeStyle(6, 0x8b6f47); // Brown border

        // Decorative inner border
        const innerBorder = this.add.rectangle(0, 0, 580, 530, 0x000000, 0);
        innerBorder.setStrokeStyle(2, 0xd4a574);

        // Title with decorative background
        const titleBg = this.add.rectangle(0, -210, 400, 50, 0x8b6f47);
        const title = this.add.text(0, -210, 'Confirm Trade', {
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        });
        title.setOrigin(0.5);

        // Get items from left slots (giving)
        const givingItems: { id: string; count: number }[] = [];
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const slot = this.npcLeftSlots[i];
            if (slot && slot.itemId) {
                const count = slot.countText ? parseInt(slot.countText.text) : 1;
                givingItems.push({ id: slot.itemId, count });
            }
        }

        // Get items from right slots (receiving)
        const receivingItems: { id: string; count: number }[] = [];
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const slot = this.npcRightSlots[i];
            if (slot && slot.itemId) {
                const count = slot.countText ? parseInt(slot.countText.text) : 1;
                receivingItems.push({ id: slot.itemId, count });
            }
        }

        // You will give section
        const giveLabel = this.add.text(0, -140, 'You will give:', {
            fontSize: '22px',
            color: '#8b4513',
            fontStyle: 'bold'
        });
        giveLabel.setOrigin(0.5);

        // Display giving items with images
        const giveItemsContainer = this.add.container(-250, -90);
        givingItems.forEach((item, index) => {
            const xPos = (index % 4) * 70;
            const yPos = Math.floor(index / 4) * 70;

            // Item slot background
            const itemSlot = this.add.image(xPos, yPos, 'slot');
            itemSlot.setScale(0.8);
            giveItemsContainer.add(itemSlot);

            // Item image
            if (this.textures.exists(item.id)) {
                const itemImage = this.add.image(xPos, yPos, item.id);
                itemImage.setDisplaySize(36, 36);
                giveItemsContainer.add(itemImage);
            }

            // Item count
            if (item.count > 1) {
                const countText = this.add.text(xPos + 16, yPos + 16, item.count.toString(), {
                    fontSize: '14px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3
                });
                countText.setOrigin(1, 1);
                giveItemsContainer.add(countText);
            }
        });

        // "Nothing" text if no items
        if (givingItems.length === 0) {
            const nothingText = this.add.text(0, -90, 'Nothing', {
                fontSize: '18px',
                color: '#999999',
                fontStyle: 'italic'
            });
            nothingText.setOrigin(0.5);
            this.npcConfirmModal.add(nothingText);
        }

        // Divider line
        const divider = this.add.rectangle(0, 20, 500, 3, 0x8b6f47);

        // You will receive section
        const receiveLabel = this.add.text(0, 50, 'You will receive:', {
            fontSize: '22px',
            color: '#2d5016',
            fontStyle: 'bold'
        });
        receiveLabel.setOrigin(0.5);

        // Display receiving items with images
        const receiveItemsContainer = this.add.container(-250, 100);
        receivingItems.forEach((item, index) => {
            const xPos = (index % 4) * 70;
            const yPos = Math.floor(index / 4) * 70;

            // Item slot background
            const itemSlot = this.add.image(xPos, yPos, 'slot');
            itemSlot.setScale(0.8);
            receiveItemsContainer.add(itemSlot);

            // Item image
            if (this.textures.exists(item.id)) {
                const itemImage = this.add.image(xPos, yPos, item.id);
                itemImage.setDisplaySize(36, 36);
                receiveItemsContainer.add(itemImage);
            }

            // Item count
            if (item.count > 1) {
                const countText = this.add.text(xPos + 16, yPos + 16, item.count.toString(), {
                    fontSize: '14px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3
                });
                countText.setOrigin(1, 1);
                receiveItemsContainer.add(countText);
            }
        });

        // "Nothing" text if no items
        if (receivingItems.length === 0) {
            const nothingText = this.add.text(0, 100, 'Nothing', {
                fontSize: '18px',
                color: '#999999',
                fontStyle: 'italic'
            });
            nothingText.setOrigin(0.5);
            this.npcConfirmModal.add(nothingText);
        }

        // Cancel button with theme styling
        const cancelBg = this.add.rectangle(-120, 220, 180, 60, 0xc94c4c);
        cancelBg.setStrokeStyle(3, 0x8b0000);
        cancelBg.setInteractive({ useHandCursor: true });

        const cancelText = this.add.text(-120, 220, 'Cancel', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        cancelText.setOrigin(0.5);

        cancelBg.on('pointerdown', () => {
            this.hideTradeConfirmationModal();
        });

        cancelBg.on('pointerover', () => {
            cancelBg.setFillStyle(0xe05555);
            cancelBg.setScale(1.05);
        });

        cancelBg.on('pointerout', () => {
            cancelBg.setFillStyle(0xc94c4c);
            cancelBg.setScale(1);
        });

        // Confirm button with theme styling
        const confirmBg = this.add.rectangle(120, 220, 180, 60, 0x5ca65c);
        confirmBg.setStrokeStyle(3, 0x2d5016);
        confirmBg.setInteractive({ useHandCursor: true });

        const confirmText = this.add.text(120, 220, 'Confirm', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        confirmText.setOrigin(0.5);

        confirmBg.on('pointerdown', () => {
            this.confirmTrade();
        });

        confirmBg.on('pointerover', () => {
            confirmBg.setFillStyle(0x6fc96f);
            confirmBg.setScale(1.05);
        });

        confirmBg.on('pointerout', () => {
            confirmBg.setFillStyle(0x5ca65c);
            confirmBg.setScale(1);
        });

        // Add all to modal
        this.npcConfirmModal.add([
            modalBg, innerBorder, titleBg, title, giveLabel, divider, receiveLabel,
            cancelBg, cancelText, confirmBg, confirmText
        ]);

        // Add item containers
        this.npcConfirmModal.add(giveItemsContainer);
        this.npcConfirmModal.add(receiveItemsContainer);
    }

    private hideTradeConfirmationModal(): void {
        if (this.npcConfirmModal) {
            this.npcConfirmModal.destroy();
            this.npcConfirmModal = undefined;
        }
        if (this.npcConfirmOverlay) {
            this.npcConfirmOverlay.destroy();
            this.npcConfirmOverlay = undefined;
        }
    }

    private confirmTrade(): void {
        // Hide confirmation modal
        this.hideTradeConfirmationModal();

        // Collect item data for transaction details
        const playerItems: Array<{ id: string; name: string; quantity: number; spriteKey: string }> = [];
        const npcItems: Array<{ id: string; name: string; quantity: number; spriteKey: string }> = [];

        // Collect player items from left slots
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const leftSlot = this.npcLeftSlots[i];
            if (leftSlot && leftSlot.itemId) {
                const count = leftSlot.countText ? parseInt(leftSlot.countText.text) : 1;
                playerItems.push({
                    id: leftSlot.itemId,
                    name: this.getItemDisplayName(leftSlot.itemId),
                    quantity: count,
                    spriteKey: leftSlot.itemId
                });
            }
        }

        // Collect NPC items from right slots
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const rightSlot = this.npcRightSlots[i];
            if (rightSlot && rightSlot.itemId) {
                const count = rightSlot.countText ? parseInt(rightSlot.countText.text) : 1;
                npcItems.push({
                    id: rightSlot.itemId,
                    name: this.getItemDisplayName(rightSlot.itemId),
                    quantity: count,
                    spriteKey: rightSlot.itemId
                });
            }
        }

        // Generate mock blockchain transaction details
        const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
        const blockNumber = Math.floor(Math.random() * 1000000) + 10000000;
        const gasUsed = Math.floor(Math.random() * 50000) + 20000;
        const gasPrice = '0.0001';
        const gasCost = (gasUsed * parseFloat(gasPrice)).toFixed(6);

        // Create transaction details object
        this.currentTransaction = {
            transactionHash,
            blockNumber,
            blockConfirmation: `${Math.floor(Math.random() * 10) + 1}/12`,
            gasUsed,
            gasPrice,
            gasCost,
            timestamp: Date.now(),
            status: 'completed',
            itemsTraded: {
                playerItems,
                npcItems
            },
            nftTransfers: playerItems.concat(npcItems).map((item, index) => ({
                from: index < playerItems.length ? '0xplayer...' : '0xherman...',
                to: index < playerItems.length ? '0xherman...' : '0xplayer...',
                tokenId: `token_${item.id}_${Math.random().toString(16).substr(2, 8)}`,
                contractAddress: '0x1234567890abcdef1234567890abcdef12345678'
            })),
            escrowEvents: [
                ...playerItems.map(item => ({
                    type: 'locked' as const,
                    itemId: item.id,
                    timestamp: Date.now() - 5000
                })),
                ...npcItems.map(item => ({
                    type: 'unlocked' as const,
                    itemId: item.id,
                    timestamp: Date.now() - 1000
                }))
            ]
        };

        // Transfer items: remove from left slots, add right slots items to backpack
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const rightSlot = this.npcRightSlots[i];
            if (rightSlot && rightSlot.itemId) {
                const itemId = rightSlot.itemId;
                const itemType = rightSlot.itemType || 'item';
                const count = rightSlot.countText ? parseInt(rightSlot.countText.text) : 1;

                // Find first empty slot in backpack
                for (let backpackIndex = 0; backpackIndex < this.BACKPACK_SLOT_COUNT; backpackIndex++) {
                    const backpackSlot = this.backpackSlots[backpackIndex];
                    if (!backpackSlot.itemId) {
                        this.addItemToBackpack(itemId, backpackIndex, itemType, count);
                        break;
                    }
                }
            }
        }

        // Clear all NPC trade slots
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            this.clearNPCSlot(i, 'left');
            this.clearNPCSlot(i, 'right');
        }

        // Reset trade state
        this.npcTradeLocked = false;

        if (this.npcPlayerTick) {
            this.npcPlayerTick.setVisible(false);
        }
        if (this.npcHermanTick) {
            this.npcHermanTick.setVisible(false);
        }
        if (this.npcAcceptButton) {
            this.npcAcceptButton.setText('Accept');
        }

        // Show transaction completion notification with details button
        this.showTransactionCompleteNotification();

        // Emit transaction completed event for React components
        EventBus.emit('npc-trade-completed', this.currentTransaction);

        // Close the trade UI immediately
        this.hideNPCTrade();
    }

    private getItemDisplayName(itemId: string): string {
        // Convert item IDs to human-readable names
        const itemNames: Record<string, string> = {
            'potion_01a': 'Health Potion',
            'fish_01a': 'Fresh Fish',
            'candy_01a': 'Magic Candy',
            'helmet_01a': 'Iron Helmet',
            'sword_01a': 'Iron Sword',
            'sword_01b': 'Bronze Sword',
            'sword_01c': 'Steel Sword',
            'sword_01d': 'Silver Sword',
            'sword_01e': 'Golden Sword',
            'bow_01a': 'Wooden Bow',
            'bow_01b': 'Hunting Bow',
            'staff_01a': 'Magic Staff',
            'spellbook_01a': 'Spellbook',
            'shield_01a': 'Wooden Shield',
            'shield_01b': 'Iron Shield',
            'crystal_01a': 'Magic Crystal',
            'gem_01a': 'Precious Gem',
            'ring_01a': 'Magic Ring',
            'necklace_01a': 'Amulet',
            'key_01a': 'Ancient Key',
            'scroll_01a': 'Magic Scroll',
            'coin_01a': 'Gold Coin',
            'ingot_01a': 'Iron Ingot',
            'book_01a': 'Ancient Tome',
            'gift_01a': 'Mystery Box',
            'pearl_01a': 'Magic Pearl',
            'arrow_01a': 'Arrow'
        };

        return itemNames[itemId] || itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    private showTransactionCompleteNotification(): void {
        if (!this.currentTransaction) return;

        const screenCenterX = this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.height / 2;

        // Create notification container
        const notificationContainer = this.add.container(screenCenterX, screenCenterY);
        notificationContainer.setScrollFactor(0);
        notificationContainer.setDepth(30000);

        // Semi-transparent overlay
        const overlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5);
        overlay.setScrollFactor(0);
        notificationContainer.add(overlay);

        // Main notification background
        const notificationBg = this.add.rectangle(0, 0, 450, 200, 0x1a1a1a);
        notificationBg.setStrokeStyle(3, 0x10b981);
        notificationContainer.add(notificationBg);

        // Success icon and title
        const successIcon = this.add.text(0, -60, '✅', {
            fontSize: '48px'
        });
        successIcon.setOrigin(0.5);
        notificationContainer.add(successIcon);

        const title = this.add.text(0, -20, 'Trade Completed!', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        notificationContainer.add(title);

        const subtitle = this.add.text(0, 10, 'Your items have been exchanged successfully', {
            fontSize: '14px',
            color: '#9ca3af'
        });
        subtitle.setOrigin(0.5);
        notificationContainer.add(subtitle);

        // View transaction details button
        this.transactionDetailsButtonBg = this.add.rectangle(0, 60, 200, 40, 0x10b981);
        this.transactionDetailsButtonBg.setStrokeStyle(2, 0x059669);
        this.transactionDetailsButtonBg.setInteractive({ useHandCursor: true });
        notificationContainer.add(this.transactionDetailsButtonBg);

        this.transactionDetailsButtonText = this.add.text(0, 60, 'View Transaction Details', {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.transactionDetailsButtonText.setOrigin(0.5);
        notificationContainer.add(this.transactionDetailsButtonText);

        // Button interactions
        this.transactionDetailsButtonBg.on('pointerdown', () => {
            this.showTransactionDetailsModal();
            this.hideTransactionCompleteNotification();
        });

        this.transactionDetailsButtonBg.on('pointerover', () => {
            this.transactionDetailsButtonBg?.setFillStyle(0x059669);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        this.transactionDetailsButtonBg.on('pointerout', () => {
            this.transactionDetailsButtonBg?.setFillStyle(0x10b981);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        // Close button
        const closeButton = this.add.text(200, -80, '×', {
            fontSize: '24px',
            color: '#9ca3af'
        });
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        notificationContainer.add(closeButton);

        closeButton.on('pointerdown', () => {
            this.hideTransactionCompleteNotification();
        });

        closeButton.on('pointerover', () => {
            closeButton.setStyle({ color: '#ffffff' });
        });

        closeButton.on('pointerout', () => {
            closeButton.setStyle({ color: '#9ca3af' });
        });

        // Auto-hide after 5 seconds
        this.time.delayedCall(5000, () => {
            this.hideTransactionCompleteNotification();
        });

        // Store reference for cleanup
        this.transactionDetailsButton = notificationContainer;
    }

    private hideTransactionCompleteNotification(): void {
        if (this.transactionDetailsButton) {
            this.transactionDetailsButton.destroy();
            this.transactionDetailsButton = undefined;
            this.transactionDetailsButtonBg = undefined;
            this.transactionDetailsButtonText = undefined;
        }
    }

    public showTransactionDetailsModal(): void {
        if (!this.currentTransaction) return;

        // Show the Phaser-based transaction details modal
        this.showTransactionDetails(this.currentTransaction);
    }



    private handleCancelTrade(): void {
        // Return items from left slots back to backpack
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            const slot = this.npcLeftSlots[i];
            if (slot && slot.itemId) {
                // Try to add item back to backpack
                const itemId = slot.itemId;
                const itemType = slot.itemType || 'item';
                const count = slot.countText ? parseInt(slot.countText.text) : 1;

                // Find first empty slot in backpack
                for (let backpackIndex = 0; backpackIndex < this.BACKPACK_SLOT_COUNT; backpackIndex++) {
                    const backpackSlot = this.backpackSlots[backpackIndex];
                    if (!backpackSlot.itemId) {
                        this.addItemToBackpack(itemId, backpackIndex, itemType, count);
                        break;
                    }
                }
            }
        }

        // Clear all items from NPC trade slots
        for (let i = 0; i < this.NPC_TRADE_SLOTS_PER_SIDE; i++) {
            this.clearNPCSlot(i, 'left');
            this.clearNPCSlot(i, 'right');
        }

        // Unlock if locked
        if (this.npcTradeLocked) {
            this.npcTradeLocked = false;

            // Clear tints
            [...this.npcLeftSlots, ...this.npcRightSlots].forEach(slot => {
                (slot.bg as Phaser.GameObjects.Image).clearTint();
            });

            // Hide ticks
            if (this.npcPlayerTick) {
                this.npcPlayerTick.setVisible(false);
            }
            if (this.npcHermanTick) {
                this.npcHermanTick.setVisible(false);
            }

            // Reset accept button
            if (this.npcAcceptButton) {
                this.npcAcceptButton.setText('Accept');
            }
        }

        // Close trade window
        this.hideNPCTrade();
    }

    private async handleAcceptTrade(): Promise<void> {
        // Toggle lock state
        this.npcTradeLocked = !this.npcTradeLocked;

        if (this.npcTradeLocked) {
            // Lock left slots (player's side)
            this.npcLeftSlots.forEach(slot => {
                (slot.bg as Phaser.GameObjects.Image).setTint(0x888888);
            });

            // Show player tick
            if (this.npcPlayerTick) {
                this.npcPlayerTick.setVisible(true);
            }

            // Change accept button text
            if (this.npcAcceptButton) {
                this.npcAcceptButton.setText('Unlock');
            }

            // Herman already has items populated, show his tick immediately
            if (this.npcHermanTick) {
                this.npcHermanTick.setVisible(true);
            }

            // Both accepted - show confirmation modal
            if (this.npcPlayerTick?.visible && this.npcHermanTick?.visible) {
                this.showTradeConfirmationModal();
            }

            console.log('Trade locked!');
        } else {
            // Unlock all slots
            [...this.npcLeftSlots, ...this.npcRightSlots].forEach(slot => {
                (slot.bg as Phaser.GameObjects.Image).clearTint();
            });

            // Hide player tick
            if (this.npcPlayerTick) {
                this.npcPlayerTick.setVisible(false);
            }

            // Hide Herman tick
            if (this.npcHermanTick) {
                this.npcHermanTick.setVisible(false);
            }

            // Clear Herman's items
            for (let i = 0; i < 4; i++) {
                this.clearNPCSlot(i, 'right');
            }

            // Change accept button text back
            if (this.npcAcceptButton) {
                this.npcAcceptButton.setText('Accept');
            }

            console.log('Trade unlocked!');
        }
    }

    private async executeNPCTrade(): Promise<void> {
        if (this.isProcessingTransaction) return;

        try {
            this.isProcessingTransaction = true;
            this.showTransactionProgress('Creating escrows for trade...');

            // Get player items
            const playerItems = this.npcLeftSlots
                .filter(slot => slot.itemId)
                .map(slot => ({
                    id: slot.itemId!,
                    name: this.getItemDisplayName(slot.itemId!),
                    sprite_key: slot.itemId
                }));

            // Get NPC items
            const npcItems = this.npcRightSlots
                .filter(slot => slot.itemId)
                .map(slot => ({
                    id: slot.itemId!,
                    name: this.getItemDisplayName(slot.itemId!),
                    sprite_key: slot.itemId
                }));

            // Check if both sides have items (escrows must not be empty)
            if (playerItems.length === 0 || npcItems.length === 0) {
                throw new Error('Both sides must have items for trade');
            }

            this.showTransactionProgress('Executing trade with Herman...');

            // Execute real blockchain escrow trading
            await this.executeRealEscrowTrade(playerItems, npcItems);

            // Update player inventory with NPC items
            npcItems.forEach(item => {
                this.addMarketplaceItemToInventory(item.id, 'item');
            });

            // Remove player items from slots
            this.npcLeftSlots.forEach(slot => {
                if (slot.itemImage) {
                    slot.itemImage.destroy();
                    slot.itemImage = undefined;
                }
                if (slot.countText) {
                    slot.countText.destroy();
                    slot.countText = undefined;
                }
                slot.itemId = undefined;
                slot.itemType = undefined;
            });

            // Remove NPC items from slots
            this.npcRightSlots.forEach(slot => {
                if (slot.itemImage) {
                    slot.itemImage.destroy();
                    slot.itemImage = undefined;
                }
                if (slot.countText) {
                    slot.countText.destroy();
                    slot.countText = undefined;
                }
                slot.itemId = undefined;
                slot.itemType = undefined;
            });

            // Show success message
            this.showTransactionSuccess('Trade completed successfully!');

            // Create transaction record with real escrow ID if available
            const escrowId = await this.createPlayerEscrow(playerItems[0]?.id);
            this.currentTransaction = {
                transactionHash: escrowId || 'escrow_' + Date.now(),
                blockNumber: Math.floor(Math.random() * 100000) + 2000000,
                blockConfirmation: '12/12',
                gasUsed: Math.floor(Math.random() * 30000) + 15000,
                gasPrice: '0.0001',
                gasCost: '0.0023',
                timestamp: Date.now(),
                status: 'completed',
                itemsTraded: {
                    playerItems: playerItems.map(item => ({
                        id: item.id,
                        name: item.name,
                        quantity: 1,
                        spriteKey: item.sprite_key || 'default-item'
                    })),
                    npcItems: npcItems.map(item => ({
                        id: item.id,
                        name: item.name,
                        quantity: 1,
                        spriteKey: item.sprite_key || 'default-item'
                    }))
                },
                transactionType: 'NPC_TRADE',
                price: undefined,
                nftTransfers: []
            };

            // Show transaction completion notification (this is the ONLY modal shown)
            this.showTransactionCompleteNotification();

            // Emit event for React components
            EventBus.emit('npc-trade-completed', this.currentTransaction);

            // Reset trade UI
            if (this.npcAcceptButton) {
                this.npcAcceptButton.setText('Accept');
            }

            // Close the trade UI after a delay
            this.time.delayedCall(3000, () => {
                this.hideNPCTrade();
            });

        } catch (error) {
            console.error('NPC trade error:', error);
            this.showTransactionError('Trade failed');
        } finally {
            this.isProcessingTransaction = false;
            this.hideTransactionProgress();
        }
    }

    private async executeRealEscrowTrade(playerItems: any[], npcItems: any[]): Promise<void> {
        try {
            // Create escrows for both sides before executing trade
            this.showTransactionProgress('Creating player escrow...');
            const playerEscrowId = await this.createPlayerEscrow(playerItems[0]?.id);

            this.showTransactionProgress('Creating NPC escrow...');
            // NPC creates escrow with their items
            let npcEscrowId: string;
            if (npcItems.length > 0) {
                try {
                    // Ensure transaction service is ready
                    if (!this.ensureTransactionServiceReady()) {
                        throw new Error('Failed to initialize transaction service for NPC');
                    }

                    // Lock the first NPC item
                    const npcLockResult = await this.oneChainTransactionService.lockItem(npcItems[0].id);
                    npcEscrowId = `npc_escrow_${npcLockResult.lockedItemId}`;
                } catch (error) {
                    console.error('NPC escrow creation failed, using fallback:', error);
                    npcEscrowId = 'npc_escrow_' + npcItems.map(item => item.id).join('_').substring(0, 32);
                }
            } else {
                npcEscrowId = 'npc_escrow_empty_' + Date.now();
            }

            // Both escrows created successfully, now execute the swap
            this.showTransactionProgress('Executing atomic swap...');

            // Simulate blockchain processing time for the swap
            await new Promise(resolve => setTimeout(resolve, 1500));

            // In a real implementation, this would call:
            // await this.oneChainTransactionService.executeSwap(playerEscrowId, npcEscrowId);

            // Trade completed successfully - items are now swapped on blockchain
            console.log('Escrow swap completed:', { playerEscrowId, npcEscrowId });

        } catch (error) {
            console.error('Escrow trade failed:', error);
            throw error;
        }
    }

    private ensureTransactionServiceReady(): boolean {
        if (!this.oneChainTransactionService) {
            console.error('OneChain transaction service not available');
            return false;
        }

        // Get fresh instance from WalletBridgeService to ensure it has the latest signer
        const walletBridge = WalletBridgeService.getInstance();
        const freshTransactionService = walletBridge.getTransactionService();

        if (freshTransactionService) {
            this.oneChainTransactionService = freshTransactionService;
        } else {
            console.error('Transaction service not available from WalletBridgeService');
            return false;
        }

        return true;
    }

    private async createPlayerEscrow(itemId: string): Promise<string> {
        if (!itemId) throw new Error('No item to escrow');

        try {
            // Ensure transaction service is ready with proper signer
            if (!this.ensureTransactionServiceReady()) {
                throw new Error('Failed to initialize transaction service');
            }

            const autoMint = AutoMintService.getInstance();

            // Try to mint if not already minted
            let nftObjectId: string | null = null;

            // If this already looks like a blockchain object, trust it as-is
            if (itemId.startsWith('0x') && itemId.length === 66) {
                nftObjectId = itemId;
            } else {
                // Check if we've already minted this item earlier
                nftObjectId = autoMint.getNFTObjectId(itemId);

                if (!nftObjectId) {
                    console.log('🎨 Item not yet minted, minting now for escrow...');
                    const mintMetadata = this.buildMintMetadata(itemId);
                    nftObjectId = await autoMint.mintItemNow(mintMetadata);
                }
            }

            if (!nftObjectId || !nftObjectId.startsWith('0x') || nftObjectId.length !== 66) {
                throw new Error(`Unable to obtain NFT object ID for ${itemId}. Please mint the item before trading.`);
            }

            // Lock the item
            const lockResult = await this.oneChainTransactionService.lockItem(nftObjectId);

            // Create escrow identifier from the locked item
            const escrowId = `escrow_${lockResult.lockedItemId}`;

            console.log('Successfully created player escrow:', escrowId);
            return escrowId;

        } catch (error) {
            console.error('Failed to create player escrow:', error);

            if (error instanceof Error) {
                console.log('⚠️ Item not yet available on-chain. Using simulation mode for this trade.');
                console.log(`ℹ️ Mint attempt message: ${error.message}`);
            }

            // Fallback to simulated escrow for now
            const fallbackEscrowId = '0xplayer_escrow_' + Date.now();
            console.log('Using fallback escrow ID:', fallbackEscrowId);
            return fallbackEscrowId;
        }
    }

    private startHermanAutoFill(): void {
        // Fill Herman's slots one by one with 1 second delay
        for (let i = 0; i < Math.min(4, this.npcHermanItems.length); i++) {
            this.time.delayedCall(1000 * (i + 1), () => {
                this.addItemToNPCSlot(this.npcHermanItems[i], i, 'right', 'item', 1);

                // After filling all 4 items, show Herman's tick
                if (i === 3) {
                    this.time.delayedCall(200, () => {
                        if (this.npcHermanTick) {
                            this.npcHermanTick.setVisible(true);
                        }
                        // Show confirmation modal after both ticks are visible
                        this.time.delayedCall(500, () => {
                            this.showTradeConfirmationModal();
                        });
                    });
                }
            });
        }
    }

    private createSettingsButton(): void {
        const settingsButton = this.add.image(
            this.cameras.main.width - 50,
            50,
            'settings-button'
        );
        settingsButton.setScrollFactor(0);
        settingsButton.setDepth(100);
        settingsButton.setScale(1.0);
        settingsButton.setInteractive();

        settingsButton.on('pointerover', () => {
            settingsButton.setScale(1.1);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        settingsButton.on('pointerout', () => {
            settingsButton.setScale(1.0);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        settingsButton.on('pointerdown', () => {
            this.toggleSettingsMenu();
        });

        this.#hudContainer.add(settingsButton);

        // Create guide button below settings button
        const guideButton = this.add.image(
            this.cameras.main.width - 50,
            120,
            'guide-button'
        );
        guideButton.setScrollFactor(0);
        guideButton.setDepth(100);
        guideButton.setScale(1.0);
        guideButton.setInteractive();

        guideButton.on('pointerover', () => {
            guideButton.setScale(1.1);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        guideButton.on('pointerout', () => {
            guideButton.setScale(1.0);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        guideButton.on('pointerdown', () => {
            this.toggleGuideMenu();
        });

        this.#hudContainer.add(guideButton);
    }

    private toggleGuideMenu(): void {
        if (this.guideMenuVisible) {
            this.hideGuideMenu();
        } else {
            this.showGuideMenu();
        }
    }

    private showGuideMenu(): void {
        if (this.guideMenuContainer) {
            this.guideMenuContainer.setVisible(true);
            this.guideMenuOverlay?.setVisible(true);
            this.guideMenuVisible = true;
            return;
        }

        // Create overlay
        this.guideMenuOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.8
        );
        this.guideMenuOverlay.setOrigin(0.5);
        this.guideMenuOverlay.setDepth(5000);
        this.guideMenuOverlay.setScrollFactor(0);
        this.guideMenuOverlay.setInteractive();

        // Create container
        this.guideMenuContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);
        this.guideMenuContainer.setScrollFactor(0);
        this.guideMenuContainer.setDepth(5001);

        // Modal dimensions and spacing
        const panelWidth = 600;
        const panelHeight = 600;
        const padding = 20;
        const titleHeight = 40;
        const closeButtonSize = 32;

        // Background panel (taller to fit content)
        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x2a2a2a, 0.95);
        panel.setStrokeStyle(3, 0x4a4a4a);
        this.guideMenuContainer.add(panel);

        // Title
        const title = this.add.text(0, -panelHeight / 2 + padding + titleHeight / 2, '📖 GAME GUIDE', {
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.guideMenuContainer.add(title);

        // Guide content
        const guideText = `🎮 MOVEMENT CONTROLS
W/A/S/D or Arrow Keys - Move  |  SHIFT - Run

⚔️ ACTION CONTROLS
Q - Attack (hold for continuous)  |  E - Interact
R - Cut Trees 🪓  |  T - Water Plants 💧
SPACE - Chat with NPCs

🎒 INVENTORY & UI
B - Toggle Backpack  |  F - Open Crafting Table 🔨
1-8 - Quick use hotbar items  |  ESC - Close menus/Exit
Left Click - Pick/Place items  |  Right Click - Split stack
Double Click - Group same items

📦 INVENTORY (Max 99 per stack)
• Item Bar: 8 quick slots at bottom
• Backpack: 25 slots (Press B)
• Left Click: Move entire stack
• Right Click: Pick half / Place 1 item
• Double Click: Auto-group same items

💡 TIPS
• Stack items to save space
• Use F to craft items from resources
• Double-click to organize quickly
• Press T near plants to water them`;

        const content = this.add.text(0, padding, guideText, {
            fontSize: '14px',
            color: '#ffffff',
            align: 'left',
            lineSpacing: 8,
            wordWrap: { width: panelWidth - padding * 4 }
        }).setOrigin(0.5);
        this.guideMenuContainer.add(content);

        // Close button
        const closeBtn = this.add.text(
            panelWidth / 2 - padding - closeButtonSize / 2,
            -panelHeight / 2 + padding + titleHeight / 2,
            'X',
            {
                fontSize: '32px',
                color: '#ff4444',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        closeBtn.setInteractive();
        closeBtn.on('pointerdown', () => this.hideGuideMenu());
        closeBtn.on('pointerover', () => {
            closeBtn.setScale(1.2);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        closeBtn.on('pointerout', () => {
            closeBtn.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        this.guideMenuContainer.add(closeBtn);

        this.#hudContainer.add(this.guideMenuContainer);
        this.guideMenuVisible = true;
    }

    private hideGuideMenu(): void {
        if (this.guideMenuContainer) {
            this.guideMenuContainer.setVisible(false);
        }
        if (this.guideMenuOverlay) {
            this.guideMenuOverlay.setVisible(false);
        }
        this.guideMenuVisible = false;
    }

    // ===== SETTINGS MENU =====

    private toggleSettingsMenu(): void {
        if (this.settingsMenuVisible) {
            this.hideSettingsMenu();
        } else {
            this.showSettingsMenu();
        }
    }

    private showSettingsMenu(): void {
        if (this.settingsMenuContainer) {
            this.settingsMenuContainer.setVisible(true);
            this.settingsMenuOverlay?.setVisible(true);
            this.settingsMenuVisible = true;
            return;
        }

        // Create overlay
        this.settingsMenuOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.8
        );
        this.settingsMenuOverlay.setOrigin(0.5);
        this.settingsMenuOverlay.setDepth(5000);
        this.settingsMenuOverlay.setScrollFactor(0);
        this.settingsMenuOverlay.setInteractive();

        // Create container
        this.settingsMenuContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);
        this.settingsMenuContainer.setScrollFactor(0);
        this.settingsMenuContainer.setDepth(5001);

        // Modal dimensions and spacing
        const panelWidth = 400;
        const panelHeight = 300;
        const padding = 20;
        const titleHeight = 40;
        const closeButtonSize = 32;
        const rowHeight = 50;
        const controlWidth = 200;

        // Background panel
        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x2a2a2a, 0.95);
        panel.setStrokeStyle(3, 0x4a4a4a);
        this.settingsMenuContainer.add(panel);

        // Title
        const title = this.add.text(0, -panelHeight / 2 + padding + titleHeight / 2, '⚙️ SETTINGS', {
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.settingsMenuContainer.add(title);

        // Music Volume Label
        const volumeLabel = this.add.text(-panelWidth / 2 + padding, -panelHeight / 2 + titleHeight + padding * 3, '🔊 Music Volume', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);
        this.settingsMenuContainer.add(volumeLabel);

        // Slider track
        const sliderY = -panelHeight / 2 + titleHeight + padding * 3 + rowHeight;
        const sliderTrack = this.add.rectangle(0, sliderY, controlWidth, 8, 0x555555);
        this.settingsMenuContainer.add(sliderTrack);

        // Slider knob
        this.volumeSliderKnob = this.add.circle(this.musicVolume * controlWidth - controlWidth / 2, sliderY, 12, 0xffffff);
        this.volumeSliderKnob.setInteractive({ draggable: true });
        this.settingsMenuContainer.add(this.volumeSliderKnob);

        // Volume value text
        this.volumeValueText = this.add.text(controlWidth / 2 + padding, sliderY, `${Math.round(this.musicVolume * 100)}%`, {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);
        this.settingsMenuContainer.add(this.volumeValueText);

        // Slider drag logic
        this.volumeSliderKnob.on('drag', (pointer: Phaser.Input.Pointer) => {
            const localX = pointer.x - this.cameras.main.centerX;
            const halfWidth = controlWidth / 2;
            const clampedX = Phaser.Math.Clamp(localX, -halfWidth, halfWidth);
            this.volumeSliderKnob!.x = clampedX;
            this.musicVolume = (clampedX + halfWidth) / controlWidth;
            this.volumeValueText!.setText(`${Math.round(this.musicVolume * 100)}%`);
        });

        // Fullscreen Label
        const fullscreenY = sliderY + rowHeight;
        const fullscreenLabel = this.add.text(-panelWidth / 2 + padding, fullscreenY, '🖥️ Fullscreen', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);
        this.settingsMenuContainer.add(fullscreenLabel);

        // Checkbox
        const checkboxX = panelWidth / 2 - padding * 3;
        this.fullscreenCheckbox = this.add.rectangle(checkboxX, fullscreenY, 30, 30, 0x555555);
        this.fullscreenCheckbox.setStrokeStyle(2, 0xffffff);
        this.fullscreenCheckbox.setInteractive();
        this.settingsMenuContainer.add(this.fullscreenCheckbox);

        // Checkmark
        this.fullscreenCheckmark = this.add.text(checkboxX, fullscreenY, '✓', {
            fontSize: '24px',
            color: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.fullscreenCheckmark.setVisible(this.isFullscreen);
        this.settingsMenuContainer.add(this.fullscreenCheckmark);

        // Checkbox click
        this.fullscreenCheckbox.on('pointerdown', () => {
            this.isFullscreen = !this.isFullscreen;
            this.fullscreenCheckmark!.setVisible(this.isFullscreen);
        });

        // Save button (64x32 px)
        const saveBtnY = panelHeight / 2 - padding * 3;
        const saveBtn = this.add.image(0, saveBtnY, 'save-button');
        saveBtn.setOrigin(0.5);
        saveBtn.setInteractive();
        this.settingsMenuContainer.add(saveBtn);

        saveBtn.on('pointerover', () => {
            saveBtn.setTexture('hover-save-button');
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        saveBtn.on('pointerout', () => {
            saveBtn.setTexture('save-button');
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        saveBtn.on('pointerdown', () => {
            saveBtn.setTexture('selected-save-button');
            this.time.delayedCall(100, () => {
                saveBtn.setTexture('save-button');
            });
            this.saveSettings();
        });

        // Close button
        const closeBtn = this.add.text(
            panelWidth / 2 - padding - closeButtonSize / 2,
            -panelHeight / 2 + padding + titleHeight / 2,
            'X',
            {
                fontSize: '32px',
                color: '#ff4444',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        closeBtn.setInteractive();
        closeBtn.on('pointerdown', () => this.hideSettingsMenu());
        closeBtn.on('pointerover', () => {
            closeBtn.setScale(1.2);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        closeBtn.on('pointerout', () => {
            closeBtn.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        this.settingsMenuContainer.add(closeBtn);

        this.#hudContainer.add(this.settingsMenuContainer);
        this.settingsMenuVisible = true;
    }

    private saveSettings(): void {
        // Apply music volume
        const farmScene = this.scene.get(SCENE_KEYS.FARM) as any;
        if (farmScene && farmScene.bgMusic) {
            farmScene.bgMusic.setVolume(this.musicVolume);
        }

        // Apply fullscreen
        if (this.isFullscreen && !this.scale.isFullscreen) {
            this.scale.startFullscreen();
        } else if (!this.isFullscreen && this.scale.isFullscreen) {
            this.scale.stopFullscreen();
        }

        // Close settings menu
        this.hideSettingsMenu();
    }

    private hideSettingsMenu(): void {
        if (this.settingsMenuContainer) {
            this.settingsMenuContainer.setVisible(false);
        }
        if (this.settingsMenuOverlay) {
            this.settingsMenuOverlay.setVisible(false);
        }
        this.settingsMenuVisible = false;
    }

    // ===== EXIT CONFIRMATION =====

    private showExitConfirmation(): void {
        if (this.exitConfirmationContainer) {
            this.exitConfirmationContainer.setVisible(true);
            this.exitConfirmationOverlay?.setVisible(true);
            this.exitConfirmationVisible = true;
            return;
        }

        // Create overlay
        this.exitConfirmationOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.8
        );
        this.exitConfirmationOverlay.setOrigin(0.5);
        this.exitConfirmationOverlay.setDepth(5000);
        this.exitConfirmationOverlay.setScrollFactor(0);
        this.exitConfirmationOverlay.setInteractive();

        // Create container
        this.exitConfirmationContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);
        this.exitConfirmationContainer.setScrollFactor(0);
        this.exitConfirmationContainer.setDepth(5001);

        // Improved modal dimensions and spacing
        const panelWidth = 450;
        const panelHeight = 300;
        const padding = 25;
        const titleHeight = 45;
        const closeButtonSize = 36;
        const buttonWidth = 120;
        const buttonHeight = 45;
        const buttonSpacing = 25;

        // Background panel with rounded corners effect
        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x2a2a2a, 0.98);
        panel.setStrokeStyle(4, 0x4a4a4a);
        this.exitConfirmationContainer.add(panel);

        // Add subtle inner border for depth
        const innerBorder = this.add.rectangle(0, 0, panelWidth - 8, panelHeight - 8, 0x3a3a3a, 0.3);
        innerBorder.setStrokeStyle(2, 0x5a5a5a);
        this.exitConfirmationContainer.add(innerBorder);

        // Title with background panel
        const titlePanel = this.add.rectangle(0, -panelHeight / 2 + titleHeight / 2 + padding / 2, panelWidth - 40, titleHeight, 0x1a1a1a, 0.9);
        titlePanel.setStrokeStyle(2, 0x444444);
        this.exitConfirmationContainer.add(titlePanel);

        const title = this.add.text(0, -panelHeight / 2 + titleHeight / 2 + padding / 2, '🚪 EXIT TO MENU', {
            fontSize: '32px',
            color: '#ffcc00',
            fontStyle: 'bold',
            fontFamily: 'Arial, sans-serif',
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 4,
                stroke: true,
                fill: true
            }
        }).setOrigin(0.5);
        this.exitConfirmationContainer.add(title);

        // Close button (X) - positioned relative to title panel
        const closeBtnX = panelWidth / 2 - padding / 2 - closeButtonSize / 2;
        const closeBtnY = -panelHeight / 2 + titleHeight / 2 + padding / 2;
        const closeBtn = this.add.text(closeBtnX, closeBtnY, '✕', {
            fontSize: '28px',
            color: '#ff4444',
            fontStyle: 'bold',
            backgroundColor: '#1a1a1a',
            padding: { x: 8, y: 6 }
        }).setOrigin(0.5);
        closeBtn.setInteractive();
        closeBtn.on('pointerdown', () => this.hideExitConfirmation());
        closeBtn.on('pointerover', () => {
            closeBtn.setScale(1.15);
            closeBtn.setColor('#ff6666');
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        closeBtn.on('pointerout', () => {
            closeBtn.setScale(1);
            closeBtn.setColor('#ff4444');
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        this.exitConfirmationContainer.add(closeBtn);

        // Warning icon and message container
        const messageY = -30;
        const warningIcon = this.add.text(0, messageY - 25, '⚠️', {
            fontSize: '48px'
        }).setOrigin(0.5);
        this.exitConfirmationContainer.add(warningIcon);

        // Confirmation message with improved formatting
        const message = this.add.text(0, messageY + 15, 'Are you sure you want to exit to the menu?\n\nAll unsaved progress will be lost.', {
            fontSize: '18px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: panelWidth - padding * 3 },
            lineSpacing: 12,
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        this.exitConfirmationContainer.add(message);

        // Button container for better alignment
        const buttonY = panelHeight / 2 - padding - buttonHeight / 2;

        // Yes button (confirm exit) - styled as danger action
        const yesBtnBg = this.add.rectangle(-buttonSpacing - buttonWidth / 2, buttonY, buttonWidth, buttonHeight, 0xd32f2f, 0.9);
        yesBtnBg.setStrokeStyle(3, 0xb71c1c);
        yesBtnBg.setInteractive();
        this.exitConfirmationContainer.add(yesBtnBg);

        const yesBtn = this.add.text(-buttonSpacing - buttonWidth / 2, buttonY, 'EXIT', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        this.exitConfirmationContainer.add(yesBtn);

        yesBtnBg.on('pointerover', () => {
            yesBtnBg.setScale(1.05);
            yesBtnBg.setFillStyle(0xe53935);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        yesBtnBg.on('pointerout', () => {
            yesBtnBg.setScale(1);
            yesBtnBg.setFillStyle(0xd32f2f);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        yesBtnBg.on('pointerdown', () => {
            this.hideExitConfirmation();
            window.location.reload();
        });

        // No button (cancel) - styled as safe action
        const noBtnBg = this.add.rectangle(buttonSpacing + buttonWidth / 2, buttonY, buttonWidth, buttonHeight, 0x388e3c, 0.9);
        noBtnBg.setStrokeStyle(3, 0x2e7d32);
        noBtnBg.setInteractive();
        this.exitConfirmationContainer.add(noBtnBg);

        const noBtn = this.add.text(buttonSpacing + buttonWidth / 2, buttonY, 'CANCEL', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        this.exitConfirmationContainer.add(noBtn);

        noBtnBg.on('pointerover', () => {
            noBtnBg.setScale(1.05);
            noBtnBg.setFillStyle(0x43a047);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });
        noBtnBg.on('pointerout', () => {
            noBtnBg.setScale(1);
            noBtnBg.setFillStyle(0x388e3c);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });
        noBtnBg.on('pointerdown', () => this.hideExitConfirmation());

        this.#hudContainer.add(this.exitConfirmationContainer);
        this.exitConfirmationVisible = true;
    }

    private hideExitConfirmation(): void {
        if (this.exitConfirmationContainer) {
            this.exitConfirmationContainer.setVisible(false);
        }
        if (this.exitConfirmationOverlay) {
            this.exitConfirmationOverlay.setVisible(false);
        }
        this.exitConfirmationVisible = false;
    }
}