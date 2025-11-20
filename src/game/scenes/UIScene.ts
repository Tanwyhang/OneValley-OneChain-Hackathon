import * as Phaser from 'phaser';
import { SCENE_KEYS } from './SceneKeys';
import { EventBus } from '../EventBus';
// 1. First, let's update the Slot interface at the top of the file
interface Slot {
    bg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    x: number;
    y: number;
    itemId?: string;  // The unique identifier for the item
    itemImage?: Phaser.GameObjects.Image;  // The actual image in the slot
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

    // Guide menu properties
    private guideMenuVisible: boolean = false;
    private guideMenuContainer?: Phaser.GameObjects.Container;
    private guideMenuOverlay?: Phaser.GameObjects.Rectangle;

    // Settings menu properties
    private settingsMenuVisible: boolean = false;
    private settingsMenuContainer?: Phaser.GameObjects.Container;
    private settingsMenuOverlay?: Phaser.GameObjects.Rectangle;
    private volumeSliderKnob?: Phaser.GameObjects.Circle;
    private volumeValueText?: Phaser.GameObjects.Text;
    private fullscreenCheckbox?: Phaser.GameObjects.Rectangle;
    private fullscreenCheckmark?: Phaser.GameObjects.Text;
    private isFullscreen: boolean = false;
    private musicVolume: number = 0.5;

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
    private npcHermanItems: string[] = ['potion_01a', 'fish_01a', 'candy_01a', 'helmet_01a']; // Hardcoded items for Herman
    private npcConfirmModal?: Phaser.GameObjects.Container;
    private npcConfirmOverlay?: Phaser.GameObjects.Rectangle;

    // Marketplace item data
    private readonly MARKETPLACE_ITEMS = {
        Weapons: ['sword_01a', 'sword_01b', 'sword_01c', 'sword_01d', 'sword_01e', 'sword_02a', 'sword_02b', 'sword_02c', 'sword_02d', 'sword_02e', 'bow_01a', 'bow_01b', 'bow_01d', 'bow_01e', 'bow_02a', 'bow_02b', 'bow_02d', 'bow_02e', 'arrow_01a', 'arrow_01b', 'arrow_02a', 'arrow_02b', 'shield_01a', 'shield_01b', 'shield_02a', 'shield_02b', 'staff_01a', 'staff_01b', 'spellbook_01a', 'spellbook_01b'],
        Armors: ['helmet_01a', 'helmet_01b', 'helmet_01c', 'helmet_01d', 'helmet_01e', 'helmet_02a', 'helmet_02b', 'helmet_02c', 'helmet_02d', 'helmet_02e'],
        Misc: ['book_01a', 'book_01b', 'book_02a', 'book_02b', 'coin_01a', 'coin_01b', 'coin_02a', 'coin_02b', 'crystal_01a', 'crystal_01b', 'gem_01a', 'gem_01b', 'gift_01a', 'gift_01b', 'ingot_01a', 'ingot_01b', 'key_01a', 'key_01b', 'necklace_01a', 'necklace_01b', 'pearl_01a', 'pearl_01b', 'ring_01a', 'ring_01b', 'scroll_01a', 'scroll_01b', 'scroll_01c', 'scroll_01d', 'scroll_01e', 'scroll_01f'],
        Consumables: ['potion_01a', 'potion_01b', 'potion_01c', 'potion_01d', 'potion_01e', 'potion_01f', 'potion_01g', 'potion_01h', 'potion_02a', 'potion_02b', 'potion_02c', 'potion_02d', 'potion_02e', 'potion_02f', 'potion_03a', 'potion_03b', 'fish_01a', 'fish_01b', 'fish_01c', 'fish_01d', 'fish_01e', 'candy_01a', 'candy_01b', 'candy_01c', 'candy_01d', 'candy_01e', 'candy_01f', 'candy_01g', 'candy_02a', 'candy_02b']
    };

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
            const key = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes[i + 49]); // 49 is keycode for '1'
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
            slot.itemImage = this.add.rectangle(slot.x, slot.y, 32, 32, 0xff0000)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.itemBarContainer.add(slot.itemImage);
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
                if (this.backpackVisible) {
                    this.hideBackpack();
                } else if (this.marketplaceVisible) {
                    this.marketplaceContainer.setVisible(false);
                    this.showBackpack();
                } else {
                    this.showBackpack();
                }
            }
        });

        // Add 'ESC' key to close marketplace/backpack
        const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        escKey.on('down', () => {
            if (this.backpackVisible) {
                this.hideBackpack();
                // If marketplace was open before, show it back
                if (this.marketplaceVisible) {
                    this.marketplaceContainer.setVisible(true);
                }
            } else if (this.marketplaceVisible) {
                this.hideMarketplace();
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
            slot.itemImage = this.add.rectangle(slot.x, slot.y, 32, 32, 0xff0000)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.backpackContainer.add(slot.itemImage);
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

        categories.forEach((cat, index) => {
            // Convert relative position to absolute
            const absoluteX = frameCenterX - (frameWidth / 2) + (cat.x * marketplaceScale) + (cat.width * marketplaceScale / 2);
            const absoluteY = frameCenterY - (frameHeight / 2) + (cat.y * marketplaceScale) + (cat.height * marketplaceScale / 2);

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

        // Select first button (Weapons) by default
        this.selectedCategory = 'Weapons';
        if (this.marketplaceButtons.length > 0 && this.marketplaceButtons[0] && this.marketplaceButtons[0].active) {
            this.marketplaceButtons[0].setTexture('btn-weapons-selected');
        }
        this.loadMarketplaceItems('Weapons');
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
        sellButton.setInteractive({ useHandCursor: true });
        sellButton.setVisible(false); // Hidden by default, show when marketplace opens
        
        // Update position dynamically
        this.updateSellButtonPosition(sellButton);

        sellButton.on('pointerdown', () => {
            console.log('Sell button clicked');
            // TODO: Implement sell logic
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

    private loadMarketplaceItems(category: string): void {
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

        // Get items for category
        const items = this.MARKETPLACE_ITEMS[category as keyof typeof this.MARKETPLACE_ITEMS] || [];
        
        // Populate slots with items (max 30)
        items.forEach((itemId, index) => {
            if (index >= this.MARKETPLACE_SLOT_COUNT) return;
            
            const slot = this.marketplaceSlots[index];
            if (!slot) return;

            // Add item image
            if (this.textures.exists(itemId)) {
                slot.itemImage = this.add.image(slot.x, slot.y, itemId)
                    .setDisplaySize(32, 32)
                    .setOrigin(0.5, 0.5)
                    .setDepth(250);
                this.marketplaceContainer.add(slot.itemImage);
                
                slot.itemId = itemId;
                slot.itemType = category.toLowerCase();
            }
        });
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

    private handleBuyItem(): void {
        if (this.selectedMarketplaceSlot === -1) return;
        
        const slot = this.marketplaceSlots[this.selectedMarketplaceSlot];
        if (!slot || !slot.itemId) return;

        // Try to add to existing stack in itembar
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const itembarSlot = this.slots[i];
            if (itembarSlot.itemId === slot.itemId) {
                const currentCount = itembarSlot.countText ? parseInt(itembarSlot.countText.text) : 1;
                if (currentCount < this.MAX_STACK_SIZE) {
                    this.addItem(slot.itemId, i, slot.itemType, currentCount + 1);
                    return;
                }
            }
        }

        // Find first empty slot
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            if (!this.slots[i].itemId) {
                this.addItem(slot.itemId, i, slot.itemType, 1);
                return;
            }
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

    public toggleMarketplace(): void {
        if (this.marketplaceVisible) {
            this.hideMarketplace();
        } else {
            this.showMarketplace();
        }
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
        this.npcTradeOverlay = this.add.rectangle(screenCenterX, screenCenterY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5);
        this.npcTradeOverlay.setScrollFactor(0);
        this.npcTradeOverlay.setDepth(27000); // Lower depth so backpack can be interacted with
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
        const cancelBg = this.add.rectangle(-120,220, 180, 60, 0xc94c4c);
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

        // Close the trade UI immediately
        this.hideNPCTrade();
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

    private handleAcceptTrade(): void {
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
            
            // Start Herman's auto-fill animation
            this.startHermanAutoFill();
            
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

        // Background panel (taller to fit content)
        const panel = this.add.rectangle(0, 0, 600, 600, 0x2a2a2a, 0.95);
        panel.setStrokeStyle(3, 0x4a4a4a);
        this.guideMenuContainer.add(panel);

        // Title
        const title = this.add.text(0, -280, '📖 GAME GUIDE', {
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.guideMenuContainer.add(title);

        // Guide content
        const guideText = `🎮 CONTROLS
W/A/S/D - Move  |  SHIFT - Run  |  1-8 - Select slots
Left Click - Pick/Place items  |  Right Click - Split stack
Double Click - Group same items  |  B - Backpack  |  ESC - Close

📦 INVENTORY (Max 99 per stack)
• Item Bar: 8 quick slots at bottom
• Backpack: 25 slots (Press B)
• Left Click: Move entire stack
• Right Click: Pick half / Place 1 item
• Double Click: Auto-group same items

🏪 MARKETPLACE
1. Walk near marketplace building
2. Click floating icon to open
3. Select category (Weapons/Armors/Misc/Consumables)
4. Click item to select (slot turns green)
5. Click BUY button to purchase
6. Items stack automatically in item bar

💡 TIPS
• Stack items to save space
• Use backpack for storage
• Double-click to organize quickly
• Right-click to split for trading`;

        const content = this.add.text(0, 18, guideText, {
            fontSize: '14px',
            color: '#ffffff',
            align: 'left',
            lineSpacing: 8,
            wordWrap: { width: 550 }
        }).setOrigin(0.5);
        this.guideMenuContainer.add(content);

        // Close button
        const closeBtn = this.add.text(280, -280, 'X', {
            fontSize: '32px',
            color: '#ff4444',
            fontStyle: 'bold'
        }).setOrigin(0.5);
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

        // Background panel
        const panel = this.add.rectangle(0, 0, 400, 300, 0x2a2a2a, 0.95);
        panel.setStrokeStyle(3, 0x4a4a4a);
        this.settingsMenuContainer.add(panel);

        // Title
        const title = this.add.text(0, -130, '⚙️ SETTINGS', {
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.settingsMenuContainer.add(title);

        // Music Volume Label
        const volumeLabel = this.add.text(-150, -60, '🔊 Music Volume', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);
        this.settingsMenuContainer.add(volumeLabel);

        // Slider track
        const sliderTrack = this.add.rectangle(0, -20, 200, 8, 0x555555);
        this.settingsMenuContainer.add(sliderTrack);

        // Slider knob
        this.volumeSliderKnob = this.add.circle(this.musicVolume * 200 - 100, -20, 12, 0xffffff);
        this.volumeSliderKnob.setInteractive({ draggable: true });
        this.settingsMenuContainer.add(this.volumeSliderKnob);

        // Volume value text
        this.volumeValueText = this.add.text(120, -20, `${Math.round(this.musicVolume * 100)}%`, {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);
        this.settingsMenuContainer.add(this.volumeValueText);

        // Slider drag logic
        this.volumeSliderKnob.on('drag', (pointer: Phaser.Input.Pointer) => {
            const localX = pointer.x - this.cameras.main.centerX;
            const clampedX = Phaser.Math.Clamp(localX, -100, 100);
            this.volumeSliderKnob!.x = clampedX;
            this.musicVolume = (clampedX + 100) / 200;
            this.volumeValueText!.setText(`${Math.round(this.musicVolume * 100)}%`);
        });

        // Fullscreen Label
        const fullscreenLabel = this.add.text(-150, 40, '🖥️ Fullscreen', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);
        this.settingsMenuContainer.add(fullscreenLabel);

        // Checkbox
        this.fullscreenCheckbox = this.add.rectangle(80, 40, 30, 30, 0x555555);
        this.fullscreenCheckbox.setStrokeStyle(2, 0xffffff);
        this.fullscreenCheckbox.setInteractive();
        this.settingsMenuContainer.add(this.fullscreenCheckbox);

        // Checkmark
        this.fullscreenCheckmark = this.add.text(80, 40, '✓', {
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
        const saveBtn = this.add.image(0, 110, 'save-button');
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
        const closeBtn = this.add.text(180, -130, 'X', {
            fontSize: '32px',
            color: '#ff4444',
            fontStyle: 'bold'
        }).setOrigin(0.5);
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
}